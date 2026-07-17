import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AgentRuntimePanel } from '../src/components/AgentRuntimePanel'

vi.mock('@ihui/api-client', () => ({
  executeAgentRuntimeStream: vi.fn(async () => {}),
}))

describe('AgentRuntimePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders header, placeholder and disabled execute button on mount', () => {
    render(<AgentRuntimePanel />)
    expect(screen.getByText('Agent Runtime')).toBeTruthy()
    expect(screen.getByText('输入任务,开始 Agent 执行')).toBeTruthy()
    const exec = screen.getByRole('button', { name: '执行' })
    expect(exec).toBeTruthy()
    expect((exec as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables execute button after typing a message', () => {
    render(<AgentRuntimePanel />)
    const textarea = screen.getByPlaceholderText('输入任务...') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '帮我查询订单' } })
    const exec = screen.getByRole('button', { name: '执行' })
    expect((exec as HTMLButtonElement).disabled).toBe(false)
  })

  it('clear button resets input and placeholder', () => {
    render(<AgentRuntimePanel />)
    const textarea = screen.getByPlaceholderText('输入任务...') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: '清空' }))
    expect((screen.getByPlaceholderText('输入任务...') as HTMLTextAreaElement).value).toBe('')
    expect(screen.getByText('输入任务,开始 Agent 执行')).toBeTruthy()
  })

  it('invokes executeAgentRuntimeStream when execute clicked', async () => {
    const { executeAgentRuntimeStream } = await import('@ihui/api-client')
    render(<AgentRuntimePanel />)
    const textarea = screen.getByPlaceholderText('输入任务...') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'run task' } })
    fireEvent.click(screen.getByRole('button', { name: '执行' }))
    expect(executeAgentRuntimeStream).toHaveBeenCalledTimes(1)
    const callArgs = (executeAgentRuntimeStream as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]
    expect(callArgs[0]).toMatchObject({ message: 'run task', mode: 'default' })
  })
})
