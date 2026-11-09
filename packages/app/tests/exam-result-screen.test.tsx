// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ExamResultScreen 的「真消费」锁。
 *
 * 钉四件事:
 *  ① 底部两操作真走注入的 onNavigate(死契约修复:声明 + 实际调用点都在);
 *  ② 分享是宿主注入节点(同一注入点,两端只差实现体);
 *  ③ examId 缺失时再考一次回落 onBack,不造无效调用;
 *  ④ 错误态 retryLabel 用 common.retry,且无 onRetry 时不渲染假按钮。
 *
 * 阴性对照:「摘掉 onNavigate」→ 端口闸在 dev 直接 throw,测试必红。
 */
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'

vi.mock('react-native', () => {
  const el = (tag: string) => (p: Record<string, unknown>) => {
    const { style: _style, children, onPress, ...rest } = p
    const dom: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(rest)) {
      if (k.startsWith('accessibility') || k.startsWith('data-') || k === 'testID') {
        dom[k === 'testID' ? 'data-testid' : k] = v as never
      }
    }
    if (typeof onPress === 'function') dom.onClick = onPress
    return createElement(tag, dom, children as never)
  }
  return {
    View: el('div'),
    Text: el('span'),
    ScrollView: el('div'),
    Pressable: el('button'),
    StyleSheet: { create: <T,>(s: T) => s, flatten: (s: unknown) => s },
    PixelRatio: {
      get: () => 2,
      getFontScale: () => 2,
      getPixelSizeForLayoutSize: (n: number) => n,
      roundToNearestPixel: (n: number) => n,
    },
    Dimensions: { get: () => ({ width: 390, height: 844 }) },
    Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default },
  }
})

vi.mock('../src/components/BackChevron', () => ({
  BackChevron: ({ onPress }: { onPress?: () => void }) =>
    createElement('button', { onClick: onPress, 'data-back': '' }, 'back'),
}))

vi.mock('../src/components/ScreenStates', () => ({
  ScreenSkeleton: () => createElement('div', { 'data-test': 'skeleton' }),
  ErrorState: ({
    message,
    onRetry,
    retryLabel,
  }: {
    message: string
    onRetry?: () => void
    retryLabel?: string
  }) =>
    createElement(
      'div',
      null,
      createElement('span', null, message),
      onRetry ? createElement('button', { onClick: onRetry }, retryLabel ?? '') : null,
    ),
}))

vi.mock('@ihui/shared/share', () => ({ usePublishShareIntent: () => undefined }))

import { ExamResultScreen } from '../src/features/exam-result/ExamResultScreen'
import type { ExamResultItem, TFunction } from '../src/types'

/** 词表桩:键 + 插值原样带出,断言能看见用了哪个键、传了什么值 */
const t: TFunction = (key, options) => {
  const parts = Object.entries(options ?? {}).map(([k, v]) => `${k}=${String(v)}`)
  return parts.length > 0 ? `${key}#${parts.join(',')}` : key
}

const item: ExamResultItem = {
  id: 'rec-1',
  examId: 'exam-1',
  score: 88,
  totalScore: 100,
  passed: true,
  correctCount: 3,
  wrongCount: 2,
  unansweredCount: 1,
  totalCount: 6,
  duration: 45,
  submittedAt: '2026-11-01 10:00',
  rank: 3,
  rankTotal: 20,
  details: [
    {
      id: 'q1',
      title: '题一(答对)',
      yourAnswer: ['A', 'B'],
      correctAnswer: ['A', 'B'],
      isCorrect: true,
      score: 10,
      analysis: '题一解析',
    },
  ],
}

const baseProps = {
  t,
  item,
  loading: false,
  error: '',
  onBack: vi.fn(),
  onRetry: vi.fn(),
  colorScheme: 'light' as const,
  onNavigate: vi.fn(),
}

describe('ExamResultScreen(共享屏)', () => {
  afterEach(() => cleanup())

  it('① 底部两操作真消费 onNavigate;分享点注入节点;返回走 onBack', () => {
    const onNavigate = vi.fn()
    const onBack = vi.fn()
    const onShare = vi.fn()
    const shareAction = createElement('button', { onClick: onShare }, 'share')

    const { container } = render(
      createElement(ExamResultScreen, { ...baseProps, onNavigate, onBack, shareAction }),
    )
    const buttons = container.querySelectorAll('button')

    fireEvent.click(buttons[0]!)
    expect(onBack).toHaveBeenCalledTimes(1)

    fireEvent.click(buttons[1]!)
    expect(onNavigate).toHaveBeenNthCalledWith(1, 'ExamQuestion', { examId: 'exam-1' })

    fireEvent.click(buttons[2]!)
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'Exam')

    fireEvent.click(buttons[3]!)
    expect(onShare).toHaveBeenCalledTimes(1)
  })

  it('② examId 缺失:再考一次回落 onBack,不调端口', () => {
    const onNavigate = vi.fn()
    const onBack = vi.fn()
    render(
      createElement(ExamResultScreen, {
        ...baseProps,
        item: { ...item, examId: undefined },
        onNavigate,
        onBack,
      }),
    )
    const retry = document.querySelectorAll('button')[1]!
    fireEvent.click(retry)
    expect(onNavigate).not.toHaveBeenCalled()
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('③ 数据面:details 全量回顾 + rank,缺 examTitle/submittedAt 时不渲染空占位', () => {
    const { container } = render(
      createElement(ExamResultScreen, {
        ...baseProps,
        item: { ...item, examTitle: undefined, submittedAt: undefined },
      }),
    )
    const text = container.textContent ?? ''
    expect(text).toContain('examResult.rank#rank=3,total=20')
    expect(text).toContain('题一(答对)')
    expect(text).toContain('examResult.statCorrect')
    expect(text).not.toContain('undefined')
  })

  it('④ 错误态:retryLabel 用 common.retry,无 onRetry 时不造假按钮', () => {
    const onRetry = vi.fn()
    const { container } = render(
      createElement(ExamResultScreen, { ...baseProps, item: null, error: 'boom', onRetry }),
    )
    const text = container.textContent ?? ''
    expect(text).toContain('boom')
    expect(text).toContain('common.retry')
    fireEvent.click(container.querySelectorAll('button')[1]!)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('⑤ 阴性对照:摘掉 onNavigate ⇒ 端口闸当场 throw(测试必红)', () => {
    expect(() =>
      render(createElement(ExamResultScreen, { ...baseProps, onNavigate: undefined as never })),
    ).toThrow('[host-port] missing onNavigate')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
