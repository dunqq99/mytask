import { spawn } from 'child_process';

console.log('🚀 Đang khởi động hệ thống ZenBoard (Frontend + Backend Database)...');

// Khởi chạy Express Backend Server
const backend = spawn('node', ['server.js'], { stdio: 'inherit', shell: true });

// Khởi chạy Vite Frontend Development Server
const frontend = spawn('npx', ['vite'], { stdio: 'inherit', shell: true });

const cleanup = () => {
  console.log('\n🛑 Đang dọn dẹp và dừng các tiến trình máy chủ...');
  backend.kill('SIGINT');
  frontend.kill('SIGINT');
  process.exit();
};

// Lắng nghe sự kiện kết thúc tiến trình
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
