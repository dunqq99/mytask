import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Calendar, 
  CheckSquare, 
  AlignLeft, 
  Tag, 
  Trash2, 
  Clock, 
  Folder, 
  Upload, 
  Image as ImageIcon 
} from 'lucide-react';

const AVAILABLE_TAGS = [
  { key: 'high', bg: '#fef2f2', text: '#ef4444', label: 'Khẩn cấp' },
  { key: 'medium', bg: '#fffbeb', text: '#f59e0b', label: 'Quan trọng' },
  { key: 'low', bg: '#f0fdf4', text: '#10b981', label: 'Bình thường' },
  { key: 'design', bg: '#f5f3ff', text: '#8b5cf6', label: 'Design' },
  { key: 'feature', bg: '#ecfeff', text: '#06b6d4', label: 'Feature' },
  { key: 'bug', bg: '#fff1f2', text: '#f43f5e', label: 'Bug' },
];

// Lightweight safe Markdown parser
const renderMarkdown = (text) => {
  if (!text) return '';
  
  // Escape HTML first to prevent XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Bullet points
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/g, '<ul>$1<\/ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, ''); // Remove duplicates
  
  // Line breaks
  html = html.replace(/\n/g, '<br />');
  
  return html;
};

export default function CardModal({ 
  card, 
  columnId, 
  onClose, 
  onUpdateCard, 
  onDeleteCard, 
  categories = [],
  availableTags = AVAILABLE_TAGS,
  isPartner = false,
  partnerRootId = 'cat-4'
}) {
  const dialogRef = useRef(null);
  const imageInputRef = useRef(null);
  
  // Local form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [checklist, setChecklist] = useState([]);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState(0);

  // Markdown Tab states
  const [descTab, setDescTab] = useState('edit'); // 'edit' or 'preview'
  const [copied, setCopied] = useState(false);

  // Sync state when card changes
  useEffect(() => {
    if (card) {
      setTitle(card.title || '');
      setDescription(card.description || '');
      setChecklist(card.checklist || []);
      setStartDate(card.startDate || '');
      setDueDate(card.dueDate || '');
      setTags(card.tags || []);
      setCategoryId(card.categoryId || '');
      setEstimatedDuration(card.estimatedDuration || 0);
      setDescTab('edit'); // Reset to edit tab when card changes

      if (dialogRef.current && !dialogRef.current.open) {
        dialogRef.current.showModal();
      }
    }
  }, [card]);

  // Handle clipboard paste for images (Ctrl+V / Cmd+V)
  useEffect(() => {
    if (!card) return;

    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            if (file.size > 1.5 * 1024 * 1024) {
              alert('Kích thước ảnh dán quá lớn! Vui lòng dán ảnh dưới 1.5MB để đảm bảo lưu trữ.');
              return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
              onUpdateCard(card.id, columnId, { ...card, image: reader.result });
            };
            reader.readAsDataURL(file);
            e.preventDefault();
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [card, columnId, onUpdateCard]);

  // Handle native Esc closing
  const handleCancel = (e) => {
    e.preventDefault();
    onClose();
  };

  // Close animation trigger
  const handleClose = () => {
    if (dialogRef.current && dialogRef.current.open) {
      dialogRef.current.close();
    }
    onClose();
  };

  // Fallback for light dismiss (clicking outside dialog content)
  const handleDialogClick = (event) => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!('closedBy' in HTMLDialogElement.prototype)) {
      if (event.target !== dialog) return;

      const rect = dialog.getBoundingClientRect();
      const isDialogContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );

      if (!isDialogContent) {
        handleClose();
      }
    }
  };

  // Update card helper
  const saveField = (field, value) => {
    if (!card) return;
    onUpdateCard(card.id, columnId, { ...card, [field]: value });
  };

  // Image Upload handler (Base64)
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (localStorage is limited to ~5MB, warn or compress if necessary)
    if (file.size > 1.5 * 1024 * 1024) {
      alert('Kích thước ảnh quá lớn! Vui lòng chọn ảnh dưới 1.5MB để đảm bảo lưu trữ.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      saveField('image', reader.result);
    };
    reader.readAsDataURL(file);
  };

  // Copy Markdown Description to Clipboard
  const handleCopyDescription = () => {
    if (!description) return;
    navigator.clipboard.writeText(description);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Checklist actions
  const handleAddCheckItem = (e) => {
    e.preventDefault();
    if (!newCheckItem.trim()) return;

    const newItem = {
      id: Date.now().toString(),
      text: newCheckItem.trim(),
      completed: false,
    };

    const updatedChecklist = [...checklist, newItem];
    setChecklist(updatedChecklist);
    saveField('checklist', updatedChecklist);
    setNewCheckItem('');
  };

  const handleToggleCheckItem = (itemId) => {
    const updatedChecklist = checklist.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setChecklist(updatedChecklist);
    saveField('checklist', updatedChecklist);
  };

  const handleDeleteCheckItem = (itemId) => {
    const updatedChecklist = checklist.filter(item => item.id !== itemId);
    setChecklist(updatedChecklist);
    saveField('checklist', updatedChecklist);
  };

  // Tags toggle
  const handleToggleTag = (tagKey) => {
    const updatedTags = tags.includes(tagKey)
      ? tags.filter(t => t !== tagKey)
      : [...tags, tagKey];
    
    setTags(updatedTags);
    saveField('tags', updatedTags);
  };

  if (!card) return null;

  // Calculate checklist stats
  const totalItems = checklist.length;
  const completedItems = checklist.filter(item => item.completed).length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Flatten categories list for select dropdown
  const getFlattenedCategories = (list) => {
    const result = [];
    const recurse = (parentId, level) => {
      const children = list.filter(c => c.parentId === parentId);
      children.forEach(child => {
        result.push({ ...child, level });
        recurse(child.id, level + 1);
      });
    };
    recurse(null, 0);
    return result;
  };

  const flattenedCategories = getFlattenedCategories(categories);
  const activities = card.activities || [];

  return (
    <dialog
      ref={dialogRef}
      onCancel={handleCancel}
      onClick={handleDialogClick}
      closedby="any"
      aria-labelledby="modalCardTitle"
    >
      <div className="modal-content">
        {/* Header */}
        <div className="modal-header">
          <input
            id="modalCardTitle"
            type="text"
            className="modal-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => saveField('title', title)}
            placeholder="Tên công việc không được để trống"
          />
          <button className="modal-close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Grid Area */}
        <div className="modal-grid">
          {/* Main Area */}
          <div className="modal-main-col">
            {/* Reference Cover Image */}
            {card.image && (
              <div>
                <div className="modal-section-title">
                  <ImageIcon size={16} />
                  <span>Hình ảnh tham chiếu</span>
                </div>
                <div className="modal-image-preview-container">
                  <img src={card.image} className="modal-image-preview" alt="Reference" />
                  <button 
                    className="delete-image-btn" 
                    onClick={() => saveField('image', null)}
                    title="Xóa hình ảnh này"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Description with Markdown Tabs */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="modal-section-title" style={{ marginBottom: 0 }}>
                  <AlignLeft size={16} />
                  <span>Mô tả công việc</span>
                </div>
                
                {/* Tabs */}
                <div className="markdown-tabs-container" style={{ border: 'none', margin: 0 }}>
                  <button 
                    className={`markdown-tab-btn ${descTab === 'edit' ? 'active' : ''}`}
                    onClick={() => setDescTab('edit')}
                  >
                    Soạn thảo
                  </button>
                  <button 
                    className={`markdown-tab-btn ${descTab === 'preview' ? 'active' : ''}`}
                    onClick={() => setDescTab('preview')}
                  >
                    Xem trước
                  </button>
                </div>
              </div>

              {descTab === 'edit' ? (
                <textarea
                  className="modal-textarea"
                  style={{ marginTop: '8px' }}
                  placeholder="Nhập mô tả chi tiết cho công việc này (hỗ trợ định dạng Markdown: # H1, - Danh sách, **Chữ đậm**)..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => saveField('description', description)}
                />
              ) : (
                <div className="markdown-preview-box" style={{ marginTop: '8px', minHeight: '110px' }}>
                  {description && (
                    <button className="copy-desc-btn" onClick={handleCopyDescription}>
                      {copied ? "Đã sao chép!" : "Sao chép mô tả"}
                    </button>
                  )}
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: renderMarkdown(description) || '<em style="color:var(--text-muted)">Không có mô tả chi tiết. Hãy chuyển sang Tab "Soạn thảo" để thêm.</em>' 
                    }} 
                  />
                </div>
              )}
            </div>

            {/* Checklist */}
            <div>
              <div className="modal-section-title">
                <CheckSquare size={16} />
                <span>Công việc con (Checklist)</span>
              </div>
              
              {totalItems > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="checklist-progress-bar">
                    <div className="checklist-progress-fill" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', minWidth: '36px', textAlign: 'right' }}>
                    {progressPercent}%
                  </span>
                </div>
              )}

              <div className="checklist-items">
                {checklist.map(item => (
                  <div key={item.id} className="checklist-item">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => handleToggleCheckItem(item.id)}
                    />
                    <span className={`checklist-item-text ${item.completed ? 'completed' : ''}`}>
                      {item.text}
                    </span>
                    <button
                      className="delete-checklist-btn"
                      onClick={() => handleDeleteCheckItem(item.id)}
                      title="Xóa việc con này"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add checklist item form */}
              <form onSubmit={handleAddCheckItem} className="add-checklist-item-form">
                <input
                  type="text"
                  placeholder="Thêm công việc con..."
                  className="checklist-input"
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                />
                <button type="submit" className="btn btn-secondary" style={{ padding: '8px 14px' }}>
                  Thêm
                </button>
              </form>
            </div>

            {/* Activity Logs Section */}
            <div className="activity-log-container">
              <div className="modal-section-title">
                <Clock size={16} />
                <span>Nhật ký hoạt động</span>
              </div>
              {activities.length > 0 ? (
                <div className="activity-list">
                  {activities.map(act => (
                    <div key={act.id} className="activity-item">
                      <span className="activity-timestamp">{act.timestamp}</span>
                      <span className="activity-text">{act.text}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '12px' }}>
                  Chưa có lịch sử hoạt động ghi nhận. Thử kéo thả thẻ này sang cột khác để bắt đầu lưu logs!
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="modal-sidebar-col">
            {/* Category Selection */}
            <div className="sidebar-section" style={{ marginBottom: '16px' }}>
              <div className="modal-section-title">
                <Folder size={14} style={{ marginRight: '4px' }} />
                <span>Danh mục</span>
              </div>
              <select
                className="meta-select"
                value={categoryId || (isPartner ? partnerRootId : '')}
                onChange={(e) => {
                  const val = e.target.value || null;
                  setCategoryId(val || '');
                  saveField('categoryId', val);
                }}
              >
                <option value={isPartner ? partnerRootId : ""}>(Chưa phân loại)</option>
                {flattenedCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {"\u00A0\u00A0".repeat(cat.level) + (cat.level > 0 ? "↳ " : "") + cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags Selection */}
            <div className="sidebar-section" style={{ marginBottom: '16px' }}>
              <div className="modal-section-title">
                <Tag size={14} style={{ marginRight: '4px' }} />
                <span>Nhãn dán (Labels)</span>
              </div>
              <div className="tags-selector-grid">
                {availableTags.map(t => {
                  const isSelected = tags.includes(t.key);
                  return (
                    <span
                      key={t.key}
                      className={`tag-selector-item ${isSelected ? 'selected' : ''}`}
                      style={{
                        backgroundColor: t.bg,
                        color: t.text,
                        border: isSelected ? `2px solid ${t.text}` : '2px solid transparent'
                      }}
                      onClick={() => handleToggleTag(t.key)}
                    >
                      {t.label}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Date Range */}
            <div className="sidebar-section" style={{ marginBottom: '16px' }}>
              <div className="modal-section-title">
                <Calendar size={14} style={{ marginRight: '4px' }} />
                <span>Thời hạn công việc</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Ngày bắt đầu</label>
                  <input
                    type="date"
                    className="meta-input"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      saveField('startDate', e.target.value);
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Hạn chót</label>
                  <input
                    type="date"
                    className="meta-input"
                    value={dueDate}
                    onChange={(e) => {
                      setDueDate(e.target.value);
                      saveField('dueDate', e.target.value);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Estimated Duration */}
            <div className="sidebar-section" style={{ marginBottom: '16px' }}>
              <div className="modal-section-title">
                <Clock size={14} style={{ marginRight: '4px' }} />
                <span>Thời gian thực hiện</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="number"
                    className="meta-input"
                    placeholder="Số phút thực hiện... (VD: 45)"
                    style={{ paddingRight: '45px' }}
                    value={estimatedDuration || ''}
                    min="0"
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setEstimatedDuration(val);
                      saveField('estimatedDuration', val);
                    }}
                  />
                  <span style={{ position: 'absolute', right: '12px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>phút</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                  {[
                    { label: '30p', val: 30 },
                    { label: '60p', val: 60 },
                    { label: '2h', val: 120 },
                    { label: '4h', val: 240 }
                  ].map(preset => (
                    <button
                      key={preset.label}
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        flex: '1 1 0px',
                        textAlign: 'center',
                        minWidth: '40px',
                        justifyContent: 'center'
                      }}
                      onClick={() => {
                        setEstimatedDuration(preset.val);
                        saveField('estimatedDuration', preset.val);
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Upload Reference Image Button */}
            <div className="sidebar-section" style={{ marginBottom: '16px' }}>
              <div className="modal-section-title">
                <ImageIcon size={14} style={{ marginRight: '4px' }} />
                <span>Ảnh tham chiếu</span>
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ marginTop: '4px', width: '100%', justifyContent: 'flex-start', padding: '8px 12px' }} 
                onClick={() => imageInputRef.current.click()}
              >
                <Upload size={14} />
                <span>Đính kèm ảnh</span>
              </button>
              <input
                type="file"
                ref={imageInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleImageUpload}
              />
              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginTop: '6px', fontStyle: 'italic', lineHeight: '1.4' }}>
                Mẹo: Bạn có thể nhấn Ctrl+V / Cmd+V ở bất kỳ đâu trong Modal để dán ảnh nhanh từ clipboard.
              </span>
            </div>

            {/* Spacer */}
            <div style={{ flexGrow: 1 }} />

            {/* Delete Card */}
            <button
              className="btn btn-secondary"
              style={{
                borderColor: 'var(--danger)',
                color: 'var(--danger)',
                background: 'var(--danger-light)',
                marginTop: '20px',
                justifyContent: 'center'
              }}
              onClick={() => {
                if (confirm('Bạn có chắc chắn muốn xóa vĩnh viễn công việc này?')) {
                  onDeleteCard(card.id, columnId);
                  handleClose();
                }
              }}
            >
              <Trash2 size={16} />
              <span>Xóa công việc</span>
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
