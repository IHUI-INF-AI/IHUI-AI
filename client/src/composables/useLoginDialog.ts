/**
 * useLoginDialog - 全局登录弹窗状态 Composable（模块级单例）
 *
 * 整合 LoginDialog/App.vue/路由守卫/Sidebar 共享的登录弹窗状态：
 *   - visible：弹窗显隐
 *   - mode：'login' | 'register'
 *   - redirectPath：登录成功后的重定向路径（可选）
 *   - open / close / toggle：状态变更方法
 *
 * 设计要点：
 *   - 模块级 ref：所有组件共享同一响应式源，避免多实例状态不一致
 *   - 状态通过方法变更，外部不应直接改 ref
 *   - SSR 安全：无 window/localStorage 访问
 */
import { ref, type Ref } from 'vue'

export type LoginDialogMode = 'login' | 'register'

// ── 模块级单例状态（所有组件共享） ──
const visible = ref(false)
const mode = ref<LoginDialogMode>('login')
const redirectPath = ref<string | null>(null)

export interface UseLoginDialogReturn {
  /** 弹窗显隐 */
  visible: Ref<boolean>
  /** 弹窗模式（登录/注册） */
  mode: Ref<LoginDialogMode>
  /** 登录成功后的重定向路径（可选） */
  redirectPath: Ref<string | null>
  /** 打开弹窗 */
  open: (m?: LoginDialogMode, redirect?: string | null) => void
  /** 关闭弹窗 */
  close: () => void
  /** 切换弹窗显隐（同模式则关闭，不同模式则切换） */
  toggle: (m?: LoginDialogMode) => void
  /** 切换到登录模式 */
  switchToLogin: () => void
  /** 切换到注册模式 */
  switchToRegister: () => void
}

/**
 * 使用登录弹窗状态（单例）
 *
 * 多次调用返回同一组响应式状态，适合 LoginDialog/App.vue/路由守卫共享。
 */
export function useLoginDialog(): UseLoginDialogReturn {
  const open = (m: LoginDialogMode = 'login', redirect: string | null = null): void => {
    mode.value = m
    redirectPath.value = redirect
    visible.value = true
  }

  const close = (): void => {
    visible.value = false
    // 关闭后清理重定向路径，避免下次打开沿用旧值
    redirectPath.value = null
  }

  const toggle = (m: LoginDialogMode = 'login'): void => {
    if (visible.value && mode.value === m) {
      close()
    } else {
      open(m)
    }
  }

  const switchToLogin = (): void => {
    mode.value = 'login'
    visible.value = true
  }

  const switchToRegister = (): void => {
    mode.value = 'register'
    visible.value = true
  }

  return {
    visible,
    mode,
    redirectPath,
    open,
    close,
    toggle,
    switchToLogin,
    switchToRegister,
  }
}

export default useLoginDialog
