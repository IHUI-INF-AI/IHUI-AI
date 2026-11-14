// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 活动详情「报名 / 取消报名」动作区回归。
 *
 * 背景:后端 `POST|DELETE /activities/:id/join` 与详情回填的 `joined` 字段早就存在
 * (promotions.ts 的注释明写"前端据此决定显示报名还是取消报名"),但共享详情屏此前
 * 整段只读 —— 用户在列表点「立即参与」进来后,再没有任何入口能真正报名。
 *
 * 另锁一条契约诚实性:activities 表没有 location 列,契约把 location 改成了可选;
 * 没有地点时**不渲染**「活动地点:」空标签,而不是显示一行标签加空白。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ActivityDetailItem, TFunction } from '@ihui/types'
import { ActivityDetailScreen } from '../ActivityDetailScreen'

const t = ((key: string) => key) as unknown as TFunction
const testColorScheme: 'light' | 'dark' = 'light'

const item: ActivityDetailItem = {
  id: 'act-1',
  title: '晨读会',
  content: '共读一章',
  startAt: '2026-11-07 08:00',
  endAt: '2026-11-07 09:00',
  joined: false,
}

const baseProps = {
  t,
  item,
  loading: false,
  error: '',
  onBack: vi.fn(),
  colorScheme: testColorScheme,
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ActivityDetailScreen 报名动作区', () => {
  it('未注入 onJoin/onLeave ⇒ 不渲染动作区(不给假按钮)', () => {
    render(<ActivityDetailScreen {...baseProps} />)
    expect(screen.queryByText('activities.join')).toBeNull()
  })

  it('未报名 ⇒ 显示「立即参与」,点击回调 onJoin', () => {
    const onJoin = vi.fn()
    render(<ActivityDetailScreen {...baseProps} onJoin={onJoin} onLeave={vi.fn()} />)

    fireEvent.click(screen.getByText('activities.join'))
    expect(onJoin).toHaveBeenCalledTimes(1)
  })

  it('已报名 ⇒ 显示「取消报名」,点击回调 onLeave 而不是 onJoin', () => {
    const onJoin = vi.fn()
    const onLeave = vi.fn()
    render(
      <ActivityDetailScreen
        {...baseProps}
        item={{ ...item, joined: true }}
        onJoin={onJoin}
        onLeave={onLeave}
      />,
    )

    fireEvent.click(screen.getByText('activities.cancelJoin'))
    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(onJoin).not.toHaveBeenCalled()
  })

  it('提交中 ⇒ 显示等待文案且不重复回调', () => {
    const onJoin = vi.fn()
    render(<ActivityDetailScreen {...baseProps} onJoin={onJoin} joining />)

    fireEvent.click(screen.getByText('activity.joining'))
    expect(onJoin).not.toHaveBeenCalled()
  })

  it('没有 location ⇒ 整行不渲染(不显示空标签)', () => {
    render(<ActivityDetailScreen {...baseProps} />)
    expect(screen.queryByText('activityDetail.location')).toBeNull()
  })

  it('有 location ⇒ 正常渲染该行', () => {
    render(<ActivityDetailScreen {...baseProps} item={{ ...item, location: '线上直播间' }} />)

    expect(screen.getByText('activityDetail.location')).toBeTruthy()
    expect(screen.getByText('线上直播间')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
