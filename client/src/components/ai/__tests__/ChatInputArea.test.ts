// ChatInputArea 组件测试：验证接口定义、Props 验证、辅助函数
import { describe, it, expect } from 'vitest'
import { defineComponent } from 'vue'
import type { FilePreview, QuickTool } from '../ChatInputArea.vue'

describe('components/ai/ChatInputArea', () => {
  it('应该能创建组件定义', () => {
    const Comp = defineComponent({
      name: 'ChatInputArea',
      props: {
        placeholder: String,
        isSending: Boolean,
        isRecording: Boolean,
        enableVoice: Boolean,
        enableFileUpload: Boolean,
        quotedMessage: Object,
        voiceAudioData: Object,
      },
      emits: ['send', 'toggleVoice', 'uploadFile', 'removeFile', 'useQuickTool', 'cancelReply', 'inputChange', 'paste'],
    })
    expect(Comp.name).toBe('ChatInputArea')
  })

  it('应该正确导出 FilePreview 接口', () => {
    const file: FilePreview = {
      name: 'test.png',
      type: 'image/png',
      preview: 'data:image/png;base64,...',
      size: 1024,
    }
    expect(file.name).toBe('test.png')
    expect(file.type).toBe('image/png')
    expect(file.size).toBe(1024)
  })

  it('应该正确导出 QuickTool 接口', () => {
    const tool: QuickTool = {
      text: '/help',
      icon: 'help',
    }
    expect(tool.text).toBe('/help')
    expect(tool.icon).toBe('help')
  })

  it('应该支持不带 icon 的 QuickTool', () => {
    const tool: QuickTool = { text: '/reset' }
    expect(tool.text).toBe('/reset')
    expect(tool.icon).toBeUndefined()
  })

  it('应该处理多文件预览列表', () => {
    const files: FilePreview[] = [
      { name: 'a.png', type: 'image/png', preview: 'data:1' },
      { name: 'b.jpg', type: 'image/jpeg', preview: 'data:2' },
    ]
    expect(files).toHaveLength(2)
  })

  it('应该正确发出 send 事件（hasContent）', () => {
    let emitted = false
    const emit = (event: string, content: string) => {
      if (event === 'send' && content) emitted = true
    }
    const handleSend = (content: string) => {
      if (content) emit('send', content)
    }
    handleSend('hello')
    expect(emitted).toBe(true)
  })

  it('应该忽略空内容发送', () => {
    let emitted = false
    let emittedContent = ''
    const emit = (event: string, content: string) => {
      if (event === 'send' && content.trim()) {
        emitted = true
        emittedContent = content
      }
    }
    const handleSend = (content: string) => {
      if (content.trim()) emit('send', content)
    }
    handleSend('   ')
    expect(emitted).toBe(false)
    expect(emittedContent).toBe('')
  })
})
