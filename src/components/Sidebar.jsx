import React, { useState } from 'react';
import { 
  Folder, 
  FolderPlus, 
  Plus, 
  X, 
  Edit2, 
  Trash2, 
  ChevronRight, 
  ChevronDown,
  HelpCircle,
  Layers,
  Inbox,
  Briefcase,
  Users,
  Play,
  Pause,
  RotateCcw,
  CalendarDays,
  Brain,
  Timer,
  Activity,
  Cloud
} from 'lucide-react';

export default function Sidebar({
  categories = [],
  activeCategoryId,
  setActiveCategoryId,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  taskCounts = {}, // Map of categoryId -> taskCount
  isCollapsed = false,
  isPartnerBoard = false,
  activeTab = 'board',
  dashboardSubTab = 'tasks',
  setDashboardSubTab,
  plannerBacklogFilter = 'all',
  setPlannerBacklogFilter,
  plannerScheduleView = 'day',
  setPlannerScheduleView,
  autoInsertBreaks = true,
  setAutoInsertBreaks,
  pomodoroTimeLeft = 1500,
  setPomodoroTimeLeft,
  pomodoroIsRunning = false,
  setPomodoroIsRunning,
  pomodoroMode = 'work',
  setPomodoroMode,
  workdayDuration = 480,
  setWorkdayDuration
}) {
  const [isAddingRoot, setIsAddingRoot] = useState(false);
  const [rootTitle, setRootTitle] = useState('');
  
  // State for inline sub-category creation
  const [addingSubToId, setAddingSubToId] = useState(null);
  const [subTitle, setSubTitle] = useState('');

  // State for inline renaming
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');

  // Expand/collapse states for category tree
  const [collapsedIds, setCollapsedIds] = useState({});

  const toggleExpand = (id) => {
    setCollapsedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Recursive Category Item Renderer
  const CategoryNode = ({ category, level = 0 }) => {
    const isSelected = activeCategoryId === category.id;
    const isEditing = editingId === category.id;
    const isAddingSub = addingSubToId === category.id;
    
    // Find children
    const children = categories.filter(c => c.parentId === category.id);
    const isExpanded = !collapsedIds[category.id];
    const count = taskCounts[category.id] || 0;

    const handleSelect = (e) => {
      // Prevent selection trigger if clicking on input or action buttons
      if (e.target.closest('.category-node-actions') || e.target.closest('input') || e.target.closest('form')) {
        return;
      }
      setActiveCategoryId(category.id);
    };

    const handleRenameSubmit = (e) => {
      e.preventDefault();
      if (editTitle.trim() && editTitle.trim() !== category.name) {
        onUpdateCategory(category.id, editTitle.trim());
      }
      setEditingId(null);
    };

    const handleAddSubSubmit = (e) => {
      e.preventDefault();
      if (subTitle.trim()) {
        onAddCategory(subTitle.trim(), category.id);
        setSubTitle('');
        setAddingSubToId(null);
      }
    };

    return (
      <div className="category-node-container" style={{ marginLeft: level > 0 ? '12px' : '0' }}>
        {/* Category Item Row */}
        <div 
          className={`category-node-item ${isSelected ? 'active' : ''}`}
          onClick={handleSelect}
          style={{ paddingLeft: `${Math.max(8, level * 8)}px` }}
        >
          {isEditing ? (
            <form onSubmit={handleRenameSubmit} style={{ flexGrow: 1 }}>
              <input
                type="text"
                className="category-inline-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={handleRenameSubmit}
                autoFocus
              />
            </form>
          ) : (
            <>
              <div className="sidebar-item-content">
                {children.length > 0 ? (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(category.id);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '2px',
                      marginRight: '2px',
                      borderRadius: '4px'
                    }}
                    className="category-expand-btn"
                  >
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                ) : (
                  <div style={{ width: '16px' }} />
                )}
                <Folder size={15} style={{ opacity: 0.7 }} />
                <span className="sidebar-item-text" title={category.name}>{category.name}</span>
                {count > 0 && <span className="sidebar-badge">{count}</span>}
              </div>

              {/* Actions on hover */}
              <div className="category-node-actions">
                {/* Add Sub Category */}
                <button 
                  className="category-node-action-btn"
                  title="Thêm danh mục con"
                  onClick={() => {
                    setAddingSubToId(category.id);
                    setSubTitle('');
                  }}
                >
                  <Plus size={13} />
                </button>
                {/* Rename */}
                <button 
                  className="category-node-action-btn"
                  title="Đổi tên"
                  onClick={() => {
                    setEditingId(category.id);
                    setEditTitle(category.name);
                  }}
                >
                  <Edit2 size={12} />
                </button>
                {/* Delete */}
                <button 
                  className="category-node-action-btn danger-hover"
                  title="Xóa danh mục"
                  onClick={() => {
                    if (confirm(`Bạn chắc chắn muốn xóa danh mục "${category.name}"? Các danh mục con và thẻ sẽ được chuyển về "Chưa phân loại".`)) {
                      onDeleteCategory(category.id);
                    }
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Form to add sub-category */}
        {isAddingSub && (
          <form onSubmit={handleAddSubSubmit} className="category-sub-form">
            <input
              type="text"
              className="category-inline-input"
              placeholder="Tên danh mục con..."
              value={subTitle}
              onChange={(e) => setSubTitle(e.target.value)}
              autoFocus
              required
            />
            <button type="submit" className="category-node-action-btn" style={{ color: 'var(--success)' }}>
              <Plus size={14} />
            </button>
            <button 
              type="button" 
              className="category-node-action-btn" 
              onClick={() => setAddingSubToId(null)}
              style={{ color: 'var(--danger)' }}
            >
              <X size={14} />
            </button>
          </form>
        )}

        {/* Render child nodes */}
        {children.length > 0 && isExpanded && (
          <div style={{ borderLeft: '1px dashed var(--border-glass)', marginLeft: '8px', paddingLeft: '4px' }}>
            {children.map(child => (
              <CategoryNode key={child.id} category={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Add Root Category Submit
  const handleAddRootSubmit = (e) => {
    e.preventDefault();
    if (rootTitle.trim()) {
      onAddCategory(rootTitle.trim(), null);
      setRootTitle('');
      setIsAddingRoot(false);
    }
  };

  // Get Root Categories
  const rootCategories = categories.filter(c => !c.parentId);
  const isDashboard = activeTab === 'dashboard';
  const isPlanner = activeTab === 'planner';

  return (
    <aside className={`sidebar-container ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <span className="sidebar-title">
          {isDashboard 
            ? "Báo cáo thống kê" 
            : isPlanner 
            ? "Lập kế hoạch" 
            : isPartnerBoard 
            ? "Danh mục đối tác" 
            : "Danh mục công việc"}
        </span>
      </div>

      {isDashboard ? (
        /* Render Dashboard Navigation Options */
        <div className="sidebar-section-list">
          <div 
            className={`sidebar-item ${dashboardSubTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setDashboardSubTab('tasks')}
            style={{ cursor: 'pointer' }}
          >
            <div className="sidebar-item-content">
              <Briefcase size={16} />
              <span className="sidebar-item-text">Thống kê Công việc</span>
            </div>
          </div>

          <div 
            className={`sidebar-item ${dashboardSubTab === 'partners' ? 'active' : ''}`}
            onClick={() => setDashboardSubTab('partners')}
            style={{ cursor: 'pointer' }}
          >
            <div className="sidebar-item-content">
              <Users size={16} />
              <span className="sidebar-item-text">Báo cáo tình hình đối tác</span>
            </div>
          </div>

          <div 
            className={`sidebar-item ${dashboardSubTab === 'sheets' ? 'active' : ''}`}
            onClick={() => setDashboardSubTab('sheets')}
            style={{ cursor: 'pointer' }}
          >
            <div className="sidebar-item-content">
              <Cloud size={16} />
              <span className="sidebar-item-text">Đồng bộ Google Sheets</span>
            </div>
          </div>
        </div>
      ) : isPlanner ? (
        /* Render Planner Navigation Options, Filters, and Pomodoro Timer */
        <div className="sidebar-planner-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px 20px' }}>
          
          {/* Section 1: Schedule Views */}
          <div className="sidebar-planner-section">
            <span className="sidebar-section-title">GÓC NHÌN LỊCH TRÌNH 📅</span>
            <div className="sidebar-section-list" style={{ marginTop: '6px' }}>
              <div 
                className={`sidebar-item ${plannerScheduleView === 'day' ? 'active' : ''}`}
                onClick={() => setPlannerScheduleView('day')}
                style={{ cursor: 'pointer' }}
              >
                <div className="sidebar-item-content">
                  <CalendarDays size={15} />
                  <span className="sidebar-item-text">Kế hoạch Hôm nay</span>
                </div>
              </div>
              <div 
                className={`sidebar-item ${plannerScheduleView === 'week' ? 'active' : ''}`}
                onClick={() => setPlannerScheduleView('week')}
                style={{ cursor: 'pointer' }}
              >
                <div className="sidebar-item-content">
                  <CalendarDays size={15} style={{ color: '#db2777' }} />
                  <span className="sidebar-item-text">Kế hoạch Tuần này</span>
                </div>
              </div>
              <div 
                className={`sidebar-item ${plannerScheduleView === 'month' ? 'active' : ''}`}
                onClick={() => setPlannerScheduleView('month')}
                style={{ cursor: 'pointer' }}
              >
                <div className="sidebar-item-content">
                  <CalendarDays size={15} style={{ color: '#a855f7' }} />
                  <span className="sidebar-item-text">Hạn chót Tháng này</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Backlog Filters */}
          <div className="sidebar-planner-section">
            <span className="sidebar-section-title">LỌC CÔNG VIỆC CHƯA LÀM 📋</span>
            <div className="sidebar-section-list" style={{ marginTop: '6px' }}>
              <div 
                className={`sidebar-item ${plannerBacklogFilter === 'all' ? 'active' : ''}`}
                onClick={() => setPlannerBacklogFilter('all')}
                style={{ cursor: 'pointer' }}
              >
                <div className="sidebar-item-content">
                  <Layers size={15} />
                  <span className="sidebar-item-text">Tất cả việc tồn đọng</span>
                </div>
              </div>
              <div 
                className={`sidebar-item ${plannerBacklogFilter === 'urgent' ? 'active' : ''}`}
                onClick={() => setPlannerBacklogFilter('urgent')}
                style={{ cursor: 'pointer' }}
              >
                <div className="sidebar-item-content">
                  <Activity size={15} style={{ color: '#ef4444' }} />
                  <span className="sidebar-item-text">Khẩn cấp & Quá hạn</span>
                </div>
              </div>
              <div 
                className={`sidebar-item ${plannerBacklogFilter === 'no-due' ? 'active' : ''}`}
                onClick={() => setPlannerBacklogFilter('no-due')}
                style={{ cursor: 'pointer' }}
              >
                <div className="sidebar-item-content">
                  <Timer size={15} style={{ color: '#0284c7' }} />
                  <span className="sidebar-item-text">Chưa có hạn chót</span>
                </div>
              </div>
              <div 
                className={`sidebar-item ${plannerBacklogFilter === 'short' ? 'active' : ''}`}
                onClick={() => setPlannerBacklogFilter('short')}
                style={{ cursor: 'pointer' }}
              >
                <div className="sidebar-item-content">
                  <Plus size={15} style={{ color: '#16a34a' }} />
                  <span className="sidebar-item-text">Tác vụ ngắn (≤ 30 phút)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Productivity Settings */}
          <div className="sidebar-planner-section glass-panel" style={{ padding: '10px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)' }}>
            <span className="sidebar-section-title">THIẾT LẬP NĂNG SUẤT ⚙️</span>
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              {/* Duration Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                  <span>Quỹ giờ làm việc:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {Math.floor(workdayDuration / 60)}g {workdayDuration % 60 ? `${workdayDuration % 60}p` : ''}
                  </strong>
                </div>
                <input
                  type="range"
                  min="240"
                  max="720"
                  step="30"
                  value={workdayDuration}
                  onChange={(e) => setWorkdayDuration(parseInt(e.target.value, 10))}
                  style={{ width: '100%', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
              </div>

              {/* Breaks Checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '11.5px', color: 'var(--text-secondary)', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={autoInsertBreaks}
                  onChange={(e) => setAutoInsertBreaks(e.target.checked)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <span>Tự động chèn giờ giải lao</span>
              </label>
            </div>
          </div>

          {/* Section 4: Pomodoro Widget */}
          <div className="sidebar-planner-section pomodoro-widget-container">
            <span className="sidebar-section-title">ĐỒNG HỒ TẬP TRUNG (POMODORO) ⏱️</span>
            <div className="pomodoro-timer-card">
              <div className="pomodoro-time-display">
                {(() => {
                  const mins = Math.floor(pomodoroTimeLeft / 60);
                  const secs = pomodoroTimeLeft % 60;
                  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                })()}
              </div>
              <div className="pomodoro-mode-badge" style={{
                color: pomodoroMode === 'work' ? '#f43f5e' : '#10b981',
                borderColor: pomodoroMode === 'work' ? '#f43f5e30' : '#10b98130',
                backgroundColor: pomodoroMode === 'work' ? '#f43f5e10' : '#10b98110'
              }}>
                {pomodoroMode === 'work' ? 'Đang tập trung 🎯' : pomodoroMode === 'short' ? 'Giải lao ngắn ☕' : 'Giải lao dài 🧘'}
              </div>

              <div className="pomodoro-mode-toggles">
                <button 
                  className={`pomodoro-mode-btn ${pomodoroMode === 'work' ? 'active' : ''}`}
                  onClick={() => {
                    setPomodoroIsRunning(false);
                    setPomodoroMode('work');
                    setPomodoroTimeLeft(1500); // 25 min
                  }}
                >
                  Pomo
                </button>
                <button 
                  className={`pomodoro-mode-btn ${pomodoroMode === 'short' ? 'active' : ''}`}
                  onClick={() => {
                    setPomodoroIsRunning(false);
                    setPomodoroMode('short');
                    setPomodoroTimeLeft(300); // 5 min
                  }}
                >
                  Ngắn
                </button>
                <button 
                  className={`pomodoro-mode-btn ${pomodoroMode === 'long' ? 'active' : ''}`}
                  onClick={() => {
                    setPomodoroIsRunning(false);
                    setPomodoroMode('long');
                    setPomodoroTimeLeft(900); // 15 min
                  }}
                >
                  Dài
                </button>
              </div>

              <div className="pomodoro-controls">
                <button 
                  className={`pomodoro-ctrl-btn ${pomodoroIsRunning ? 'running' : 'paused'}`}
                  onClick={() => setPomodoroIsRunning(!pomodoroIsRunning)}
                >
                  {pomodoroIsRunning ? <Pause size={12} /> : <Play size={12} />}
                  <span>{pomodoroIsRunning ? 'Tạm dừng' : 'Bắt đầu'}</span>
                </button>
                <button 
                  className="pomodoro-ctrl-btn reset"
                  onClick={() => {
                    setPomodoroIsRunning(false);
                    if (pomodoroMode === 'work') setPomodoroTimeLeft(1500);
                    else if (pomodoroMode === 'short') setPomodoroTimeLeft(300);
                    else setPomodoroTimeLeft(900);
                  }}
                  title="Đặt lại"
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* Render Normal Category Management Tree */
        <>
          {/* Main Views/Filters */}
          <div className="sidebar-section-list">
            {/* All tasks */}
            <div 
              className={`sidebar-item ${activeCategoryId === 'all' ? 'active' : ''}`}
              onClick={() => setActiveCategoryId('all')}
            >
              <div className="sidebar-item-content">
                <Layers size={16} />
                <span className="sidebar-item-text">{isPartnerBoard ? "Tất cả đối tác" : "Tất cả công việc"}</span>
              </div>
              {taskCounts['all'] > 0 && (
                <span className="sidebar-badge">{taskCounts['all']}</span>
              )}
            </div>

            {/* Uncategorized */}
            <div 
              className={`sidebar-item ${activeCategoryId === 'uncategorized' ? 'active' : ''}`}
              onClick={() => setActiveCategoryId('uncategorized')}
            >
              <div className="sidebar-item-content">
                <Inbox size={16} />
                <span className="sidebar-item-text">{isPartnerBoard ? "Đối tác tự do" : "Chưa phân loại"}</span>
              </div>
              {taskCounts['uncategorized'] > 0 && (
                <span className="sidebar-badge">{taskCounts['uncategorized']}</span>
              )}
            </div>
          </div>

          <div style={{ padding: '0 20px', margin: '4px 0' }}>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-glass)' }} />
          </div>

          {/* Category Tree Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px 6px 20px' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {isPartnerBoard ? "PHÂN LOẠI ĐỐI TÁC" : "DANH MỤC PHÂN CẤP"}
            </span>
            <button 
              className="category-node-action-btn"
              style={{ width: '22px', height: '22px', borderRadius: '4px' }}
              onClick={() => setIsAddingRoot(!isAddingRoot)}
              title="Thêm danh mục lớn"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* Root Addition Form */}
          {isAddingRoot && (
            <form onSubmit={handleAddRootSubmit} style={{ padding: '8px 20px', display: 'flex', gap: '6px' }}>
              <input
                type="text"
                className="search-input"
                style={{ padding: '6px 10px', fontSize: '13px' }}
                placeholder="Tên danh mục..."
                value={rootTitle}
                onChange={(e) => setRootTitle(e.target.value)}
                autoFocus
                required
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '6px 10px' }}>
                <Plus size={14} />
              </button>
            </form>
          )}

          {/* Categories Tree */}
          <div className="category-tree-list">
            {rootCategories.length > 0 ? (
              rootCategories.map(cat => (
                <CategoryNode key={cat.id} category={cat} level={0} />
              ))
            ) : (
              <div style={{ padding: '16px 20px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                Chưa có danh mục nào. Hãy bấm "+" để tạo!
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
