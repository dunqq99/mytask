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
      await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS column_id VARCHAR(50)`);
      await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS created_by VARCHAR(50)`);
      await client.query(`UPDATE cards SET created_by = user_id WHERE created_by IS NULL`);


      // Fix incorrect created_by for delegated/assigned cards by reading their activity log
      try {
        const wrongCards = await client.query(`
          SELECT c.id, c.user_id, c.activities, tm.owner_id AS manager_id, u.username AS manager_username
          FROM cards c
          JOIN team_members tm ON c.user_id = tm.member_id
          JOIN users u ON tm.owner_id = u.id
          WHERE c.created_by = c.user_id AND tm.status = 'active'
        `);
        for (const row of wrongCards.rows) {
          let activities = [];
          try {
            activities = typeof row.activities === 'string' ? JSON.parse(row.activities) : (row.activities || []);
          } catch (e) {
            activities = [];
          }
          if (Array.isArray(activities)) {
            // Check if any activity text indicates assignment by the manager
            const assignedByManager = activities.some(act => 
              act.text && (
                act.text.includes(`bởi ${row.manager_username}`) || 
                act.text.includes(`giao bởi ${row.manager_username}`) ||
                act.text.includes(`bởi hệ thống`) ||
                act.text.includes(`phân công công việc`)
              )
            );
            if (assignedByManager) {
              console.log(`[Database Migration] Sửa created_by của thẻ ${row.id} từ ${row.user_id} sang manager ${row.manager_id}`);
              await client.query('UPDATE cards SET created_by = $1 WHERE id = $2 AND user_id = $3', [row.manager_id, row.id, row.user_id]);
            }
          }
        }
      } catch (err) {
        console.error('[Database Migration Warning] Không thể sửa created_by từ activities:', err.message);
      }



      // Bảng thành viên nhóm (Team Members)
      await client.query(`CREATE TABLE IF NOT EXISTS team_members (
        owner_id VARCHAR(50) NOT NULL,
        member_id VARCHAR(50) NOT NULL,
        PRIMARY KEY (owner_id, member_id)
      )`);
      await client.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS team_role VARCHAR(50) DEFAULT 'StaffVH'`);
      await client.query(`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`);

      // Bảng tên đội nhóm (Teams)
      await client.query(`CREATE TABLE IF NOT EXISTS teams (
        owner_id VARCHAR(50) PRIMARY KEY,
        team_name VARCHAR(255) NOT NULL
      )`);

      // Bảng vai trò đội nhóm động (Team Roles) - Scoped by owner_id (Manager/Owner)
      try {
        const checkCol = await client.query(`
          SELECT column_name FROM information_schema.columns 
          WHERE table_name = 'team_roles' AND column_name = 'owner_id'
        `);
        if (checkCol.rowCount === 0) {
          await client.query(`DROP TABLE IF EXISTS team_roles CASCADE`);
        }
      } catch (err) {
        await client.query(`DROP TABLE IF EXISTS team_roles CASCADE`);
      }

      await client.query(`CREATE TABLE IF NOT EXISTS team_roles (
        owner_id VARCHAR(50) NOT NULL,
        role_key VARCHAR(50) NOT NULL,
        role_name VARCHAR(255) NOT NULL,
        PRIMARY KEY (owner_id, role_key)
      )`);

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
            business: { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 1000, columnCustomization: true },
            vip: { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 9999, columnCustomization: true }
          };
          await client.query("INSERT INTO settings (key, value, user_id) VALUES ('plan_features', $1, 'system')", [
            JSON.stringify(defaultFeatures)
          ]);
        } else {
          // Migration: Đảm bảo gói free có columnCustomization = true và gói business tồn tại trong DB, gộp enterprise vào business
          try {
            const currentFeatures = JSON.parse(featRes.rows[0].value);
            let updated = false;
            if (currentFeatures.free && currentFeatures.free.columnCustomization === false) {
              currentFeatures.free.columnCustomization = true;
              updated = true;
            }
            if (currentFeatures.enterprise) {
              delete currentFeatures.enterprise;
              updated = true;
            }
            if (!currentFeatures.business || currentFeatures.business.cardLimit !== 1000) {
              currentFeatures.business = { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 1000, columnCustomization: true };
              updated = true;
            }
            if (updated) {
              await client.query("UPDATE settings SET value = $1 WHERE key = 'plan_features' AND user_id = 'system'", [
                JSON.stringify(currentFeatures)
              ]);
              console.log("[Migration] Đã cập nhật plan_features trong cơ sở dữ liệu.");
            }
          } catch (migrateErr) {
            console.error('[Migration Error] Lỗi cập nhật cấu hình plan_features:', migrateErr.message);
          }
        }

        // Cập nhật tất cả các tài khoản 'enterprise' hiện có sang 'business'
        await client.query("UPDATE users SET plan = 'business' WHERE plan = 'enterprise'");

      } catch (initErr) {
        console.error('[Database Init Error] Không thể tự động tạo tài khoản mặc định:', initErr.message);
        try { await client.query('ROLLBACK'); } catch (e) {}
      }
      // Tự động tạo các tài khoản doanh nghiệp mẫu nếu chưa tồn tại
      try {
        const sampleUsers = [
          { id: 'usr-mng1', username: 'mng1', role: 'editor', plan: 'business' },
          { id: 'usr-mkt1', username: 'mkt1', role: 'editor', plan: 'business' },
          { id: 'usr-vh1', username: 'vh1', role: 'editor', plan: 'business' },
          { id: 'usr-vh2', username: 'vh2', role: 'editor', plan: 'business' },
          { id: 'usr-vh3', username: 'vh3', role: 'editor', plan: 'business' }
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
            // Đảm bảo gói dịch vụ và role hệ thống của các user này luôn là business / editor
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

      // Migration: Điền column_id cho các thẻ hiện có
      try {
        const cardsCheck = await client.query(`SELECT 1 FROM cards WHERE column_id IS NOT NULL LIMIT 1`);
        if (cardsCheck.rowCount === 0) {
          console.log(`[Database Migration] Bắt đầu điền column_id cho các thẻ hiện có...`);
          const colsToMigrate = await client.query('SELECT id, card_ids, user_id FROM columns');
          for (const colRow of colsToMigrate.rows) {
            const cardIds = JSON.parse(colRow.card_ids || '[]');
            if (Array.isArray(cardIds) && cardIds.length > 0) {
              await client.query(`
                UPDATE cards 
                SET column_id = $1 
                WHERE id = ANY($2::varchar[]) AND user_id = $3 AND column_id IS NULL
              `, [colRow.id, cardIds, colRow.user_id]);
            }
          }
          // Fallback cho bất kỳ thẻ nào còn lại chưa có column_id
          await client.query(`UPDATE cards SET column_id = 'col-1' WHERE column_id IS NULL`);
          console.log(`[Database Migration] Đã điền column_id hoàn tất!`);
        }
      } catch (migrateColErr) {
        console.error('[Database Migration Warning] Không thể di chuyển cột:', migrateColErr.message);
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

// Helper để đảm bảo vai trò đội nhóm mặc định tồn tại cho một managerId cụ thể
async function ensureTeamRolesExist(client, managerId) {
  if (!managerId) return;
  const trRes = await client.query('SELECT COUNT(*) FROM team_roles WHERE owner_id = $1', [managerId]);
  if (parseInt(trRes.rows[0].count, 10) === 0) {
    await client.query(`
      INSERT INTO team_roles (owner_id, role_key, role_name) VALUES 
      ($1, 'StaffVH', 'StaffVH (Vận hành)'),
      ($1, 'StaffMKT', 'StaffMKT (Marketing)')
    `, [managerId]);
  }
}

// Helper dọn dẹp khi thành viên bị xóa khỏi nhóm
async function cleanUpTeammateRemoval(client, memberId) {
  if (!memberId) return;
  // 1. Kiểm tra xem user này có còn là thành viên hoạt động ở đội nhóm nào khác không
  const checkRes = await client.query("SELECT COUNT(*) FROM team_members WHERE member_id = $1 AND status = 'active'", [memberId]);
  const activeTeamsCount = parseInt(checkRes.rows[0].count, 10);
  
  if (activeTeamsCount === 0) {
    // 2. Chuyển plan về free
    await client.query("UPDATE users SET plan = 'free' WHERE id = $1", [memberId]);
    
    // 3. Xóa toàn bộ dữ liệu của user (trắng tinh không có gì cả)
    await client.query('DELETE FROM cards WHERE user_id = $1', [memberId]);
    await client.query('UPDATE cards SET assignee_id = NULL WHERE assignee_id = $1', [memberId]);
    await client.query('DELETE FROM columns WHERE user_id = $1', [memberId]);
    await client.query('DELETE FROM categories WHERE user_id = $1', [memberId]);
    await client.query('DELETE FROM settings WHERE user_id = $1', [memberId]);

    // 4. Giải tán đội nhóm nếu user này sở hữu đội nhóm (bởi vì đã về Free)
    const oldMembersRes = await client.query('SELECT member_id FROM team_members WHERE owner_id = $1', [memberId]);
    const oldMemberIds = oldMembersRes.rows.map(r => r.member_id);

    await client.query('DELETE FROM team_members WHERE owner_id = $1', [memberId]);
    await client.query('DELETE FROM teams WHERE owner_id = $1', [memberId]);
    await client.query('DELETE FROM team_roles WHERE owner_id = $1', [memberId]);

    // Dọn dẹp đệ quy cho các thành viên của nhóm bị giải tán
    for (const rid of oldMemberIds) {
      await cleanUpTeammateRemoval(client, rid);
    }
  }
}

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

// API Lấy thời gian hệ thống của VPS
app.get('/api/system-time', (req, res) => {
  res.json({
    time: new Date().toLocaleString('vi-VN'),
    timezone: process.env.TZ || 'Asia/Ho_Chi_Minh',
    utcTime: new Date().toISOString()
  });
});

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
  const validPlans = ['free', 'pro', 'business', 'vip'];
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
      const validPlans = ['free', 'pro', 'business', 'vip'];
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

// API lấy toàn bộ danh sách đội nhóm (Chỉ Admin)
app.get('/api/admin/teams', authenticateToken, async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    
    // Kiểm tra trực tiếp role của user từ Database
    const roleCheck = await client.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    if (roleCheck.rowCount === 0 || roleCheck.rows[0].role !== 'admin') {
      client.release();
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện chức năng này.' });
    }
    
    const query = `
      SELECT tm.owner_id AS "ownerId", u_owner.username AS "ownerUsername",
             t.team_name AS "teamName",
             tm.member_id AS "memberId", u_member.username AS "memberUsername",
             tm.team_role AS "teamRole"
      FROM team_members tm
      JOIN users u_owner ON tm.owner_id = u_owner.id
      JOIN users u_member ON tm.member_id = u_member.id
      LEFT JOIN teams t ON tm.owner_id = t.owner_id
      ORDER BY u_owner.username, u_member.username
    `;
    const result = await client.query(query);

    // Lấy thêm những đội nhóm có tên tùy chỉnh nhưng chưa có thành viên nào
    const emptyTeamsRes = await client.query(`
      SELECT t.owner_id AS "ownerId", u.username AS "ownerUsername", t.team_name AS "teamName"
      FROM teams t
      JOIN users u ON t.owner_id = u.id
      WHERE t.owner_id NOT IN (SELECT DISTINCT owner_id FROM team_members)
    `);

    client.release();
    
    // Group by ownerId
    const teamsMap = {};

    // First, add all defined teams (even empty ones)
    emptyTeamsRes.rows.forEach(row => {
      teamsMap[row.ownerId] = {
        ownerId: row.ownerId,
        ownerUsername: row.ownerUsername,
        teamName: row.teamName,
        members: []
      };
    });

    result.rows.forEach(row => {
      if (!teamsMap[row.ownerId]) {
        teamsMap[row.ownerId] = {
          ownerId: row.ownerId,
          ownerUsername: row.ownerUsername,
          teamName: row.teamName || '',
          members: []
        };
      }
      // If teamName was null from the team_members rows, but we set it or it was retrieved, make sure it is updated
      if (row.teamName && !teamsMap[row.ownerId].teamName) {
        teamsMap[row.ownerId].teamName = row.teamName;
      }
      teamsMap[row.ownerId].members.push({
        memberId: row.memberId,
        memberUsername: row.memberUsername,
        teamRole: row.teamRole
      });
    });
    
    res.json(Object.values(teamsMap));
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: 'Lỗi lấy danh sách đội nhóm: ' + err.message });
  }
});

// API lưu đội nhóm thủ công (Chỉ Admin)
app.post('/api/admin/teams/save', authenticateToken, async (req, res) => {
  const { ownerId, teamName, members } = req.body;
  if (!ownerId) {
    return res.status(400).json({ error: 'Thiếu thông tin trưởng nhóm (Manager ID).' });
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
    
    await client.query('BEGIN');

    // Lưu tên đội nhóm
    if (teamName && teamName.trim()) {
      await client.query(`
        INSERT INTO teams (owner_id, team_name) 
        VALUES ($1, $2)
        ON CONFLICT (owner_id) 
        DO UPDATE SET team_name = EXCLUDED.team_name
      `, [ownerId, teamName.trim()]);
    } else {
      await client.query('DELETE FROM teams WHERE owner_id = $1', [ownerId]);
    }
    
    // Lấy danh sách thành viên cũ trước khi thay đổi để đối chiếu
    const oldMembersRes = await client.query('SELECT member_id FROM team_members WHERE owner_id = $1', [ownerId]);
    const oldMemberIds = oldMembersRes.rows.map(r => r.member_id);

    // Xóa các thành viên cũ
    await client.query('DELETE FROM team_members WHERE owner_id = $1', [ownerId]);
    
    // Thêm các thành viên mới
    if (Array.isArray(members) && members.length > 0) {
      // Đảm bảo vai trò mặc định tồn tại cho ownerId và lấy vai trò đầu tiên của ownerId đó
      await ensureTeamRolesExist(client, ownerId);
      const trRes = await client.query('SELECT role_key FROM team_roles WHERE owner_id = $1 LIMIT 1', [ownerId]);
      const defaultRole = trRes.rowCount > 0 ? trRes.rows[0].role_key : 'StaffVH';

      for (const m of members) {
        if (m.memberId === ownerId) {
          throw new Error('Trưởng nhóm không thể làm thành viên của chính mình.');
        }
        await client.query(
          'INSERT INTO team_members (owner_id, member_id, team_role) VALUES ($1, $2, $3)',
          [ownerId, m.memberId, m.teamRole || defaultRole]
        );
      }
    }

    // Dọn dẹp những thành viên bị xóa khỏi nhóm
    const newMemberIds = Array.isArray(members) ? members.map(m => m.memberId) : [];
    const removedMemberIds = oldMemberIds.filter(id => !newMemberIds.includes(id));
    for (const rid of removedMemberIds) {
      await cleanUpTeammateRemoval(client, rid);
    }
    
    await client.query('COMMIT');
    client.release();
    res.json({ status: 'success', message: 'Cấu hình đội nhóm thành công!' });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (e) {}
      client.release();
    }
    res.status(500).json({ error: 'Lỗi cấu hình đội nhóm: ' + err.message });
  }
});

// API giải tán đội nhóm thủ công (Chỉ Admin)
app.delete('/api/admin/teams/:ownerId', authenticateToken, async (req, res) => {
  const { ownerId } = req.params;
  if (!ownerId) {
    return res.status(400).json({ error: 'Thiếu thông tin trưởng nhóm.' });
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
    
    await client.query('BEGIN');
    
    // Lấy danh sách thành viên trước khi xóa
    const oldMembersRes = await client.query('SELECT member_id FROM team_members WHERE owner_id = $1', [ownerId]);
    const oldMemberIds = oldMembersRes.rows.map(r => r.member_id);

    await client.query('DELETE FROM team_members WHERE owner_id = $1', [ownerId]);
    await client.query('DELETE FROM teams WHERE owner_id = $1', [ownerId]);
    
    // Dọn dẹp
    for (const rid of oldMemberIds) {
      await cleanUpTeammateRemoval(client, rid);
    }
    
    await client.query('COMMIT');

    client.release();
    res.json({ status: 'success', message: 'Đã giải tán đội nhóm thành công!' });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (e) {}
      client.release();
    }
    res.status(500).json({ error: 'Lỗi giải tán đội nhóm: ' + err.message });
  }
});

// API lấy danh sách vai trò đội nhóm động (Scoped theo manager của user hoặc ownerId cụ thể)
app.get('/api/team-roles', authenticateToken, async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Database chưa kết nối.' });
  const userId = req.user.id;
  const { ownerId } = req.query;
  let client;
  try {
    client = await pool.connect();
    
    let managerId = ownerId || userId;
    if (ownerId && ownerId !== userId) {
      // Kiểm tra xem có phải admin không
      const roleCheck = await client.query('SELECT role FROM users WHERE id = $1', [userId]);
      const isAdmin = roleCheck.rowCount > 0 && roleCheck.rows[0].role === 'admin';
      
      // Kiểm tra xem có phải thành viên nhóm của ownerId không
      const isMemberRes = await client.query('SELECT 1 FROM team_members WHERE owner_id = $1 AND member_id = $2', [ownerId, userId]);
      const isMember = isMemberRes.rowCount > 0;
      
      if (!isAdmin && !isMember) {
        client.release();
        return res.status(403).json({ error: 'Bạn không có quyền truy cập vai trò của đội nhóm này.' });
      }
    } else if (!ownerId) {
      const joinedRes = await client.query('SELECT owner_id FROM team_members WHERE member_id = $1 LIMIT 1', [userId]);
      if (joinedRes.rowCount > 0) {
        managerId = joinedRes.rows[0].owner_id;
      }
    }

    // Đảm bảo vai trò mặc định tồn tại cho managerId này
    await ensureTeamRolesExist(client, managerId);

    const result = await client.query(
      'SELECT role_key AS "roleKey", role_name AS "roleName" FROM team_roles WHERE owner_id = $1 ORDER BY role_key',
      [managerId]
    );
    client.release();
    res.json(result.rows);
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: err.message });
  }
});

// API lưu mới hoặc cập nhật vai trò đội nhóm (Chỉ dành cho Trưởng nhóm/Manager)
app.post('/api/team-roles/save', authenticateToken, async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Database chưa kết nối.' });
  const { roleKey, roleName } = req.body;
  if (!roleKey || !roleName) {
    return res.status(400).json({ error: 'Thiếu thông tin vai trò (Mã hoặc Tên hiển thị).' });
  }

  const cleanRoleKey = roleKey.trim();
  const cleanRoleName = roleName.trim();
  const ownerId = req.user.id;

  let client;
  try {
    client = await pool.connect();
    
    // Kiểm tra xem plan của user hiện tại có phải là free không
    const userPlanRes = await client.query('SELECT plan FROM users WHERE id = $1', [ownerId]);
    if (userPlanRes.rowCount > 0 && userPlanRes.rows[0].plan === 'free') {
      client.release();
      return res.status(403).json({ error: 'Tài khoản miễn phí (Free) không thể sử dụng chức năng đội nhóm. Vui lòng nâng cấp gói.' });
    }

    await ensureTeamRolesExist(client, ownerId);

    await client.query(`
      INSERT INTO team_roles (owner_id, role_key, role_name) 
      VALUES ($1, $2, $3)
      ON CONFLICT (owner_id, role_key) 
      DO UPDATE SET role_name = EXCLUDED.role_name
    `, [ownerId, cleanRoleKey, cleanRoleName]);

    client.release();
    res.json({ status: 'success', message: 'Lưu vai trò đội nhóm thành công!' });
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: err.message });
  }
});

// API xóa vai trò đội nhóm (Chỉ dành cho Trưởng nhóm/Manager)
app.delete('/api/team-roles/:roleKey', authenticateToken, async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Database chưa kết nối.' });
  const { roleKey } = req.params;
  const ownerId = req.user.id;

  if (!roleKey) {
    return res.status(400).json({ error: 'Thiếu mã vai trò.' });
  }

  let client;
  try {
    client = await pool.connect();
    
    // Kiểm tra xem plan của user hiện tại có phải là free không
    const userPlanRes = await client.query('SELECT plan FROM users WHERE id = $1', [ownerId]);
    if (userPlanRes.rowCount > 0 && userPlanRes.rows[0].plan === 'free') {
      client.release();
      return res.status(403).json({ error: 'Tài khoản miễn phí (Free) không thể sử dụng chức năng đội nhóm. Vui lòng nâng cấp gói.' });
    }

    await ensureTeamRolesExist(client, ownerId);

    // Đảm bảo không xóa nếu đó là vai trò duy nhất còn lại của manager này
    const countRes = await client.query('SELECT COUNT(*) FROM team_roles WHERE owner_id = $1', [ownerId]);
    if (parseInt(countRes.rows[0].count, 10) <= 1) {
      client.release();
      return res.status(400).json({ error: 'Không thể xóa vai trò duy nhất còn lại của đội nhóm.' });
    }

    await client.query('BEGIN');

    // Xóa vai trò
    await client.query('DELETE FROM team_roles WHERE owner_id = $1 AND role_key = $2', [ownerId, roleKey]);

    // Lấy một vai trò còn lại làm fallback của manager này
    const fallbackRes = await client.query('SELECT role_key FROM team_roles WHERE owner_id = $1 LIMIT 1', [ownerId]);
    const fallbackKey = fallbackRes.rows[0].role_key;

    // Cập nhật các thành viên có vai trò bị xóa về vai trò fallback (chỉ trong đội nhóm của manager này)
    await client.query(
      'UPDATE team_members SET team_role = $1 WHERE owner_id = $2 AND team_role = $3',
      [fallbackKey, ownerId, roleKey]
    );

    await client.query('COMMIT');
    client.release();
    res.json({ status: 'success', message: 'Xóa vai trò đội nhóm thành công và đã cập nhật thành viên!' });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (e) {}
      client.release();
    }
    res.status(500).json({ error: err.message });
  }
});

// API Tải dữ liệu ban đầu
app.get('/api/board', authenticateToken, async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Database chưa kết nối thành công.' });
  
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'Quản trị viên không có quyền quản lý bảng công việc.' });
  }

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

    // Xác định Manager ID của đội nhóm (nếu đang là thành viên của ai đó thì lấy ID người đó, ngược lại là chính mình)
    let managerId = null;
    const joinedRes = await client.query("SELECT owner_id FROM team_members WHERE member_id = $1 AND status = 'active' LIMIT 1", [userId]);
    if (joinedRes.rowCount > 0) {
      managerId = joinedRes.rows[0].owner_id;
    }
    const boardOwnerId = managerId || userId;

    // 1. Tải Categories (của Manager nếu là thành viên)
    const catRes = await client.query('SELECT id, name, parent_id AS "parentId" FROM categories WHERE user_id = $1', [boardOwnerId]);
    data.categories = catRes.rows;

    // 2. Tải Settings (của Manager nếu là thành viên)
    const setRes = await client.query('SELECT key, value FROM settings WHERE user_id = $1', [boardOwnerId]);
    setRes.rows.forEach(s => {
      try {
        data.settings[s.key] = JSON.parse(s.value);
      } catch {
        data.settings[s.key] = s.value;
      }
    });

    // 3. Tải Cards
    // Manager: tải tất cả thẻ của mình và thành viên để phục vụ trang Dashboard của manager
    // Thành viên: chỉ tải thẻ do mình tạo hoặc được gán
    let cardRes;
    if (!managerId) {
      cardRes = await client.query(`
        SELECT id, title, description, tags, start_date AS "startDate", due_date AS "dueDate", 
               estimated_duration AS "estimatedDuration", category_id AS "categoryId", 
               checklist, activities, image, services, is_archived AS "isArchived", 
               completed_at AS "completedAt", linked_partner_id AS "linkedPartnerId", 
               assignee_id AS "assigneeId", user_id AS "userId", column_id AS "columnId",
               created_by AS "createdBy"
        FROM cards 
        WHERE user_id = $1 
           OR assignee_id = $1 
           OR user_id IN (SELECT member_id FROM team_members WHERE owner_id = $1 AND status = 'active')
      `, [userId]);
    } else {
      cardRes = await client.query(`
        SELECT id, title, description, tags, start_date AS "startDate", due_date AS "dueDate", 
               estimated_duration AS "estimatedDuration", category_id AS "categoryId", 
               checklist, activities, image, services, is_archived AS "isArchived", 
               completed_at AS "completedAt", linked_partner_id AS "linkedPartnerId", 
               assignee_id AS "assigneeId", user_id AS "userId", column_id AS "columnId",
               created_by AS "createdBy"
        FROM cards 
        WHERE user_id = $1 
           OR assignee_id = $1
      `, [userId]);
    }
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
      userId: c.userId || null,
      columnId: c.columnId || null,
      createdBy: c.createdBy || null
    }));

    // 4. Tải Columns (của Manager nếu là thành viên) và tái thiết lập cardIds cho từng cột
    const colRes = await client.query('SELECT id, title, color, card_ids AS "cardIds", is_partner AS "isPartner" FROM columns WHERE user_id = $1', [boardOwnerId]);
    
    // Gom nhóm thẻ đã tải theo columnId
    const cardsByColumn = {};
    data.cards.forEach(c => {
      const colId = c.columnId || 'col-1';
      if (!cardsByColumn[colId]) cardsByColumn[colId] = [];
      cardsByColumn[colId].push(c.id);
    });

    colRes.rows.forEach(col => {
      const masterCardIds = JSON.parse(col.cardIds || '[]');
      const columnCardIds = cardsByColumn[col.id] || [];
      
      // Lọc các thẻ thuộc cột này mà user được quyền xem
      const filteredIds = masterCardIds.filter(id => columnCardIds.includes(id));
      // Tự động đẩy các thẻ mới ở cột này vào cuối
      const extraIds = columnCardIds.filter(id => !filteredIds.includes(id));
      const finalCardIds = [...filteredIds, ...extraIds];

      const parsedCol = {
        id: col.id,
        title: col.title,
        color: col.color,
        cardIds: finalCardIds
      };
      if (col.isPartner === 1) {
        data.partnerColumns.push(parsedCol);
      } else {
        data.columns.push(parsedCol);
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

    const teamCheckRes = await client.query('SELECT COUNT(*) FROM team_members WHERE owner_id = $1 OR member_id = $1', [userId]);
    data.isTeammate = parseInt(teamCheckRes.rows[0].count, 10) > 0;

    // 6. Tải cấu hình tính năng các gói
    const featRes = await client.query("SELECT value FROM settings WHERE key = 'plan_features' AND user_id = 'system'");
    if (featRes.rowCount > 0) {
      data.planFeatures = JSON.parse(featRes.rows[0].value);
    } else {
      data.planFeatures = {
        free: { googleSheetsSync: false, activityLogs: false, checklists: true, cardLimit: 10, columnCustomization: true },
        pro: { googleSheetsSync: false, activityLogs: true, checklists: true, cardLimit: 100, columnCustomization: true },
        business: { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 1000, columnCustomization: true },
        vip: { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 9999, columnCustomization: true }
      };
    }

    data.userId = userId;

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
  
  if (req.user.role === 'admin') {
    return res.status(403).json({ error: 'Quản trị viên không có quyền quản lý bảng công việc.' });
  }

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

    // Xác định Manager ID của đội nhóm (nếu có)
    let managerId = null;
    const joinedRes = await client.query("SELECT owner_id FROM team_members WHERE member_id = $1 AND status = 'active' LIMIT 1", [userId]);
    if (joinedRes.rowCount > 0) {
      managerId = joinedRes.rows[0].owner_id;
    }
    const boardOwnerId = managerId || userId;

    // Chỉ cập nhật categories, columns, settings nếu là Manager hoặc tài khoản cá nhân độc lập
    if (!managerId) {
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

      // 4. Cập nhật Settings
      await client.query('DELETE FROM settings WHERE user_id = $1', [userId]);
      if (settings && typeof settings === 'object') {
        for (const [key, val] of Object.entries(settings)) {
          await client.query('INSERT INTO settings (key, value, user_id) VALUES ($1, $2, $3)', [
            key, JSON.stringify(val), userId
          ]);
        }
      }
    }

    // 3. Đồng bộ hóa Cards & Xử lý luồng chuyển giao (Delegation)
    // Bản đồ mapping thẻ -> cột
    const cardToColumnMap = {};
    if (Array.isArray(columns)) {
      for (const col of columns) {
        if (Array.isArray(col.cardIds)) {
          for (const cid of col.cardIds) {
            cardToColumnMap[cid] = col.id;
          }
        }
      }
    }
    if (Array.isArray(partnerColumns)) {
      for (const col of partnerColumns) {
        if (Array.isArray(col.cardIds)) {
          for (const cid of col.cardIds) {
            cardToColumnMap[cid] = col.id;
          }
        }
      }
    }

    // Lấy cột đầu tiên làm cột mặc định nhận việc (uncategorized)
    const firstColRes = await client.query('SELECT id FROM columns WHERE user_id = $1 AND is_partner = 0 LIMIT 1', [boardOwnerId]);
    const defaultColId = firstColRes.rowCount > 0 ? firstColRes.rows[0].id : 'col-1';

    // Xóa thẻ bị loại bỏ
    const incomingIds = Array.isArray(cards) ? cards.map(c => c.id) : [];
    if (!managerId) {
      // Manager/Cá nhân: xóa thẻ thuộc chính họ hoặc thuộc thành viên hoạt động mà không có trong incomingIds
      if (incomingIds.length > 0) {
        await client.query(`
          DELETE FROM cards 
          WHERE (user_id = $1 OR user_id IN (SELECT member_id FROM team_members WHERE owner_id = $1 AND status = 'active'))
            AND id NOT IN (SELECT unnest($2::varchar[]))
        `, [userId, incomingIds]);
      } else {
        await client.query(`
          DELETE FROM cards 
          WHERE user_id = $1 OR user_id IN (SELECT member_id FROM team_members WHERE owner_id = $1 AND status = 'active')
        `, [userId]);
      }
    } else {
      // Thành viên nhóm: chỉ xóa thẻ thuộc chính họ
      if (incomingIds.length > 0) {
        await client.query(`
          DELETE FROM cards 
          WHERE user_id = $1 AND id NOT IN (SELECT unnest($2::varchar[]))
        `, [userId, incomingIds]);
      } else {
        await client.query(`
          DELETE FROM cards 
          WHERE user_id = $1
        `, [userId]);
      }
    }

    // Lưu / Cập nhật thẻ
    if (Array.isArray(cards) && cards.length > 0) {
      for (const c of cards) {
        let targetColId = cardToColumnMap[c.id];
        if (!targetColId && c.completedAt) {
          targetColId = 'col-4';
        }
        if (!targetColId) {
          targetColId = c.columnId || defaultColId;
        }

        if (!c.userId || c.userId === userId) {
          // Thẻ thuộc sở hữu của chính user hiện tại
          await client.query(`
            INSERT INTO cards 
              (id, title, description, tags, start_date, due_date, estimated_duration, category_id, checklist, activities, image, services, user_id, is_archived, completed_at, linked_partner_id, assignee_id, column_id, created_by) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            ON CONFLICT (id, user_id) 
            DO UPDATE SET
              title = EXCLUDED.title,
              description = EXCLUDED.description,
              tags = EXCLUDED.tags,
              start_date = EXCLUDED.start_date,
              due_date = EXCLUDED.due_date,
              estimated_duration = EXCLUDED.estimated_duration,
              category_id = EXCLUDED.category_id,
              checklist = EXCLUDED.checklist,
              activities = EXCLUDED.activities,
              image = EXCLUDED.image,
              services = EXCLUDED.services,
              is_archived = EXCLUDED.is_archived,
              completed_at = EXCLUDED.completed_at,
              linked_partner_id = EXCLUDED.linked_partner_id,
              assignee_id = EXCLUDED.assignee_id,
              column_id = EXCLUDED.column_id,
              created_by = COALESCE(cards.created_by, EXCLUDED.created_by)
          `, [
            c.id, c.title, c.description || '', JSON.stringify(c.tags || []), c.startDate || '', c.dueDate || '',
            c.estimatedDuration || 0, c.categoryId || null, JSON.stringify(c.checklist || []), JSON.stringify(c.activities || []),
            c.image || null, JSON.stringify(c.services || []), userId, c.isArchived || false, c.completedAt || null,
            c.linkedPartnerId || null, c.assigneeId || null, targetColId, c.createdBy || userId
          ]);
        } else {
          // Chuyển giao công việc (gán việc cho người khác)
          // Đổi user_id = c.userId (ID của người nhận việc), category_id = null, column_id = defaultColId
          await client.query(`
            UPDATE cards SET 
              title = $1, description = $2, tags = $3, start_date = $4, due_date = $5, 
              estimated_duration = $6, category_id = null, checklist = $7, activities = $8, 
              image = $9, services = $10, is_archived = $11, completed_at = $12, 
              linked_partner_id = $13, assignee_id = $14, column_id = $15, user_id = $16,
              created_by = COALESCE(created_by, $19)
            WHERE id = $17 AND (user_id = $18 OR assignee_id = $18)
          `, [
            c.title, c.description || '', JSON.stringify(c.tags || []), c.startDate || '', c.dueDate || '',
            c.estimatedDuration || 0, JSON.stringify(c.checklist || []), JSON.stringify(c.activities || []),
            c.image || null, JSON.stringify(c.services || []), c.isArchived || false, c.completedAt || null,
            c.linkedPartnerId || null, c.assigneeId || null, defaultColId, c.userId, c.id, userId, c.createdBy || userId
          ]);
        }
      }
    }

    await client.query('COMMIT');
    client.release();
    res.json({ status: 'success', message: 'Đồng bộ cơ sở dữ liệu PostgreSQL thành công!' });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (e) {}
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

    // Kiểm tra xem plan của user hiện tại có phải là free không
    const userPlanRes = await client.query('SELECT plan, username FROM users WHERE id = $1', [userId]);
    const userPlan = userPlanRes.rowCount > 0 ? userPlanRes.rows[0].plan : 'free';
    const userUsername = userPlanRes.rowCount > 0 ? userPlanRes.rows[0].username : '';

    if (userPlan === 'free') {
      client.release();
      return res.json([{ id: userId, username: userUsername, role: 'editor', roleName: 'Cá nhân' }]);
    }

    // 1. Xác định Manager ID của đội nhóm (nếu đang là thành viên của ai đó thì lấy ID người đó, ngược lại là chính mình)
    let managerId = userId;
    const joinedRes = await client.query('SELECT owner_id FROM team_members WHERE member_id = $1 AND status = \'active\' LIMIT 1', [userId]);
    if (joinedRes.rowCount > 0) {
      managerId = joinedRes.rows[0].owner_id;
    }
    
    // 2. Xác định vai trò tổ đội (RolesTeam) của user hiện tại
    let userTeamRole = 'StaffVH';
    if (userId === managerId) {
      userTeamRole = 'MNG';
    } else {
      const roleRes = await client.query('SELECT team_role FROM team_members WHERE owner_id = $1 AND member_id = $2 AND status = \'active\'', [managerId, userId]);
      if (roleRes.rowCount > 0) {
        userTeamRole = roleRes.rows[0].team_role || 'StaffVH';
      }
    }

    // 3. Lấy thông tin Trưởng nhóm (managerId)
    const managerRes = await client.query('SELECT id, username FROM users WHERE id = $1', [managerId]);
    // Lấy thông tin các thành viên trong nhóm
    // Đảm bảo vai trò mặc định tồn tại cho managerId này
    await ensureTeamRolesExist(client, managerId);
    const membersRes = await client.query(`
      SELECT u.id, u.username, tm.team_role, tr.role_name FROM users u
      JOIN team_members tm ON tm.member_id = u.id
      LEFT JOIN team_roles tr ON tr.owner_id = tm.owner_id AND tm.team_role = tr.role_key
      WHERE tm.owner_id = $1 AND tm.status = 'active'
    `, [managerId]);

    const finalMembers = [];
    if (managerRes.rowCount > 0) {
      finalMembers.push({
        id: managerRes.rows[0].id,
        username: managerRes.rows[0].username,
        role: 'MNG',
        roleName: 'Trưởng nhóm'
      });
    }

    for (const row of membersRes.rows) {
      finalMembers.push({
        id: row.id,
        username: row.username,
        role: row.team_role || 'StaffVH',
        roleName: row.role_name || row.team_role || 'Thành viên'
      });
    }

    // 4. Lọc thành viên có thể giao việc dựa trên vai trò đội nhóm của user đang đăng nhập
    let filteredMembers = finalMembers;
    if (userTeamRole !== 'MNG') {
      // Thành viên không thể phân công công việc cho Trưởng nhóm (MNG)
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
    
    // Tên nhóm của tôi
    const ownTeamRes = await client.query('SELECT team_name FROM teams WHERE owner_id = $1', [userId]);
    const myTeamName = ownTeamRes.rowCount > 0 ? ownTeamRes.rows[0].team_name : '';

    // Lấy plan của user
    const userPlanRes = await client.query('SELECT plan FROM users WHERE id = $1', [userId]);
    const userPlan = userPlanRes.rowCount > 0 ? userPlanRes.rows[0].plan : 'free';

    // Thành viên do tôi mời (lấy vai trò đội nhóm tm.team_role) - nếu là free thì rỗng
    let myMembers = [];
    if (userPlan !== 'free') {
      const membersRes = await client.query(`
        SELECT u.id, u.username, tm.team_role AS "role", tm.status AS "status" FROM users u
        JOIN team_members tm ON tm.member_id = u.id
        WHERE tm.owner_id = $1
      `, [userId]);
      myMembers = membersRes.rows;
    }
    
    // Nhóm tôi đã tham gia (những người đã mời tôi)
    const joinedRes = await client.query(`
      SELECT u.id AS "ownerId", u.username AS "ownerUsername", t.team_name AS "teamName"
      FROM users u
      JOIN team_members tm ON tm.owner_id = u.id
      LEFT JOIN teams t ON t.owner_id = u.id
      WHERE tm.member_id = $1 AND tm.status = 'active'
    `, [userId]);

    // Lời mời tham gia nhóm đang chờ xác nhận
    const pendingRes = await client.query(`
      SELECT u.id AS "ownerId", u.username AS "ownerUsername", t.team_name AS "teamName"
      FROM users u
      JOIN team_members tm ON tm.owner_id = u.id
      LEFT JOIN teams t ON t.owner_id = u.id
      WHERE tm.member_id = $1 AND tm.status = 'pending'
    `, [userId]);
    
    client.release();
    res.json({
      myTeamName,
      myMembers,
      joinedTeams: joinedRes.rows.map(row => ({
        ownerId: row.ownerId,
        ownerUsername: row.ownerUsername,
        teamName: row.teamName || ''
      })),
      pendingInvites: pendingRes.rows.map(row => ({
        ownerId: row.ownerId,
        ownerUsername: row.ownerUsername,
        teamName: row.teamName || ''
      })),
      userPlan
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

    // Kiểm tra xem plan của user hiện tại có phải là free không
    const userPlanRes = await client.query('SELECT plan FROM users WHERE id = $1', [userId]);
    if (userPlanRes.rowCount > 0 && userPlanRes.rows[0].plan === 'free') {
      client.release();
      return res.status(403).json({ error: 'Tài khoản miễn phí (Free) không thể sử dụng chức năng đội nhóm. Vui lòng nâng cấp gói.' });
    }
    const inviterPlan = userPlanRes.rows[0].plan;
    
    // Tìm ID người dùng được mời
    const targetUserRes = await client.query('SELECT id, plan FROM users WHERE username = $1', [username.trim()]);
    if (targetUserRes.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Không tìm thấy người dùng trên hệ thống.' });
    }
    
    const targetUserId = targetUserRes.rows[0].id;
    const targetUserPlan = targetUserRes.rows[0].plan;

    if (targetUserId === userId) {
      client.release();
      return res.status(400).json({ error: 'Bạn không thể tự mời chính mình vào nhóm.' });
    }

    // Kiểm tra xem đã tồn tại lời mời hoặc quan hệ thành viên chưa
    const checkExisting = await client.query('SELECT status FROM team_members WHERE owner_id = $1 AND member_id = $2', [userId, targetUserId]);
    if (checkExisting.rowCount > 0) {
      const currentStatus = checkExisting.rows[0].status;
      client.release();
      if (currentStatus === 'active') {
        return res.status(400).json({ error: 'Người dùng này đã là thành viên trong nhóm.' });
      } else {
        return res.status(400).json({ error: 'Người dùng này đã được mời và đang chờ xác nhận.' });
      }
    }
    
    // Đảm bảo vai trò mặc định tồn tại cho userId (người mời)
    await ensureTeamRolesExist(client, userId);
    const trRes = await client.query('SELECT role_key FROM team_roles WHERE owner_id = $1 LIMIT 1', [userId]);
    const defaultRole = trRes.rowCount > 0 ? trRes.rows[0].role_key : 'StaffVH';

    // Nếu người được mời có plan là free thì trạng thái là pending
    const status = targetUserPlan === 'free' ? 'pending' : 'active';

    // Lưu vào bảng team_members với status tương ứng
    await client.query(`
      INSERT INTO team_members (owner_id, member_id, team_role, status)
      VALUES ($1, $2, $3, $4)
    `, [userId, targetUserId, defaultRole, status]);
    
    client.release();
    res.json({ success: true, message: status === 'pending' ? 'Đã gửi lời mời và đang chờ thành viên xác nhận!' : 'Đã mời thành viên vào nhóm thành công!' });
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: err.message });
  }
});

// API Lấy danh sách lời mời đang chờ xác nhận
app.get('/api/team/invites', authenticateToken, async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Database chưa kết nối.' });
  const userId = req.user.id;
  
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(`
      SELECT u.id AS "ownerId", u.username AS "ownerUsername", t.team_name AS "teamName"
      FROM users u
      JOIN team_members tm ON tm.owner_id = u.id
      LEFT JOIN teams t ON t.owner_id = u.id
      WHERE tm.member_id = $1 AND tm.status = 'pending'
    `, [userId]);
    client.release();
    res.json(result.rows);
  } catch (err) {
    if (client) client.release();
    res.status(500).json({ error: err.message });
  }
});

// API Chấp nhận lời mời tham gia nhóm
app.post('/api/team/invites/accept', authenticateToken, async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Database chưa kết nối.' });
  const userId = req.user.id;
  const { ownerId } = req.body;

  if (!ownerId) {
    return res.status(400).json({ error: 'Thiếu thông tin trưởng nhóm.' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Kiểm tra xem lời mời có thực sự tồn tại ở trạng thái pending không
    const inviteCheck = await client.query(
      "SELECT 1 FROM team_members WHERE owner_id = $1 AND member_id = $2 AND status = 'pending'",
      [ownerId, userId]
    );

    if (inviteCheck.rowCount === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: 'Không tìm thấy lời mời đang chờ xác nhận từ trưởng nhóm này.' });
    }

    // Cập nhật trạng thái thành active
    await client.query(
      "UPDATE team_members SET status = 'active' WHERE owner_id = $1 AND member_id = $2",
      [ownerId, userId]
    );

    // Kiểm tra plan hiện tại của user, nếu là free thì nâng cấp lên business
    const userRes = await client.query('SELECT plan FROM users WHERE id = $1', [userId]);
    const currentPlan = userRes.rowCount > 0 ? userRes.rows[0].plan : 'free';

    if (currentPlan === 'free') {
      await client.query("UPDATE users SET plan = 'business' WHERE id = $1", [userId]);
    }

    await client.query('COMMIT');
    client.release();
    res.json({ success: true, message: 'Đã chấp nhận lời mời và gia nhập đội nhóm!' });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (e) {}
      client.release();
    }
    res.status(500).json({ error: err.message });
  }
});

// API Từ chối lời mời tham gia nhóm
app.post('/api/team/invites/decline', authenticateToken, async (req, res) => {
  if (!pool) return res.status(500).json({ error: 'Database chưa kết nối.' });
  const userId = req.user.id;
  const { ownerId } = req.body;

  if (!ownerId) {
    return res.status(400).json({ error: 'Thiếu thông tin trưởng nhóm.' });
  }

  let client;
  try {
    client = await pool.connect();

    // Xóa lời mời
    const deleteRes = await client.query(
      "DELETE FROM team_members WHERE owner_id = $1 AND member_id = $2 AND status = 'pending'",
      [ownerId, userId]
    );

    if (deleteRes.rowCount === 0) {
      client.release();
      return res.status(404).json({ error: 'Không tìm thấy lời mời đang chờ xác nhận.' });
    }

    client.release();
    res.json({ success: true, message: 'Đã từ chối lời mời tham gia nhóm.' });
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
  
  let client;
  try {
    client = await pool.connect();

    // Kiểm tra xem plan của user hiện tại có phải là free không
    const userPlanRes = await client.query('SELECT plan FROM users WHERE id = $1', [userId]);
    if (userPlanRes.rowCount > 0 && userPlanRes.rows[0].plan === 'free') {
      client.release();
      return res.status(403).json({ error: 'Tài khoản miễn phí (Free) không thể sử dụng chức năng đội nhóm. Vui lòng nâng cấp gói.' });
    }

    // Kiểm tra vai trò động có hợp lệ không
    await ensureTeamRolesExist(client, userId);
    const roleCheck = await client.query('SELECT 1 FROM team_roles WHERE owner_id = $1 AND role_key = $2', [userId, role]);
    if (roleCheck.rowCount === 0) {
      client.release();
      return res.status(400).json({ error: 'Vai trò đội nhóm không hợp lệ.' });
    }
    
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
    await cleanUpTeammateRemoval(client, memberId);
    
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
