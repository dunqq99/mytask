import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  CreditCard, 
  Database, 
  Calendar, 
  RefreshCw, 
  AlertCircle, 
  Check, 
  Edit2, 
  Clock, 
  TrendingUp,
  Search,
  CheckCircle2,
  Sliders,
  ToggleLeft,
  CheckSquare,
  Lock
} from 'lucide-react';

const PLAN_PRESETS = [
  { key: 'free', label: 'Free (Miễn phí)', color: '#71717a', bg: 'rgba(113, 113, 122, 0.15)' },
  { key: 'pro', label: 'Pro (Chuyên nghiệp)', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
  { key: 'enterprise', label: 'Enterprise (Doanh nghiệp)', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  { key: 'vip', label: 'VIP (Đặc quyền)', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
];

export default function UsersManager({ 
  token, 
  API_BASE_URL, 
  currentUsername, 
  planFeatures, 
  setPlanFeatures,
  adminSubTab,
  setAdminSubTab
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState(null);
  
  // Search query to filter users
  const [filterQuery, setFilterQuery] = useState('');

  // Local state for plan features config
  const [localFeatures, setLocalFeatures] = useState({
    free: { googleSheetsSync: false, activityLogs: false, checklists: true, cardLimit: 10, columnCustomization: true },
    pro: { googleSheetsSync: false, activityLogs: true, checklists: true, cardLimit: 100, columnCustomization: true },
    enterprise: { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 500, columnCustomization: true },
    vip: { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 9999, columnCustomization: true }
  });

  useEffect(() => {
    if (planFeatures) {
      setLocalFeatures(planFeatures);
    }
  }, [planFeatures]);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Không thể tải danh sách thành viên.');
      }
      
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  // Update user role or plan
  const handleUpdateUser = async (userId, payload, targetUsername) => {
    setUpdatingUserId(userId);
    setError('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, ...payload })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Cập nhật tài khoản thất bại.');
      }

      setSuccessMsg(`Đã cập nhật cấu hình cho tài khoản "${targetUsername}".`);
      
      // Update local state
      setUsers(users.map(u => u.id === userId ? { ...u, ...payload } : u));
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingUserId(null);
    }
  };

  // Save Plan features system-wide settings
  const handleSavePlanFeatures = async () => {
    setError('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/plans/features`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ features: localFeatures })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Cập nhật cấu hình gói dịch vụ thất bại.');
      }

      setSuccessMsg('Đã lưu thành công cấu hình tính năng của các gói dịch vụ!');
      setPlanFeatures(localFeatures);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFeatureToggle = (planKey, featureKey) => {
    setLocalFeatures(prev => {
      const currentPlanFeatures = prev[planKey] || {
        googleSheetsSync: false,
        activityLogs: false,
        checklists: true,
        cardLimit: 10,
        columnCustomization: true
      };
      return {
        ...prev,
        [planKey]: {
          ...currentPlanFeatures,
          [featureKey]: !currentPlanFeatures[featureKey]
        }
      };
    });
  };

  const handleCardLimitChange = (planKey, val) => {
    const limit = parseInt(val, 10) || 0;
    setLocalFeatures(prev => {
      const currentPlanFeatures = prev[planKey] || {
        googleSheetsSync: false,
        activityLogs: false,
        checklists: true,
        cardLimit: 10,
        columnCustomization: true
      };
      return {
        ...prev,
        [planKey]: {
          ...currentPlanFeatures,
          cardLimit: limit
        }
      };
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const getPlanLabel = (planKey) => {
    const plan = PLAN_PRESETS.find(p => p.key === planKey) || PLAN_PRESETS[0];
    return plan.label.split(' ')[0];
  };

  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div className="dashboard-container" style={{ padding: '24px', animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            <Shield size={24} style={{ color: 'var(--primary)' }} />
            Quản trị dự án & hệ thống
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
            Hệ thống cấu hình gói dịch vụ và quản trị thành viên tối cao của ZenBoard.
          </p>
        </div>
        <button 
          className="btn btn-secondary" 
          onClick={fetchUsers} 
          disabled={loading}
          style={{ padding: '8px 14px', borderRadius: '8px', fontSize: '13px' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Tải lại</span>
        </button>
      </div>

      {/* Alert boxes */}
      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          borderRadius: '8px',
          background: 'var(--danger-light)',
          color: 'var(--danger)',
          fontSize: '13px',
          marginBottom: '16px',
          border: '1px solid rgba(239, 68, 68, 0.2)'
        }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 16px',
          borderRadius: '8px',
          background: 'rgba(16, 185, 129, 0.1)',
          color: '#10b981',
          fontSize: '13px',
          marginBottom: '16px',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Search Bar (Only shown for tables) */}
      {adminSubTab !== 'plans' && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          marginBottom: '16px',
          background: 'rgba(0,0,0,0.2)',
          padding: '6px 12px',
          borderRadius: '8px',
          border: '1px solid var(--border-glass)',
          maxWidth: '320px'
        }}>
          <Search size={14} style={{ color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Tìm kiếm tài khoản..." 
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: '12.5px',
              width: '100%'
            }}
          />
        </div>
      )}

      {/* Main Content Area based on SubTab */}
      <div className="dashboard-card" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-glass)' }}>
        {loading && users.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '12px', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin" />
            <span style={{ fontSize: '13px' }}>Đang tải thông tin thành viên...</span>
          </div>
        ) : (
          <div>
            
            {/* SUBTAB 1: THÀNH VIÊN */}
            {adminSubTab === 'members' && (
              <div className="dashboard-table-wrapper" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th style={{ width: '45%' }}>Tài khoản</th>
                      <th style={{ width: '35%' }}>Ngày đăng ký</th>
                      <th style={{ width: '20%' }}>Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const isSelf = user.username === currentUsername;
                      return (
                        <tr key={user.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: isSelf ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)' : 'rgba(255,255,255,0.05)',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                fontSize: '12px'
                              }}>
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{user.username}</span>
                              {isSelf && (
                                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary)', fontWeight: 'bold' }}>
                                  Bạn
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                              <Calendar size={13} style={{ opacity: 0.7 }} />
                              <span>{formatDate(user.createdAt)}</span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
                              Hoạt động
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* SUBTAB 2: ROLE (CUSTOMIZED USER ROLES & PLAN PACKAGES TOGETHER) */}
            {adminSubTab === 'roles' && (
              <div className="dashboard-table-wrapper" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th style={{ width: '25%' }}>Tài khoản</th>
                      <th style={{ width: '25%' }}>Vai trò Hệ thống</th>
                      <th style={{ width: '25%' }}>Gói Tài khoản (Plan)</th>
                      <th style={{ width: '25%' }}>Hạn sử dụng Gói</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const isSelf = user.username === currentUsername;
                      const isSelfMassie = user.username === 'massie123';
                      
                      return (
                        <tr key={user.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.05)',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                fontSize: '12px'
                              }}>
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{user.username}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Shield size={13} style={{ 
                                color: user.role === 'admin' ? '#ef4444' : 'var(--primary)',
                                opacity: 0.8
                              }} />
                              <select
                                value={user.role}
                                onChange={(e) => handleUpdateUser(user.id, { role: e.target.value }, user.username)}
                                disabled={isSelf || isSelfMassie || updatingUserId === user.id}
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '12px',
                                  borderRadius: '6px',
                                  background: 'rgba(255,255,255,0.05)',
                                  border: '1px solid var(--border-glass)',
                                  color: 'var(--text-primary)',
                                  cursor: (isSelf || isSelfMassie) ? 'not-allowed' : 'pointer',
                                  outline: 'none',
                                  minWidth: '120px'
                                }}
                              >
                                <option value="editor" style={{ background: '#18181b', color: '#fff' }}>Editor (Phổ thông)</option>
                                <option value="admin" style={{ background: '#18181b', color: '#fff' }}>Admin (Quản trị)</option>
                              </select>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <CreditCard size={13} style={{ color: '#f59e0b', opacity: 0.8 }} />
                              <select
                                value={user.plan || 'free'}
                                onChange={(e) => handleUpdateUser(user.id, { plan: e.target.value }, user.username)}
                                disabled={isSelfMassie || updatingUserId === user.id}
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '12px',
                                  borderRadius: '6px',
                                  background: 'rgba(255,255,255,0.05)',
                                  border: '1px solid var(--border-glass)',
                                  color: 'var(--text-primary)',
                                  cursor: isSelfMassie ? 'not-allowed' : 'pointer',
                                  outline: 'none',
                                  minWidth: '140px'
                                }}
                              >
                                {PLAN_PRESETS.map(p => (
                                  <option key={p.key} value={p.key} style={{ background: '#18181b', color: '#fff' }}>{p.label}</option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="date"
                                value={user.planExpiresAt ? user.planExpiresAt.split('T')[0] : ''}
                                onChange={(e) => handleUpdateUser(user.id, { planExpiresAt: e.target.value || null }, user.username)}
                                disabled={isSelfMassie || updatingUserId === user.id}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  borderRadius: '6px',
                                  background: 'rgba(255,255,255,0.05)',
                                  border: '1px solid var(--border-glass)',
                                  color: 'var(--text-primary)',
                                  outline: 'none',
                                  cursor: isSelfMassie ? 'not-allowed' : 'pointer'
                                }}
                              />
                              {user.planExpiresAt && (
                                <button
                                  onClick={() => handleUpdateUser(user.id, { planExpiresAt: null }, user.username)}
                                  disabled={isSelfMassie || updatingUserId === user.id}
                                  title="Xóa hạn sử dụng (Vô thời hạn)"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--danger)',
                                    cursor: 'pointer',
                                    padding: '2px',
                                    fontSize: '11px',
                                    fontWeight: 'bold'
                                  }}
                                >
                                  ✕
                                </button>
                              )}
                              {updatingUserId === user.id && (
                                <RefreshCw size={12} className="spin" style={{ color: 'var(--text-muted)' }} />
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* SUBTAB 3: GÓI ĐĂNG KÝ (PLAN FEATURES CONFIGURATION GATE) */}
            {adminSubTab === 'plans' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: 0, fontWeight: '600' }}>Cấu hình tính năng của từng gói</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Bật/tắt các tính năng hoặc giới hạn số lượng công việc của từng phân hạng gói dịch vụ.</p>
                  </div>
                  <button 
                    className="btn btn-primary"
                    onClick={handleSavePlanFeatures}
                    style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}
                  >
                    Lưu cấu hình hệ thống
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                  {PLAN_PRESETS.map(planInfo => {
                    const feat = localFeatures[planInfo.key] || {
                      googleSheetsSync: false,
                      activityLogs: false,
                      checklists: true,
                      cardLimit: 10,
                      columnCustomization: true
                    };
                    
                    return (
                      <div 
                        key={planInfo.key} 
                        className="chart-card glass" 
                        style={{ 
                          padding: '16px', 
                          border: `1px solid ${planInfo.key === 'vip' ? 'rgba(245,158,11,0.3)' : 'var(--border-glass)'}`,
                          background: planInfo.key === 'vip' ? 'rgba(245, 158, 11, 0.02)' : 'rgba(255,255,255,0.01)'
                        }}
                      >
                        {/* Title of plan preset */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                          <span style={{ 
                            padding: '3px 8px', 
                            borderRadius: '6px', 
                            fontSize: '11px', 
                            background: planInfo.bg, 
                            color: planInfo.color,
                            fontWeight: 'bold',
                            textTransform: 'uppercase'
                          }}>
                            {planInfo.label}
                          </span>
                        </div>

                        {/* Features Toggles list */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          
                          {/* Google Sheets Sync toggle */}
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                            <input 
                              type="checkbox"
                              checked={feat.googleSheetsSync}
                              onChange={() => handleFeatureToggle(planInfo.key, 'googleSheetsSync')}
                              style={{ accentColor: 'var(--primary)' }}
                            />
                            <span>Đồng bộ Google Sheets</span>
                          </label>

                          {/* Activity Logs toggle */}
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                            <input 
                              type="checkbox"
                              checked={feat.activityLogs}
                              onChange={() => handleFeatureToggle(planInfo.key, 'activityLogs')}
                              style={{ accentColor: 'var(--primary)' }}
                            />
                            <span>Lịch sử hoạt động</span>
                          </label>

                          {/* Checklists toggle */}
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                            <input 
                              type="checkbox"
                              checked={feat.checklists}
                              onChange={() => handleFeatureToggle(planInfo.key, 'checklists')}
                              style={{ accentColor: 'var(--primary)' }}
                            />
                            <span>Checklist công việc</span>
                          </label>

                          {/* Column Customization toggle */}
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                            <input 
                              type="checkbox"
                              checked={feat.columnCustomization}
                              onChange={() => handleFeatureToggle(planInfo.key, 'columnCustomization')}
                              style={{ accentColor: 'var(--primary)' }}
                            />
                            <span>Tùy chỉnh cột Kanban</span>
                          </label>

                          {/* Card limits numeric input */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid var(--border-glass)' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Giới hạn thẻ công việc (cards):</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input 
                                type="number"
                                value={feat.cardLimit}
                                onChange={(e) => handleCardLimitChange(planInfo.key, e.target.value)}
                                style={{
                                  padding: '4px 8px',
                                  fontSize: '12.5px',
                                  width: '90px',
                                  borderRadius: '6px',
                                  background: 'rgba(255,255,255,0.05)',
                                  border: '1px solid var(--border-glass)',
                                  color: 'var(--text-primary)',
                                  outline: 'none'
                                }}
                              />
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>thẻ</span>
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SUBTAB 4: GIÁM SÁT DỮ LIỆU */}
            {adminSubTab === 'data' && (
              <div className="dashboard-table-wrapper" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th style={{ width: '35%' }}>Tài khoản</th>
                      <th style={{ width: '20%' }}>Số thẻ việc</th>
                      <th style={{ width: '20%' }}>Số cột Kanban</th>
                      <th style={{ width: '25%' }}>Số danh mục</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      return (
                        <tr key={user.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.05)',
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                fontSize: '12px'
                              }}>
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{user.username}</span>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                  ID: {user.id}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ 
                                fontSize: '13px', 
                                fontWeight: 'bold',
                                color: parseInt(user.cardCount) > 0 ? 'var(--text-primary)' : 'var(--text-muted)' 
                              }}>
                                {user.cardCount || 0}
                              </span>
                              {parseInt(user.cardCount) > 0 && <TrendingUp size={12} style={{ color: '#10b981' }} />}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              {user.columnCount || 0} Cột
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              {user.categoryCount || 0} Danh mục
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* SUBTAB 5: QUẢN LÝ ĐỘI NHÓM */}
            {adminSubTab === 'teams' && (
              <AdminTeamsManager 
                token={token}
                API_BASE_URL={API_BASE_URL}
                users={users}
              />
            )}

          </div>
        )}
      </div>
    </div>
  );
}

function AdminTeamsManager({ token, API_BASE_URL, users }) {
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  
  // Form states
  const [ownerId, setOwnerId] = useState('');
  const [formMembers, setFormMembers] = useState([]); // Array of { memberId, teamRole }
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedTeamRole, setSelectedTeamRole] = useState('StaffVH');
  
  const [isEditing, setIsEditing] = useState(false);

  const fetchTeams = async () => {
    setLoadingTeams(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/teams`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Không thể tải danh sách đội nhóm.');
      const data = await res.json();
      setTeams(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingTeams(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [token]);

  const handleOpenCreateForm = () => {
    setOwnerId('');
    setFormMembers([]);
    setSelectedMemberId('');
    setSelectedTeamRole('StaffVH');
    setIsEditing(false);
    setShowForm(true);
    setError('');
    setSuccessMsg('');
  };

  const handleOpenEditForm = (team) => {
    setOwnerId(team.ownerId);
    setFormMembers(team.members.map(m => ({ memberId: m.memberId, teamRole: m.teamRole })));
    setSelectedMemberId('');
    setSelectedTeamRole('StaffVH');
    setIsEditing(true);
    setShowForm(true);
    setError('');
    setSuccessMsg('');
  };

  const handleAddMemberToForm = () => {
    if (!selectedMemberId) return;
    if (selectedMemberId === ownerId) {
      setError('Trưởng nhóm không thể làm thành viên của chính mình.');
      return;
    }
    if (formMembers.some(m => m.memberId === selectedMemberId)) {
      setError('Thành viên này đã có trong danh sách.');
      return;
    }
    setFormMembers([...formMembers, { memberId: selectedMemberId, teamRole: selectedTeamRole }]);
    setSelectedMemberId('');
    setError('');
  };

  const handleRemoveMemberFromForm = (id) => {
    setFormMembers(formMembers.filter(m => m.memberId !== id));
  };

  const handleSaveTeam = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!ownerId) {
      setError('Vui lòng chọn Trưởng nhóm.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/teams/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ownerId, members: formMembers })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lưu đội nhóm thất bại.');
      
      setSuccessMsg('Đã lưu cấu hình đội nhóm thành công!');
      setShowForm(false);
      fetchTeams();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteTeam = async (targetOwnerId, ownerUsername) => {
    if (!window.confirm(`Bạn có chắc chắn muốn giải tán đội nhóm của "${ownerUsername}"?`)) return;
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/teams/${targetOwnerId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Giải tán đội nhóm thất bại.');
      
      setSuccessMsg(`Đã giải tán đội nhóm của "${ownerUsername}" thành công!`);
      fetchTeams();
    } catch (err) {
      setError(err.message);
    }
  };

  const getUserUsername = (id) => {
    const u = users.find(user => user.id === id);
    return u ? u.username : id;
  };

  // Lọc danh sách user có thể làm trưởng nhóm (không phải admin)
  const potentialManagers = users.filter(u => u.role !== 'admin');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
        <div>
          <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: 0, fontWeight: '600' }}>Danh sách Đội nhóm (Teams)</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Xem, tạo mới hoặc chỉnh sửa phân bổ nhân sự và vai trò các đội nhóm trong hệ thống.</p>
        </div>
        {!showForm && (
          <button 
            className="btn btn-primary"
            onClick={handleOpenCreateForm}
            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}
          >
            Tạo đội nhóm mới
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: '6px', background: 'var(--danger-light)', color: 'var(--danger)', fontSize: '12.5px' }}>
          {error}
        </div>
      )}

      {successMsg && (
        <div style={{ padding: '10px 14px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '12.5px' }}>
          {successMsg}
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleSaveTeam} style={{ background: 'rgba(255,255,255,0.01)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--primary)' }}>
            {isEditing ? 'Chỉnh sửa Đội nhóm' : 'Tạo Đội nhóm Mới'}
          </h4>

          {/* Chọn Manager */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Trưởng nhóm (Manager - MNG):</label>
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              disabled={isEditing}
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)',
                outline: 'none',
                maxWidth: '300px'
              }}
              required
            >
              <option value="" style={{ background: '#18181b' }}>-- Chọn Trưởng nhóm --</option>
              {potentialManagers.map(u => (
                <option key={u.id} value={u.id} style={{ background: '#18181b' }}>{u.username} ({u.plan.toUpperCase()})</option>
              ))}
            </select>
          </div>

          {/* Danh sách thành viên hiện tại của form */}
          <div style={{ marginTop: '10px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
              Thành viên trong nhóm ({formMembers.length}):
            </label>
            {formMembers.length === 0 ? (
              <div style={{ padding: '12px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-glass)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                Chưa có thành viên nào. Vui lòng thêm bên dưới.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {formMembers.map(m => (
                  <div key={m.memberId} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid var(--border-glass)', fontSize: '12px' }}>
                    <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{getUserUsername(m.memberId)}</span>
                    <span style={{ fontSize: '10px', padding: '1px 4px', borderRadius: '3px', background: m.teamRole === 'StaffMKT' ? 'rgba(168,85,247,0.15)' : 'rgba(59,130,246,0.15)', color: m.teamRole === 'StaffMKT' ? '#a855f7' : '#3b82f6', fontWeight: 'bold' }}>
                      {m.teamRole}
                    </span>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveMemberFromForm(m.memberId)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: '4px', fontSize: '10px' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Thêm thành viên vào form */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: '12px', padding: '14px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', marginTop: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Chọn thành viên:</label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                style={{
                  padding: '6px 10px',
                  fontSize: '12.5px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  minWidth: '160px'
                }}
              >
                <option value="" style={{ background: '#18181b' }}>-- Chọn User --</option>
                {users.filter(u => u.id !== ownerId && u.role !== 'admin').map(u => (
                  <option key={u.id} value={u.id} style={{ background: '#18181b' }}>{u.username}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Vai trò đội nhóm (RolesTeam):</label>
              <select
                value={selectedTeamRole}
                onChange={(e) => setSelectedTeamRole(e.target.value)}
                style={{
                  padding: '6px 10px',
                  fontSize: '12.5px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  minWidth: '120px'
                }}
              >
                <option value="StaffVH" style={{ background: '#18181b' }}>StaffVH (Vận hành)</option>
                <option value="StaffMKT" style={{ background: '#18181b' }}>StaffMKT (Marketing)</option>
              </select>
            </div>

            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={handleAddMemberToForm}
              style={{ padding: '6px 12px', fontSize: '12.5px', borderRadius: '6px' }}
            >
              Thêm vào nhóm
            </button>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px', justifyContent: 'flex-end' }}>
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={() => { setShowForm(false); setError(''); }}
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}
            >
              Hủy bộ
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}
            >
              Lưu cấu hình nhóm
            </button>
          </div>
        </form>
      ) : (
        /* Render list of teams */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {loadingTeams ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Đang tải danh sách đội nhóm...
            </div>
          ) : teams.length === 0 ? (
            <div style={{ padding: '40px', borderRadius: '8px', border: '1px dashed var(--border-glass)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Chưa có đội nhóm nào được cấu hình thủ công trong hệ thống. Hãy tạo nhóm mới!
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {teams.map(team => (
                <div key={team.ownerId} style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    {/* Header: Manager Username */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '13.5px' }}>
                        Nhóm của: {team.ownerUsername}
                      </span>
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontWeight: 'bold' }}>
                        MANAGER (MNG)
                      </span>
                    </div>

                    {/* Members List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {team.members.map(m => (
                        <div key={m.memberId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                          <span style={{ color: 'var(--text-primary)' }}>{m.memberUsername}</span>
                          <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: m.teamRole === 'StaffMKT' ? 'rgba(168,85,247,0.1)' : 'rgba(59,130,246,0.1)', color: m.teamRole === 'StaffMKT' ? '#a855f7' : '#3b82f6', fontWeight: '500' }}>
                            {m.teamRole}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Team Actions */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-glass)', paddingTop: '8px', marginTop: '4px' }}>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => handleOpenEditForm(team)}
                      style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '6px' }}
                    >
                      Sửa nhóm
                    </button>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => handleDeleteTeam(team.ownerId, team.ownerUsername)}
                      style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '6px', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.2)' }}
                    >
                      Giải tán
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
