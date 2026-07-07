/**
 * 登录输入历史记忆 Composable
 * 2026-07-06 立, 用户规则: 登录框账号/手机号/邮箱输入框需要历史记忆下拉窗, 一键点击填入输入框.
 *
 * 职责:
 * - 读取: 从 localStorage 读取历史输入列表 (账号/手机号/邮箱分别独立存储)
 * - 保存: 登录成功后调用 saveLoginHistoryItem, 去重 + 置顶 + 上限 (默认 5 条)
 * - 过滤: 根据当前输入查询匹配的历史项 (大小写不敏感)
 * - 状态: 下拉显示/隐藏、当前查询词 (响应式, 供模板绑定)
 *
 * 设计说明:
 * - 底层工具函数 getLoginHistory / saveLoginHistoryItem / removeLoginHistoryItem / clearLoginHistory
 *   独立导出, 供 useLoginLogic.ts 在登录成功后直接写入 (无需持有 composable 实例)
 * - composable useLoginInputHistory 供表单组件管理读取 + 下拉交互状态
 * - 存储键: login_history_accounts (账号, 复用既有键) / login_history_phones (手机号) / login_history_emails (邮箱)
 * - 仅存标识 (账号/手机/邮箱), 不存密码, 与浏览器原生 autocomplete 行为一致
 */

import { ref, computed } from 'vue'
import { StorageManager } from '@/utils/storage'
import { logger } from '@/utils/logger'

/** 登录输入历史存储键 */
export const LOGIN_HISTORY_KEYS = {
  /** 账号 (用户名/手机/邮箱均可, 账号登录表单) */
  account: 'login_history_accounts',
  /** 手机号 (手机验证码登录表单, 纯号码不含区号) */
  phone: 'login_history_phones',
  /** 邮箱 (邮箱验证码登录表单) */
  email: 'login_history_emails',
} as const

/** 历史记录上限 (登录账号不会太多, 5 条足够且下拉不至于过长) */
export const LOGIN_HISTORY_MAX = 5

/**
 * 从 localStorage 读取历史输入列表
 * @param storageKey 存储键
 * @returns 历史列表 (数组, 无效时返回空数组)
 */
export function getLoginHistory(storageKey: string): string[] {
  try {
    const history = StorageManager.getItem<string[]>(storageKey)
    return Array.isArray(history) ? history : []
  } catch (error) {
    logger.warn('[useLoginInputHistory] Failed to read login history', { storageKey, error })
    return []
  }
}

/**
 * 保存一条历史输入 (去重 + 置顶 + 上限)
 * @param storageKey 存储键
 * @param value 待保存的值 (会 trim, 空值不保存)
 * @param maxItems 最大条数, 默认 5
 * @returns 保存后的最新列表
 */
export function saveLoginHistoryItem(
  storageKey: string,
  value: string,
  maxItems: number = LOGIN_HISTORY_MAX
): string[] {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return getLoginHistory(storageKey)

  let list = getLoginHistory(storageKey)
  // 去重: 移除已存在的相同项
  list = list.filter((item) => item !== trimmed)
  // 置顶: 最新使用的放最前
  list.unshift(trimmed)
  // 上限
  list = list.slice(0, maxItems)

  try {
    StorageManager.setItem(storageKey, list)
  } catch (error) {
    // 保存失败不影响登录主流程, 仅记录日志 (i18n 键 saveHistoryAccountFailed/saveHistoryPhoneFailed 预留)
    logger.warn('[useLoginInputHistory] Failed to save login history item', { storageKey, error })
  }
  return list
}

/**
 * 删除单条历史输入
 * @param storageKey 存储键
 * @param value 待删除的值
 * @returns 删除后的最新列表
 */
export function removeLoginHistoryItem(storageKey: string, value: string): string[] {
  const list = getLoginHistory(storageKey).filter((item) => item !== value)
  try {
    StorageManager.setItem(storageKey, list)
  } catch (error) {
    logger.warn('[useLoginInputHistory] Failed to remove login history item', { storageKey, error })
  }
  return list
}

/**
 * 清空指定键的全部历史输入
 * @param storageKey 存储键
 */
export function clearLoginHistory(storageKey: string): void {
  try {
    StorageManager.setItem(storageKey, [])
  } catch (error) {
    logger.warn('[useLoginInputHistory] Failed to clear login history', { storageKey, error })
  }
}

export interface UseLoginInputHistoryOptions {
  /** 存储键 (建议传 LOGIN_HISTORY_KEYS.account / phone / email) */
  storageKey: string
  /** 最大条数, 默认 5 */
  maxItems?: number
}

/**
 * 登录输入历史 Composable
 * 供表单组件管理: 历史列表 (响应式) + 下拉显示状态 + 查询词 + 过滤结果 + reload/save/remove/clear
 */
export function useLoginInputHistory(options: UseLoginInputHistoryOptions) {
  const { storageKey, maxItems = LOGIN_HISTORY_MAX } = options

  /** 历史列表 (响应式) */
  const history = ref<string[]>(getLoginHistory(storageKey))
  /** 下拉是否显示 */
  const showDropdown = ref(false)
  /** 当前查询词 (用于输入时实时过滤) */
  const query = ref('')

  /** 根据查询词过滤后的历史列表 (大小写不敏感) */
  const filtered = computed(() => {
    if (!query.value) return history.value
    const q = query.value.toLowerCase()
    return history.value.filter((item) => item.toLowerCase().includes(q))
  })

  /** 是否有历史记录 */
  const hasHistory = computed(() => history.value.length > 0)

  /** 重新从 localStorage 读取 (focus / dblclick 时调用以拿到最新数据) */
  function reload(): void {
    history.value = getLoginHistory(storageKey)
  }

  /** 保存一条历史 (表单内主动保存场景, 登录成功保存由 useLoginLogic 调用 saveLoginHistoryItem) */
  function save(value: string): void {
    history.value = saveLoginHistoryItem(storageKey, value, maxItems)
  }

  /** 删除单条 */
  function remove(value: string): void {
    history.value = removeLoginHistoryItem(storageKey, value)
  }

  /** 清空 */
  function clear(): void {
    clearLoginHistory(storageKey)
    history.value = []
  }

  return {
    history,
    showDropdown,
    query,
    filtered,
    hasHistory,
    reload,
    save,
    remove,
    clear,
  }
}
