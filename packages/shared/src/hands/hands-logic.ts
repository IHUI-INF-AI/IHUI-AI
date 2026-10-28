// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Hands 纯逻辑:界面树 / 动作 → 决策。
 *
 * 本文件**零 Android SDK 依赖**,只吃 `hands-contract.ts` 的纯值类型,因此可被 vitest 在
 * 任意环境单测(见 `./__tests__/hands-logic.test.ts`)。端侧 Kotlin 侧有对应实现,但那部分
 * 依赖 AccessibilityNodeInfo,无法在此单测。
 *
 * 提供的原语:
 *   - `findNode` / `findNodeByText` / `findNodeByViewId`:在界面树里定位;
 *   - `resolveTapTarget`:把 selector 解析成「可点节点」或退化坐标(决策:点哪);
 *   - `validateHandsCommand`:命令合法性(决策前的护栏);
 *   - `planCommandFromIntent`:高层意图(如「点登录」)→ 具体 HandsCommand(决策:界面树 → 动作)。
 */

import type {
  HandsCommand,
  HandsTarget,
  ScrollDirection,
  UiNodeSchema,
  UiTreeSchema,
} from './hands-contract.js'

/** 深度优先遍历,返回首个满足 predicate 的节点(含 root);找不到返回 null。 */
function findNode(
  root: UiNodeSchema,
  predicate: (node: UiNodeSchema) => boolean,
): UiNodeSchema | null {
  if (predicate(root)) return root
  for (const child of root.children ?? []) {
    const found = findNode(child, predicate)
    if (found) return found
  }
  return null
}

/** 按可见文本定位;exact=false 子串匹配,exact=true 全等。 */
export function findNodeByText(
  tree: UiTreeSchema,
  text: string,
  exact = false,
): UiNodeSchema | null {
  return findNode(tree.root, (n) => {
    const t = n.text ?? ''
    return exact ? t === text : t.includes(text)
  })
}

/**
 * 按视图 id 定位。接受全量资源 id(`com.pkg:id/btn`)或短名(`btn`,匹配末尾)。
 */
export function findNodeByViewId(tree: UiTreeSchema, viewId: string): UiNodeSchema | null {
  return findNode(tree.root, (n) => n.viewId === viewId || (n.viewId ?? '').endsWith('/' + viewId))
}

/** 建 parent 映射,供「找最近可点祖先」使用(界面树无 parent 指针)。 */
function buildParentMap(root: UiNodeSchema): Map<UiNodeSchema, UiNodeSchema | null> {
  const map = new Map<UiNodeSchema, UiNodeSchema | null>()
  const walk = (node: UiNodeSchema, parent: UiNodeSchema | null): void => {
    map.set(node, parent)
    for (const child of node.children ?? []) walk(child, node)
  }
  walk(root, null)
  return map
}

/** 从给定节点向上(含自身)找最近的 clickable 节点;找不到返回 null。 */
export function nearestClickable(tree: UiTreeSchema, node: UiNodeSchema): UiNodeSchema | null {
  const parents = buildParentMap(tree.root)
  let cur: UiNodeSchema | null = node
  while (cur) {
    if (cur.clickable) return cur
    cur = parents.get(cur) ?? null
  }
  return null
}

/** 在整树中按 selector 定位节点(不处理 coords,coords 由调用方直接转坐标)。 */
function locate(tree: UiTreeSchema, target: HandsTarget): UiNodeSchema | null {
  if (target.kind === 'viewId') return findNodeByViewId(tree, target.viewId)
  if (target.kind === 'text') return findNodeByText(tree, target.text, target.exact ?? false)
  return null
}

/**
 * 把 selector 解析成「点击目标」:优先返回可点节点(含最近可点祖先);
 * 节点不可点或无父可点时,退化为节点中心坐标(交给端侧 dispatchGesture)。
 * coords 选择器直接返回坐标。解析失败返回 null。
 */
export function resolveTapTarget(
  tree: UiTreeSchema,
  target: HandsTarget,
): { node?: UiNodeSchema; coords?: { x: number; y: number } } | null {
  if (target.kind === 'coords') {
    return { coords: { x: target.x, y: target.y } }
  }
  const located = locate(tree, target)
  if (!located) return null
  const clickable = nearestClickable(tree, located)
  if (clickable) return { node: clickable }
  const b = located.bounds
  return { coords: { x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 } }
}

/** 命令合法性护栏:返回 ok 或带原因的失败。 */
export function validateHandsCommand(
  cmd: HandsCommand,
): { ok: true } | { ok: false; error: string } {
  if (!cmd.id) return { ok: false, error: 'missing id' }
  if (!cmd.type) return { ok: false, error: 'missing type' }
  if (cmd.type === 'type') {
    if (cmd.target?.kind === 'coords') {
      return { ok: false, error: 'type requires a node target, not coords' }
    }
    if (cmd.text === null || cmd.text === undefined)
      return { ok: false, error: 'type requires text' }
  }
  if (cmd.type === 'scroll' && !cmd.direction) {
    return { ok: false, error: 'scroll requires direction' }
  }
  if (cmd.type === 'click' && !cmd.target) {
    return { ok: false, error: 'click requires target' }
  }
  return { ok: true }
}

/** 高层意图(决策输入)。 */
export interface HandsIntent {
  action: 'tap' | 'input' | 'scroll' | 'back'
  /** tap/input 时用于在界面树定位的文本或 viewId。 */
  label?: string
  /** input 时填入的文本。 */
  value?: string
  /** scroll 方向,缺省 down。 */
  direction?: ScrollDirection
}

/**
 * 把定位到的节点挑成一个选择器:优先可点/可编辑祖先的 viewId,其次自身 viewId,再次文本。
 * 对「点登录」这类意图,文本叶节点自身无 viewId,但包它的按钮有 —— 故向上取可点祖先。
 */
function selectorFor(tree: UiTreeSchema, located: UiNodeSchema): HandsTarget | null {
  const preferred = nearestClickable(tree, located) ?? located
  if (preferred.viewId) return { kind: 'viewId', viewId: preferred.viewId }
  if (preferred.text !== null && preferred.text !== undefined)
    return { kind: 'text', text: preferred.text }
  return null
}

/**
 * 决策:高层意图 → 具体 HandsCommand。
 * 由界面树定位目标节点,挑出最稳的选择器(见 `selectorFor`);找不到返回 null。
 * id 用时间戳+随机保证唯一(对账用,不依赖任何端侧状态)。
 */
export function planCommandFromIntent(
  tree: UiTreeSchema,
  intent: HandsIntent,
): HandsCommand | null {
  const id = `hands-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  switch (intent.action) {
    case 'back':
      return { id, type: 'back' }
    case 'scroll':
      return { id, type: 'scroll', direction: intent.direction ?? 'down' }
    case 'tap': {
      if (!intent.label) return null
      const located = findNodeByText(tree, intent.label) ?? findNodeByViewId(tree, intent.label)
      if (!located) return null
      const target = selectorFor(tree, located)
      return target ? { id, type: 'click', target } : null
    }
    case 'input': {
      if (!intent.label || intent.value === null || intent.value === undefined) return null
      const located = findNodeByText(tree, intent.label) ?? findNodeByViewId(tree, intent.label)
      if (!located) return null
      const target = selectorFor(tree, located)
      return target ? { id, type: 'type', target, text: intent.value } : null
    }
    default:
      return null
  }
}
