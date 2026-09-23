// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D56 额度与权益元素族 · FallbackBanner 续跑询问用例(2026-09-23 立,英文过渡):
// 覆盖 ①额度恢复后"是否继续刚才中断的任务?"续跑询问 + 心智边界(免费仍可用,不暗示充值)。
// 断言与组件英文过渡串保持一致,词表释放后换中文键时同步改回中文断言(见 D56 键清单)。

import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { FallbackBanner } from '@/components/chat/message-list/FallbackBanner'
import type { FallbackEvent } from '@ihui/api-client'

function makeT(): (key: string, values?: Record<string, string | number | Date>) => string {
  return (key: string): string => key
}

function notice(): FallbackEvent {
  return { primaryModel: 'gpt-a', backupModel: 'gpt-b', reason: 'timeout' }
}

afterEach(() => {
  cleanup()
})

const FORBIDDEN_RECHARGE_WORDS: string[] = ['充值', '购买', '付费', '升级']

describe('FallbackBanner D56① 续跑询问', () => {
  it('额度恢复后出现续跑询问,确认/稍后回调各自触发', () => {
    const onResume = vi.fn()
    const onDismiss = vi.fn()
    render(
      <FallbackBanner
        fallbackNotice={notice()}
        t={makeT()}
        resumePrompt={{ visible: true, taskLabel: '刚才中断的长任务' }}
        onResumeInterrupted={onResume}
        onDismissResume={onDismiss}
      />,
    )
    const prompt = screen.getByTestId('fallback-resume-prompt')
    expect(prompt.textContent).toContain('Quota restored')
    expect(prompt.textContent).toContain('resume the interrupted task')
    expect(prompt.textContent).toContain('刚才中断的长任务')
    fireEvent.click(screen.getByTestId('fallback-resume-confirm'))
    expect(onResume).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('fallback-resume-dismiss'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('缺省不传 resumePrompt → 无续跑询问(旧横幅形态不变)', () => {
    render(<FallbackBanner fallbackNotice={notice()} t={makeT()} />)
    expect(screen.queryByTestId('fallback-resume-prompt')).toBeNull()
    expect(document.body.textContent).toContain('fallbackNotice')
  })

  it('心智边界:续跑区明示免费仍可用,且全树不暗示充值', () => {
    render(
      <FallbackBanner fallbackNotice={notice()} t={makeT()} resumePrompt={{ visible: true }} />,
    )
    const hint = screen.getByTestId('fallback-resume-free-hint')
    expect(hint.textContent).toContain('Free quota remains available')
    const all = document.body.textContent ?? ''
    for (const w of FORBIDDEN_RECHARGE_WORDS) {
      expect(all).not.toContain(w)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
