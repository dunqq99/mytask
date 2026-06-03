import express from 'express';
import cors from 'cors';
import pg from 'pg';
import crypto from 'crypto';

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

      // Bảng cấu hình chung (Settings)
      await client.query(`CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255),
        value TEXT
      )`);

      // Nâng cấp các bảng để thêm thuộc tính user_id nhằm phân chia không gian dữ liệu
      await client.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id VARCHAR(50)`);
      await client.query(`ALTER TABLE columns ADD COLUMN IF NOT EXISTS user_id VARCHAR(50)`);
      await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS user_id VARCHAR(50)`);
      await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS image TEXT`);
      await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS services TEXT`);
      await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE`);
      await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS completed_at VARCHAR(50)`);


      // Thay đổi Primary Key bảng settings thành khóa phức hợp (key, user_id)
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
        const featRes = await client.query("SELECT 1 FROM settings WHERE key = 'plan_features' AND user_id = 'system'");
        if (featRes.rowCount === 0) {
          const defaultFeatures = {
            free: { googleSheetsSync: false, activityLogs: false, checklists: true, cardLimit: 10, columnCustomization: false },
            pro: { googleSheetsSync: false, activityLogs: true, checklists: true, cardLimit: 100, columnCustomization: true },
            enterprise: { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 500, columnCustomization: true },
            vip: { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 9999, columnCustomization: true }
          };
          await client.query("INSERT INTO settings (key, value, user_id) VALUES ('plan_features', $1, 'system')", [
            JSON.stringify(defaultFeatures)
          ]);
        }
      } catch (initErr) {
        console.error('[Database Init Error] Không thể tự động tạo tài khoản mặc định:', initErr.message);
        try { await client.query('ROLLBACK'); } catch (e) {}
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

    // 3. Tải Cards
    const cardRes = await client.query('SELECT id, title, description, tags, start_date AS "startDate", due_date AS "dueDate", estimated_duration AS "estimatedDuration", category_id AS "categoryId", checklist, activities, image, services, is_archived AS "isArchived", completed_at AS "completedAt" FROM cards WHERE user_id = $1', [userId]);
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
      completedAt: c.completedAt || null
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
        free: { googleSheetsSync: false, activityLogs: false, checklists: true, cardLimit: 10, columnCustomization: false },
        pro: { googleSheetsSync: false, activityLogs: true, checklists: true, cardLimit: 100, columnCustomization: true },
        enterprise: { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 500, columnCustomization: true },
        vip: { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 9999, columnCustomization: true }
      };
    }

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

    // 3. Cập nhật Cards
    await client.query('DELETE FROM cards WHERE user_id = $1', [userId]);
    if (Array.isArray(cards) && cards.length > 0) {
      for (const c of cards) {
        await client.query(`INSERT INTO cards 
          (id, title, description, tags, start_date, due_date, estimated_duration, category_id, checklist, activities, image, services, user_id, is_archived, completed_at) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`, [
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
            c.completedAt || null
          ]);
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
