// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 宿主能力端口跨端契约(M4 T1,2026-11-02 立)。
 *
 * 共享屏(`packages/app/src/features/**`)是 RN / 小程序 / web 的唯一渲染真相源,
 * 平台能力(导航、提示、登录态、存储、媒体、确认框、分页)一律由宿主注入,
 * 共享层不得直接 import 任何平台 SDK。本文件只定义"腿"的形状,不含实现。
 *
 * 必填端口的运行时闸在 `packages/app/src/host/ports.ts` 的 `assertRequiredPort`:
 * dev 缺腿直接抛错,prod 返回错误态标记;可选端口缺省必须显式落 `capability-off`,
 * 不允许静默 noop(noop 会把"能力缺失"伪装成"调用成功")。
 */

/** 导航参数:只允许标量,保证跨端(含小程序参数序列化)稳定。 */
export type NavParams = Readonly<Record<string, string | number | boolean | null | undefined>>

/** 导航选项。`replace` 用于交卷/支付等不可回退链,`tab` 用于 tabBar 页切换。 */
export interface HostNavigateOptions {
  replace?: boolean
  tab?: boolean
}

/**
 * 导航端口。`target` 为跨端逻辑路由名(不是平台路径);
 * 未知 target 由宿主实现按 dev 抛错 / prod 可见错误处理,共享屏不得自猜落点。
 */
export type OnNavigate = (target: string, params?: NavParams, options?: HostNavigateOptions) => void

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastOptions {
  kind?: ToastKind
  duration?: number
}

/**
 * 轻提示端口。fire-and-forget:宿主实现不得抛错,调用方也不等待。
 * 取消/失败类错误提示仍走共享屏自身的 error 态,不经本端口。
 */
export type OnToast = (message: string, options?: ToastOptions) => void

export interface ViewerInfo {
  userId: string
  nickname?: string
  avatarUrl?: string
  isVip?: boolean
}

/** 登录态端口。`ensureLogin` 取消/拒绝一律 resolve(false),绝不 reject。 */
export interface SessionPort {
  isLoggedIn(): boolean
  ensureLogin(): Promise<boolean>
  readonly userId?: string | null
  readonly viewer?: ViewerInfo | null
}

/** 键值存储端口。`get` 解析失败返回 null;`set` / `remove` 不抛。 */
export interface KvPort {
  get<T>(key: string): T | null
  set(key: string, value: unknown): void
  remove(key: string): void
}

/** 媒体资源句柄(统一 pickImage / pickFile 的返回形态)。 */
export interface MediaAsset {
  uri: string
  name?: string
  mimeType?: string
  size?: number
  width?: number
  height?: number
}

export interface PickImageOptions {
  count?: number
  source?: 'album' | 'camera'
}

/** 媒体端口。用户取消返回 null(不是抛错)。 */
export interface MediaPort {
  pickImage(options?: PickImageOptions): Promise<MediaAsset | null>
  previewImage(urls: readonly string[], index?: number): Promise<void>
  pickFile?(): Promise<MediaAsset | null>
}

export interface ConfirmOptions {
  title: string
  content?: string
  confirmText?: string
  cancelText?: string
}

export interface ActionSheetItem {
  label: string
  value?: string
  destructive?: boolean
}

export interface ActionSheetOptions {
  title?: string
  items: readonly ActionSheetItem[]
}

/**
 * 通用 UI 能力端口。`confirm` 取消 → false;`actionSheet` 取消 → null;
 * `loading` 为命令式显隐;`clipboard.write` 失败返回 false;`haptic` 可选能力。
 */
export interface UiPort {
  confirm(options: ConfirmOptions): Promise<boolean>
  actionSheet(options: ActionSheetOptions): Promise<number | null>
  loading(show: boolean, text?: string): void
  clipboard: {
    write(text: string): Promise<boolean>
  }
  haptic?(kind: 'light' | 'medium' | 'heavy'): void
}

/** 列表分页端口。可选能力;缺省即"无下拉/无触底",由宿主按本端能力决定。 */
export interface ListPort {
  onLoadMore?: () => void
  onRefresh?: () => void
  refreshing?: boolean
  loadingMore?: boolean
}

/** 页面入参(路由 query 的跨端形态;缺参由共享屏渲染空态,不猜)。 */
export type ScreenParams = Readonly<Record<string, string | undefined>>

export type PayStatus = 'success' | 'cancelled' | 'failed'

/** 支付结果。支付 SDK / 下单 / 回调全部留在宿主,共享屏只消费本结果。 */
export interface PayResult {
  status: PayStatus
  orderId?: string
  message?: string
}
