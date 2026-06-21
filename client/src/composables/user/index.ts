/**
 * 用户相关 Composables 统一导出
 * 
 * @module composables/user
 */

// 认证
export { useUserAuth } from './useUserAuth'
export type { UseUserAuthOptions } from './useUserAuth'

// 分页
export { usePagination } from './usePagination'
export type { PaginationState, UsePaginationOptions } from './usePagination'

// 头像上传
export { useAvatarUpload, AVATAR_CONFIG } from './useAvatarUpload'
export type { UseAvatarUploadOptions, AvatarUploadResult } from './useAvatarUpload'

// 列表数据
export { useListData } from './useListData'

// 状态格式化
export { useStatusFormatter } from './useStatusFormatter'

// 用户菜单
export { useUserMenu } from './useUserMenu'

// 用户消息
export { useUserMessages } from './useUserMessages'

// 用户订单
export { useUserOrders } from './useUserOrders'

// 用户资料
export { useUserProfile } from './useUserProfile'

// 用户购买记录
export { useUserPurchases } from './useUserPurchases'
export { useUserPurchaseRecords } from './useUserPurchaseRecords'

// 用户安全
export { useUserSecurity } from './useUserSecurity'

// 用户设置
export { useUserSettings } from './useUserSettings'

// 用户统计
export { useUserStatistics } from './useUserStatistics'

// 用户上传
export { useUserUpload } from './useUserUpload'

// 用户收藏
export { useUserFavorites } from './useUserFavorites'

// 用户开发者
export { useUserDeveloper } from './useUserDeveloper'

// 用户审核
export { useUserExamine } from './useUserExamine'
