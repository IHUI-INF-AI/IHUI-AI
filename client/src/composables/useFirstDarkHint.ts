/**
 * 首次进入暗色模式轻提示 composable
 *
 * 设计目标：
 * 1. 仅在用户**第一次**进入暗色模式时显示提示，避免每次切暗色都打扰
 * 2. 用户可主动关闭（"知道了"按钮），关闭后 localStorage 永久记录，再次进入暗色不再显示
 * 3. 6s 自动超时作为备用兜底（用户无操作时自动消失）
 * 4. 仅 dev 期 / 用户明确操作触发；不抢占首次渲染（onMounted 之后再检查）
 *
 * 用法：
 * const { showHint, dismiss, snooze } = useFirstDarkHint()
 * // 模板：v-if="showHint"
 * // 关闭：@click="dismiss"
 * // 关闭但保留会话内再次显示（用于"稍后提醒"按钮，暂未启用）
 */
import { computed, ref } from 'vue'

const STORAGE_KEY_DISMISSED = 'darkMode.firstDarkHintDismissed' // 永久关闭
const AUTO_DISMISS_MS = 6000

export interface UseFirstDarkHintReturn {
  /** 是否显示提示气泡 */
  showHint: import('vue').ComputedRef<boolean>
  /** 永久关闭（写入 localStorage，下次不再显示） */
  dismiss: () => void
  /** 关闭当前气泡但不写存储（用于"稍后提醒"，暂未启用） */
  snooze: () => void
  /** 检查并显示（仅在 dark + 未关闭 时触发） */
  maybeShow: () => void
}

export function useFirstDarkHint(): UseFirstDarkHintReturn {
  const visible = ref(false)
  let autoTimer: ReturnType<typeof setTimeout> | null = null

  const isDismissed = (): boolean => {
    if (typeof window === 'undefined') return true
    try {
      return window.localStorage.getItem(STORAGE_KEY_DISMISSED) === '1'
    } catch {
      return true
    }
  }

  const clearAutoTimer = () => {
    if (autoTimer) {
      clearTimeout(autoTimer)
      autoTimer = null
    }
  }

  const dismiss = () => {
    visible.value = false
    clearAutoTimer()
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY_DISMISSED, '1')
    } catch {
      /* 隐私模式 / quota 满，忽略 */
    }
  }

  const snooze = () => {
    visible.value = false
    clearAutoTimer()
  }

  const maybeShow = () => {
    if (isDismissed()) return
    if (typeof window === 'undefined') return
    visible.value = true
    clearAutoTimer()
    autoTimer = setTimeout(() => {
      visible.value = false
      autoTimer = null
    }, AUTO_DISMISS_MS)
  }

  return {
    showHint: computed(() => visible.value),
    dismiss,
    snooze,
    maybeShow,
  }
}
