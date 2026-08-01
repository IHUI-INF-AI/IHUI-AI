export { cn } from './lib/utils'
export { Button, buttonVariants } from './components/button'
export { Input } from './components/input'
export { Label } from './components/label'
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './components/card'
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
export type { TreeNode } from './components/tree-select'
export { ThemeLogo } from './components/theme-logo'
export { Sidebar, SidebarItem, SidebarGroup } from './components/sidebar'
export { VipBadge } from './components/vip-badge'
export { Upload } from './components/Upload'
export type { UploadProps } from './components/Upload'
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
export type { DataTableColumn, DataTableProps } from './components/data-table'
// 工作展示区组件(2026-07-22 立,AI 对话内嵌浏览器)
export { ResizableHandle } from './components/resizable'
export type { ResizableHandleProps } from './components/resizable'
export { WebViewFrame } from './components/webview-frame'
export type { WebViewFrameProps, WebViewMode, WebViewStatus } from './components/webview-frame'
export { WorkPanel } from './components/work-panel'
export type { WorkPanelProps, WorkPanelTabItem } from './components/work-panel'
// AuthShell 统一登录弹窗外壳(2026-07-26 抽取到共享包,web + extension 共用)
export { AuthShell, AuthShellCompact } from './components/auth-shell'
export type { AuthShellProps } from './components/auth-shell'
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

// AuthShell + LoginForm 共享样式(单一来源,web + extension globals.css 都 @import 这份)
import './styles/auth-shell.css'
import './styles/login-form.css'
