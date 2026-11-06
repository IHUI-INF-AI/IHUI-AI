// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * node 环境下的 lucide-react-native 最小桩。
 *
 * 背景:RN 共享屏的图标都来自 lucide-react-native。真包 index.js 会 re-export 约 1600 个
 * 图标模块,而它的 Icon.mjs 又静态引 'react-native-svg'(后者内部 require('react-native'))。
 * 外部化后由 Node 加载 ⇒ 真实 react-native 的 Flow 源码让整份测试在**收集期**
 * 直接 `SyntaxError: Unexpected token 'typeof'`;若改成 inline,则每个套件都要转换上千个
 * 图标模块(实测单套件 collect 从 1.9s 涨到 312s)。
 *
 * 因此这里按「本仓共享屏实际引用的图标名」生成同名桩(生成源:packages/app/src +
 * apps/mobile-rn/src 的 import 语句),每个图标都是一个渲染空 <svg data-icon> 的组件。
 * 只切平台依赖,不改变被测判序(这些用例断言的是文案/testid,不是图标内部路径)。
 * 新增图标 import 时本文件需同步补一条(生成方式见本文件顶部说明的脚本口径)。
 */

import { createElement, type ReactNode } from 'react'

type IconProps = Record<string, unknown> & { size?: number; color?: string; children?: ReactNode }

const makeIcon = (name: string) => {
  const Icon = (props: IconProps) =>
    createElement(
      'svg',
      { 'data-icon': name, width: props.size ?? 24, height: props.size ?? 24 },
      props.children,
    )
  Icon.displayName = `LucideStub_${name}`
  return Icon
}

const iconNames = [
  'Activity',
  'AlertCircle',
  'AlertTriangle',
  'AppWindow',
  'Archive',
  'ArchiveRestore',
  'ArrowDown',
  'ArrowRight',
  'ArrowUp',
  'Award',
  'BadgeCheck',
  'Banknote',
  'BarChart3',
  'Bell',
  'BellRing',
  'Blocks',
  'Bookmark',
  'BookmarkCheck',
  'BookMarked',
  'BookOpen',
  'Bot',
  'Boxes',
  'Brain',
  'BriefcaseBusiness',
  'Building2',
  'Cake',
  'Calendar',
  'CalendarCheck',
  'CalendarClock',
  'CalendarDays',
  'Camera',
  'ChartLine',
  'Check',
  'CheckCircle2',
  'ChevronDown',
  'ChevronLeft',
  'ChevronRight',
  'ChevronsLeft',
  'ChevronsRight',
  'ChevronUp',
  'Circle',
  'CircleAlert',
  'CircleCheck',
  'CircleDashed',
  'CircleDollarSign',
  'CircleHelp',
  'CircleQuestionMark',
  'Clapperboard',
  'ClipboardList',
  'ClipboardPaste',
  'Clock',
  'Cloud',
  'Code',
  'Coins',
  'Compass',
  'Copy',
  'CornerDownLeft',
  'Cpu',
  'CreditCard',
  'Crown',
  'Database',
  'Download',
  'Earth',
  'Eraser',
  'ExternalLink',
  'Eye',
  'EyeOff',
  'FileAudio',
  'FileCode',
  'FileJson',
  'Files',
  'FileSpreadsheet',
  'FileText',
  'FileUp',
  'Film',
  'Flame',
  'FlaskConical',
  'Folder',
  'FolderOpen',
  'Gauge',
  'Gem',
  'Gift',
  'GitBranchPlus',
  'Globe',
  'Globe2',
  'GraduationCap',
  'Handshake',
  'Hash',
  'Headset',
  'Heart',
  'HelpCircle',
  'History',
  'Home',
  'IdCard',
  'Image',
  'ImageOff',
  'Images',
  'Inbox',
  'Info',
  'Key',
  'Keyboard',
  'KeyRound',
  'Landmark',
  'Languages',
  'Layers',
  'LayoutGrid',
  'LayoutTemplate',
  'Library',
  'Lightbulb',
  'Link',
  'Link2',
  'Link2Off',
  'ListChecks',
  'ListTodo',
  'Loader2',
  'Lock',
  'LogIn',
  'LogOut',
  'Mail',
  'MailOpen',
  'Map',
  'MapPin',
  'Maximize',
  'Medal',
  'Megaphone',
  'Menu',
  'MessageCircle',
  'MessageSquare',
  'MessageSquarePlus',
  'MessagesSquare',
  'Mic',
  'Minimize',
  'Minimize2',
  'Minus',
  'Monitor',
  'MonitorSmartphone',
  'Moon',
  'MoreHorizontal',
  'MousePointerClick',
  'Music',
  'Network',
  'Newspaper',
  'NotebookPen',
  'Orbit',
  'Package',
  'PackageOpen',
  'Palette',
  'Paperclip',
  'PartyPopper',
  'Pause',
  'PauseCircle',
  'Pencil',
  'PenLine',
  'Phone',
  'Pin',
  'PinOff',
  'Play',
  'PlayCircle',
  'Plug',
  'Plus',
  'Presentation',
  'Puzzle',
  'QrCode',
  'Radio',
  'Receipt',
  'RefreshCcw',
  'RefreshCw',
  'Repeat',
  'Rocket',
  'RotateCcw',
  'Save',
  'Scale',
  'ScanLine',
  'Scissors',
  'ScrollText',
  'Search',
  'Send',
  'Server',
  'Settings',
  'Share2',
  'Shield',
  'ShieldAlert',
  'ShieldCheck',
  'ShieldOff',
  'ShoppingBag',
  'ShoppingCart',
  'Slash',
  'SlidersHorizontal',
  'Smartphone',
  'Sparkles',
  'Speaker',
  'Square',
  'SquareFunction',
  'SquarePen',
  'Stamp',
  'Star',
  'StickyNote',
  'Store',
  'Subtitles',
  'Sun',
  'Tag',
  'Target',
  'ThumbsDown',
  'ThumbsUp',
  'Ticket',
  'Trash2',
  'TrendingUp',
  'TriangleAlert',
  'Trophy',
  'Truck',
  'Type',
  'Undo2',
  'Upload',
  'User',
  'UserCheck',
  'UserCog',
  'UserPlus',
  'UserRoundX',
  'Users',
  'UsersRound',
  'Video',
  'Volume2',
  'Wallet',
  'Wand2',
  'Wifi',
  'WifiOff',
  'Workflow',
  'Wrench',
  'X',
  'XCircle',
  'Zap',
] as const

export type LucideIcon = (props: IconProps) => ReturnType<typeof createElement>

const icons = iconNames.reduce<Record<(typeof iconNames)[number], LucideIcon>>(
  (acc, n) => {
    acc[n] = makeIcon(n)
    return acc
  },
  {} as Record<(typeof iconNames)[number], LucideIcon>,
)

export const createLucideIcon = (name: string, _nodes: unknown) => makeIcon(name)
export const Icon = makeIcon('Icon')
export const Activity = icons.Activity
export const AlertCircle = icons.AlertCircle
export const AlertTriangle = icons.AlertTriangle
export const AppWindow = icons.AppWindow
export const Archive = icons.Archive
export const ArchiveRestore = icons.ArchiveRestore
export const ArrowDown = icons.ArrowDown
export const ArrowRight = icons.ArrowRight
export const ArrowUp = icons.ArrowUp
export const Award = icons.Award
export const BadgeCheck = icons.BadgeCheck
export const Banknote = icons.Banknote
export const BarChart3 = icons.BarChart3
export const Bell = icons.Bell
export const BellRing = icons.BellRing
export const Blocks = icons.Blocks
export const Bookmark = icons.Bookmark
export const BookmarkCheck = icons.BookmarkCheck
export const BookMarked = icons.BookMarked
export const BookOpen = icons.BookOpen
export const Bot = icons.Bot
export const Boxes = icons.Boxes
export const Brain = icons.Brain
export const BriefcaseBusiness = icons.BriefcaseBusiness
export const Building2 = icons.Building2
export const Cake = icons.Cake
export const Calendar = icons.Calendar
export const CalendarCheck = icons.CalendarCheck
export const CalendarClock = icons.CalendarClock
export const CalendarDays = icons.CalendarDays
export const Camera = icons.Camera
export const ChartLine = icons.ChartLine
export const Check = icons.Check
export const CheckCircle2 = icons.CheckCircle2
export const ChevronDown = icons.ChevronDown
export const ChevronLeft = icons.ChevronLeft
export const ChevronRight = icons.ChevronRight
export const ChevronsLeft = icons.ChevronsLeft
export const ChevronsRight = icons.ChevronsRight
export const ChevronUp = icons.ChevronUp
export const Circle = icons.Circle
export const CircleAlert = icons.CircleAlert
export const CircleCheck = icons.CircleCheck
export const CircleDashed = icons.CircleDashed
export const CircleDollarSign = icons.CircleDollarSign
export const CircleHelp = icons.CircleHelp
export const CircleQuestionMark = icons.CircleQuestionMark
export const Clapperboard = icons.Clapperboard
export const ClipboardList = icons.ClipboardList
export const ClipboardPaste = icons.ClipboardPaste
export const Clock = icons.Clock
export const Cloud = icons.Cloud
export const Code = icons.Code
export const Coins = icons.Coins
export const Compass = icons.Compass
export const Copy = icons.Copy
export const CornerDownLeft = icons.CornerDownLeft
export const Cpu = icons.Cpu
export const CreditCard = icons.CreditCard
export const Crown = icons.Crown
export const Database = icons.Database
export const Download = icons.Download
export const Earth = icons.Earth
export const Eraser = icons.Eraser
export const ExternalLink = icons.ExternalLink
export const Eye = icons.Eye
export const EyeOff = icons.EyeOff
export const FileAudio = icons.FileAudio
export const FileCode = icons.FileCode
export const FileJson = icons.FileJson
export const Files = icons.Files
export const FileSpreadsheet = icons.FileSpreadsheet
export const FileText = icons.FileText
export const FileUp = icons.FileUp
export const Film = icons.Film
export const Flame = icons.Flame
export const FlaskConical = icons.FlaskConical
export const Folder = icons.Folder
export const FolderOpen = icons.FolderOpen
export const Gauge = icons.Gauge
export const Gem = icons.Gem
export const Gift = icons.Gift
export const GitBranchPlus = icons.GitBranchPlus
export const Globe = icons.Globe
export const Globe2 = icons.Globe2
export const GraduationCap = icons.GraduationCap
export const Handshake = icons.Handshake
export const Hash = icons.Hash
export const Headset = icons.Headset
export const Heart = icons.Heart
export const HelpCircle = icons.HelpCircle
export const History = icons.History
export const Home = icons.Home
export const IdCard = icons.IdCard
export const Image = icons.Image
export const ImageOff = icons.ImageOff
export const Images = icons.Images
export const Inbox = icons.Inbox
export const Info = icons.Info
export const Key = icons.Key
export const Keyboard = icons.Keyboard
export const KeyRound = icons.KeyRound
export const Landmark = icons.Landmark
export const Languages = icons.Languages
export const Layers = icons.Layers
export const LayoutGrid = icons.LayoutGrid
export const LayoutTemplate = icons.LayoutTemplate
export const Library = icons.Library
export const Lightbulb = icons.Lightbulb
export const Link = icons.Link
export const Link2 = icons.Link2
export const Link2Off = icons.Link2Off
export const ListChecks = icons.ListChecks
export const ListTodo = icons.ListTodo
export const Loader2 = icons.Loader2
export const Lock = icons.Lock
export const LogIn = icons.LogIn
export const LogOut = icons.LogOut
export const Mail = icons.Mail
export const MailOpen = icons.MailOpen
export const Map = icons.Map
export const MapPin = icons.MapPin
export const Maximize = icons.Maximize
export const Medal = icons.Medal
export const Megaphone = icons.Megaphone
export const Menu = icons.Menu
export const MessageCircle = icons.MessageCircle
export const MessageSquare = icons.MessageSquare
export const MessageSquarePlus = icons.MessageSquarePlus
export const MessagesSquare = icons.MessagesSquare
export const Mic = icons.Mic
export const Minimize = icons.Minimize
export const Minimize2 = icons.Minimize2
export const Minus = icons.Minus
export const Monitor = icons.Monitor
export const MonitorSmartphone = icons.MonitorSmartphone
export const Moon = icons.Moon
export const MoreHorizontal = icons.MoreHorizontal
export const MousePointerClick = icons.MousePointerClick
export const Music = icons.Music
export const Network = icons.Network
export const Newspaper = icons.Newspaper
export const NotebookPen = icons.NotebookPen
export const Orbit = icons.Orbit
export const Package = icons.Package
export const PackageOpen = icons.PackageOpen
export const Palette = icons.Palette
export const Paperclip = icons.Paperclip
export const PartyPopper = icons.PartyPopper
export const Pause = icons.Pause
export const PauseCircle = icons.PauseCircle
export const Pencil = icons.Pencil
export const PenLine = icons.PenLine
export const Phone = icons.Phone
export const Pin = icons.Pin
export const PinOff = icons.PinOff
export const Play = icons.Play
export const PlayCircle = icons.PlayCircle
export const Plug = icons.Plug
export const Plus = icons.Plus
export const Presentation = icons.Presentation
export const Puzzle = icons.Puzzle
export const QrCode = icons.QrCode
export const Radio = icons.Radio
export const Receipt = icons.Receipt
export const RefreshCcw = icons.RefreshCcw
export const RefreshCw = icons.RefreshCw
export const Repeat = icons.Repeat
export const Rocket = icons.Rocket
export const RotateCcw = icons.RotateCcw
export const Save = icons.Save
export const Scale = icons.Scale
export const ScanLine = icons.ScanLine
export const Scissors = icons.Scissors
export const ScrollText = icons.ScrollText
export const Search = icons.Search
export const Send = icons.Send
export const Server = icons.Server
export const Settings = icons.Settings
export const Share2 = icons.Share2
export const Shield = icons.Shield
export const ShieldAlert = icons.ShieldAlert
export const ShieldCheck = icons.ShieldCheck
export const ShieldOff = icons.ShieldOff
export const ShoppingBag = icons.ShoppingBag
export const ShoppingCart = icons.ShoppingCart
export const Slash = icons.Slash
export const SlidersHorizontal = icons.SlidersHorizontal
export const Smartphone = icons.Smartphone
export const Sparkles = icons.Sparkles
export const Speaker = icons.Speaker
export const Square = icons.Square
export const SquareFunction = icons.SquareFunction
export const SquarePen = icons.SquarePen
export const Stamp = icons.Stamp
export const Star = icons.Star
export const StickyNote = icons.StickyNote
export const Store = icons.Store
export const Subtitles = icons.Subtitles
export const Sun = icons.Sun
export const Tag = icons.Tag
export const Target = icons.Target
export const ThumbsDown = icons.ThumbsDown
export const ThumbsUp = icons.ThumbsUp
export const Ticket = icons.Ticket
export const Trash2 = icons.Trash2
export const TrendingUp = icons.TrendingUp
export const TriangleAlert = icons.TriangleAlert
export const Trophy = icons.Trophy
export const Truck = icons.Truck
export const Type = icons.Type
export const Undo2 = icons.Undo2
export const Upload = icons.Upload
export const User = icons.User
export const UserCheck = icons.UserCheck
export const UserCog = icons.UserCog
export const UserPlus = icons.UserPlus
export const UserRoundX = icons.UserRoundX
export const Users = icons.Users
export const UsersRound = icons.UsersRound
export const Video = icons.Video
export const Volume2 = icons.Volume2
export const Wallet = icons.Wallet
export const Wand2 = icons.Wand2
export const Wifi = icons.Wifi
export const WifiOff = icons.WifiOff
export const Workflow = icons.Workflow
export const Wrench = icons.Wrench
export const X = icons.X
export const XCircle = icons.XCircle
export const Zap = icons.Zap

export default icons
