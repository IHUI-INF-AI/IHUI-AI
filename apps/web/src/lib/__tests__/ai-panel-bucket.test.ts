// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, afterEach } from 'vitest'
import {
  AI_FLOAT_DEFAULT_HEIGHT,
  AI_FLOAT_DEFAULT_WIDTH,
  AI_FLOAT_MARGIN,
  AI_FLOAT_MIN_HEIGHT,
  AI_FLOAT_MIN_WIDTH,
  clampFabPosition,
  clampFloatPosition,
  getFloatSize,
  getPanelBucket,
  planFormMigration,
  resizeFloatRect,
  resolveFloatRect,
  snapFabPosition,
  snapFloatPosition,
  type AiPanelFormSnapshot,
  type AiFloatRect,
} from '../ai-panel-bucket'
import { useAiPanelStore } from '@/stores/ai-panel'

describe('getPanelBucket(形态档唯一真相源)', () => {
  it('断点边界:639 及以下 = sheet,640–1279 = float,1280 起 = docked', () => {
    expect(getPanelBucket(320)).toBe('sheet')
    expect(getPanelBucket(639)).toBe('sheet')
    expect(getPanelBucket(640)).toBe('float')
    expect(getPanelBucket(718)).toBe('float')
    expect(getPanelBucket(1279)).toBe('float')
    expect(getPanelBucket(1280)).toBe('docked')
    expect(getPanelBucket(1920)).toBe('docked')
  })

  it('非法宽度回落到 docked(与 SSR 首帧一致,不制造第三种形态)', () => {
    expect(getPanelBucket(Number.NaN)).toBe('docked')
    expect(getPanelBucket(0)).toBe('docked')
    expect(getPanelBucket(-1)).toBe('docked')
  })
})

describe('getFloatSize', () => {
  it('常规视口:360 × 600', () => {
    expect(getFloatSize(1280, 800)).toEqual({
      width: AI_FLOAT_DEFAULT_WIDTH,
      height: AI_FLOAT_DEFAULT_HEIGHT,
    })
  })

  it('矮视口:高度按视口收小,四周留 8px', () => {
    expect(getFloatSize(1280, 500)).toEqual({ width: 360, height: 500 - AI_FLOAT_MARGIN * 2 })
  })

  it('窄视口:宽度按视口收小,不越界', () => {
    expect(getFloatSize(300, 800).width).toBe(300 - AI_FLOAT_MARGIN * 2)
  })

  it('优先用户缩放后的尺寸', () => {
    expect(getFloatSize(1440, 900, { width: 720, height: 820 })).toEqual({
      width: 720,
      height: 820,
    })
  })

  it('缩放尺寸低于最小档时抬到最小档(但仍不得越界)', () => {
    expect(getFloatSize(1280, 800, { width: 100, height: 100 })).toEqual({
      width: AI_FLOAT_MIN_WIDTH,
      height: AI_FLOAT_MIN_HEIGHT,
    })
    // 视口本身就小于最小档:以视口为准,而不是硬撑出屏幕
    expect(getFloatSize(300, 200, { width: 100, height: 100 })).toEqual({
      width: 300 - AI_FLOAT_MARGIN * 2,
      height: 200 - AI_FLOAT_MARGIN * 2,
    })
  })

  it('非法持久化值回落到默认尺寸(手改 localStorage 不炸布局)', () => {
    expect(
      getFloatSize(1280, 800, { width: Number.NaN, height: Number.POSITIVE_INFINITY }),
    ).toEqual({ width: AI_FLOAT_DEFAULT_WIDTH, height: AI_FLOAT_DEFAULT_HEIGHT })
  })
})

describe('clampFloatPosition', () => {
  it('左上越界收回到 8px 边距', () => {
    expect(clampFloatPosition(-500, -500, 1280, 800)).toEqual({ x: 8, y: 8 })
  })

  it('右下用**浮窗宽度**(360)收口,而不是停靠宽度', () => {
    // 1280 - 360 - 8 = 912;若误用停靠宽度 480 会得到 792(历史缺陷)
    const { x } = clampFloatPosition(5000, 0, 1280, 800)
    expect(x).toBe(912)
  })

  it('右下的纵向用**面板高度**(600)收口,而不是只留 120px', () => {
    // 800 - 600 - 8 = 192;历史上限 innerHeight-120=680(允许大半屏出界)
    const { y } = clampFloatPosition(0, 5000, 1280, 800)
    expect(y).toBe(192)
  })

  it('视口比面板还小时:x/y 不小于 8,面板可被容纳范围内尽量靠左上', () => {
    const pos = clampFloatPosition(300, 300, 360, 300)
    expect(pos.x).toBe(AI_FLOAT_MARGIN)
    expect(pos.y).toBe(AI_FLOAT_MARGIN)
  })

  it('按用户缩放后的尺寸收口右下边界', () => {
    expect(clampFloatPosition(5000, 5000, 1280, 800, { width: 720, height: 700 })).toEqual({
      x: 1280 - 720 - AI_FLOAT_MARGIN,
      y: 800 - 700 - AI_FLOAT_MARGIN,
    })
  })
})

describe('resolveFloatRect', () => {
  const anchor = { left: 256, bottom: 784 } // 工作区左下角(视口高 800 - 16)

  it('未初始化(-1)时从锚点向上展开:底边贴锚点', () => {
    const rect = resolveFloatRect({ x: -1, y: -1 }, anchor, 1280, 800)
    expect(rect).toEqual({ x: 256, y: 184, width: 360, height: 600 })
    expect(rect.y + rect.height).toBe(784)
  })

  it('已初始化时保留用户坐标,但仍经过收口', () => {
    expect(resolveFloatRect({ x: 500, y: 120 }, anchor, 1280, 800)).toEqual({
      x: 500,
      y: 120,
      width: 360,
      height: 600,
    })
    expect(resolveFloatRect({ x: 9999, y: 9999 }, anchor, 1280, 800)).toEqual({
      x: 912,
      y: 192,
      width: 360,
      height: 600,
    })
  })

  it('视口变窄后同一坐标仍落在可视区内(resize 重新收口的依据)', () => {
    const before = resolveFloatRect({ x: 900, y: 300 }, anchor, 1440, 900)
    const after = resolveFloatRect(before, anchor, 1000, 700)
    expect(after.x + after.width).toBeLessThanOrEqual(1000 - AI_FLOAT_MARGIN)
    expect(after.y + after.height).toBeLessThanOrEqual(700 - AI_FLOAT_MARGIN)
  })

  it('带用户缩放尺寸时按该尺寸定位(未初始化仍从锚点向上展开)', () => {
    expect(
      resolveFloatRect({ x: -1, y: -1 }, anchor, 1280, 800, { width: 720, height: 700 }),
    ).toEqual({ x: 256, y: 84, width: 720, height: 700 })
  })
})

describe('resizeFloatRect(八向拉伸)', () => {
  const base: AiFloatRect = { x: 200, y: 100, width: 360, height: 600 }
  const vw = 1280
  const vh = 800

  it('东/南边:只改宽高,左上角不动', () => {
    expect(resizeFloatRect(base, 'e', 80, 0, vw, vh)).toEqual({
      x: 200,
      y: 100,
      width: 440,
      height: 600,
    })
    expect(resizeFloatRect(base, 's', 0, 50, vw, vh)).toEqual({
      x: 200,
      y: 100,
      width: 360,
      height: 650,
    })
  })

  it('西/北边:拖的是移动边,对侧边(右/下)固定', () => {
    const west = resizeFloatRect(base, 'w', -60, 0, vw, vh)
    expect(west).toEqual({ x: 140, y: 100, width: 420, height: 600 })
    expect(west.x + west.width).toBe(base.x + base.width)

    const north = resizeFloatRect(base, 'n', 0, -80, vw, vh)
    expect(north).toEqual({ x: 200, y: 20, width: 360, height: 680 })
    expect(north.y + north.height).toBe(base.y + base.height)
  })

  it('四角:两个方向同时生效', () => {
    expect(resizeFloatRect(base, 'se', 40, 40, vw, vh)).toEqual({
      x: 200,
      y: 100,
      width: 400,
      height: 640,
    })
    expect(resizeFloatRect(base, 'nw', -40, -40, vw, vh)).toEqual({
      x: 160,
      y: 60,
      width: 400,
      height: 640,
    })
  })

  it('缩小到最小档就停住,不会把面板拖没', () => {
    const tiny = resizeFloatRect(base, 'se', -9999, -9999, vw, vh)
    expect(tiny).toEqual({
      x: 200,
      y: 100,
      width: AI_FLOAT_MIN_WIDTH,
      height: AI_FLOAT_MIN_HEIGHT,
    })
  })

  it('放大不越界:东/南边到 8px 边距为止', () => {
    const big = resizeFloatRect(base, 'se', 9999, 9999, vw, vh)
    expect(big.x).toBe(200)
    expect(big.y).toBe(100)
    expect(big.x + big.width).toBe(vw - AI_FLOAT_MARGIN)
    expect(big.y + big.height).toBe(vh - AI_FLOAT_MARGIN)
  })

  it('西/北边拖出视口时停在 8px 边距,对侧边仍固定', () => {
    const west = resizeFloatRect(base, 'w', -9999, 0, vw, vh)
    expect(west.x).toBe(AI_FLOAT_MARGIN)
    expect(west.x + west.width).toBe(base.x + base.width)

    const north = resizeFloatRect(base, 'n', 0, -9999, vw, vh)
    expect(north.y).toBe(AI_FLOAT_MARGIN)
    expect(north.y + north.height).toBe(base.y + base.height)
  })
})

/**
 * openPanel 是全部外部入口(历史点击 / 会话列表 / 用户行待决策 / 新建任务)的唯一出口。
 * 回归目标:停靠位在 640–1279 不存在时,openPanel 绝不能只把 open 置 true ——
 * 那正是「点了没反应」的历史 P0(open=true 但整块 display:none)。
 */
describe('openPanel 桶感知(全入口可见性回归)', () => {
  const setViewportWidth = (value: number) => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value })
  }

  afterEach(() => {
    setViewportWidth(1440)
    useAiPanelStore.setState({
      open: false,
      floatMode: false,
      floatMinimized: false,
      floatCollapsed: false,
    })
  })

  it('640–1279:强制浮窗并复位折叠 / 最小化', () => {
    setViewportWidth(718)
    useAiPanelStore.setState({
      open: false,
      floatMode: false,
      floatMinimized: true,
      floatCollapsed: true,
    })
    useAiPanelStore.getState().openPanel()
    expect(useAiPanelStore.getState()).toMatchObject({
      open: true,
      floatMode: true,
      floatMinimized: false,
      floatCollapsed: false,
    })
  })

  it('<640:同样强制浮窗(手机全屏抽屉)', () => {
    setViewportWidth(390)
    useAiPanelStore.setState({ open: false, floatMode: false })
    useAiPanelStore.getState().openPanel()
    expect(useAiPanelStore.getState()).toMatchObject({ open: true, floatMode: true })
  })

  it('≥1280:保留用户的停靠偏好,不硬塞浮窗', () => {
    setViewportWidth(1440)
    useAiPanelStore.setState({ open: false, floatMode: false, floatMinimized: true })
    useAiPanelStore.getState().openPanel()
    expect(useAiPanelStore.getState()).toMatchObject({
      open: true,
      floatMode: false,
      floatMinimized: false,
    })
  })
})

describe('snapFloatPosition(松手吸边)', () => {
  it('左侧阈值内吸到左边距', () => {
    expect(snapFloatPosition(20, 100, 1280, 800).x).toBe(AI_FLOAT_MARGIN)
  })

  it('右侧阈值内吸到右边距', () => {
    // 1280 视口、浮窗 360 ⇒ 右边界 = 1280 - 360 - 8 = 912
    expect(snapFloatPosition(895, 100, 1280, 800)).toEqual({ x: 912, y: 100 })
  })

  it('中间位置不动(不误吸)', () => {
    expect(snapFloatPosition(500, 100, 1280, 800)).toEqual({ x: 500, y: 100 })
  })

  it('先钳制再吸附:越界坐标不会把面板吸出视口', () => {
    expect(snapFloatPosition(9999, 9999, 1280, 800)).toEqual({ x: 912, y: 192 })
  })

  it('窄视口左右边距几乎重合时不吸附(避免来回抖)', () => {
    expect(snapFloatPosition(10, 10, 380, 800)).toEqual(clampFloatPosition(10, 10, 380, 800))
  })
})

describe('clampFabPosition / snapFabPosition(FAB 独立拖拽)', () => {
  it('FAB 边界只按自身尺寸收口(不被浮窗 360 宽度锁在左侧带内)', () => {
    // 1280 - 48 - 8 = 1224;若误用浮窗宽度会得到 912(拖到右半屏就「拖不动」)
    expect(clampFabPosition(9999, 9999, 1280, 800)).toEqual({ x: 1224, y: 744 })
  })

  it('左上越界收回到 8px 边距', () => {
    expect(clampFabPosition(-100, -100, 1280, 800)).toEqual({ x: 8, y: 8 })
  })

  it('松手吸边:左/右阈值内贴边,中间不动', () => {
    expect(snapFabPosition(20, 300, 1280, 800)).toEqual({ x: 8, y: 300 })
    expect(snapFabPosition(1210, 300, 1280, 800)).toEqual({ x: 1224, y: 300 })
    expect(snapFabPosition(600, 300, 1280, 800)).toEqual({ x: 600, y: 300 })
  })

  it('窄视口左右边距重合时不吸附', () => {
    expect(snapFabPosition(10, 10, 50, 800)).toEqual(clampFabPosition(10, 10, 50, 800))
  })
})

describe('planFormMigration(跨档迁移计划)', () => {
  const base: AiPanelFormSnapshot = {
    floatMode: false,
    floatMinimized: false,
    floatCollapsed: false,
    workAreaCollapsed: false,
    workAreaFullscreen: false,
  }

  it('进入 float 档且 store 仍是停靠偏好:强制浮窗 + 记账为被动浮窗', () => {
    const plan = planFormMigration('float', base, false)
    expect(plan).toMatchObject({ floatMode: true, floatCollapsed: false, autoFloated: true })
    expect(plan.floatMinimized).toBeNull()
    expect(plan.resetWorkAreaCollapsed).toBe(false)
  })

  it('float 档:工作区折叠 / 工作面全屏都必须复位(浮窗不占 flex 位)', () => {
    const plan = planFormMigration(
      'float',
      { ...base, floatMode: true, workAreaCollapsed: true, workAreaFullscreen: true },
      true,
    )
    expect(plan.floatMode).toBeNull()
    expect(plan.resetWorkAreaCollapsed).toBe(true)
    expect(plan.resetWorkAreaFullscreen).toBe(true)
  })

  it('sheet 档:折叠输入条复位(否则 inset-0 透明遮罩锁死整页)', () => {
    const plan = planFormMigration('sheet', { ...base, floatMode: true, floatCollapsed: true }, true)
    expect(plan.floatCollapsed).toBe(false)
    expect(plan.floatMode).toBeNull()
  })

  it('回到 docked:收回被动浮窗,并清掉浮窗期遗留的最小化', () => {
    const plan = planFormMigration(
      'docked',
      { ...base, floatMode: true, floatMinimized: true },
      true,
    )
    expect(plan).toMatchObject({
      floatMode: false,
      floatMinimized: false,
      floatCollapsed: false,
      autoFloated: false,
    })
  })

  it('回到 docked:用户手动点的浮窗不被收走', () => {
    const plan = planFormMigration(
      'docked',
      { ...base, floatMode: true, floatMinimized: false },
      false,
    )
    expect(plan.floatMode).toBeNull()
    expect(plan.autoFloated).toBe(false)
  })

  it('docked 档手动切浮窗:工作区折叠同样要复位(判据是形态,不是档位)', () => {
    const plan = planFormMigration(
      'docked',
      { ...base, floatMode: true, workAreaCollapsed: true, workAreaFullscreen: true },
      false,
    )
    expect(plan.resetWorkAreaCollapsed).toBe(true)
    expect(plan.resetWorkAreaFullscreen).toBe(true)
  })

  it('docked 停靠形态:工作区折叠是合法状态,不得复位', () => {
    const plan = planFormMigration(
      'docked',
      { ...base, workAreaCollapsed: true, workAreaFullscreen: true },
      false,
    )
    expect(plan.resetWorkAreaCollapsed).toBe(false)
    expect(plan.resetWorkAreaFullscreen).toBe(false)
    expect(plan.floatMode).toBeNull()
    expect(plan.floatMinimized).toBeNull()
  })

  it('浮窗档里 store 偏好是停靠:仍按本档强制浮窗,并记成被动浮窗(回 docked 自动收回)', () => {
    const plan = planFormMigration('float', { ...base, floatMode: false }, true)
    expect(plan.floatMode).toBe(true)
    expect(plan.autoFloated).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
