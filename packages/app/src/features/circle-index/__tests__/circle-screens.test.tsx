// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 圈子业务对象渲染锁(2026-11-26)。
 *
 * 判据不是“页面能渲染”,而是“渲染的是 group,不是 post”:
 * ① 广场卡必须出 name / memberCount / postCount,且点击只把 group 交给宿主;
 * ② 详情必须出 group 头 + /circles/:id/posts 的帖子区,帖子日期/回复数可见;
 * ③ 两屏共用同一组 props,平台侧只注入数据与导航。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TFunction } from '@ihui/types'
import { CircleIndexScreen } from '../CircleIndexScreen'
import { CircleDetailScreen } from '../../circle-detail/CircleDetailScreen'
import type { CircleDetailItem, CircleListItem, CirclePostItem } from '../../../types'

const t = ((key: string) => key) as unknown as TFunction
const testColorScheme: 'light' | 'dark' = 'light'

const group: CircleListItem = {
  id: 'circle-1',
  name: '前端圈子',
  description: '聊工程实践',
  memberCount: 12,
  postCount: 3,
  isJoined: true,
  createdAt: '2026-11-01',
}

const detail: CircleDetailItem = {
  id: 'circle-1',
  name: '前端圈子',
  description: '聊工程实践',
  memberCount: 12,
  postCount: 3,
  isJoined: true,
  createdAt: '2026-11-01',
}

const post: CirclePostItem = {
  id: 'post-1',
  title: '统一圈子模型',
  content: '广场和详情现在都以 group 为准',
  authorName: '张三',
  replyCount: 4,
  createdAt: '2026-11-20T10:00:00.000Z',
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CircleIndexScreen 圈子广场', () => {
  it('渲染 group 卡字段,并把整条 group 交给宿主', () => {
    const onPressItem = vi.fn()
    const { container } = render(
      <CircleIndexScreen
        t={t}
        title="circles.title"
        items={[group]}
        loading={false}
        refreshing={false}
        error=""
        onRefresh={vi.fn()}
        onPressItem={onPressItem}
        onCreatePost={vi.fn()}
        onBack={vi.fn()}
        colorScheme={testColorScheme}
      />,
    )

    expect(container.textContent).toContain('前端圈子')
    expect(container.textContent).toContain('12 circleDetail.members')
    expect(container.textContent).toContain('3 circleDetail.posts')
    expect(container.textContent).toContain('circle.index.followed')

    fireEvent.click(screen.getByLabelText('前端圈子'))
    expect(onPressItem).toHaveBeenCalledWith(group)
  })

  it('空列表走圈子空态,不发帖字段', () => {
    const { container } = render(
      <CircleIndexScreen
        t={t}
        title="circles.title"
        items={[]}
        loading={false}
        refreshing={false}
        error=""
        onRefresh={vi.fn()}
        onPressItem={vi.fn()}
        onCreatePost={vi.fn()}
        onBack={vi.fn()}
        colorScheme={testColorScheme}
      />,
    )

    expect(container.textContent).toContain('circle.empty')
    expect(container.textContent).not.toContain('post.title')
  })

  it('到底后页脚出“没有更多了”,但空列表不挂页脚', () => {
    const { container, rerender } = render(
      <CircleIndexScreen
        t={t}
        title="circles.title"
        items={[group]}
        loading={false}
        refreshing={false}
        error=""
        onRefresh={vi.fn()}
        onPressItem={vi.fn()}
        onCreatePost={vi.fn()}
        onBack={vi.fn()}
        colorScheme={testColorScheme}
        noMore
      />,
    )

    expect(container.textContent).toContain('common.noMore')

    rerender(
      <CircleIndexScreen
        t={t}
        title="circles.title"
        items={[]}
        loading={false}
        refreshing={false}
        error=""
        onRefresh={vi.fn()}
        onPressItem={vi.fn()}
        onCreatePost={vi.fn()}
        onBack={vi.fn()}
        colorScheme={testColorScheme}
        noMore
      />,
    )
    expect(container.textContent).not.toContain('common.noMore')
  })

  it('加载下一页时页脚优先显示加载态,不叠出“没有更多了”', () => {
    const { container } = render(
      <CircleIndexScreen
        t={t}
        title="circles.title"
        items={[group]}
        loading={false}
        refreshing={false}
        error=""
        onRefresh={vi.fn()}
        onPressItem={vi.fn()}
        onCreatePost={vi.fn()}
        onBack={vi.fn()}
        colorScheme={testColorScheme}
        loadingMore
        noMore
      />,
    )

    expect(container.textContent).toContain('circle.index.loading')
    expect(container.textContent).not.toContain('common.noMore')
  })
})

describe('CircleDetailScreen 圈子详情', () => {
  it('渲染 group 头与帖子列表,日期/回复数可见', () => {
    const { container } = render(
      <CircleDetailScreen
        t={t}
        item={detail}
        loading={false}
        error=""
        onJoin={vi.fn()}
        onLeave={vi.fn()}
        onPressPost={vi.fn()}
        onPressMembers={vi.fn()}
        onBack={vi.fn()}
        posts={[post]}
        postsLoading={false}
        postsError=""
        colorScheme={testColorScheme}
      />,
    )

    expect(container.textContent).toContain('前端圈子')
    expect(container.textContent).toContain('12 circleDetail.members')
    expect(container.textContent).toContain('3 circleDetail.posts')
    expect(container.textContent).toContain('统一圈子模型')
    expect(container.textContent).toContain('张三')
    expect(container.textContent).toContain('2026-11-20')
    expect(container.textContent).toContain('4')
  })

  it('帖子加载失败只报 postsError,不把 group 头打成错误态', () => {
    const { container } = render(
      <CircleDetailScreen
        t={t}
        item={detail}
        loading={false}
        error=""
        onJoin={vi.fn()}
        onLeave={vi.fn()}
        onPressPost={vi.fn()}
        onPressMembers={vi.fn()}
        onBack={vi.fn()}
        posts={[]}
        postsLoading={false}
        postsError="posts failed"
        colorScheme={testColorScheme}
      />,
    )

    expect(container.textContent).toContain('前端圈子')
    expect(container.textContent).toContain('posts failed')
  })

  it('未加入只出“加入”,点击把整条动作交给宿主', () => {
    const onJoin = vi.fn()
    const onLeave = vi.fn()
    render(
      <CircleDetailScreen
        t={t}
        item={{ ...detail, isJoined: false }}
        loading={false}
        error=""
        onJoin={onJoin}
        onLeave={onLeave}
        onPressPost={vi.fn()}
        onPressMembers={vi.fn()}
        onBack={vi.fn()}
        posts={[]}
        postsLoading={false}
        postsError=""
        colorScheme={testColorScheme}
      />,
    )

    expect(screen.queryByText('circleDetail.leave')).toBeNull()
    fireEvent.click(screen.getByText('circleDetail.join'))
    expect(onJoin).toHaveBeenCalledTimes(1)
    expect(onLeave).not.toHaveBeenCalled()
  })

  it('详情错误态保留返回键,重试按钮不再伪装成返回', () => {
    const onBack = vi.fn()
    const onRetry = vi.fn()
    render(
      <CircleDetailScreen
        t={t}
        item={null}
        loading={false}
        error="circleDetail.loadFailed"
        onJoin={vi.fn()}
        onLeave={vi.fn()}
        onPressPost={vi.fn()}
        onPressMembers={vi.fn()}
        onBack={onBack}
        onRetry={onRetry}
        posts={[]}
        postsLoading={false}
        postsError=""
        colorScheme={testColorScheme}
      />,
    )

    expect(screen.getByText('common.retry')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('common.back'))
    expect(onBack).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByText('common.retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('加载骨架也保留返回键,慢请求不会把页面锁死', () => {
    const onBack = vi.fn()
    render(
      <CircleDetailScreen
        t={t}
        item={null}
        loading
        error=""
        onJoin={vi.fn()}
        onLeave={vi.fn()}
        onPressPost={vi.fn()}
        onPressMembers={vi.fn()}
        onBack={onBack}
        posts={[]}
        postsLoading={false}
        postsError=""
        colorScheme={testColorScheme}
      />,
    )

    fireEvent.click(screen.getByLabelText('common.back'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('已加入出“成员/发帖/退出”,退出点击不误触加入', () => {
    const onJoin = vi.fn()
    const onLeave = vi.fn()
    render(
      <CircleDetailScreen
        t={t}
        item={detail}
        loading={false}
        error=""
        onJoin={onJoin}
        onLeave={onLeave}
        onPressPost={vi.fn()}
        onPressMembers={vi.fn()}
        onBack={vi.fn()}
        posts={[]}
        postsLoading={false}
        postsError=""
        colorScheme={testColorScheme}
      />,
    )

    expect(screen.queryByText('circleDetail.join')).toBeNull()
    fireEvent.click(screen.getByText('circleDetail.leave'))
    expect(onLeave).toHaveBeenCalledTimes(1)
    expect(onJoin).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
