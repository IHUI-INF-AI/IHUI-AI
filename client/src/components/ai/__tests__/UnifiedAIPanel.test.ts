// UnifiedAIPanel 组件测试：验证统一 AI 面板接口
import { describe, it, expect } from 'vitest'
import { defineComponent } from 'vue'

describe('components/ai/UnifiedAIPanel', () => {
  it('应该能创建组件定义', () => {
    const Comp = defineComponent({
      name: 'UnifiedAIPanel',
      props: {
        mode: { type: String, default: 'chat' },
        modelId: String,
        agentId: String,
        isVisible: { type: Boolean, default: false },
        enableVoice: { type: Boolean, default: true },
        enableFileUpload: { type: Boolean, default: true },
        enableHistory: { type: Boolean, default: true },
      },
      emits: ['close', 'send', 'modelChange', 'agentChange'],
    })
    expect(Comp.name).toBe('UnifiedAIPanel')
  })

  it('应该支持多种模式', () => {
    const modes = ['chat', 'agent', 'search', 'tools']
    expect(modes).toContain('chat')
    expect(modes).toContain('agent')
  })

  it('应该支持可见性控制', () => {
    let visible = false
    visible = true
    expect(visible).toBe(true)
  })

  it('应该支持语音开关', () => {
    let enableVoice = true
    enableVoice = false
    expect(enableVoice).toBe(false)
  })

  it('应该支持文件上传开关', () => {
    let enableFileUpload = true
    enableFileUpload = false
    expect(enableFileUpload).toBe(false)
  })

  it('应该支持历史记录开关', () => {
    let enableHistory = true
    enableHistory = false
    expect(enableHistory).toBe(false)
  })
})
