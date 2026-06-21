/**
 * 状态格式化 Composable
 *
 * 提供通用的状态文本和类型转换功能，用于统一处理各种状态值的显示。
 *
 * @example
 * ```typescript
 * const { getStatusText, getStatusType, isExpired } = useStatusFormatter()
 *
 * const statusMap = { '0': '待处理', '1': '已完成' }
 * const statusText = getStatusText('0', statusMap) // '待处理'
 *
 * const typeMap = { '0': 'warning', '1': 'success' }
 * const statusType = getStatusType('0', typeMap) // 'warning'
 *
 * const expired = isExpired('2020-01-01') // true
 * ```
 *
 * @packageDocumentation
 */

/**
 * 状态文本映射接口
 */
export interface StatusMap {
  [key: string]: string
}

/**
 * 状态类型映射接口
 */
export interface StatusTypeMap {
  [key: string]: 'success' | 'warning' | 'danger' | 'info'
}

/**
 * 状态格式化 Composable
 *
 * @returns 返回状态格式化相关方法
 */
export function useStatusFormatter() {
  /**
   * 获取状态文本
   *
   * @param status - 状态值（字符串、数字或 undefined）
   * @param statusMap - 状态文本映射对象
   * @returns 返回对应的状态文本，如果不存在则返回 '未知'
   */
  const getStatusText = (status: string | number | undefined, statusMap: StatusMap): string => {
    const key = status === undefined || status === null ? '' : String(status)
    return statusMap[key] || '未知'
  }

  /**
   * 获取状态标签类型
   *
   * @param status - 状态值（字符串、数字或 undefined）
   * @param typeMap - 状态类型映射对象
   * @returns 返回对应的标签类型，如果不存在则返回 'info'
   */
  const getStatusType = (
    status: string | number | undefined,
    typeMap: StatusTypeMap
  ): 'success' | 'warning' | 'danger' | 'info' => {
    const key = status === undefined || status === null ? '' : String(status)
    return (typeMap[key] as 'success' | 'warning' | 'danger' | 'info') || 'info'
  }

  /**
   * 判断日期是否过期
   *
   * @param expirationDate - 过期日期字符串
   * @returns 如果日期已过期返回 true，否则返回 false
   */
  const isExpired = (expirationDate?: string): boolean => {
    if (!expirationDate) return false
    const expDate = new Date(expirationDate)
    return expDate < new Date()
  }

  /**
   * 格式化时间戳为本地化字符串
   *
   * @param timestamp - 时间戳（毫秒）
   * @returns 返回格式化的时间字符串，如果时间戳无效则返回 '-'
   */
  const formatTimestamp = (timestamp: number): string => {
    if (!timestamp) return '-'
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN')
  }

  return {
    getStatusText,
    getStatusType,
    isExpired,
    formatTimestamp,
  }
}
