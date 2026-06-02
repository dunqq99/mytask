import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Client, Pool } = pg;
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Cấu hình kết nối PostgreSQL
const pgConfig = {
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5433', 10),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'zenboard'
};

let pool;

// 1. Tự động kiểm tra và khởi tạo Database
async function ensureDatabaseAndTables() {
  // Kết nối database 'postgres' mặc định để kiểm tra/tạo database 'zenboard'
  const adminClient = new Client({
    ...pgConfig,
    database: 'postgres'
  });

  try {
    await adminClient.connect();
    const targetDb = pgConfig.database;
    const res = await adminClient.query("SELECT 1 FROM pg_database WHERE datname = $1", [targetDb]);
    
    if (res.rowCount === 0) {
      console.log(`[PostgreSQL] Database "${targetDb}" chưa tồn tại. Đang tự động tạo...`);
      await adminClient.query(`CREATE DATABASE ${targetDb}`);
      console.log(`[PostgreSQL] Đã tạo database "${targetDb}" thành công!`);
    } else {
      console.log(`[PostgreSQL] Database "${targetDb}" đã có sẵn.`);
    }
  } catch (err) {
    console.error('[PostgreSQL Setup Error] Không thể kiểm tra/tạo database:', err.message);
    console.log('Lưu ý: Hãy chắc chắn PostgreSQL đang chạy tại localhost:5432 với username/password tương ứng.');
  } finally {
    try {
      await adminClient.end();
    } catch (e) {
      // Bỏ qua nếu đã đóng
    }
  }

  // Khởi tạo Connection Pool kết nối trực tiếp database 'zenboard'
  pool = new Pool(pgConfig);
  pool.on('error', (err, client) => {
    console.error('[PostgreSQL Connection Pool Error] Idle client error:', err.message);
  });
  
  // Tạo bảng (Schema)
  try {
    const client = await pool.connect();
    
    // Bảng danh mục
    await client.query(`CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      parent_id VARCHAR(50)
    )`);

    // Bảng cột Kanban
    await client.query(`CREATE TABLE IF NOT EXISTS columns (
      id VARCHAR(50) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      color VARCHAR(50),
      card_ids TEXT, -- Lưu mảng ID dưới dạng JSON string để giữ thứ tự
      is_partner INTEGER DEFAULT 0
    )`);

    // Bảng thẻ công việc
    await client.query(`CREATE TABLE IF NOT EXISTS cards (
      id VARCHAR(50) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      tags TEXT, -- Lưu mảng tags dưới dạng JSON string
      start_date VARCHAR(50),
      due_date VARCHAR(50),
      estimated_duration INTEGER DEFAULT 0,
      category_id VARCHAR(50),
      checklist TEXT, -- Lưu checklist dưới dạng JSON string
      activities TEXT -- Lưu lịch sử hoạt động dưới dạng JSON string
    )`);

    // Hỗ trợ lưu trữ ảnh bìa của thẻ công việc (Base64 string)
    await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS image TEXT`);

    // Bảng cấu hình chung
    await client.query(`CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(255) PRIMARY KEY,
      value TEXT
    )`);

    console.log('[PostgreSQL] Đã khởi tạo cấu trúc bảng dữ liệu thành công!');
    client.release();
  } catch (err) {
    console.error('[PostgreSQL Table Init Error] Không thể khởi tạo bảng:', err.message);
  }
}

// Chạy khởi tạo database trước khi lắng nghe cổng
ensureDatabaseAndTables().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend Server đang chạy tại http://localhost:${PORT}`);
  });
});

// API Tải dữ liệu ban đầu
app.get('/api/board', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Database chưa kết nối thành công.' });
  
  let client;
  try {
    client = await pool.connect();
    const data = {
      categories: [],
      columns: [],
      partnerColumns: [],
      cards: [],
      settings: {}
    };

    // 1. Tải Categories
    const catRes = await client.query('SELECT id, name, parent_id AS "parentId" FROM categories');
    data.categories = catRes.rows;

    // 2. Tải Columns
    const colRes = await client.query('SELECT id, title, color, card_ids AS "cardIds", is_partner AS "isPartner" FROM columns');
    colRes.rows.forEach(col => {
      const parsedCol = {
        id: col.id,
        title: col.title,
        color: col.color,
        cardIds: JSON.parse(col.cardIds || '[]')
      };
      if (col.isPartner === 1) {
        data.partnerColumns.push(parsedCol);
      } else {
        data.columns.push(parsedCol);
      }
    });

    // 3. Tải Cards
    const cardRes = await client.query('SELECT id, title, description, tags, start_date AS "startDate", due_date AS "dueDate", estimated_duration AS "estimatedDuration", category_id AS "categoryId", checklist, activities, image FROM cards');
    data.cards = cardRes.rows.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description || '',
      tags: JSON.parse(c.tags || '[]'),
      startDate: c.startDate || '',
      dueDate: c.dueDate || '',
      estimatedDuration: c.estimatedDuration || 0,
      categoryId: c.categoryId || null,
      checklist: JSON.parse(c.checklist || '[]'),
      activities: JSON.parse(c.activities || '[]'),
      image: c.image || null
    }));

    // 4. Tải Settings
    const setRes = await client.query('SELECT key, value FROM settings');
    setRes.rows.forEach(s => {
      try {
        data.settings[s.key] = JSON.parse(s.value);
      } catch {
        data.settings[s.key] = s.value;
      }
    });

    client.release();
    res.json(data);
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: err.message });
  }
});

// API Đồng bộ hóa toàn bộ trạng thái (Bulk Sync)
app.post('/api/board/sync', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Database chưa kết nối thành công.' });
  const { categories, columns, partnerColumns, cards, settings } = req.body;

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Cập nhật Categories
    await client.query('DELETE FROM categories');
    if (Array.isArray(categories) && categories.length > 0) {
      for (const cat of categories) {
        await client.query('INSERT INTO categories (id, name, parent_id) VALUES ($1, $2, $3)', [
          cat.id, cat.name, cat.parentId || null
        ]);
      }
    }

    // 2. Cập nhật Columns
    await client.query('DELETE FROM columns');
    if (Array.isArray(columns)) {
      for (const col of columns) {
        await client.query('INSERT INTO columns (id, title, color, card_ids, is_partner) VALUES ($1, $2, $3, $4, 0)', [
          col.id, col.title, col.color || null, JSON.stringify(col.cardIds || [])
        ]);
      }
    }
    if (Array.isArray(partnerColumns)) {
      for (const col of partnerColumns) {
        await client.query('INSERT INTO columns (id, title, color, card_ids, is_partner) VALUES ($1, $2, $3, $4, 1)', [
          col.id, col.title, col.color || null, JSON.stringify(col.cardIds || [])
        ]);
      }
    }

    // 3. Cập nhật Cards
    await client.query('DELETE FROM cards');
    if (Array.isArray(cards) && cards.length > 0) {
      for (const c of cards) {
        await client.query(`INSERT INTO cards 
          (id, title, description, tags, start_date, due_date, estimated_duration, category_id, checklist, activities, image) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`, [
            c.id,
            c.title,
            c.description || '',
            JSON.stringify(c.tags || []),
            c.startDate || '',
            c.dueDate || '',
            c.estimatedDuration || 0,
            c.categoryId || null,
            JSON.stringify(c.checklist || []),
            JSON.stringify(c.activities || []),
            c.image || null
          ]);
      }
    }

    // 4. Cập nhật Settings
    await client.query('DELETE FROM settings');
    if (settings && typeof settings === 'object') {
      for (const [key, val] of Object.entries(settings)) {
        await client.query('INSERT INTO settings (key, value) VALUES ($1, $2)', [
          key, JSON.stringify(val)
        ]);
      }
    }

    await client.query('COMMIT');
    client.release();
    res.json({ status: 'success', message: 'Đồng bộ cơ sở dữ liệu PostgreSQL thành công!' });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (e) {
        // Bỏ qua nếu rollback lỗi do chưa BEGIN
      }
      client.release();
    }
    res.status(500).json({ error: 'Lỗi đồng bộ Postgres: ' + err.message });
  }
});
