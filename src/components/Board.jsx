import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import Column from './Column';

const PRESET_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#10b981'];

// Helper to get local date string YYYY-MM-DD from any ISO date string
const getLocalDateString = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.split('T')[0];
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayPart = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayPart}`;
};

export default function Board({
  columns,
  cards,
  categories = [],
  collapsedColIds = [],
  onToggleCollapseColumn,
  onAddCard,
  onUpdateColumnTitle,
  onUpdateColumnColor,
  onDeleteColumn,
  onAddColumn,
  onCardClick,
  onDragStart,
  onDragEnd,
  onDragOverCard,
  onDropCard,
  columnCustomization = true,
  userPlan = 'free',
  onUpgradeClick = () => {},
  availableTags = [],
  allCards = [],
  selectedCompletedDate = new Date().toLocaleDateString('en-CA'),
  isViewingToday = true,
  workspaceMembers = []
}) {
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [selectedColor, setSelectedColor] = useState('#3b82f6');

  const handleAddColumnSubmit = (e) => {
    e.preventDefault();
    if (newColumnTitle.trim()) {
      onAddColumn(newColumnTitle.trim(), selectedColor);
      setNewColumnTitle('');
      setSelectedColor('#3b82f6');
      setIsAddingColumn(false);
    }
  };

  return (
    <div className="board-container">
      {/* Render Columns */}
      {columns.map(col => {
        // Filter cards that belong to this column (dynamically filter completed tasks by selected completed date)
        const columnCards = col.id === 'col-4'
          ? cards.filter(c => c.completedAt && getLocalDateString(c.completedAt) === selectedCompletedDate)
          : col.cardIds
              .map(id => cards.find(c => c.id === id))
              .filter(Boolean);

        return (
          <Column
            key={col.id}
            column={col}
            cards={columnCards}
            allCards={allCards}
            categories={categories}
            isCollapsed={collapsedColIds.includes(col.id)}
            onToggleCollapse={() => onToggleCollapseColumn(col.id)}
            onAddCard={onAddCard}
            onUpdateColumnTitle={onUpdateColumnTitle}
            onUpdateColumnColor={onUpdateColumnColor}
            onDeleteColumn={onDeleteColumn}
            onCardClick={onCardClick}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOverCard={onDragOverCard}
            onDropCard={onDropCard}
            columnCustomization={columnCustomization}
            availableTags={availableTags}
            isViewingToday={isViewingToday}
            workspaceMembers={workspaceMembers}
          />
        );
      })}

      {/* Add New Column Block */}
      <div style={{ width: '320px', minWidth: '320px' }}>
        {isAddingColumn ? (
          <form onSubmit={handleAddColumnSubmit} className="glass" style={{ padding: '16px' }}>
            <input
              type="text"
              placeholder="Nhập tiêu đề cột..."
              className="search-input"
              style={{ marginBottom: '12px' }}
              value={newColumnTitle}
              onChange={(e) => setNewColumnTitle(e.target.value)}
              autoFocus
              required
            />

            {/* Column Color Select Palette */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 'bold' }}>
                Màu sắc cột:
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      border: selectedColor === color ? '2px solid #ffffff' : '1.5px solid rgba(0,0,0,0.15)',
                      cursor: 'pointer',
                      padding: 0,
                      boxShadow: selectedColor === color ? '0 0 6px rgba(255,255,255,0.7)' : 'none',
                      transition: 'transform 0.15s ease'
                    }}
                    title={color === '#10b981' ? 'Màu xanh lá (Khuyên dùng cho Hoàn thành)' : ''}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 14px' }}>
                Thêm cột
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '8px', width: '36px', height: '36px' }}
                onClick={() => {
                  setIsAddingColumn(false);
                  setNewColumnTitle('');
                  setSelectedColor('#3b82f6');
                }}
              >
                <X size={16} />
              </button>
            </div>
          </form>
        ) : (
          <button
            className="btn btn-secondary glass"
            style={{
              width: '100%',
              padding: '16px',
              borderStyle: 'dashed',
              justifyContent: 'center',
              background: 'var(--bg-glass-column)'
            }}
            onClick={() => {
              const isLimitReached = userPlan === 'free' && columns.length >= 5;
              if (isLimitReached) {
                onUpgradeClick();
              } else if (!columnCustomization) {
                onAddColumn(); // triggers permission check in App.jsx
              } else {
                setIsAddingColumn(true);
              }
            }}
          >
            <Plus size={18} />
            <span>Thêm cột mới { (userPlan === 'free' && columns.length >= 5) ? '🔒' : (!columnCustomization && '🔒')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
