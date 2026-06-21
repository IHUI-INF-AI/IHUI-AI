/**
 * stores/user.ts - 兼容旧版引用
 * 实际实现在 ./auth/user.ts，这里仅做 re-export 保持向后兼容。
 *
 * 旧代码: import { useUserStore } from '@/stores/user'
 * 新代码: import { useUserStore } from '@/stores/auth/user'  (推荐)
 */
export { useUserStore } from './auth/user'
