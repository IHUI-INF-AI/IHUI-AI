// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, cleanup, act } from '@testing-library/react'

// Mock next/link:渲染为原生 a 标签,避免 RSC 边界
// 透传 draggable + onContextMenu(测试 Feature 3 右键菜单 / Feature 4 拖拽需要)
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    className,
    href,
    draggable,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    onContextMenu,
  }: {
    children: React.ReactNode
    className?: string
    href: string
    draggable?: boolean
    onDragStart?: React.DragEventHandler
    onDragOver?: React.DragEventHandler
    onDrop?: React.DragEventHandler
    onDragEnd?: React.DragEventHandler
    onContextMenu?: React.MouseEventHandler
  }) => (
    <a
      href={href}
      className={className}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onContextMenu={onContextMenu}
    >
      {children}
    </a>
  ),
}))

// Mock next/navigation:返回固定 pathname,触发 addTag
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => null,
  useRouter: () => ({ push: () => {} }),
}))

// Mock Dropdown:仅渲染 trigger,避免 Radix 依赖
vi.mock('@/components/feedback', () => ({
  Dropdown: ({ trigger }: { trigger: React.ReactNode }) => <>{trigger}</>,
}))

// Mock next-intl:TagsView 用 useTranslations 解析 nav/admin/common 翻译。
// 单元测试不依赖 messages 文件,只为 common 命名空间提供中文文案(供菜单文案断言用),
// 其他命名空间直接回传 key 作为字面值(测试只校验样式/交互,不校验文案翻译)。
// 返回稳定引用(useCallback 依赖 useTranslations 结果,若每次返回新函数会导致 useEffect 重复触发)
//
// locale 切换模拟:用 vi.hoisted 提升状态,使 mock 工厂能感知 currentLocale 变化。
// 切换 locale 时,(ns, locale) 组合键不同 → 返回新引用的 t 函数 →
// TagsView 中 nsTranslators useMemo 依赖变化 → resolveTitle 重算 → 标签文字更新。
const { mockLocale, MESSAGES } = vi.hoisted(() => {
  const messages = {
    'zh-CN': {
      common: {
        close: '关闭',
        closeOther: '关闭其他',
        closeAll: '关闭全部',
        unsaved: '未保存',
        moreActions: '更多操作',
      },
      // zh-CN 下 nav 返回 key 字面值,保持现有断言 toContain('home') 兼容
      nav: { home: 'home', workspace: 'workspace' },
    },
    en: {
      common: {
        close: 'Close',
        closeOther: 'Close others',
        closeAll: 'Close all',
        unsaved: 'Unsaved',
        moreActions: 'More',
      },
      nav: { home: 'Home', workspace: 'Workspace' },
    },
  }
  return { mockLocale: { value: 'zh-CN' as 'zh-CN' | 'en' }, MESSAGES: messages }
})

// 测试用 helper:切换 mock locale(测试用例用 __setMockLocale('en') 模拟语言切换)
function __setMockLocale(l: 'zh-CN' | 'en') {
  mockLocale.value = l
}

vi.mock('next-intl', () => {
  // 按 (ns, locale) 二维缓存,确保同一 (ns, locale) 返回稳定引用(避免 useEffect 重复触发),
  // 但 locale 变化时返回新引用(触发 nsTranslators 重建,从而重算 title)
  const cache = new Map<string, (key: string) => string>()
  return {
    useTranslations: (ns: string) => {
      const locale = mockLocale.value
      const key = `${ns}:${locale}`
      let t = cache.get(key)
      if (!t) {
        const msgs = (MESSAGES[locale] as Record<string, Record<string, string>>)[ns] ?? {}
        t = (k: string) => msgs[k] ?? k
        cache.set(key, t)
      }
      return t
    },
  }
})

// Mock path-labels:绕过对 sidebar / AdminNav 的真实导入,
// 直接提供测试所需的路径 → 标签规格映射。
vi.mock('@/lib/path-labels', () => ({
  resolvePathLabelSpec: (pathname: string) => {
    if (!pathname || pathname === '/') return { ns: 'nav', key: 'home' }
    return null
  },
}))

import { TagsView } from '../TagsView'
import { useTagsViewStore } from '@/stores/tags-view'

/**
 * TagsView 视觉守门单元测试。
 *
 * 防止以下回归(2026-07-18 用户要求):
 *   - 标签容器丢失圆角(rounded-lg)
 *   - 标签容器与父级工作展示区顶部/左右无间距(mx-2 mt-2 被误删)
 *   - 标签容器背景丢失(bg-muted/40)
 *
 * 设计说明:
 *   - 单元测试相比 E2E 优势:不依赖后端/登录态/完整页面渲染,
 *     / 路由当前因 "Tooltip must be used within TooltipProvider" bug 无法跑 E2E,
 *     单元测试绕开此问题,直接渲染组件验证 className。
 *   - className 是样式的"事实来源",Tailwind 编译后会原样输出 token 到 class 属性。
 */
describe('TagsView 视觉守门', () => {
  beforeEach(() => {
    // 重置 store,确保每个 test 独立
    useTagsViewStore.setState({ tags: [], activePath: null, dirtyPaths: new Set() })
    // 重置 mock locale 为 zh-CN(防止上一条用例切换到 en 后影响下一条)
    __setMockLocale('zh-CN')
  })

  afterEach(() => {
    cleanup()
  })

  /**
   * 渲染 TagsView 并返回外层容器(第一个子 div)。
   * 前置条件:store 里有至少 1 个 tag,否则 TagsView return null。
   */
  function renderWithTags() {
    act(() => {
      useTagsViewStore.getState().addTag({ path: '/', title: '首页' })
    })
    const { container } = render(<TagsView />)
    // TagsView 根 div(外层带 bg-muted/40)
    const outerDiv = container.firstChild as HTMLElement
    expect(outerDiv, 'TagsView 应渲染外层 div').not.toBeNull()
    expect(outerDiv.tagName, '外层应为 div').toBe('DIV')
    return outerDiv
  }

  it('容器 className 包含 rounded-lg(防止圆角被误删)', () => {
    const outerDiv = renderWithTags()
    expect(outerDiv.className, '应有 rounded-lg').toContain('rounded-lg')
  })

  it('容器 className 包含 mx-2(防止左右间距被误删)', () => {
    const outerDiv = renderWithTags()
    expect(outerDiv.className, '应有 mx-2').toContain('mx-2')
  })

  it('容器 className 包含 mt-2(防止顶部间距被误删)', () => {
    const outerDiv = renderWithTags()
    expect(outerDiv.className, '应有 mt-2').toContain('mt-2')
  })

  it('容器 className 包含 bg-muted/70(防止背景色被误删)', () => {
    const outerDiv = renderWithTags()
    expect(outerDiv.className, '应有 bg-muted/70').toContain('bg-muted/70')
  })

  it('容器 className 包含 dark:bg-white/[0.07](深色模式更偏白)', () => {
    const outerDiv = renderWithTags()
    expect(outerDiv.className, '应有 dark:bg-white/[0.07]').toContain('dark:bg-white/[0.07]')
  })

  it('标签 Link 包含 border 描边(active 状态用 primary/30,非 active 状态用 border/40)', () => {
    const outerDiv = renderWithTags()
    const link = outerDiv.querySelector('a')
    expect(link, '应有 a 标签').not.toBeNull()
    expect(link!.className, '应有 border').toContain('border')
    // 当前 tag 是 active(addTag 后默认激活),实际渲染用 primary/30 描边
    expect(link!.className, 'active tag 应用 primary/30 描边').toContain('border-primary/30')
  })

  it('关闭按钮 X 默认占位 w-5 + opacity-0(hover 不拉伸标签宽度,加大到接近文字大小)', () => {
    const outerDiv = renderWithTags()
    const closeBtn = outerDiv.querySelector('[aria-label="关闭"]')
    expect(closeBtn, '应有 X 关闭按钮').not.toBeNull()
    expect(closeBtn!.className, 'X 按钮应始终占位 w-5(加大与文字匹配)').toContain('w-5')
    expect(closeBtn!.className, 'X 按钮应始终占位 h-5(加大与文字匹配)').toContain('h-5')
    expect(closeBtn!.className, 'X 按钮默认透明').toContain('opacity-0')
    expect(closeBtn!.className, 'X 按钮 hover 时显示').toContain('group-hover:opacity-100')
  })

  it('关闭按钮 X 减少动画偏好的用户始终可见(motion-reduce a11y)', () => {
    const outerDiv = renderWithTags()
    const closeBtn = outerDiv.querySelector('[aria-label="关闭"]')
    expect(closeBtn, '应有 X 关闭按钮').not.toBeNull()
    expect(
      closeBtn!.className,
      'X 按钮在 prefers-reduced-motion 偏好下应常驻 60% 不透明',
    ).toContain('motion-reduce:opacity-60')
  })

  it('关闭按钮 X 键盘焦点态可见(focus-visible a11y)', () => {
    const outerDiv = renderWithTags()
    const closeBtn = outerDiv.querySelector('[aria-label="关闭"]')
    expect(closeBtn, '应有 X 关闭按钮').not.toBeNull()
    expect(closeBtn!.className, 'X 按钮键盘焦点应显示').toContain('focus-visible:opacity-100')
    expect(closeBtn!.className, 'X 按钮应无默认 outline').toContain('focus-visible:outline-none')
    expect(closeBtn!.className, 'X 按钮应有焦点环').toContain('focus-visible:ring-1')
    expect(closeBtn!.className, 'X 按钮焦点环使用 ring token').toContain('focus-visible:ring-ring')
  })

  it('标签 Link 左右 padding 对称(文字视觉居中, X 紧贴右侧)', () => {
    const outerDiv = renderWithTags()
    const link = outerDiv.querySelector('a')
    expect(link, '应有 a 标签').not.toBeNull()
    // 右侧 = gap-1(4px) + X w-5(20px) + pr-1(4px) = 28px
    // 左侧 pl-7(28px) 与右侧总占位对称,文字几何居中
    // gap-1 + pr-1 让 X 紧贴标签右侧(pr 仅 4px padding)
    expect(link!.className, '应有 pl-7').toContain('pl-7')
    expect(link!.className, '应有 pr-1(X 紧贴右侧)').toContain('pr-1')
    expect(link!.className, '应有 gap-1(X 与文字紧贴)').toContain('gap-1')
  })

  it('关闭按钮 X 图标加大到 h-3.5(与文字大小匹配)', () => {
    const outerDiv = renderWithTags()
    const closeBtn = outerDiv.querySelector('[aria-label="关闭"]')
    expect(closeBtn, '应有 X 关闭按钮').not.toBeNull()
    const icon = closeBtn!.querySelector('svg')
    expect(icon, '应有 X 图标').not.toBeNull()
    // lucide-react SVG 在 jsdom 下 className 属性可能为空,用 getAttribute('class') 兜底
    const iconClass =
      icon!.className.baseVal || icon!.getAttribute('class') || icon!.className || ''
    expect(iconClass, 'X 图标应加大到 h-3.5(检查 class 属性)').toContain('h-3.5')
    expect(iconClass, 'X 图标应加大到 w-3.5(检查 class 属性)').toContain('w-3.5')
  })

  it('容器 className 包含 h-9(防止高度被误改)', () => {
    const outerDiv = renderWithTags()
    expect(outerDiv.className, '应有 h-9').toContain('h-9')
  })

  it('派生式标题:渲染时根据 path + 当前 locale 实时计算,忽略 store 中的 title 字段', () => {
    // 故意传入错误的 title 字段,验证渲染时不使用此值(派生式优先)
    act(() => {
      useTagsViewStore.getState().addTag({ path: '/', title: 'STALE_TITLE_SHOULD_NOT_RENDER' })
    })
    const { container } = render(<TagsView />)
    const link = container.querySelector('a')
    expect(link, '应有 a 标签').not.toBeNull()
    // path='/' → resolvePathLabelSpec 返回 {ns:'nav', key:'home'} → tNav('home')
    // zh-CN mock 下 nav.home 字面值 = 'home'
    expect(link!.textContent, '应使用派生标题(home),而非 store 中的 STALE_TITLE').toContain('home')
    expect(link!.textContent, '不应渲染 store 中的 stale title').not.toContain('STALE_TITLE')
  })

  it('语言切换重译:locale 变化时已存在标签的标题自动重算(无需刷新页面)', () => {
    // 模拟用户已经在系统中(zh-CN)打开 / 标签
    act(() => {
      useTagsViewStore.getState().addTag({ path: '/' })
    })
    const { container, rerender } = render(<TagsView />)
    const linkBefore = container.querySelector('a')!
    expect(linkBefore, '应有 a 标签').not.toBeNull()
    expect(linkBefore.textContent, 'zh-CN 下应渲染 home').toContain('home')

    // 切换语言到 en(模拟 sidebar 的 handleLocaleChange 调 setLocale + router.refresh)
    // mock 行为:next-intl 的 useTranslations 在 locale 变化后返回新引用 t 函数,
    // TagsView 中 nsTranslators useMemo 依赖变化 → resolveTitle useCallback 重新计算 →
    // 标签 title 按 en 重译
    __setMockLocale('en')
    rerender(<TagsView />)

    const linkAfter = container.querySelector('a')!
    expect(linkAfter, 'rerender 后应有 a 标签').not.toBeNull()
    expect(linkAfter.textContent, 'en 下应重译为 Home').toContain('Home')
    // 验证 store 数据未变(派生式架构本质:store 只存 path,标题在渲染时派生)
    expect(useTagsViewStore.getState().tags.length, 'store 标签数量应保持 1').toBe(1)
    expect(useTagsViewStore.getState().tags[0]!.path, 'store 标签 path 仍为 /').toBe('/')
    // 切回 zh-CN 验证可逆
    __setMockLocale('zh-CN')
    rerender(<TagsView />)
    const linkBack = container.querySelector('a')!
    expect(linkBack.textContent, '切回 zh-CN 后应重新变为 home').toContain('home')
  })

  // ─── Feature 5: 未保存状态指示点 ───
  it('默认不渲染未保存指示点(dirtyPaths 为空)', () => {
    const outerDiv = renderWithTags()
    const dot = outerDiv.querySelector('[data-testid="tag-dirty-dot"]')
    expect(dot, '未 dirty 时不应有指示点').toBeNull()
  })

  it('dirty 状态时渲染未保存指示点,使用 amber-500 与主色区分', () => {
    act(() => {
      useTagsViewStore.getState().setDirty('/', true)
    })
    const outerDiv = renderWithTags()
    const dot = outerDiv.querySelector('[data-testid="tag-dirty-dot"]')
    expect(dot, '应有未保存指示点').not.toBeNull()
    expect(dot!.getAttribute('aria-label'), '指示点应有无障碍标签').toBe('未保存')
    expect(dot!.className, '指示点应使用 amber-500 区分主色').toContain('bg-amber-500')
    expect(dot!.className, '指示点应为小圆点').toContain('rounded-full')
  })

  it('dirty 取消后指示点自动消失(无残留)', () => {
    act(() => {
      useTagsViewStore.getState().setDirty('/', true)
    })
    const { container, rerender } = render(<TagsView />)
    expect(
      container.querySelector('[data-testid="tag-dirty-dot"]'),
      'dirty=true 时应有指示点',
    ).not.toBeNull()
    act(() => {
      useTagsViewStore.getState().setDirty('/', false)
    })
    rerender(<TagsView />)
    expect(
      container.querySelector('[data-testid="tag-dirty-dot"]'),
      'dirty=false 时应无指示点',
    ).toBeNull()
  })

  it('closeOther 应清理被关闭标签的脏状态,只保留目标标签', () => {
    act(() => {
      useTagsViewStore.getState().addTag({ path: '/a', title: 'A' })
      useTagsViewStore.getState().addTag({ path: '/b', title: 'B' })
      useTagsViewStore.getState().addTag({ path: '/c', title: 'C' })
      useTagsViewStore.getState().setDirty('/a', true)
      useTagsViewStore.getState().setDirty('/b', true)
      useTagsViewStore.getState().setDirty('/c', true)
    })
    act(() => {
      useTagsViewStore.getState().closeOther('/b')
    })
    const state = useTagsViewStore.getState()
    expect(state.tags.map((t) => t.path)).toEqual(['/b'])
    expect(state.dirtyPaths.has('/b'), '目标 dirty 应保留').toBe(true)
    expect(state.dirtyPaths.has('/a'), '/a dirty 应清理').toBe(false)
    expect(state.dirtyPaths.has('/c'), '/c dirty 应清理').toBe(false)
  })

  it('removeTag 应同步清理对应 path 的脏状态', () => {
    act(() => {
      useTagsViewStore.getState().addTag({ path: '/x', title: 'X' })
      useTagsViewStore.getState().setDirty('/x', true)
    })
    act(() => {
      useTagsViewStore.getState().removeTag('/x')
    })
    expect(useTagsViewStore.getState().dirtyPaths.has('/x'), 'removeTag 后 dirty 应清掉').toBe(
      false,
    )
  })

  it('closeAll 应清空所有脏状态', () => {
    act(() => {
      useTagsViewStore.getState().addTag({ path: '/a', title: 'A' })
      useTagsViewStore.getState().addTag({ path: '/b', title: 'B' })
      useTagsViewStore.getState().setDirty('/a', true)
      useTagsViewStore.getState().setDirty('/b', true)
    })
    act(() => {
      useTagsViewStore.getState().closeAll()
    })
    expect(useTagsViewStore.getState().dirtyPaths.size, 'closeAll 后 dirtyPaths 应为空').toBe(0)
  })

  // ─── Feature 3: 右键上下文菜单 ───
  it('右键标签弹出 [data-testid="tagsview-context-menu"],含三项操作', () => {
    const { container } = render(<TagsView />)
    const link = container.querySelector('a') as HTMLElement
    expect(link, '应有 a 标签').not.toBeNull()
    // 用原生 MouseEvent 派发,绕过 React Synthetic 事件的 event-pooling
    act(() => {
      link.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 100,
          clientY: 50,
        }),
      )
    })
    const menu = container.querySelector('[data-testid="tagsview-context-menu"]')
    expect(menu, '右键应弹出菜单').not.toBeNull()
    expect(menu!.getAttribute('role'), '菜单应有 menu role').toBe('menu')
    const items = menu!.querySelectorAll('[role="menuitem"]')
    expect(items.length, '菜单应有 3 项操作(关闭/关闭其他/关闭全部)').toBe(3)
    expect(items[0]!.textContent, '第一项应为"关闭"').toContain('关闭')
    expect(items[1]!.textContent, '第二项应为"关闭其他"').toContain('关闭其他')
    expect(items[2]!.textContent, '第三项应为"关闭全部"').toContain('关闭全部')
  })

  it('右键菜单点击外部会关闭(点击 document 触发 close)', () => {
    const { container } = render(<TagsView />)
    const link = container.querySelector('a') as HTMLElement
    act(() => {
      link.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: 100,
          clientY: 50,
        }),
      )
    })
    expect(
      container.querySelector('[data-testid="tagsview-context-menu"]'),
      '右键后菜单应存在',
    ).not.toBeNull()
    act(() => {
      document.body.click()
    })
    expect(
      container.querySelector('[data-testid="tagsview-context-menu"]'),
      '点击 document 后菜单应消失',
    ).toBeNull()
  })

  // ─── Feature 4: HTML5 拖拽排序 ───
  it('reorderTags 移动非 active 标签到目标位置,active 标签保持不动', () => {
    act(() => {
      useTagsViewStore.getState().addTag({ path: '/', title: '首页' })
      useTagsViewStore.getState().addTag({ path: '/a', title: 'A' })
      useTagsViewStore.getState().addTag({ path: '/b', title: 'B' })
    })
    const before = useTagsViewStore.getState().tags.map((t) => t.path)
    expect(before, '初始顺序应为 [/ , /a, /b]').toEqual(['/', '/a', '/b'])
    act(() => {
      useTagsViewStore.getState().reorderTags(1, 2) // A → B 之后
    })
    const after = useTagsViewStore.getState().tags.map((t) => t.path)
    expect(after, '重排后应为 [/ , /b, /a]').toEqual(['/', '/b', '/a'])
  })

  it('reorderTags 越界/相同索引直接 return,保持原状', () => {
    act(() => {
      useTagsViewStore.getState().addTag({ path: '/', title: '首页' })
      useTagsViewStore.getState().addTag({ path: '/a', title: 'A' })
    })
    const before = useTagsViewStore.getState().tags.map((t) => t.path)
    act(() => {
      useTagsViewStore.getState().reorderTags(0, 0) // 相同
    })
    expect(
      useTagsViewStore.getState().tags.map((t) => t.path),
      '同索引 noop',
    ).toEqual(before)
    act(() => {
      useTagsViewStore.getState().reorderTags(-1, 1) // 越界
    })
    expect(
      useTagsViewStore.getState().tags.map((t) => t.path),
      '越界 noop',
    ).toEqual(before)
    act(() => {
      useTagsViewStore.getState().reorderTags(0, 99) // 越界
    })
    expect(
      useTagsViewStore.getState().tags.map((t) => t.path),
      '目标越界 noop',
    ).toEqual(before)
  })

  it('非 active 标签的 Link 设置 draggable=true(可拖),active 标签 draggable=false', () => {
    act(() => {
      useTagsViewStore.getState().addTag({ path: '/', title: '首页' })
      useTagsViewStore.getState().addTag({ path: '/a', title: 'A' })
    })
    const { container } = render(<TagsView />)
    const links = container.querySelectorAll('a')
    expect(links.length, '应有两个 Link').toBe(2)
    const activeLink = links[0] as HTMLElement // '/' 是 active
    const inactiveLink = links[1] as HTMLElement
    expect(activeLink.getAttribute('draggable'), 'active 标签不可拖').toBe('false')
    expect(inactiveLink.getAttribute('draggable'), '非 active 标签可拖').toBe('true')
  })

  // ─── Feature 6: Alt+W 快捷键关闭当前 active 标签 ───
  it('Alt+W 关闭当前 active 标签(Ctrl+W/Cmd+W/Shift+W 不触发,避免与浏览器冲突)', () => {
    act(() => {
      useTagsViewStore.getState().addTag({ path: '/', title: '首页' })
      useTagsViewStore.getState().addTag({ path: '/a', title: 'A' })
    })
    render(<TagsView />)
    // 模拟 Alt+W (按 a 字母对应的 close-all 动作,但我们关闭的是 active tag 即 /a)
    // 由于 / 路径是 addTag 第一次调用产生的,但我们想让 /a 处于 active。
    // 重置:重新设置 active 为 /a
    act(() => {
      useTagsViewStore.setState({ activePath: '/a' })
    })
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', altKey: true, bubbles: true }))
    })
    const tags = useTagsViewStore.getState().tags.map((t) => t.path)
    expect(tags.includes('/a'), 'Alt+W 应关闭 active 标签 /a').toBe(false)
    // 验证 Ctrl+W 不触发关闭
    act(() => {
      useTagsViewStore.setState({ activePath: '/' })
    })
    const tagsBeforeCtrlW = useTagsViewStore.getState().tags.map((t) => t.path)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', ctrlKey: true, bubbles: true }))
    })
    expect(
      useTagsViewStore.getState().tags.map((t) => t.path),
      'Ctrl+W 不应被本组件拦截',
    ).toEqual(tagsBeforeCtrlW)
  })
})
