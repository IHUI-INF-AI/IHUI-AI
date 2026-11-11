// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
/**
 * AI 面板形态档(bucket)与浮窗几何 —— 唯一真相源(2026-11-11 立)。
 *
 * 背景(为什么必须有这个文件):面板此前有**三套**可见性真相源 ——
 *   ① zustand 布尔(open / floatMode / floatMinimized / floatCollapsed)
 *   ② 组件内 JS matchMedia(<640 / 640–1279)
 *   ③ globals.css 的 media query(640–1279 对停靠容器强制 display:none)
 * 三者只要有一处不同步,就出现「open=true 但整块不可见」的死态:
 * 640–1279px 下所有 openPanel 入口(历史点击 / 会话列表 / 用户行待决策)全是死点击,
 * 浮窗里点「停靠 / 关闭」面板彻底消失且没有 FAB 回来。
 *
 * 现行模型:由视口宽度推导**唯一**能力档,其余状态都是它的派生:
 *   sheet  (<640)   全屏抽屉(手机):不可停靠、不可拖拽、不占 flex 空间
 *   float  (640–1279) 浮动窗:停靠位在本档会压死内容区 ⇒ 本档**不存在停靠形态**
 *   docked (≥1280)  停靠位:唯一支持停靠 / 折叠工作区 / 工作面全屏 / 分屏的档
 * 硬不变量:非 closed ⇒ 必有可见表面(sheet/float 档关面板一律回 FAB,不得凭空消失)。
 *
 * 本文件只放**纯函数 + 视口订阅**,不引用 store(zustand 侧反向 import 本文件),
 * 因此可被单测直接覆盖,也不会形成循环依赖。
 */
import * as React from 'react'

/** 形态断点(px)。改这里即改全部调用方;CSS 侧只保留一条同区间兜底规则(见 globals.css)。 */
export const AI_PANEL_BREAKPOINTS = {
  /** ≤ 639:手机 —— 全屏抽屉 */
  sheetMax: 639,
  /** 640–1279:平板 / 小窗口 —— 浮动窗(停靠位会压死内容区) */
  floatMax: 1279,
} as const

export type AiPanelBucket = 'sheet' | 'float' | 'docked'

/** 视口宽度 → 能力档。非法宽度按停靠档处理(SSR / 异常兜底,与历史首帧一致)。 */
export function getPanelBucket(viewportWidth: number): AiPanelBucket {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return 'docked'
  if (viewportWidth <= AI_PANEL_BREAKPOINTS.sheetMax) return 'sheet'
  if (viewportWidth <= AI_PANEL_BREAKPOINTS.floatMax) return 'float'
  return 'docked'
}

/** 浮窗几何常量:宽度固定(与停靠宽度解耦),高度上限 600,四周最少留 8px */
export const AI_FLOAT_WIDTH = 360
export const AI_FLOAT_MAX_HEIGHT = 600
export const AI_FLOAT_MARGIN = 8
/** 松手吸边阈值:拖到距左右边距这么近时自动贴边(避免「差 3px 没贴住」的别扭观感) */
export const AI_FLOAT_SNAP_DISTANCE = 24
/** 桌面 FAB(最小化图标)直径,与组件里的 h-12 w-12 对齐;手机 56px 固定左下不参与拖拽 */
export const AI_FAB_SIZE = 48

export interface AiFloatSize {
  width: number
  height: number
}

export interface AiFloatRect extends AiFloatSize {
  x: number
  y: number
}

/** 浮窗尺寸:任何视口都不越界(窄屏收窄,矮屏收矮)。 */
export function getFloatSize(viewportWidth: number, viewportHeight: number): AiFloatSize {
  return {
    width: Math.min(AI_FLOAT_WIDTH, Math.max(0, viewportWidth - AI_FLOAT_MARGIN * 2)),
    height: Math.min(AI_FLOAT_MAX_HEIGHT, Math.max(0, viewportHeight - AI_FLOAT_MARGIN * 2)),
  }
}

/**
 * 把浮窗左上角收进视口。
 * 历史缺陷:水平钳制误用了**停靠**宽度(480),垂直只留 120px ⇒ 拖到下沿时大半个面板出界。
 * 这里统一按浮窗自身尺寸 + 8px 边距收口,resize 时同样走本函数。
 */
export function clampFloatPosition(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  const { width, height } = getFloatSize(viewportWidth, viewportHeight)
  const maxX = Math.max(AI_FLOAT_MARGIN, viewportWidth - width - AI_FLOAT_MARGIN)
  const maxY = Math.max(AI_FLOAT_MARGIN, viewportHeight - height - AI_FLOAT_MARGIN)
  return {
    x: Math.min(Math.max(AI_FLOAT_MARGIN, x), maxX),
    y: Math.min(Math.max(AI_FLOAT_MARGIN, y), maxY),
  }
}

/**
 * 拖拽收尾的「吸边」:松手时若已进到左右边距的阈值内,直接贴边。
 * - 先钳制再吸附,保证返回值一定合法(不会把面板吸出视口);
 * - 只在阈值内动手 —— 用户刻意停在中间的布局不受影响;
 * - 窄视口下 left/right 会重合(面板几乎占满),此时吸附等价于钳制,不会抖动。
 */
export function snapFloatPosition(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
  threshold: number = AI_FLOAT_SNAP_DISTANCE,
): { x: number; y: number } {
  const clamped = clampFloatPosition(x, y, viewportWidth, viewportHeight)
  const { width } = getFloatSize(viewportWidth, viewportHeight)
  const left = AI_FLOAT_MARGIN
  const right = Math.max(left, viewportWidth - width - AI_FLOAT_MARGIN)
  if (right - left <= threshold * 2) return clamped
  if (clamped.x <= left + threshold) return { x: left, y: clamped.y }
  if (clamped.x >= right - threshold) return { x: right, y: clamped.y }
  return clamped
}

/**
 * 解析当前浮窗矩形。
 * - position.x / y 为负 = 未初始化(store 的 FLOAT_DEFAULT_POSITION),回落到锚点:
 *   锚点是工作区左下角,height 向上展开 ⇒ 视觉上「从底部向上弹出」。
 * - 无论哪种来源,出口都经过 clampFloatPosition,因此不存在越界坐标。
 */
export function resolveFloatRect(
  position: { x: number; y: number },
  anchor: { left: number; bottom: number },
  viewportWidth: number,
  viewportHeight: number,
): AiFloatRect {
  const { width, height } = getFloatSize(viewportWidth, viewportHeight)
  const rawX = position.x < 0 ? anchor.left : position.x
  const rawY = position.y < 0 ? anchor.bottom - height : position.y
  const { x, y } = clampFloatPosition(rawX, rawY, viewportWidth, viewportHeight)
  return { x, y, width, height }
}

/**
 * 把 FAB(最小化图标)收进视口。
 * 不能复用 clampFloatPosition:那是 360×600 浮窗的边界,会把 48px 小圆钮锁在
 * 左侧 360px 带内 —— 用户拖到右半屏会「拖不动」。这里只按 FAB 自身尺寸收口。
 */
export function clampFabPosition(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
  size: number = AI_FAB_SIZE,
): { x: number; y: number } {
  const maxX = Math.max(AI_FLOAT_MARGIN, viewportWidth - size - AI_FLOAT_MARGIN)
  const maxY = Math.max(AI_FLOAT_MARGIN, viewportHeight - size - AI_FLOAT_MARGIN)
  return {
    x: Math.min(Math.max(AI_FLOAT_MARGIN, x), maxX),
    y: Math.min(Math.max(AI_FLOAT_MARGIN, y), maxY),
  }
}

/** FAB 松手吸边:与浮窗同一阈值与观感,左右边界按 FAB 自身尺寸算(不会吸出视口)。 */
export function snapFabPosition(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
  size: number = AI_FAB_SIZE,
  threshold: number = AI_FLOAT_SNAP_DISTANCE,
): { x: number; y: number } {
  const clamped = clampFabPosition(x, y, viewportWidth, viewportHeight, size)
  const left = AI_FLOAT_MARGIN
  const right = Math.max(left, viewportWidth - size - AI_FLOAT_MARGIN)
  if (right - left <= threshold * 2) return clamped
  if (clamped.x <= left + threshold) return { x: left, y: clamped.y }
  if (clamped.x >= right - threshold) return { x: right, y: clamped.y }
  return clamped
}

/** SSR / 首帧兜底视口:钉在停靠档(与历史服务端渲染结果逐字一致,避免 hydration mismatch)。 */
const SERVER_VIEWPORT: AiFloatSize = {
  width: AI_PANEL_BREAKPOINTS.floatMax + 1,
  height: 800,
}

const listeners = new Set<() => void>()

function notifyViewportChange() {
  for (const listener of listeners) listener()
}

function subscribeViewport(onChange: () => void): () => void {
  listeners.add(onChange)
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('resize', notifyViewportChange)
    window.addEventListener('orientationchange', notifyViewportChange)
  }
  return () => {
    listeners.delete(onChange)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('resize', notifyViewportChange)
      window.removeEventListener('orientationchange', notifyViewportChange)
    }
  }
}

/** 快照用字符串(useSyncExternalStore 要求快照可比较,对象每次新引用会无限重渲染)。 */
function readViewportKey(): string {
  if (typeof window === 'undefined') return `${SERVER_VIEWPORT.width}x${SERVER_VIEWPORT.height}`
  return `${window.innerWidth}x${window.innerHeight}`
}

function readServerViewportKey(): string {
  return `${SERVER_VIEWPORT.width}x${SERVER_VIEWPORT.height}`
}

/**
 * 同步读取视口宽度(非 React 环境:store 的 action 里调用)。
 * 服务端返回停靠档宽度 —— 调用方拿到的 bucket 与服务端渲染一致。
 */
export function readViewportWidth(): number {
  return typeof window === 'undefined' ? SERVER_VIEWPORT.width : window.innerWidth
}

/** 视口尺寸订阅:resize / orientationchange 触发重渲染,bucket 与浮窗几何都从这里派生。 */
export function useViewportSize(): AiFloatSize {
  const key = React.useSyncExternalStore(
    subscribeViewport,
    readViewportKey,
    readServerViewportKey,
  )
  return React.useMemo(() => {
    const [widthPart, heightPart] = key.split('x')
    const width = Number(widthPart)
    const height = Number(heightPart)
    return {
      width: Number.isFinite(width) && width > 0 ? width : SERVER_VIEWPORT.width,
      height: Number.isFinite(height) && height > 0 ? height : SERVER_VIEWPORT.height,
    }
  }, [key])
}

/** 当前能力档(唯一派生点,组件内不要再自己写 matchMedia)。 */
export function usePanelBucket(): AiPanelBucket {
  return getPanelBucket(useViewportSize().width)
}

/* ────────────────────────────────────────────────────────────────────────────
 * 形态档迁移计划(2026-11-11 二次收口)
 *
 * 此前这段判定写在 ai-side-panel 的 effect 里,两个缺陷都出在「哪些字段该跟着档位走」:
 *  ① 回到 docked 档只复位 floatMode / floatCollapsed,漏了 floatMinimized ——
 *     在浮窗档收成 FAB 后把窗口拉宽,面板虽恢复成停靠列,但 store 里残留 minimized=true;
 *     用户下一次在桌面手动切「浮窗」,面板会直接掉成 FAB(点了像没反应)。
 *  ② 工作区折叠 / 工作面全屏只在「离开 docked 档」时复位。但在 docked 档手动切浮窗
 *     (bucket 不变、floatMode 变 true)时,工作区仍是隐藏的 ⇒ 浮窗悬在一片空白上,
 *     而且此时没有任何停靠列可以承载内容。判据应该是「当前是不是浮窗形态」,不是档位。
 *
 * 抽成纯函数后:组件只负责把计划写回 store,这段决策可被单测直接覆盖。
 * ──────────────────────────────────────────────────────────────────────────── */

/** 迁移计划读取的 store 瞬时字段(只读快照)。 */
export interface AiPanelFormSnapshot {
  floatMode: boolean
  floatMinimized: boolean
  floatCollapsed: boolean
  workAreaCollapsed: boolean
  workAreaFullscreen: boolean
}

/** 迁移计划:null = 该字段保持不动;autoFloated = 迁移后的「被动浮窗」记账值。 */
export interface AiPanelFormMigrationPlan {
  floatMode: boolean | null
  floatMinimized: boolean | null
  floatCollapsed: boolean | null
  resetWorkAreaCollapsed: boolean
  resetWorkAreaFullscreen: boolean
  autoFloated: boolean
}

/**
 * 由「目标档位 + 当前 store 快照 + 是否被动浮窗」推导需要写回的状态。
 * @param autoFloated 该浮窗是本档位逼出来的(而非用户手动点的)—— 只有这种才会在回到 docked 时被收回
 */
export function planFormMigration(
  bucket: AiPanelBucket,
  state: AiPanelFormSnapshot,
  autoFloated: boolean,
): AiPanelFormMigrationPlan {
  /** 非停靠档:停靠位不存在,store 偏好必须落成浮窗,否则 open=true 时渲染死态 */
  const forcedFloat = bucket !== 'docked' && !state.floatMode
  /** 回到停靠档:只收回被动浮窗;用户手动点的浮窗保留 */
  const restoreDocked = bucket === 'docked' && state.floatMode && autoFloated

  const floatMode = forcedFloat ? true : restoreDocked ? false : null
  const effectiveFloat = floatMode ?? (bucket === 'docked' ? state.floatMode : true)

  return {
    floatMode,
    // 回到停靠档:清掉浮窗期遗留的最小化(否则下次手动切浮窗会直接掉成 FAB)
    floatMinimized: bucket === 'docked' && state.floatMinimized ? false : null,
    // 浮窗形态的折叠条(只剩输入框)在手机档会变成透明全屏遮罩;跨档时一律复位
    floatCollapsed:
      floatMode !== null || (bucket === 'sheet' && state.floatCollapsed) ? false : null,
    // 两个开关只在「停靠形态」有意义:浮窗不占 flex 位,工作区仍 hidden 会整页变空
    resetWorkAreaCollapsed: effectiveFloat && state.workAreaCollapsed,
    resetWorkAreaFullscreen: effectiveFloat && state.workAreaFullscreen,
    autoFloated: forcedFloat ? true : bucket === 'docked' ? false : autoFloated,
  }
}
