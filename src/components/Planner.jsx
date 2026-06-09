import React, { useState, useMemo, useEffect } from 'react';
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
  CalendarDays,
  Settings,
  CheckCircle
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
  setCards,
  shifts = [],
  setShifts,
  weeklyShifts = {},
  setWeeklyShifts,
  weeklyMemberShifts = {},
  setWeeklyMemberShifts,
  isManager = false,
  currentUserId = '',
  workspaceMembers = []
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [plannerSubTab, setPlannerSubTab] = useState('plan'); // 'plan' or 'completed'
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [shiftFormName, setShiftFormName] = useState('');
  const [shiftFormStart, setShiftFormStart] = useState('08:00');
  const [shiftFormEnd, setShiftFormEnd] = useState('16:00');
  const [customPlanningStartMins, setCustomPlanningStartMins] = useState(null);

  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length < 2) return 0;
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  };

  const getMinutesFromMidnight = (date) => {
    return date.getHours() * 60 + date.getMinutes();
  };

  const formatMinutesToTime = (mins) => {
    const h = Math.floor(mins / 60) % 24;
    const m = Math.floor(mins % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const currentWeekMondayStr = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMonday);
    return monday.toLocaleDateString('en-CA');
  }, []);

  const activeShiftId = weeklyMemberShifts[currentUserId]?.[currentWeekMondayStr] || weeklyShifts[currentWeekMondayStr] || '';
  const activeShift = shifts.find(s => s.id === activeShiftId);

  const handleMemberShiftChange = (memberId, shiftId) => {
    if (!isManager) return;
    const updatedWeeklyMemberShifts = {
      ...weeklyMemberShifts,
      [memberId]: {
        ...(weeklyMemberShifts[memberId] || {}),
        [currentWeekMondayStr]: shiftId || ''
      }
    };
    setWeeklyMemberShifts(updatedWeeklyMemberShifts);
  };

  // Auto-sync workdayDuration with activeShift
  useEffect(() => {
    if (activeShift) {
      const startMins = parseTimeToMinutes(activeShift.startTime);
      const endMins = parseTimeToMinutes(activeShift.endTime);
      let dur = endMins - startMins;
      if (dur < 0) dur += 24 * 60;
      setWorkdayDuration(dur);
    }
  }, [activeShift, setWorkdayDuration]);

  const getShiftRemainingBudget = (startTimeStr, endTimeStr, nowMins) => {
    const startMins = parseTimeToMinutes(startTimeStr);
    const endMins = parseTimeToMinutes(endTimeStr);
    const crossesMidnight = endMins < startMins;
    
    if (!crossesMidnight) {
      if (nowMins < startMins) {
        return {
          budgetMins: endMins - startMins,
          totalMins: endMins - startMins,
          isBefore: true,
          isAfter: false,
          effectiveStart: startMins
        };
      } else if (nowMins <= endMins) {
        return {
          budgetMins: endMins - nowMins,
          totalMins: endMins - startMins,
          isBefore: false,
          isAfter: false,
          effectiveStart: nowMins
        };
      } else {
        return {
          budgetMins: 0,
          totalMins: endMins - startMins,
          isBefore: false,
          isAfter: true,
          effectiveStart: nowMins
        };
      }
    } else {
      if (nowMins >= endMins && nowMins < startMins) {
        const totalMins = (24 * 60 - startMins) + endMins;
        return {
          budgetMins: totalMins,
          totalMins: totalMins,
          isBefore: true,
          isAfter: false,
          effectiveStart: startMins
        };
      } else {
        const totalMins = (24 * 60 - startMins) + endMins;
        let remaining = 0;
        if (nowMins >= startMins) {
          remaining = (24 * 60 - nowMins) + endMins;
        } else {
          remaining = endMins - nowMins;
        }
        return {
          budgetMins: remaining,
          totalMins: totalMins,
          isBefore: false,
          isAfter: false,
          effectiveStart: nowMins
        };
      }
    }
  };

  const getPlanningTimelineConfig = () => {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();

    let startStr = '08:00';
    let endStr = formatMinutesToTime((8 * 60 + workdayDuration) % 1440);

    if (activeShift) {
      startStr = activeShift.startTime;
      endStr = activeShift.endTime;
    }

    return getShiftRemainingBudget(startStr, endStr, nowMins);
  };

  const timelineConfig = useMemo(() => {
    return getPlanningTimelineConfig();
  }, [activeShift, workdayDuration, shifts]);

  const shiftStartMins = activeShift ? parseTimeToMinutes(activeShift.startTime) : 8 * 60;
  
  const planningBaseTime = useMemo(() => {
    if (customPlanningStartMins !== null) {
      return customPlanningStartMins;
    }
    return timelineConfig.effectiveStart;
  }, [customPlanningStartMins, timelineConfig]);

  useEffect(() => {
    setCustomPlanningStartMins(null);
  }, [activeShiftId]);

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

  // Completed cards filtering for statistical tab
  const completedCards = useMemo(() => {
    const completedCol = columns.find(col => col.id === 'col-4');
    const completedCardIds = completedCol ? completedCol.cardIds : [];

    return cards.filter(card => {
      if (checkIsCardPartner(card)) return false;

      const isCompleted = completedCardIds.includes(card.id) || card.completedAt;
      if (!isCompleted) return false;

      const compDateStr = card.completedAt || new Date().toISOString();
      const compDate = new Date(compDateStr);

      if (scheduleView === 'day') {
        const today = new Date();
        return compDate.getDate() === today.getDate() &&
          compDate.getMonth() === today.getMonth() &&
          compDate.getFullYear() === today.getFullYear();
      } else if (scheduleView === 'week') {
        const now = new Date();
        const currentDay = now.getDay();
        const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        const monday = new Date(now);
        monday.setDate(now.getDate() + distanceToMonday);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        return compDate >= monday && compDate <= sunday;
      } else if (scheduleView === 'month') {
        const today = new Date();
        return compDate.getMonth() === today.getMonth() &&
          compDate.getFullYear() === today.getFullYear();
      }
      return false;
    });
  }, [cards, columns, checkIsCardPartner, scheduleView]);

  // Timeline Calculation Logic
  const timelineData = useMemo(() => {
    const completedCol = columns.find(col => col.id === 'col-4');
    const completedCardIds = completedCol ? completedCol.cardIds : [];

    // 1. Gather all tasks completed today
    const completedToday = cards.filter(card => {
      if (checkIsCardPartner(card)) return false;
      const isCompleted = completedCardIds.includes(card.id) || card.completedAt;
      if (!isCompleted) return false;

      const compDateStr = card.completedAt;
      if (!compDateStr) return false;
      const compDate = new Date(compDateStr);
      const today = new Date();
      return compDate.getDate() === today.getDate() &&
        compDate.getMonth() === today.getMonth() &&
        compDate.getFullYear() === today.getFullYear();
    });

    // 2. Gather undone scheduled tasks
    const undoneScheduledCards = todaySchedule
      .map(id => cards.find(c => c.id === id))
      .filter(c => {
        if (!c) return false;
        const isCompleted = completedCardIds.includes(c.id) || c.completedAt;
        return !isCompleted;
      });

    let accumulatedTime = 0;
    let accumulatedStress = 0;

    completedToday.forEach(card => {
      accumulatedTime += card.estimatedDuration || 30;
      accumulatedStress += getCardStressScore(card);
    });

    undoneScheduledCards.forEach(card => {
      accumulatedTime += card.estimatedDuration || 30;
      accumulatedStress += getCardStressScore(card);
    });

    const formatTime = (mins) => {
      const hrs = Math.floor(mins / 60) % 24;
      const m = Math.floor(mins % 60);
      return `${hrs.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const timeline = [];

    // Add completed tasks at their fixed times
    completedToday.forEach(card => {
      const compDate = new Date(card.completedAt);
      const endTimeMins = compDate.getHours() * 60 + compDate.getMinutes();
      const duration = card.estimatedDuration || 30;
      const startTimeMins = Math.max(0, endTimeMins - duration);

      timeline.push({
        type: 'completed-task',
        card,
        startTime: formatTime(startTimeMins),
        endTime: formatTime(endTimeMins),
        startTimeMins,
        endTimeMins,
        duration
      });
    });

    timeline.sort((a, b) => a.startTimeMins - b.startTimeMins);

    let currentTime = planningBaseTime;

    undoneScheduledCards.forEach((card, index) => {
      const duration = card.estimatedDuration || 30;

      // Overlap checking with completed tasks
      let overlapped = true;
      while (overlapped) {
        overlapped = false;
        for (const item of timeline) {
          if (item.type === 'completed-task') {
            if (currentTime >= item.startTimeMins && currentTime < item.endTimeMins) {
              currentTime = item.endTimeMins;
              overlapped = true;
              break;
            }
          }
        }
      }

      const lunchStart = 12 * 60;
      const lunchEnd = 13.5 * 60;

      if (autoInsertBreaks && currentTime >= lunchStart && currentTime < lunchEnd) {
        timeline.push({
          type: 'break',
          name: 'Nghỉ trưa 🕒',
          startTime: formatTime(lunchStart),
          endTime: formatTime(lunchEnd),
          startTimeMins: lunchStart,
          endTimeMins: lunchEnd,
          duration: 90
        });
        currentTime = lunchEnd;
      } else if (autoInsertBreaks && currentTime < lunchStart && currentTime + duration > lunchStart) {
        timeline.push({
          type: 'break',
          name: 'Nghỉ trưa 🕒',
          startTime: formatTime(lunchStart),
          endTime: formatTime(lunchEnd),
          startTimeMins: lunchStart,
          endTimeMins: lunchEnd,
          duration: 90
        });
        currentTime = lunchEnd;
      }

      const teaStart = 15 * 60;
      const teaEnd = 15.25 * 60;
      if (autoInsertBreaks && currentTime >= teaStart && currentTime < teaEnd) {
        timeline.push({
          type: 'break',
          name: 'Nghỉ giải lao chiều ☕',
          startTime: formatTime(teaStart),
          endTime: formatTime(teaEnd),
          startTimeMins: teaStart,
          endTimeMins: teaEnd,
          duration: 15
        });
        currentTime = teaEnd;
      } else if (autoInsertBreaks && currentTime < teaStart && currentTime + duration > teaStart) {
        timeline.push({
          type: 'break',
          name: 'Nghỉ giải lao chiều ☕',
          startTime: formatTime(teaStart),
          endTime: formatTime(teaEnd),
          startTimeMins: teaStart,
          endTimeMins: teaEnd,
          duration: 15
        });
        currentTime = teaEnd;
      }

      // Check overlap again after break injections
      overlapped = true;
      while (overlapped) {
        overlapped = false;
        for (const item of timeline) {
          if (item.type === 'completed-task') {
            if (currentTime >= item.startTimeMins && currentTime < item.endTimeMins) {
              currentTime = item.endTimeMins;
              overlapped = true;
              break;
            }
          }
        }
      }

      timeline.push({
        type: 'task',
        card,
        startTime: formatTime(currentTime),
        endTime: formatTime(currentTime + duration),
        startTimeMins: currentTime,
        endTimeMins: currentTime + duration,
        duration
      });

      currentTime += duration;

      if (autoInsertBreaks && index < undoneScheduledCards.length - 1) {
        const nextCard = undoneScheduledCards[index + 1];
        if (nextCard) {
          const breakEnd = currentTime + 5;
          if (!(currentTime <= lunchStart && breakEnd > lunchStart) && !(currentTime <= teaStart && breakEnd > teaStart)) {
            let breakOverlaps = false;
            for (const item of timeline) {
              if (item.type === 'completed-task') {
                if ((currentTime >= item.startTimeMins && currentTime < item.endTimeMins) ||
                    (breakEnd > item.startTimeMins && breakEnd <= item.endTimeMins)) {
                  breakOverlaps = true;
                  break;
                }
              }
            }
            if (!breakOverlaps) {
              timeline.push({
                type: 'break',
                name: 'Nghỉ giải lao ngắn ☕',
                startTime: formatTime(currentTime),
                endTime: formatTime(breakEnd),
                startTimeMins: currentTime,
                endTimeMins: breakEnd,
                duration: 5
              });
              currentTime = breakEnd;
            }
          }
        }
      }
    });

    timeline.sort((a, b) => a.startTimeMins - b.startTimeMins);

    return {
      timeline,
      totalScheduledTime: accumulatedTime,
      totalStress: Number(accumulatedStress.toFixed(1))
    };
  }, [todaySchedule, cards, autoInsertBreaks, planningBaseTime, columns]);

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

    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();

    let startStr = '08:00';
    let endStr = formatMinutesToTime((8 * 60 + workdayDuration) % 1440);

    if (activeShift) {
      startStr = activeShift.startTime;
      endStr = activeShift.endTime;
    }

    const config = getShiftRemainingBudget(startStr, endStr, nowMins);
    setCustomPlanningStartMins(config.effectiveStart);

    let budgetMins = config.budgetMins;

    if (budgetMins <= 0) {
      alert('Đã hết giờ làm việc trong ngày/ca hôm nay, không thể tự động sắp xếp thêm!');
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

    // 3. Selection loop based on remaining budget and stress limits
    const maxStressBudget = 55; // scientific limit for a single healthy day
    
    let remainingTime = budgetMins;
    let remainingStress = maxStressBudget;
    let hugeTasksCount = 0;
    const selectedIds = [...todaySchedule];

    // Filter today's completed tasks to deduct their stress & duration from budget
    const completedToday = cards.filter(card => {
      if (checkIsCardPartner(card)) return false;
      const isCompleted = completedCardIds.includes(card.id) || card.completedAt;
      if (!isCompleted) return false;

      const compDateStr = card.completedAt;
      if (!compDateStr) return false;
      const compDate = new Date(compDateStr);
      return compDate.getDate() === now.getDate() &&
        compDate.getMonth() === now.getMonth() &&
        compDate.getFullYear() === now.getFullYear();
    });

    completedToday.forEach(c => {
      const d = c.estimatedDuration || 30;
      const p = getPriorityWeight(c.tags);
      remainingStress -= (p * Math.sqrt(d));
    });

    // Calculate current undone scheduled load
    todaySchedule.forEach(id => {
      const c = cards.find(card => card.id === id);
      if (c && !completedCardIds.includes(c.id) && !c.completedAt) {
        const d = c.estimatedDuration || 30;
        const p = getPriorityWeight(c.tags);
        remainingTime -= d;
        remainingStress -= (p * Math.sqrt(d));
        if (d >= 120 && p >= 2) {
          hugeTasksCount++;
        }
      }
    });

    remainingStress = Math.max(0, remainingStress);

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
          {/* Sub-tab Switcher: Lịch trình vs Đã hoàn thành */}
          <div className="planner-subtabs" style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
            <button
              className={`planner-subtab-btn ${plannerSubTab === 'plan' ? 'active' : ''}`}
              onClick={() => setPlannerSubTab('plan')}
              style={{
                background: plannerSubTab === 'plan' ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                color: plannerSubTab === 'plan' ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                padding: '6px 16px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Lịch trình 📅
            </button>
            <button
              className={`planner-subtab-btn ${plannerSubTab === 'completed' ? 'active' : ''}`}
              onClick={() => setPlannerSubTab('completed')}
              style={{
                background: plannerSubTab === 'completed' ? '#10b981' : 'rgba(255,255,255,0.03)',
                color: plannerSubTab === 'completed' ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                padding: '6px 16px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Đã hoàn thành ({completedCards.length}) ✅
            </button>
          </div>

          {plannerSubTab === 'completed' ? (
            <div className="planner-completed-view">
              <div className="planner-col-header" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
                <h3 className="planner-col-title">
                  {scheduleView === 'day' && 'Đã hoàn thành Hôm nay'}
                  {scheduleView === 'week' && 'Đã hoàn thành Tuần này'}
                  {scheduleView === 'month' && 'Đã hoàn thành Tháng này'}
                </h3>
                <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  Tổng cộng: {completedCards.length} công việc đã xử lý xong
                </p>
              </div>

              <div className="completed-tasks-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '70vh' }}>
                {completedCards.length > 0 ? (
                  completedCards.map(card => {
                    const compDateObj = new Date(card.completedAt || Date.now());
                    const formattedCompTime = compDateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                    const formattedCompDate = compDateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const priority = getPriorityLabel(card.tags);
                    const categoryObj = card.categoryId ? categories.find(c => c.id === card.categoryId) : null;
                    const doneChecklist = card.checklist ? card.checklist.filter(item => item.completed).length : 0;
                    const totalChecklist = card.checklist ? card.checklist.length : 0;

                    return (
                      <div
                        key={card.id}
                        className="completed-task-card"
                        onClick={() => onCardClick(card, 'col-4')}
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          borderLeft: `4px solid #10b981`,
                          padding: '12px 16px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'transform 0.2s, background-color 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span className="planner-tag-badge" style={{ backgroundColor: priority.bg, color: priority.color, fontSize: '10px' }}>
                            {priority.text}
                          </span>
                          <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '500' }}>
                            Hoàn thành lúc {formattedCompTime} - {formattedCompDate}
                          </span>
                        </div>
                        <h4 className="completed-card-title" style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '13.5px', margin: '4px 0', fontWeight: 'bold' }}>
                          {card.title}
                        </h4>
                        <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-muted)' }}>
                          {categoryObj && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Folder size={11} />
                              {categoryObj.name}
                            </span>
                          )}
                          {card.estimatedDuration > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Timer size={11} />
                              {card.estimatedDuration} phút
                            </span>
                          )}
                          {totalChecklist > 0 && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: doneChecklist === totalChecklist ? '#10b981' : 'inherit' }}>
                              <CheckCircle size={11} />
                              Checklist: {doneChecklist}/{totalChecklist}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="planner-empty-state" style={{ padding: '40px 0' }}>
                    <CheckCircle size={32} style={{ opacity: 0.3, marginBottom: '8px', color: 'var(--text-muted)' }} />
                    <span>Không có công việc nào được hoàn thành trong khoảng thời gian này.</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
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

                    {/* Shift Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Ca làm việc tuần này:</span>
                      {isManager ? (
                        <select
                          className="planner-select"
                          value={activeShiftId}
                          onChange={(e) => {
                            const val = e.target.value;
                            handleMemberShiftChange(currentUserId, val);
                          }}
                          style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', minWidth: '150px' }}
                        >
                          <option value="">-- Chưa chọn ca --</option>
                          {shifts.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>
                          ))}
                        </select>
                      ) : (
                        <span className="badge" style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12.5px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontWeight: '600', border: '1px solid var(--border-glass)' }}>
                          {activeShift ? `${activeShift.name} (${activeShift.startTime} - ${activeShift.endTime})` : 'Chưa được xếp ca'}
                        </span>
                      )}
                      
                      {isManager && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setShowShiftModal(true);
                            setShiftFormName('');
                            setShiftFormStart('08:00');
                            setShiftFormEnd('16:00');
                          }}
                          style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                          title="Cấu hình ca làm việc"
                        >
                          <Settings size={13} />
                          <span>Cài đặt ca</span>
                        </button>
                      )}
                    </div>

                    {/* Team Shift Assignment Panel for Manager */}
                    {isManager && workspaceMembers && workspaceMembers.length > 0 && (
                      <div className="glass" style={{ padding: '16px', marginTop: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)', background: 'rgba(255,255,255,0.01)', width: '100%' }}>
                        <h4 style={{ fontSize: '12.5px', fontWeight: 'bold', margin: '0 0 10px 0', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Users size={14} /> Bố trí ca làm việc cho Đội nhóm ({currentWeekMondayStr})
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {workspaceMembers.map(member => {
                            const memberShiftId = weeklyMemberShifts[member.id]?.[currentWeekMondayStr] || '';
                            return (
                              <div key={member.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                  {member.username} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({member.roleName || member.role})</span>
                                </span>
                                <select
                                  className="planner-select"
                                  value={memberShiftId}
                                  onChange={(e) => handleMemberShiftChange(member.id, e.target.value)}
                                  style={{ padding: '4px 8px', fontSize: '11.5px', minWidth: '150px' }}
                                >
                                  <option value="">-- Chưa xếp ca --</option>
                                  {shifts.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Slider to configure workday hours */}
                    {isManager && (
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
                    )}

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

                        if (item.type === 'completed-task') {
                          const card = item.card;
                          const priority = getPriorityLabel(card.tags);
                          const stress = getCardStressScore(card);
                          return (
                            <div key={`completed-${card.id}`} className="timeline-task-item completed-timeline-item">
                              <div className="timeline-time">
                                <span className="time-start" style={{ color: '#10b981' }}>{item.startTime}</span>
                                <span className="time-end" style={{ color: '#10b981' }}>{item.endTime}</span>
                              </div>
                              <div 
                                className="task-block"
                                onClick={() => onCardClick(card, 'col-4')}
                                style={{ 
                                  borderLeft: `4px solid #10b981`,
                                  background: 'rgba(16, 185, 129, 0.05)',
                                  cursor: 'pointer'
                                }}
                              >
                                <div style={{ flexGrow: 1 }}>
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '2px' }}>
                                    <span className="planner-tag-badge" style={{ backgroundColor: '#10b98120', color: '#10b981' }}>
                                      Đã xong ✅
                                    </span>
                                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                                      Stress: {stress} điểm
                                    </span>
                                  </div>
                                  <h4 className="task-block-title" style={{ textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                                    {card.title}
                                  </h4>
                                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                      <Timer size={10} />
                                      <span>{card.estimatedDuration || 30} phút</span>
                                    </span>
                                    <span style={{ color: '#10b981', fontWeight: '500' }}>
                                      Hoàn thành thực tế
                                    </span>
                                  </div>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h3 className="planner-col-title">Kế hoạch Tuần này</h3>
                        <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Phân bổ công việc vào các ngày trong tuần (Kéo thả để lên lịch)</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Ca làm việc:</span>
                        {isManager ? (
                          <select
                            className="planner-select"
                            value={activeShiftId}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleMemberShiftChange(currentUserId, val);
                            }}
                            style={{ padding: '4px 8px', fontSize: '12px', minWidth: '130px' }}
                          >
                            <option value="">-- Chưa chọn --</option>
                            {shifts.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="badge" style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11.5px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', fontWeight: '600', border: '1px solid var(--border-glass)' }}>
                            {activeShift ? activeShift.name : 'Chưa xếp ca'}
                          </span>
                        )}
                        
                        {isManager && (
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              setShowShiftModal(true);
                              setShiftFormName('');
                              setShiftFormStart('08:00');
                              setShiftFormEnd('16:00');
                            }}
                            style={{ padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Cấu hình ca làm việc"
                          >
                            <Settings size={13} />
                          </button>
                        )}
                      </div>
                    </div>
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
            </>
          )}
        </div>
      </div>

      {/* Shift Management Modal */}
      {showShiftModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="modal-content" style={{
            background: 'var(--bg-modal, #1e293b)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} style={{ color: 'var(--primary)' }} />
                <span>Thiết lập ca làm việc & phân lịch tuần</span>
              </h3>
              <button
                onClick={() => {
                  setShowShiftModal(false);
                  setEditingShift(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              padding: '20px',
              overflowY: 'auto',
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '20px'
            }}>
              {/* Section 1: CRUD Shifts */}
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
                  1. Danh sách ca làm việc
                </h4>
                
                {/* Add/Edit Shift Form */}
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
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary)' }}>
                    {editingShift ? 'Sửa ca làm việc' : 'Thêm ca làm việc mới'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '10px' }}>
                    <input
                      type="text"
                      placeholder="Tên ca (ví dụ: Ca 1, Ca hành chính...)"
                      value={shiftFormName}
                      onChange={(e) => setShiftFormName(e.target.value)}
                      required
                      style={{
                        background: 'rgba(0,0,0,0.2)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '4px',
                        padding: '6px 10px',
                        fontSize: '13px',
                        color: '#fff'
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '2px' }}>Bắt đầu:</span>
                      <input
                        type="time"
                        value={shiftFormStart}
                        onChange={(e) => setShiftFormStart(e.target.value)}
                        required
                        style={{
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          fontSize: '13px',
                          color: '#fff'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: '2px' }}>Kết thúc:</span>
                      <input
                        type="time"
                        value={shiftFormEnd}
                        onChange={(e) => setShiftFormEnd(e.target.value)}
                        required
                        style={{
                          background: 'rgba(0,0,0,0.2)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          fontSize: '13px',
                          color: '#fff'
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
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
                        style={{ padding: '4px 12px', fontSize: '12px' }}
                      >
                        Hủy
                      </button>
                    )}
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ padding: '4px 16px', fontSize: '12px' }}
                    >
                      {editingShift ? 'Cập nhật' : 'Thêm ca'}
                    </button>
                  </div>
                </form>

                {/* Shift Table List */}
                <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  {shifts.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', textAlign: 'left' }}>
                          <th style={{ padding: '6px 8px' }}>Tên ca</th>
                          <th style={{ padding: '6px 8px' }}>Thời gian</th>
                          <th style={{ padding: '6px 8px', textAlign: 'right' }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shifts.map(s => (
                          <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '8px', fontWeight: 'bold' }}>{s.name}</td>
                            <td style={{ padding: '8px' }}>{s.startTime} - {s.endTime}</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>
                              <button
                                className="btn btn-secondary"
                                onClick={() => {
                                  setEditingShift(s);
                                  setShiftFormName(s.name);
                                  setShiftFormStart(s.startTime);
                                  setShiftFormEnd(s.endTime);
                                }}
                                style={{ padding: '2px 8px', fontSize: '11px', marginRight: '6px' }}
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
                                style={{ padding: '2px 8px', fontSize: '11px', background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                              >
                                Xóa
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '10px' }}>
                      Chưa có ca làm việc nào được cấu hình.
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Weekly Shift Planner Assignments */}
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', borderBottom: '1px dashed rgba(255,255,255,0.1)', paddingBottom: '6px' }}>
                  2. Thiết lập ca làm việc theo tuần
                </h4>
                <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                  Gán ca cụ thể cho từng tuần làm việc tiếp theo. Timeline và quỹ giờ làm việc sẽ tự động thay đổi khi bạn sang tuần mới.
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
                        <div key={week.monStr} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '6px', padding: '8px 12px' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: '500' }}>{week.label}</span>
                          <select
                            className="planner-select"
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
                            style={{ minWidth: '180px', padding: '4px 8px', fontSize: '12px' }}
                          >
                            <option value="">-- Chưa chọn ca --</option>
                            {shifts.map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.startTime} - {s.endTime})</option>
                            ))}
                          </select>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'rgba(0, 0, 0, 0.1)'
            }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowShiftModal(false);
                  setEditingShift(null);
                }}
                style={{ padding: '6px 20px', fontSize: '13px' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
