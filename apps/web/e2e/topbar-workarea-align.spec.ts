import { setupTest as test, expect } from './fixtures'

/**
 * 顶部搜索按钮容器 与 MainShell 工作区卡片 左对齐守门测试 (2026-08-01 立)
 *
 * 触发背景:
 * 用户反馈"内容展示区左侧跟顶部搜索按钮容器对齐"是布局正确性硬约束。
 * 历史上曾因 AISidePanel fixed 定位 + work-area-portal-root padding-left 避让,
 * 导致 work-area 被 padding 压缩,搜索按钮与工作区卡片左边缘错位。
 * 现 AISidePanel 已改为 flex 流内布局,work-area-portal-root 无 padding-left,
 * 搜索按钮容器(GlobalTopBar 内层 flex h-9,无 pl)与工作区卡片(MainShell 外层 wrapper,无 pl)
 * 都紧贴 work-area-portal-root 左边缘,left 值应严格相等。
 *
 * 此测试测量三个关键元素的 left 值,验证完全对齐(容差 0.5px subpixel):
 *  1. work-area-portal-root(#work-area-portal-root)— GlobalShell 右列 flex-1 容器
 *  2. 顶部搜索按钮容器(GlobalTopBar 内层 flex h-9,搜索按钮是其第一个 button 子元素)
 *  3. MainShell 工作区卡片([data-workspace-card])
 *
 * 同时验证关键样式不变量:
 *  - work-area-portal-root: paddingLeft === '0px' && marginLeft === '0px'
 *  - GlobalTopBar 内层 flex 容器: paddingLeft === '0px' && marginLeft === '0px'
 *  - MainShell 工作区卡片外层 wrapper: paddingLeft === '0px' && marginLeft === '0px'
 *
 * 守门阈值:对齐差值 ≤ 0.5px(subpixel 容差,DPR 缩放下 getBoundingClientRect 可能浮动 ±0.5px)
 * 任何修改导致差值 > 0.5px → 测试失败 → 阻止部署
 *
 * 防回归场景:
 *  - 误给 work-area-portal-root 加 padding-left(回退到旧 fixed + padding 避让模式)
 *  - 误给 GlobalTopBar 内层 flex 加 pl-*(搜索按钮被挤到中间)
 *  - 误给 MainShell 外层 wrapper 加 pl-*(工作区卡片被挤到右侧,跟搜索按钮错位)
 *  - AISidePanel 从 flex 流改回 fixed 定位(破坏整体 flex 布局契约)
 */

/** subpixel 容差:DPR 缩放下 getBoundingClientRect 可能浮动 ±0.5px */
const ALIGN_THRESHOLD_PX = 0.5

test.describe('顶部搜索按钮容器 与 MainShell 工作区卡片 左对齐守门', () => {
  test('搜索按钮 / 工作区卡片 / work-area 三者 left 严格对齐', async ({ adminPage }) => {
    await adminPage.goto('/chat')
    // 等待路由 + AI 面板 + 顶栏完全渲染
    await adminPage.waitForTimeout(2000)

    const measure = await adminPage.evaluate(() => {
      const workArea = document.getElementById('work-area-portal-root')
      if (!workArea) throw new Error('work-area-portal-root not found')

      // 找搜索按钮:GlobalTopBar 内层 flex h-9 的第一个含 Search 图标的 button
      const allButtons = Array.from(document.querySelectorAll('button'))
      const searchBtn = allButtons.find((b) => {
        const svg = b.querySelector('svg')
        if (!svg) return false
        // lucide-search 图标 class 含 "lucide-search" 或图标名 search
        return (
          svg.classList.contains('lucide-search') ||
          Array.from(svg.classList).some((c) => c.toLowerCase().includes('search'))
        )
      })
      if (!searchBtn) throw new Error('search button not found')

      // 搜索按钮容器(GlobalTopBar 内层 flex h-9 items-center gap-1)
      const topBarInner = searchBtn.parentElement
      if (!topBarInner) throw new Error('topBar inner flex container not found')

      // 工作区卡片
      const workspaceCard = document.querySelector('[data-workspace-card]')
      if (!workspaceCard) throw new Error('[data-workspace-card] not found')

      // MainShell 外层 wrapper(工作区卡片的父元素)
      const mainShellWrapper = workspaceCard.parentElement
      if (!mainShellWrapper) throw new Error('MainShell wrapper not found')

      const workAreaRect = workArea.getBoundingClientRect()
      const searchBtnRect = searchBtn.getBoundingClientRect()
      const topBarInnerRect = topBarInner.getBoundingClientRect()
      const cardRect = workspaceCard.getBoundingClientRect()

      const workAreaStyle = getComputedStyle(workArea)
      const topBarInnerStyle = getComputedStyle(topBarInner)
      const mainShellWrapperStyle = getComputedStyle(mainShellWrapper)

      return {
        workArea: {
          left: workAreaRect.left,
          paddingLeft: workAreaStyle.paddingLeft,
          marginLeft: workAreaStyle.marginLeft,
        },
        searchBtn: {
          left: searchBtnRect.left,
          width: searchBtnRect.width,
        },
        topBarInner: {
          left: topBarInnerRect.left,
          paddingLeft: topBarInnerStyle.paddingLeft,
          marginLeft: topBarInnerStyle.marginLeft,
          className: topBarInner.className,
        },
        workspaceCard: {
          left: cardRect.left,
          marginLeft: mainShellWrapperStyle.marginLeft,
          paddingLeft: mainShellWrapperStyle.paddingLeft,
        },
        // 关键对齐差值
        searchMinusWorkArea: searchBtnRect.left - workAreaRect.left,
        cardMinusWorkArea: cardRect.left - workAreaRect.left,
        cardMinusSearch: cardRect.left - searchBtnRect.left,
      }
    })

    // 关键不变量 1:work-area-portal-root 无 padding-left / margin-left
    expect(
      measure.workArea.paddingLeft,
      'work-area-portal-root 禁止 padding-left(避免压缩 work-area 回归旧 fixed 避让模式)',
    ).toBe('0px')
    expect(measure.workArea.marginLeft, 'work-area-portal-root 禁止 margin-left').toBe('0px')

    // 关键不变量 2:GlobalTopBar 内层 flex 容器无 padding-left / margin-left
    expect(
      measure.topBarInner.paddingLeft,
      'GlobalTopBar 内层 flex 容器禁止 padding-left(搜索按钮必须紧贴 work-area 左边缘)',
    ).toBe('0px')
    expect(measure.topBarInner.marginLeft, 'GlobalTopBar 内层 flex 容器禁止 margin-left').toBe(
      '0px',
    )

    // 关键不变量 3:MainShell 外层 wrapper 无 padding-left / margin-left
    expect(
      measure.workspaceCard.marginLeft,
      'MainShell 外层 wrapper 禁止 margin-left(工作区卡片必须紧贴 work-area 左边缘)',
    ).toBe('0px')
    expect(measure.workspaceCard.paddingLeft, 'MainShell 外层 wrapper 禁止 padding-left').toBe(
      '0px',
    )

    // 关键对齐断言 1:搜索按钮 left === work-area left
    expect(
      Math.abs(measure.searchMinusWorkArea),
      `搜索按钮 left(${measure.searchBtn.left}) 应与 work-area left(${measure.workArea.left}) 对齐,差值 ${measure.searchMinusWorkArea}px 超过阈值 ${ALIGN_THRESHOLD_PX}px`,
    ).toBeLessThanOrEqual(ALIGN_THRESHOLD_PX)

    // 关键对齐断言 2:工作区卡片 left === work-area left
    expect(
      Math.abs(measure.cardMinusWorkArea),
      `工作区卡片 left(${measure.workspaceCard.left}) 应与 work-area left(${measure.workArea.left}) 对齐,差值 ${measure.cardMinusWorkArea}px 超过阈值 ${ALIGN_THRESHOLD_PX}px`,
    ).toBeLessThanOrEqual(ALIGN_THRESHOLD_PX)

    // 关键对齐断言 3:工作区卡片 left === 搜索按钮 left(用户原话:对齐)
    expect(
      Math.abs(measure.cardMinusSearch),
      `工作区卡片 left(${measure.workspaceCard.left}) 应与搜索按钮 left(${measure.searchBtn.left}) 对齐,差值 ${measure.cardMinusSearch}px 超过阈值 ${ALIGN_THRESHOLD_PX}px`,
    ).toBeLessThanOrEqual(ALIGN_THRESHOLD_PX)
  })
})
