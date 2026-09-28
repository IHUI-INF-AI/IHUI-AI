// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { redactCrashText } from '@ihui/shared/utils/redact'
import { useNavigationStore } from '@/stores/navigation'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, info: React.ErrorInfo) => void
  /**
   * 「这次错误到底属于哪个对象」的一组标识(会话 id / workspace id / 标签页 id / 消息 id 等)。
   * 任意一项变化 ⇒ 边界自我复位,重新渲染 children。
   *
   * 为什么不能只靠 fallback 里那个手动「重试」按钮(2026-09-26,机制吸收 A10B-2):
   *  ① 按钮长在**旧对象的 fallback 里**。用户切到别的会话/工作区再回来,看到的仍是上一
   *    个对象的错误卡 —— 点「重试」只是把**已经不该在这里**的那棵子树再渲一遍,
   *    而新对象的数据其实已经是好的,用户唯一能做的自救动作反而是错的。
   *  ② 面板级边界嵌在页面深处时,fallback 顶出的大卡片会把「重试」挤出视口
   *     (本文件 StaticErrorFallback 的 min-h-screen 居中形态就是这种),等于没有出口。
   *  ③ 归属变化是**宿主已知的事实**,不该要求用户替系统判断"这个错误还作不作数"。
   *
   * 缺省(undefined)时行为与加此 prop 之前逐字一致 —— 不传就等于没有,
   * 不得改成"每次 render 都比较",那会让所有既有调用方变成"任意重渲染即清错",
   * 把真实错误藏起来。
   */
  resetKeys?: readonly unknown[]
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export function ErrorFallback({ error, onReset }: { error?: Error; onReset: () => void }) {
  const t = useTranslations('common')
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <h3 className="text-base font-medium">{t('errorTitle')}</h3>
      <p className="max-w-md text-sm text-muted-foreground">
        {error?.message ?? t('unknownError')}
      </p>
      <button
        onClick={onReset}
        className="mt-2 inline-flex items-center gap-2 rounded-sm bg-cta px-4 py-2 text-sm font-medium text-cta-foreground hover:bg-cta/90"
      >
        <RefreshCw className="h-4 w-4" />
        {t('retry')}
      </button>
    </div>
  )
}

/**
 * 2026-08-02 修复: Bug 9 — 不依赖任何 context 的纯静态 fallback。
 * 当 next-intl Provider 自身崩溃时,原 ErrorFallback 调用 useTranslations 会二次抛错,
 * 导致整个错误边界无效。StaticErrorFallback 不依赖任何 Provider,作为默认 fallback。
 */
function StaticErrorFallback({ onReset }: { onReset?: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-3">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <h1 className="text-2xl font-bold">页面出错了</h1>
      <p className="text-muted-foreground">应用发生了错误,请刷新页面重试</p>
      <button
        type="button"
        onClick={onReset}
        className="rounded-sm bg-cta px-4 py-2 text-cta-foreground"
      >
        重试
      </button>
    </div>
  )
}

/**
 * 逐项比较两组 resetKeys 是否变化(2026-09-26,A10B-2)。
 * 三条刻意的口径:
 *  - **先比引用再逐项 Object.is**:同内容的新数组必须判"没变"(调用方每次 render 新建数组
 *    是常态,按引用比就等于每次重渲染都清错,见 props.resetKeys 注释);
 *  - 用 `Object.is` 而不是 `===`:后者对 `NaN !== NaN` 失真(坐标/比例类 id 参与时会产生
 *    假变化 ⇒ 错误态被反复抹掉);
 *  - 两侧都缺省时长度都是 0 ⇒ 返回 false ⇒ 不传 resetKeys 的既有调用方行为零改变。
 */
function haveResetKeysChanged(
  prev: readonly unknown[] | undefined,
  next: readonly unknown[] | undefined,
): boolean {
  if (prev === next) return false
  const a = prev ?? []
  const b = next ?? []
  if (a.length !== b.length) return true
  for (let i = 0; i < a.length; i += 1) {
    if (!Object.is(a[i], b[i])) return true
  }
  return false
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.onError?.(error, info)
    // 2026-08-11: 崩溃时重置 navigation pending 状态,防止骨架屏覆盖层永久遮挡内容区。
    // 与 error.tsx 的 useEffect 逻辑一致,覆盖 ErrorBoundary 包裹的场景。
    useNavigationStore.getState().end()
    // 2026-08-06: 崩溃自动上报(crash_reports 链路,POST /api/crash-reports)。
    // 静默失败:上报失败 / 环境异常绝不影响 UI 渲染。
    // 2026-09-09 0-5-f 豁免确认:崩溃场景下运行时可能已处于异常态,
    // 用最小依赖的裸 fetch 上报,不引入 fetchApi 的解析/重试逻辑。
    //
    // 2026-09-27 补脱敏(病灶,实测):errorMessage/stack 里内嵌的 API key、Bearer/JWT、
    // 用户机器绝对路径(如 `C:\Users\<name>\...` / `/c/Users/<name>/AppData/...`)此前**原样**
    // 出浏览器并明文落 `crash_reports`(保留 90 天、进 admin 面板)。裸 fetch 这个选择可以保留
    // (崩溃场景不引 fetchApi 是对的),但"少把用户原文送出去浏览器"与它不冲突:
    // 发射前一律过共享层唯一出口 `redactCrashText`。服务端 `recordCrash` 还会再兜一道 ——
    // **该端点匿名可写,客户端脱敏从来不能作为唯一防线**(权威防线在服务端)。
    if (typeof window !== 'undefined') {
      try {
        void fetch('/api/crash-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: 'web',
            // 兜底放在**脱敏之后**:`new Error()` 的 message 是空串(不是 nullish),`??` 兜不住它,
            // 而服务端 zod 是 `errorMessage.min(1)` ⇒ 空消息会被 400 静默拒收、这条崩溃永远进不了
            // 统计。`||` 同时 cover 这两种情况(原文为空 / 极端下被遮成空),不改变非空消息的取值。
            errorMessage: redactCrashText(error?.message ?? 'unknown error') || 'unknown error',
            // 保持与改前同形:无 stack 时该键整体缺席(undefined 被 JSON.stringify 丢掉)
            stack: typeof error?.stack === 'string' ? redactCrashText(error.stack) : undefined,
            route: redactCrashText(window.location.pathname),
          }),
        }).catch(() => {})
      } catch {
        /* 上报失败静默 */
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  /**
   * 上下文标识变了就自我复位(2026-09-26,A10B-2)。
   * 判据先要 `this.state.hasError`:无错时复位是空动作,却会触发一次多余的 setState/重渲染。
   */
  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (!this.state.hasError) return
    if (haveResetKeysChanged(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({ hasError: false, error: undefined })
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      // 2026-08-02 修复: Bug 9 — 默认 fallback 用 StaticErrorFallback(不依赖任何 Provider)
      return <StaticErrorFallback onReset={this.handleReset} />
    }
    return this.props.children
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
