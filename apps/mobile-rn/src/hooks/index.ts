// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * mobile-rn hooks 统一入口。
 *
 * 平台独占 hook 一律不进本 barrel;2026-11-04 收口:原 use-biometrics / use-push 取证为
 * 全仓零消费者(自创建起从未被任何文件 import,且 app.config.js 的 plugins 里也没有对应
 * 原生插件)⇒ 已整文件删除,不再有"保留本地实现"的例外面。
 * use-clipboard / use-paginated-list / use-websocket 已 re-export shared。
 *
 * 本文件统一 re-export shared 工具 hook,各 Screen 可按需 import:
 *   import { useDebounce, useCountdown, usePagination, useLoadMore } from '../hooks'
 *
 * 注意:use-auth 不 re-export(mobile-rn 用本地 AuthContext + SSO deep link)。
 * 业务 hook(use-agents / use-articles / use-chat / use-social-list)供 Screen 主动改用。
 */
export { useDebounce, useDebouncedCallback } from '@ihui/shared/hooks/use-debounce'

export { useCountdown } from '@ihui/shared/hooks/use-countdown'

export { useMounted } from '@ihui/shared/hooks/use-mounted'

export { usePagination } from '@ihui/shared/hooks/use-pagination'

export { useLoadMore } from '@ihui/shared/hooks/use-load-more'

// 已 re-export(保留向后兼容)
export { usePaginatedList } from '@ihui/shared/hooks'
export type { Fetcher, PaginatedListResult } from '@ihui/shared/hooks'

export { useNotificationWebSocket } from '@ihui/shared/notifications'
export type { UseTaskReceiverReturn } from './useTaskReceiver'

// 微信 APP 支付共享 Hook(平台独占:依赖 RN react-native-wechat-lib,抽自 VipScreen pay 函数)
export { useWechatPayment } from './useWechatPayment'
export type {
  UseWechatPaymentOptions,
  UseWechatPaymentReturn,
  UseWechatPaymentMessages,
} from './useWechatPayment'

// 回屏/回前台即重取(2026-10-28 立,2026-10-30 收口):语义唯一实现已下沉共享层
// `@ihui/rn-app` 的 useScreenReappear,本处只保留 RN 薄壳与既有导出名。
// adapter 不进本 barrel:它 import AppState,拉进 barrel 会让只取其它 hook 的套件也被迫加载。
export { useRefreshOnFocus } from './use-refresh-on-focus'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
