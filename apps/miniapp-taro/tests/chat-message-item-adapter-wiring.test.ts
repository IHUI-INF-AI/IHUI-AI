// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 块 7 端内适配器的注入腿自证(阴性对照基准):
// 共享视觉件只给挂载位,行为全部由本适配器注入;删掉任一条 ⇒ 本文件当场红。
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ITEM_SRC = readFileSync(join(HERE, '../src/pkg-ai/ai/ChatMessageItem.tsx'), 'utf8')
const SHELL_SRC = readFileSync(join(HERE, '../src/pkg-ai/ai/chat-shell-extras.tsx'), 'utf8')

describe('端内适配器必须注入的腿(删任一条 ⇒ 共享件只剩空挂载位)', () => {
  it('复制 / 图片全屏 / 下载 / 语音 / 数字人 / 评价 / 审批', () => {
    expect(ITEM_SRC, 'Missing: onCopy').toContain('onCopy={copyText}')
    expect(ITEM_SRC, 'Missing: onOpenImage').toContain('onOpenImage={taroPreviewChatImages}')
    expect(ITEM_SRC, 'Missing: onDownloadImages').toContain('onDownloadImages={downloadImages}')
    expect(ITEM_SRC, 'Missing: onOpenDigitalHuman').toContain('onOpenDigitalHuman={')
    expect(ITEM_SRC, 'Missing: onPlayVoice').toContain('onPlayVoice={playVoice}')
    expect(ITEM_SRC, 'Missing: onRate').toContain('onRate={(next) => void handleRate(next)}')
    expect(ITEM_SRC, 'Missing: onApproval').toContain(
      'onApproval={(actionId) => void handleApproval(actionId)}',
    )
  })

  it('平台独占节点走注入位,不回流共享件', () => {
    expect(ITEM_SRC, 'Missing: versionMenuSlot').toContain('versionMenuSlot={versionMenuSlot}')
    expect(ITEM_SRC, 'Missing: shareSlot').toContain('shareSlot={')
    expect(ITEM_SRC, 'Missing: renderVideo').toContain('renderVideo={')
    expect(ITEM_SRC, 'Missing: activityCardsSlot').toContain('activityCardsSlot=')
    expect(ITEM_SRC, 'Missing: steerNoticeSlot').toContain('steerNoticeSlot=')
  })

  it('端内壳把版本菜单按 messageId 注入(共享层不自判族)', () => {
    expect(SHELL_SRC).toContain('versionMenuSlot={')
    expect(SHELL_SRC).toContain('<MessageVersionMenu')
  })
})

describe('共享件端侧化:适配器只保留平台行为', () => {
  it('剪贴板 / 音频 / 相册 / 导航都住在端内,不下沉共享层', () => {
    expect(ITEM_SRC).toContain('Taro.setClipboardData(')
    expect(ITEM_SRC).toContain('Taro.createInnerAudioContext(')
    expect(ITEM_SRC).toContain('Taro.downloadFile(')
    expect(ITEM_SRC).toContain("Taro.navigateTo({ url: '/pkg-ai/ai/agent' })")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
