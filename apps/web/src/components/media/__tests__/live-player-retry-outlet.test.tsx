// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// G-856 ③「LivePlayer:+attempt 重试出口」的兑现证明(2026-10-07 补)。
// 立因:那一枚提交把 `const [attempt, setAttempt] = useState(0)`、effect 依赖里的 `attempt`
// 和注释里的承诺一起入库了,却**没有写下调用 setAttempt 的那个出口** —— 于是
// `apps/web` 的 tsc(noUnusedLocals)报 TS6133 打死 `@ihui/web#build`,required 检查
// 「CI / lint-typecheck-test (push)」与 Build Docker 的 build-web 同因连红。
// 本文件把"失败终态里真的摆着出口、点了真的重走释放+重挂"钉成断言:出口再被人摘掉时
// 这里必红,而不是等到构建阶段才发现"状态没人写"。
//
// 触发形态是量出来的,不是随手挑的:非 HLS/FLV 分支要靠 `video.onerror` 进失败态,而本环境
// 实测两条都不通 —— dispatchEvent(new Event('error')) 不调用赋上去的 handler(jsdom 未把
// HTMLMediaElement.onerror 注册成事件处理器),在 act 外直接调 handler 也不重渲染。FLV 分支
// 则在 effect 内同步 setError,渲染由 render 自带的 act 驱动,是唯一无环境依赖的入口。
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, fireEvent, cleanup } from '@testing-library/react'

// 取词 stub 必须**恒等且同一实例**:media-release.test.tsx 那套 `useTranslations: () => (key) => key`
// 每次渲染都返回新函数,而组件的 attachHls 把 `t` 放进了 useCallback 依赖 ⇒ 每次重渲染都让
// effect 重跑一次。后果是"只把文案藏起来"的假出口也会顺带重走链路而蒙过断言(变异自证 B 实测:
// onClick 改成 setError(null) 后三条用例仍全绿)。用 vi.hoisted 保证工厂在 import 期就能拿到它。
const { translate } = vi.hoisted(() => ({
  translate: (key: string, _vars?: Record<string, unknown>) => key,
}))
vi.mock('next-intl', () => ({
  useTranslations: () => translate,
}))

import { LivePlayer } from '../LivePlayer'

// FLV 分支:attachHls 内同步 setError(t('flvUnsupported')) + setLoading(false),不经网络、不经异步 import
const SRC = 'https://example.com/live.flv'

function enterErrorState(view: ReturnType<typeof render>) {
  const video = view.container.querySelector('video') as HTMLVideoElement
  expect(video).toBeTruthy()
  expect(view.getByText('flvUnsupported')).toBeTruthy()
  return video
}

describe('G-856 ③ LivePlayer 失败终态的重试出口', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('失败终态摆出重试出口,且点击真的重走"释放 + 重挂"(不是只把文案藏起来)', () => {
    const view = render(<LivePlayer src={SRC} />)
    const video = enterErrorState(view)
    // jsdom 未实现 HTMLMediaElement.load(只往虚拟控制台打 "Not implemented"),
    // 装上 spy 既消噪音,又让"重走链路"可量:releaseMediaElement 必然调用 el.load()
    const loadSpy = vi.spyOn(video, 'load').mockImplementation(() => {})

    // 出口在失败态里存在(上一行已经证明失败态成立)
    const retry = view.getByLabelText('previewRetryAction')

    const loadsBefore = loadSpy.mock.calls.length
    fireEvent.click(retry)

    // attempt 换了 ⇒ effect 重跑 ⇒ cleanup(node) 走 releaseMediaElement ⇒ load() 被再调用
    expect(loadSpy.mock.calls.length).toBeGreaterThan(loadsBefore)
    // 重跑之后仍是**可解释的终态**(不是白屏、也不是永久 loading):再次摆出文案与出口
    expect(view.getByText('flvUnsupported')).toBeTruthy()
    expect(view.getByLabelText('previewRetryAction')).toBeTruthy()
    // FLV 分支在 setError 之前就 return,从不把源挂上元素 —— 摘线时这一条会跟着变绿,
    // 所以它不能单独当判据,只作"链路真的从头再走一遍"的旁证
    expect(video.getAttribute('src')).toBeNull()

    loadSpy.mockRestore()
  })

  it('重试出口取的是 a11y 既有键 previewRetryAction(五语言已在位,不新增文案)', () => {
    const view = render(<LivePlayer src={SRC} />)
    enterErrorState(view)
    const retry = view.getByLabelText('previewRetryAction')
    // 可见文案与无障碍名同源同一个键:断言文本而非仅存在,防止"有按钮但喂了别的键"
    expect(retry.textContent).toBe('previewRetryAction')
  })

  it('没有失败时不摆出口(证明上一条的"出现"不是恒真)', () => {
    // active=false ⇒ effect 只做 cleanup、不调 attachHls ⇒ 永远不进失败态
    const view = render(<LivePlayer src={SRC} active={false} />)
    expect(view.queryByText('flvUnsupported')).toBeNull()
    expect(view.queryByLabelText('previewRetryAction')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
