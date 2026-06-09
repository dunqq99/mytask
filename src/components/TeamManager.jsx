import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  UserMinus, 
  Briefcase, 
  ArrowLeftRight, 
  Check, 
  AlertCircle, 
  RefreshCw,
  Home
} from 'lucide-react';

export default function TeamManager({
  token,
  API_BASE_URL,
  currentUsername,
  currentUserId,
  onTeamChange
}) {
  const [inviteUsername, setInviteUsername] = useState('');
  const [myMembers, setMyMembers] = useState([]);
  const [joinedTeams, setJoinedTeams] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [myTeamName, setMyTeamName] = useState('');
  const [teamRoles, setTeamRoles] = useState([]);
  const [userPlan, setUserPlan] = useState('free');
  
  const [loading, setLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Trạng thái quản lý vai trò đội nhóm
  const [roleKey, setRoleKey] = useState('');
  const [roleName, setRoleName] = useState('');
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [roleError, setRoleError] = useState('');
  const [roleSuccess, setRoleSuccess] = useState('');

  // Fetch team lists
  const fetchTeamData = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/team`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Dịch vụ API Backend đang ngoại tuyến hoặc chưa khởi động. Vui lòng kiểm tra lại Docker/Server.');
      }
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Không thể tải danh sách đội nhóm.');
      }
      const data = await response.json();
      setMyMembers(data.myMembers || []);
      setJoinedTeams(data.joinedTeams || []);
      setPendingInvites(data.pendingInvites || []);
      setMyTeamName(data.myTeamName || '');
      setUserPlan(data.userPlan || 'free');
    } catch (err) {
      if (err.name === 'SyntaxError') {
        setError('Dữ liệu phản hồi từ Server không hợp lệ (Không phải JSON). Vui lòng khởi động lại Docker container.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamRoles = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/team-roles`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTeamRoles(data);
      }
    } catch (err) {
      console.error('Lỗi tải vai trò động:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTeamData();
      fetchTeamRoles();
    }
  }, [token]);

  // Invite user handler
  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteUsername.trim()) return;

    setInviteLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/team/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username: inviteUsername.trim() })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Không thể mời thành viên.');
      }

      setSuccess(`Đã gửi lời mời và thêm thành công "${inviteUsername.trim()}" vào đội nhóm!`);
      setInviteUsername('');
      fetchTeamData(); // Reload list
    } catch (err) {
      setError(err.message);
    } finally {
      setInviteLoading(false);
    }
  };

  // Update member team role
  const handleUpdateRole = async (memberId, role) => {
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/team/update-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ memberId, role })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Không thể cập nhật vai trò đội nhóm.');
      }

      setSuccess(`Đã cập nhật vai trò thành viên thành công.`);
      fetchTeamData(); // Reload list
    } catch (err) {
      setError(err.message);
    }
  };

  // Remove member handler
  const handleRemoveMember = async (memberId, memberUsername) => {
    if (!confirm(`Bạn chắc chắn muốn xóa "${memberUsername}" khỏi đội nhóm của mình? Các tác vụ đã giao cho họ vẫn sẽ được giữ lại.`)) return;

    setError('');
    setSuccess('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/team/remove`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ memberId })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Không thể xóa thành viên.');
      }

      setSuccess(`Đã xóa thành viên "${memberUsername}" khỏi nhóm thành công.`);
      fetchTeamData(); // Reload list
    } catch (err) {
      setError(err.message);
    }
  };

  // Trình xử lý vai trò đội nhóm
  const handleOpenCreateRoleForm = () => {
    setRoleKey('');
    setRoleName('');
    setIsEditingRole(false);
    setShowRoleForm(true);
    setRoleError('');
    setRoleSuccess('');
  };

  const handleOpenEditRoleForm = (role) => {
    setRoleKey(role.roleKey);
    setRoleName(role.roleName);
    setIsEditingRole(true);
    setShowRoleForm(true);
    setRoleError('');
    setRoleSuccess('');
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    setRoleError('');
    setRoleSuccess('');
    if (!roleKey.trim() || !roleName.trim()) {
      setRoleError('Vui lòng nhập đầy đủ mã và tên vai trò.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/team-roles/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ roleKey: roleKey.trim(), roleName: roleName.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lưu vai trò thất bại.');
      
      setRoleSuccess('Đã lưu vai trò thành công!');
      setShowRoleForm(false);
      fetchTeamRoles();
    } catch (err) {
      setRoleError(err.message);
    }
  };

  const handleDeleteRole = async (targetRoleKey) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vai trò "${targetRoleKey}"? Các thành viên hiện có vai trò này sẽ tự động chuyển sang một vai trò khác.`)) return;
    setRoleError('');
    setRoleSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/team-roles/${targetRoleKey}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Xóa vai trò thất bại.');
      
      setRoleSuccess(`Đã xóa vai trò "${targetRoleKey}" thành công!`);
      fetchTeamRoles();
      fetchTeamData();
    } catch (err) {
      setRoleError(err.message);
    }
  };

  const handleAcceptInvite = async (ownerId) => {
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/team/invites/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ownerId })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Không thể chấp nhận lời mời.');
      }

      setSuccess(`Đã chấp nhận lời mời và nâng cấp tài khoản lên Business thành công!`);
      fetchTeamData();
      if (onTeamChange) {
        onTeamChange();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeclineInvite = async (ownerId) => {
    if (!confirm('Bạn chắc chắn muốn từ chối lời mời tham gia nhóm này?')) return;
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/team/invites/decline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ownerId })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Không thể từ chối lời mời.');
      }

      setSuccess(`Đã từ chối lời mời tham gia nhóm.`);
      fetchTeamData();
      if (onTeamChange) {
        onTeamChange();
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: '24px 0', maxWidth: '1000px', margin: '0 auto', color: 'var(--text-primary)' }}>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#f87171', fontSize: '13px' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', color: '#34d399', fontSize: '13px' }}>
          <Check size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Lời mời tham gia nhóm đang chờ xác nhận */}
      {pendingInvites && pendingInvites.length > 0 && (
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--primary)', background: 'rgba(59, 130, 246, 0.05)', marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa' }}>
            <Users size={16} />
            <span>Lời mời tham gia Đội nhóm ({pendingInvites.length})</span>
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
            Bạn đã được các Trưởng nhóm sau mời tham gia đội nhóm của họ. Khi đồng ý tham gia, tài khoản của bạn sẽ tự động được nâng cấp lên <strong>Business</strong>.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendingInvites.map(invite => (
              <div key={invite.ownerId} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: '600' }}>
                    Trưởng nhóm: {invite.ownerUsername} {invite.teamName && <span style={{ color: '#a855f7', fontWeight: 'normal', fontSize: '12.5px' }}>({invite.teamName})</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Nhóm cộng tác & chia sẻ công việc chuyên nghiệp
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleAcceptInvite(invite.ownerId)}
                    style={{ padding: '6px 14px', fontSize: '12px' }}
                  >
                    Đồng ý
                  </button>
                  <button
                    className="btn"
                    onClick={() => handleDeclineInvite(invite.ownerId)}
                    style={{ 
                      padding: '6px 14px', 
                      fontSize: '12px',
                      color: '#f87171', 
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.15)'
                    }}
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: userPlan === 'free' ? '1fr' : 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        
        {/* Left column: Invite teammates & My team */}
        {userPlan !== 'free' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Invite form */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={16} style={{ color: 'var(--primary)' }} />
                <span>Mời thành viên mới</span>
              </h3>
              
              <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Tên đăng nhập (Username) trên hệ thống:
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập chính xác Username..."
                    className="search-input"
                    style={{ width: '100%', padding: '8px 12px' }}
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={inviteLoading || !inviteUsername.trim()}
                  style={{ alignSelf: 'flex-start', padding: '8px 16px' }}
                >
                  {inviteLoading ? 'Đang gửi mời...' : 'Mời vào nhóm'}
                </button>
              </form>
            </div>

            {/* Members list */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-glass)', flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={16} style={{ color: 'var(--primary)' }} />
                  <span>{myTeamName ? `Đội nhóm của tôi: ${myTeamName}` : 'Đội nhóm của tôi'} ({myMembers.length})</span>
                </h3>
                <button 
                  onClick={fetchTeamData} 
                  disabled={loading}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  title="Làm mới"
                >
                  <RefreshCw size={14} className={loading ? 'spin' : ''} />
                </button>
              </div>

              {myMembers.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px', fontStyle: 'italic' }}>
                  Chưa có thành viên nào trong nhóm của bạn. Hãy điền Username bên trên để kết nối và bắt đầu chia sẻ công việc!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {myMembers.map(m => (
                    <div key={m.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      background: 'rgba(255, 255, 255, 0.01)'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '13.5px', fontWeight: '600' }}>
                          {m.username}
                          {m.status === 'pending' && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '11.5px', fontWeight: 'normal', fontStyle: 'italic', marginLeft: '6px' }}>
                              (Đang chờ xác nhận)
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <span>Vai trò tổ đội:</span>
                          <select
                            value={m.role || (teamRoles.length > 0 ? teamRoles[0].roleKey : 'StaffVH')}
                            onChange={(e) => handleUpdateRole(m.id, e.target.value)}
                            style={{
                              padding: '2px 6px',
                              fontSize: '11.5px',
                              borderRadius: '4px',
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--border-glass)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          >
                            {teamRoles.map(tr => (
                              <option key={tr.roleKey} value={tr.roleKey} style={{ background: '#18181b', color: '#fff' }}>{tr.roleName}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        className="btn"
                        onClick={() => handleRemoveMember(m.id, m.username)}
                        style={{ 
                          padding: '6px', 
                          color: '#f87171', 
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.15)',
                          borderRadius: '6px'
                        }}
                        title="Xóa khỏi nhóm"
                      >
                        <UserMinus size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Right column: Joined teams & Roles management */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Joined teams */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowLeftRight size={16} style={{ color: 'var(--primary)' }} />
              <span>Đội nhóm đã tham gia ({joinedTeams.length})</span>
            </h3>

            {joinedTeams.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px', fontStyle: 'italic' }}>
                Bạn chưa tham gia đội nhóm nào khác. Khi trưởng nhóm khác mời bạn bằng Username, nhóm của họ sẽ xuất hiện tại đây để bạn cùng cộng tác.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {joinedTeams.map(t => {
                  return (
                    <div key={t.ownerId} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      background: 'rgba(255, 255, 255, 0.01)'
                    }}>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: '600' }}>
                          Trưởng nhóm: {t.ownerUsername} {t.teamName && <span style={{ color: '#a855f7', fontWeight: 'normal', fontSize: '12.5px' }}>({t.teamName})</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Đồng tác viên (Nhận và thực hiện các công việc được giao)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quản lý vai trò đội nhóm */}
          {userPlan !== 'free' && (
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Briefcase size={16} style={{ color: 'var(--primary)' }} />
                  <span>Vai trò Đội nhóm của tôi ({teamRoles.length})</span>
                </h3>
                {!showRoleForm && (
                  <button 
                    className="btn btn-primary"
                    onClick={handleOpenCreateRoleForm}
                    style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px' }}
                  >
                    Thêm vai trò
                  </button>
                )}
              </div>

              {roleError && (
                <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', fontSize: '12px', marginBottom: '12px' }}>
                  {roleError}
                </div>
              )}

              {roleSuccess && (
                <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', fontSize: '12px', marginBottom: '12px' }}>
                  {roleSuccess}
                </div>
              )}

              {showRoleForm ? (
                <form onSubmit={handleSaveRole} style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <h4 style={{ margin: 0, fontSize: '12.5px', color: 'var(--primary)', fontWeight: 'bold' }}>
                    {isEditingRole ? 'Chỉnh sửa vai trò' : 'Thêm vai trò mới'}
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Mã vai trò (role_key):</label>
                    <input
                      type="text"
                      value={roleKey}
                      onChange={(e) => setRoleKey(e.target.value)}
                      disabled={isEditingRole}
                      placeholder="ví dụ: StaffDesign, StaffQA..."
                      className="search-input"
                      style={{ padding: '6px 10px', fontSize: '12.5px' }}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Tên hiển thị:</label>
                    <input
                      type="text"
                      value={roleName}
                      onChange={(e) => setRoleName(e.target.value)}
                      placeholder="ví dụ: Thiết kế, Kiểm thử..."
                      className="search-input"
                      style={{ padding: '6px 10px', fontSize: '12.5px' }}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary"
                      onClick={() => { setShowRoleForm(false); setRoleError(''); }}
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      Hủy
                    </button>
                    <button 
                      type="submit" 
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      Lưu vai trò
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {teamRoles.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>
                      Chưa cấu hình vai trò nào.
                    </div>
                  ) : (
                    teamRoles.map(r => (
                      <div key={r.roleKey} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        background: 'rgba(255, 255, 255, 0.01)'
                      }}>
                        <div>
                          <span style={{ fontSize: '12.5px', fontWeight: '600' }}>{r.roleName}</span>
                          <span style={{ fontSize: '10px', marginLeft: '6px', padding: '1px 4px', borderRadius: '3px', background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>{r.roleKey}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            className="btn btn-secondary"
                            onClick={() => handleOpenEditRoleForm(r)}
                            style={{ padding: '3px 6px', fontSize: '10.5px', borderRadius: '4px' }}
                          >
                            Sửa
                          </button>
                          <button 
                            className="btn"
                            onClick={() => handleDeleteRole(r.roleKey)}
                            style={{ 
                              padding: '3px 6px', 
                              fontSize: '10.5px', 
                              borderRadius: '4px',
                              color: '#f87171', 
                              background: 'rgba(239, 68, 68, 0.08)',
                              border: '1px solid rgba(239, 68, 68, 0.15)'
                            }}
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
