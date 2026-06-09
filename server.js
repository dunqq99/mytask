import express from 'express';
import cors from 'cors';
import pg from 'pg';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

const { Client, Pool } = pg;

// Cơ chế ký và xác thực JWT bằng thư viện crypto có sẵn của Node.js (không dùng npm)
const JWT_SECRET = process.env.JWT_SECRET || 'zenboard_super_secret_key_12345';

function base64url(str) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString('utf8');
}

function signToken(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${data}`)
    .digest('base64url');
  return `${header}.${data}.${signature}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, data, signature] = parts;
  
  const expectedSignature = crypto.createHmac('sha256', JWT_SECRET)
    .update(`${header}.${data}`)
    .digest('base64url');
    
  if (signature !== expectedSignature) return null;
  
  try {
    return JSON.parse(base64urlDecode(data));
  } catch {
    return null;
  }
}

// Hàm băm mật khẩu an toàn PBKDF2
function hashPassword(password) {
  const salt = 'zenboard_password_salt_secret';
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}
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

// 1. Tự động kiểm tra và khởi tạo Database với cơ chế thử lại (retry)
async function ensureDatabaseAndTables(retries = 10, delayMs = 3000) {
  for (let i = 0; i < retries; i++) {
    let adminClient;
    try {
      console.log(`[PostgreSQL] Thử kết nối và khởi tạo database (Lần thử ${i + 1}/${retries})...`);
      
      // Kết nối database 'postgres' mặc định để kiểm tra/tạo database 'zenboard'
      adminClient = new Client({
        ...pgConfig,
        database: 'postgres'
      });

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
      
      await adminClient.end();

      // Khởi tạo Connection Pool kết nối trực tiếp database 'zenboard'
      pool = new Pool(pgConfig);
      pool.on('error', (err, client) => {
        console.error('[PostgreSQL Connection Pool Error] Idle client error:', err.message);
      });
      
      const client = await pool.connect();
      
      // Bảng người dùng (Users)
      await client.query(`CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(50) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'editor',
        plan VARCHAR(50) DEFAULT 'free',
        plan_expires_at TIMESTAMP DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      // Đảm bảo cột role và plan tồn tại nếu bảng đã được tạo trước đó
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'editor'`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'free'`);
      await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP DEFAULT NULL`);
      // Tự động chuyển đổi các tài khoản 'viewer' sang 'editor'
      await client.query(`UPDATE users SET role = 'editor' WHERE role = 'viewer'`);

      // Bảng danh mục
      await client.query(`CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(50),
        name VARCHAR(255) NOT NULL,
        parent_id VARCHAR(50),
        user_id VARCHAR(50) DEFAULT 'default' NOT NULL,
        PRIMARY KEY (id, user_id)
      )`);

      // Bảng cột Kanban
      await client.query(`CREATE TABLE IF NOT EXISTS columns (
        id VARCHAR(50),
        title VARCHAR(255) NOT NULL,
        color VARCHAR(50),
        card_ids TEXT, -- Lưu mảng ID dưới dạng JSON string để giữ thứ tự
        is_partner INTEGER DEFAULT 0,
        user_id VARCHAR(50) DEFAULT 'default' NOT NULL,
        PRIMARY KEY (id, user_id)
      )`);

      // Bảng thẻ công việc
      await client.query(`CREATE TABLE IF NOT EXISTS cards (
        id VARCHAR(50),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        tags TEXT, -- Lưu mảng tags dưới dạng JSON string
        start_date VARCHAR(50),
        due_date VARCHAR(50),
        estimated_duration INTEGER DEFAULT 0,
        category_id VARCHAR(50),
        checklist TEXT, -- Lưu checklist dưới dạng JSON string
        activities TEXT, -- Lưu lịch sử hoạt động dưới dạng JSON string
        user_id VARCHAR(50) DEFAULT 'default' NOT NULL,
        PRIMARY KEY (id, user_id)
      )`);

      // Bảng cấu hình chung (Settings)
      await client.query(`CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255),
        value TEXT,
        user_id VARCHAR(50) DEFAULT 'default' NOT NULL,
        PRIMARY KEY (key, user_id)
      )`);

      // Nâng cấp các bảng để thêm thuộc tính user_id nhằm phân chia không gian dữ liệu
      await client.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id VARCHAR(50)`);
      await client.query(`ALTER TABLE columns ADD COLUMN IF NOT EXISTS user_id VARCHAR(50)`);
      await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS user_id VARCHAR(50)`);
      await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS image TEXT`);
      await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS services TEXT`);
      await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE`);
      await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS completed_at VARCHAR(50)`);
      await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS linked_partner_id VARCHAR(50)`);
      await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS assignee_id VARCHAR(50)`);

      // Bảng thành viên nhóm (Team Members)
      await client.query(`CREATE TABLE IF NOT EXISTS team_members (
        owner_id VARCHAR(50) NOT NULL,
        member_id VARCHAR(50) NOT NULL,
        PRIMARY KEY (owner_id, member_id)
      )`);
      await client.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS team_role VARCHAR(50) DEFAULT 'StaffVH'`);

      // Thay đổi Primary Key các bảng thành khóa phức hợp (id, user_id) cho hệ thống nhiều tài khoản
      try {
        await client.query(`UPDATE categories SET user_id = 'default' WHERE user_id IS NULL`);
        await client.query(`ALTER TABLE categories ALTER COLUMN user_id SET NOT NULL`);
        await client.query(`ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_pkey`);
        await client.query(`ALTER TABLE categories ADD CONSTRAINT categories_pkey PRIMARY KEY (id, user_id)`);
      } catch (dbErr) {
        // Bỏ qua nếu cấu hình này đã có sẵn
      }

      try {
        await client.query(`UPDATE columns SET user_id = 'default' WHERE user_id IS NULL`);
        await client.query(`ALTER TABLE columns ALTER COLUMN user_id SET NOT NULL`);
        await client.query(`ALTER TABLE columns DROP CONSTRAINT IF EXISTS columns_pkey`);
        await client.query(`ALTER TABLE columns ADD CONSTRAINT columns_pkey PRIMARY KEY (id, user_id)`);
      } catch (dbErr) {
        // Bỏ qua nếu cấu hình này đã có sẵn
      }

      try {
        await client.query(`UPDATE cards SET user_id = 'default' WHERE user_id IS NULL`);
        await client.query(`ALTER TABLE cards ALTER COLUMN user_id SET NOT NULL`);
        await client.query(`ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_pkey`);
        await client.query(`ALTER TABLE cards ADD CONSTRAINT cards_pkey PRIMARY KEY (id, user_id)`);
      } catch (dbErr) {
        // Bỏ qua nếu cấu hình này đã có sẵn
      }

      try {
        await client.query(`ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey`);
        await client.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS user_id VARCHAR(50)`);
        await client.query(`UPDATE settings SET user_id = 'default' WHERE user_id IS NULL`);
        await client.query(`ALTER TABLE settings ALTER COLUMN user_id SET NOT NULL`);
        await client.query(`ALTER TABLE settings ADD CONSTRAINT settings_pkey PRIMARY KEY (key, user_id)`);
      } catch (dbErr) {
        // Bỏ qua nếu cấu hình này đã có sẵn
      }

      // Tự động tạo tài khoản mặc định massie123 và di chuyển dữ liệu cũ nếu chưa tồn tại
      try {
        const usernamePreset = 'massie123';
        const passwordPreset = '111qqqQQ';
        const userRes = await client.query('SELECT id FROM users WHERE username = $1', [usernamePreset]);
        if (userRes.rowCount === 0) {
          console.log(`[Database Init] Tự động tạo tài khoản mặc định "${usernamePreset}"...`);
          const userId = `usr-massie123`;
          const passwordHash = hashPassword(passwordPreset);
          
          await client.query('BEGIN');
          // Thêm người dùng
          await client.query('INSERT INTO users (id, username, password, role, plan) VALUES ($1, $2, $3, $4, $5)', [
            userId, usernamePreset, passwordHash, 'admin', 'vip'
          ]);
          
          // Di chuyển toàn bộ dữ liệu cũ gán cho massie123
          console.log(`[Migration] Di chuyển toàn bộ dữ liệu cũ (user_id IS NULL) gán cho user_id = ${userId}`);
          await client.query(`UPDATE categories SET user_id = $1 WHERE user_id IS NULL`, [userId]);
          await client.query(`UPDATE columns SET user_id = $1 WHERE user_id IS NULL`, [userId]);
          await client.query(`UPDATE cards SET user_id = $1 WHERE user_id IS NULL`, [userId]);
          await client.query(`UPDATE settings SET user_id = $1 WHERE user_id = 'default' OR user_id IS NULL`, [userId]);
          
          await client.query('COMMIT');
          console.log(`[Database Init] Đã khởi tạo tài khoản và di chuyển dữ liệu thành công cho "${usernamePreset}"!`);
        } else {
          // Đảm bảo tài khoản mặc định luôn có quyền admin và gói vip
          await client.query("UPDATE users SET role = 'admin', plan = 'vip' WHERE username = $1", [usernamePreset]);
        }

        // Tự động seed tính năng của các gói dịch vụ (plan_features) nếu chưa tồn tại
        const featRes = await client.query("SELECT value FROM settings WHERE key = 'plan_features' AND user_id = 'system'");
        if (featRes.rowCount === 0) {
          const defaultFeatures = {
            free: { googleSheetsSync: false, activityLogs: false, checklists: true, cardLimit: 10, columnCustomization: true },
            pro: { googleSheetsSync: false, activityLogs: true, checklists: true, cardLimit: 100, columnCustomization: true },
            enterprise: { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 500, columnCustomization: true },
            vip: { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 9999, columnCustomization: true }
          };
          await client.query("INSERT INTO settings (key, value, user_id) VALUES ('plan_features', $1, 'system')", [
            JSON.stringify(defaultFeatures)
          ]);
        } else {
          // Migration: Đảm bảo gói free có columnCustomization = true trong DB
          try {
            const currentFeatures = JSON.parse(featRes.rows[0].value);
            if (currentFeatures.free && currentFeatures.free.columnCustomization === false) {
              currentFeatures.free.columnCustomization = true;
              await client.query("UPDATE settings SET value = $1 WHERE key = 'plan_features' AND user_id = 'system'", [
                JSON.stringify(currentFeatures)
              ]);
              console.log("[Migration] Đã cập nhật free.columnCustomization thành true trong cơ sở dữ liệu.");
            }
          } catch (migrateErr) {
            console.error('[Migration Error] Lỗi cập nhật cấu hình plan_features:', migrateErr.message);
          }
        }
      } catch (initErr) {
        console.error('[Database Init Error] Không thể tự động tạo tài khoản mặc định:', initErr.message);
        try { await client.query('ROLLBACK'); } catch (e) {}
      }
      // Tự động tạo các tài khoản doanh nghiệp mẫu nếu chưa tồn tại
      try {
        const sampleUsers = [
          { id: 'usr-mng1', username: 'mng1', role: 'editor', plan: 'enterprise' },
          { id: 'usr-mkt1', username: 'mkt1', role: 'editor', plan: 'enterprise' },
          { id: 'usr-vh1', username: 'vh1', role: 'editor', plan: 'enterprise' },
          { id: 'usr-vh2', username: 'vh2', role: 'editor', plan: 'enterprise' },
          { id: 'usr-vh3', username: 'vh3', role: 'editor', plan: 'enterprise' }
        ];

        for (const u of sampleUsers) {
          const userCheck = await client.query('SELECT id FROM users WHERE username = $1', [u.username]);
          if (userCheck.rowCount === 0) {
            console.log(`[Database Init] Tự động tạo tài khoản mẫu "${u.username}"...`);
            const pwdHash = hashPassword('123456');
            await client.query(
              'INSERT INTO users (id, username, password, role, plan) VALUES ($1, $2, $3, $4, $5)',
              [u.id, u.username, pwdHash, u.role, u.plan]
            );
          } else {
            // Đảm bảo gói dịch vụ và role hệ thống của các user này luôn là enterprise / editor
            await client.query('UPDATE users SET role = $1, plan = $2 WHERE username = $3', [u.role, u.plan, u.username]);
          }
        }

        // Tạo mối quan hệ nhóm (mng1 là owner, các thành viên khác là member)
        const ownerId = 'usr-mng1';
        const membersToLink = [
          { id: 'usr-mkt1', teamRole: 'StaffMKT' },
          { id: 'usr-vh1', teamRole: 'StaffVH' },
          { id: 'usr-vh2', teamRole: 'StaffVH' },
          { id: 'usr-vh3', teamRole: 'StaffVH' }
        ];

        for (const m of membersToLink) {
          await client.query(
            `INSERT INTO team_members (owner_id, member_id, team_role) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (owner_id, member_id) 
             DO UPDATE SET team_role = EXCLUDED.team_role`,
            [ownerId, m.id, m.teamRole]
          );
        }
        console.log('[Database Init] Đã khởi tạo và seed dữ liệu tổ đội mẫu cho doanh nghiệp thành công!');
      } catch (seedErr) {
        console.error('[Database Init Error] Lỗi seed tài khoản mẫu doanh nghiệp:', seedErr.message);
      }

      console.log('[PostgreSQL] Đã khởi tạo cấu trúc bảng dữ liệu thành công!');
      client.release();
      return; // Thành công, thoát khỏi hàm
    } catch (err) {
      if (adminClient) {
        try { await adminClient.end(); } catch (e) {}
      }
      console.error(`[PostgreSQL Setup Warning] Thất bại ở lần thử ${i + 1}/${retries}:`, err.message);
      if (i < retries - 1) {
        console.log(`[PostgreSQL] Thử lại sau ${delayMs / 1000} giây...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.error('[PostgreSQL Setup Error] Đã thử hết số lần cho phép. Khởi tạo database thất bại!');
        throw err;
      }
    }
  }
}

// Chạy khởi tạo database trước khi lắng nghe cổng
ensureDatabaseAndTables().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend Server đang chạy tại http://localhost:${PORT}`);
    // Thực hiện sao lưu ngay khi khởi động và lập lịch định kỳ mỗi 24 giờ
    runDatabaseBackup();
    setInterval(runDatabaseBackup, 24 * 60 * 60 * 1000);
  });
}).catch(err => {
  console.error('[Startup Error] Không thể khởi chạy server do lỗi kết nối cơ sở dữ liệu:', err.message);
  process.exit(1);
});

// Middleware xác thực Token JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Truy cập bị từ chối: Thiếu Token xác thực.' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(403).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
  }

  req.user = user;
  next();
}

// API Debug kiểm tra danh sách users
app.get('/api/debug/users', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Database chưa kết nối.' });
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT id, username, role, plan FROM users');
    client.release();
    res.json(result.rows);
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: err.message });
  }
});

// API Debug kiểm tra cấu trúc dữ liệu tổng quan
app.get('/api/debug/db-summary', async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Database chưa kết nối.' });
  let client;
  try {
    client = await pool.connect();
    const usersCount = await client.query('SELECT COUNT(*) FROM users');
    const cardsCount = await client.query('SELECT COUNT(*) FROM cards');
    const columnsCount = await client.query('SELECT COUNT(*) FROM columns');
    const categoriesCount = await client.query('SELECT COUNT(*) FROM categories');
    const settingsCount = await client.query('SELECT COUNT(*) FROM settings');
    const cardsOwners = await client.query('SELECT user_id, COUNT(*) FROM cards GROUP BY user_id');
    const teamMembersCount = await client.query('SELECT COUNT(*) FROM team_members');

    client.release();
    res.json({
      users: parseInt(usersCount.rows[0].count, 10),
      cards: parseInt(cardsCount.rows[0].count, 10),
      columns: parseInt(columnsCount.rows[0].count, 10),
      categories: parseInt(categoriesCount.rows[0].count, 10),
      settings: parseInt(settingsCount.rows[0].count, 10),
      team_members: parseInt(teamMembersCount.rows[0].count, 10),
      cardsOwners: cardsOwners.rows
    });
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: err.message });
  }
});

// API Đăng ký tài khoản mới
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng cung cấp đầy đủ tên đăng nhập và mật khẩu.' });
  }

  const cleanUsername = username.trim().toLowerCase();
  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Tên đăng nhập phải có ít nhất 3 ký tự.' });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Kiểm tra username đã tồn tại chưa
    const userExist = await client.query('SELECT 1 FROM users WHERE username = $1', [cleanUsername]);
    if (userExist.rowCount > 0) {
      client.release();
      return res.status(400).json({ error: 'Tên đăng nhập này đã được sử dụng.' });
    }

    const userId = `usr-${Date.now()}`;
    const passwordHash = hashPassword(password);

    await client.query('BEGIN');
    
    // Kiểm tra xem đây có phải người dùng đầu tiên đăng ký không
    const userCountRes = await client.query('SELECT COUNT(*) FROM users');
    const isFirstUser = parseInt(userCountRes.rows[0].count, 10) === 0;
    const defaultRole = (isFirstUser || cleanUsername === 'massie123') ? 'admin' : 'editor';

    // Thêm người dùng mới
    await client.query('INSERT INTO users (id, username, password, role) VALUES ($1, $2, $3, $4)', [
      userId, cleanUsername, passwordHash, defaultRole
    ]);

    // KIỂM TRA MIGRATION: Nếu là người dùng đầu tiên đăng ký, gán toàn bộ dữ liệu cũ (user_id IS NULL) cho họ
    if (isFirstUser || cleanUsername === 'massie123') {
      console.log(`[Migration] Di chuyển toàn bộ dữ liệu cũ gán cho user_id = ${userId}`);
      await client.query(`UPDATE categories SET user_id = $1 WHERE user_id IS NULL`, [userId]);
      await client.query(`UPDATE columns SET user_id = $1 WHERE user_id IS NULL`, [userId]);
      await client.query(`UPDATE cards SET user_id = $1 WHERE user_id IS NULL`, [userId]);
      await client.query(`UPDATE settings SET user_id = $1 WHERE user_id = 'default' OR user_id IS NULL`, [userId]);
    }

    await client.query('COMMIT');
    client.release();

    const token = signToken({ id: userId, username: cleanUsername, role: defaultRole });
    res.json({ status: 'success', token, username: cleanUsername, role: defaultRole });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (e) {}
      client.release();
    }
    res.status(500).json({ error: 'Lỗi đăng ký tài khoản: ' + err.message });
  }
});

// API Đăng nhập
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Tên đăng nhập và mật khẩu là bắt buộc.' });
  }

  const cleanUsername = username.trim().toLowerCase();
  
  let client;
  try {
    client = await pool.connect();
    const userRes = await client.query('SELECT id, username, password, role FROM users WHERE username = $1', [cleanUsername]);
    client.release();

    if (userRes.rowCount === 0) {
      return res.status(400).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
    }

    const user = userRes.rows[0];
    const passwordHash = hashPassword(password);

    if (user.password !== passwordHash) {
      return res.status(400).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
    }

    const token = signToken({ id: user.id, username: user.username, role: user.role });
    res.json({ status: 'success', token, username: user.username, role: user.role });
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: 'Lỗi đăng nhập: ' + err.message });
  }
});

// API Nâng cấp gói dịch vụ (Tự phục vụ / Trải nghiệm)
app.post('/api/user/upgrade-plan', authenticateToken, async (req, res) => {
  const { plan } = req.body;
  const validPlans = ['free', 'pro', 'enterprise', 'vip'];
  if (!plan || !validPlans.includes(plan)) {
    return res.status(400).json({ error: 'Gói đăng ký không hợp lệ.' });
  }

  const userId = req.user.id;
  let client;
  try {
    client = await pool.connect();
    
    // Đảm bảo không thay đổi gói VIP của massie123
    const userRes = await client.query('SELECT username FROM users WHERE id = $1', [userId]);
    if (userRes.rowCount > 0 && userRes.rows[0].username === 'massie123') {
      if (plan !== 'vip') {
        client.release();
        return res.status(400).json({ error: 'Không thể thay đổi gói của tài khoản massie123.' });
      }
    }

    await client.query('UPDATE users SET plan = $1 WHERE id = $2', [plan, userId]);
    client.release();
    res.json({ status: 'success', plan });
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: 'Lỗi nâng cấp gói dịch vụ: ' + err.message });
  }
});

// API lấy danh sách thành viên (Chỉ Admin)
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    // Kiểm tra trực tiếp role của user từ Database
    const roleCheck = await client.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    if (roleCheck.rowCount === 0 || roleCheck.rows[0].role !== 'admin') {
      client.release();
      return res.status(403).json({ error: 'Bạn không có quyền truy cập chức năng này.' });
    }

    const result = await client.query(`
      SELECT 
        u.id, 
        u.username, 
        u.role, 
        u.plan, 
        u.plan_expires_at AS "planExpiresAt", 
        u.created_at AS "createdAt",
        COALESCE((SELECT COUNT(*) FROM cards c WHERE c.user_id = u.id), 0) AS "cardCount",
        COALESCE((SELECT COUNT(*) FROM columns col WHERE col.user_id = u.id), 0) AS "columnCount",
        COALESCE((SELECT COUNT(*) FROM categories cat WHERE cat.user_id = u.id), 0) AS "categoryCount"
      FROM users u
      ORDER BY u.created_at DESC
    `);
    client.release();
    res.json(result.rows);
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: 'Lỗi lấy danh sách thành viên: ' + err.message });
  }
});

// API cập nhật vai trò thành viên (Chỉ Admin)
app.post('/api/admin/users/role', authenticateToken, async (req, res) => {
  const { userId, role } = req.body;
  if (!userId || !role) {
    return res.status(400).json({ error: 'Thiếu thông tin người dùng hoặc vai trò.' });
  }

  const validRoles = ['admin', 'editor', 'viewer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Vai trò không hợp lệ.' });
  }

  let client;
  try {
    client = await pool.connect();

    // Kiểm tra trực tiếp role của user từ Database
    const roleCheck = await client.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    if (roleCheck.rowCount === 0 || roleCheck.rows[0].role !== 'admin') {
      client.release();
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện chức năng này.' });
    }
    
    // Kiểm tra bảo vệ quyền tối cao của massie123
    const targetUserRes = await client.query('SELECT username FROM users WHERE id = $1', [userId]);
    if (targetUserRes.rowCount > 0 && targetUserRes.rows[0].username === 'massie123' && role !== 'admin') {
      client.release();
      return res.status(400).json({ error: 'Không thể thay đổi quyền hạn tối cao của tài khoản massie123.' });
    }

    // Không cho phép tự hạ quyền của chính mình
    if (userId === req.user.id) {
      client.release();
      return res.status(400).json({ error: 'Bạn không thể tự thay đổi vai trò của chính mình.' });
    }

    await client.query('UPDATE users SET role = $1 WHERE id = $2', [role, userId]);
    client.release();
    res.json({ status: 'success', message: 'Cập nhật quyền hạn thành viên thành công!' });
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: 'Lỗi cập nhật vai trò: ' + err.message });
  }
});

// API cập nhật vai trò, gói đăng ký & hạn sử dụng thành viên (Chỉ Admin)
app.post('/api/admin/users/update', authenticateToken, async (req, res) => {
  const { userId, role, plan, planExpiresAt } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'Thiếu thông tin người dùng.' });
  }

  let client;
  try {
    client = await pool.connect();

    // Kiểm tra trực tiếp role của user từ Database
    const roleCheck = await client.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    if (roleCheck.rowCount === 0 || roleCheck.rows[0].role !== 'admin') {
      client.release();
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện chức năng này.' });
    }
    
    // Kiểm tra bảo vệ quyền tối cao của massie123
    const targetUserRes = await client.query('SELECT username FROM users WHERE id = $1', [userId]);
    if (targetUserRes.rowCount > 0 && targetUserRes.rows[0].username === 'massie123') {
      if ((role && role !== 'admin') || (plan && plan !== 'vip')) {
        client.release();
        return res.status(400).json({ error: 'Không thể thay đổi quyền hạn tối cao của tài khoản massie123.' });
      }
    }

    const updates = [];
    const values = [];
    let valIdx = 1;

    if (role) {
      const validRoles = ['admin', 'editor', 'viewer'];
      if (!validRoles.includes(role)) {
        client.release();
        return res.status(400).json({ error: 'Vai trò không hợp lệ.' });
      }
      if (userId === req.user.id && role !== 'admin') {
        client.release();
        return res.status(400).json({ error: 'Bạn không thể tự thay đổi vai trò của chính mình.' });
      }
      updates.push(`role = $${valIdx++}`);
      values.push(role);
    }

    if (plan) {
      const validPlans = ['free', 'pro', 'enterprise', 'vip'];
      if (!validPlans.includes(plan)) {
        client.release();
        return res.status(400).json({ error: 'Gói đăng ký không hợp lệ.' });
      }
      updates.push(`plan = $${valIdx++}`);
      values.push(plan);
    }

    if (planExpiresAt !== undefined) {
      updates.push(`plan_expires_at = $${valIdx++}`);
      values.push(planExpiresAt ? new Date(planExpiresAt) : null);
    }

    if (updates.length === 0) {
      client.release();
      return res.status(400).json({ error: 'Không có thông tin thay đổi.' });
    }

    values.push(userId);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${valIdx}`;
    await client.query(query, values);
    
    client.release();
    res.json({ status: 'success', message: 'Cập nhật tài khoản thành viên thành công!' });
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: 'Lỗi cập nhật tài khoản: ' + err.message });
  }
});

// API cập nhật cấu hình tính năng của các gói đăng ký (Chỉ Admin)
app.post('/api/admin/plans/features', authenticateToken, async (req, res) => {
  let client;
  try {
    client = await pool.connect();

    // Kiểm tra trực tiếp role của user từ Database
    const roleCheck = await client.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    if (roleCheck.rowCount === 0 || roleCheck.rows[0].role !== 'admin') {
      client.release();
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện chức năng này.' });
    }

    const { features } = req.body;
    if (!features || typeof features !== 'object') {
      client.release();
      return res.status(400).json({ error: 'Thiếu cấu hình tính năng gói.' });
    }

    // Ghi đè vào bảng settings dưới dạng user_id = 'system'
    await client.query(
      `INSERT INTO settings (key, value, user_id) 
       VALUES ('plan_features', $1, 'system') 
       ON CONFLICT (key, user_id) 
       DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(features)]
    );

    client.release();
    res.json({ status: 'success', message: 'Cập nhật cấu hình tính năng các gói thành công!' });
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: 'Lỗi cập nhật tính năng các gói: ' + err.message });
  }
});

// API Tải dữ liệu ban đầu
app.get('/api/board', authenticateToken, async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Database chưa kết nối thành công.' });
  
  const userId = req.user.id;
  
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
    const catRes = await client.query('SELECT id, name, parent_id AS "parentId" FROM categories WHERE user_id = $1', [userId]);
    data.categories = catRes.rows;

    // 2. Tải Columns
    const colRes = await client.query('SELECT id, title, color, card_ids AS "cardIds", is_partner AS "isPartner" FROM columns WHERE user_id = $1', [userId]);
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

    // 3. Tải Cards (gồm thẻ tự tạo, thẻ được giao, hoặc thẻ của thành viên trong nhóm)
    const cardRes = await client.query(`
      SELECT id, title, description, tags, start_date AS "startDate", due_date AS "dueDate", 
             estimated_duration AS "estimatedDuration", category_id AS "categoryId", 
             checklist, activities, image, services, is_archived AS "isArchived", 
             completed_at AS "completedAt", linked_partner_id AS "linkedPartnerId", 
             assignee_id AS "assigneeId", user_id AS "userId" 
      FROM cards 
      WHERE user_id = $1 
         OR assignee_id = $1 
         OR user_id IN (SELECT member_id FROM team_members WHERE owner_id = $1)
    `, [userId]);
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
      image: c.image || null,
      services: JSON.parse(c.services || '[]'),
      isArchived: !!c.isArchived,
      completedAt: c.completedAt || null,
      linkedPartnerId: c.linkedPartnerId || null,
      assigneeId: c.assigneeId || null,
      userId: c.userId || null
    }));


    // 4. Tải Settings
    const setRes = await client.query('SELECT key, value FROM settings WHERE user_id = $1', [userId]);
    setRes.rows.forEach(s => {
      try {
        data.settings[s.key] = JSON.parse(s.value);
      } catch {
        data.settings[s.key] = s.value;
      }
    });

    // 5. Tải thông tin Plan & Expiry & Role
    const userRes = await client.query('SELECT role, plan, plan_expires_at AS "planExpiresAt" FROM users WHERE id = $1', [userId]);
    if (userRes.rowCount > 0) {
      data.userRole = userRes.rows[0].role;
      data.userPlan = userRes.rows[0].plan;
      data.userPlanExpiresAt = userRes.rows[0].planExpiresAt;
    } else {
      data.userRole = 'editor';
      data.userPlan = 'free';
    }

    // 6. Tải cấu hình tính năng các gói (Plan Features)
    const featRes = await client.query("SELECT value FROM settings WHERE key = 'plan_features' AND user_id = 'system'");
    if (featRes.rowCount > 0) {
      data.planFeatures = JSON.parse(featRes.rows[0].value);
    } else {
      data.planFeatures = {
        free: { googleSheetsSync: false, activityLogs: false, checklists: true, cardLimit: 10, columnCustomization: true },
        pro: { googleSheetsSync: false, activityLogs: true, checklists: true, cardLimit: 100, columnCustomization: true },
        enterprise: { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 500, columnCustomization: true },
        vip: { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 9999, columnCustomization: true }
      };
    }

    data.userId = userId; // Trả về ID người dùng đang đăng nhập

    client.release();
    res.json(data);
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: err.message });
  }
});

// API Đồng bộ hóa toàn bộ trạng thái (Bulk Sync)
app.post('/api/board/sync', authenticateToken, async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Database chưa kết nối thành công.' });
  const { categories, columns, partnerColumns, cards, settings } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role || 'editor';

  if (userRole === 'viewer') {
    return res.status(403).json({ error: 'Bạn không có quyền chỉnh sửa dữ liệu (Quyền Xem).' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // 1. Cập nhật Categories
    await client.query('DELETE FROM categories WHERE user_id = $1', [userId]);
    if (Array.isArray(categories) && categories.length > 0) {
      for (const cat of categories) {
        await client.query('INSERT INTO categories (id, name, parent_id, user_id) VALUES ($1, $2, $3, $4)', [
          cat.id, cat.name, cat.parentId || null, userId
        ]);
      }
    }

    // 2. Cập nhật Columns
    await client.query('DELETE FROM columns WHERE user_id = $1', [userId]);
    if (Array.isArray(columns)) {
      for (const col of columns) {
        await client.query('INSERT INTO columns (id, title, color, card_ids, is_partner, user_id) VALUES ($1, $2, $3, $4, 0, $5)', [
          col.id, col.title, col.color || null, JSON.stringify(col.cardIds || []), userId
        ]);
      }
    }
    if (Array.isArray(partnerColumns)) {
      for (const col of partnerColumns) {
        await client.query('INSERT INTO columns (id, title, color, card_ids, is_partner, user_id) VALUES ($1, $2, $3, $4, 1, $5)', [
          col.id, col.title, col.color || null, JSON.stringify(col.cardIds || []), userId
        ]);
      }
    }

    // 3. Cập nhật Cards (chỉ xóa các thẻ do chính user đó sở hữu)
    await client.query('DELETE FROM cards WHERE user_id = $1', [userId]);
    if (Array.isArray(cards) && cards.length > 0) {
      for (const c of cards) {
        // Nếu c.userId trùng với userId hoặc không có userId (thẻ mới): thực hiện INSERT
        if (!c.userId || c.userId === userId) {
          await client.query(`INSERT INTO cards 
            (id, title, description, tags, start_date, due_date, estimated_duration, category_id, checklist, activities, image, services, user_id, is_archived, completed_at, linked_partner_id, assignee_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`, [
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
              c.image || null,
              JSON.stringify(c.services || []),
              userId,
              c.isArchived || false,
              c.completedAt || null,
              c.linkedPartnerId || null,
              c.assigneeId || null
            ]);
        } else {
          // Thẻ thuộc quyền sở hữu của người khác: thực hiện UPDATE nếu được quyền hạn
          await client.query(`UPDATE cards SET 
            title = $1, description = $2, tags = $3, start_date = $4, due_date = $5, 
            estimated_duration = $6, category_id = $7, checklist = $8, activities = $9, 
            image = $10, services = $11, is_archived = $12, completed_at = $13, 
            linked_partner_id = $14, assignee_id = $15 
            WHERE id = $16 
              AND (
                user_id = $17 
                OR assignee_id = $17 
                OR user_id IN (SELECT member_id FROM team_members WHERE owner_id = $17)
              )`, [
              c.title,
              c.description || '',
              JSON.stringify(c.tags || []),
              c.startDate || '',
              c.dueDate || '',
              c.estimatedDuration || 0,
              c.categoryId || null,
              JSON.stringify(c.checklist || []),
              JSON.stringify(c.activities || []),
              c.image || null,
              JSON.stringify(c.services || []),
              c.isArchived || false,
              c.completedAt || null,
              c.linkedPartnerId || null,
              c.assigneeId || null,
              c.id,
              userId
            ]);
        }
      }
    }


    // 4. Cập nhật Settings
    await client.query('DELETE FROM settings WHERE user_id = $1', [userId]);
    if (settings && typeof settings === 'object') {
      for (const [key, val] of Object.entries(settings)) {
        await client.query('INSERT INTO settings (key, value, user_id) VALUES ($1, $2, $3)', [
          key, JSON.stringify(val), userId
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

// API Lấy danh sách thành viên trong vòng tròn đội nhóm của user hiện tại
app.get('/api/workspace/members', authenticateToken, async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Database chưa kết nối.' });
  const userId = req.user.id;
  
  let client;
  try {
    client = await pool.connect();

    // 1. Xác định Manager ID của đội nhóm (nếu đang là thành viên của ai đó thì lấy ID người đó, ngược lại là chính mình)
    let managerId = userId;
    const joinedRes = await client.query('SELECT owner_id FROM team_members WHERE member_id = $1 LIMIT 1', [userId]);
    if (joinedRes.rowCount > 0) {
      managerId = joinedRes.rows[0].owner_id;
    }
    
    // 2. Xác định vai trò tổ đội (RolesTeam) của user hiện tại
    let userTeamRole = 'StaffVH';
    if (userId === managerId) {
      userTeamRole = 'MNG';
    } else {
      const roleRes = await client.query('SELECT team_role FROM team_members WHERE owner_id = $1 AND member_id = $2', [managerId, userId]);
      if (roleRes.rowCount > 0) {
        userTeamRole = roleRes.rows[0].team_role || 'StaffVH';
      }
    }

    // 3. Lấy thông tin Trưởng nhóm (managerId)
    const managerRes = await client.query('SELECT id, username FROM users WHERE id = $1', [managerId]);
    // Lấy thông tin các thành viên trong nhóm
    const membersRes = await client.query(`
      SELECT u.id, u.username, tm.team_role FROM users u
      JOIN team_members tm ON tm.member_id = u.id
      WHERE tm.owner_id = $1
    `, [managerId]);

    const finalMembers = [];
    if (managerRes.rowCount > 0) {
      finalMembers.push({
        id: managerRes.rows[0].id,
        username: managerRes.rows[0].username,
        role: 'MNG'
      });
    }

    for (const row of membersRes.rows) {
      finalMembers.push({
        id: row.id,
        username: row.username,
        role: row.team_role || 'StaffVH'
      });
    }

    // 4. Lọc thành viên có thể giao việc dựa trên vai trò đội nhóm của user đang đăng nhập
    let filteredMembers = finalMembers;
    if (userTeamRole === 'StaffVH' || userTeamRole === 'StaffMKT') {
      // StaffVH và StaffMKT không thể phân công công việc cho Trưởng nhóm (MNG)
      filteredMembers = finalMembers.filter(m => m.role !== 'MNG');
    }

    client.release();
    res.json(filteredMembers);
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: err.message });
  }
});

// API Lấy danh sách nhóm của tôi và danh sách nhóm đã tham gia
app.get('/api/team', authenticateToken, async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Database chưa kết nối.' });
  const userId = req.user.id;
  
  let client;
  try {
    client = await pool.connect();
    
    // Thành viên do tôi mời (lấy vai trò đội nhóm tm.team_role)
    const membersRes = await client.query(`
      SELECT u.id, u.username, tm.team_role AS "role" FROM users u
      JOIN team_members tm ON tm.member_id = u.id
      WHERE tm.owner_id = $1
    `, [userId]);
    
    // Nhóm tôi đã tham gia (những người đã mời tôi)
    const joinedRes = await client.query(`
      SELECT u.id AS "ownerId", u.username AS "ownerUsername" FROM users u
      JOIN team_members tm ON tm.owner_id = u.id
      WHERE tm.member_id = $1
    `, [userId]);
    
    client.release();
    res.json({
      myMembers: membersRes.rows,
      joinedTeams: joinedRes.rows
    });
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: err.message });
  }
});

// API Mời thành viên bằng Username
app.post('/api/team/invite', authenticateToken, async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Database chưa kết nối.' });
  const userId = req.user.id;
  const { username } = req.body;
  
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Tên người dùng không được để trống.' });
  }
  
  let client;
  try {
    client = await pool.connect();
    
    // Tìm ID người dùng được mời
    const targetUserRes = await client.query('SELECT id FROM users WHERE username = $1', [username.trim()]);
    if (targetUserRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Không tìm thấy người dùng trên hệ thống.' });
    }
    
    const targetUserId = targetUserRes.rows[0].id;
    if (targetUserId === userId) {
      client.release();
      return res.status(400).json({ error: 'Bạn không thể tự mời chính mình vào nhóm.' });
    }
    
    // Lưu vào bảng team_members với team_role mặc định là StaffVH
    await client.query(`
      INSERT INTO team_members (owner_id, member_id, team_role)
      VALUES ($1, $2, 'StaffVH')
      ON CONFLICT (owner_id, member_id) DO NOTHING
    `, [userId, targetUserId]);
    
    client.release();
    res.json({ success: true, message: 'Đã mời thành viên vào nhóm thành công!' });
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: err.message });
  }
});

// API Cập nhật vai trò đội nhóm của thành viên (Chỉ Trưởng nhóm mới có quyền)
app.post('/api/team/update-role', authenticateToken, async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Database chưa kết nối.' });
  const userId = req.user.id;
  const { memberId, role } = req.body;
  
  if (!memberId || !role) {
    return res.status(400).json({ error: 'Thiếu thông tin thành viên hoặc vai trò.' });
  }
  
  const validRoles = ['StaffMKT', 'StaffVH'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Vai trò đội nhóm không hợp lệ.' });
  }
  
  let client;
  try {
    client = await pool.connect();
    
    // Kiểm tra xem memberId có phải là thành viên trong nhóm của userId không
    const checkRes = await client.query(
      'SELECT 1 FROM team_members WHERE owner_id = $1 AND member_id = $2',
      [userId, memberId]
    );
    
    if (checkRes.rowCount === 0) {
      client.release();
      return res.status(403).json({ error: 'Bạn không có quyền thay đổi vai trò của thành viên này.' });
    }
    
    // Cập nhật vai trò đội nhóm
    await client.query(
      'UPDATE team_members SET team_role = $1 WHERE owner_id = $2 AND member_id = $3',
      [role, userId, memberId]
    );
    
    client.release();
    res.json({ success: true, message: 'Đã cập nhật vai trò đội nhóm thành công!' });
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: err.message });
  }
});

// API Xóa thành viên khỏi nhóm của mình
app.post('/api/team/remove', authenticateToken, async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Database chưa kết nối.' });
  const userId = req.user.id;
  const { memberId } = req.body;
  
  if (!memberId) {
    return res.status(400).json({ error: 'ID thành viên không hợp lệ.' });
  }
  
  let client;
  try {
    client = await pool.connect();
    
    await client.query('DELETE FROM team_members WHERE owner_id = $1 AND member_id = $2', [userId, memberId]);
    
    client.release();
    res.json({ success: true, message: 'Đã xóa thành viên khỏi nhóm.' });
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: err.message });
  }
});

// Hàm tự động sao lưu cơ sở dữ liệu hàng ngày (Daily DB Backup)
function runDatabaseBackup() {
  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const now = new Date();
  const pad = (num) => String(num).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);
  
  const host = pgConfig.host || 'db';
  const port = pgConfig.port || 5432;
  const user = pgConfig.user || 'postgres';
  const dbName = pgConfig.database || 'zenboard';
  const password = pgConfig.password || 'postgres';
  
  const cmd = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${user} -d ${dbName} -f "${backupFile}"`;
  
  console.log(`[Backup] Đang tiến hành sao lưu Database vào: ${backupFile}...`);
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error('[Backup Error] Lỗi sao lưu Database:', error.message);
      return;
    }
    console.log(`[Backup] Đã tạo thành công bản sao lưu Database: backup-${timestamp}.sql`);
    
    // Tự động dọn dẹp các bản sao lưu cũ hơn 30 ngày
    try {
      const files = fs.readdirSync(backupDir);
      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 ngày
      const nowMs = Date.now();
      
      files.forEach(file => {
        if (file.startsWith('backup-') && file.endsWith('.sql')) {
          const filePath = path.join(backupDir, file);
          const stats = fs.statSync(filePath);
          if (nowMs - stats.mtimeMs > maxAge) {
            fs.unlinkSync(filePath);
            console.log(`[Backup Prune] Đã xóa bản sao lưu cũ > 30 ngày: ${file}`);
          }
        }
      });
    } catch (pruneErr) {
      console.error('[Backup Prune Error] Lỗi dọn dẹp bản sao lưu cũ:', pruneErr.message);
    }
  });
}
