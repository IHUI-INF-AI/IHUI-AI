// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D20 尾票(RN 侧):取消置顶后条目要**立刻落到渲染列表中的真实排位**。
 *
 * 与同端 message-center.test.tsx 的分工:那份已锁"点置顶 → 网络出口参数 + 成功重排 +
 * 置顶失败 Alert";本票补它没覆盖的两格 ——
 *   ① **取消置顶**的落位判据打在渲染行 index 上(不是数组长度 —— 长度对错位无感);
 *   ② 失败态在**已有置顶行**的列表上逐字回滚(那份失败用例初始无置顶行,
 *      "原样"只验了序、没验 pinned 标记本身没被偷翻)。
 * 替身组件逐行按数组序渲染,而真实共享屏(packages/app MessageCenterScreen)
 * 同样是 conversations.map(...) 数组序 ⇒ 测试里读到的行 index 即"渲染后的 index"。
 *
 * '@ihui/shared/chat/conversation-pin' 由端内 vitest alias 直连真实源码
 * (apps/mobile-rn/vitest.config.ts 注释:给它写 mock 测的就是 mock)⇒ 这里断的是线上链路。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor, fireEvent } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ReactNode } from 'react'

const { apiMocks } = vi.hoisted(() => ({
  apiMocks: {
    fetchApi: vi.fn(),
    listConversations: vi.fn(),
    setConversationPinned: vi.fn(),
    navigate: vi.fn(),
    goBack: vi.fn(),
    alert: vi.fn(),
  },
}))

vi.mock('@ihui/api-client', () => ({
  fetchApi: apiMocks.fetchApi,
  listConversations: apiMocks.listConversations,
  setConversationPinned: apiMocks.setConversationPinned,
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: apiMocks.navigate, goBack: apiMocks.goBack }),
}))

vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

interface StubConv {
  id: string
  name: string
  lastMessage?: string
  time?: string
  pinned?: boolean
}

// features 共享层 MessageCenterScreen 骨架替身:比 message-center.test.tsx 多暴露
// data-conv-id / data-pinned 两个属性 —— 本票判据要同时读"行落在第几个 index"
// 与"该行渲染出的置顶标记",缺其一就验不出「UI 说没变、数据已经变了」那一型。
vi.mock('@ihui/rn-app', async () => {
  const { createElement: h } = await import('react')
  return {
    SearchInput: () => h('input', null),
    MessageCenterScreen: ({
      conversations,
      onPressConversation,
      onTogglePin,
    }: {
      conversations?: StubConv[]
      onPressConversation?: (c: StubConv) => void
      onTogglePin?: (c: StubConv) => void
    }) =>
      h('div', { 'data-testid': 'message-center-root' }, [
        h(
          'div',
          { 'data-testid': 'conversations' },
          (conversations ?? []).map((c) =>
            h(
              'button',
              {
                key: c.id,
                'data-conv-id': c.id,
                'data-pinned': String(c.pinned === true),
                onClick: () => onPressConversation?.(c),
              },
              c.name,
            ),
          ),
        ),
        h(
          'div',
          { 'data-testid': 'pin-actions' },
          (conversations ?? []).map((c) =>
            h(
              'button',
              {
                key: `pin-${c.id}`,
                'data-pin-id': c.id,
                onClick: () => onTogglePin?.(c),
              },
              `pin:${c.id}`,
            ),
          ),
        ),
      ]),
  }
})

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react')
  const mk = (tag: string) =>
    function MockComp(props: { children?: ReactNode; [k: string]: unknown }) {
      return h(tag, null, props.children)
    }
  return {
    View: mk('div'),
    Text: mk('span'),
    TouchableOpacity: mk('button'),
    TextInput: mk('input'),
    Pressable: mk('button'),
    ScrollView: mk('div'),
    Image: mk('img'),
    RefreshControl: () => null,
    Alert: { alert: apiMocks.alert },
    StyleSheet: { create: (s: Record<string, unknown>) => s },
  }
})

import { MessageCenterScreen } from '../src/screens/MessageCenterScreen'

/** 渲染序读取器:返回会话区按钮的 [id, pinned 标记] 序列 —— 判据一律打在它上面 */
function renderedRows(container: HTMLElement): Array<{ id: string; index: number; pinned: boolean }> {
  const buttons = Array.from(
    container.querySelector('[data-testid="conversations"]')!.querySelectorAll('button'),
  )
  return buttons.map((b, index) => ({
    id: b.getAttribute('data-conv-id') ?? '',
    index,
    pinned: b.getAttribute('data-pinned') === 'true',
  }))
}

describe('取消置顶即时落位(RN 渲染 index 判据)', () => {
  beforeEach(() => {
    apiMocks.fetchApi.mockResolvedValue({ success: true, data: { list: [], total: 0 } })
    apiMocks.setConversationPinned.mockResolvedValue({ conversation: { id: 'ok' } })
    apiMocks.listConversations.mockResolvedValue({
      success: true,
      data: {
        // 服务端按置顶优先回:[A✓, B✓, C, D]
        conversations: [
          { id: 'A', title: '置顶一', pinned: true },
          { id: 'B', title: '置顶二', pinned: true },
          { id: 'C', title: '普通一' },
          { id: 'D', title: '普通二' },
        ],
        total: 4,
      },
    })
  })

  it('取消置顶成功后:该行渲染 index 由 0 落到 1(置顶区只剩 B),不在置顶区首位、也不在末尾', async () => {
    const { container } = render(<MessageCenterScreen />)
    await waitFor(() => {
      expect(renderedRows(container).map((r) => r.id)).toEqual(['A', 'B', 'C', 'D'])
    })

    fireEvent.click(container.querySelector('[data-pin-id="A"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(apiMocks.setConversationPinned).toHaveBeenCalledWith('A', false)
    })
    await waitFor(() => {
      const rows = renderedRows(container)
      // 落位判据:取消后 A 的渲染 index = 剩余置顶行数(1) + 原列中 A 之前的非置顶行数(0) = 1
      expect(rows.map((r) => r.id)).toEqual(['B', 'A', 'C', 'D'])
      const landedA = rows.find((r) => r.id === 'A')!
      expect(landedA.index).toBe(1)
      // 置顶标记也须同帧翻落:false 的行不得再排在 true 的行之前(渲染序满足置顶优先)
      expect(landedA.pinned).toBe(false)
      expect(rows[0]).toMatchObject({ id: 'B', pinned: true })
      // 反向排除"追加末尾"形态:A 不在末位
      expect(landedA.index).not.toBe(rows.length - 1)
    })
  })

  it('服务端拒绝取消置顶:渲染序与置顶标记逐字不动(不出现 UI/数据分叉),且 Alert 喊出', async () => {
    apiMocks.setConversationPinned.mockRejectedValueOnce(new Error('PATCH 500'))
    const { container } = render(<MessageCenterScreen />)
    await waitFor(() => {
      expect(renderedRows(container).map((r) => r.id)).toEqual(['A', 'B', 'C', 'D'])
    })
    const before = renderedRows(container)

    fireEvent.click(container.querySelector('[data-pin-id="A"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(apiMocks.setConversationPinned).toHaveBeenCalledWith('A', false)
      expect(apiMocks.alert).toHaveBeenCalledTimes(1)
    })
    // 失败后整表逐行对账:id 序、每行 index、每行 pinned 标记全部原样 ——
    // 既没有"UI 已经重排而数据说失败",也没有"数据回滚而界面留在中间态"。
    const after = renderedRows(container)
    expect(after).toEqual(before)
    expect(after.find((r) => r.id === 'A')).toMatchObject({ index: 0, pinned: true })
  })
})

describe('源码级反向锁(RN 端):置顶动作只有共享出口一个,端内不得写第二份排序', () => {
  const src = readFileSync(
    resolve(__dirname, '../src/screens/MessageCenterScreen.tsx'),
    'utf8',
  )

  it('置顶切换从共享包导入并调用 togglePinnedItem(AGENTS §3 共享层优先 / 守门 40)', () => {
    expect(src).toContain("@ihui/shared/chat/conversation-pin'")
    expect(src).toContain('togglePinnedItem(')
  })

  it('端内零第二份排序:出现 .sort( 调用或自引 sortPinnedFirst( 就是在端里另起炉灶(本票立论的反面)', () => {
    // 排序动作全在共享出口内部完成;端里若自己 sort,「取消后落真实位」就有了第二真相源。
    // 判**调用形态**而非裸标识符:本文件头注引用"共享 sortPinnedFirst 的稳定重排"是叙述,
    // 不是端内取用 —— 锁把叙述判红,后人就只能删注释保门,那正是本仓"注释谎话"要防的反向。
    expect(src).not.toMatch(/\.sort\(/)
    expect(src).not.toMatch(/sortPinnedFirst\s*\(/)
    // 阳性对照:当前源码确实没有这两处调用形态(若判据退化成 toContain 的反面写法,这条会红)
    expect(src.match(/\.sort\(/g) ?? []).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
