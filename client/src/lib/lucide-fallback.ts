 
// @ts-nocheck
import * as ElementPlusIcons from '@element-plus/icons-vue'
import {
  User,
  Lock,
  Star,
  Key,
  Phone,
  CreditCard,
  Wallet,
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  Search,
  Plus,
  Refresh, // RefreshCw substitute
  ZoomIn,
  Cpu,
  Document, // FileText substitute
  Money, // DollarSign substitute
  Setting, // Settings substitute
  View, // Eye substitute
  Tools, // Wrench substitute
  DataAnalysis, // BarChart3 substitute
  Files,
  WarningFilled, // AlertTriangle substitute
  CopyDocument, // Copy substitute
  Download,
  Loading, // Loader2 substitute
  StarFilled, // Heart icon substitute
  Check,
  Close, // X substitute
  HomeFilled, // Home substitute
  Grid,
  List,
  Sort, // ArrowUpDow substitute
  Delete, // Trash2 substitute
  MoreFilled, // MoreVertical substitute
  VideoPlay, // Youtube substitute (approx)
  ChatDotRound, // MessageSquare
  Avatar,
  Bell,
  InfoFilled,
  DocumentChecked, // For QrCode substitute
  Search as ScanIcon, // For Scan substitute
  Present,
  EditPen,
  Medal,
  UploadFilled,
  Link as LinkIcon,
  ChatLineRound,
  Edit as EditIcon,
  CircleCheck,
  CircleClose,
  Picture,
  Clock as ClockIcon,
  Share,
  Connection,
  Lightning,
  Aim,
  Headset,
  Monitor as MonitorIcon,
  FullScreen,
  Minus as MinusIcon,
  Hide,
  MagicStick,
  Microphone,
  Promotion,
  UserFilled,
  ShoppingCart,
  TrendCharts,
  DArrowLeft,
  DArrowRight,
  Rank,
  Fold,
  Management,
  CircleCheckFilled,
  DataLine,
  SuccessFilled,
  Sunny,
  Moon,
  SwitchButton, // LogOut substitute
  FolderOpened as FolderOpenedIcon,
  Brush,
  Folder as FolderIcon,
  Odometer,
} from '@element-plus/icons-vue'

// Map Lucide names to Element Plus Components
export const Loader2 = Loading
export const UserIcon = User // User is reserved in some contexts, but export as User too
// export const User = User
export { User }
export const LockIcon = Lock
export { Lock }
export const MessageSquare = ChatDotRound
export const StarIcon = Star
export { Star }
export const KeyIcon = Key
export { Key }
export const KeyRound = Key // KeyRound 使用 Key 图标替代
export const PhoneIcon = Phone
export { Phone }
export const Smartphone = Phone // Smartphone 使用 Phone 图标替代
export const CreditCardIcon = CreditCard
export { CreditCard }
export const WalletIcon = Wallet
export { Wallet }
export const ArrowLeftIcon = ArrowLeft
export { ArrowLeft }
export const ArrowRightIcon = ArrowRight
export { ArrowRight }
export { ArrowDown }
export const ArrowUpIcon = ArrowUp
export { ArrowUp }
export const ArrowUpRight = ArrowRight // ArrowUpRight 使用 ArrowRight 图标替代
export const SearchIcon = Search
export { Search }
export const PlusIcon = Plus
export { Plus }
export const RefreshCw = Refresh
export const RefreshIcon = Refresh
export { Refresh }
export const ZoomInIcon = ZoomIn
export { ZoomIn }
export const CpuIcon = Cpu
export { Cpu }
export const FileText = Document
export { Document }
export const DollarSign = Money
export const Settings = Setting
export const Eye = View
export const Wrench = Tools
export const BarChart3 = DataAnalysis
export const Gift = Present
export const Heart = StarFilled // Heart icon using StarFilled from Element Plus
export const PenTool = EditPen
export { EditPen }

export { Files }
export const AlertTriangle = WarningFilled
export { WarningFilled } // 直接导出 WarningFilled(子组件 import 用)
export const Copy = CopyDocument
export { CopyDocument } // 直接导出 CopyDocument
export { Download }
export { Check }
export const X = Close
export { Close } // 直接导出 Close
export const Home = HomeFilled
export { Grid }
export { List }
export const ArrowUpDown = Sort
export const Trash2 = Delete
export const MoreVertical = MoreFilled
export const ArrowLeftRight = Sort // Approx
export const Trophy = Medal
export const Award = Medal // Award 使用 Medal 图标替代

// Additional mappings based on grep
export const AlertCircle = InfoFilled // Approx
export const BellIcon = Bell
export { Bell }
export const Info = InfoFilled

// Fallback for any missing icon
export const HelpCircle = InfoFilled
export const ChevronRight = ArrowRight
export const ChevronLeft = ArrowLeft
export const ChevronDown = ArrowDown
export const ChevronUp = ArrowUp
export const Upload = UploadFilled
export const Trash = Delete
export const Server = Cpu
export const Coins = Money
export const Link = LinkIcon
export const MessageCircle = ChatLineRound
export const Reply = ChatLineRound // Reply 使用 ChatLineRound 图标替代
export const ChatBubble = ChatDotRound // ChatBubble 使用 ChatDotRound 图标替代
export const VideoCamera = VideoPlay // VideoCamera 使用 VideoPlay 图标替代
export const Edit = EditIcon
export const CheckCircle = CircleCheck
export const CheckCircle2 = CheckCircle // CheckCircle2 别名(对齐 lucide 命名)
export const XCircle = CircleClose
export const Circle = InfoFilled
export const Image = Picture
export { Picture } // 直接导出 Picture
export const Clock = ClockIcon
export const Share2 = Share
export { Share }
export const Play = VideoPlay
export const Network = Connection
export const Zap = Lightning
export const At = Connection // At(@) 图标替代(Element Plus 无 At 导出, 用 Connection 近似)
export const Target = Aim
export const Headphones = Headset
export { Headset } // 直接导出 Headset
export const Music = Headset // Music 使用 Headset 图标替代
export const LayoutGrid = Grid // LayoutGrid 使用 Grid 图标替代
export const ShoppingBag = ShoppingCart
export const Layout = Grid
export const Layers = Management
export const Bookmark = Management
export const Edit3 = EditPen
export const Terminal = Document // Terminal 使用 Document 图标替代
export const Ticket = Money
export const Timer = ClockIcon // Timer 使用 Clock 图标替代
export const Monitor = MonitorIcon
export const MoreHorizontal = MoreFilled
export const EyeOff = Hide
export { Hide } // 直接导出 Hide
export const ChatQuote = ChatDotRound // ChatQuote 别名
export const Maximize2 = FullScreen
export const Minimize2 = MinusIcon
export const Minus = MinusIcon
export const Keyboard = Key // Keyboard icon substitute

// Additional icon mappings for example components
export const SettingsIcon = Setting
export const CodeIcon = Document // Code approx
export const ImageIcon = Picture
export const FileTextIcon = Document
export const GlobeIcon = Connection
export const DatabaseIcon = DataLine
export const CopyIcon = CopyDocument
export const ThumbsUpIcon = CircleCheck
export const ThumbsDownIcon = CircleClose
export const Loader2Icon = Loading
export const SparklesIcon = MagicStick
export const MicIcon = Microphone
export const SendIcon = Promotion
export { Promotion }
export const UsersIcon = UserFilled
export const DollarSignIcon = Money
export const ShoppingCartIcon = ShoppingCart
export { ShoppingCart }
export const TrendingUpIcon = TrendCharts
export const RefreshCwIcon = Refresh

// Additional icon exports for Wallet.vue
export const DocumentDelete = Delete // DocumentDelete 使用 Delete 图标替代
export const RefreshLeft = Refresh // RefreshLeft 使用 Refresh 图标替代

// Pagination icons
export const ChevronsLeft = DArrowLeft
export const ChevronsRight = DArrowRight

// Resizable / Sidebar icons
export const GripVertical = Rank
export const PanelLeft = Fold

// Additional exports needed by views
export const TrendingUp = TrendCharts
export { TrendCharts } // 直接导出 TrendCharts
export const FileCheck = DocumentChecked
export const Youtube = VideoPlay
export const Sparkles = MagicStick
export const Mic = Microphone
export const Send = Promotion
export const Users = UserFilled
export const Globe = Connection
export const Robot = Cpu // Robot 使用 Cpu 图标替代
export const Position = Aim // Position 使用 Aim 图标替代
export const Briefcase = Document // Briefcase 使用 Document 图标替代
export const BriefcaseIcon = Document
export const UserCircle = Avatar // UserCircle 使用 Avatar 图标替代
export const Building2 = Document // Building2 使用 Document 图标替代
export const Building = Document // Building 使用 Document 图标替代
export const Workflow = Connection // Workflow 使用 Connection 图标替代
export const GraduationCap = Document // GraduationCap 使用 Document 图标替代
export const BookOpen = Document // BookOpen 使用 Document 图标替代
export const Book = Document // Book 使用 Document 图标替代
export const Crown = Star // Crown 使用 Star 图标替代
export const QrCode = DocumentChecked // QrCode 使用 DocumentChecked 图标替代
export const Scan = ScanIcon // Scan 使用 Search 图标替代
export const Shield = Star // Shield 使用 Star 图标替代
export const Mail = ChatLineRound // Mail 使用 ChatLineRound 图标替代
export const MapPin = Aim // MapPin 使用 Aim 图标替代
export const Rocket = Promotion // Rocket 使用 Promotion 图标替代
export const Code = Document // Code 使用 Document 图标替代
export const Package = Present // Package 使用 Present 图标替代
export const Video = VideoPlay // Video 使用 VideoPlay 图标替代
export const Lightbulb = Sunny // Lightbulb 使用 Sunny 图标替代
export const UserCheck = CircleCheck // UserCheck 使用 CircleCheck 图标替代
export const Warning = WarningFilled // Warning 使用 WarningFilled 图标替代

// Theme toggle icons
export const Sun = Sunny
export { Moon }

// Logout icon
export const LogOut = SwitchButton

// Box icon
export const Box = Document // Box 使用 Document 图标替代

// Inbox icon
export const Inbox = Files // Inbox 使用 Files 图标替代

// Direct exports for commonly used icons
export { ChatDotRound }
export { Microphone }
export { Delete }
export { Loading }
export { CircleClose }
export { DocumentChecked }
export { CircleCheck }
export { MagicStick }
export { VideoPlay }
export { View }
export { Setting }
export const QuestionFilled = InfoFilled // QuestionFilled 使用 InfoFilled 图标替代
export const DocumentCopy = CopyDocument // DocumentCopy 别名
export { Connection }
export const Activity = DataLine
export { SuccessFilled, Management, CircleCheckFilled, Money, Medal, DataAnalysis }
export const SuccessFilledIcon = SuccessFilled // SuccessFilledIcon 别名
export const BarChart = DataAnalysis // BarChart 使用 DataAnalysis 图标替代
export const Brain = Cpu // Brain 使用 Cpu 图标替代
export const Puzzle = Grid // Puzzle 使用 Grid 图标替代
export const Plug = Connection // Plug 使用 Connection 图标替代
export const MicOff = Close // MicOff 使用 Close 图标替代
export const VolumeX = Close // VolumeX 使用 Close 图标替代
export const Volume2 = Headset // Volume2 使用 Headset 图标替代
export const Pause = Close // Pause 使用 Close 图标替代
export const Square2 = Close // Square2 使用 Close 图标替代
export const WandSparkles = MagicStick // WandSparkles 使用 MagicStick 图标替代
export const Clipboard = CopyDocument // Clipboard 使用 CopyDocument 图标替代
export const ClipboardCheck = DocumentChecked // ClipboardCheck 使用 DocumentChecked 图标替代
export const ClipboardCopy = CopyDocument // ClipboardCopy 使用 CopyDocument 图标替代
export const RotateCcw = Refresh // RotateCcw 使用 Refresh 图标替代
export const RotateCw = Refresh // RotateCw 使用 Refresh 图标替代
export const ExternalLink = Link // ExternalLink 使用 Link 图标替代
export const PenSquare = EditPen // PenSquare 使用 EditPen 图标替代
export const FileCode = Document // FileCode 使用 Document 图标替代
export const FileJson = Document // FileJson 使用 Document 图标替代
export const FilePen = EditPen // FilePen 使用 EditPen 图标替代
export const Eraser = Delete // Eraser 使用 Delete 图标替代
export const Highlighter = EditPen // Highlighter 使用 EditPen 图标替代
export const Type = Document // Type 使用 Document 图标替代
export const Expand = FullScreen // Expand 使用 FullScreen 图标替代
export const Shrink = MinusIcon // Shrink 使用 Minus 图标替代
export const AlignLeft = List // AlignLeft 使用 List 图标替代
export const AlignCenter = List // AlignCenter 使用 List 图标替代
export const AlignRight = List // AlignRight 使用 List 图标替代
export const Bold = Document // Bold 使用 Document 图标替代
export const Italic = Document // Italic 使用 Document 图标替代
export const Underline = Document // Underline 使用 Document 图标替代
export const ListOrdered = List // ListOrdered 使用 List 图标替代
export const ListBullets = List // ListBullets 使用 List 图标替代
export const Indent = ArrowRight // Indent 使用 ArrowRight 图标替代
export const Outdent = ArrowLeft // Outdent 使用 ArrowLeft 图标替代
export const MousePointer = Aim // MousePointer 使用 Aim 图标替代
export const Move = Aim // Move 使用 Aim 图标替代
export const Pencil = EditPen // Pencil 使用 EditPen 图标替代
export const Hand = View // Hand 使用 View 图标替代
export const ZapOff = Close // ZapOff 使用 Close 图标替代
export const History = ClockIcon // History 使用 Clock 图标替代
export const Timer2 = ClockIcon // Timer2 使用 Clock 图标替代
export const Sliders = Setting // Sliders 使用 Setting 图标替代
export const SlidersHorizontal = Setting // SlidersHorizontal 使用 Setting 图标替代
export const Filter = Sort // Filter 使用 Sort 图标替代
export const Download2 = Download // Download2 使用 Download 图标替代
export const Save = Download // Save 使用 Download 图标替代
export const Import = Download // Import 使用 Download 图标替代
export const Export = UploadFilled // Export 使用 UploadFilled 图标替代
export const Undo = RefreshLeft // Undo 使用 RefreshLeft 图标替代
export const Redo = Refresh // Redo 使用 Refresh 图标替代
export const Unlink = Close // Unlink 使用 Close 图标替代
export const Camera = VideoPlay // Camera 使用 VideoPlay 图标替代
export const CameraIcon = VideoPlay // CameraIcon 使用 VideoPlay 图标替代
export const ClipboardPaste = CopyDocument // ClipboardPaste 使用 CopyDocument 图标替代
export const ScreenShare = MonitorIcon // ScreenShare 使用 Monitor 图标替代
export const Navigation = Aim // Navigation 使用 Aim 图标替代
export const Stethoscope = Cpu // Stethoscope 使用 Cpu 图标替代
export const ListTodo = List // ListTodo 使用 List 图标替代
export const Hash = Document // Hash 使用 Document 图标替代
export const Repeat = Refresh // Repeat 使用 Refresh 图标替代
export const Circle2 = InfoFilled // Circle2 使用 InfoFilled 图标替代
export const Database = DataLine // Database 使用 DataLine 图标替代
export const Coin = Money // Coin 别名
export const Message = ChatDotRound // Message 别名
export { ChatLineRound }
export const OfficeBuilding = Document // OfficeBuilding 使用 Document 图标替代
export const Location = Aim // Location 使用 Aim 图标替代
export const Service = Cpu // Service 别名（同 Server）
export const CollectionFilled = StarFilled // CollectionFilled 别名
export const Collection = Star // Collection 使用 Star 图标替代

// Direct export for InfoFilled
export { InfoFilled }

// Voice recording related icons
export const MicrophoneOff = Close // MicrophoneOff 使用 Close 图标替代
export const VideoPause = Close // VideoPause 使用 Close 图标替代（暂停按钮）
export const StopCircle = CircleClose // StopCircle 使用 CircleClose 图标替代
export const Square = Close // Square 使用 Close 图标替代（停止图标）
export const CircleCloseFilled = CircleClose // CircleCloseFilled 使用 CircleClose 替代
export const WarnTriangleFilled = WarningFilled // WarnTriangleFilled 使用 WarningFilled 替代

// Shield and Folder icons
export const ShieldCheck = CircleCheckFilled // ShieldCheck 使用 CircleCheckFilled 图标替代
export const FolderOpened = FolderOpenedIcon // FolderOpened 直接使用 Element Plus 的 FolderOpened 图标
export { FolderOpenedIcon } // 也导出原始名称

// Additional missing icon exports
export const Presentation = Present // Presentation 使用 Present 图标替代
export const Table = Grid // Table 使用 Grid 图标替代
export const TestTube = Odometer // TestTube 使用 Odometer 图标替代
export const GitBranch = Share // GitBranch 使用 Share 图标替代
export const Wand2 = MagicStick // Wand2 使用 MagicStick 图标替代
export const Palette = Brush // Palette 使用 Brush 图标替代
export const Paintbrush = Brush // Paintbrush 使用 Brush 图标替代
export { Brush } // 直接导出 Brush
export const Twitter = ChatDotRound // Twitter 使用 ChatDotRound 图标替代
export const Folder = FolderIcon // Folder 直接使用 Element Plus 的 Folder 图标
export { FolderIcon } // 也导出原始名称
export const FileEdit = EditPen // FileEdit 使用 EditPen 图标替代
export const UploadCloud = UploadFilled // UploadCloud 使用 UploadFilled 图标替代
export { UserFilled } // 直接导出 UserFilled

// Enterprise Service page icons
export const Bot = Cpu // Bot 使用 Cpu 图标替代
export const UsersRound = UserFilled // UsersRound 使用 UserFilled 图标替代
export const UserPlus = Avatar // UserPlus 使用 Avatar 图标替代
export const Calendar = ClockIcon // Calendar 使用 Clock 图标替代
export const Compass = Aim // Compass 使用 Aim 图标替代
export const Megaphone = Promotion // Megaphone 使用 Promotion 图标替代
export const Wifi = Connection // Wifi 使用 Connection 图标替代
export const Cog = Setting // Cog 使用 Setting 图标替代
export const TrendingDown = TrendCharts // TrendingDown 使用 TrendCharts 图标替代
export const Factory = Document // Factory 使用 Document 图标替代
export const Reading = Document // Reading 使用 Document 图标替代 (element-plus icons 中可能不存在)

// 兜底: re-export 所有 Element Plus 图标, 避免 179 个使用方出现 "does not provide an export named X" 错误
export * from '@element-plus/icons-vue'

// Lucide exports some generic types or functions, we might need to mock them if used?
// For now, just icons.
