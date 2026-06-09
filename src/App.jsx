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
  RefreshCw,
  X
} from 'lucide-react';
import Board from './components/Board';
import Dashboard from './components/Dashboard';
import CardModal from './components/CardModal';
import TeamManager from './components/TeamManager';
import Sidebar from './components/Sidebar';
import Planner from './components/Planner';
import LoginRegister from './components/LoginRegister';
import UsersManager from './components/UsersManager';

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
  { id: 'cat-1', name: 'Hướng dẫn sử dụng 📖', parentId: null },
  { id: 'cat-1-1', name: 'Thao tác cơ bản 🛠️', parentId: 'cat-1' },
  { id: 'cat-1-2', name: 'Tính năng nâng cao 🚀', parentId: 'cat-1' },
  { id: 'cat-2', name: 'Quản lý công việc 📂', parentId: null },
  { id: 'cat-3', name: 'Báo cáo & Thống kê 📊', parentId: null },
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
    title: 'Đối tác mẫu: Công ty TNHH Giải pháp Công nghệ Vintech',
    description: 'Đây là thẻ đối tác mẫu trên bảng quản lý Đối tác & Khách hàng. Bạn có thể sử dụng bảng này để theo dõi tiến trình liên hệ với các đối tác của mình.\n\n👉 Hãy chuyển sang tab "Bảng Đối tác" ở thanh menu trên cùng để bắt đầu quản lý phễu đối tác của bạn.',
    tags: ['potential'],
    startDate: '',
    dueDate: '',
    estimatedDuration: 60,
    checklist: [
      { id: 'p-ch-1', text: 'Tìm hiểu thông tin & nhu cầu của đối tác', completed: true },
      { id: 'p-ch-2', text: 'Gửi email giới thiệu giải pháp dịch vụ', completed: false }
    ],
    categoryId: 'cat-4', // Đối tác 🤝
    activities: [
      { id: 'act-p-1', timestamp: '10:00:00 01/06', text: 'Tạo thẻ đối tác mẫu' }
    ]
  },
  {
    id: 'partner-card-2',
    title: 'Đối tác mẫu: Đại lý Truyền thông MediaMax',
    description: 'Một đối tác mẫu đại diện cho trạng thái "Hợp tác chính thức". Tại đây bạn có thể đính kèm thông tin liên lạc chi tiết, ghi chú các mốc thời gian làm việc hoặc các công việc cụ thể cần triển khai chung.',
    tags: ['strategic'],
    startDate: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
    estimatedDuration: 120,
    checklist: [
      { id: 'p-ch-3', text: 'Ký kết hợp đồng khung thời hạn 1 năm', completed: true },
      { id: 'p-ch-4', text: 'Họp kick-off dự án truyền thông quý 3', completed: true }
    ],
    categoryId: 'cat-4', // Đối tác 🤝
    activities: [
      { id: 'act-p-2', timestamp: '14:30:00 01/06', text: 'Ký kết hợp đồng thành công' }
    ]
  },
  {
    id: 'card-1',
    title: 'Hướng dẫn 1: Thao tác kéo thả & Quản lý Kanban',
    description: 'Chào mừng bạn đến với ZenBoard! Bảng Kanban giúp bạn quản lý trạng thái công việc trực quan hơn.\n\n👉 Hãy thử bấm giữ thẻ này và kéo thả qua các cột "Đang triển khai ⚡", "Kiểm duyệt (Review) 👀" để thay đổi trạng thái.\n👉 Click vào thẻ này để mở màn hình chi tiết: tại đây bạn có thể sửa nội dung, gán nhãn dán, thêm công việc con (checklist) hoặc theo dõi lịch sử hoạt động.',
    tags: ['low', 'design'],
    startDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0], // 2 days ago
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], // 3 days later
    estimatedDuration: 180,
    checklist: [
      { id: 'ch-1', text: 'Bấm vào thẻ này để xem chi tiết thông tin', completed: true },
      { id: 'ch-2', text: 'Thử kéo thả thẻ này sang cột "Đang triển khai"', completed: false },
      { id: 'ch-3', text: 'Thêm một nhãn dán mới phù hợp (ví dụ: Quan trọng)', completed: false }
    ],
    categoryId: 'cat-1-1', // Thao tác cơ bản 🛠️
    activities: [
      { id: 'act-demo-1', timestamp: '08:30:00 03/06', text: 'Hệ thống tự động tạo thẻ hướng dẫn kéo thả' }
    ]
  },
  {
    id: 'card-2',
    title: 'Hướng dẫn 2: Lập kế hoạch tuần & Tự động sắp xếp công việc',
    description: 'ZenBoard tích hợp tính năng lập lịch ca làm việc cực kỳ thông minh.\n\n👉 Hãy chuyển sang tab "Lập kế hoạch" ở thanh điều hướng trên cùng để xem:\n1. Tính năng "Thiết lập ca làm việc" giúp cấu hình thời gian làm việc (ví dụ: ca sáng, ca tối, đổi ca linh hoạt theo ngày/tuần).\n2. Bạn có thể kéo thả thẻ vào bảng lịch trình tuần/ngày để phân bổ.\n3. Bấm "Sắp xếp thông minh" để hệ thống tự động tính toán thời gian, phân bổ công việc theo ca làm việc đã đăng ký của bạn từ thời điểm hiện tại trở đi.',
    tags: ['feature'],
    startDate: new Date().toISOString().split('T')[0], // Today
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], // 2 days later
    estimatedDuration: 120,
    checklist: [
      { id: 'ch-4', text: 'Chuyển sang màn hình Lập kế hoạch ở thanh điều hướng trên', completed: true },
      { id: 'ch-5', text: 'Tạo hoặc điều chỉnh ca làm việc trong tuần', completed: false },
      { id: 'ch-6', text: 'Trải nghiệm nút Sắp xếp thông minh để tối ưu lịch trình', completed: false }
    ],
    categoryId: 'cat-1-2', // Tính năng nâng cao 🚀
    activities: [
      { id: 'act-demo-2', timestamp: '09:00:00 03/06', text: 'Tạo thẻ hướng dẫn Lập kế hoạch' }
    ]
  },
  {
    id: 'card-3',
    title: 'Hướng dẫn 3: Điều kiện hoàn thành công việc & Tự động khóa thẻ',
    description: 'Để duy trì chất lượng dự án, hệ thống áp đặt các điều kiện khắt khe để đưa thẻ vào cột "Hoàn thành 🎉":\n1. Công việc con (Checklist) phải hoàn thành 100%.\n2. Phải có đầy đủ thông tin: Ngày bắt đầu và Ngày kết thúc (Hạn chót).\n\n🔒 QUAN TRỌNG: Khi thẻ đã nằm trong cột "Hoàn thành 🎉", hệ thống sẽ khóa toàn bộ các thao tác chỉnh sửa. Nếu muốn chỉnh sửa hoặc kéo thẻ ra cột khác, bạn cần xác nhận lý do khôi phục thẻ.',
    tags: ['high', 'bug'],
    startDate: new Date(Date.now() - 86400000).toISOString().split('T')[0], // Yesterday
    dueDate: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0], // 4 days later
    estimatedDuration: 45,
    checklist: [
      { id: 'ch-7', text: 'Đánh dấu hoàn thành toàn bộ công việc con (Checklist)', completed: true },
      { id: 'ch-8', text: 'Kiểm tra xem thẻ đã có Ngày bắt đầu và Hạn chót chưa', completed: true },
      { id: 'ch-9', text: 'Kéo thẻ này vào cột "Hoàn thành 🎉" để kích hoạt chế độ Khóa thẻ', completed: false }
    ],
    categoryId: 'cat-1-2', // Tính năng nâng cao 🚀
    activities: [
      { id: 'act-demo-3', timestamp: '09:15:00 03/06', text: 'Tạo thẻ hướng dẫn Quy tắc hoàn thành' }
    ]
  },
  {
    id: 'card-4',
    title: 'Hướng dẫn 4: Tạo thẻ công việc mới & Lọc danh mục',
    description: 'Bạn có thể dễ dàng khởi tạo các thẻ công việc mới bằng cách bấm vào nút "+ Thêm công việc" ở phía dưới mỗi cột Kanban.\n\nỞ thanh bên trái (Sidebar), hệ thống hiển thị Danh mục công việc (như Hướng dẫn sử dụng, Quản lý dự án...). Khi nhấp chọn một danh mục cụ thể, bảng Kanban sẽ lập tức lọc và chỉ hiển thị các công việc thuộc nhóm đó.',
    tags: ['low'],
    dueDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0], // 5 days later
    estimatedDuration: 90,
    checklist: [
      { id: 'ch-10', text: 'Bấm thử vào danh mục "Quản lý dự án" trên thanh Sidebar để lọc', completed: false },
      { id: 'ch-11', text: 'Bấm "+ Thêm công việc" ở cột 1 để tạo thẻ mới thử nghiệm', completed: false }
    ],
    categoryId: 'cat-2' // Quản lý dự án 📂
  },
  {
    id: 'card-5',
    title: 'Hướng dẫn 5: Báo cáo Thống kê & Chu kỳ dọn dẹp bảng Kanban',
    description: 'Thẻ công việc này đã được hoàn thành xuất sắc trước hạn chót (Deadline) và được khóa thành công.\n\n👉 Hãy nhấp vào tab "Báo cáo Thống kê" ở thanh menu trên cùng để xem các biểu đồ phân tích năng suất.\n💡 Logic dọn dẹp thông minh: Sang ngày mới, hệ thống tự động làm sạch các thẻ đã hoàn thành ở cột "Hoàn thành 🎉" để giữ bảng Kanban luôn thông thoáng. Đừng lo lắng! Tất cả các công việc đã hoàn thành vẫn được lưu trữ đầy đủ để phục vụ báo cáo tuần/tháng hoặc hiển thị trên tab Đã hoàn thành của Planner.',
    tags: ['medium', 'feature'],
    startDate: new Date(Date.now() - 86400000 * 4).toISOString().split('T')[0], // 4 days ago
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    completedAt: new Date().toISOString(), // Completed today
    estimatedDuration: 150,
    checklist: [
      { id: 'ch-12', text: 'Đọc hướng dẫn về logic chu kỳ dọn dẹp ngày/tuần/tháng', completed: true },
      { id: 'ch-13', text: 'Xem biểu đồ thống kê hiệu quả tại tab Báo cáo Thống kê', completed: true }
    ],
    categoryId: 'cat-1-1', // Thao tác cơ bản 🛠️
    activities: [
      { id: 'act-demo-4', timestamp: '08:00:00 03/06', text: 'Khởi tạo công việc hướng dẫn hoàn thành' },
      { id: 'act-demo-5', timestamp: '11:00:00 03/06', text: 'Đạt điều kiện hoàn thành, chuyển thẻ sang cột Hoàn thành và tự động khóa' }
    ]
  }
];


const ensureCompletedColumnAtEnd = (cols, completedId) => {
  const completedCol = cols.find(c => c.id === completedId);
  if (!completedCol) return cols;
  const otherCols = cols.filter(c => c.id !== completedId);
  return [...otherCols, completedCol];
};

const DEFAULT_PLAN_FEATURES = {
  free: { googleSheetsSync: false, activityLogs: false, checklists: true, cardLimit: 10, columnCustomization: true },
  pro: { googleSheetsSync: false, activityLogs: true, checklists: true, cardLimit: 100, columnCustomization: true },
  enterprise: { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 500, columnCustomization: true },
  vip: { googleSheetsSync: true, activityLogs: true, checklists: true, cardLimit: 9999, columnCustomization: true }
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '';


export default function App() {
  // Auth states
  const [token, setToken] = useState(() => localStorage.getItem('zenboard_token') || '');
  const [username, setUsername] = useState(() => localStorage.getItem('zenboard_username') || '');
  const [role, setRole] = useState(() => localStorage.getItem('zenboard_role') || 'editor');
  const [plan, setPlan] = useState(() => localStorage.getItem('zenboard_plan') || 'free');
  const [planFeatures, setPlanFeatures] = useState(() => {
    try {
      const saved = localStorage.getItem('zenboard_plan_features');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const getPlanFeature = (featureKey) => {
    const currentPlan = plan || 'free';
    const features = (planFeatures && planFeatures[currentPlan]) || DEFAULT_PLAN_FEATURES[currentPlan] || DEFAULT_PLAN_FEATURES.free;
    return features[featureKey];
  };


  const handleAuthSuccess = (newToken, newUsername, newRole, newPlan) => {
    localStorage.setItem('zenboard_token', newToken);
    localStorage.setItem('zenboard_username', newUsername);
    localStorage.setItem('zenboard_role', newRole || 'editor');
    localStorage.setItem('zenboard_plan', newPlan || 'free');
    setToken(newToken);
    setUsername(newUsername);
    setRole(newRole || 'editor');
    setPlan(newPlan || 'free');
    setIsInitialLoaded(false); // Trigger database load
  };

  const handleLogout = () => {
    localStorage.removeItem('zenboard_token');
    localStorage.removeItem('zenboard_username');
    localStorage.removeItem('zenboard_role');
    localStorage.removeItem('zenboard_plan');
    localStorage.removeItem('zenboard_plan_features');
    localStorage.removeItem('zenboard_tags');
    localStorage.removeItem('zenboard_partner_tags');
    setToken('');
    setUsername('');
    setRole('editor');
    setPlan('free');
    setPlanFeatures(null);
    setTags(AVAILABLE_TAGS);
    setPartnerTags(AVAILABLE_PARTNER_TAGS);
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
  const [tags, setTags] = useState(() => {
    try {
      const saved = localStorage.getItem('zenboard_tags');
      return saved ? JSON.parse(saved) : AVAILABLE_TAGS;
    } catch {
      return AVAILABLE_TAGS;
    }
  });
  const [partnerTags, setPartnerTags] = useState(() => {
    try {
      const saved = localStorage.getItem('zenboard_partner_tags');
      return saved ? JSON.parse(saved) : AVAILABLE_PARTNER_TAGS;
    } catch {
      return AVAILABLE_PARTNER_TAGS;
    }
  });
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

  const [selectedCompletedDate, setSelectedCompletedDate] = useState(() => new Date().toLocaleDateString('en-CA'));
  const isViewingToday = selectedCompletedDate === new Date().toLocaleDateString('en-CA');

  const [activeTab, setActiveTab] = useState('dashboard'); // 'board', 'planner', 'partners' or 'dashboard'
  const [userId, setUserId] = useState('');
  const [workspaceMembers, setWorkspaceMembers] = useState([]);

  useEffect(() => {
    if (!token) return;
    const fetchWorkspaceMembers = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/workspace/members`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setWorkspaceMembers(data);
        }
      } catch (err) {
        console.error('Lỗi tải thành viên workspace:', err);
      }
    };
    fetchWorkspaceMembers();
  }, [token, activeTab]);
  const [dashboardSubTab, setDashboardSubTab] = useState('tasks'); // 'tasks' or 'partners'
  const [adminSubTab, setAdminSubTab] = useState('members'); // 'members', 'roles', 'plans', 'data'
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
  const [shifts, setShifts] = useState([
    { id: 'shift-1', name: 'Ca 1', startTime: '07:00', endTime: '15:00' },
    { id: 'shift-2', name: 'Ca 2', startTime: '15:00', endTime: '23:00' },
    { id: 'shift-3', name: 'Ca 3', startTime: '23:00', endTime: '07:00' }
  ]);
  const [weeklyShifts, setWeeklyShifts] = useState({});

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

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showDbTroubleshootModal, setShowDbTroubleshootModal] = useState(false);

  const handleSelfUpgradePlan = async (targetPlan) => {
    if (!token) {
      // Offline fallback: update local storage directly
      setPlan(targetPlan);
      localStorage.setItem('zenboard_plan', targetPlan);
      alert(`Đã nâng cấp lên gói ${targetPlan.toUpperCase()} thành công (chế độ Offline)!`);
      setShowUpgradeModal(false);
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/user/upgrade-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan: targetPlan })
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Nâng cấp gói thất bại.');
      }
      
      setPlan(targetPlan);
      localStorage.setItem('zenboard_plan', targetPlan);
      alert(`🎉 Xin chúc mừng! Bạn đã nâng cấp thành công tài khoản lên gói ${targetPlan.toUpperCase()}!`);
      setShowUpgradeModal(false);
    } catch (err) {
      alert(`Lỗi: ${err.message}`);
    }
  };

  const handleSyncToGoogleSheets = async (customCards = cards, customCats = categories) => {
    if (!getPlanFeature('googleSheetsSync')) {
      setSyncStatus('error');
      setSyncErrorMessage('Tính năng đồng bộ Google Sheets không được hỗ trợ trong gói dịch vụ hiện tại của bạn.');
      return;
    }
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
    if (!getPlanFeature('googleSheetsSync')) return;
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
  }, [cards, categories, columns, isAutoSyncEnabled, googleSheetUrl, plan, planFeatures]);
  useEffect(() => {
    if (!token) {
      setIsInitialLoaded(true);
      return;
    }
    const loadBoardFromDatabase = async () => {
      setIsInitialLoaded(false);
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
        if (data.userId) {
          setUserId(data.userId);
        }
        
        if (data.categories && data.columns && data.cards) {
          // Chỉ nạp nếu cơ sở dữ liệu đã có dữ liệu thực tế (tránh nạp trống đè cấu hình)
          if (data.columns.length > 0 || data.cards.length > 0 || data.categories.length > 0) {
            let loadedCards = data.cards || [];
            let loadedColumns = data.columns || [];

            // Auto daily-clearing of completed tasks from previous days
            const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
            let hasArchiveUpdates = false;

            const updatedCards = loadedCards.map(card => {
              if (card.completedAt && !card.isArchived) {
                const completedDateStr = card.completedAt.split('T')[0]; // YYYY-MM-DD
                if (completedDateStr < todayStr) {
                  hasArchiveUpdates = true;
                  return { ...card, isArchived: true };
                }
              }
              return card;
            });

            let updatedColumns = loadedColumns;
            if (hasArchiveUpdates) {
              const archivedIds = updatedCards.filter(c => c.isArchived).map(c => c.id);
              updatedColumns = loadedColumns.map(col => {
                if (col.id === 'col-4') {
                  return {
                    ...col,
                    cardIds: col.cardIds.filter(id => !archivedIds.includes(id))
                  };
                }
                return col;
              });
            }

            // Tự động phân bổ các thẻ được giao (nếu chưa nằm trong cột nào của user) vào cột đầu tiên tương ứng
            const loadedPartnerColumns = data.partnerColumns || [];
            let updatedPartnerColumns = loadedPartnerColumns;

            const partnerCat = data.categories.find(c => !c.parentId && c.name.includes('Đối tác'));
            const partnerRootId = partnerCat ? partnerCat.id : 'cat-4';
            
            const checkIsCardPartnerLoad = (c) => {
              if (!c.categoryId) return false;
              if (c.categoryId === partnerRootId) return true;
              let currentId = c.categoryId;
              let limit = 10;
              while (currentId && limit > 0) {
                const cat = data.categories.find(catItem => catItem.id === currentId);
                if (!cat) break;
                if (cat.parentId === partnerRootId) return true;
                currentId = cat.parentId;
                limit--;
              }
              return false;
            };

            const allColumnCardIds = new Set([
              ...updatedColumns.flatMap(col => col.cardIds || []),
              ...updatedPartnerColumns.flatMap(col => col.cardIds || [])
            ]);

            const missingCards = updatedCards.filter(card => !card.isArchived && !allColumnCardIds.has(card.id));
            const missingRegularCardIds = missingCards.filter(c => !checkIsCardPartnerLoad(c)).map(c => c.id);
            const missingPartnerCardIds = missingCards.filter(c => checkIsCardPartnerLoad(c)).map(c => c.id);

            if (missingRegularCardIds.length > 0 && updatedColumns.length > 0) {
              updatedColumns = updatedColumns.map((col, index) => {
                if (index === 0) {
                  return {
                    ...col,
                    cardIds: [...new Set([...col.cardIds, ...missingRegularCardIds])]
                  };
                }
                return col;
              });
            }

            if (missingPartnerCardIds.length > 0 && updatedPartnerColumns.length > 0) {
              updatedPartnerColumns = updatedPartnerColumns.map((col, index) => {
                if (index === 0) {
                  return {
                    ...col,
                    cardIds: [...new Set([...col.cardIds, ...missingPartnerCardIds])]
                  };
                }
                return col;
              });
            }

            setCategories(data.categories);
            setColumns(updatedColumns);
            if (data.partnerColumns) setPartnerColumns(updatedPartnerColumns);
            setCards(updatedCards);
            if (data.userRole) {

              setRole(data.userRole);
              localStorage.setItem('zenboard_role', data.userRole);
            }
            if (data.userPlan) {
              setPlan(data.userPlan);
              localStorage.setItem('zenboard_plan', data.userPlan);
            }
            if (data.planFeatures) {
              setPlanFeatures(data.planFeatures);
              localStorage.setItem('zenboard_plan_features', JSON.stringify(data.planFeatures));
            }
            
            if (data.settings) {
              if (data.settings.todaySchedule) setTodaySchedule(data.settings.todaySchedule);
              if (data.settings.workdayDuration) setWorkdayDuration(data.settings.workdayDuration);
              if (data.settings.googleSheetUrl) setGoogleSheetUrl(data.settings.googleSheetUrl);
              if (data.settings.googleSheetDisplayUrl) setGoogleSheetDisplayUrl(data.settings.googleSheetDisplayUrl);
              if (data.settings.isAutoSyncEnabled !== undefined) setIsAutoSyncEnabled(data.settings.isAutoSyncEnabled);
              if (data.settings.lastSyncTime) setLastSyncTime(data.settings.lastSyncTime);
              if (data.settings.shifts) setShifts(data.settings.shifts);
              if (data.settings.weeklyShifts) setWeeklyShifts(data.settings.weeklyShifts);
              if (data.settings.tags) {
                setTags(data.settings.tags);
                localStorage.setItem('zenboard_tags', JSON.stringify(data.settings.tags));
              }
              if (data.settings.partnerTags) {
                setPartnerTags(data.settings.partnerTags);
                localStorage.setItem('zenboard_partner_tags', JSON.stringify(data.settings.partnerTags));
              }
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
                    lastSyncTime: '',
                    shifts: [
                      { id: 'shift-1', name: 'Ca 1', startTime: '07:00', endTime: '15:00' },
                      { id: 'shift-2', name: 'Ca 2', startTime: '15:00', endTime: '23:00' },
                      { id: 'shift-3', name: 'Ca 3', startTime: '23:00', endTime: '07:00' }
                    ],
                    weeklyShifts: {}
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
            lastSyncTime,
            shifts,
            weeklyShifts,
            tags,
            partnerTags
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
  }, [categories, columns, partnerColumns, cards, todaySchedule, workdayDuration, googleSheetUrl, googleSheetDisplayUrl, isAutoSyncEnabled, lastSyncTime, isInitialLoaded, token, shifts, weeklyShifts, tags, partnerTags]);

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

    const card = cards.find(c => c.id === cardId);
    if (!card) return;

    // 0. Prevent history modification for past dates
    if ((targetColId === 'col-4' || actualSourceColId === 'col-4') && !isViewingToday) {
      alert('Bạn chỉ có thể hoàn thành hoặc mở lại công việc ở ngày hiện tại!');
      return;
    }

    // 1. Validation when dragging to Completed ('col-4')
    if (targetColId === 'col-4') {
      const isPartner = checkIsCardPartner(card);
      if (!isPartner) {
        const missingFields = [];
        if (!card.title || !card.title.trim() || card.title === 'Công việc mới') {
          missingFields.push('Tiêu đề công việc');
        }
        if (!card.description || !card.description.trim()) {
          missingFields.push('Mô tả chi tiết');
        }
        if (!card.startDate || !card.startDate.trim()) {
          missingFields.push('Ngày bắt đầu');
        }
        if (!card.dueDate || !card.dueDate.trim()) {
          missingFields.push('Hạn chót (Deadline/Ngày kết thúc)');
        }
        
        const checklist = card.checklist || [];
        if (checklist.length > 0 && !checklist.every(item => item.completed)) {
          missingFields.push('Checklist công việc con (Chưa hoàn thành 100%)');
        }

        if (missingFields.length > 0) {
          alert(`Không thể hoàn thành công việc! Vui lòng bổ sung đầy đủ thông tin sau trước khi hoàn thành:\n- ${missingFields.join('\n- ')}`);
          return; // Cancel drop
        }
      }
    }

    // 2. Handling when moving OUT of Completed ('col-4') -> Reopening
    let reopenReason = '';
    if (actualSourceColId === 'col-4' && targetColId !== 'col-4') {
      const input = prompt('Công việc này đã hoàn thành. Vui lòng nhập lý do mở lại công việc (Ví dụ: "chuyển trạng thái nhầm"):');
      if (input === null) {
        // User cancelled, abort move!
        return;
      }
      reopenReason = input.trim() || 'Chuyển trạng thái nhầm';
    }

    // 3. Move columns
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

    // 4. Log activity if columns changed and handle completion status
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
          year: 'numeric'
        });
        
        const moveLog = {
          id: `act-${Date.now()}`,
          timestamp,
          text: `Di chuyển từ cột "${sourceCol.title}" sang cột "${targetCol.title}"`
        };

        setCards(prevCards => {
          return prevCards.map(c => {
            if (c.id === cardId) {
              let updatedCard = { ...c };
              let extraLogs = [moveLog];

              // Handle completed date & logs
              if (targetColId === 'col-4') {
                updatedCard.completedAt = new Date().toISOString();
                updatedCard.isArchived = false; // Ensure it is active completed
                extraLogs.unshift({
                  id: `act-comp-${Date.now()}`,
                  timestamp,
                  text: `Hoàn thành công việc`
                });
              } else if (actualSourceColId === 'col-4') {
                updatedCard.completedAt = null;
                updatedCard.isArchived = false;
                extraLogs.unshift({
                  id: `act-reopen-${Date.now()}`,
                  timestamp,
                  text: `Mở lại công việc. Lý do: ${reopenReason}`
                });
              }

              updatedCard.activities = [...extraLogs, ...(c.activities || [])];
              
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
    if (!getPlanFeature('columnCustomization')) {
      alert(`Tùy chỉnh cột Kanban là tính năng của gói PRO trở lên. Gói hiện tại của bạn là ${plan.toUpperCase()}. Vui lòng nâng cấp để sử dụng!`);
      return;
    }
    if (plan === 'free' && currentColumns.length >= 5) {
      alert("Gói FREE chỉ được tạo tối đa 5 cột (tính cả cột Hoàn thành). Vui lòng nâng cấp gói để thêm nhiều cột hơn!");
      return;
    }
    if (!title) return;

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
    if (!getPlanFeature('columnCustomization')) {
      alert(`Tùy chỉnh cột Kanban là tính năng của gói PRO trở lên. Gói hiện tại của bạn là ${plan.toUpperCase()}. Vui lòng nâng cấp để sử dụng!`);
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
    if (!getPlanFeature('columnCustomization')) {
      alert(`Tùy chỉnh cột Kanban là tính năng của gói PRO trở lên. Gói hiện tại của bạn là ${plan.toUpperCase()}. Vui lòng nâng cấp để sử dụng!`);
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
    if (!getPlanFeature('columnCustomization')) {
      alert(`Tùy chỉnh cột Kanban là tính năng của gói PRO trở lên. Gói hiện tại của bạn là ${plan.toUpperCase()}. Vui lòng nâng cấp để sử dụng!`);
      return;
    }

    setCurrentColumns(currentColumns.map(col => 
      col.id === colId ? { ...col, color: newColor } : col
    ));
  };

  // Add Card to Column
  const handleAddCard = (colId) => {
    const cardLimit = getPlanFeature('cardLimit');
    if (cards.length >= cardLimit) {
      alert(`Đã đạt giới hạn tối đa ${cardLimit} thẻ công việc của gói hiện tại (${plan.toUpperCase()}). Vui lòng nâng cấp gói để tiếp tục!`);
      return;
    }
    const now = new Date();
    const newCardId = `card-${now.getTime()}`;
    const newCard = {
      id: newCardId,

      title: isPartnerActive ? 'Đối tác mới' : 'Công việc mới',
      description: '',
      tags: [],
      startDate: now.toLocaleDateString('en-CA'),
      dueDate: '',
      checklist: [],
      categoryId: (activeCategoryId !== 'all' && activeCategoryId !== 'uncategorized') ? activeCategoryId : (isPartnerActive ? partnerRootId : null),
      createdAt: now.toISOString(),
      isArchived: false,
      completedAt: null
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

  const handleUpdateAvailableTags = (newTags, deletedTagKey = null, isPartnerTags = false) => {
    if (isPartnerTags) {
      setPartnerTags(newTags);
      localStorage.setItem('zenboard_partner_tags', JSON.stringify(newTags));
    } else {
      setTags(newTags);
      localStorage.setItem('zenboard_tags', JSON.stringify(newTags));
    }
    
    // Clean up cards if a tag was deleted
    if (deletedTagKey) {
      setCards(prevCards => 
        prevCards.map(card => {
          if (card.tags && card.tags.includes(deletedTagKey)) {
            return {
              ...card,
              tags: card.tags.filter(t => t !== deletedTagKey)
            };
          }
          return card;
        })
      );
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

  const getPlanFeaturesList = (planKey) => {
    const currentFeatures = (planFeatures && planFeatures[planKey]) || DEFAULT_PLAN_FEATURES[planKey] || DEFAULT_PLAN_FEATURES.free;
    const list = [];
    
    // 1. Card limit
    if (currentFeatures.cardLimit >= 9999) {
      list.push("Không giới hạn thẻ việc");
    } else {
      list.push(`Giới hạn ${currentFeatures.cardLimit} thẻ việc`);
    }
    
    // 2. Column customization
    if (currentFeatures.columnCustomization) {
      if (planKey === 'free') {
        list.push("Tùy chỉnh cột Kanban (Tối đa 5 cột)");
      } else {
        list.push("Tùy chỉnh cột Kanban");
      }
    } else {
      list.push("Cố định cột (Không tùy chỉnh)");
    }
    
    // 3. Activity logs
    if (currentFeatures.activityLogs) {
      list.push("Lưu nhật ký hoạt động");
    } else {
      list.push("Không lưu nhật ký");
    }
    
    // 4. Google Sheets sync
    if (currentFeatures.googleSheetsSync) {
      list.push("Đồng bộ Google Sheets");
    } else {
      list.push("Không đồng bộ Sheets");
    }

    // 5. Checklists
    if (currentFeatures.checklists) {
      list.push("Checklist công việc con");
    } else {
      list.push("Không hỗ trợ checklist");
    }

    return list;
  };

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
          <button 
            className={`btn ${activeTab === 'team' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', borderRadius: '8px', border: 'none' }}
            onClick={() => {
              setActiveTab('team');
              setSelectedFilters([]);
            }}
          >
            <Users size={14} />
            <span style={{ fontSize: '12.5px' }}>Đội nhóm</span>
          </button>
          {role === 'admin' && (
            <button 
              className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', borderRadius: '8px', border: 'none' }}
              onClick={() => {
                setActiveTab('users');
                setSelectedFilters([]);
              }}
            >
              <Users size={14} />
              <span style={{ fontSize: '12.5px' }}>Quản lý thành viên</span>
            </button>
          )}
        </div>

        {/* Global Action Toolbar */}
        <div className="actions-section">
          {/* Database Connection Status Indicator */}
          <div 
            className="database-status-indicator" 
            title={isBackendConnected ? "Đã kết nối PostgreSQL Database 🟢" : "Mất kết nối với PostgreSQL Backend Database. Click để xem hướng dẫn khắc phục! 🔴"}
            onClick={() => { if (!isBackendConnected) setShowDbTroubleshootModal(true); }}
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
              color: isBackendConnected ? '#10b981' : '#ef4444',
              cursor: isBackendConnected ? 'default' : 'pointer'
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
          adminSubTab={adminSubTab}
          setAdminSubTab={setAdminSubTab}
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
          role={role}
          plan={plan}
          onUpgradeClick={() => setShowUpgradeModal(true)}
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

                  {!isPartnerActive && (
                    <div style={{
                      marginLeft: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      borderRadius: 'var(--border-radius-md)',
                      border: '1px solid var(--border-glass)',
                      background: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap'
                    }}>
                      <CalendarDays size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      <span style={{ fontSize: '12.5px', fontWeight: '500', color: 'var(--text-secondary)' }}>
                        Hoàn thành ngày:
                      </span>
                      <input
                        type="date"
                        style={{ 
                          border: 'none', 
                          background: 'transparent',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-body)',
                          fontSize: '13px',
                          outline: 'none',
                          cursor: 'pointer',
                          colorScheme: 'dark'
                        }}
                        value={selectedCompletedDate}
                        onChange={(e) => setSelectedCompletedDate(e.target.value || new Date().toLocaleDateString('en-CA'))}
                      />
                    </div>
                  )}
                </div>

                {/* Filters */}
                <div className="tag-filters">
                  <span 
                    style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', alignSelf: 'center', marginRight: '4px' }}
                  >
                    Nhãn:
                  </span>
                  {(isPartnerActive ? partnerTags : tags).map(t => {
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
                allCards={cards}
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
                columnCustomization={getPlanFeature('columnCustomization')}
                userPlan={plan}
                onUpgradeClick={() => setShowUpgradeModal(true)}
                availableTags={isPartnerActive ? partnerTags : tags}
                selectedCompletedDate={selectedCompletedDate}
                isViewingToday={isViewingToday}
                workspaceMembers={workspaceMembers}
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
              shifts={shifts}
              setShifts={setShifts}
              weeklyShifts={weeklyShifts}
              setWeeklyShifts={setWeeklyShifts}
            />
          ) : activeTab === 'users' && role === 'admin' ? (
            <UsersManager
              token={token}
              API_BASE_URL={API_BASE_URL}
              currentUsername={username}
              planFeatures={planFeatures}
              setPlanFeatures={setPlanFeatures}
              adminSubTab={adminSubTab}
              setAdminSubTab={setAdminSubTab}
            />
          ) : activeTab === 'team' ? (
            <TeamManager
              token={token}
              API_BASE_URL={API_BASE_URL}
              currentUsername={username}
              currentUserId={userId}
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
              userPlan={plan}
              planFeatures={planFeatures}
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

        const allPartnerCards = cards.filter(c => checkIsCardPartner(c));

        return (
          <CardModal
            card={selectedCardInfo.card}
            columnId={selectedCardInfo.columnId}
            onClose={() => setSelectedCardInfo(null)}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
            categories={modalCategories}
            availableTags={isCardPartner ? partnerTags : tags}
            onUpdateAvailableTags={(newTags, deletedTagKey) => handleUpdateAvailableTags(newTags, deletedTagKey, isCardPartner)}
            allPartnerCards={allPartnerCards}
            isPartner={isCardPartner}
            partnerRootId={partnerRootId}
            userPlan={plan}
            planFeatures={planFeatures}
            workspaceMembers={workspaceMembers}
          />
        );
      })()}

      {/* Subscription Upgrade Modal */}
      {showUpgradeModal && (
        <div className="modal-overlay" style={{ zIndex: 1999 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '750px', padding: '24px', border: '1px solid var(--border-glass)', background: 'rgba(24, 24, 27, 0.95)', backdropFilter: 'blur(20px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 'bold' }}>
                Nâng cấp Gói Dịch vụ ZenBoard 👑
              </h3>
              <button 
                onClick={() => setShowUpgradeModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
              Gói hiện tại của bạn: <strong style={{ color: 'var(--primary)', textTransform: 'uppercase' }}>{plan}</strong>. Chọn gói phù hợp bên dưới để mở khóa giới hạn và các tính năng premium:
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { 
                  key: 'free', 
                  name: 'FREE (Cơ bản)', 
                  price: '0đ / tháng',
                  color: '#71717a', 
                  bg: 'rgba(113, 113, 122, 0.1)', 
                  border: '1px solid var(--border-glass)',
                  features: getPlanFeaturesList('free')
                },
                { 
                  key: 'pro', 
                  name: 'PRO (Nâng cao)', 
                  price: '199k / tháng',
                  color: '#a855f7', 
                  bg: 'rgba(168, 85, 247, 0.1)', 
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  features: getPlanFeaturesList('pro')
                },
                { 
                  key: 'enterprise', 
                  name: 'ENTERPRISE', 
                  price: '499k / tháng',
                  color: '#3b82f6', 
                  bg: 'rgba(59, 130, 246, 0.1)', 
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  features: getPlanFeaturesList('enterprise')
                },
                { 
                  key: 'vip', 
                  name: 'VIP (Đặc quyền)', 
                  price: '999k / tháng',
                  color: '#f59e0b', 
                  bg: 'rgba(245, 158, 11, 0.15)', 
                  border: '1px solid rgba(245, 158, 11, 0.5)',
                  features: getPlanFeaturesList('vip')
                }
              ].map(p => {
                const isCurrent = plan === p.key;
                return (
                  <div key={p.key} style={{ 
                    background: p.bg, 
                    border: isCurrent ? `2px solid ${p.color}` : p.border,
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative'
                  }}>
                    {isCurrent && (
                      <span style={{ 
                        position: 'absolute', 
                        top: '-10px', 
                        right: '10px', 
                        background: p.color, 
                        color: '#fff', 
                        fontSize: '8.5px', 
                        fontWeight: 'bold', 
                        padding: '2px 6px', 
                        borderRadius: '10px',
                        textTransform: 'uppercase'
                      }}>
                        Đang dùng
                      </span>
                    )}
                    <div>
                      <h4 style={{ color: p.color, fontSize: '13px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{p.name}</h4>
                      <div style={{ fontSize: '14.5px', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 12px 0' }}>{p.price}</div>
                      
                      <ul style={{ paddingLeft: '14px', margin: '0 0 16px 0', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {p.features.map((f, idx) => (
                          <li key={idx} style={{ listStyleType: 'disc' }}>{f}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <button
                      onClick={() => handleSelfUpgradePlan(p.key)}
                      disabled={isCurrent}
                      style={{
                        width: '100%',
                        padding: '6px 0',
                        fontSize: '11.5px',
                        fontWeight: 'bold',
                        borderRadius: '6px',
                        border: 'none',
                        background: isCurrent ? 'rgba(255,255,255,0.05)' : p.color,
                        color: isCurrent ? 'var(--text-muted)' : '#fff',
                        cursor: isCurrent ? 'not-allowed' : 'pointer',
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.opacity = 0.85; }}
                      onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.opacity = 1; }}
                    >
                      {isCurrent ? 'Hiện tại' : 'Nâng cấp ngay'}
                    </button>
                  </div>
                );
              })}
            </div>
            
            <div style={{ 
              marginTop: '16px', 
              padding: '10px', 
              background: 'rgba(255,255,255,0.02)', 
              borderRadius: '6px', 
              fontSize: '11.5px', 
              color: 'var(--text-muted)',
              border: '1px solid var(--border-glass)',
              textAlign: 'center'
            }}>
              💡 <strong>Lưu ý trải nghiệm:</strong> ZenBoard được triển khai self-hosted trên VPS của bạn. Nút "Nâng cấp ngay" sẽ trực tiếp ghi cấu hình gói mới vào CSDL PostgreSQL mà không yêu cầu thanh toán thực tế.
            </div>
          </div>
        </div>
      )}

      {/* Database Troubleshoot Modal */}
      {showDbTroubleshootModal && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content glass-panel" style={{ maxWidth: '500px', padding: '24px', border: '1px solid var(--border-glass)', background: 'rgba(24, 24, 27, 0.95)', backdropFilter: 'blur(20px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 'bold' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
                Trạng thái: Offline (Mất kết nối Database)
              </h3>
              <button 
                onClick={() => setShowDbTroubleshootModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', margin: '0 0 16px 0' }}>
              Hệ thống hiện đang sử dụng <strong>Cơ sở dữ liệu tạm thời (LocalStorage)</strong> để bạn trải nghiệm. Tất cả các dữ liệu mới sẽ không được đồng bộ lên PostgreSQL trên VPS và có thể bị mất nếu bạn xóa cookie trình duyệt.
            </p>
            
            <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', margin: '0 0 8px 0', fontWeight: '600' }}>Hướng dẫn kiểm tra và khắc phục trên VPS:</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              <div>
                <strong>Bước 1:</strong> SSH vào VPS và chuyển đến thư mục ứng dụng:
                <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px', fontSize: '11.5px', margin: '4px 0', color: '#a855f7', overflowX: 'auto' }}>
                  cd /www/wwwroot/mytask/mytask
                </pre>
              </div>
              <div>
                <strong>Bước 2:</strong> Kiểm tra xem các container Docker có đang chạy không:
                <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px', fontSize: '11.5px', margin: '4px 0', color: '#a855f7', overflowX: 'auto' }}>
                  docker compose ps
                </pre>
              </div>
              <div>
                <strong>Bước 3:</strong> Xem logs của backend container để tìm lỗi cụ thể:
                <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px', fontSize: '11.5px', margin: '4px 0', color: '#a855f7', overflowX: 'auto' }}>
                  docker compose logs backend
                </pre>
              </div>
              <div>
                <strong>Bước 4:</strong> Hãy thử khởi động lại toàn bộ dịch vụ:
                <pre style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px', fontSize: '11.5px', margin: '4px 0', color: '#a855f7', overflowX: 'auto' }}>
                  docker compose down && docker compose up --build -d
                </pre>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowDbTroubleshootModal(false);
                  window.location.reload();
                }}
                style={{ padding: '8px 16px', borderRadius: '8px' }}
              >
                Tải lại trang 🔄
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
