// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export { cn } from './lib/utils'
// lucide-react 全量转导出: 供 web 各端从 @ihui/ui-react 统一取图标(避免散落 import 'lucide-react')
export * from 'lucide-react'
export { Button, buttonVariants } from './components/button'
export { Input } from './components/input'
// SearchInput 全项目统一搜索框(2026-09-15 立,圆角输入井唯一视觉来源,web + extension 共用)
export { SearchInput, searchInputWellClassName } from './components/search-input'
export type { SearchInputProps } from './components/search-input'
export { ContextInjectionList } from './components/context-injection-list'
export type {
  ContextInjectionItem,
  ContextInjectionListProps,
} from './components/context-injection-list'
export { Label } from './components/label'
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './components/card'
export { StatCard, StatGrid } from './components/stat-card'
export type { StatCardProps, StatGridProps } from './components/stat-card'
export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './components/dialog'
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from './components/select'
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './components/table'
export { Tabs, TabsList, TabsTrigger, TabsContent } from './components/tabs'
export { Checkbox } from './components/checkbox'
export { Switch } from './components/switch'
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './components/tooltip'
export { TreeSelect } from './components/tree-select'
export type { TreeNode, TreeSelectLabels } from './components/tree-select'
export { ThemeLogo } from './components/theme-logo'
export { Sidebar, SidebarItem, SidebarGroup } from './components/sidebar'
export { VipBadge } from './components/vip-badge'
export { Upload } from './components/Upload'
// `UploadLabels` 是**对外契约**的一部分:`apps/web/src/hooks/use-upload-labels.ts` 按
// `import type { UploadLabels } from '@ihui/ui-react'` 取它来钉住"标签必须由调用方注入"
// 这条本地化纪律。漏导出 ⇒ 消费方 TS2305(且 `UploadProps.labels` 是 Partial<它>,
// 类型在包内被用、在包外不可名,正是"写了没人能接"的那一类断链)。
export type { UploadProps, UploadLabels } from './components/Upload'
export { Badge, badgeVariants } from './components/badge'
export type { BadgeProps } from './components/badge'
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from './components/collapsible'
export type {
  CollapsibleProps,
  CollapsibleTriggerProps,
  CollapsibleContentProps,
} from './components/collapsible'
export { CodeBlock } from './components/code-block'
export type { CodeBlockProps } from './components/code-block'
export { LogViewer } from './components/log-viewer'
export type { LogViewerProps } from './components/log-viewer'
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from './components/sheet'
export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from './components/drawer'
export { DataTable } from './components/data-table'
export type { DataTableColumn, DataTableLabels, DataTableProps } from './components/data-table'
// 工作展示区组件(2026-07-22 立,AI 对话内嵌浏览器)
export { ResizableHandle } from './components/resizable'
export type { ResizableHandleProps } from './components/resizable'
export { WebViewFrame } from './components/webview-frame'
export type { WebViewFrameProps, WebViewMode, WebViewStatus } from './components/webview-frame'
export type { WebViewFrameLabels } from './components/webview-frame'
export { WorkPanel } from './components/work-panel'
export type { WorkPanelProps, WorkPanelTabItem, WorkPanelLabels } from './components/work-panel'
// AuthShell 统一登录弹窗外壳(2026-07-26 抽取到共享包,web + extension 共用)
export { AuthShell, AuthShellCompact } from './components/auth-shell'
export type { AuthShellProps } from './components/auth-shell'
// CloseButton 全项目统一关闭按钮(2026-09-16 立,样式 token 来自 @ihui/design-tokens close-button.ts)
export { CloseButton } from './components/close-button'
export type { CloseButtonProps } from './components/close-button'
// IconButton 全项目统一图标按钮(2026-09-17 立,样式 token 来自 @ihui/design-tokens icon-button.ts)
// 尺寸两档 sm(28×28)/ md(32×32,默认),标题栏/工具栏/面板控制图标按钮一律用本组件,
// 禁止业务代码手写 h-7 w-7 / h-8 w-8 等散装尺寸。
export { IconButton } from './components/icon-button'
export type { IconButtonProps } from './components/icon-button'
// LoginForm 共享登录表单(2026-07-26 抽取到共享包,4 tab + 8 第三方登录 + 协议复选框 + 协议弹窗)
export {
  LoginForm,
  PasswordLoginForm,
  EmailCodeLoginForm,
  PhoneCodeLoginForm,
  QrTab,
  ThirdPartyLoginButtons,
  AgreementCheckbox,
  AgreementNoticeDialog,
  AccountHistoryInput,
  ALL_THIRD_PARTY_PLATFORMS,
  isValidEmail,
  isValidPhone,
} from './components/login-form'
export type {
  LoginFormProps,
  LoginApiClient,
  LoginResult,
  LoginTab,
  ThirdPartyPlatform,
  ThirdPartyProvider,
  ThirdPartyConfig,
  QrPlatformConfig,
  PasswordLoginFormProps,
  EmailCodeLoginFormProps,
  PhoneCodeLoginFormProps,
  QrTabProps,
  ThirdPartyLoginButtonsProps,
  AgreementCheckboxProps,
  AgreementNoticeDialogProps,
  AccountHistoryInputProps,
} from './components/login-form'
// 记住密码 / 账号历史 / 自动登录 凭据管理(2026-07-30 抽到共享包,只依赖 localStorage)
export {
  saveRememberedCredentials,
  loadRememberedCredentials,
  clearRememberedCredentials,
  saveAutoLogin,
  loadAutoLogin,
  clearAutoLogin,
  saveLoginHistory,
  loadLoginHistory,
  clearLoginHistory,
  removeFromLoginHistory,
} from './lib/remember-credentials'
export type { RememberedCredentials } from './lib/remember-credentials'
// PageShell Web 系三端共用页面级布局外壳(2026-08-01 抽取到共享包,P3-2.3,
// web + extension + desktop 共用 header/sidebar/main/footer app shell 结构)
export { PageShell } from './page-shell'
export type { PageShellProps } from './page-shell'
// CategoryBar 统一分类条(横滑单选 chip 条,RN 侧 CategoryInlineBar 的 web 同形实现,
// 各端筛选条一律走本组件,禁止端内再手搓 chip)
export { CategoryBar } from './components/category-bar'
export type { CategoryBarItem, CategoryBarProps } from './components/category-bar'

// AuthShell + LoginForm 共享样式(单一来源,web + extension globals.css 都 @import 这份)
import './styles/auth-shell.css'
import './styles/login-form.css'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
