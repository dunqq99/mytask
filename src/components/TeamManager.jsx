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
  currentUserId
}) {
  const [inviteUsername, setInviteUsername] = useState('');
  const [myMembers, setMyMembers] = useState([]);
  const [joinedTeams, setJoinedTeams] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Không thể tải danh sách đội nhóm.');
      }
      const data = await response.json();
      setMyMembers(data.myMembers || []);
      setJoinedTeams(data.joinedTeams || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTeamData();
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        
        {/* Left column: Invite teammates & My team */}
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
                <span>Đội nhóm của tôi ({myMembers.length})</span>
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
                      <div style={{ fontSize: '13.5px', fontWeight: '600' }}>{m.username}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                        <span>Vai trò tổ đội:</span>
                        <select
                          value={m.role || 'StaffVH'}
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
                          <option value="StaffVH" style={{ background: '#18181b', color: '#fff' }}>Nhân viên Vận hành</option>
                          <option value="StaffMKT" style={{ background: '#18181b', color: '#fff' }}>Nhân viên Marketing</option>
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

        {/* Right column: Joined teams */}
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
                        Trưởng nhóm: {t.ownerUsername}
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

      </div>
    </div>
  );
}
