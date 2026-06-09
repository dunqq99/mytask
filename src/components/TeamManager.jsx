import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  UserMinus, 
  Briefcase, 
  ArrowLeftRight, 
  Check, 
  AlertCircle, 
  RefreshCw,
  Home,
  Plus,
  Clock,
  Database,
  CalendarDays,
  Settings,
  X
} from 'lucide-react';

export default function TeamManager({
  token,
  API_BASE_URL,
  currentUsername,
  currentUserId,
  onTeamChange,
  teamSubTab = 'overview',
  shifts = [],
  setShifts,
  weeklyShifts = {},
  setWeeklyShifts,
  weeklyMemberShifts = {},
  setWeeklyMemberShifts,
  isManager = false,
  workspaceMembers = [],
  workdayDuration = 480,
  setWorkdayDuration
}) {
  const [inviteUsername, setInviteUsername] = useState('');
  const [myMembers, setMyMembers] = useState([]);
  const [joinedTeams, setJoinedTeams] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [myTeamName, setMyTeamName] = useState('');
  const [teamRoles, setTeamRoles] = useState([]);
  const [userPlan, setUserPlan] = useState('free');
  
  // Shift editing states
  const [editingShift, setEditingShift] = useState(null);
  const [shiftFormName, setShiftFormName] = useState('');
  const [shiftFormStart, setShiftFormStart] = useState('08:00');
  const [shiftFormEnd, setShiftFormEnd] = useState('16:00');

  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  };

  const currentWeekMondayStr = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);
    return monday.toLocaleDateString('en-CA');
  }, []);

  const handleMemberShiftChange = (memberId, shiftId) => {
    const updatedWeeklyMemberShifts = {
      ...weeklyMemberShifts,
      [memberId]: {
        ...(weeklyMemberShifts[memberId] || {}),
        [currentWeekMondayStr]: shiftId || ''
      }
    };
    setWeeklyMemberShifts(updatedWeeklyMemberShifts);
  };

  // Bot configuration state
  const [botConfig, setBotConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('zenboard_bot_notifications_config');
      return saved ? JSON.parse(saved) : {
        enabled: false,
        platform: 'discord',
        webhookUrl: '',
        chatId: ''
      };
    } catch {
      return {
        enabled: false,
        platform: 'discord',
        webhookUrl: '',
        chatId: ''
      };
    }
  });

  const [botTestStatus, setBotTestStatus] = useState('idle'); // 'idle', 'sending', 'success', 'error'

  const handleSaveBotConfig = () => {
    localStorage.setItem('zenboard_bot_notifications_config', JSON.stringify(botConfig));
    alert('Đã lưu cấu hình Bot thông báo thành công!');
  };

  const handleTestBotConfig = async () => {
    if (!botConfig.webhookUrl) {
      alert('Vui lòng điền Webhook URL trước khi thử nghiệm.');
      return;
    }
    setBotTestStatus('sending');
    try {
      let response;
      const testMsg = `Kiểm tra kết nối Bot thông báo của ZenBoard thành công! 🤖`;
      if (botConfig.platform === 'discord') {
        response = await fetch(botConfig.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: `🔔 **[ZenBoard]** ${testMsg}` })
        });
      } else if (botConfig.platform === 'telegram') {
        let url = botConfig.webhookUrl;
        if (botConfig.chatId && !url.includes('chat_id') && !url.includes('sendMessage')) {
          const tokenMatch = url.match(/bot([a-zA-Z0-9:_]+)/);
          const token = tokenMatch ? tokenMatch[1] : '';
          if (token) {
            url = `https://api.telegram.org/bot${token}/sendMessage`;
          }
        }
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: botConfig.chatId || '',
            text: `🔔 [ZenBoard] ${testMsg}`
          })
        });
      } else {
        response = await fetch(botConfig.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: testMsg })
        });
      }
      if (response.ok) {
        setBotTestStatus('success');
        setTimeout(() => setBotTestStatus('idle'), 3000);
      } else {
        throw new Error(`Server returned status ${response.status}`);
      }
    } catch (err) {
      console.error(err);
      setBotTestStatus('error');
      alert('Gửi tin nhắn thử nghiệm thất bại: ' + err.message);
      setTimeout(() => setBotTestStatus('idle'), 3000);
    }
  };

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
      setMyMembers(Array.isArray(data.myMembers) ? data.myMembers : []);
      setJoinedTeams(Array.isArray(data.joinedTeams) ? data.joinedTeams : []);
      setPendingInvites(Array.isArray(data.pendingInvites) ? data.pendingInvites : []);
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
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setTeamRoles(data);
          }
        }
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
    <div style={{ padding: '24px 40px', maxWidth: '1200px', margin: '0 auto', color: 'var(--text-primary)', minHeight: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>

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

      {/* Header section */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-glass)',
        paddingBottom: '20px',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, fontFamily: 'var(--font-title)' }}>
            {teamSubTab === 'roles' 
              ? 'Vai trò Đội nhóm' 
              : teamSubTab === 'shifts' 
              ? 'Phân ca & Lịch làm việc' 
              : teamSubTab === 'bot-notifications' 
              ? 'Cấu hình Bot thông báo' 
              : 'Tổng quan Đội nhóm'}
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            {teamSubTab === 'roles' 
              ? 'Thiết lập các vai trò cụ thể để gán cho các thành viên trong nhóm của bạn.' 
              : teamSubTab === 'shifts' 
              ? 'Xếp ca làm việc cho đội nhóm và thiết lập ca làm việc theo tuần.' 
              : teamSubTab === 'bot-notifications' 
              ? 'Tích hợp thông báo ZenBoard tới kênh Discord hoặc Telegram nhóm.'
              : 'Quản lý thành viên, gửi lời mời tham gia và xem các nhóm bạn đang cộng tác.'}
          </p>
        </div>

        {/* Action Button */}
        {teamSubTab === 'roles' && userPlan !== 'free' && !showRoleForm && (
          <button 
            className="btn btn-primary"
            onClick={handleOpenCreateRoleForm}
            style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px' }}
          >
            <Plus size={16} />
            <span>Thêm vai trò mới</span>
          </button>
        )}
      </div>

      {/* Lời mời tham gia nhóm đang chờ xác nhận */}
      {pendingInvites && pendingInvites.length > 0 && (
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--primary)', background: 'rgba(99, 102, 241, 0.05)', marginBottom: '12px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontFamily: 'var(--font-title)' }}>
            <Users size={18} />
            <span>Lời mời tham gia Đội nhóm ({pendingInvites.length})</span>
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: '1.6' }}>
            Bạn đã được các Trưởng nhóm sau mời tham gia đội nhóm của họ. Khi đồng ý tham gia, tài khoản của bạn sẽ tự động được nâng cấp lên <strong>Business</strong>.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingInvites.map(invite => (
              <div key={invite.ownerId} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 20px',
                borderRadius: '12px',
                background: 'var(--bg-glass-card)',
                border: '1px solid var(--border-glass-card)',
                backdropFilter: 'blur(10px)'
              }}>
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: '600', color: 'var(--text-primary)' }}>
                    Trưởng nhóm: <span style={{ color: 'var(--primary)' }}>{invite.ownerUsername}</span> {invite.teamName && <span style={{ color: '#a855f7', fontWeight: 'normal', fontSize: '13px' }}>({invite.teamName})</span>}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Nhóm cộng tác & chia sẻ công việc chuyên nghiệp
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleAcceptInvite(invite.ownerId)}
                    style={{ padding: '8px 16px', fontSize: '12.5px' }}
                  >
                    Đồng ý
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleDeclineInvite(invite.ownerId)}
                    style={{ 
                      padding: '8px 16px', 
                      fontSize: '12.5px',
                      color: 'var(--danger)', 
                      background: 'var(--danger-light)',
                      borderColor: 'transparent'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {teamSubTab === 'roles' && userPlan !== 'free' ? (
        /* Render Roles Management only */
        showRoleForm ? (
          <div style={{
            maxWidth: '500px',
            margin: '40px auto',
            width: '100%',
            background: 'var(--bg-glass-card)',
            border: '1px solid var(--border-glass-card)',
            borderRadius: '16px',
            padding: '28px',
            boxShadow: 'var(--shadow-lg)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '700', color: 'var(--primary)', fontFamily: 'var(--font-title)' }}>
              {isEditingRole ? 'Chỉnh sửa vai trò' : 'Thêm vai trò mới'}
            </h3>
            
            <form onSubmit={handleSaveRole} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Mã vai trò (role_key):</label>
                <input
                  type="text"
                  value={roleKey}
                  onChange={(e) => setRoleKey(e.target.value)}
                  disabled={isEditingRole}
                  placeholder="ví dụ: StaffDesign, StaffQA..."
                  className="search-input"
                  style={{ padding: '10px 14px', fontSize: '13.5px', paddingLeft: '14px' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>Tên hiển thị:</label>
                <input
                  type="text"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="ví dụ: Thiết kế, Kiểm thử..."
                  className="search-input"
                  style={{ padding: '10px 14px', fontSize: '13.5px', paddingLeft: '14px' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => { setShowRoleForm(false); setRoleError(''); }}
                  style={{ padding: '10px 16px' }}
                >
                  Hủy
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ padding: '10px 20px' }}
                >
                  Lưu vai trò
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {teamRoles.length === 0 ? (
              <div style={{
                gridColumn: '1 / -1',
                padding: '60px 20px',
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px dashed var(--border-glass)',
                borderRadius: '16px',
                color: 'var(--text-muted)'
              }}>
                <Briefcase size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', opacity: 0.5 }} />
                <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>Chưa có vai trò nào</h4>
                <p style={{ fontSize: '13px', margin: '0 0 16px 0' }}>Bắt đầu bằng cách tạo vai trò đầu tiên cho đội của bạn.</p>
                <button className="btn btn-primary" onClick={handleOpenCreateRoleForm}>Tạo vai trò</button>
              </div>
            ) : (
              teamRoles.map(r => (
                <div key={r.roleKey} style={{
                  background: 'var(--bg-glass-card)',
                  border: '1px solid var(--border-glass-card)',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                  transition: 'all 0.2s',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                className="role-grid-card"
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-glass-card)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Briefcase size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {r.roleName}
                      </h4>
                      <span style={{ 
                        display: 'inline-block',
                        fontSize: '11px', 
                        marginTop: '4px',
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        background: 'rgba(99, 102, 241, 0.12)', 
                        color: 'var(--primary)',
                        fontWeight: '700'
                      }}>
                        {r.roleKey}
                      </span>
                    </div>
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    gap: '8px', 
                    justifyContent: 'flex-end',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    paddingTop: '12px'
                  }}>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => handleOpenEditRoleForm(r)}
                      style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px' }}
                    >
                      Sửa
                    </button>
                    <button 
                      className="btn"
                      onClick={() => handleDeleteRole(r.roleKey)}
                      style={{ 
                        padding: '6px 12px', 
                        fontSize: '12px', 
                        borderRadius: '8px',
                        color: 'var(--danger)', 
                        background: 'var(--danger-light)',
                        border: '1px solid transparent'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )
      ) : teamSubTab === 'shifts' && userPlan !== 'free' ? (
          /* Render Shifts & Scheduling Tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {isManager ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
                
                {/* Left Panel: Member Shift Assignments */}
                <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-glass-card)', background: 'var(--bg-glass-card)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontFamily: 'var(--font-title)' }}>
                    <Users size={18} />
                    <span>Bố trí ca làm việc cho Đội nhóm ({currentWeekMondayStr})</span>
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                    Chọn ca làm việc cho từng thành viên trong tuần này. Trực quan hóa quỹ giờ và timeline cá nhân.
                  </p>
                  
                  {workspaceMembers && workspaceMembers.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {workspaceMembers.map(member => {
                        const memberShiftId = weeklyMemberShifts[member.id]?.[currentWeekMondayStr] || '';
                        return (
                          <div 
                            key={member.id} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between', 
                              padding: '12px 16px', 
                              borderRadius: '10px', 
                              border: '1px solid rgba(255,255,255,0.03)', 
                              background: 'rgba(255,255,255,0.015)' 
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                                {member.username}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {member.roleName || member.role}
                              </span>
                            </div>
                            
                            <select
                              value={memberShiftId}
                              onChange={(e) => handleMemberShiftChange(member.id, e.target.value)}
                              style={{ 
                                padding: '6px 12px', 
                                borderRadius: '8px', 
                                fontSize: '13px', 
                                minWidth: '180px', 
                                background: 'rgba(255,255,255,0.05)', 
                                border: '1px solid var(--border-glass)', 
                                color: 'var(--text-primary)',
                                outline: 'none',
                                cursor: 'pointer'
                              }}
                            >
                              <option value="" style={{ background: '#18181b', color: '#fff' }}>-- Chưa xếp ca --</option>
                              {shifts.map(s => (
                                <option key={s.id} value={s.id} style={{ background: '#18181b', color: '#fff' }}>
                                  {s.name} ({s.startTime} - {s.endTime})
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>
                      Chưa có thành viên nào trong đội nhóm để xếp ca.
                    </div>
                  )}
                </div>

                {/* Right Panel: Shift CRUD & Weekly Setup */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* Shift CRUD Card */}
                  <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-glass-card)', background: 'var(--bg-glass-card)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontFamily: 'var(--font-title)' }}>
                      <Clock size={18} />
                      <span>Cấu hình ca làm việc</span>
                    </h3>
                    
                    {/* Add/Edit Form */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!shiftFormName.trim()) return;
                        
                        if (editingShift) {
                          setShifts(shifts.map(s => s.id === editingShift.id ? {
                            ...s,
                            name: shiftFormName.trim(),
                            startTime: shiftFormStart,
                            endTime: shiftFormEnd
                          } : s));
                          setEditingShift(null);
                        } else {
                          const newShift = {
                            id: `shift-${Date.now()}`,
                            name: shiftFormName.trim(),
                            startTime: shiftFormStart,
                            endTime: shiftFormEnd
                          };
                          setShifts([...shifts, newShift]);
                        }
                        
                        setShiftFormName('');
                        setShiftFormStart('08:00');
                        setShiftFormEnd('16:00');
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '10px',
                        padding: '16px',
                        marginBottom: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}
                    >
                      <div style={{ fontSize: '12.5px', fontWeight: 'bold', color: 'var(--primary)' }}>
                        {editingShift ? 'Sửa ca làm việc ✏️' : 'Thêm ca làm việc mới ➕'}
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Tên ca làm việc:</label>
                        <input
                          type="text"
                          placeholder="ví dụ: Ca sáng, Ca tối..."
                          value={shiftFormName}
                          onChange={(e) => setShiftFormName(e.target.value)}
                          required
                          style={{
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            fontSize: '13px',
                            color: '#fff',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Bắt đầu:</span>
                          <input
                            type="time"
                            value={shiftFormStart}
                            onChange={(e) => setShiftFormStart(e.target.value)}
                            required
                            style={{
                              background: 'rgba(0,0,0,0.2)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              fontSize: '13px',
                              color: '#fff',
                              outline: 'none'
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Kết thúc:</span>
                          <input
                            type="time"
                            value={shiftFormEnd}
                            onChange={(e) => setShiftFormEnd(e.target.value)}
                            required
                            style={{
                              background: 'rgba(0,0,0,0.2)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              fontSize: '13px',
                              color: '#fff',
                              outline: 'none'
                            }}
                          />
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                        {editingShift && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                              setEditingShift(null);
                              setShiftFormName('');
                              setShiftFormStart('08:00');
                              setShiftFormEnd('16:00');
                            }}
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                          >
                            Hủy
                          </button>
                        )}
                        <button
                          type="submit"
                          className="btn btn-primary"
                          style={{ padding: '6px 20px', fontSize: '12px' }}
                        >
                          {editingShift ? 'Cập nhật ca' : 'Thêm ca'}
                        </button>
                      </div>
                    </form>

                    {/* Shift List Table */}
                    <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                      {shifts.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                              <th style={{ padding: '8px 10px' }}>Tên ca</th>
                              <th style={{ padding: '8px 10px' }}>Thời gian</th>
                              <th style={{ padding: '8px 10px', textAlign: 'right' }}>Thao tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shifts.map(s => (
                              <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td style={{ padding: '10px 8px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{s.name}</td>
                                <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{s.startTime} - {s.endTime}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                                  <button
                                    className="btn btn-secondary"
                                    onClick={() => {
                                      setEditingShift(s);
                                      setShiftFormName(s.name);
                                      setShiftFormStart(s.startTime);
                                      setShiftFormEnd(s.endTime);
                                    }}
                                    style={{ padding: '4px 10px', fontSize: '11px', marginRight: '6px', borderRadius: '6px' }}
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    className="btn"
                                    onClick={() => {
                                      if (window.confirm(`Bạn có chắc muốn xóa ${s.name}?`)) {
                                        setShifts(shifts.filter(item => item.id !== s.id));
                                        const cleanedAssignments = { ...weeklyShifts };
                                        Object.keys(cleanedAssignments).forEach(k => {
                                          if (cleanedAssignments[k] === s.id) {
                                            delete cleanedAssignments[k];
                                          }
                                        });
                                        setWeeklyShifts(cleanedAssignments);
                                      }
                                    }}
                                    style={{ padding: '4px 10px', fontSize: '11px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid transparent', borderRadius: '6px' }}
                                  >
                                    Xóa
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '12.5px', textAlign: 'center', padding: '16px' }}>
                          Chưa có ca làm việc nào được cấu hình.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Weekly Shift Setup Card */}
                  <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-glass-card)', background: 'var(--bg-glass-card)' }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontFamily: 'var(--font-title)' }}>
                      <Clock size={18} />
                      <span>Thiết lập ca làm việc theo tuần</span>
                    </h3>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
                      Gán ca mặc định cho toàn bộ công việc của tuần tiếp theo.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(() => {
                        const now = new Date();
                        const weekOptions = [];
                        for (let i = 0; i < 5; i++) {
                          const d = new Date(now);
                          const currentDay = d.getDay();
                          const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
                          const monday = new Date(d.setDate(d.getDate() + distanceToMonday + i * 7));
                          const sunday = new Date(monday);
                          sunday.setDate(monday.getDate() + 6);
                          
                          const monStr = monday.toLocaleDateString('en-CA');
                          const label = `Tuần ${i === 0 ? 'này' : (i === 1 ? 'sau' : `+${i}`)} (${monday.getDate()}/${monday.getMonth()+1} - ${sunday.getDate()}/${sunday.getMonth()+1})`;
                          weekOptions.push({ monStr, label });
                        }

                        return weekOptions.map(week => {
                          const assignedId = weeklyShifts[week.monStr] || '';
                          return (
                            <div 
                              key={week.monStr} 
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                background: 'rgba(255,255,255,0.01)', 
                                border: '1px solid rgba(255,255,255,0.03)', 
                                borderRadius: '8px', 
                                padding: '8px 12px' 
                              }}
                            >
                              <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{week.label}</span>
                              <select
                                value={assignedId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const updated = { ...weeklyShifts, [week.monStr]: val };
                                  setWeeklyShifts(updated);

                                  if (week.monStr === currentWeekMondayStr) {
                                    const sh = shifts.find(s => s.id === val);
                                    if (sh) {
                                      const startMins = parseTimeToMinutes(sh.startTime);
                                      const endMins = parseTimeToMinutes(sh.endTime);
                                      let dur = endMins - startMins;
                                      if (dur < 0) dur += 24 * 60;
                                      setWorkdayDuration(dur);
                                    }
                                  }
                                }}
                                style={{ 
                                  minWidth: '180px', 
                                  padding: '6px 10px', 
                                  fontSize: '12px',
                                  background: 'rgba(255,255,255,0.05)',
                                  border: '1px solid var(--border-glass)',
                                  color: 'var(--text-primary)',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  outline: 'none'
                                }}
                              >
                                <option value="" style={{ background: '#18181b', color: '#fff' }}>-- Chưa chọn ca --</option>
                                {shifts.map(s => (
                                  <option key={s.id} value={s.id} style={{ background: '#18181b', color: '#fff' }}>
                                    {s.name} ({s.startTime} - {s.endTime})
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              /* Staff view: Read-only assigned shift info */
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px', alignItems: 'start' }}>
                {/* Left Panel: Assigned Shift info */}
                <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-glass-card)', background: 'var(--bg-glass-card)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontFamily: 'var(--font-title)' }}>
                    <Clock size={18} />
                    <span>Lịch làm việc của tôi</span>
                  </h3>
                  
                  {(() => {
                    const myActiveShiftId = weeklyMemberShifts[currentUserId]?.[currentWeekMondayStr] || weeklyShifts[currentWeekMondayStr] || '';
                    const myActiveShift = shifts.find(s => s.id === myActiveShiftId);
                    
                    return myActiveShift ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(16, 185, 129, 0.04)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: '#34d399', fontWeight: 'bold' }}>Đang hoạt động trong tuần</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{currentWeekMondayStr}</span>
                        </div>
                        <div>
                          <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>
                            {myActiveShift.name}
                          </div>
                          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                            Thời gian: <strong style={{ color: 'var(--primary)' }}>{myActiveShift.startTime} - {myActiveShift.endTime}</strong>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-glass)', borderRadius: '12px' }}>
                        Bạn chưa được xếp ca làm việc nào cho tuần này. Vui lòng liên hệ Trưởng nhóm (Manager) của bạn.
                      </div>
                    );
                  })()}
                </div>

                {/* Right Panel: Shift directory */}
                <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-glass-card)', background: 'var(--bg-glass-card)' }}>
                  <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontFamily: 'var(--font-title)' }}>
                    <Users size={18} />
                    <span>Danh sách các ca làm việc của công ty</span>
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {shifts.length > 0 ? (
                      shifts.map(s => (
                        <div 
                          key={s.id} 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            background: 'rgba(255,255,255,0.01)', 
                            border: '1px solid rgba(255,255,255,0.03)', 
                            borderRadius: '8px', 
                            padding: '12px 16px' 
                          }}
                        >
                          <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{s.name}</span>
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{s.startTime} - {s.endTime}</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                        Chưa có ca làm việc nào được cấu hình trên hệ thống.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : teamSubTab === 'bot-notifications' && userPlan !== 'free' && isManager ? (
          /* Render Bot notifications Tab */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border-glass-card)', background: 'var(--bg-glass-card)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Database size={20} style={{ color: 'var(--primary)' }} />
                Cấu hình Bot thông báo hội nhóm (Telegram / Discord)
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 20px 0' }}>
                Liên kết ZenBoard với nhóm trò chuyện của bạn để tự động gửi thông báo khi có công việc mới được tạo, hoàn thành hoặc chuyển giao giữa các thành viên.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                {/* Form Config */}
                <div className="glass" style={{ padding: '20px', border: '1px solid var(--border-glass)', borderRadius: '12px', background: 'rgba(0,0,0,0.1)' }}>
                  <h3 className="chart-header" style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Cài đặt Kết nối</h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Enabled Toggle */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={botConfig.enabled}
                        onChange={(e) => setBotConfig({ ...botConfig, enabled: e.target.checked })}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '13.5px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Kích hoạt gửi thông báo tự động</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Bật để bắt đầu gửi thông báo khi có sự kiện</span>
                      </div>
                    </label>

                    {/* Platform selection */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Nền tảng nhắn tin:</label>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          type="button"
                          className={`btn ${botConfig.platform === 'discord' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1, padding: '10px', justifyContent: 'center' }}
                          onClick={() => setBotConfig({ ...botConfig, platform: 'discord' })}
                        >
                          Discord Webhook
                        </button>
                        <button 
                          type="button"
                          className={`btn ${botConfig.platform === 'telegram' ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ flex: 1, padding: '10px', justifyContent: 'center' }}
                          onClick={() => setBotConfig({ ...botConfig, platform: 'telegram' })}
                        >
                          Telegram Bot
                        </button>
                      </div>
                    </div>

                    {/* Webhook URL Input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                        {botConfig.platform === 'discord' ? 'Discord Webhook URL:' : 'Telegram API URL / Webhook URL:'}
                      </label>
                      <input
                        type="text"
                        className="search-input"
                        style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
                        placeholder={botConfig.platform === 'discord' 
                          ? "https://discord.com/api/webhooks/..." 
                          : "https://api.telegram.org/bot<TOKEN>/sendMessage"
                        }
                        value={botConfig.webhookUrl}
                        onChange={(e) => setBotConfig({ ...botConfig, webhookUrl: e.target.value.trim() })}
                      />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {botConfig.platform === 'discord'
                          ? "Lấy URL này trong Cài đặt kênh Discord -> Tích hợp -> Webhooks."
                          : "URL API gửi tin nhắn của Telegram Bot."
                        }
                      </span>
                    </div>

                    {/* Chat ID Input (Telegram only) */}
                    {botConfig.platform === 'telegram' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Chat ID (Telegram):</label>
                        <input
                          type="text"
                          className="search-input"
                          style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
                          placeholder="-100xxxxxxxxx"
                          value={botConfig.chatId || ''}
                          onChange={(e) => setBotConfig({ ...botConfig, chatId: e.target.value.trim() })}
                        />
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          ID của nhóm trò chuyện Telegram nhận thông báo (ví dụ: số bắt đầu bằng dấu trừ).
                        </span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                      <button 
                        type="button" 
                        className="btn btn-primary"
                        style={{ flex: 1, padding: '10px', justifyContent: 'center' }}
                        onClick={handleSaveBotConfig}
                      >
                        Lưu cấu hình
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        style={{ padding: '10px', width: '120px', justifyContent: 'center' }}
                        onClick={handleTestBotConfig}
                        disabled={botTestStatus === 'sending'}
                      >
                        {botTestStatus === 'sending' ? 'Đang gửi...' : 'Gửi thử 🤖'}
                      </button>
                    </div>

                  </div>
                </div>

                {/* Guide Card */}
                <div className="glass" style={{ padding: '20px', border: '1px solid var(--border-glass)', borderRadius: '12px', background: 'rgba(0,0,0,0.1)' }}>
                  <h3 className="chart-header" style={{ marginBottom: '12.5px', fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Hướng dẫn tích hợp nhanh</h3>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '14px', lineHeight: 1.5 }}>
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>1. Hướng dẫn Discord Webhook:</strong>
                      <ol style={{ margin: '6px 0 0 16px', padding: 0 }}>
                        <li>Truy cập Server Discord của bạn.</li>
                        <li>Click chuột phải vào kênh muốn gửi &rarr; <strong>Chỉnh sửa kênh</strong> &rarr; <strong>Tích hợp</strong> &rarr; <strong>Webhooks</strong>.</li>
                        <li>Tạo Webhook mới, copy URL của nó dán vào ô bên trái.</li>
                      </ol>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-primary)' }}>2. Hướng dẫn Telegram Bot:</strong>
                      <ol style={{ margin: '6px 0 0 16px', padding: 0 }}>
                        <li>Chat với <strong>@BotFather</strong> trên Telegram để tạo Bot mới và lấy <strong>Bot Token</strong>.</li>
                        <li>Thêm Bot vừa tạo vào nhóm trò chuyện của bạn và set quyền Admin gửi tin nhắn cho Bot.</li>
                        <li>Lấy Chat ID của nhóm (chat với @raw_data_bot hoặc đưa link bot kiểm tra ID).</li>
                        <li>Nhập URL dạng: <code>https://api.telegram.org/bot&lt;TOKEN&gt;/sendMessage</code> và Chat ID tương ứng để kết nối.</li>
                      </ol>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* Render Overview */
        <div style={{ display: 'grid', gridTemplateColumns: userPlan === 'free' ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px', alignItems: 'flex-start' }}>
          
          {/* Left column: Invite teammates & My team */}
          {userPlan !== 'free' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              
              {/* Invite form */}
              <div className="glass-panel" style={{ 
                padding: '24px', 
                borderRadius: '16px', 
                border: '1px solid var(--border-glass-card)',
                background: 'var(--bg-glass-card)',
                boxShadow: 'var(--shadow-sm)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)'
              }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}>
                  <UserPlus size={18} style={{ color: 'var(--primary)' }} />
                  <span>Mời thành viên mới</span>
                </h3>
                
                <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                      Tên đăng nhập (Username) trên hệ thống:
                    </label>
                    <input
                      type="text"
                      placeholder="Nhập chính xác Username..."
                      className="search-input"
                      style={{ width: '100%', padding: '10px 14px', paddingLeft: '14px', fontSize: '13.5px' }}
                      value={inviteUsername}
                      onChange={(e) => setInviteUsername(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={inviteLoading || !inviteUsername.trim()}
                    style={{ alignSelf: 'flex-start', padding: '10px 20px', fontSize: '13px' }}
                  >
                    {inviteLoading ? 'Đang gửi mời...' : 'Mời vào nhóm'}
                  </button>
                </form>
              </div>

              {/* Members list */}
              <div className="glass-panel" style={{ 
                padding: '24px', 
                borderRadius: '16px', 
                border: '1px solid var(--border-glass-card)', 
                background: 'var(--bg-glass-card)',
                boxShadow: 'var(--shadow-sm)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{ display: 'flex', justifycontent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}>
                    <Users size={18} style={{ color: 'var(--primary)' }} />
                    <span>{myTeamName ? `Đội nhóm của tôi: ${myTeamName}` : 'Đội nhóm của tôi'} ({myMembers.length})</span>
                  </h3>
                  <button 
                    onClick={fetchTeamData} 
                    disabled={loading}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px' }}
                    className="category-node-action-btn"
                    title="Làm mới"
                  >
                    <RefreshCw size={14} className={loading ? 'spin' : ''} />
                  </button>
                </div>

                {myMembers.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-glass)', borderRadius: '12px' }}>
                    Chưa có thành viên nào trong nhóm của bạn. Hãy điền Username bên trên để kết nối và bắt đầu chia sẻ công việc!
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {myMembers.map(m => (
                      <div key={m.id} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.04)',
                        background: 'rgba(255, 255, 255, 0.015)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--primary) 0%, #a855f7 100%)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '700',
                            fontSize: '14px',
                            textTransform: 'uppercase',
                            flexShrink: 0
                          }}>
                            {m.username.charAt(0)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{m.username}</span>
                              {m.status === 'pending' && (
                                <span style={{ 
                                  color: 'var(--warning)', 
                                  fontSize: '10px', 
                                  background: 'var(--warning-light)', 
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontWeight: '700'
                                }}>
                                  CHỜ DUYỆT
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              <span>Vai trò:</span>
                              <select
                                value={m.role || (teamRoles.length > 0 ? teamRoles[0].roleKey : 'StaffVH')}
                                onChange={(e) => handleUpdateRole(m.id, e.target.value)}
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '11.5px',
                                  borderRadius: '6px',
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
                        </div>
                        <button
                          className="btn"
                          onClick={() => handleRemoveMember(m.id, m.username)}
                          style={{ 
                            padding: '8px', 
                            color: 'var(--danger)', 
                            background: 'var(--danger-light)',
                            border: '1px solid transparent',
                            borderRadius: '8px'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
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

          {/* Right column: Joined teams */}
          <div className="glass-panel" style={{ 
            padding: '24px', 
            borderRadius: '16px', 
            border: '1px solid var(--border-glass-card)',
            background: 'var(--bg-glass-card)',
            boxShadow: 'var(--shadow-sm)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)', fontFamily: 'var(--font-title)' }}>
              <ArrowLeftRight size={18} style={{ color: 'var(--primary)' }} />
              <span>Đội nhóm đã tham gia ({joinedTeams.length})</span>
            </h3>

            {joinedTeams.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-glass)', borderRadius: '12px' }}>
                Bạn chưa tham gia đội nhóm nào khác. Khi trưởng nhóm khác mời bạn bằng Username, nhóm của họ sẽ xuất hiện tại đây để bạn cùng cộng tác.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {joinedTeams.map(t => {
                  return (
                    <div key={t.ownerId} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                      background: 'rgba(255, 255, 255, 0.015)'
                    }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #a855f7 0%, #10b981 100%)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '14px',
                        textTransform: 'uppercase',
                        flexShrink: 0
                      }}>
                        {t.ownerUsername.charAt(0)}
                      </div>
                      <div style={{ minWidth: 0, flexGrow: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                          Trưởng nhóm: {t.ownerUsername} {t.teamName && <span style={{ color: 'var(--primary)', fontWeight: 'normal', fontSize: '13px' }}>({t.teamName})</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
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
      )}
    </div>
  );
}
