// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 2026-09-28 V3 #65 前端腿 —— AgentResultFooter 的「停止 / 暂停 / 继续」分岔渲染级用例。
//
// 钉的是票面那条硬性要求:**运行中与已暂停两态必须可分辨**,且"已暂停"只能由
// 后端确认态驱动(props 传进来),组件不得自己把"点过暂停"读成"已经停了"。
// 刻意不断言 i18n 键在五语言里都存在(那批键由主会话单写语言包,见交付报告清单)——
// 参照 business-form-card 测试的"缺席降级不误伤"取向,这里只量结构与档位。

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AgentResultFooter } from '../agent-pane/AgentResultFooter'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values && 'message' in values ? `${key}:${String(values.message)}` : key,
}))

const baseProps = {
  error: null,
  result: '',
  isRunning: false,
  taskId: 'task-1',
  onStop: () => undefined,
  onClear: () => undefined,
}

const query = (container: HTMLElement, testId: string) =>
  container.querySelector(`[data-testid="${testId}"]`)

describe('V3 #65 / AgentResultFooter 暂停-继续分岔', () => {
  it('运行中且已拿到 session_id ⇒ 出现「暂停」且可用,同时仍在「运行中」档位', () => {
    const { container } = render(
      <AgentResultFooter
        {...baseProps}
        isRunning
        pauseAvailable
        onPause={() => undefined}
        onClear={() => undefined}
      />,
    )
    const pause = query(container, 'agent-pane-pause-btn')
    expect(pause).not.toBeNull()
    expect(pause?.getAttribute('disabled')).toBeNull()
    expect(query(container, 'agent-pane-resume-btn')).toBeNull()
    expect(query(container, 'agent-pane-phase')?.getAttribute('data-phase')).toBe('running')
  })

  it('后端确认已暂停 ⇒ 「继续」出现、「暂停」不再出现,档位文字换成 paused(两态不同形)', () => {
    const { container } = render(
      <AgentResultFooter
        {...baseProps}
        isRunning
        isPaused
        pauseAvailable
        onPause={() => undefined}
        onResume={() => undefined}
      />,
    )
    expect(query(container, 'agent-pane-resume-btn')).not.toBeNull()
    expect(query(container, 'agent-pane-pause-btn')).toBeNull()
    expect(query(container, 'agent-pane-phase')?.getAttribute('data-phase')).toBe('paused')
  })

  it('还没拿到 session_id ⇒ 「暂停」在位但不可用(不把"还不知道能不能寻址"演成"可以暂停")', () => {
    const { container } = render(<AgentResultFooter {...baseProps} isRunning onPause={() => undefined} />)
    const pause = query(container, 'agent-pane-pause-btn')
    expect(pause).not.toBeNull()
    expect(pause?.getAttribute('disabled')).not.toBeNull()
  })

  it('请求在途 ⇒ 两个控制钮都不可点,且 aria-busy 落在被点的那一个上', () => {
    const { container } = render(
      <AgentResultFooter
        {...baseProps}
        isRunning
        isPaused
        pauseAvailable
        pending="resume"
        onResume={() => undefined}
      />,
    )
    const resume = query(container, 'agent-pane-resume-btn')
    expect(resume?.getAttribute('disabled')).not.toBeNull()
    expect(resume?.getAttribute('aria-busy')).toBe('true')
  })

  it('暂停/继续失败单独成行,并带后端给的状态码与 errorCode(不得折进"运行失败"那一格)', () => {
    const { container } = render(
      <AgentResultFooter
        {...baseProps}
        isRunning
        pauseAvailable
        error="运行本身失败"
        controlFailure={{
          action: 'pause',
          status: 409,
          errorCode: 'AGENT_PAUSE_NOT_RUNNING',
          message: '该会话当前不在运行',
        }}
      />,
    )
    const control = query(container, 'agent-pane-control-error')
    expect(control).not.toBeNull()
    expect(control?.getAttribute('data-action')).toBe('pause')
    expect(control?.getAttribute('data-status')).toBe('409')
    expect(control?.getAttribute('data-error-code')).toBe('AGENT_PAUSE_NOT_RUNNING')
    expect(control?.textContent).toContain('该会话当前不在运行')
    // 两条错误同时在位 ⇒ 各自一行,互不覆盖
    expect(query(container, 'agent-pane-error')?.textContent).toContain('运行本身失败')
  })

  it('非运行非暂停(既没 session 也没在跑)⇒ 不出现任何档位徽章', () => {
    const { container } = render(<AgentResultFooter {...baseProps} />)
    expect(query(container, 'agent-pane-phase')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
