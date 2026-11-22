// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * lucide-react-native 的测试桩。与构建别名同源:config/index.ts 在构建期把
 * `lucide-react-native` 换成端内实现(src/rn-compat/icons-generated.tsx),
 * vitest.config.ts 在测试期指向本文件。
 *
 * 为什么不能直接用端内实现:它的 JSX 由 miniapp 的 react@18 运行时编译,而共享屏用例
 * 用 packages/app 自带的 react-dom@19 做 SSR —— react19 的元素符号是
 * `react.transitional.element`,react18 造出的元素被当作普通对象拒收
 * (Objects are not valid as a React child)。本桩不引任何 React 运行时,只返回 null,
 * 与渲染器版本解耦;图标本身不参与断言(用例判的是布局、文案与顺序)。
 *
 * 导出名单 = packages/app/src 全量 `import { ... } from 'lucide-react-native'` 的具名并集
 * (现算 142 枚)。共享屏新增图标时重跑:
 *   node scripts/gen-rn-compat.mjs --write  之后再按本文件补一行导出即可。
 */
const Icon = () => null
export const AlertTriangle = Icon
export const Archive = Icon
export const ArchiveRestore = Icon
export const ArrowDown = Icon
export const ArrowRight = Icon
export const Award = Icon
export const BadgeCheck = Icon
export const Banknote = Icon
export const BarChart3 = Icon
export const Bell = Icon
export const Blocks = Icon
export const BookOpen = Icon
export const Bookmark = Icon
export const Bot = Icon
export const Building2 = Icon
export const Cake = Icon
export const Calendar = Icon
export const CalendarCheck = Icon
export const CalendarClock = Icon
export const CalendarDays = Icon
export const Check = Icon
export const CheckCircle2 = Icon
export const ChevronDown = Icon
export const ChevronLeft = Icon
export const ChevronRight = Icon
export const ChevronUp = Icon
export const CircleDollarSign = Icon
export const Clapperboard = Icon
export const ClipboardList = Icon
export const Clock = Icon
export const Cloud = Icon
export const Code = Icon
export const Copy = Icon
export const CornerDownLeft = Icon
export const Cpu = Icon
export const CreditCard = Icon
export const Crown = Icon
export const Database = Icon
export const Download = Icon
export const ExternalLink = Icon
export const Eye = Icon
export const EyeOff = Icon
export const FileCode = Icon
export const FileJson = Icon
export const FileSpreadsheet = Icon
export const FileText = Icon
export const FileUp = Icon
export const Film = Icon
export const Flame = Icon
export const FlaskConical = Icon
export const FolderOpen = Icon
export const Gauge = Icon
export const Gem = Icon
export const Gift = Icon
export const Globe = Icon
export const Globe2 = Icon
export const GraduationCap = Icon
export const Handshake = Icon
export const Hash = Icon
export const Headset = Icon
export const Heart = Icon
export const History = Icon
export const Image = Icon
export const ImageOff = Icon
export const Images = Icon
export const Info = Icon
export const KeyRound = Icon
export const Keyboard = Icon
export const Landmark = Icon
export const Layers = Icon
export const Lightbulb = Icon
export const Link2 = Icon
export const Link2Off = Icon
export const ListChecks = Icon
export const Loader2 = Icon
export const Mail = Icon
export const Maximize = Icon
export const Maximize2 = Icon
export const Medal = Icon
export const MessageCircle = Icon
export const MessageSquare = Icon
export const Mic = Icon
export const Minimize = Icon
export const Minus = Icon
export const Moon = Icon
export const Music = Icon
export const Newspaper = Icon
export const Package = Icon
export const PackageOpen = Icon
export const Palette = Icon
export const Paperclip = Icon
export const PenLine = Icon
export const Pencil = Icon
export const Pin = Icon
export const PinOff = Icon
export const Play = Icon
export const PlayCircle = Icon
export const Plug = Icon
export const Plus = Icon
export const QrCode = Icon
export const Radio = Icon
export const RefreshCw = Icon
export const Rocket = Icon
export const Save = Icon
export const Scissors = Icon
export const ScrollText = Icon
export const Search = Icon
export const Server = Icon
export const Settings = Icon
export const Shield = Icon
export const ShieldCheck = Icon
export const ShoppingBag = Icon
export const ShoppingCart = Icon
export const Smartphone = Icon
export const Sparkles = Icon
export const Square = Icon
export const SquarePen = Icon
export const Stamp = Icon
export const Star = Icon
export const StickyNote = Icon
export const Subtitles = Icon
export const Sun = Icon
export const Tag = Icon
export const Target = Icon
export const Ticket = Icon
export const Trash2 = Icon
export const TrendingUp = Icon
export const Trophy = Icon
export const Truck = Icon
export const Upload = Icon
export const User = Icon
export const UserCheck = Icon
export const UserPlus = Icon
export const Users = Icon
export const Video = Icon
export const Wallet = Icon
export const Wand2 = Icon
export const Workflow = Icon
export const Wrench = Icon
export const X = Icon
export const XCircle = Icon
export const Zap = Icon

export type LucideIcon = typeof Icon
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
