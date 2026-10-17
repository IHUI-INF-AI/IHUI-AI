// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D195 共享 RN 通知屏的判据锁。
//
// 钉住四件在别处会静默坏掉的事:
//   1. 「隐藏」必须可撤销 —— 分区入口常驻屏面,且归档区里行尾动作必须是 restore 而不是 hide;
//      归档只做一半(能收走不能捞回)是本仓记过的形态("只有硬删,没有可追认的删除形态")。
//   2. 行尾操作与整行点击必须是兄弟节点,不是嵌套可点 —— 嵌套时内层吞事件、外层仍响应,
//      "点隐藏却把这条标成已读"就是这么来的。这里用「onPressItem 未被调用」正面钉住。
//   3. 在飞行的行不得再叠一次状态迁移(pending ⇒ disabled),失败回显落在这一行而不是整屏。
//   4. 失败态必须取 danger 档、在飞态取次要文字档 —— 两态同形就等于没有回显。
import { createElement } from 'react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup, within } from '@testing-library/react'

vi.mock('lucide-react-native', () => ({
  ChevronLeft: (p: Record<string, unknown>) => createElement('i', p),
  ChevronRight: (p: Record<string, unknown>) => createElement('i', p),
}))

vi.mock('react-native', () => {
  const flatten = (style: unknown): Record<string, unknown> => {
    if (style === null || style === undefined) return {}
    if (Array.isArray(style))
      return style.reduce<Record<string, unknown>>((acc, s) => Object.assign(acc, flatten(s)), {})
    if (typeof style === 'object') return style as Record<string, unknown>
    return {}
  }
  // RN 的 style(对象/数组)绝不能原样交给 react-dom:它会对 style 逐键 set,数组形态直接撞
  // proxy trap(实测 'set' on trap returned falsish for property '0')。统一序列化成 data-style。
  const domProps = (p: Record<string, unknown>): Record<string, unknown> => {
    const { style, children, ...rest } = p
    return { ...rest, 'data-style': JSON.stringify(flatten(style)), children: children as never }
  }
  const View = (p: Record<string, unknown>) => createElement('div', domProps(p))
  const Text = (p: Record<string, unknown>) => createElement('span', domProps(p))
  // disabled 桩刻意与 RN 同义:真机 RN 不响应 disabled 的可点,桩也必须不挂 onClick ——
  // 否则这条测试的是桩,不是组件有没有把 disabled 传下去。
  const Pressable = (p: Record<string, unknown>) =>
    createElement(
      'div',
      {
        ...domProps(p),
        onClick: p.disabled === true ? undefined : (p.onPress as (() => void) | undefined),
        'data-disabled': p.disabled === true ? '1' : undefined,
      },
      p.children as never,
    )
  return {
    View,
    Text,
    Pressable,
    TouchableOpacity: Pressable,
    ScrollView: (p: Record<string, unknown>) => createElement('div', {}, p.children as never),
    RefreshControl: () => createElement('div', { 'data-testid': 'rn-refresh' }),
    StyleSheet: { create: (s: unknown) => s, flatten: (s: unknown) => s },
    PixelRatio: { getFontScale: () => 1 },
  }
})

import { NotificationListScreen } from '../src/features/notification/NotificationListScreen'
import { getTokens } from '../src/theme/tokens'
import type { NotificationListItem } from '../src/types'

const t = (key: string) => key
const tk = getTokens('light')

const ITEMS: NotificationListItem[] = [
  { id: 'n1', type: 'system', title: '系统一', content: '甲', read: false, createdAt: '刚刚' },
  { id: 'n2', type: 'order', title: '订单二', content: '乙', read: true, createdAt: '2 天前' },
]

// 每次只留一份渲染:RTL 的 getBy*/getAllByText 扫的是整个 document,
// 上一份没 unmount 就会让"计数断言"数到别人的行(本文件初版即栽在这上面)。
function renderScreen(over: Record<string, unknown> = {}) {
  const r = render(
    createElement(NotificationListScreen, {
      t,
      items: ITEMS,
      loading: false,
      refreshing: false,
      error: '',
      onRefresh: () => {},
      onBack: () => {},
      ...over,
    }) as never,
  )
  return {
    ...r,
    countOf: (text: string) => within(r.container).queryAllByText(text).length,
    oneOf: (text: string) => within(r.container).getByText(text),
  }
}

afterEach(() => {
  cleanup()
})

describe('D195 共享通知屏 分区与可撤销归档', () => {
  it('① 缺省 active:两个分区入口都在,行尾动作只可能是 hide', () => {
    const r = renderScreen({ onPartitionChange: () => {} })
    expect(r.oneOf('notificationList.viewActive')).toBeTruthy()
    expect(r.oneOf('notificationList.archived')).toBeTruthy()
    expect(r.countOf('notificationList.hide')).toBe(2)
    expect(r.countOf('notificationList.restore')).toBe(0)
  })

  it('② 归档分区:行尾换成 restore,hide 一处不留', () => {
    const r = renderScreen({ partition: 'archived', onPartitionChange: () => {} })
    expect(r.countOf('notificationList.restore')).toBe(2)
    expect(r.countOf('notificationList.hide')).toBe(0)
  })

  it('③ 空态文案按分区分形:归档区说"可随时恢复",动态流说 empty', () => {
    const archivedEmpty = renderScreen({ partition: 'archived', items: [] })
    expect(archivedEmpty.oneOf('notificationList.emptyArchived')).toBeTruthy()
    expect(archivedEmpty.countOf('notificationList.empty')).toBe(0)
    archivedEmpty.unmount()
    const activeEmpty = renderScreen({ partition: 'active', items: [] })
    expect(activeEmpty.oneOf('notificationList.empty')).toBeTruthy()
    expect(activeEmpty.countOf('notificationList.emptyArchived')).toBe(0)
  })

  it('④ 分区开关可切:点 archived 回调带回 archived', () => {
    const onPartitionChange = vi.fn()
    const r = renderScreen({ onPartitionChange })
    fireEvent.click(r.oneOf('notificationList.archived'))
    expect(onPartitionChange).toHaveBeenCalledWith('archived')
  })

  it('⑤ 点 hide 只打 onArchive,不得顺带触发整行 onPressItem(嵌套可点那一型)', () => {
    const onArchive = vi.fn()
    const onPressItem = vi.fn()
    const r = renderScreen({ onArchive, onPressItem, onPartitionChange: () => {} })
    fireEvent.click(within(r.container).getAllByText('notificationList.hide')[0] as Element)
    expect(onArchive).toHaveBeenCalledTimes(1)
    expect((onArchive.mock.calls[0] as [NotificationListItem])[0].id).toBe('n1')
    expect(onPressItem).not.toHaveBeenCalled()
  })

  it('⑥ 点已归档行的 restore 只打 onRestore', () => {
    const onRestore = vi.fn()
    const r = renderScreen({
      partition: 'archived',
      onRestore,
      onPartitionChange: () => {},
    })
    // 第二处是 n2 那一行(两条都渲 restore,取第二条锁 id)
    const second = within(r.container).getAllByText('notificationList.restore')[1] as Element
    fireEvent.click(second)
    expect((onRestore.mock.calls[0] as [NotificationListItem])[0].id).toBe('n2')
  })

  it('⑦ pending 行:回显写在这一行内,且该行操作钮 disabled(不叠第二次迁移)', () => {
    const onArchive = vi.fn()
    const r = renderScreen({
      onArchive,
      onPartitionChange: () => {},
      rowStatus: { n1: { text: 'notificationList.hiding', tone: 'muted', pending: true } },
    })
    expect(r.oneOf('notificationList.hiding')).toBeTruthy()
    const disabledNodes = r.container.querySelectorAll('[data-disabled="1"]')
    expect(disabledNodes.length).toBe(1)
    fireEvent.click(disabledNodes[0] as Element)
    expect(onArchive).not.toHaveBeenCalled()
  })

  it('⑧ 失败态取 danger 档,与在飞态(次要文字档)不同色', () => {
    const failed = renderScreen({
      rowStatus: { n1: { text: 'notificationList.hideFailed', tone: 'destructive' } },
      onPartitionChange: () => {},
    })
    const failedStyle = JSON.parse(
      (failed.oneOf('notificationList.hideFailed') as HTMLElement).dataset.style ?? '{}',
    )
    failed.unmount()
    const busy = renderScreen({
      rowStatus: { n1: { text: 'notificationList.restoring', tone: 'muted', pending: true } },
      onPartitionChange: () => {},
    })
    const busyStyle = JSON.parse(
      (busy.oneOf('notificationList.restoring') as HTMLElement).dataset.style ?? '{}',
    )
    expect(failedStyle.color).toBe(tk.danger.DEFAULT)
    expect(busyStyle.color).toBe(tk.text.secondary)
    expect(failedStyle.color).not.toBe(busyStyle.color)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
