import React from 'react';
import { Calendar, CheckSquare, AlignLeft, Clock, Folder, Timer } from 'lucide-react';

const TAG_COLORS = {
  high: { bg: '#fef2f2', text: '#ef4444', label: 'Khẩn cấp' },
  medium: { bg: '#fffbeb', text: '#f59e0b', label: 'Quan trọng' },
  low: { bg: '#f0fdf4', text: '#10b981', label: 'Bình thường' },
  design: { bg: '#f5f3ff', text: '#8b5cf6', label: 'Design' },
  feature: { bg: '#ecfeff', text: '#06b6d4', label: 'Feature' },
  bug: { bg: '#fff1f2', text: '#f43f5e', label: 'Bug' },
  // Partner Tags
  strategic: { bg: '#fdf2f8', text: '#db2777', label: 'Chiến lược' },
  potential: { bg: '#f0fdf4', text: '#16a34a', label: 'Tiềm năng' },
  active: { bg: '#f0f9ff', text: '#0284c7', label: 'Đang hợp tác' },
  media: { bg: '#f5f3ff', text: '#7c3aed', label: 'Truyền thông' },
  tech: { bg: '#ecfeff', text: '#0891b2', label: 'Công nghệ' },
  service: { bg: '#fffbeb', text: '#d97706', label: 'Dịch vụ' }
};

export default function Card({ card, columnId, columnColor, categories = [], onCardClick, onDragStart, onDragEnd, onDragOverCard }) {
  const { id, title, description, tags = [], dueDate, startDate, checklist = [], image, categoryId, estimatedDuration } = card;
  
  // Find partner root category ID dynamically
  const partnerRootCat = categories.find(c => !c.parentId && c.name.includes('Đối tác'));
  const partnerRootId = partnerRootCat ? partnerRootCat.id : 'cat-4';

  // Suppress category badge if it's the partner root category
  const category = (categoryId && categoryId !== partnerRootId) ? categories.find(c => c.id === categoryId) : null;

  // Format estimated duration helper
  const formatDuration = (mins) => {
    if (!mins) return '';
    if (mins < 60) return `${mins} phút`;
    const hrs = mins / 60;
    return `${Number(hrs.toFixed(1))} giờ`;
  };

  // Calculate checklist stats
  const totalChecklist = checklist.length;
  const completedChecklist = checklist.filter(item => item.completed).length;

  // Calculate due date status class
  const getDueDateStatusClass = () => {
    if (!dueDate) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return 'overdue';
    } else if (diffDays <= 3) {
      return 'due-soon';
    }
    return '';
  };

  const dueClass = getDueDateStatusClass();

  // Render formatted date range
  const renderDateRange = () => {
    if (!startDate && !dueDate) return '';

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      // Convert YYYY-MM-DD to DD/MM
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}`;
      }
      const date = new Date(dateStr);
      return date.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' });
    };

    if (startDate && dueDate) {
      return `${formatDate(startDate)} - ${formatDate(dueDate)}`;
    }
    
    // Only start date or only due date
    const label = startDate ? 'Bắt đầu' : 'Hạn chót';
    return `${label}: ${formatDate(startDate || dueDate)}`;
  };

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ cardId: id, sourceColumnId: columnId }));
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      onDragStart(id);
    }, 0);
  };

  const handleDragEnd = () => {
    onDragEnd();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    onDragOverCard(e, id, columnId);
  };

  return (
    <div
      className="task-card"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onClick={() => onCardClick(card, columnId)}
      style={{ borderLeft: `4px solid ${columnColor || '#64748b'}` }}
    >
      {/* Cover Image */}
      {image && (
        <img src={image} className="card-cover-image" alt="Cover" />
      )}

      {/* Category & Tags Header */}
      {(category || tags.length > 0) && (
        <div className="card-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          {category && (
            <span className="card-category-badge" title={`Danh mục: ${category.name}`}>
              <Folder size={10} />
              <span>{category.name}</span>
            </span>
          )}
          {tags.map(tagKey => {
            const tagStyle = TAG_COLORS[tagKey] || { bg: '#e2e8f0', text: '#475569', label: tagKey };
            return (
              <span
                key={tagKey}
                className="card-tag"
                style={{ backgroundColor: tagStyle.bg, color: tagStyle.text }}
              >
                {tagStyle.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Title */}
      <h4 className="card-title">{title}</h4>

      {/* Description Preview */}
      {description && (
        <p className="card-desc-preview">{description}</p>
      )}

      {/* Footer / Meta Info */}
      {(startDate || dueDate || totalChecklist > 0 || description || estimatedDuration > 0) && (
        <div className="card-footer">
          <div className="card-meta-item" style={{ gap: '8px' }}>
            {description && (
              <span className="card-meta-item" title="Có mô tả chi tiết">
                <AlignLeft size={12} />
              </span>
            )}
            {totalChecklist > 0 && (
              <span
                className="card-meta-item"
                title="Tiến độ công việc con"
                style={{
                  color: completedChecklist === totalChecklist ? 'var(--success)' : 'inherit',
                  fontWeight: completedChecklist === totalChecklist ? '700' : 'normal'
                }}
              >
                <CheckSquare size={12} />
                <span>{completedChecklist}/{totalChecklist}</span>
              </span>
            )}
            {estimatedDuration > 0 && (
              <span className="card-meta-item" title={`Thời gian ước lượng: ${estimatedDuration} phút`} style={{ gap: '2px' }}>
                <Timer size={12} style={{ opacity: 0.8 }} />
                <span>{formatDuration(estimatedDuration)}</span>
              </span>
            )}
          </div>

          {(startDate || dueDate) && (
            <div className={`card-due-date ${dueClass}`} title={dueClass === 'overdue' ? 'Đã quá hạn chót!' : ''}>
              <Clock size={11} />
              <span>{renderDateRange()}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
