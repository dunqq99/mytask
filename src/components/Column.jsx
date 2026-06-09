import React, { useState, useRef, useEffect } from 'react';
import { Plus, MoreHorizontal, Trash2, Edit2, ChevronsLeft, ChevronsRight } from 'lucide-react';
import Card from './Card';

const PRESET_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#10b981'];

export default function Column({
  column,
  cards,
  categories = [],
  isCollapsed = false,
  onToggleCollapse,
  onAddCard,
  onUpdateColumnTitle,
  onUpdateColumnColor,
  onDeleteColumn,
  onCardClick,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDropCard,
  columnCustomization = true,
  userPlan = 'free',
  availableTags = [],
  allCards = [],
  isViewingToday = true
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(column.title);
  const [showMenu, setShowMenu] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const menuRef = useRef(null);
  const inputRef = useRef(null);

  const isCompletedColumn = column.id === 'col-4' || column.id === 'part-col-4';


  useEffect(() => {
    setTitleInput(column.title);
  }, [column.title]);

  // Click outside to close column menu
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when editing column title
  useEffect(() => {
    if (isEditingTitle && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleTitleSubmit = () => {
    if (isCompletedColumn) return;
    setIsEditingTitle(false);
    if (titleInput.trim() && titleInput.trim() !== column.title) {
      onUpdateColumnTitle(column.id, titleInput.trim());
    } else {
      setTitleInput(column.title);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setTitleInput(column.title);
    }
  };

  // Drag and Drop Column level
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const { cardId, sourceColumnId } = JSON.parse(dataStr);

      if (column.id === 'col-4' && !isViewingToday) {
        alert('Bạn chỉ có thể hoàn thành hoặc mở lại công việc ở ngày hiện tại!');
        return;
      }

      onDropCard(cardId, sourceColumnId, column.id);
    } catch (err) {
      console.error('Lỗi khi drop thẻ:', err);
    }
  };

  if (isCollapsed) {
    return (
      <div
        className="board-column collapsed"
        onClick={onToggleCollapse}
        style={{ borderTop: `4px solid ${column.color || '#3b82f6'}` }}
      >
        <button
          className="column-expand-btn"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse();
          }}
          title="Mở rộng cột"
        >
          <ChevronsRight size={16} />
        </button>
        <div className="collapsed-title-text">{column.title}</div>
        <span className="collapsed-count-badge">{cards.length}</span>
      </div>
    );
  }

  return (
    <div
      className={`board-column ${isDragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ borderTop: `4px solid ${column.color || '#3b82f6'}` }}
    >
      {/* Column Header */}
      <div className="column-header">
        <div className="column-title-container">
          {isEditingTitle && !isCompletedColumn ? (
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              style={{ padding: '4px 8px', fontSize: '15px', fontWeight: 'bold' }}
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <>
              <h3 
                className="column-title" 
                onClick={() => {
                  if (isCompletedColumn) return;
                  if (!columnCustomization) {
                    alert(`Tùy chỉnh cột Kanban là tính năng của gói PRO trở lên. Gói hiện tại của bạn là ${userPlan.toUpperCase()}. Vui lòng nâng cấp để sử dụng!`);
                  } else {
                    setIsEditingTitle(true);
                  }
                }}
                style={{ cursor: isCompletedColumn ? 'default' : 'pointer' }}
              >
                {column.title}
                {column.id === 'col-4' && !isViewingToday && (
                  <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-secondary)', marginLeft: '6px', opacity: 0.8 }}>
                    (Xem lại)
                  </span>
                )}
              </h3>
              <span className="column-count">{cards.length}</span>
            </>
          )}
        </div>

        {/* Actions section with Collapse button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button 
            className="column-menu-btn" 
            onClick={onToggleCollapse}
            title="Thu gọn cột"
          >
            <ChevronsLeft size={16} />
          </button>
          
          {!isCompletedColumn && (
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button className="column-menu-btn" onClick={() => setShowMenu(!showMenu)}>
                <MoreHorizontal size={18} />
              </button>
              
              {showMenu && (
                <div className="action-menu" style={{ right: 0, top: '28px', minWidth: '185px' }}>
                  <div
                    className="action-menu-item"
                    onClick={() => {
                      if (!columnCustomization) {
                        alert(`Tùy chỉnh cột Kanban là tính năng của gói PRO trở lên. Gói hiện tại của bạn là ${userPlan.toUpperCase()}. Vui lòng nâng cấp để sử dụng!`);
                      } else {
                        setIsEditingTitle(true);
                      }
                      setShowMenu(false);
                    }}
                  >
                    <Edit2 size={14} />
                    <span>Đổi tên cột {!columnCustomization && '🔒'}</span>
                  </div>

                  {/* Column color selection inside the menu */}
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-glass)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 'bold' }}>
                      Màu sắc cột:
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {PRESET_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => {
                            if (!columnCustomization) {
                              alert(`Tùy chỉnh cột Kanban là tính năng của gói PRO trở lên. Gói hiện tại của bạn là ${userPlan.toUpperCase()}. Vui lòng nâng cấp để sử dụng!`);
                            } else {
                              onUpdateColumnColor(column.id, color);
                            }
                            setShowMenu(false);
                          }}
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: color,
                            border: column.color === color ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.15)',
                            cursor: 'pointer',
                            padding: 0,
                            boxShadow: column.color === color ? '0 0 4px rgba(255,255,255,0.6)' : 'none',
                            transition: 'transform 0.15s ease'
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div
                    className="action-menu-item danger"
                    onClick={() => {
                      if (!columnCustomization) {
                        alert(`Tùy chỉnh cột Kanban là tính năng của gói PRO trở lên. Gói hiện tại của bạn là ${userPlan.toUpperCase()}. Vui lòng nâng cấp để sử dụng!`);
                      } else {
                        if (confirm(`Bạn chắc chắn muốn xóa cột "${column.title}" và toàn bộ thẻ bên trong?`)) {
                          onDeleteColumn(column.id);
                        }
                      }
                      setShowMenu(false);
                    }}
                  >
                    <Trash2 size={14} />
                    <span>Xóa cột này {!columnCustomization && '🔒'}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cards List */}
      <div className="card-list">
        {cards.map(card => (
          <Card
            key={card.id}
            card={card}
            columnId={column.id}
            columnColor={column.color}
            categories={categories}
            allCards={allCards}
            onCardClick={onCardClick}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOverCard={onDragOverCard}
            availableTags={availableTags}
            isViewingToday={isViewingToday}
          />
        ))}
      </div>

      {/* Add Card Button */}
      {!(column.id === 'col-4' && !isViewingToday) && (
        <button className="add-card-btn" onClick={() => onAddCard(column.id)}>
          <Plus size={16} />
          <span>Thêm công việc</span>
        </button>
      )}
    </div>
  );
}
