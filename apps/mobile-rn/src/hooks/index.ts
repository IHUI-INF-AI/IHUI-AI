/**
 * mobile-rn hooks 统一入口。
 *
 * 平台独占 hook(use-biometrics / use-push / use-screenshot)保留本地实现。
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

// 微信 APP 支付共享 Hook(平台独占:依赖 RN react-native-wechat-lib,抽自 VipScreen pay 函数)
export { useWechatPayment } from './useWechatPayment'
export type {
  UseWechatPaymentOptions,
  UseWechatPaymentReturn,
  UseWechatPaymentMessages,
} from './useWechatPayment'
