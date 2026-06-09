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
  Image as ImageIcon,
  Lock,
  Unlock,
  Plus,
  Settings,
  Users
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
  onUpdateAvailableTags = () => {},
  allPartnerCards = [],
  isPartner = false,
  partnerRootId = 'cat-4',
  isReadOnly = false,
  userPlan = 'free',
  planFeatures = null,
  workspaceMembers = []
}) {
  const currentFeatures = React.useMemo(() => {
    const DEFAULT_PLAN_FEATURES = {
      free: { googleSheetsSync: false, activityLogs: false, checklists: true, cardLimit: 10, columnCustomization: true },
      pro: { googleSheetsSync: false, activityLogs: true, checklists: true, cardLimit: 100, columnCustomization: true },
      enterprise: { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 500, columnCustomization: true },
      vip: { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 9999, columnCustomization: true }
    };
    if (planFeatures && planFeatures[userPlan]) {
      return planFeatures[userPlan];
    }
    return DEFAULT_PLAN_FEATURES[userPlan] || DEFAULT_PLAN_FEATURES.free;
  }, [planFeatures, userPlan]);
  const dialogRef = useRef(null);
  const imageInputRef = useRef(null);
  
  // Local form states
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [checklist, setChecklist] = useState([]);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [tags, setTags] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [linkedPartnerId, setLinkedPartnerId] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState(0);
  const [assigneeId, setAssigneeId] = useState('');

  // Cấu hình danh sách dịch vụ cho đối tác
  const [services, setServices] = useState([]);
  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceCustomFields, setServiceCustomFields] = useState([]);

  // Tag management states & helper functions
  const [isManagingTags, setIsManagingTags] = useState(false);
  const TAG_COLOR_PRESETS = [
    { bg: '#fef2f2', text: '#ef4444' }, // Red
    { bg: '#fffbeb', text: '#f59e0b' }, // Yellow
    { bg: '#f0fdf4', text: '#10b981' }, // Green
    { bg: '#f5f3ff', text: '#8b5cf6' }, // Purple
    { bg: '#ecfeff', text: '#06b6d4' }, // Cyan
    { bg: '#fff1f2', text: '#f43f5e' }, // Rose
    { bg: '#fdf2f8', text: '#db2777' }, // Pink
    { bg: '#f0f9ff', text: '#0284c7' }  // Blue
  ];

  const handleRenameTag = (tagKey, newLabel) => {
    const updated = availableTags.map(t => 
      t.key === tagKey ? { ...t, label: newLabel } : t
    );
    onUpdateAvailableTags(updated);
  };

  const handleCycleTagColor = (tagKey) => {
    const tag = availableTags.find(t => t.key === tagKey);
    if (!tag) return;
    
    let nextIdx = 0;
    const currentIdx = TAG_COLOR_PRESETS.findIndex(p => p.bg === tag.bg || p.text === tag.text);
    if (currentIdx !== -1) {
      nextIdx = (currentIdx + 1) % TAG_COLOR_PRESETS.length;
    }
    const nextPreset = TAG_COLOR_PRESETS[nextIdx];
    
    const updated = availableTags.map(t => 
      t.key === tagKey ? { ...t, bg: nextPreset.bg, text: nextPreset.text } : t
    );
    onUpdateAvailableTags(updated);
  };

  const handleDeleteTag = (tagKey) => {
    if (confirm(`Bạn chắc chắn muốn xóa nhãn dán này?`)) {
      const updated = availableTags.filter(t => t.key !== tagKey);
      if (tags.includes(tagKey)) {
        const nextTags = tags.filter(t => t !== tagKey);
        setTags(nextTags);
        saveField('tags', nextTags);
      }
      onUpdateAvailableTags(updated, tagKey);
    }
  };

  const handleAddNewTag = () => {
    const newKey = `tag-${Date.now()}`;
    const defaultColor = TAG_COLOR_PRESETS[Math.floor(Math.random() * TAG_COLOR_PRESETS.length)];
    const newTag = {
      key: newKey,
      label: 'Nhãn mới',
      bg: defaultColor.bg,
      text: defaultColor.text
    };
    onUpdateAvailableTags([...availableTags, newTag]);
  };

  // Markdown Tab states
  const [descTab, setDescTab] = useState('edit'); // 'edit' or 'preview'
  const [copied, setCopied] = useState(false);

  // Sync state when card changes
  useEffect(() => {
    if (card) {
      setIsUnlocked(false);
      setTitle(card.title || '');
      setDescription(card.description || '');
      setChecklist(card.checklist || []);
      setStartDate(card.startDate || '');

      setDueDate(card.dueDate || '');
      setTags(card.tags || []);
      setCategoryId(card.categoryId || '');
      setLinkedPartnerId(card.linkedPartnerId || '');
      setEstimatedDuration(card.estimatedDuration || 0);
      setServices(card.services || []);
      setAssigneeId(card.assigneeId || '');
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

  // Các hàm quản lý dịch vụ đối tác
  const handleOpenAddService = () => {
    setEditingServiceId(null);
    setServiceName('');
    setServicePrice('');
    setServiceCustomFields([]);
    setIsServiceFormOpen(true);
  };

  const handleOpenEditService = (srv) => {
    setEditingServiceId(srv.id);
    setServiceName(srv.name || '');
    setServicePrice(srv.price || '');
    setServiceCustomFields(srv.customFields || []);
    setIsServiceFormOpen(true);
  };

  const handleAddCustomField = () => {
    setServiceCustomFields(prev => [...prev, { key: '', value: '' }]);
  };

  const handleUpdateCustomField = (index, field, value) => {
    setServiceCustomFields(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveCustomField = (index) => {
    setServiceCustomFields(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveService = (e) => {
    e.preventDefault();
    if (!serviceName.trim()) return;

    const cleanCustomFields = serviceCustomFields.filter(f => f.key.trim() !== '');

    const serviceData = {
      id: editingServiceId || `srv-${Date.now()}`,
      name: serviceName.trim(),
      price: parseFloat(servicePrice) || 0,
      customFields: cleanCustomFields
    };

    let updatedServices;
    if (editingServiceId) {
      updatedServices = services.map(s => s.id === editingServiceId ? serviceData : s);
    } else {
      updatedServices = [...services, serviceData];
    }

    setServices(updatedServices);
    saveField('services', updatedServices);
    setIsServiceFormOpen(false);
  };

  const handleDeleteService = (srvId) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa dịch vụ này không?")) return;
    const updatedServices = services.filter(s => s.id !== srvId);
    setServices(updatedServices);
    saveField('services', updatedServices);
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

  const isCompleted = columnId === 'col-4' || card.isArchived;
  const isLocked = isCompleted && !isUnlocked;
  const effectiveReadOnly = isReadOnly || isLocked;

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
            disabled={effectiveReadOnly}
            style={effectiveReadOnly ? { pointerEvents: 'none' } : {}}
          />
          <button className="modal-close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Lock Banner */}
        {isCompleted && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            background: isLocked ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
            color: isLocked ? '#ef4444' : '#10b981',
            borderBottom: '1px solid var(--border-glass)',
            fontSize: '12px',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
              <span>{isLocked ? 'Công việc đã hoàn thành và đang được KHÓA chỉnh sửa.' : 'Công việc đã hoàn thành (Đã mở khóa để chỉnh sửa).'}</span>
            </div>
            <button
              onClick={() => setIsUnlocked(!isUnlocked)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                borderRadius: '6px',
                background: isLocked ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: 'inherit',
                border: '1px solid currentColor',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: '600'
              }}
            >
              {isLocked ? 'Mở khóa' : 'Khóa lại'}
            </button>
          </div>
        )}

        {/* Grid Area */}
        <div className="modal-grid" style={effectiveReadOnly ? { pointerEvents: 'none', opacity: 0.85 } : {}}>

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
                      disabled={!currentFeatures.checklists}
                      onChange={() => handleToggleCheckItem(item.id)}
                    />
                    <span className={`checklist-item-text ${item.completed ? 'completed' : ''}`}>
                      {item.text}
                    </span>
                    {currentFeatures.checklists && (
                      <button
                        className="delete-checklist-btn"
                        onClick={() => handleDeleteCheckItem(item.id)}
                        title="Xóa việc con này"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Add checklist item form */}
              {currentFeatures.checklists ? (
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
              ) : (
                <div style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px dashed var(--border-glass)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--text-muted)',
                  fontSize: '12.5px',
                  marginTop: '8px'
                }}>
                  <Lock size={13} style={{ color: 'var(--primary)' }} />
                  <span>Gói dịch vụ hiện tại của bạn không hỗ trợ tạo Checklist công việc.</span>
                </div>
              )}
            </div>

            {/* Quản lý Dịch vụ & Giá trị hợp tác (Chỉ dành cho Đối tác) */}
            {isPartner && (
              <div className="modal-services-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="modal-section-title" style={{ marginBottom: 0 }}>
                    <Folder size={16} />
                    <span>Quản lý Dịch vụ & Giá trị hợp tác</span>
                  </div>
                  
                  {!isServiceFormOpen && (
                    <button 
                      type="button"
                      className="btn btn-secondary" 
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={handleOpenAddService}
                    >
                      + Thêm dịch vụ
                    </button>
                  )}
                </div>

                {/* Form Thêm/Sửa Dịch vụ */}
                {isServiceFormOpen && (
                  <form onSubmit={handleSaveService} className="service-form-box">
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', color: 'var(--primary)' }}>
                      {editingServiceId ? 'Chỉnh sửa dịch vụ' : 'Thêm dịch vụ mới'}
                    </h4>
                    
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 2, minWidth: '200px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tên dịch vụ</label>
                        <input
                          type="text"
                          placeholder="Ví dụ: Thiết kế Website, Ads Facebook..."
                          className="checklist-input"
                          style={{ width: '100%', boxSizing: 'border-box' }}
                          value={serviceName}
                          onChange={(e) => setServiceName(e.target.value)}
                          required
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: '120px' }}>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Đơn giá (VND)</label>
                        <input
                          type="number"
                          placeholder="Nhập giá..."
                          className="checklist-input"
                          style={{ width: '100%', boxSizing: 'border-box' }}
                          value={servicePrice}
                          onChange={(e) => setServicePrice(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Danh sách trường dữ liệu động (Custom Fields) */}
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Các thông số lưu trữ động (Dynamic Fields)</span>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '2px 8px', fontSize: '10px' }}
                          onClick={handleAddCustomField}
                        >
                          + Thêm thông số
                        </button>
                      </div>

                      {serviceCustomFields.length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '8px' }}>
                          Chưa cấu hình thông số nào. Nhấn "+ Thêm thông số" để lưu trữ các thuộc tính riêng của dịch vụ.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {serviceCustomFields.map((field, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                type="text"
                                placeholder="Tên thông số (Ví dụ: Số lượng, Thời hạn, Kênh...)"
                                className="checklist-input"
                                style={{ flex: 1, fontSize: '12px' }}
                                value={field.key}
                                onChange={(e) => handleUpdateCustomField(idx, 'key', e.target.value)}
                                required
                              />
                              <input
                                type="text"
                                placeholder="Giá trị lưu trữ..."
                                className="checklist-input"
                                style={{ flex: 1, fontSize: '12px' }}
                                value={field.value}
                                onChange={(e) => handleUpdateCustomField(idx, 'value', e.target.value)}
                              />
                              <button
                                type="button"
                                className="delete-checklist-btn"
                                style={{ padding: '4px' }}
                                onClick={() => handleRemoveCustomField(idx)}
                                title="Xóa thông số này"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                        onClick={() => setIsServiceFormOpen(false)}
                      >
                        Hủy
                      </button>
                      <button 
                        type="submit" 
                        className="btn btn-primary" 
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        Lưu dịch vụ
                      </button>
                    </div>
                  </form>
                )}

                {/* Danh sách Dịch vụ hiện có */}
                {services.length === 0 ? (
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 12px 0 12px' }}>
                    Chưa khai báo loại dịch vụ nào cho đối tác này. Hãy nhấn nút "+ Thêm dịch vụ" ở trên để thiết lập.
                  </div>
                ) : (
                  <div className="services-list-container" style={{ marginTop: '10px' }}>
                    <table className="services-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                      <thead>
                        <tr style={{ textAlign: 'left' }}>
                          <th style={{ padding: '8px 4px', color: 'var(--text-secondary)' }}>Tên dịch vụ</th>
                          <th style={{ padding: '8px 4px', color: 'var(--text-secondary)' }}>Đơn giá</th>
                          <th style={{ padding: '8px 4px', color: 'var(--text-secondary)' }}>Thông số lưu trữ</th>
                          <th style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--text-secondary)' }}>Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {services.map(srv => (
                          <tr key={srv.id}>
                            <td style={{ padding: '8px 4px', fontWeight: 'bold' }}>{srv.name}</td>
                            <td style={{ padding: '8px 4px', color: 'var(--success)' }}>
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(srv.price)}
                            </td>
                            <td style={{ padding: '8px 4px' }}>
                              {srv.customFields && srv.customFields.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  {srv.customFields.map((f, i) => (
                                    <div key={i} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                      <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{f.key}</span>: {f.value}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '11px' }}>Không có thông số thêm</span>
                              )}
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                <button 
                                  type="button"
                                  className="btn btn-secondary" 
                                  style={{ padding: '4px 8px', fontSize: '11px' }}
                                  onClick={() => handleOpenEditService(srv)}
                                >
                                  Sửa
                                </button>
                                <button 
                                  type="button"
                                  className="delete-checklist-btn" 
                                  style={{ padding: '4px' }}
                                  onClick={() => handleDeleteService(srv.id)}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Tổng chi phí dịch vụ */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px', paddingRight: '8px', fontSize: '13px' }}>
                      <div>
                        <span>Tổng chi phí dịch vụ: </span>
                        <span style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--success)' }}>
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(
                            services.reduce((sum, srv) => sum + srv.price, 0)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Activity Logs Section */}
            <div className="activity-log-container" style={{ position: 'relative', overflow: 'hidden' }}>
              <div className="modal-section-title">
                <Clock size={16} />
                <span>Nhật ký hoạt động</span>
              </div>
              {!currentFeatures.activityLogs ? (
                <div style={{
                  padding: '12px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed var(--border-glass)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--text-muted)',
                  fontSize: '12.5px'
                }}>
                  <Lock size={14} style={{ color: 'var(--primary)' }} />
                  <span>Lịch sử hoạt động khả dụng từ gói PRO trở lên.</span>
                </div>
              ) : activities.length > 0 ? (
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

            {/* Đối tác liên kết Selection (Only for Tasks) */}
            {!isPartner && (
              <div className="sidebar-section" style={{ marginBottom: '16px' }}>
                <div className="modal-section-title">
                  <Users size={14} style={{ marginRight: '4px' }} />
                  <span>Đối tác liên kết</span>
                </div>
                <select
                  className="meta-select"
                  value={linkedPartnerId || ''}
                  onChange={(e) => {
                    const val = e.target.value || '';
                    setLinkedPartnerId(val);
                    saveField('linkedPartnerId', val || null);
                  }}
                  disabled={effectiveReadOnly}
                >
                  <option value="">(Không liên kết đối tác)</option>
                  {allPartnerCards.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tags Selection */}
            <div className="sidebar-section" style={{ marginBottom: '16px' }}>
              <div className="modal-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Tag size={14} style={{ marginRight: '4px' }} />
                  <span>Nhãn dán (Labels)</span>
                </div>
                {!effectiveReadOnly && (
                  <button
                    type="button"
                    onClick={() => setIsManagingTags(!isManagingTags)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: isManagingTags ? 'var(--primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '2px',
                      borderRadius: '4px',
                      transition: 'color 0.15s ease'
                    }}
                    title="Quản lý nhãn dán"
                  >
                    <Settings size={14} />
                  </button>
                )}
              </div>

              {isManagingTags ? (
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '8px',
                  padding: '10px',
                  marginTop: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {availableTags.map((t) => (
                    <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => handleCycleTagColor(t.key)}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          backgroundColor: t.bg,
                          border: `1.5px solid ${t.text}`,
                          cursor: 'pointer',
                          padding: 0
                        }}
                        title="Nhấp để đổi màu nhãn"
                      />
                      <input
                        type="text"
                        value={t.label}
                        onChange={(e) => handleRenameTag(t.key, e.target.value)}
                        style={{
                          flex: 1,
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-glass)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '12px',
                          color: 'var(--text-primary)'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteTag(t.key)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px'
                        }}
                        title="Xóa nhãn"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddNewTag}
                    className="btn btn-secondary"
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      marginTop: '4px'
                    }}
                  >
                    <Plus size={12} /> Thêm nhãn mới
                  </button>
                </div>
              ) : (
                <div className="tags-selector-grid" style={{ marginTop: '6px' }}>
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
              )}
            </div>

            {/* Assignee Selection Section */}
            <div className="sidebar-section" style={{ marginBottom: '16px' }}>
              <div className="modal-section-title">
                <Users size={14} style={{ marginRight: '4px' }} />
                <span>Người thực hiện</span>
              </div>
              <div style={{ marginTop: '4px' }}>
                <select
                  className="meta-input"
                  value={assigneeId}
                  onChange={(e) => {
                    const val = e.target.value || null;
                    setAssigneeId(val || '');
                    saveField('assigneeId', val);
                  }}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: 'var(--border-radius-sm)',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">-- Chưa phân công --</option>
                  {workspaceMembers.map(member => {
                    const getRoleLabel = (role) => {
                      switch (role) {
                        case 'MNG': return 'Trưởng nhóm';
                        case 'StaffMKT': return 'Nhân viên Marketing';
                        case 'StaffVH': return 'Nhân viên Vận hành';
                        case 'admin': return 'Quản trị viên';
                        default: return 'Thành viên';
                      }
                    };
                    return (
                      <option key={member.id} value={member.id}>
                        {member.username} ({getRoleLabel(member.role)})
                      </option>
                    );
                  })}
                </select>
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
