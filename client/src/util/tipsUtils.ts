/**
 * 轻量提示工具，统一对外导出 confirm / success / error / info / warning
 * 底层复用 utils/message.ts 的实现，保持调用接口一致
 */
import { message, confirm as _confirm } from '@/utils/message'

export function success(text: string): void {
  message.success(text)
}

export function error(text: string): void {
  message.error(text)
}

export function info(text: string): void {
  message.info(text)
}

export function warning(text: string): void {
  message.warning(text)
}

export function confirm(messageText: string, title?: string, callback?: () => void): Promise<void> {
  const p = _confirm(messageText, title)
  if (callback) {
    p.then(callback).catch(() => {})
    return p
  }
  return p
}

export default { confirm, success, error, info, warning }
