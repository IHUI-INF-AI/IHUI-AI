// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * React 错误边界上报干道(2026-09-30 立,吸收批次 74 票 G-977982)。
 *
 * 机制吸收自上游 React 错误边界观测出口(上游
 * packages/ui/src/lib/reactErrorArmsTelemetry.ts:1-99),事件名/字段名按本仓口径
 * 中性自命名,未复制上游协议;本库为纯机制件,不与既有 ErrorBoundary 组件接线。
 *
 * 机制要点:
 * - React 错误边界拦截子树渲染异常、阻止其冒泡到 window.onerror / unhandledrejection,
 *   依赖 window.onerror 系自动采集的 RUM 对这类异常完全不可见,必须显式转发到
 *   与全局崩溃同一条观测干道,补上这块盲区;
 * - reporter 必须在 createRoot 之前注入(模块级注入),不能走 Root 的 effect:
 *   根级边界的职责正是兜 Root 自身首帧崩溃,effect 注入时 Root 首帧已崩、
 *   effect 永不执行,根级错误依旧丢失。isBoundaryReporterReady() 暴露注入就绪
 *   语义,供启动序自检注入时机;
 * - 上报副本先脱敏再出:渲染层 stack / componentStack 在桌面端携带
 *   `file:///Users/<用户名>/...` 家目录路径,error.message 也可能带用户路径。
 *   上报副本统一过 redactTelemetryText 脱敏 + 4000 截断(保头部:最近的抛错
 *   组件一定上得去);本地日志与 fallback 恢复继续使用原值(副本/原值分离);
 * - 上报失败(同步抛错或 Promise reject)不得中断错误边界的 fallback 恢复:
 *   try/catch + .catch,只 warn 不抛;
 * - boundary_scope 维度:根级边界缺省记 app,scoped 边界按 chat/settings 等
 *   透传,便于按子树切分错误率。
 */

/** 观测干道事件名/分组(本仓中性命名,不复制上游事件口径)。 */
export const ERROR_BOUNDARY_EVENT_NAME = 'render_error'
export const ERROR_BOUNDARY_EVENT_GROUP = 'error_boundary'

/**
 * 上报副本单字段截断上限。
 * 判据:错误栈与 React 组件栈可能很长,观测端单字段过长会被截断/拒收;
 * 主动截断到上限,保证关键头部(最近的抛错组件)一定上得去。
 */
export const BOUNDARY_STACK_MAX_LENGTH = 4000

/** 根级边界缺省 scope。 */
export const DEFAULT_BOUNDARY_SCOPE = 'app'

export interface BoundaryErrorPayload {
  name: string
  group: string
  value: number
  properties: {
    error_name: string
    error_message: string
    error_stack?: string
    component_stack?: string
    boundary_scope: string
  }
}

export type BoundaryErrorReporter = (payload: BoundaryErrorPayload) => void | Promise<unknown>

export interface BoundaryErrorReportInput {
  /** boundary_scope:根级缺省 app;scoped 边界按 chat/settings 等子树透传。 */
  scope?: string
  /** React 错误边界回调拿到的组件栈字符串。 */
  componentStack?: string
  /** 观测链路失败观察钩子(缺省 console.warn);只观察,不参与恢复流程。 */
  onWarn?: (message: string, detail?: unknown) => void
}

// 模块级单例:注入时机纪律要求 reporter 在 createRoot 之前就位(见文件头),
// 因此不走 React 上下文/effect,只能模块级持有。
let boundaryReporter: BoundaryErrorReporter | null = null

/**
 * 注入观测上报器;传入 null 即卸载(测试复位/降级形态用)。
 * 纪律:必须在 renderer 入口 createRoot 之前调用(入口模块顶层),
 * 不能依赖 Root 的 effect —— 根级边界兜的就是 Root 自身首帧崩溃。
 */
export function installErrorBoundaryReporter(reporter: BoundaryErrorReporter | null): void {
  boundaryReporter = reporter
}

/** 注入就绪语义:启动序可用它断言"reporter 先于 createRoot 注入"这一时机约定。 */
export function isBoundaryReporterReady(): boolean {
  return boundaryReporter !== null
}

const defaultWarn = (message: string, detail?: unknown): void => {
  console.warn(message, detail)
}

/**
 * 上报副本脱敏 + 截断:家目录段(/Users|home 下的用户名,含 Windows 反斜杠形态
 * 与 file:///C:/Users 形态)一律替换占位符;随后按上限截断保头部。
 * 只处理上报副本 —— 本地日志与 fallback 恢复继续用原值。
 */
export function redactTelemetryText(
  value: string,
  maxLength: number = BOUNDARY_STACK_MAX_LENGTH,
): string {
  const redacted = value
    .replace(/(Users[\\/])[^\\/\s"'`()<>,;:]+/gi, '$1<user>')
    .replace(/(home[\\/])[^\\/\s"'`()<>,;:]+/gi, '$1<user>')
  return redacted.length > maxLength ? redacted.slice(0, maxLength) : redacted
}

/** 任意抛出物 → { name, message, stack? }:边界可能拦到非 Error 抛出物,防御性提取。 */
function describeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
    }
  }
  if (typeof error === 'string') {
    return { name: 'Error', message: error }
  }
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>
    const name = typeof record.name === 'string' ? record.name : 'Error'
    const message = typeof record.message === 'string' ? record.message : String(error)
    const stack = typeof record.stack === 'string' ? record.stack : undefined
    return { name, message, ...(stack ? { stack } : {}) }
  }
  return { name: 'Error', message: String(error) }
}

/**
 * 把 React 错误边界捕获的异常转发到观测干道。
 *
 * - reporter 未注入:安全 no-op(观测干道缺失不构成错误);
 * - 上报副本(name/message/stack/componentStack)先脱敏再出;原 error 对象
 *   一个字段都不改,调用方继续用原值做本地日志与 fallback 恢复;
 * - reporter 同步抛错 / 异步 reject 都只 warn,绝不冒泡中断调用方恢复流程。
 */
export function reportBoundaryError(error: unknown, input: BoundaryErrorReportInput = {}): void {
  const reporter = boundaryReporter
  if (!reporter) return

  const onWarn = input.onWarn ?? defaultWarn
  const scope = input.scope?.trim() ? input.scope.trim() : DEFAULT_BOUNDARY_SCOPE

  try {
    const described = describeError(error)
    const componentStack = input.componentStack
    const payload: BoundaryErrorPayload = {
      name: ERROR_BOUNDARY_EVENT_NAME,
      group: ERROR_BOUNDARY_EVENT_GROUP,
      value: 1,
      properties: {
        error_name: described.name,
        error_message: redactTelemetryText(described.message),
        ...(described.stack ? { error_stack: redactTelemetryText(described.stack) } : {}),
        ...(componentStack ? { component_stack: redactTelemetryText(componentStack) } : {}),
        boundary_scope: scope,
      },
    }
    Promise.resolve(reporter(payload)).catch((reportError) => {
      // 观测链路属于旁路:异步失败只 warn,错误边界的 fallback 恢复不得因埋点而中断。
      onWarn('[error-boundary] 上报失败', { scope, error: reportError })
    })
  } catch (reportError) {
    // 同步异常同样只 warn,不冒泡进错误边界主流程。
    onWarn('[error-boundary] 上报异常', { scope, error: reportError })
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
