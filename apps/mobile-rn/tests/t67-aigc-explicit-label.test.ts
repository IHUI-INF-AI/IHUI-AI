// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// AI 生成内容显式标识(应用商店合规项):RN 主聊天页每条 AI 回复必须带可见标注。
//
// 判据:
// 1. 文案/字号/行高只有一个真相源(@ihui/shared/chat 的 AI_GENERATED_LABEL),
//    RN 与小程序共享屏都引用同一常量,不得各写一套;
// 2. RN 标注位于气泡正文之下、操作按钮之上(不压内容、不挡按钮);
// 3. 只给 AI 回复,用户消息与失败轮不标(失败轮没有产出内容);
// 4. 共享五语言词包真的存在该键,且中文值非空。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const HERE = process.cwd()

const MESSAGE_LIST = readFileSync(resolve(HERE, 'src/components/chat/ChatMessageList.tsx'), 'utf8')
const SHARED_MESSAGE_ITEM = readFileSync(
  resolve(HERE, '../../packages/app/src/features/chat/ChatMessageItem.tsx'),
  'utf8',
)
const SHARED_CONSTANT = readFileSync(
  resolve(HERE, '../../packages/shared/src/chat/aigc-label.ts'),
  'utf8',
)
const SHARED_ZH = JSON.parse(
  readFileSync(resolve(HERE, '../../packages/i18n/messages/shared/zh-CN.json'), 'utf8'),
) as { ai?: { chatMessageItem?: { aiGenerated?: string } } }

describe('AI 生成显式标识', () => {
  it('共享常量是唯一真相源:文案键 + 字号/行高只定义一次', () => {
    expect(SHARED_CONSTANT).toContain("i18nKey: 'ai.chatMessageItem.aiGenerated'")
    expect(SHARED_CONSTANT).toContain('fontSizePx: 12')
    expect(SHARED_CONSTANT).toContain('lineHeightPx: 20')
    expect(SHARED_CONSTANT).toContain("colorSemantic: 'mutedForeground'")
  })

  it('小程序共享屏与 RN 都引用同一常量,不再各写字号', () => {
    expect(SHARED_MESSAGE_ITEM).toContain('AI_GENERATED_LABEL')
    const labelIdx = SHARED_MESSAGE_ITEM.indexOf('AI_GENERATED_LABEL.fontSizePx')
    const labelBlock = SHARED_MESSAGE_ITEM.slice(labelIdx - 40, labelIdx + 220)
    expect(labelBlock).toContain('`${AI_GENERATED_LABEL.fontSizePx * 2}rpx`')
    expect(labelBlock).toContain('AI_GENERATED_LABEL.lineHeightPx * 2')
    expect(labelBlock).not.toContain("fontSize: '24rpx'")
    expect(MESSAGE_LIST).toContain(
      "import { AI_GENERATED_LABEL, isErrorTurn, resendTargetText } from '@ihui/shared/chat'",
    )
    expect(MESSAGE_LIST).toContain('fontSize: AI_GENERATED_LABEL.fontSizePx')
    expect(MESSAGE_LIST).toContain('lineHeight: AI_GENERATED_LABEL.lineHeightPx')
  })

  it('RN 标注位置:气泡之后、操作行之前,且只给非失败轮 AI 回复', () => {
    const marker = 'AI_GENERATED_LABEL.i18nKey'
    const labelAt = MESSAGE_LIST.indexOf(marker)
    const bubbleEndAt = MESSAGE_LIST.indexOf('</Tappable>')
    const actionsAt = MESSAGE_LIST.indexOf('{showActions ? (')
    expect(labelAt).toBeGreaterThan(bubbleEndAt)
    expect(labelAt).toBeLessThan(actionsAt)
    expect(MESSAGE_LIST).toContain(
      "{!isUser && !isFailed && (item.content.trim() !== '' || segments.length > 0) ? (",
    )
  })

  it('共享五语言词包存在非空中文文案', () => {
    expect(SHARED_ZH.ai?.chatMessageItem?.aiGenerated?.trim()).toBe('AI 生成')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
