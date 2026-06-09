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

export default function Card({ card, columnId, columnColor, categories = [], onCardClick, onDragStart, onDragEnd, onDragOverCard, availableTags = [], allCards = [], isViewingToday = true, workspaceMembers = [] }) {
  const { id, title, description, tags = [], dueDate, startDate, checklist = [], image, categoryId, estimatedDuration, services = [], linkedPartnerId, assigneeId } = card;
  
  // Find partner root category ID dynamically
  const partnerRootCat = categories.find(c => !c.parentId && c.name.includes('Đối tác'));
  const partnerRootId = partnerRootCat ? partnerRootCat.id : 'cat-4';

  const checkIsCardPartner = (c) => {
    if (!c.categoryId) return false;
    if (c.categoryId === partnerRootId) return true;
    let currentId = c.categoryId;
    let limit = 10;
    while (currentId && limit > 0) {
      const cat = categories.find(catItem => catItem.id === currentId);
      if (!cat) break;
      if (cat.parentId === partnerRootId) return true;
      currentId = cat.parentId;
      limit--;
    }
    return false;
  };

  const isCardPartner = checkIsCardPartner(card);
  const linkedPartner = (linkedPartnerId && allCards) ? allCards.find(c => c.id === linkedPartnerId) : null;

  // Suppress category badge if it's the partner root category
  const category = (categoryId && categoryId !== partnerRootId) ? categories.find(c => c.id === categoryId) : null;

  // Find assignee info
  const assignee = assigneeId ? workspaceMembers.find(m => m.id === assigneeId) : null;

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

    if (isCardPartner) {
      if (startDate) {
        return `Bắt đầu: ${formatDate(startDate)} >> Hôm nay`;
      }
      return 'Bắt đầu: Hôm nay';
    }

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
      draggable={!(columnId === 'col-4' && !isViewingToday)}
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
      {(category || tags.length > 0 || linkedPartner) && (
        <div className="card-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          {category && (
            <span className="card-category-badge" title={`Danh mục: ${category.name}`}>
              <Folder size={10} />
              <span>{category.name}</span>
            </span>
          )}
          {linkedPartner && (
            <span 
              className="card-category-badge" 
              title={`Đối tác liên kết: ${linkedPartner.title}`}
              style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}
            >
              <span>🤝 {linkedPartner.title}</span>
            </span>
          )}
          {tags.map(tagKey => {
            const dynamicTag = availableTags.find(t => t.key === tagKey);
            const tagStyle = dynamicTag || TAG_COLORS[tagKey] || { bg: '#e2e8f0', text: '#475569', label: tagKey };
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

      {/* Hiển thị tóm tắt dịch vụ & giá trị hợp tác đối tác */}
      {isCardPartner && services && services.length > 0 && (
        <div style={{
          marginTop: '6px',
          marginBottom: '8px',
          padding: '6px 8px',
          background: 'rgba(16, 185, 129, 0.03)',
          border: '1px solid rgba(16, 185, 129, 0.15)',
          borderRadius: '6px',
          fontSize: '11px',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>💼 Gói dịch vụ:</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '14px', listStyleType: 'disc' }}>
            {services.map(srv => {
              const customFieldsStr = srv.customFields && srv.customFields.length > 0
                ? ` (${srv.customFields.map(f => `${f.key}: ${f.value}`).join(', ')})`
                : '';
              const formattedPrice = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(srv.price);
              return (
                <li key={srv.id} style={{ marginBottom: '2px', wordBreak: 'break-word' }}>
                  <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{srv.name}</span>
                  {customFieldsStr}
                  <span style={{ color: '#10b981', marginLeft: '4px', fontWeight: 'bold' }}>: {formattedPrice}</span>
                </li>
              );
            })}
          </ul>
          <div style={{ 
            marginTop: '6px', 
            paddingTop: '6px', 
            borderTop: '1px solid rgba(16, 185, 129, 0.15)', 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            fontWeight: 'bold',
            color: '#10b981'
          }}>
            <span>Tổng hợp tác:</span>
            <span>
              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                services.reduce((sum, srv) => sum + srv.price, 0)
              )}
            </span>
          </div>
        </div>
      )}

      {/* Footer / Meta Info */}
      {(startDate || dueDate || totalChecklist > 0 || description || estimatedDuration > 0 || assignee) && (
        <div className="card-footer" style={{ flexWrap: 'wrap', gap: '8px' }}>
          <div className="card-meta-item" style={{ gap: '8px', flexWrap: 'wrap' }}>
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
            {assignee && (
              <span className="card-meta-item" title={`Người thực hiện: ${assignee.username}`} style={{
                background: 'rgba(59, 130, 246, 0.1)',
                color: '#60a5fa',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ fontSize: '10px' }}>👤</span>
                <span>{assignee.username}</span>
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
