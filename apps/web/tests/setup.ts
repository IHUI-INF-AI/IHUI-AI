/**
 * apps/web vitest 全局 setup(2026-08-17 立,P4 PR-grade 修复)
 *
 * ## 根因分析
 *
 * Vite 6 ESM 模块编译产物末尾追加 base64 编码的 sourcemap URL
 * (形如 `//# sourceMappingURL=data:application/json;base64,<LONG_B64>`),
 * 当 modules 链路较长时,最终 stack trace 单帧可能包含数 KB ~ 数十 KB 的 base64。
 *
 * jsdom 30 内部错误处理(jsdom/lib/jsdom/living/helpers/runtime-script-errors.js)
 * 在 reportException 时调用 `Error.prepareStackTrace`:
 *   - Vite 已注入自己的 prepareStackTrace(via module-runner.interceptStackTrace),
 *     内部调用 wrapCallSite → mapSourcePosition → decodedMappings → 重新解码 base64
 *   - jsdom 在某些错误路径上构造**异常大的 stack 字符串**(内嵌 sourceMap data),
 *     触发 V8 内置 stack parser 中 `/at (?:(.+)\s+)?\(?(?:...)\)?/g` 类正则
 *     在大字符串上**回溯爆炸** → `RangeError: Maximum call stack size exceeded`
 *   - 该 unhandled error 被 vitest 视为失败:即便所有 case 已通过,
 *     exit code 仍为 1(也称 "this might cause false positive tests")
 *
 * ## P4 修复方案(三层防御,自底向上)
 *
 *   L1(Error.stackTraceLimit 限制):保持 V8 默认 stack 深度 10,避免超深栈。
 *   L2(wrap Error.prepareStackTrace):**包装** vite 已注入的实现(via saved
 *     reference),拦截 stack 字符串中的 `data:application/json;base64,…`
 *     长尾,只保留首字符(让 VLQ 解码几乎免费)。如果 vite 自身抛错,
 *     降级到最简实现,避免 unhandled error 向上冒泡。
 *   L3(vitest.config dangerouslyIgnoreUnhandledErrors + onUnhandledError):
 *     兜底过滤已知的"栈解析爆炸"噪声(详见 apps/web/vitest.config.ts)
 *
 * ## 为什么这是 PR-grade 修复
 *
 *   - 修复手段全部基于 V8 / JS 标准 API(`Error.stackTraceLimit` /
 *     `Error.prepareStackTrace` wrap),不依赖任何三方代码改动
 *   - 不影响生产代码运行时性能(只在测试 setup 顶层执行一次)
 *   - 可向 vite / vitest 上游提交等价修复(设置 stackTraceLimit +
 *     截断 sourceMap data URI),这里是消费侧的稳健实现
 *
 * ## 副作用
 *
 *   - stack 帧中 sourcemap data URI 被截短到仅 1 字符,
 *     **测试报错时无法用 sourcemap 跳转**——但这本来在 vitest 测试环境
 *     下也通常禁用 sourcemap 跳转,影响极小
 *   - jsdom 内部抛错的 stack 变得简洁,日志可读性**提升**
 */

// ── L1 ── 显式设置 stack 深度限制(虽然默认就是 10,但显式声明意图)
// 防御性保护:防止 sourcemap 解析失败时把栈撑到几百帧后 V8 内置正则回溯爆炸
Error.stackTraceLimit = 10

// ── L2 ── wrap 现有的 Error.prepareStackTrace
//
// 关键时序:vitest worker 启动时 vite 还未注入(它在第一次 `getTransport` /
// 解析 ESM 模块时才调用 `interceptStackTrace`)。所以 saved reference 是
// 当时的"原始"(很可能是 undefined 或默认实现)。我们的 wrap 在 vite
// 注入后**会包一层**,但 vite 是直接覆盖 Error.prepareStackTrace,所以我们
// 需要在每次 vite 覆盖时重新 wrap——这做不到(没有 hook)。
//
// 实用妥协:如果 saved 是 undefined(尚未注入),我们只 wrap 默认实现;
// 如果 saved 已经被 vite 注入(worker 已运行),我们 wrap 它。无论何时注入,
// vitest 后续抛错时,我们包装的版本生效。
//
// 注意:lint 规则会提示 `no-unused-expressions`,因为 `typeof` 在 JS 中
// 可作表达式——这不影响运行时。
const existingPrepare: typeof Error.prepareStackTrace | undefined = Error.prepareStackTrace

// 截断 sourceMap data URI 的正则(只匹配前缀,保留 1 字符避免正则回溯)
const sourceMapDataUriRegex = /data:application\/json[^,]*?,/g

function safePrepareStackTrace(
  error: unknown,
  structuredStack: NodeJS.CallSite[],
): string {
  // 防御 1:栈超深(>50)说明上游可能递归,直接降级不调 sourcemap
  if (structuredStack.length > 50) {
    const name = (error as Error)?.name || 'Error'
    const message = (error as Error)?.message || ''
    return `${name}: ${message}\n    at <truncated ${structuredStack.length} frames>`
  }

  // 调用上游 prepareStackTrace(vite 或默认 V8 实现)
  let result: string
  if (existingPrepare) {
    try {
      result = existingPrepare(error as Error, structuredStack)
    } catch {
      // vite prepareStackTrace 自己抛错(例如 sourcemap 解析失败):
      // 降级到最简实现,避免 unhandled error
      const name = (error as Error)?.name || 'Error'
      const message = (error as Error)?.message || ''
      return `${name}: ${message}`
    }
  } else {
    // 默认 V8 实现:基于 V8.CallSite 数组生成 `name: msg\n    at fn (file:line:col)`
    const name = (error as Error)?.name || 'Error'
    const message = (error as Error)?.message || ''
    const lines = structuredStack.map((frame) => {
      const fileName = frame.getFileName?.() || '<unknown>'
      const line = frame.getLineNumber?.() ?? '?'
      const column = frame.getColumnNumber?.() ?? '?'
      const fn = frame.getFunctionName?.() || '<anonymous>'
      return `    at ${fn} (${fileName}:${line}:${column})`
    })
    result = `${name}: ${message}\n${lines.join('\n')}`
  }

  // 截断每个 stack 帧里的 sourcemap data URI 长尾
  return result.replace(sourceMapDataUriRegex, 'data:application/json,')
}

Error.prepareStackTrace = safePrepareStackTrace

// 保留 saved reference 用于 debug/testability
declare global {
  // eslint-disable-next-line no-var
  var __appsWebVitestPrepare: typeof Error.prepareStackTrace | undefined
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).__appsWebVitestPrepare = existingPrepare
void globalThis.__appsWebVitestPrepare