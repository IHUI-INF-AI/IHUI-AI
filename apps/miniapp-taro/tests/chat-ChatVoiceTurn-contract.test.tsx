// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 块 6 ChatVoiceTurn 契约测试。
 *
 * 正例：phase 决定波形 / 计时 / 转写区显隐，error 显示错误文案与重试；
 * 阴性对照：无交互时回调 0 次；源码不含录音 / 播报 / 手势等平台 API。
 */
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 共享层按 packages/app 的 React 19 产出元素；测试改用同一实例渲染，避免 18/19 混栈。
// @ts-expect-error 深度路径无类型声明:必须与上方 mock 的 React 19 单实例同源
vi.mock('react', async () => import('../../../packages/app/node_modules/react'))

import { createElement } from 'react'
// @ts-expect-error 深度路径无类型声明:必须与上方 mock 的 React 19 单实例同源
import { renderToStaticMarkup } from '../../../packages/app/node_modules/react-dom/server'

import {
  ChatVoicePanel,
  ChatVoiceTurn,
} from '../../../packages/app/src/features/chat/ChatVoiceTurn'

const ZH: Record<string, string> = {
  'chat.thinking': '思考中',
  'chat.voice': '语音',
  'chat.menuToVoice': '转语音',
  'voice.holdToTalk': '按住说话',
  'common.cancel': '取消',
  'common.retry': '重试',
  'common.close': '关闭',
  'common.confirm': '确认',
  'common.error': '出错了',
}

const t = (key: string, options?: Record<string, string | number>): string => {
  const text = ZH[key] ?? key
  return options ? `${text}(${JSON.stringify(options)})` : text
}

const SOURCE = resolve(__dirname, '../../../packages/app/src/features/chat/ChatVoiceTurn.tsx')
const src = readFileSync(SOURCE, 'utf8')

describe('ChatVoiceTurn 正例：各 phase 显隐', () => {
  it('listening：显示波形与 m:ss 计时、转写区', () => {
    const html = renderToStaticMarkup(
      createElement(ChatVoiceTurn, {
        t,
        phase: 'listening',
        elapsedMs: 65000,
        level: 0.6,
        transcript: '打开设置',
        onPressIn: vi.fn(),
        onPressOut: vi.fn(),
        onCancel: vi.fn(),
      }),
    )
    expect(html).toContain('1:05')
    expect(html).toContain('打开设置')
    expect(html).toContain('按住说话')
    expect(html).toContain('取消')
  })

  it('processing：显示思考中且转写区保留，源码里按住入口被禁用', () => {
    const html = renderToStaticMarkup(
      createElement(ChatVoiceTurn, {
        t,
        phase: 'processing',
        transcript: '打开设置',
        onPressIn: vi.fn(),
        onPressOut: vi.fn(),
      }),
    )
    expect(html.match(/思考中/g) ?? []).toHaveLength(2)
    expect(html).toContain('打开设置')
    expect(html).not.toContain('1:05')
    expect(src).toContain("const busy = phase === 'processing' || phase === 'speaking'")
    expect(src).toContain('disabled={disabled || busy}')
  })

  it('idle：波形、计时、转写区都不出现', () => {
    const html = renderToStaticMarkup(
      createElement(ChatVoiceTurn, {
        t,
        phase: 'idle',
        elapsedMs: 1000,
        transcript: '打开设置',
        onPressIn: vi.fn(),
        onPressOut: vi.fn(),
      }),
    )
    expect(html).not.toContain('打开设置')
    expect(html).not.toContain('0:01')
    expect(html).toContain('按住说话')
  })

  it('error：显示 errorMessage 与重试入口', () => {
    const html = renderToStaticMarkup(
      createElement(ChatVoiceTurn, {
        t,
        phase: 'error',
        errorMessage: '网络中断',
        onPressIn: vi.fn(),
        onPressOut: vi.fn(),
        onRetry: vi.fn(),
      }),
    )
    expect(html).toContain('网络中断')
    expect(html).toContain('重试')
  })
})

describe('ChatVoicePanel 正例：音色选项与确认', () => {
  it('open=true 展示标题、音色顺序、确认与取消', () => {
    const html = renderToStaticMarkup(
      createElement(ChatVoicePanel, {
        t,
        open: true,
        tones: [
          { key: 'male', label: '男声' },
          { key: 'female', label: '女声' },
        ],
        activeTone: 'female',
        onToneChange: vi.fn(),
        onConfirm: vi.fn(),
        onClose: vi.fn(),
      }),
    )
    expect(html).toContain('转语音')
    expect(html.indexOf('男声')).toBeLessThan(html.indexOf('女声'))
    expect(html).toContain('确认')
    expect(html).toContain('取消')
  })

  it('open=false 整体不渲染', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    const html = renderToStaticMarkup(
      createElement(ChatVoicePanel, { t, open: false, onConfirm, onClose }),
    )
    expect(html).toBe('')
    expect(onConfirm).toHaveBeenCalledTimes(0)
    expect(onClose).toHaveBeenCalledTimes(0)
  })
})

describe('ChatVoiceTurn 阴性对照', () => {
  it('渲染本身不触发按住开始/松开', () => {
    const onPressIn = vi.fn()
    const onPressOut = vi.fn()
    renderToStaticMarkup(
      createElement(ChatVoiceTurn, {
        t,
        phase: 'idle',
        onPressIn,
        onPressOut,
        onClose: vi.fn(),
      }),
    )
    expect(onPressIn).toHaveBeenCalledTimes(0)
    expect(onPressOut).toHaveBeenCalledTimes(0)
  })

  it('源码零平台 API：不含录音 / 播报 / 路由 / 存储 / 手势', () => {
    expect(src).not.toMatch(/Taro|fetch\(|axios|localStorage|Alert\.|react-navigation/)
    expect(src).not.toMatch(/Animated|Dimensions|PanResponder|Keyboard|Linking/)
    expect(src).not.toMatch(/from 'apps\//)
    expect(src).not.toMatch(/lucide-react-native/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
