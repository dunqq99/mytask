import React, { useState, useMemo } from 'react';
import { 
  Clock, 
  Trash2, 
  Plus, 
  Search, 
  Sparkles, 
  Timer, 
  Layers, 
  AlertCircle,
  Folder,
  ArrowRight,
  Info,
  X,
  CalendarDays
} from 'lucide-react';

export default function Planner({
  cards = [],
  categories = [],
  columns = [],
  todaySchedule = [], // Array of cardIds
  setTodaySchedule,
  workdayDuration = 480, // in minutes (8 hours)
  setWorkdayDuration,
  onCardClick,
  checkIsCardPartner,
  backlogFilter = 'all',
  scheduleView = 'day',
  autoInsertBreaks = true,
  onUpdateCard,
  setCards
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  };

  // Filter out partner cards and completed cards for the planner backlog
  const backlogCards = useMemo(() => {
    const completedCol = columns.find(col => col.id === 'col-4');
    const completedCardIds = completedCol ? completedCol.cardIds : [];

    return cards.filter(card => {
      // 1. Must NOT be a partner card
      if (checkIsCardPartner(card)) return false;
      // 2. Must NOT be completed (in col-4)
      if (completedCardIds.includes(card.id)) return false;

      const isAlreadyScheduled = todaySchedule.includes(card.id);
      if (isAlreadyScheduled) return false;

      // 3. Search filter
      const matchesSearch = card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (card.description && card.description.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchesSearch) return false;

      // 4. Category filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'uncategorized') {
          return !card.categoryId;
        }
        return card.categoryId === selectedCategory;
      }

      // 5. Sidebar backlog filter
      if (backlogFilter === 'urgent') {
        const isHigh = card.tags.includes('high');
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const due = parseLocalDate(card.dueDate);
        const isOverdue = due && due < todayDate;
        if (!isHigh && !isOverdue) return false;
      } else if (backlogFilter === 'no-due') {
        if (card.dueDate) return false;
      } else if (backlogFilter === 'short') {
        if (!card.estimatedDuration || card.estimatedDuration > 30) return false;
      }

      return true;
    });
  }, [cards, todaySchedule, searchQuery, selectedCategory, checkIsCardPartner, columns, backlogFilter]);

  // Priority mapping for calculations
  const getPriorityWeight = (tags = []) => {
    if (tags.includes('high')) return 3;
    if (tags.includes('medium')) return 2;
    return 1; // low or uncategorized
  };

  const getPriorityLabel = (tags = []) => {
    if (tags.includes('high')) return { text: 'Khẩn cấp', color: '#ef4444', bg: '#fef2f2' };
    if (tags.includes('medium')) return { text: 'Quan trọng', color: '#f59e0b', bg: '#fffbeb' };
    return { text: 'Bình thường', color: '#10b981', bg: '#f0fdf4' };
  };

  // Compute stress score for a card
  const getCardStressScore = (card) => {
    const p = getPriorityWeight(card.tags);
    const d = card.estimatedDuration || 30;
    return Number((p * Math.sqrt(d)).toFixed(1));
  };

  // Timeline Calculation Logic
  const timelineData = useMemo(() => {
    let currentTime = 8 * 60; // 08:00 AM
    const timeline = [];
    let accumulatedStress = 0;
    let accumulatedTime = 0;

    const formatTime = (mins) => {
      const hrs = Math.floor(mins / 60) % 24;
      const m = Math.floor(mins % 60);
      return `${hrs.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    todaySchedule.forEach((id, index) => {
      const card = cards.find(c => c.id === id);
      if (!card) return;

      const duration = card.estimatedDuration || 30;
      accumulatedTime += duration;
      accumulatedStress += getCardStressScore(card);

      const lunchStart = 12 * 60;
      const lunchEnd = 13.5 * 60; // 12:00 - 13:30

      // Auto check lunch overlap
      if (autoInsertBreaks && currentTime >= lunchStart && currentTime < lunchEnd) {
        timeline.push({
          type: 'break',
          name: 'Nghỉ trưa 🕒',
          startTime: formatTime(lunchStart),
          endTime: formatTime(lunchEnd),
          duration: 90
        });
        currentTime = lunchEnd;
      } else if (autoInsertBreaks && currentTime < lunchStart && currentTime + duration > lunchStart) {
        timeline.push({
          type: 'break',
          name: 'Nghỉ trưa 🕒',
          startTime: formatTime(lunchStart),
          endTime: formatTime(lunchEnd),
          duration: 90
        });
        currentTime = lunchEnd;
      }

      // Auto check afternoon break (15:00 - 15:15)
      const teaStart = 15 * 60;
      const teaEnd = 15.25 * 60;
      if (autoInsertBreaks && currentTime >= teaStart && currentTime < teaEnd) {
        timeline.push({
          type: 'break',
          name: 'Nghỉ giải lao chiều ☕',
          startTime: formatTime(teaStart),
          endTime: formatTime(teaEnd),
          duration: 15
        });
        currentTime = teaEnd;
      } else if (autoInsertBreaks && currentTime < teaStart && currentTime + duration > teaStart) {
        timeline.push({
          type: 'break',
          name: 'Nghỉ giải lao chiều ☕',
          startTime: formatTime(teaStart),
          endTime: formatTime(teaEnd),
          duration: 15
        });
        currentTime = teaEnd;
      }

      timeline.push({
        type: 'task',
        card,
        startTime: formatTime(currentTime),
        endTime: formatTime(currentTime + duration),
        duration
      });

      currentTime += duration;

      // Add a 5 min micro-break between consecutive tasks
      if (autoInsertBreaks && index < todaySchedule.length - 1) {
        const nextId = todaySchedule[index + 1];
        const nextCard = cards.find(c => c.id === nextId);
        if (nextCard) {
          const breakEnd = currentTime + 5;
          // Only add break if it doesn't bump into lunch or afternoon tea
          if (!(currentTime <= lunchStart && breakEnd > lunchStart) && !(currentTime <= teaStart && breakEnd > teaStart)) {
            timeline.push({
              type: 'break',
              name: 'Nghỉ giải lao ngắn ☕',
              startTime: formatTime(currentTime),
              endTime: formatTime(breakEnd),
              duration: 5
            });
            currentTime = breakEnd;
          }
        }
      }
    });

    return {
      timeline,
      totalScheduledTime: accumulatedTime,
      totalStress: Number(accumulatedStress.toFixed(1))
    };
  }, [todaySchedule, cards, autoInsertBreaks]);

  // Calculate Urgency deadline multiplier
  const getUrgencyWeight = (dueDate) => {
    if (!dueDate) return 1.0;
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = new Date(dueDate);
    due.setHours(0,0,0,0);
    const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 5.0; // Overdue
    if (diffDays === 0) return 4.0; // Today
    if (diffDays === 1) return 2.5; // Tomorrow
    if (diffDays <= 3) return 1.5; // Next 3 days
    return 1.0;
  };

  // Smart Auto-Schedule Algorithm
  const handleAutoSchedule = () => {
    const completedCol = columns.find(col => col.id === 'col-4');
    const completedCardIds = completedCol ? completedCol.cardIds : [];

    // 1. Filter all incomplete, non-partner task cards that aren't already scheduled or completed
    const availableBacklog = cards.filter(c => 
      !checkIsCardPartner(c) && 
      !todaySchedule.includes(c.id) &&
      !completedCardIds.includes(c.id)
    );
    
    if (availableBacklog.length === 0) {
      alert('Không còn công việc nào trong Backlog để tự động sắp xếp!');
      return;
    }

    // 2. Rank tasks by score: urgencyWeight * (priorityWeight / sqrt(D))
    const scoredTasks = availableBacklog.map(card => {
      const p = getPriorityWeight(card.tags);
      const d = card.estimatedDuration || 30;
      const urgency = getUrgencyWeight(card.dueDate);
      
      // Recommendation rank formula: higher is better
      const rank = urgency * (p / Math.sqrt(d));
      const stress = p * Math.sqrt(d);

      return {
        card,
        rank,
        duration: d,
        stress
      };
    });

    // Sort descending by rank
    scoredTasks.sort((a, b) => b.rank - a.rank);

    // 3. Selection loop based on workday budget and stress limits
    const maxTimeBudget = workdayDuration;
    const maxStressBudget = 55; // scientific limit for a single healthy day
    
    let remainingTime = maxTimeBudget;
    let remainingStress = maxStressBudget;
    let hugeTasksCount = 0;
    const selectedIds = [...todaySchedule];

    // Calculate current schedule load
    todaySchedule.forEach(id => {
      const c = cards.find(card => card.id === id);
      if (c) {
        const d = c.estimatedDuration || 30;
        const p = getPriorityWeight(c.tags);
        remainingTime -= d;
        remainingStress -= (p * Math.sqrt(d));
        if (d >= 120 && p >= 2) {
          hugeTasksCount++;
        }
      }
    });

    for (let i = 0; i < scoredTasks.length; i++) {
      const { card, duration, stress } = scoredTasks[i];

      // Constraints check
      if (remainingTime <= 0 || remainingStress <= 0) break;
      if (duration > remainingTime) continue; // Doesn't fit in remaining time
      if (stress > remainingStress) continue; // Exceeds remaining stress budget
      
      // Burnout protection: Max 1 huge task (>= 2h and priority >= Medium) per day
      if (duration >= 120 && getPriorityWeight(card.tags) >= 2) {
        if (hugeTasksCount >= 1) continue;
        hugeTasksCount++;
      }

      selectedIds.push(card.id);
      remainingTime -= duration;
      remainingStress -= stress;
    }

    setTodaySchedule(selectedIds);
  };

  // Drag & Drop handlers
  const handleDragStart = (e, cardId, type) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ cardId, source: type }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDropToSchedule = (e, targetIndex = null) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const { cardId, source } = data;

      if (source === 'backlog') {
        const completedCol = columns.find(col => col.id === 'col-4');
        const completedCardIds = completedCol ? completedCol.cardIds : [];
        if (completedCardIds.includes(cardId)) {
          alert('Không thể lên lịch cho công việc đã hoàn thành!');
          return;
        }

        // Add task to schedule
        if (!todaySchedule.includes(cardId)) {
          const updated = [...todaySchedule];
          if (targetIndex !== null) {
            updated.splice(targetIndex, 0, cardId);
          } else {
            updated.push(cardId);
          }
          setTodaySchedule(updated);
        }
      } else if (source === 'schedule') {
        // Reorder inside schedule
        const currentIndex = todaySchedule.indexOf(cardId);
        if (currentIndex > -1 && targetIndex !== null) {
          const updated = [...todaySchedule];
          updated.splice(currentIndex, 1); // remove
          updated.splice(targetIndex, 0, cardId); // insert
          setTodaySchedule(updated);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveFromSchedule = (cardId) => {
    setTodaySchedule(todaySchedule.filter(id => id !== cardId));
  };

  // Stress indicator calculations
  const getStressLevel = (score) => {
    if (score <= 20) return { label: 'Thư thái 🟢', class: 'relaxed', color: '#10b981' };
    if (score <= 45) return { label: 'Hiệu quả 🟡', class: 'productive', color: '#f59e0b' };
    return { label: 'Căng thẳng quá tải 🔴', class: 'stressed', color: '#ef4444' };
  };

  const stressInfo = getStressLevel(timelineData.totalStress);

  // Time formatting helper
  const formatTotalTime = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} phút`;
    if (m === 0) return `${h} giờ`;
    return `${h}g ${m}p`;
  };

  const timePercent = Math.min(100, Math.round((timelineData.totalScheduledTime / workdayDuration) * 100));

  const todayStr = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const currentWeek = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);

    const weekDays = [];
    const dayNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const date = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${date}`;
      weekDays.push({
        name: dayNames[i],
        dateStr,
        label: `${date}/${month}`,
        isToday: dateStr === todayStr
      });
    }
    return weekDays;
  }, [todayStr]);

  const getCardsForDay = (dateStr) => {
    const completedCol = columns.find(col => col.id === 'col-4');
    const completedCardIds = completedCol ? completedCol.cardIds : [];

    if (dateStr === todayStr) {
      const scheduled = todaySchedule.map(id => cards.find(c => c.id === id)).filter(Boolean);
      const others = cards.filter(c => 
        !checkIsCardPartner(c) && 
        c.dueDate === dateStr && 
        !todaySchedule.includes(c.id) &&
        !completedCardIds.includes(c.id)
      );
      return [...scheduled, ...others];
    } else {
      return cards.filter(c => 
        !checkIsCardPartner(c) && 
        c.dueDate === dateStr && 
        !completedCardIds.includes(c.id)
      );
    }
  };

  const handleDropOnDay = (e, dateStr) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const { cardId, source } = data;
      const cardObj = cards.find(c => c.id === cardId);
      if (cardObj) {
        if (dateStr === todayStr) {
          if (!todaySchedule.includes(cardId)) {
            setTodaySchedule([...todaySchedule, cardId]);
          }
        } else {
          setTodaySchedule(todaySchedule.filter(id => id !== cardId));
        }

        onUpdateCard(cardId, cardObj.columnId || 'col-1', { ...cardObj, dueDate: dateStr });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const currentMonthTasks = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const completedCol = columns.find(col => col.id === 'col-4');
    const completedCardIds = completedCol ? completedCol.cardIds : [];

    const list = cards.filter(c => {
      if (checkIsCardPartner(c)) return false;
      if (completedCardIds.includes(c.id)) return false;
      if (!c.dueDate) return false;

      const due = parseLocalDate(c.dueDate);
      return due && due.getMonth() === currentMonth && due.getFullYear() === currentYear;
    });

    const groups = {};
    list.forEach(c => {
      if (!groups[c.dueDate]) groups[c.dueDate] = [];
      groups[c.dueDate].push(c);
    });

    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [cards, columns, checkIsCardPartner]);

  return (
    <div className="planner-container">
      {/* Planner Grid Layout */}
      <div className="planner-grid">
        {/* Left Column: Backlog List */}
        <div className="planner-col backlog-column">
          <div className="planner-col-header">
            <h3 className="planner-col-title">Danh sách công việc chưa làm</h3>
            <div className="backlog-filters">
              {/* Category Filter */}
              <select
                className="planner-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">Tất cả danh mục</option>
                <option value="uncategorized">Chưa phân loại</option>
                {categories
                  .filter(c => !checkIsCardPartner({ categoryId: c.id }))
                  .map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))
                }
              </select>

              {/* Search Bar */}
              <div className="planner-search-wrapper">
                <Search size={13} />
                <input
                  type="text"
                  placeholder="Tìm tác vụ..."
                  className="planner-search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Backlog List Cards */}
          <div className="backlog-list">
            {backlogCards.length > 0 ? (
              backlogCards.map(card => {
                const priority = getPriorityLabel(card.tags);
                const categoryObj = card.categoryId ? categories.find(c => c.id === card.categoryId) : null;
                return (
                  <div
                    key={card.id}
                    className="planner-backlog-item"
                    draggable
                    onDragStart={(e) => handleDragStart(e, card.id, 'backlog')}
                    onClick={() => onCardClick(card, 'col-1')} // default to col-1
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <span className="planner-tag-badge" style={{ backgroundColor: priority.bg, color: priority.color }}>
                        {priority.text}
                      </span>
                      {card.estimatedDuration > 0 && (
                        <span className="planner-duration-badge">
                          <Timer size={11} />
                          <span>{card.estimatedDuration}p</span>
                        </span>
                      )}
                    </div>
                    <h4 className="planner-card-title">{card.title}</h4>
                    {categoryObj && (
                      <span className="planner-category-label">
                        <Folder size={10} />
                        <span>{categoryObj.name}</span>
                      </span>
                    )}
                    <button
                      className="btn-add-schedule"
                      title="Thêm vào lịch trình hôm nay"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!todaySchedule.includes(card.id)) {
                          setTodaySchedule([...todaySchedule, card.id]);
                        }
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="planner-empty-state">
                <Layers size={24} style={{ opacity: 0.4, marginBottom: '8px' }} />
                <span>Không có công việc nào khả dụng.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Timeline & Schedule */}
        <div className="planner-col schedule-column">
          {scheduleView === 'day' ? (
            <>
              <div className="planner-col-header" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 className="planner-col-title" style={{ marginBottom: '2px' }}>Kế hoạch hôm nay</h3>
                    <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Sắp xếp lịch trình khoa học hằng ngày</p>
                  </div>
                  <button 
                    className="btn btn-primary"
                    onClick={handleAutoSchedule}
                    style={{ padding: '8px 14px', fontSize: '12px', gap: '6px' }}
                    title="Tự động chọn việc cân bằng thời gian & giảm stress"
                  >
                    <Sparkles size={14} />
                    <span>Tự sắp xếp thông minh 🪄</span>
                  </button>
                </div>

                {/* Slider to configure workday hours */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Quỹ giờ:</span>
                  <input
                    type="range"
                    min="240" // 4 hours
                    max="720" // 12 hours
                    step="30"
                    value={workdayDuration}
                    onChange={(e) => setWorkdayDuration(parseInt(e.target.value, 10))}
                    style={{ flexGrow: 1, accentColor: 'var(--primary)' }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: 'bold', minWidth: '50px', textAlign: 'right' }}>
                    {formatTotalTime(workdayDuration)}
                  </span>
                </div>

                {/* Visual Budget & Stress Indicators */}
                <div className="planner-indicators">
                  {/* Time Budget Gauge */}
                  <div className="indicator-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Thời lượng đã lên lịch:</span>
                      <span style={{ fontWeight: 'bold' }}>
                        {formatTotalTime(timelineData.totalScheduledTime)} / {formatTotalTime(workdayDuration)}
                      </span>
                    </div>
                    <div className="planner-progress-track">
                      <div 
                        className="planner-progress-fill" 
                        style={{ 
                          width: `${timePercent}%`,
                          backgroundColor: timelineData.totalScheduledTime > workdayDuration ? '#ef4444' : (timePercent > 80 ? '#f59e0b' : '#10b981')
                        }}
                      />
                    </div>
                    {timelineData.totalScheduledTime > workdayDuration && (
                      <span style={{ fontSize: '10px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px' }}>
                        <AlertCircle size={10} />
                        <span>Đã vượt quá quỹ thời gian làm việc hôm nay!</span>
                      </span>
                    )}
                  </div>

                  {/* Stress Gauge */}
                  <div className="indicator-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Chỉ số quá tải (Stress Index):</span>
                      <span style={{ fontWeight: 'bold', color: stressInfo.color }}>
                        {timelineData.totalStress} điểm
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mức độ:</span>
                      <span style={{ 
                        fontSize: '11.5px', 
                        fontWeight: 'bold', 
                        color: stressInfo.color,
                        background: `${stressInfo.color}15`,
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}>
                        {stressInfo.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timeline View / Schedule Blocks */}
              <div 
                className="timeline-container"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropToSchedule(e)}
              >
                {timelineData.timeline.length > 0 ? (
                  timelineData.timeline.map((item, index) => {
                    if (item.type === 'break') {
                      return (
                        <div key={`break-${index}`} className="timeline-break-item">
                          <div className="timeline-time">
                            <span className="time-start">{item.startTime}</span>
                            <span className="time-end">{item.endTime}</span>
                          </div>
                          <div className="break-block-wrapper">
                            <div className="break-block">
                              <span className="break-title">{item.name} ({item.duration}p)</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Task item
                    const card = item.card;
                    const priority = getPriorityLabel(card.tags);
                    const stress = getCardStressScore(card);
                    return (
                      <div 
                        key={card.id} 
                        className="timeline-task-item"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDropToSchedule(e, index)}
                      >
                        <div className="timeline-time">
                          <span className="time-start">{item.startTime}</span>
                          <span className="time-end">{item.endTime}</span>
                        </div>
                        <div 
                          className="task-block"
                          draggable
                          onDragStart={(e) => handleDragStart(e, card.id, 'schedule')}
                          onClick={() => onCardClick(card, 'col-1')}
                          style={{ borderLeft: `4px solid ${priority.color}` }}
                        >
                          <div style={{ flexGrow: 1 }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '2px' }}>
                              <span className="planner-tag-badge" style={{ backgroundColor: priority.bg, color: priority.color }}>
                                {priority.text}
                              </span>
                              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                                Stress: {stress} điểm
                              </span>
                            </div>
                            <h4 className="task-block-title">{card.title}</h4>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <Timer size={10} />
                                <span>{card.estimatedDuration || 30} phút</span>
                              </span>
                              {card.dueDate && (
                                <span style={{ color: getUrgencyWeight(card.dueDate) > 2.0 ? '#ef4444' : 'inherit' }}>
                                  Hạn: {card.dueDate.split('-').reverse().slice(0,2).join('/')}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            className="btn-remove-schedule"
                            title="Bỏ khỏi lịch trình hôm nay"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFromSchedule(card.id);
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div 
                    className="timeline-empty-zone"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropToSchedule(e)}
                  >
                    <div className="empty-message-box">
                      <Clock size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                      <p style={{ fontWeight: 'bold', fontSize: '13px', margin: '4px 0' }}>Lịch trình hôm nay trống</p>
                      <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        Kéo thả công việc từ bên trái hoặc nhấn nút "Tự sắp xếp thông minh" phía trên để lên lịch trình khoa học.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Informational Tip */}
              <div className="planner-tip-box">
                <Info size={14} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  <strong>Mẹo lập kế hoạch khoa học:</strong> Đừng dồn quá nhiều việc nặng vào một ngày. Thuật toán tự sắp xếp sẽ giới hạn tổng điểm stress tối đa là 55 điểm và giới hạn chỉ tối đa 1 tác vụ lớn (≥ 2 giờ) mỗi ngày để bảo vệ sức khỏe của bạn!
                </span>
              </div>
            </>
          ) : scheduleView === 'week' ? (
            <>
              <div className="planner-col-header" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <h3 className="planner-col-title">Kế hoạch Tuần này</h3>
                <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Phân bổ công việc vào các ngày trong tuần (Kéo thả để lên lịch)</p>
              </div>

              <div className="planner-weekly-grid">
                {currentWeek.map(day => {
                  const dayCards = getCardsForDay(day.dateStr);
                  const totalDuration = dayCards.reduce((acc, c) => acc + (c.estimatedDuration || 30), 0);
                  const totalStress = dayCards.reduce((acc, c) => acc + getCardStressScore(c), 0);
                  const parsedStress = Number(totalStress.toFixed(1));
                  const isDayToday = day.isToday;

                  return (
                    <div 
                      key={day.dateStr} 
                      className={`weekly-day-card ${isDayToday ? 'today' : ''}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDropOnDay(e, day.dateStr)}
                    >
                      <div className="weekly-day-header">
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="day-name">{day.name}</span>
                          <span className="day-date">{day.label}</span>
                        </div>
                        <div className="day-metrics">
                          <span className="metric-pill duration" title="Tổng thời lượng">
                            {formatTotalTime(totalDuration)}
                          </span>
                          <span className="metric-pill stress" title="Stress Index" style={{
                            backgroundColor: parsedStress > 45 ? '#ef444415' : (parsedStress > 20 ? '#f59e0b15' : '#10b98115'),
                            color: parsedStress > 45 ? '#ef4444' : (parsedStress > 20 ? '#f59e0b' : '#10b981')
                          }}>
                            {parsedStress}đ
                          </span>
                        </div>
                      </div>

                      <div className="weekly-day-tasks">
                        {dayCards.length > 0 ? (
                          dayCards.map(card => {
                            const priority = getPriorityLabel(card.tags);
                            return (
                              <div 
                                key={card.id} 
                                className="weekly-task-item"
                                draggable
                                onDragStart={(e) => handleDragStart(e, card.id, 'backlog')}
                                onClick={() => onCardClick(card, 'col-1')}
                                style={{ borderLeft: `3px solid ${priority.color}` }}
                              >
                                <span className="w-task-title">{card.title}</span>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                                  <span>{card.estimatedDuration || 30}p</span>
                                  <button 
                                    className="btn-remove-weekly-task"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setTodaySchedule(todaySchedule.filter(id => id !== card.id));
                                      onUpdateCard(card.id, card.columnId || 'col-1', { ...card, dueDate: '' });
                                    }}
                                    title="Gỡ hạn chót"
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="weekly-day-empty">
                            Kéo thả việc vào đây
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="planner-col-header" style={{ borderBottom: '1px solid var(--border-glass)' }}>
                <h3 className="planner-col-title">Hạn chót trong Tháng này</h3>
                <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Các công việc có deadline trong tháng hiện tại</p>
              </div>

              <div className="planner-monthly-list">
                {currentMonthTasks.length > 0 ? (
                  currentMonthTasks.map(([dateStr, dayCards]) => {
                    const formattedDate = dateStr.split('-').reverse().join('/');
                    const isDateToday = dateStr === todayStr;
                    return (
                      <div key={dateStr} className={`monthly-date-group ${isDateToday ? 'today' : ''}`}>
                        <div className="monthly-date-header">
                          <span>{isDateToday ? 'Hôm nay - ' : ''}Ngày {formattedDate}</span>
                          <span className="monthly-date-count">{dayCards.length} tác vụ</span>
                        </div>
                        <div className="monthly-task-list">
                          {dayCards.map(card => {
                            const priority = getPriorityLabel(card.tags);
                            return (
                              <div 
                                key={card.id} 
                                className="monthly-task-item"
                                onClick={() => onCardClick(card, 'col-1')}
                                style={{ borderLeft: `3px solid ${priority.color}` }}
                              >
                                <div className="m-task-info">
                                  <span className="m-task-title">{card.title}</span>
                                  <span className="m-task-duration">{card.estimatedDuration || 30} phút</span>
                                </div>
                                <span className="planner-tag-badge" style={{ backgroundColor: priority.bg, color: priority.color, fontSize: '10px', padding: '1px 6px' }}>
                                  {priority.text}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="planner-empty-state" style={{ padding: '60px 0' }}>
                    <CalendarDays size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                    <span>Không có tác vụ nào có hạn chót trong tháng này.</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
