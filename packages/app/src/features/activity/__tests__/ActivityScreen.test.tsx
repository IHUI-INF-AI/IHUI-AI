// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 活动列表「参与」入口回归 —— 这条链路上原本叠着三个互相掩盖的缺陷:
 *
 * 1. `<TouchableOpacity style={styles.joinBtn}>` 没有 `onPress`。它不只是"点不动":
 *    Pressability 的 `onStartShouldSetResponder` 返回 `!disabled`(默认 true),
 *    内层一定抢走 responder,松手后自己无事可做、外层卡片的跳转也收不到事件 ⇒
 *    整块「立即参与」是点击死区。
 * 2. `participants` 在契约里是必填 number,但后端 activityFields 当时不含该计数,
 *    宿主直接透传 ⇒ 恒渲染「参与人数: undefined」。
 * 3. 后端行是 `startAt/endAt/status:'published'`,契约要 `startTime/endTime/upcoming|…` ——
 *    无映射层,于是时间行 undefined、状态徽章永远走兜底灰。
 *
 * 本文件只锁"入口行为",DTO 映射由宿主侧的 toActivityItem 承担(同目录无渲染依赖)。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ActivityItem, TFunction } from '@ihui/types'
import { ActivityScreen } from '../ActivityScreen'

const t = ((key: string) => key) as unknown as TFunction

/** 测试档主题:与仓内其它测试同一写法,不给 JSX/props 留字面量(主题门把字面量当运行期错)。 */
const testColorScheme: 'light' | 'dark' = 'light'

const item: ActivityItem = {
  id: 'act-1',
  slug: 'morning-reading',
  title: '晨读会',
  description: '共读一章',
  startTime: '2026-11-07 08:00',
  endTime: '2026-11-07 09:00',
  status: 'ongoing',
  participants: 12,
  joined: false,
}

const baseProps = {
  t,
  items: [item],
  loading: false,
  refreshing: false,
  error: '',
  onRefresh: vi.fn(),
  onBack: vi.fn(),
  colorScheme: testColorScheme,
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ActivityScreen 参与入口', () => {
  it('未注入 onJoin ⇒ 按钮降级为静态展示,点击照常落到卡片(不再吞事件)', () => {
    const onItemPress = vi.fn()
    render(<ActivityScreen {...baseProps} onItemPress={onItemPress} />)

    fireEvent.click(screen.getByText('activities.join'))
    expect(onItemPress).toHaveBeenCalled()
  })

  it('注入 onJoin ⇒ 点「立即参与」把该活动交给宿主', () => {
    const onJoin = vi.fn()
    render(<ActivityScreen {...baseProps} onJoin={onJoin} />)

    fireEvent.click(screen.getByText('activities.join'))
    expect(onJoin).toHaveBeenCalledTimes(1)
    expect((onJoin.mock.calls[0]?.[0] as ActivityItem).id).toBe('act-1')
  })

  it('已报名 ⇒ 文案切到「取消报名」', () => {
    render(<ActivityScreen {...baseProps} items={[{ ...item, joined: true }]} onJoin={vi.fn()} />)

    expect(screen.getByText('activities.cancelJoin')).toBeTruthy()
  })

  it('提交中 ⇒ 显示等待文案,且禁用后不再重复回调', () => {
    const onJoin = vi.fn()
    render(<ActivityScreen {...baseProps} onJoin={onJoin} joiningId="act-1" />)

    expect(screen.getByText('activity.joining')).toBeTruthy()
    fireEvent.click(screen.getByText('activity.joining'))
    expect(onJoin).not.toHaveBeenCalled()
  })

  it('后端没给参与人数 ⇒ 不渲染「参与人数」行,不把 undefined 印到屏幕上', () => {
    render(<ActivityScreen {...baseProps} items={[{ ...item, participants: undefined }]} />)

    expect(screen.queryByText(/activity\.participants/)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
