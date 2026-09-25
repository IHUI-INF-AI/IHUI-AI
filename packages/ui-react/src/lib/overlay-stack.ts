// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 浮层层栈(overlay stack) —— Esc 无层栈协议的单一来源实现。
 *
 * 背景:全项目 20+ 处浮层各自在 `document`/`window` 上挂 keydown 消费 Escape,
 * 且都不做互斥。同一事件里每个监听器都会被调用(同 target 上的多个监听器不受
 * stopPropagation 影响),导致"按一次 Esc 把所有层一起关掉"。
 *
 * 本模块提供最小注册式层栈:浮层 open 时 pushOverlay(id),close/unmount 时
 * popOverlay(id),其 Esc 处理器首行 `if (!isTopOverlay(id)) return` —— 只有栈顶
 * 那一层消费 Esc,其余层保持打开,由用户逐层退出。
 *
 * 落点决策(2026-09-26 立):实现放 ui-react 而非 apps/web —— ui-react 的
 * Dialog/Sheet/Drawer/Select 家族要在一处内建注册(接全部端),而 ui-react
 * 不允许反向依赖 apps/web。apps/web/src/lib/overlay-stack.ts 仅 re-export 本模块,
 * web 侧既有 import 路径不变。
 *
 * 设计约束:
 * - 模块级数组,单浏览器页面内共享(浮层本身就在同一 document 上)。
 * - push 幂等:重复 push 同一 id 只做"移到栈顶",不产生重复项。
 * - pop 无条件安全:未注册 id、重复 pop 均为 noop。
 * - isTopOverlay 对"未注册 id"一律返回 true(fail-open):未接入栈的层
 *   行为完全不变,绝不会因为接入本模块而让 Esc 失灵。
 */

const stack: string[] = []

/** 注册一个浮层为当前栈顶(幂等:已存在则移到栈顶)。 */
export function pushOverlay(id: string): void {
  const existing = stack.indexOf(id)
  if (existing !== -1) stack.splice(existing, 1)
  stack.push(id)
}

/** 注销一个浮层(不存在则 noop;可安全重复调用)。 */
export function popOverlay(id: string): void {
  let existing = stack.indexOf(id)
  while (existing !== -1) {
    stack.splice(existing, 1)
    existing = stack.indexOf(id)
  }
}

/** 该浮层是否应消费 Esc:栈顶、栈为空、或该 id 未接入栈时为 true。 */
export function isTopOverlay(id: string): boolean {
  if (stack.length === 0) return true
  if (stack[stack.length - 1] === id) return true
  return !stack.includes(id)
}

/** 只读快照(调试 / 测试用)。 */
export function getOverlayStack(): readonly string[] {
  return stack
}

/** 仅供单元测试重置全局状态。 */
export function __resetOverlayStack(): void {
  stack.length = 0
}
