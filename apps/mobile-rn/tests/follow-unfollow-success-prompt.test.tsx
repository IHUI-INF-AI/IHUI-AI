// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门 288/241 之外的另一格账:「用户提示」族的**成功回执**必须由宿主注入的端口发出。
 *
 * 立因(2026-11-05 现读):端内镜像页 apps/miniapp-taro/src/pkg-user/following/index.tsx:105
 * 取关成功后一直会提示 `common.success`(kind:'success'),而承载壳
 * apps/mobile-rn/src/screens/FollowScreen.tsx 的成功支只改本地列表、一句话不说。
 * 转壳后端内那份提示随页面一起消失 ⇒ 「壳在能力丢」(别席 452cc6558 回退第三批即此型)。
 * 本套件钉的是:提示这件事现在**住在共享源的宿主端口链路上**,且
 *   ① 成功才发(失败/取消一律不发 —— 这是"改成无条件即翻红"那一臂);
 *   ② 发的是通道真值(单源时长),不是端内自建 toast 态;
 *   ③ 取词真落词包(裸键回显当场翻红)。
 */
import { act, cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const sharedProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))
const alertSpy = vi.hoisted(() => vi.fn())
const unfollowSpy = vi.hoisted(() => vi.fn(async () => ({ success: true })))
const removeItemSpy = vi.hoisted(() => vi.fn())

vi.mock('../src/components/BottomPops', () => ({ appAlert: alertSpy }))
vi.mock('@ihui/rn-app', () => ({
  FollowScreen: (p: Record<string, unknown>) => {
    sharedProps.current = p
    return createElement('div')
  },
}))
vi.mock('../src/api/social', () => ({ unfollowUser: unfollowSpy }))
vi.mock('@ihui/api-client', () => ({
  getFollowing: vi.fn(async () => ({ success: true, data: { list: [], total: 0 } })),
  getFans: vi.fn(async () => ({ success: true, data: { list: [], total: 0 } })),
}))
vi.mock('../src/hooks', () => ({
  usePaginatedList: () => ({
    items: [],
    loading: false,
    refreshing: false,
    loadingMore: false,
    error: '',
    refresh: vi.fn(),
    loadMore: vi.fn(),
    removeItem: removeItemSpy,
  }),
  useRefreshOnFocus: () => undefined,
}))
vi.mock('../src/context/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: vi.fn(),
    replace: vi.fn(),
    goBack: vi.fn(),
    getState: () => ({ routeNames: [], index: 0, route: 'Follow', params: {} }),
  }),
  useRoute: () => ({ params: {} }),
}))
// 取词走真词包(shared ⊕ mobile-rn 深合并,与 apps/mobile-rn/src/i18n/index.tsx 同口径):
// 桩掉 useI18n 只砍掉 Provider/存储,不砍掉取值实现 —— 否则测的是替身。
vi.mock('../src/i18n', async () => {
  const { mergeMessages, translate } = await import('@ihui/i18n/loader')
  const sharedPack = (await import('@ihui/i18n/messages/shared/zh-CN.json')).default
  const rnPack = (await import('@ihui/i18n/messages/mobile-rn/zh-CN.json')).default
  const messages = mergeMessages(
    sharedPack as Parameters<typeof mergeMessages>[0],
    rnPack as Parameters<typeof mergeMessages>[1],
  )
  return {
    useI18n: () => ({
      locale: 'zh-CN',
      t: (key: string, params?: Record<string, string | number>) =>
        translate(messages, key, params ? { params } : undefined),
    }),
  }
})

import { HOST_TOAST_DEFAULT_DURATION_MS, subscribeHostToast } from '@ihui/shared/utils/host-toast'
import { FollowScreen } from '../src/screens/FollowScreen'

type Emitted = { message: string; kind: string; duration?: number }

const ITEM = { id: 'u-1', nickname: '张三' } as never

function captureChannel() {
  const emitted: Emitted[] = []
  const unsubscribe = subscribeHostToast((message, kind, duration) => {
    emitted.push({ message, kind, duration })
  })
  return { emitted, unsubscribe }
}

/** 从 appAlert 的第一枚确认层里取 destructive 按钮的 onPress(即"真的点取消关注")。 */
function destructivePress() {
  const call = alertSpy.mock.calls.find(
    (args) =>
      Array.isArray(args[2]) &&
      (args[2] as { style?: string }[]).some((b) => b?.style === 'destructive'),
  )
  if (!call) throw new Error('未出现取关确认层(appAlert 未被调用或没有 destructive 按钮)')
  return (call[2] as { style?: string; onPress?: () => Promise<void> | void }[]).find(
    (b) => b?.style === 'destructive',
  )!.onPress!
}

describe('Follow 壳:取关成功回执走宿主端口', () => {
  beforeEach(() => {
    cleanup()
    sharedProps.current = null
    alertSpy.mockClear()
    removeItemSpy.mockClear()
    unfollowSpy.mockReset()
    unfollowSpy.mockResolvedValue({ success: true } as never)
  })

  it('壳把 onToast 端口注入共享屏(端侧决定怎么弹的那条链路在位)', () => {
    render(createElement(FollowScreen))
    expect(typeof sharedProps.current?.onToast).toBe('function')
    expect(typeof sharedProps.current?.onUnfollow).toBe('function')
  })

  it('成功 → 通道收到一条 kind=success 的回执,时长取单源,文案是真词包不是裸键', async () => {
    const { emitted, unsubscribe } = captureChannel()
    try {
      render(createElement(FollowScreen))
      await act(async () => {
        ;(sharedProps.current!.onUnfollow as (i: unknown) => void)(ITEM)
        await destructivePress()()
      })
      expect(removeItemSpy).toHaveBeenCalledTimes(1)
      expect(emitted).toHaveLength(1)
      expect(emitted[0]!.kind).toBe('success')
      expect(emitted[0]!.duration).toBe(HOST_TOAST_DEFAULT_DURATION_MS)
      expect(emitted[0]!.message).toBe('成功')
      expect(emitted[0]!.message).not.toBe('common.success')
    } finally {
      unsubscribe()
    }
  })

  /** 反臂:把成功提示改成无条件/失败也发 ⇒ 这一条当场翻红。 */
  it('失败 → 一条轻提示都不发,只走 appAlert(回执不得替失败说话)', async () => {
    unfollowSpy.mockResolvedValue({ success: false, error: '服务端拒绝' } as never)
    const { emitted, unsubscribe } = captureChannel()
    try {
      render(createElement(FollowScreen))
      await act(async () => {
        ;(sharedProps.current!.onUnfollow as (i: unknown) => void)(ITEM)
        await destructivePress()()
      })
      expect(removeItemSpy).not.toHaveBeenCalled()
      expect(emitted).toEqual([])
      const last = alertSpy.mock.calls.at(-1)
      expect(last?.[1]).toBe('服务端拒绝')
    } finally {
      unsubscribe()
    }
  })

  it('取消那一支(非 destructive)不产生任何回执', async () => {
    const { emitted, unsubscribe } = captureChannel()
    try {
      render(createElement(FollowScreen))
      await act(async () => {
        ;(sharedProps.current!.onUnfollow as (i: unknown) => void)(ITEM)
        const call = alertSpy.mock.calls[0]
        const cancel = (call![2] as { style?: string; onPress?: () => void }[]).find(
          (b) => b?.style === 'cancel',
        )
        cancel?.onPress?.()
      })
      expect(unfollowSpy).not.toHaveBeenCalled()
      expect(emitted).toEqual([])
    } finally {
      unsubscribe()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
