import React, { useState } from 'react';
import { Lock, User, LogIn, UserPlus, Eye, EyeOff, KanbanSquare, Info } from 'lucide-react';

export default function LoginRegister({ API_BASE_URL, onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      setError('Vui lòng điền đầy đủ tên đăng nhập và mật khẩu.');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    if (!isLogin && cleanUsername.length < 3) {
      setError('Tên đăng nhập phải có ít nhất 3 ký tự.');
      return;
    }

    setLoading(true);
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: cleanUsername,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
      }

      if (data.token && data.username) {
        onAuthSuccess(data.token, data.username);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      {/* Decorative animated background blobs */}
      <div className="bg-glow-blob blob-1"></div>
      <div className="bg-glow-blob blob-2"></div>

      <div className="login-card-wrapper">
        <div className="login-header-brand">
          <div className="brand-logo">
            <KanbanSquare size={28} />
          </div>
          <h2>ZenBoard</h2>
          <p>Hệ thống Quản lý Công việc & Đối tác Thông minh</p>
        </div>

        {/* Tab Selector */}
        <div className="auth-tab-bar">
          <button 
            type="button" 
            className={`auth-tab-btn ${isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(true);
              setError('');
            }}
          >
            <LogIn size={15} />
            <span>Đăng nhập</span>
          </button>
          <button 
            type="button" 
            className={`auth-tab-btn ${!isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(false);
              setError('');
            }}
          >
            <UserPlus size={15} />
            <span>Đăng ký</span>
          </button>
        </div>

        {/* Error Alert Box */}
        {error && (
          <div className="auth-error-alert">
            <span>{error}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="auth-form-body">
          <div className="form-input-group">
            <label htmlFor="username">Tên đăng nhập</label>
            <div className="input-wrapper">
              <User size={16} className="input-icon" />
              <input
                id="username"
                type="text"
                placeholder="Nhập tên đăng nhập..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                required
                autoComplete="username"
              />
            </div>
          </div>

          <div className="form-input-group">
            <label htmlFor="password">Mật khẩu</label>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                autoComplete={isLogin ? "current-password" : "new-password"}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="form-input-group">
              <label htmlFor="confirmPassword">Xác nhận mật khẩu</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Nhập lại mật khẩu..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}

          {!isLogin && (
            <div className="register-migration-info">
              <Info size={14} className="info-icon" />
              <p>
                <strong>Bảo toàn dữ liệu:</strong> Nếu bạn là tài khoản đầu tiên đăng ký trên VPS này, hệ thống sẽ tự động gán và lưu trữ toàn bộ dữ liệu mẫu hiện tại của bạn vào tài khoản mới. Dữ liệu của bạn được cam kết an toàn 100%.
              </p>
            </div>
          )}

          <button type="submit" className="btn btn-primary auth-submit-btn" disabled={loading}>
            {loading ? (
              <span className="spinner"></span>
            ) : (
              <>
                {isLogin ? <LogIn size={16} /> : <UserPlus size={16} />}
                <span>{isLogin ? 'Đăng nhập vào hệ thống' : 'Tạo tài khoản mới'}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
