import React, { useState, useMemo } from 'react';
import { 
  BarChart2, 
  CheckCircle2, 
  AlertTriangle, 
  ListTodo, 
  Award, 
  Calendar, 
  Users, 
  Clock, 
  Tag, 
  Activity,
  Briefcase,
  TrendingUp,
  HelpCircle,
  Cloud,
  Database,
  RefreshCw,
  ExternalLink,
  Settings
} from 'lucide-react';

export default function Dashboard({ 
  columns = [], 
  partnerColumns = [], 
  cards = [], 
  categories = [], 
  checkIsCardPartner,
  activeSubTab = 'tasks',
  setActiveSubTab,
  googleSheetUrl = '',
  setGoogleSheetUrl,
  googleSheetDisplayUrl = '',
  setGoogleSheetDisplayUrl,
  isAutoSyncEnabled = false,
  setIsAutoSyncEnabled,
  syncStatus = 'idle',
  lastSyncTime = '',
  syncErrorMessage = '',
  onSyncNow
}) {
  const [timePeriod, setTimePeriod] = useState('all'); // 'all', 'day', 'week', 'month'

  // 1. Differentiate cards
  const taskCards = useMemo(() => cards.filter(c => !checkIsCardPartner(c)), [cards, checkIsCardPartner]);
  const partnerCards = useMemo(() => cards.filter(c => checkIsCardPartner(c)), [cards, checkIsCardPartner]);

  const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  };

  // 2. Date ranges in local time
  const getTodayRangeString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getWeekRange = () => {
    const now = new Date();
    const currentDay = now.getDay();
    // distance to Monday: if Sunday (0) it's -6, otherwise 1 - currentDay
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { monday, sunday };
  };

  const getMonthRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { firstDay, lastDay };
  };

  const todayStr = getTodayRangeString();
  const { monday, sunday } = getWeekRange();
  const { firstDay, lastDay } = getMonthRange();

  // 3. Filter Task Cards by Period
  const filteredTaskCards = useMemo(() => {
    return taskCards.filter(card => {
      if (timePeriod === 'all') return true;
      if (!card.dueDate) return false;
      
      if (timePeriod === 'day') {
        return card.dueDate === todayStr;
      }
      
      const due = parseLocalDate(card.dueDate);
      if (!due) return false;
      
      if (timePeriod === 'week') {
        return due >= monday && due <= sunday;
      } else if (timePeriod === 'month') {
        return due >= firstDay && due <= lastDay;
      }
      return true;
    });
  }, [taskCards, timePeriod, todayStr, monday, sunday, firstDay, lastDay]);

  // 4. Task KPIs
  const completedTaskIds = useMemo(() => columns.find(col => col.id === 'col-4')?.cardIds || [], [columns]);
  
  const totalTaskCount = filteredTaskCards.length;
  const completedTaskCount = filteredTaskCards.filter(c => completedTaskIds.includes(c.id)).length;
  const activeTaskCount = totalTaskCount - completedTaskCount;

  const todayDateObj = new Date();
  todayDateObj.setHours(0, 0, 0, 0);
  const overdueTaskCount = filteredTaskCards.filter(c => {
    if (!c.dueDate) return false;
    if (completedTaskIds.includes(c.id)) return false;
    const due = parseLocalDate(c.dueDate);
    return due ? due < todayDateObj : false;
  }).length;

  const taskCompletionRate = totalTaskCount > 0 ? Math.round((completedTaskCount / totalTaskCount) * 100) : 0;

  // 5. Task Categories Stats
  const categoryStats = useMemo(() => {
    const stats = {};
    filteredTaskCards.forEach(card => {
      const catId = card.categoryId || 'uncategorized';
      let catName = 'Chưa phân loại';
      if (catId !== 'uncategorized') {
        const cat = categories.find(c => c.id === catId);
        if (cat) catName = cat.name;
      }
      stats[catName] = (stats[catName] || 0) + 1;
    });
    return Object.entries(stats).map(([name, count]) => ({ name, count }));
  }, [filteredTaskCards, categories]);

  // 6. Task Priority Stats
  const priorityStats = useMemo(() => {
    const stats = { high: 0, medium: 0, low: 0 };
    filteredTaskCards.forEach(card => {
      if (card.tags.includes('high')) stats.high++;
      else if (card.tags.includes('medium')) stats.medium++;
      else stats.low++;
    });
    return stats;
  }, [filteredTaskCards]);

  // 7. Partner KPIs
  const totalPartnerCount = partnerCards.length;
  const partnerStatusStats = useMemo(() => {
    const statusMap = {
      strategic: { title: 'Đối tác chiến lược 🌟', count: 0, color: '#ec4899' },
      potential: { title: 'Đối tác tiềm năng 📞', count: 0, color: '#a855f7' },
      active: { title: 'Hợp tác chính thức 🤝', count: 0, color: '#3b82f6' },
      archive: { title: 'Tạm dừng / Lưu trữ 📁', count: 0, color: '#10b981' }
    };
    
    // Status defined by columns
    partnerColumns.forEach(col => {
      const count = col.cardIds.length;
      if (col.id === 'part-col-1') statusMap.strategic.count = count;
      else if (col.id === 'part-col-2') statusMap.potential.count = count;
      else if (col.id === 'part-col-3') statusMap.active.count = count;
      else if (col.id === 'part-col-4') statusMap.archive.count = count;
    });

    return Object.values(statusMap);
  }, [partnerColumns]);

  const strategicPartnerCount = partnerCards.filter(c => c.tags.includes('strategic')).length;
  const activePartnerCount = partnerColumns.find(c => c.id === 'part-col-3')?.cardIds.length || 0;

  // 8. Partner Tag/Type Stats
  const partnerTagStats = useMemo(() => {
    const tagLabels = {
      strategic: 'Chiến lược 🌟',
      potential: 'Tiềm năng 💫',
      active: 'Đang hợp tác 🤝',
      media: 'Truyền thông 📣',
      tech: 'Công nghệ ⚡',
      service: 'Dịch vụ 💼'
    };
    const stats = {};
    partnerCards.forEach(card => {
      if (card.tags && card.tags.length > 0) {
        card.tags.forEach(t => {
          const label = tagLabels[t] || t;
          stats[label] = (stats[label] || 0) + 1;
        });
      } else {
        stats['Khác'] = (stats['Khác'] || 0) + 1;
      }
    });
    return Object.entries(stats).map(([name, count]) => ({ name, count }));
  }, [partnerCards]);

  // 9. Partner Activities timeline
  const partnerRecentActivities = useMemo(() => {
    const acts = [];
    partnerCards.forEach(card => {
      if (card.activities) {
        card.activities.forEach(act => {
          acts.push({
            partnerName: card.title,
            ...act
          });
        });
      }
    });
    return acts.sort((a, b) => b.id.localeCompare(a.id)).slice(0, 5);
  }, [partnerCards]);

  // SVG circular progress details
  const radius = 65;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (taskCompletionRate / 100) * circumference;

  return (
    <div className="dashboard-view">

      {/* Task Statistics Section */}
      {activeSubTab === 'tasks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Time period filter toolbar */}
          <div className="period-toolbar glass">
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
              Bộ lọc thời gian:
            </span>
            <div className="period-btn-group">
              <button 
                className={`period-btn ${timePeriod === 'all' ? 'active' : ''}`}
                onClick={() => setTimePeriod('all')}
              >
                Tất cả thời gian
              </button>
              <button 
                className={`period-btn ${timePeriod === 'day' ? 'active' : ''}`}
                onClick={() => setTimePeriod('day')}
              >
                Hôm nay
              </button>
              <button 
                className={`period-btn ${timePeriod === 'week' ? 'active' : ''}`}
                onClick={() => setTimePeriod('week')}
              >
                Tuần này
              </button>
              <button 
                className={`period-btn ${timePeriod === 'month' ? 'active' : ''}`}
                onClick={() => setTimePeriod('month')}
              >
                Tháng này
              </button>
            </div>
            {timePeriod !== 'all' && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {timePeriod === 'day' && `Ngày: ${todayStr.split('-').reverse().join('/')}`}
                {timePeriod === 'week' && `Từ ${monday.toLocaleDateString('vi-VN')} đến ${sunday.toLocaleDateString('vi-VN')}`}
                {timePeriod === 'month' && `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`}
              </span>
            )}
          </div>

          {/* KPIs Block */}
          <div className="dashboard-grid">
            <div className="stat-card glass">
              <div className="stat-info">
                <span className="stat-label">Tổng tác vụ</span>
                <span className="stat-value">{totalTaskCount}</span>
              </div>
              <div className="stat-icon primary">
                <ListTodo size={22} />
              </div>
            </div>

            <div className="stat-card glass">
              <div className="stat-info">
                <span className="stat-label">Đang thực hiện</span>
                <span className="stat-value">{activeTaskCount}</span>
              </div>
              <div className="stat-icon warning">
                <TrendingUp size={22} />
              </div>
            </div>

            <div className="stat-card glass">
              <div className="stat-info">
                <span className="stat-label">Đã hoàn thành</span>
                <span className="stat-value">{completedTaskCount}</span>
              </div>
              <div className="stat-icon success">
                <CheckCircle2 size={22} />
              </div>
            </div>

            <div className="stat-card glass">
              <div className="stat-info">
                <span className="stat-label">Quá hạn chót</span>
                <span className="stat-value" style={{ color: overdueTaskCount > 0 ? 'var(--danger)' : 'inherit' }}>
                  {overdueTaskCount}
                </span>
              </div>
              <div className="stat-icon danger">
                <AlertTriangle size={22} />
              </div>
            </div>
          </div>

          {totalTaskCount > 0 ? (
            <>
              {/* Detailed charts */}
              <div className="dashboard-charts">
                {/* Circular Progress rate */}
                <div className="chart-card glass">
                  <h3 className="chart-header">Tỷ lệ hoàn thành công việc</h3>
                  <div className="chart-progress-container">
                    <div className="circular-progress">
                      <svg viewBox="0 0 160 160" width="100%" height="100%">
                        <circle className="bg-circle" cx="80" cy="80" r={radius} />
                        <circle
                          className="fg-circle"
                          cx="80"
                          cy="80"
                          r={radius}
                          style={{
                            strokeDasharray: circumference,
                            strokeDashoffset: strokeDashoffset
                          }}
                        />
                      </svg>
                      <div className="progress-text">{taskCompletionRate}%</div>
                    </div>
                    <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      {taskCompletionRate === 100 
                        ? 'Xuất sắc! Đã hoàn thành toàn bộ tác vụ của giai đoạn này 🎉' 
                        : `Hoàn tất ${completedTaskCount} / ${totalTaskCount} tác vụ.`}
                    </p>
                  </div>
                </div>

                {/* Column card distribution */}
                <div className="chart-card glass">
                  <h3 className="chart-header">Phân bổ theo trạng thái</h3>
                  <div className="bar-charts-list">
                    {columns.map(col => {
                      // Filter cards that are part of this period
                      const count = col.cardIds.filter(id => filteredTaskCards.some(fc => fc.id === id)).length;
                      const percent = totalTaskCount > 0 ? Math.round((count / totalTaskCount) * 100) : 0;
                      
                      return (
                        <div key={col.id} className="bar-chart-item">
                          <div className="bar-chart-info">
                            <span className="bar-chart-name">{col.title}</span>
                            <span className="bar-chart-val">{count} thẻ ({percent}%)</span>
                          </div>
                          <div className="bar-chart-track">
                            <div
                              className="bar-chart-fill"
                              style={{
                                width: `${percent}%`,
                                backgroundColor: col.color || 'var(--primary)'
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Extra breakdowns */}
              <div className="dashboard-charts">
                {/* Distribution by Category */}
                <div className="chart-card glass" style={{ flexGrow: 1 }}>
                  <h3 className="chart-header">Phân bổ theo Danh mục</h3>
                  <div className="bar-charts-list">
                    {categoryStats.length > 0 ? (
                      categoryStats.map(stat => {
                        const percent = totalTaskCount > 0 ? Math.round((stat.count / totalTaskCount) * 100) : 0;
                        return (
                          <div key={stat.name} className="bar-chart-item">
                            <div className="bar-chart-info">
                              <span className="bar-chart-name">{stat.name}</span>
                              <span className="bar-chart-val">{stat.count} thẻ ({percent}%)</span>
                            </div>
                            <div className="bar-chart-track">
                              <div
                                className="bar-chart-fill"
                                style={{
                                  width: `${percent}%`,
                                  backgroundColor: 'var(--primary)'
                                }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="empty-sub-chart">Không có phân loại danh mục.</div>
                    )}
                  </div>
                </div>

                {/* Distribution by Priority */}
                <div className="chart-card glass" style={{ flexGrow: 1 }}>
                  <h3 className="chart-header">Phân bổ theo Mức độ ưu tiên</h3>
                  <div className="priority-stats-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', height: '100%', alignItems: 'center' }}>
                    <div className="priority-mini-card danger">
                      <span className="p-label">Khẩn cấp</span>
                      <span className="p-value">{priorityStats.high}</span>
                    </div>
                    <div className="priority-mini-card warning">
                      <span className="p-label">Quan trọng</span>
                      <span className="p-value">{priorityStats.medium}</span>
                    </div>
                    <div className="priority-mini-card success">
                      <span className="p-label">Bình thường</span>
                      <span className="p-value">{priorityStats.low}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Task list for this period */}
              <div className="chart-card glass" style={{ width: '100%' }}>
                <h3 className="chart-header">Chi tiết tác vụ trong kỳ báo cáo</h3>
                <div className="dashboard-table-wrapper">
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Tên công việc</th>
                        <th>Trạng thái</th>
                        <th>Thời lượng</th>
                        <th>Hạn chót</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTaskCards.map(card => {
                        const statusCol = columns.find(c => c.cardIds.includes(card.id));
                        return (
                          <tr key={card.id}>
                            <td className="task-cell-title">{card.title}</td>
                            <td>
                              <span 
                                className="col-status-pill"
                                style={{ backgroundColor: `${statusCol?.color || 'var(--primary)'}15`, color: statusCol?.color || 'var(--primary)', borderColor: statusCol?.color }}
                              >
                                {statusCol?.title || 'Không rõ'}
                              </span>
                            </td>
                            <td>{card.estimatedDuration ? `${card.estimatedDuration} phút` : 'Chưa nhập'}</td>
                            <td style={{ color: card.dueDate && new Date(card.dueDate) < todayDateObj && !completedTaskIds.includes(card.id) ? '#ef4444' : 'inherit' }}>
                              {card.dueDate ? card.dueDate.split('-').reverse().join('/') : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="glass empty-state" style={{ marginTop: '20px' }}>
              <div className="empty-state-icon">
                <Award size={32} />
              </div>
              <h3>Không tìm thấy tác vụ</h3>
              <p>Không có tác vụ nào khớp với bộ lọc thời gian đã chọn ({timePeriod === 'day' ? 'Hôm nay' : timePeriod === 'week' ? 'Tuần này' : 'Tháng này'}).</p>
            </div>
          )}
        </div>
      )}

      {/* Partner Statistics Section */}
      {activeSubTab === 'partners' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Partner KPIs */}
          <div className="dashboard-grid partner-grid">
            <div className="stat-card glass">
              <div className="stat-info">
                <span className="stat-label">Tổng đối tác</span>
                <span className="stat-value">{totalPartnerCount}</span>
              </div>
              <div className="stat-icon primary">
                <Users size={22} />
              </div>
            </div>

            <div className="stat-card glass">
              <div className="stat-info">
                <span className="stat-label">Đối tác chiến lược</span>
                <span className="stat-value">{strategicPartnerCount}</span>
              </div>
              <div className="stat-icon danger">
                <Award size={22} style={{ color: '#ec4899' }} />
              </div>
            </div>

            <div className="stat-card glass">
              <div className="stat-info">
                <span className="stat-label">Hợp tác chính thức</span>
                <span className="stat-value">{activePartnerCount}</span>
              </div>
              <div className="stat-icon success">
                <CheckCircle2 size={22} style={{ color: '#10b981' }} />
              </div>
            </div>
          </div>

          {totalPartnerCount > 0 ? (
            <>
              {/* Partner breakdowns */}
              <div className="dashboard-charts">
                {/* Column/Status distribution */}
                <div className="chart-card glass" style={{ flexGrow: 1 }}>
                  <h3 className="chart-header">Phân bổ đối tác theo Trạng thái</h3>
                  <div className="bar-charts-list">
                    {partnerStatusStats.map(status => {
                      const percent = totalPartnerCount > 0 ? Math.round((status.count / totalPartnerCount) * 100) : 0;
                      return (
                        <div key={status.title} className="bar-chart-item">
                          <div className="bar-chart-info">
                            <span className="bar-chart-name">{status.title}</span>
                            <span className="bar-chart-val">{status.count} đối tác ({percent}%)</span>
                          </div>
                          <div className="bar-chart-track">
                            <div
                              className="bar-chart-fill"
                              style={{
                                width: `${percent}%`,
                                backgroundColor: status.color
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Distribution by tags/types */}
                <div className="chart-card glass" style={{ flexGrow: 1 }}>
                  <h3 className="chart-header">Phân loại theo Nhãn Đối tác</h3>
                  <div className="bar-charts-list">
                    {partnerTagStats.length > 0 ? (
                      partnerTagStats.map(stat => {
                        const percent = totalPartnerCount > 0 ? Math.round((stat.count / totalPartnerCount) * 100) : 0;
                        return (
                          <div key={stat.name} className="bar-chart-item">
                            <div className="bar-chart-info">
                              <span className="bar-chart-name">{stat.name}</span>
                              <span className="bar-chart-val">{stat.count} đối tác ({percent}%)</span>
                            </div>
                            <div className="bar-chart-track">
                              <div
                                className="bar-chart-fill"
                                style={{
                                  width: `${percent}%`,
                                  backgroundColor: '#8b5cf6'
                                }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="empty-sub-chart">Không có phân loại nhãn.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Partner Activities and Partner List */}
              <div className="dashboard-charts">
                {/* Recent Activities list */}
                <div className="chart-card glass" style={{ flexGrow: 1, minWidth: '320px' }}>
                  <h3 className="chart-header">
                    <Activity size={16} style={{ marginRight: '6px', color: 'var(--primary)' }} />
                    Lịch sử hoạt động gần đây với Đối tác
                  </h3>
                  <div className="dashboard-activity-timeline">
                    {partnerRecentActivities.length > 0 ? (
                      partnerRecentActivities.map(act => (
                        <div key={act.id} className="timeline-log-item">
                          <div className="timeline-log-bullet" />
                          <div className="timeline-log-content">
                            <div className="timeline-log-time">
                              <Clock size={11} style={{ marginRight: '3px' }} />
                              <span>{act.timestamp}</span>
                            </div>
                            <p className="timeline-log-text">
                              <strong style={{ color: 'var(--text-primary)' }}>{act.partnerName}</strong>: {act.text}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-sub-chart" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <Clock size={20} style={{ opacity: 0.4 }} />
                        <span>Chưa ghi nhận hoạt động nào gần đây với đối tác.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Partner directory */}
                <div className="chart-card glass" style={{ flexGrow: 1.5, minWidth: '400px' }}>
                  <h3 className="chart-header">Danh bạ Đối tác</h3>
                  <div className="dashboard-table-wrapper" style={{ maxHeight: '315px' }}>
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Tên đối tác</th>
                          <th>Trạng thái</th>
                          <th>Hạn hợp đồng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {partnerCards.map(partner => {
                          const statusCol = partnerColumns.find(c => c.cardIds.includes(partner.id));
                          return (
                            <tr key={partner.id}>
                              <td className="task-cell-title" style={{ fontWeight: 'bold' }}>{partner.title}</td>
                              <td>
                                <span 
                                  className="col-status-pill"
                                  style={{ backgroundColor: `${statusCol?.color || 'var(--primary)'}15`, color: statusCol?.color || 'var(--primary)', borderColor: statusCol?.color }}
                                >
                                  {statusCol?.title?.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '') || 'Chưa rõ'}
                                </span>
                              </td>
                              <td style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                                {partner.dueDate ? partner.dueDate.split('-').reverse().join('/') : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="glass empty-state" style={{ marginTop: '20px' }}>
              <div className="empty-state-icon">
                <Users size={32} />
              </div>
              <h3>Chưa có đối tác nào</h3>
              <p>Hãy khởi tạo các đối tác trong bảng Đối tác để theo dõi thống kê tình hình hợp tác của doanh nghiệp.</p>
            </div>
          )}
        </div>
      )}

      {/* Google Sheets Sync Section */}
      {activeSubTab === 'sheets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section Header */}
          <div className="period-toolbar glass" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px', padding: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: 'var(--text-primary)' }}>
              <Cloud size={22} style={{ color: 'var(--primary)' }} />
              Tích hợp & Đồng bộ Google Sheets 📊
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              Giải pháp này đồng bộ tự động dữ liệu ZenBoard của bạn sang Google Sheets thời gian thực.
              Toàn bộ dữ liệu thô được ghi đè vào tab <strong>Database</strong>. Tab <strong>Báo cáo Tổng quan</strong> sử dụng các hàm logic 
              <code>QUERY</code>, <code>COUNTIFS</code>, <code>SUMIFS</code> để tự động lọc dữ liệu báo cáo theo tuần và phòng ban dựa trên menu chọn động.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '20px', alignItems: 'start' }}>
            
            {/* Left Column: Settings and Setup */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Settings Card */}
              <div className="chart-card glass" style={{ padding: '20px' }}>
                <h3 className="chart-header" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                  <Settings size={16} />
                  Cấu hình kết nối
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Web App URL input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                      Google Apps Script Web App URL:
                    </label>
                    <input
                      type="text"
                      className="search-input"
                      style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value.trim())}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      URL này nhận được sau khi Triển khai dưới dạng Ứng dụng web trong Apps Script.
                    </span>
                  </div>

                  {/* Google Sheet URL (for preview) input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                      Đường dẫn Google Sheet (để xem trực tiếp):
                    </label>
                    <input
                      type="text"
                      className="search-input"
                      style={{ width: '100%', padding: '10px 12px', fontSize: '13px' }}
                      placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                      value={googleSheetDisplayUrl}
                      onChange={(e) => setGoogleSheetDisplayUrl(e.target.value.trim())}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Dán link bảng tính để nhúng khung xem trước trực tiếp ở bên phải.
                    </span>
                  </div>

                  {/* Auto sync switch and manual button */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border-glass)', borderBottom: '1px solid var(--border-glass)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={isAutoSyncEnabled}
                        onChange={(e) => setIsAutoSyncEnabled(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-primary)' }}>Tự động đồng bộ Realtime</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mọi thay đổi trên ZenBoard sẽ tự động lưu lên Sheet sau 2s</span>
                      </div>
                    </label>
                  </div>

                  {/* Sync status & Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Trạng thái đồng bộ:</span>
                      <span 
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 'bold',
                          color: syncStatus === 'synced' ? 'var(--success)' : syncStatus === 'syncing' ? 'var(--warning)' : syncStatus === 'error' ? 'var(--danger)' : 'var(--text-muted)'
                        }}
                      >
                        {syncStatus === 'synced' && `Đã đồng bộ (${lastSyncTime})`}
                        {syncStatus === 'syncing' && 'Đang đồng bộ ngầm...'}
                        {syncStatus === 'error' && 'Lỗi kết nối ⚠️'}
                        {syncStatus === 'idle' && 'Chưa bắt đầu'}
                      </span>
                    </div>

                    {syncStatus === 'error' && syncErrorMessage && (
                      <div style={{ fontSize: '11.5px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.08)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        {syncErrorMessage}
                      </div>
                    )}

                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '10px', marginTop: '4px', justifyContent: 'center', gap: '8px' }}
                      onClick={onSyncNow}
                      disabled={syncStatus === 'syncing'}
                    >
                      <RefreshCw size={14} className={syncStatus === 'syncing' ? 'spin' : ''} />
                      <span>Đồng bộ thủ công ngay lập tức</span>
                    </button>
                  </div>

                </div>
              </div>

              {/* Instructions Card */}
              <div className="chart-card glass" style={{ padding: '20px' }}>
                <h3 className="chart-header" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                  <HelpCircle size={16} />
                  Hướng dẫn cài đặt nhanh (5 bước)
                </h3>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '12px', lineHeight: 1.5 }}>
                  <p style={{ margin: 0 }}>
                    1. Mở tệp <a href="file:///Users/devdo/Code/Mytask/google_apps_script.txt" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'underline' }}>google_apps_script.txt</a> tại thư mục dự án và copy toàn bộ mã script ở trong.
                  </p>
                  <p style={{ margin: 0 }}>
                    2. Tạo một Google Sheet mới của bạn &rarr; Chọn <strong>Tiện ích mở rộng</strong> &rarr; <strong>Apps Script</strong>.
                  </p>
                  <p style={{ margin: 0 }}>
                    3. Dán đoạn mã vừa copy vào, nhấn <strong>Lưu</strong> (Ctrl/Cmd + S).
                  </p>
                  <p style={{ margin: 0 }}>
                    4. Nhấn <strong>Triển khai</strong> &rarr; <strong>Triển khai mới</strong>. Chọn loại là <strong>Ứng dụng web</strong>.
                    <br />
                    Thiết lập: <em>Người thực thi là: Tôi</em> và <em>Ai có quyền truy cập: Bất kỳ ai</em>. Nhấn <strong>Triển khai</strong> và đồng ý các quyền bảo mật của Google.
                  </p>
                  <p style={{ margin: 0 }}>
                    5. Sao chép đường dẫn <strong>URL Ứng dụng web</strong> nhận được dán vào ô cấu hình phía trên. Dán link Google Sheet của bạn vào ô bên dưới để mở khung xem trước trực tiếp.
                  </p>
                </div>
              </div>

            </div>

            {/* Right Column: Spreadsheet Live Preview */}
            <div className="chart-card glass" style={{ padding: '20px', height: '100%', minHeight: '620px', display: 'flex', flexDirection: 'column' }}>
              <h3 className="chart-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Database size={16} />
                  Khung xem trực tiếp Google Sheets 📑
                </span>
                {googleSheetDisplayUrl && (
                  <a 
                    href={googleSheetDisplayUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)' }}
                  >
                    Mở tab mới
                    <ExternalLink size={10} />
                  </a>
                )}
              </h3>
              
              <div style={{ flexGrow: 1, position: 'relative', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', border: '1px solid var(--border-glass)', overflow: 'hidden', height: '540px' }}>
                {googleSheetDisplayUrl ? (
                  (() => {
                    const match = googleSheetDisplayUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
                    const sheetId = match ? match[1] : null;
                    if (sheetId) {
                      return (
                        <iframe
                          src={`https://docs.google.com/spreadsheets/d/${sheetId}/htmlview?widget=true&headers=false`}
                          style={{ width: '100%', height: '100%', border: 'none' }}
                          title="Google Sheet Live View"
                        />
                      );
                    } else {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          <AlertTriangle size={28} style={{ color: 'var(--warning)', marginBottom: '8px' }} />
                          <span>Đường dẫn Google Sheet không đúng định dạng. Cần chứa phần "/spreadsheets/d/ID_CỦA_SHEET".</span>
                        </div>
                      );
                    }
                  })()
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '20px', textAlign: 'center', color: 'var(--text-muted)', gap: '10px' }}>
                    <Cloud size={40} style={{ opacity: 0.2 }} />
                    <span style={{ fontSize: '13px' }}>Nhập đường dẫn Google Sheet của bạn ở ô cấu hình bên trái để hiển thị xem trước trực tiếp tại đây.</span>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
