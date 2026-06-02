import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  KanbanSquare, 
  Sun, 
  Moon, 
  Download, 
  Upload, 
  Search, 
  Plus, 
  Filter,
  CheckCircle,
  HelpCircle,
  Menu,
  RotateCcw,
  Users,
  CalendarDays,
  Cloud,
  CloudOff,
  RefreshCw
} from 'lucide-react';
import Board from './components/Board';
import Dashboard from './components/Dashboard';
import CardModal from './components/CardModal';
import Sidebar from './components/Sidebar';
import Planner from './components/Planner';
import LoginRegister from './components/LoginRegister';

// Available tag list for reference
const AVAILABLE_TAGS = [
  { key: 'high', bg: '#fef2f2', text: '#ef4444', label: 'Khẩn cấp' },
  { key: 'medium', bg: '#fffbeb', text: '#f59e0b', label: 'Quan trọng' },
  { key: 'low', bg: '#f0fdf4', text: '#10b981', label: 'Bình thường' },
  { key: 'design', bg: '#f5f3ff', text: '#8b5cf6', label: 'Design' },
  { key: 'feature', bg: '#ecfeff', text: '#06b6d4', label: 'Feature' },
  { key: 'bug', bg: '#fff1f2', text: '#f43f5e', label: 'Bug' },
];

const AVAILABLE_PARTNER_TAGS = [
  { key: 'strategic', bg: '#fdf2f8', text: '#db2777', label: 'Chiến lược' },
  { key: 'potential', bg: '#f0fdf4', text: '#16a34a', label: 'Tiềm năng' },
  { key: 'active', bg: '#f0f9ff', text: '#0284c7', label: 'Đang hợp tác' },
  { key: 'media', bg: '#f5f3ff', text: '#7c3aed', label: 'Truyền thông' },
  { key: 'tech', bg: '#ecfeff', text: '#0891b2', label: 'Công nghệ' },
  { key: 'service', bg: '#fffbeb', text: '#d97706', label: 'Dịch vụ' }
];

const INITIAL_CATEGORIES = [
  { id: 'cat-1', name: 'SEO 🔍', parentId: null },
  { id: 'cat-1-1', name: 'Technical SEO 🛠️', parentId: 'cat-1' },
  { id: 'cat-1-2', name: 'Content SEO ✍️', parentId: 'cat-1' },
  { id: 'cat-2', name: 'MKT Performance ⚡', parentId: null },
  { id: 'cat-3', name: 'MKT Brand 🎨', parentId: null },
  { id: 'cat-4', name: 'Đối tác 🤝', parentId: null },
];

const INITIAL_COLUMNS = [
  { id: 'col-1', title: 'Cần thực hiện 📋', cardIds: ['card-1', 'card-4'], color: '#3b82f6' },
  { id: 'col-2', title: 'Đang triển khai ⚡', cardIds: ['card-2'], color: '#f59e0b' },
  { id: 'col-3', title: 'Kiểm duyệt (Review) 👀', cardIds: ['card-3'], color: '#8b5cf6' },
  { id: 'col-4', title: 'Hoàn thành 🎉', cardIds: ['card-5'], color: '#10b981' },
];

const INITIAL_PARTNER_COLUMNS = [
  { id: 'part-col-1', title: 'Đối tác Tiềm năng 🌟', cardIds: ['partner-card-1'], color: '#ec4899' },
  { id: 'part-col-2', title: 'Đang liên hệ 📞', cardIds: [], color: '#a855f7' },
  { id: 'part-col-3', title: 'Hợp tác chính thức 🤝', cardIds: ['partner-card-2'], color: '#3b82f6' },
  { id: 'part-col-4', title: 'Tạm dừng / Lưu trữ 📁', cardIds: [], color: '#10b981' },
];

const INITIAL_CARDS = [
  {
    id: 'partner-card-1',
    title: 'Công ty TNHH Giải pháp Công nghệ Vintech',
    description: 'Đối tác tiềm năng cung cấp dịch vụ hạ tầng đám mây. Đang chuẩn bị gửi đề xuất hợp tác gói dịch vụ VIP.',
    tags: ['potential'],
    startDate: '',
    dueDate: '',
    estimatedDuration: 60,
    checklist: [
      { id: 'p-ch-1', text: 'Tìm hiểu hồ sơ năng lực', completed: true },
      { id: 'p-ch-2', text: 'Liên hệ người phụ trách kinh doanh', completed: false }
    ],
    categoryId: 'cat-4', // Đối tác 🤝
    activities: []
  },
  {
    id: 'partner-card-2',
    title: 'Đại lý Truyền thông MediaMax',
    description: 'Đối tác chính thức phụ trách các chiến dịch KOLs & Influencers. Đã ký hợp đồng khung thời hạn 1 năm.',
    tags: ['strategic'],
    startDate: '2026-05-15',
    dueDate: '2027-05-15',
    estimatedDuration: 120,
    checklist: [],
    categoryId: 'cat-4', // Đối tác 🤝
    activities: [
      { id: 'act-p-1', timestamp: '10:00:00 20/05', text: 'Ký kết hợp đồng thành công' }
    ]
  },
  {
    id: 'card-1',
    title: 'Nghiên cứu thị trường & đối thủ cạnh tranh',
    description: 'Phân tích điểm mạnh, điểm yếu của 3 đối thủ lớn nhất trong ngành để đề xuất tính năng đột phá.',
    tags: ['high', 'feature'],
    startDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0], // 2 days ago
    dueDate: new Date(Date.now()).toISOString().split('T')[0], // Today
    estimatedDuration: 180,
    checklist: [
      { id: 'ch-1', text: 'Tìm kiếm danh sách đối thủ', completed: true },
      { id: 'ch-2', text: 'Phân tích bảng giá & dịch vụ', completed: true },
      { id: 'ch-3', text: 'Lập báo cáo so sánh (SWOT)', completed: false },
      { id: 'ch-4', text: 'Họp đội ngũ thống nhất kế hoạch', completed: false }
    ],
    categoryId: 'cat-2', // MKT Performance
    activities: [
      { id: 'act-demo-1', timestamp: '14:30:15 30/05', text: 'Khởi tạo công việc' },
      { id: 'act-demo-2', timestamp: '16:45:20 30/05', text: 'Gán danh mục "MKT Performance"' }
    ]
  },
  {
    id: 'card-2',
    title: 'Thiết kế giao diện UI/UX của ZenBoard',
    description: 'Thiết kế các bản mockup cho giao diện Kanban, trang Dashboard và Dialog chi tiết công việc trên Figma.',
    tags: ['design', 'feature'],
    startDate: new Date(Date.now()).toISOString().split('T')[0], // Today
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    estimatedDuration: 120,
    checklist: [
      { id: 'ch-5', text: 'Thiết kế hệ màu Light/Dark Mode', completed: true },
      { id: 'ch-6', text: 'Vẽ Wireframe chi tiết thẻ', completed: false },
      { id: 'ch-7', text: 'Tạo Prototype chuyển động kéo thả', completed: false }
    ],
    categoryId: 'cat-2', // MKT Performance
    activities: [
      { id: 'act-demo-3', timestamp: '09:00:00 01/06', text: 'Khởi tạo công việc và gán nhãn dán "Design"' }
    ]
  },
  {
    id: 'card-3',
    title: 'Khắc phục lỗi đăng nhập trên Safari',
    description: 'Người dùng báo cáo không thể click nút đăng nhập Google trên Safari phiên bản 17.4.',
    tags: ['high', 'bug'],
    startDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0], // 2 days ago
    dueDate: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday (Overdue)
    estimatedDuration: 45,
    checklist: [
      { id: 'ch-8', text: 'Tái hiện lỗi trên thiết bị thử nghiệm', completed: true },
      { id: 'ch-9', text: 'Cập nhật thư viện OAuth', completed: false }
    ],
    categoryId: 'cat-1-1', // Technical SEO
    activities: [
      { id: 'act-demo-4', timestamp: '10:15:30 30/05', text: 'Di chuyển từ cột "Cần thực hiện" sang cột "Kiểm duyệt"' }
    ]
  },
  {
    id: 'card-4',
    title: 'Viết bài viết ra mắt sản phẩm',
    description: 'Chuẩn bị bài blog truyền thông và các bài đăng social media cho ngày ra mắt ứng dụng.',
    tags: ['low'],
    dueDate: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0], // 4 days later
    estimatedDuration: 90,
    checklist: [],
    categoryId: 'cat-1-2' // Content SEO
  },
  {
    id: 'card-5',
    title: 'Tối ưu hóa tốc độ tải trang (LCP)',
    description: 'Chuyển đổi toàn bộ định dạng ảnh sang WebP, nén bundle JavaScript và thiết lập CDN để LCP dưới 1.5s.',
    tags: ['medium', 'feature'],
    startDate: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0], // 5 days ago
    dueDate: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0], // 3 days ago
    estimatedDuration: 150,
    checklist: [
      { id: 'ch-10', text: 'Nén toàn bộ tài nguyên hình ảnh', completed: true },
      { id: 'ch-11', text: 'Cấu hình lazy loading', completed: true }
    ],
    categoryId: 'cat-1-1', // Technical SEO
    activities: [
      { id: 'act-demo-5', timestamp: '08:30:10 27/05', text: 'Khởi tạo công việc' },
      { id: 'act-demo-6', timestamp: '17:00:00 29/05', text: 'Di chuyển sang cột "Hoàn thành" sau khi tối ưu đạt chuẩn' }
    ]
  }
];

const ensureCompletedColumnAtEnd = (cols, completedId) => {
  const completedCol = cols.find(c => c.id === completedId);
  if (!completedCol) return cols;
  const otherCols = cols.filter(c => c.id !== completedId);
  return [...otherCols, completedCol];
};

const API_BASE_URL = import.meta.env.VITE_API_URL || (
  typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.port === '5173'
  )
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : ''
);

export default function App() {
  // Auth states
  const [token, setToken] = useState(() => localStorage.getItem('zenboard_token') || '');
  const [username, setUsername] = useState(() => localStorage.getItem('zenboard_username') || '');

  const handleAuthSuccess = (newToken, newUsername) => {
    localStorage.setItem('zenboard_token', newToken);
    localStorage.setItem('zenboard_username', newUsername);
    setToken(newToken);
    setUsername(newUsername);
    setIsInitialLoaded(false); // Trigger database load
  };

  const handleLogout = () => {
    localStorage.removeItem('zenboard_token');
    localStorage.removeItem('zenboard_username');
    setToken('');
    setUsername('');
    // Reset core states to default
    setCategories(INITIAL_CATEGORIES);
    setColumns(ensureCompletedColumnAtEnd(INITIAL_COLUMNS, 'col-4'));
    setPartnerColumns(ensureCompletedColumnAtEnd(INITIAL_PARTNER_COLUMNS, 'part-col-4'));
    setCards(INITIAL_CARDS);
    setIsInitialLoaded(false);
  };

  // Main states
  const [columns, setColumns] = useState(() => ensureCompletedColumnAtEnd(INITIAL_COLUMNS, 'col-4'));
  const [partnerColumns, setPartnerColumns] = useState(() => ensureCompletedColumnAtEnd(INITIAL_PARTNER_COLUMNS, 'part-col-4'));
  const [cards, setCards] = useState(INITIAL_CARDS);
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [activeCategoryId, setActiveCategoryId] = useState('all');

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('zenboard_theme');
    return saved || 'dark';
  });

  const [collapsedColIds, setCollapsedColIds] = useState([]);

  const handleToggleCollapseColumn = (colId) => {
    setCollapsedColIds(prev => 
      prev.includes(colId) ? prev.filter(id => id !== colId) : [...prev, colId]
    );
  };

  const [activeTab, setActiveTab] = useState('dashboard'); // 'board', 'planner', 'partners' or 'dashboard'
  const [dashboardSubTab, setDashboardSubTab] = useState('tasks'); // 'tasks' or 'partners'
  const [plannerBacklogFilter, setPlannerBacklogFilter] = useState('all'); // 'all', 'urgent', 'no-due', 'short'
  const [plannerScheduleView, setPlannerScheduleView] = useState('day'); // 'day', 'week', 'month'
  const [autoInsertBreaks, setAutoInsertBreaks] = useState(true);
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(1500); // 25 mins
  const [pomodoroIsRunning, setPomodoroIsRunning] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState('work'); // 'work', 'short', 'long'

  // Pomodoro ticking effect
  useEffect(() => {
    let interval = null;
    if (pomodoroIsRunning && pomodoroTimeLeft > 0) {
      interval = setInterval(() => {
        setPomodoroTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (pomodoroTimeLeft === 0 && pomodoroIsRunning) {
      setPomodoroIsRunning(false);
      if (pomodoroMode === 'work') {
        alert('Đã hoàn thành phiên tập trung Pomodoro! Hãy nghỉ ngơi một chút ☕');
        setPomodoroMode('short');
        setPomodoroTimeLeft(300); // 5 mins
      } else {
        alert('Hết giờ nghỉ ngơi! Bắt đầu phiên làm việc mới nào 🎯');
        setPomodoroMode('work');
        setPomodoroTimeLeft(1500); // 25 mins
      }
    }
    return () => clearInterval(interval);
  }, [pomodoroIsRunning, pomodoroTimeLeft, pomodoroMode]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState([]); // Array of active tag keys

  const [todaySchedule, setTodaySchedule] = useState([]);

  const [workdayDuration, setWorkdayDuration] = useState(480);

  // Card modal state
  const [selectedCardInfo, setSelectedCardInfo] = useState(null); // { card, columnId }
  const fileInputRef = useRef(null);

  // Sync theme preference to localStorage
  useEffect(() => {
    localStorage.setItem('zenboard_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Google Sheets sync state
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'synced', 'error'
  const [lastSyncTime, setLastSyncTime] = useState('');
  const [syncErrorMessage, setSyncErrorMessage] = useState('');
  const [googleSheetDisplayUrl, setGoogleSheetDisplayUrl] = useState('');

  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);

  const handleSyncToGoogleSheets = async (customCards = cards, customCats = categories) => {
    if (!googleSheetUrl) {
      setSyncStatus('error');
      setSyncErrorMessage('Vui lòng cấu hình URL Google Apps Script Web App trước!');
      return;
    }
    
    setSyncStatus('syncing');
    const payload = {
      cards: customCards,
      categories: customCats,
      columns: columns.map(c => ({ id: c.id, title: c.title }))
    };

    try {
      // 1. Thử nghiệm kết nối tiêu chuẩn có CORS để đọc phản hồi thành công từ Apps Script
      const response = await fetch(googleSheetUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });
      
      const resData = await response.json();
      if (resData.status === 'success') {
        setSyncStatus('synced');
        const nowStr = new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        setLastSyncTime(nowStr);
        setSyncErrorMessage('');
      } else {
        setSyncStatus('error');
        setSyncErrorMessage(resData.message || 'Lỗi xử lý của Script.');
      }
    } catch (err) {
      console.warn('Lỗi CORS hoặc mạng, đang thử lại bằng chế độ fallback no-cors...', err);
      
      // 2. Chế độ Fallback: Gửi bằng no-cors (Dữ liệu vẫn ghi lên Sheet bình thường nhưng trình duyệt bỏ qua đọc phản hồi)
      try {
        await fetch(googleSheetUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify(payload)
        });
        
        setSyncStatus('synced');
        const nowStr = new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        setLastSyncTime(nowStr + ' (Đồng bộ không phản hồi)');
        setSyncErrorMessage(
          'Đã gửi dữ liệu sang Google Sheet! Lưu ý: Nếu dữ liệu vẫn chưa hiển thị, vui lòng kiểm tra xem bạn đã cấu hình "Ai có quyền truy cập (Who has access): Bất kỳ ai (Anyone)" trong phần Triển khai Web App của Google Sheets chưa.'
        );
      } catch (fallbackErr) {
        console.error('ZenBoard Sync Fallback Error:', fallbackErr);
        setSyncStatus('error');
        setSyncErrorMessage('Không thể kết nối đến Web App. Vui lòng kiểm tra lại URL hoặc mạng.');
      }
    }
  };

  const syncTimeoutRef = useRef(null);

  // Debounced auto-sync when cards, categories, or columns change
  useEffect(() => {
    if (isAutoSyncEnabled && googleSheetUrl) {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      setSyncStatus('syncing');
      syncTimeoutRef.current = setTimeout(() => {
        handleSyncToGoogleSheets();
      }, 2000);
    }
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [cards, categories, columns, isAutoSyncEnabled, googleSheetUrl]);

  // Tải dữ liệu ban đầu từ PostgreSQL Database
  useEffect(() => {
    if (!token) {
      setIsInitialLoaded(true);
      return;
    }
    const loadBoardFromDatabase = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/board`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.status === 401 || response.status === 403) {
          handleLogout();
          return;
        }
        if (!response.ok) throw new Error('Không thể tải dữ liệu từ máy chủ API.');
        
        const data = await response.json();
        
        if (data.categories && data.columns && data.cards) {
          // Chỉ nạp nếu cơ sở dữ liệu đã có dữ liệu thực tế (tránh nạp trống đè cấu hình)
          if (data.columns.length > 0 || data.cards.length > 0 || data.categories.length > 0) {
            setCategories(data.categories);
            setColumns(data.columns);
            if (data.partnerColumns) setPartnerColumns(data.partnerColumns);
            setCards(data.cards);
            
            if (data.settings) {
              if (data.settings.todaySchedule) setTodaySchedule(data.settings.todaySchedule);
              if (data.settings.workdayDuration) setWorkdayDuration(data.settings.workdayDuration);
              if (data.settings.googleSheetUrl) setGoogleSheetUrl(data.settings.googleSheetUrl);
              if (data.settings.googleSheetDisplayUrl) setGoogleSheetDisplayUrl(data.settings.googleSheetDisplayUrl);
              if (data.settings.isAutoSyncEnabled !== undefined) setIsAutoSyncEnabled(data.settings.isAutoSyncEnabled);
              if (data.settings.lastSyncTime) setLastSyncTime(data.settings.lastSyncTime);
            }
          } else {
            // Cơ sở dữ liệu rỗng, tiến hành ghi đè dữ liệu mẫu mặc định lên DB
            console.log('ZenBoard: Database rỗng, đang khởi tạo dữ liệu mẫu lên PostgreSQL...');
            try {
              await fetch(`${API_BASE_URL}/api/board/sync`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  categories: INITIAL_CATEGORIES,
                  columns: ensureCompletedColumnAtEnd(INITIAL_COLUMNS, 'col-4'),
                  partnerColumns: ensureCompletedColumnAtEnd(INITIAL_PARTNER_COLUMNS, 'part-col-4'),
                  cards: INITIAL_CARDS,
                  settings: {
                    todaySchedule: [],
                    workdayDuration: 480,
                    googleSheetUrl: '',
                    googleSheetDisplayUrl: '',
                    isAutoSyncEnabled: false,
                    lastSyncTime: ''
                  }
                })
              });
              console.log('ZenBoard: Khởi tạo dữ liệu mẫu thành công!');
            } catch (syncErr) {
              console.error('Lỗi khởi tạo dữ liệu mẫu:', syncErr);
            }
          }
          setIsBackendConnected(true);
          console.log('ZenBoard: Đã kết nối và tải dữ liệu từ PostgreSQL Database thành công!');
        }
      } catch (err) {
        console.warn('ZenBoard: Không thể kết nối với Backend Server. Sử dụng cấu hình mặc định (Offline).', err.message);
        setIsBackendConnected(false);
      } finally {
        setIsInitialLoaded(true);
      }
    };
    
    loadBoardFromDatabase();
  }, [token]);

  const backendSyncTimeoutRef = useRef(null);

  // Tự động đồng bộ sang PostgreSQL Database (Debounced 1.5 giây)
  useEffect(() => {
    if (!isInitialLoaded || !token) return;

    if (backendSyncTimeoutRef.current) {
      clearTimeout(backendSyncTimeoutRef.current);
    }

    backendSyncTimeoutRef.current = setTimeout(async () => {
      try {
        const payload = {
          categories,
          columns,
          partnerColumns,
          cards,
          settings: {
            todaySchedule,
            workdayDuration,
            googleSheetUrl,
            googleSheetDisplayUrl,
            isAutoSyncEnabled,
            lastSyncTime
          }
        };

        const response = await fetch(`${API_BASE_URL}/api/board/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        
        if (response.status === 401 || response.status === 403) {
          handleLogout();
          return;
        }

        if (response.ok) {
          setIsBackendConnected(true);
          console.log('ZenBoard: Đã đồng bộ dữ liệu sang PostgreSQL.');
        } else {
          throw new Error('Lỗi đồng bộ.');
        }
      } catch (err) {
        console.warn('ZenBoard: Không thể kết nối đồng bộ Backend PostgreSQL.', err.message);
        setIsBackendConnected(false);
      }
    }, 1500);

    return () => {
      if (backendSyncTimeoutRef.current) {
        clearTimeout(backendSyncTimeoutRef.current);
      }
    };
  }, [categories, columns, partnerColumns, cards, todaySchedule, workdayDuration, googleSheetUrl, googleSheetDisplayUrl, isAutoSyncEnabled, lastSyncTime, isInitialLoaded, token]);

  const partnerRootId = (() => {
    const partnerCat = categories.find(c => !c.parentId && c.name.includes('Đối tác'));
    return partnerCat ? partnerCat.id : 'cat-4';
  })();

  // Helper to check if active category belongs to Partner branch
  const isPartnerActive = activeTab === 'partners';


  const currentColumns = isPartnerActive ? partnerColumns : columns;
  const setCurrentColumns = (newColsOrFn) => {
    const setter = isPartnerActive ? setPartnerColumns : setColumns;
    const completedId = isPartnerActive ? 'part-col-4' : 'col-4';
    
    if (typeof newColsOrFn === 'function') {
      setter(prev => {
        const next = newColsOrFn(prev);
        return ensureCompletedColumnAtEnd(next, completedId);
      });
    } else {
      setter(ensureCompletedColumnAtEnd(newColsOrFn, completedId));
    }
  };

  // Helper to check if a card belongs to Partner category tree
  const checkIsCardPartner = (card) => {
    if (!card.categoryId) return false;
    if (card.categoryId === partnerRootId) return true;
    let currentId = card.categoryId;
    let limit = 10;
    while (currentId && limit > 0) {
      const cat = categories.find(c => c.id === currentId);
      if (!cat) break;
      if (cat.parentId === partnerRootId) return true;
      currentId = cat.parentId;
      limit--;
    }
    return false;
  };

  // Recursively find all descendant category IDs
  const getDescendantIds = (catId, list) => {
    let result = [];
    const children = list.filter(c => c.parentId === catId);
    children.forEach(child => {
      result.push(child.id);
      result = [...result, ...getDescendantIds(child.id, list)];
    });
    return result;
  };

  // Drag and Drop Logic
  const [draggedCardId, setDraggedCardId] = useState(null);
  const targetCardIdRef = useRef(null);
  const targetColumnIdRef = useRef(null);

  const handleDragStart = (cardId) => {
    setDraggedCardId(cardId);
  };

  const handleDragEnd = () => {
    if (draggedCardId && targetColumnIdRef.current) {
      handleDropCard(draggedCardId, null, targetColumnIdRef.current, targetCardIdRef.current);
    }
    setDraggedCardId(null);
    targetCardIdRef.current = null;
    targetColumnIdRef.current = null;
  };

  const handleDragOverCard = (e, cardId, columnId) => {
    targetCardIdRef.current = cardId;
    targetColumnIdRef.current = columnId;
  };

  const handleDropCard = (cardId, sourceColId, targetColId, targetCardId = null) => {
    let actualSourceColId = sourceColId;
    if (!actualSourceColId) {
      const sourceCol = currentColumns.find(col => col.cardIds.includes(cardId));
      if (sourceCol) {
        actualSourceColId = sourceCol.id;
      }
    }

    if (!actualSourceColId) return;

    // 1. Move columns
    setCurrentColumns(prevColumns => {
      return prevColumns.map(col => {
        let newCardIds = [...col.cardIds];
        
        if (col.id === actualSourceColId) {
          newCardIds = newCardIds.filter(id => id !== cardId);
        }

        if (col.id === targetColId) {
          newCardIds = newCardIds.filter(id => id !== cardId);
          
          if (targetCardId) {
            const targetIndex = newCardIds.indexOf(targetCardId);
            newCardIds.splice(targetIndex, 0, cardId);
          } else {
            newCardIds.push(cardId);
          }
        }

        return { ...col, cardIds: newCardIds };
      });
    });

    // 2. Log activity if columns changed
    if (actualSourceColId !== targetColId) {
      const sourceCol = currentColumns.find(c => c.id === actualSourceColId);
      const targetCol = currentColumns.find(c => c.id === targetColId);
      if (sourceCol && targetCol) {
        const timestamp = new Date().toLocaleString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          day: '2-digit',
          month: '2-digit',
        });
        
        const newLog = {
          id: `act-${Date.now()}`,
          timestamp,
          text: `Di chuyển từ cột "${sourceCol.title}" sang cột "${targetCol.title}"`
        };

        setCards(prevCards => {
          return prevCards.map(c => {
            if (c.id === cardId) {
              const updatedCard = {
                ...c,
                activities: [newLog, ...(c.activities || [])]
              };
              
              // Sync active modal if it corresponds to this card
              if (selectedCardInfo && selectedCardInfo.card.id === cardId) {
                // Wait a tick to allow selected card to sync
                setTimeout(() => {
                  setSelectedCardInfo({ card: updatedCard, columnId: targetColId });
                }, 0);
              }
              
              return updatedCard;
            }
            return c;
          });
        });
      }
    }

    // Auto-evict card from planner schedule if dropped into completed/archive columns
    if (targetColId === 'col-4' || targetColId === 'part-col-4') {
      setTodaySchedule(prev => prev.filter(id => id !== cardId));
    }
  };

  // Add Category (Root or Sub)
  const handleAddCategory = (name, parentId = null) => {
    const newCat = {
      id: `cat-${Date.now()}`,
      name,
      parentId: parentId || (isPartnerActive ? partnerRootId : null)
    };
    setCategories([...categories, newCat]);
  };

  // Rename Category
  const handleUpdateCategory = (id, name) => {
    setCategories(categories.map(c => c.id === id ? { ...c, name } : c));
  };

  // Delete Category (Cascade move cards to uncategorized)
  const handleDeleteCategory = (catId) => {
    const descendants = getDescendantIds(catId, categories);
    const deleteList = [catId, ...descendants];

    // Remove categories
    setCategories(categories.filter(c => !deleteList.includes(c.id)));

    // Update cards belonging to deleted categories
    setCards(cards.map(card => {
      if (deleteList.includes(card.categoryId)) {
        return { ...card, categoryId: isPartnerActive ? partnerRootId : null };
      }
      return card;
    }));

    // Reset active if it was deleted
    if (deleteList.includes(activeCategoryId)) {
      setActiveCategoryId(isPartnerActive ? partnerRootId : 'all');
    }
  };

  // Add Column
  const handleAddColumn = (title, color = '#3b82f6') => {
    const newColId = isPartnerActive ? `part-col-${Date.now()}` : `col-${Date.now()}`;
    const newColumn = {
      id: newColId,
      title,
      cardIds: [],
      color,
    };

    const completedColId = isPartnerActive ? 'part-col-4' : 'col-4';
    const completedIndex = currentColumns.findIndex(col => col.id === completedColId);

    if (completedIndex !== -1) {
      const updatedColumns = [...currentColumns];
      updatedColumns.splice(completedIndex, 0, newColumn);
      setCurrentColumns(updatedColumns);
    } else {
      setCurrentColumns([...currentColumns, newColumn]);
    }
  };

  // Delete Column
  const handleDeleteColumn = (colId) => {
    // Safety check: Cannot delete system completed columns
    if (colId === 'col-4' || colId === 'part-col-4') {
      alert('Không thể xóa cột hệ thống cố định!');
      return;
    }

    const colToDelete = currentColumns.find(c => c.id === colId);
    if (!colToDelete) return;

    const cardsToKeep = cards.filter(c => !colToDelete.cardIds.includes(c.id));
    setCards(cardsToKeep);
    setCurrentColumns(currentColumns.filter(c => c.id !== colId));
  };

  // Update Column Title
  const handleUpdateColumnTitle = (colId, newTitle) => {
    // Safety check: Cannot rename system completed columns
    if (colId === 'col-4' || colId === 'part-col-4') {
      return;
    }

    setCurrentColumns(currentColumns.map(col => 
      col.id === colId ? { ...col, title: newTitle } : col
    ));
  };

  // Update Column Color
  const handleUpdateColumnColor = (colId, newColor) => {
    // Safety check: Cannot change color of system completed columns (locked to green)
    if (colId === 'col-4' || colId === 'part-col-4') {
      return;
    }

    setCurrentColumns(currentColumns.map(col => 
      col.id === colId ? { ...col, color: newColor } : col
    ));
  };

  // Add Card to Column
  const handleAddCard = (colId) => {
    const newCardId = `card-${Date.now()}`;
    const newCard = {
      id: newCardId,
      title: isPartnerActive ? 'Đối tác mới' : 'Công việc mới',
      description: '',
      tags: [],
      dueDate: '',
      checklist: [],
      categoryId: (activeCategoryId !== 'all' && activeCategoryId !== 'uncategorized') ? activeCategoryId : (isPartnerActive ? partnerRootId : null)
    };

    setCards([newCard, ...cards]);
    setCurrentColumns(currentColumns.map(col => 
      col.id === colId ? { ...col, cardIds: [newCardId, ...col.cardIds] } : col
    ));

    setSelectedCardInfo({ card: newCard, columnId: colId });
  };

  // Delete Card
  const handleDeleteCard = (cardId, colId) => {
    setCards(cards.filter(c => c.id !== cardId));
    setCurrentColumns(currentColumns.map(col => 
      col.id === colId ? { ...col, cardIds: col.cardIds.filter(id => id !== cardId) } : col
    ));
    setSelectedCardInfo(null);
  };

  // Update Card detail
  const handleUpdateCard = (cardId, colId, updatedCard) => {
    setCards(cards.map(c => c.id === cardId ? updatedCard : c));
    if (selectedCardInfo && selectedCardInfo.card.id === cardId) {
      setSelectedCardInfo({ card: updatedCard, columnId: colId });
    }
  };

  // Filter Cards based on search query, tags, and category selection
  const getFilteredCards = () => {
    return cards.filter(card => {
      // 1. Search Query filter (title or description)
      const matchesSearch = 
        card.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (card.description && card.description.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // 2. Tags filter
      const matchesTags = 
        selectedFilters.length === 0 || 
        selectedFilters.every(filterTag => card.tags && card.tags.includes(filterTag));

      // 3. Category filter
      let matchesCategory = false;
      if (isPartnerActive) {
        if (activeCategoryId === 'all' || activeCategoryId === partnerRootId) {
          const descendants = getDescendantIds(partnerRootId, categories);
          const allowedCategoryIds = [partnerRootId, ...descendants];
          matchesCategory = allowedCategoryIds.includes(card.categoryId);
        } else if (activeCategoryId === 'uncategorized') {
          matchesCategory = card.categoryId === partnerRootId;
        } else {
          const descendants = getDescendantIds(activeCategoryId, categories);
          const allowedCategoryIds = [activeCategoryId, ...descendants];
          matchesCategory = allowedCategoryIds.includes(card.categoryId);
        }
      } else {
        if (activeCategoryId === 'all') {
          matchesCategory = !checkIsCardPartner(card);
        } else if (activeCategoryId === 'uncategorized') {
          matchesCategory = !card.categoryId;
        } else {
          const descendants = getDescendantIds(activeCategoryId, categories);
          const allowedCategoryIds = [activeCategoryId, ...descendants];
          matchesCategory = allowedCategoryIds.includes(card.categoryId);
        }
      }

      return matchesSearch && matchesTags && matchesCategory;
    });
  };

  const filteredCards = getFilteredCards();

  // Task Counts for Sidebar badges
  const getTaskCounts = () => {
    const counts = {};
    if (isPartnerActive) {
      counts['all'] = cards.filter(c => checkIsCardPartner(c)).length;
      counts['uncategorized'] = cards.filter(c => c.categoryId === partnerRootId).length;
    } else {
      counts['all'] = cards.filter(c => !checkIsCardPartner(c)).length;
      counts['uncategorized'] = cards.filter(c => !c.categoryId).length;
    }

    categories.forEach(cat => {
      const descendants = getDescendantIds(cat.id, categories);
      const allowedIds = [cat.id, ...descendants];
      counts[cat.id] = cards.filter(c => allowedIds.includes(c.categoryId)).length;
    });

    return counts;
  };

  const taskCounts = getTaskCounts();

  // Toggle filter tags
  const handleToggleFilter = (tagKey) => {
    if (selectedFilters.includes(tagKey)) {
      setSelectedFilters(selectedFilters.filter(t => t !== tagKey));
    } else {
      setSelectedFilters([...selectedFilters, tagKey]);
    }
  };

  // Export Data to JSON
  const handleExportData = () => {
    const dataStr = JSON.stringify({ columns, partnerColumns, cards, categories }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `zenboard_backup_${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Import Data from JSON
  const handleImportData = (event) => {
    const fileReader = new FileReader();
    const file = event.target.files[0];
    if (!file) return;

    fileReader.onload = (e) => {
      try {
        const parsedData = JSON.parse(e.target.result);
        if (parsedData.columns && parsedData.cards) {
          setColumns(parsedData.columns);
          setCards(parsedData.cards);
          if (parsedData.partnerColumns) {
            setPartnerColumns(parsedData.partnerColumns);
          }
          if (parsedData.categories) {
            setCategories(parsedData.categories);
          }
          alert('Nhập dữ liệu thành công! Bảng ZenBoard của bạn đã được cập nhật.');
        } else {
          alert('Tệp tin không đúng định dạng lưu trữ (cần chứa columns và cards).');
        }
      } catch (err) {
        alert('Đã xảy ra lỗi khi đọc tệp tin JSON.');
      }
    };
    fileReader.readAsText(file);
    event.target.value = '';
  };
  const taskCategories = categories.filter(c => c.id !== partnerRootId && !checkIsCardPartner({ categoryId: c.id }));
  const partnerCategories = categories
    .filter(c => checkIsCardPartner({ categoryId: c.id }) && c.id !== partnerRootId)
    .map(c => c.parentId === partnerRootId ? { ...c, parentId: null } : c);

  if (!token) {
    return (
      <LoginRegister 
        API_BASE_URL={API_BASE_URL} 
        onAuthSuccess={handleAuthSuccess} 
      />
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <button 
            className="btn-icon" 
            style={{ width: '32px', height: '32px', border: 'none', background: 'transparent' }}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? "Thu gọn thanh bên" : "Mở rộng thanh bên"}
          >
            <Menu size={18} />
          </button>
          <div className="logo-icon">
            <KanbanSquare size={18} />
          </div>
          <span className="logo-text">ZenBoard</span>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '10px' }}>
          <button 
            className={`btn ${activeTab === 'board' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', borderRadius: '8px', border: 'none' }}
            onClick={() => {
              setActiveTab('board');
              setActiveCategoryId('all');
              setSelectedFilters([]);
            }}
          >
            <KanbanSquare size={14} />
            <span style={{ fontSize: '12.5px' }}>Bảng công việc</span>
          </button>
          <button 
            className={`btn ${activeTab === 'planner' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', borderRadius: '8px', border: 'none' }}
            onClick={() => {
              setActiveTab('planner');
              setActiveCategoryId('all');
              setSelectedFilters([]);
            }}
          >
            <CalendarDays size={14} />
            <span style={{ fontSize: '12.5px' }}>Lập kế hoạch</span>
          </button>
          <button 
            className={`btn ${activeTab === 'partners' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', borderRadius: '8px', border: 'none' }}
            onClick={() => {
              setActiveTab('partners');
              setActiveCategoryId(partnerRootId);
              setSelectedFilters([]);
            }}
          >
            <Users size={14} />
            <span style={{ fontSize: '12.5px' }}>Bảng Đối tác</span>
          </button>
          <button 
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', borderRadius: '8px', border: 'none' }}
            onClick={() => {
              setActiveTab('dashboard');
              setSelectedFilters([]);
            }}
          >
            <LayoutDashboard size={14} />
            <span style={{ fontSize: '12.5px' }}>Báo cáo Thống kê</span>
          </button>
        </div>

        {/* Global Action Toolbar */}
        <div className="actions-section">
          {/* Database Connection Status Indicator */}
          <div 
            className="database-status-indicator" 
            title={isBackendConnected ? "Đã kết nối PostgreSQL Database 🟢" : "Mất kết nối với PostgreSQL Backend Database (Đang dùng LocalStorage dự phòng) 🔴"}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              borderRadius: '8px',
              fontSize: '11px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-glass)',
              marginRight: '8px',
              color: isBackendConnected ? '#10b981' : '#ef4444'
            }}
          >
            <div 
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isBackendConnected ? '#10b981' : '#ef4444'
              }}
            />
            <span style={{ fontWeight: '500', fontSize: '11px' }}>
              {isBackendConnected ? 'PostgreSQL' : 'Offline'}
            </span>
          </div>

          {/* Cloud Sync Status Indicator */}
          {googleSheetUrl && (
            <div 
              className={`sync-status-indicator ${syncStatus}`} 
              title={
                syncStatus === 'syncing' 
                  ? 'Đang đồng bộ ngầm Google Sheets...' 
                  : syncStatus === 'synced' 
                    ? `Đã đồng bộ Google Sheets thành công (Lúc ${lastSyncTime}) ☁️` 
                    : syncStatus === 'error' 
                      ? `Lỗi đồng bộ Google Sheets: ${syncErrorMessage} ⚠️` 
                      : 'Đồng bộ Google Sheets đang chờ'
              }
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                borderRadius: '8px',
                fontSize: '11px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-glass)',
                marginRight: '8px',
                color: syncStatus === 'syncing' 
                  ? 'var(--warning)' 
                  : syncStatus === 'synced' 
                    ? 'var(--success)' 
                    : syncStatus === 'error' 
                      ? 'var(--danger)' 
                      : 'var(--text-muted)'
              }}
            >
              {syncStatus === 'syncing' ? (
                <RefreshCw size={12} className="spin" />
              ) : syncStatus === 'synced' ? (
                <Cloud size={12} />
              ) : syncStatus === 'error' ? (
                <CloudOff size={12} />
              ) : (
                <Cloud size={12} style={{ opacity: 0.5 }} />
              )}
              <span className="sync-text-hint" style={{ fontWeight: '500' }}>
                {syncStatus === 'syncing' ? 'Đang đồng bộ...' : syncStatus === 'synced' ? 'Đã đồng bộ' : syncStatus === 'error' ? 'Lỗi' : 'Chờ'}
              </span>
            </div>
          )}
          <button className="btn-icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Đổi màu nền">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="btn-icon" onClick={handleExportData} title="Xuất dữ liệu dự án (JSON)">
            <Download size={16} />
          </button>
          <button className="btn-icon" onClick={() => fileInputRef.current.click()} title="Nhập dữ liệu dự án (JSON)">
            <Upload size={16} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".json"
            onChange={handleImportData}
          />
        </div>
      </header>

      {/* Split Layout */}
      <div className="main-layout">
        {/* Slidenav Sidebar Panel */}
        <Sidebar
          categories={isPartnerActive ? partnerCategories : taskCategories}
          activeCategoryId={activeCategoryId}
          setActiveCategoryId={setActiveCategoryId}
          onAddCategory={handleAddCategory}
          onUpdateCategory={handleUpdateCategory}
          onDeleteCategory={handleDeleteCategory}
          taskCounts={taskCounts}
          isCollapsed={!isSidebarOpen}
          isPartnerBoard={isPartnerActive}
          activeTab={activeTab}
          dashboardSubTab={dashboardSubTab}
          setDashboardSubTab={setDashboardSubTab}
          plannerBacklogFilter={plannerBacklogFilter}
          setPlannerBacklogFilter={setPlannerBacklogFilter}
          plannerScheduleView={plannerScheduleView}
          setPlannerScheduleView={setPlannerScheduleView}
          autoInsertBreaks={autoInsertBreaks}
          setAutoInsertBreaks={setAutoInsertBreaks}
          pomodoroTimeLeft={pomodoroTimeLeft}
          setPomodoroTimeLeft={setPomodoroTimeLeft}
          pomodoroIsRunning={pomodoroIsRunning}
          setPomodoroIsRunning={setPomodoroIsRunning}
          pomodoroMode={pomodoroMode}
          setPomodoroMode={setPomodoroMode}
          workdayDuration={workdayDuration}
          setWorkdayDuration={setWorkdayDuration}
          username={username}
          onLogout={handleLogout}
        />

        {/* Board / Dashboard Content Area */}
        <div className="content-area">
          {activeTab === 'board' || activeTab === 'partners' ? (
            <>
              {/* Search and Filters */}
              <div className="toolbar">
                <div className="search-filter-box">
                  <div className="search-input-wrapper">
                    <Search size={14} />
                    <input
                      type="text"
                      placeholder={isPartnerActive ? "Tìm kiếm đối tác..." : "Tìm kiếm công việc..."}
                      className="search-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {/* Filters */}
                <div className="tag-filters">
                  <span 
                    style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', alignSelf: 'center', marginRight: '4px' }}
                  >
                    Nhãn:
                  </span>
                  {(isPartnerActive ? AVAILABLE_PARTNER_TAGS : AVAILABLE_TAGS).map(t => {
                    const isActive = selectedFilters.includes(t.key);
                    return (
                      <span
                        key={t.key}
                        className={`tag-badge ${isActive ? 'active' : ''}`}
                        style={{ 
                          backgroundColor: t.bg, 
                          color: t.text,
                          opacity: isActive ? 1 : 0.6,
                          border: isActive ? `1.5px solid ${t.text}` : '1.5px solid transparent'
                        }}
                        onClick={() => handleToggleFilter(t.key)}
                      >
                        {t.label}
                      </span>
                    );
                  })}
                  {selectedFilters.length > 0 && (
                    <button 
                      className="btn" 
                      style={{ padding: '2px 8px', fontSize: '10px', borderRadius: '12px', background: 'var(--danger-light)', color: 'var(--danger)' }}
                      onClick={() => setSelectedFilters([])}
                    >
                      Xóa lọc
                    </button>
                  )}
                </div>
              </div>

              {/* Board Render */}
              <Board
                columns={currentColumns}
                cards={filteredCards}
                categories={categories}
                collapsedColIds={collapsedColIds}
                onToggleCollapseColumn={handleToggleCollapseColumn}
                onAddCard={handleAddCard}
                onUpdateColumnTitle={handleUpdateColumnTitle}
                onUpdateColumnColor={handleUpdateColumnColor}
                onDeleteColumn={handleDeleteColumn}
                onAddColumn={handleAddColumn}
                onCardClick={(card, colId) => setSelectedCardInfo({ card, columnId: colId })}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOverCard={handleDragOverCard}
                onDropCard={handleDropCard}
              />
            </>
          ) : activeTab === 'planner' ? (
            <Planner
              cards={cards}
              categories={categories}
              columns={columns}
              todaySchedule={todaySchedule}
              setTodaySchedule={setTodaySchedule}
              workdayDuration={workdayDuration}
              setWorkdayDuration={setWorkdayDuration}
              onCardClick={(card, colId) => setSelectedCardInfo({ card, columnId: colId })}
              checkIsCardPartner={checkIsCardPartner}
              backlogFilter={plannerBacklogFilter}
              scheduleView={plannerScheduleView}
              autoInsertBreaks={autoInsertBreaks}
              onUpdateCard={handleUpdateCard}
              setCards={setCards}
            />
          ) : (
            /* Dashboard Render (passing full states to build complete stats) */
            <Dashboard 
              columns={columns} 
              partnerColumns={partnerColumns}
              cards={cards} 
              categories={categories}
              checkIsCardPartner={checkIsCardPartner}
              activeSubTab={dashboardSubTab}
              setActiveSubTab={setDashboardSubTab}
              googleSheetUrl={googleSheetUrl}
              setGoogleSheetUrl={setGoogleSheetUrl}
              isAutoSyncEnabled={isAutoSyncEnabled}
              setIsAutoSyncEnabled={setIsAutoSyncEnabled}
              syncStatus={syncStatus}
              lastSyncTime={lastSyncTime}
              syncErrorMessage={syncErrorMessage}
              onSyncNow={() => handleSyncToGoogleSheets(cards, categories)}
            />
          )}
        </div>
      </div>

      {/* Card Details Modal Dialog */}
      {selectedCardInfo && (() => {
        const isCardPartner = checkIsCardPartner(selectedCardInfo.card);
        const modalCategories = isCardPartner
          ? categories
              .filter(c => checkIsCardPartner({ categoryId: c.id }) && c.id !== partnerRootId)
              .map(c => c.parentId === partnerRootId ? { ...c, parentId: null } : c)
          : categories.filter(c => c.id !== partnerRootId && !checkIsCardPartner({ categoryId: c.id }));

        return (
          <CardModal
            card={selectedCardInfo.card}
            columnId={selectedCardInfo.columnId}
            onClose={() => setSelectedCardInfo(null)}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
            categories={modalCategories}
            availableTags={isCardPartner ? AVAILABLE_PARTNER_TAGS : AVAILABLE_TAGS}
            isPartner={isCardPartner}
            partnerRootId={partnerRootId}
          />
        );
      })()}
    </div>
  );
}
