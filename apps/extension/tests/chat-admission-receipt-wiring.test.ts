// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 差距① extension 腿:发送准入回执(admission)接线锁(2026-11-13 立)。
 *
 * 立此锁的两个因由:
 *  ① 本端此前缺上行两把键,服务端结构上不发这一帧 —— 与 miniapp-taro / mobile-rn 同型。
 *  ② 台账里关于本端**有一条结论错误的登记**:`missing.extension.onFormRequest` 原文称
 *    「该端没有对话流通道:对 streamChat 的 git grep 实测 0 命中,面板只做上下文回传」,
 *    错因是取证路径写成 `apps/extension/src` 而真实落点在 `apps/extension/entrypoints/`。
 *    实测 `ChatPage.tsx:7` 导入 streamChat、`:815` 调用,回调表已接 23 档。
 *    本锁顺带钉住「回调表真实存在」这一事实,免得那条错误结论再被抄一遍。
 *
 * 分层(与 g-425-truncation-notice 同纪律):
 *  - 接线点本身由守门 90 的「注册即算接」对账,本文件不重复断言;
 *  - 这里只钉:上行两把键在位、accepted 静默/其余上屏的分流、词条五语言齐备。
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import en from '@ihui/i18n/messages/extension/en.json'
import ja from '@ihui/i18n/messages/extension/ja.json'
import ko from '@ihui/i18n/messages/extension/ko.json'
import zhCN from '@ihui/i18n/messages/extension/zh-CN.json'
import zhTW from '@ihui/i18n/messages/extension/zh-TW.json'

const HERE = dirname(fileURLToPath(import.meta.url))
/** 剥注释:判的是"这行代码真在位",注释里提到不算接上(守门 90 同纪律)。 */
const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const PAGE = strip(readFileSync(join(HERE, '../entrypoints/sidepanel/pages/ChatPage.tsx'), 'utf8'))

describe('差距① extension 上行两把键', () => {
  it('回调表真实存在(证伪"该端没有对话流通道"那条旧登记)', () => {
    expect(PAGE).toContain('await streamChat(opts)')
    // 已接的回调不止一两个 —— 抽查三个不同族的
    expect(PAGE).toContain('onDelta:')
    expect(PAGE).toContain('onUsage:')
    expect(PAGE).toContain('onToolApproval:')
  })

  it('inputId 由共享 createInputId() 生成,且**在 opts 之外只取一次**', () => {
    expect(PAGE).toContain("import { createInputId } from '@ihui/shared/chat/send-admission'")
    expect(PAGE).toContain('const roundInputId = createInputId()')
    expect(PAGE).toContain('inputId: roundInputId,')
    // 反向:不得在对象字面量里直接调用(那样每轮重建拿新值,重连重发会变成"另一条发送")
    expect(PAGE).not.toMatch(/inputId:\s*createInputId\(\)/)
  })

  it('metadata.conversationId 仅在已有会话时补', () => {
    expect(PAGE).toMatch(/\.\.\.\(conversationId \? \{ metadata: \{ conversationId \} \} : \{\}\),/)
    // 反向:不得无条件塞进 metadata
    const withoutGuarded = PAGE.replace(
      /\.\.\.\(conversationId \? \{ metadata: \{ conversationId \} \} : \{\}\),/g,
      '',
    )
    expect(withoutGuarded).not.toMatch(/metadata: \{ conversationId \}/)
  })
})

describe('差距① extension 呈现腿', () => {
  it('accepted 不产生新提示,其余三档走既有 notice 出口', () => {
    expect(PAGE).toContain('onSendAdmissionReceipt: (receipt) => {')
    expect(PAGE).toMatch(/if \(receipt\.disposition === 'accepted'\) \{/)
    expect(PAGE).toMatch(/setNotice\(text\)/)
  })

  /**
   * 晋升撤回(2026-11-13 立)。本端 `setNotice` 是**持久态**(不像 toast 会自己消失),
   * 所以"accepted 直接 return"在这里的后果比别端更严重:那条"已排队"会一直挂在消息上,
   * 用户看着"已排队"而回答早在跑。这是我自己引入过的真实缺陷。
   */
  it('晋升:accepted 必须清掉自己写的排队 notice(否则永久停留)', () => {
    expect(PAGE).toContain('const queuedNoticeRef = useRef<string | null>(null)')
    // accepted 分支里按 queuedTurnId 判断再清
    expect(PAGE).toMatch(/if \(qid && queuedNoticeRef\.current === qid\) \{/)
    expect(PAGE).toMatch(/setNotice\(''\)/)
    // queued 时登记,其它档清空登记(避免误伤后续 onCompaction 写的 notice)
    expect(PAGE).toMatch(/queuedNoticeRef\.current = receipt\.disposition === 'queued'/)
  })

  it('queued 带位次时补文案,缺席不当成 0', () => {
    expect(PAGE).toMatch(
      /receipt\.disposition === 'queued' && typeof receipt\.ahead === 'number'/,
    )
    expect(PAGE).toContain("t('chat.admissionAhead', { n: receipt.ahead })")
  })

  it('词表用共享 streamErrors.admission.*,未命中原样回显处置码', () => {
    expect(PAGE).toContain('streamErrors.admission.${receipt.disposition}')
    expect(PAGE).toMatch(/label === key \? receipt\.disposition : label/)
  })
})

describe('差距① extension 词条五语言齐备', () => {
  it('chat.admissionAhead 在五个语言包里都存在且非空', () => {
    const packs: Array<[string, Record<string, Record<string, string>>]> = [
      ['zh-CN', zhCN as never],
      ['zh-TW', zhTW as never],
      ['en', en as never],
      ['ja', ja as never],
      ['ko', ko as never],
    ]
    for (const [lang, pack] of packs) {
      const v = pack?.chat?.admissionAhead
      expect(typeof v, `${lang} 缺 chat.admissionAhead ⇒ notice 条会渲染出键名`).toBe('string')
      expect(String(v).length, `${lang} 的 chat.admissionAhead 为空`).toBeGreaterThan(0)
      expect(String(v), `${lang} 的文案缺 {n} 占位符,位次无法插值`).toContain('{n}')
    }
  })
})

/**
 * 中间态收回(2026-11-13 立)。
 *
 * queued 缺陷暴露了同一类问题:`retryNotice` 写的是"第 N/M 次重试,X 秒后继续"这种未来时,
 * 而 `MessageContent.tsx` 对它是**无条件渲染**。不清就会一直挂在消息上,而那个 X 秒早过去了。
 */
describe('中间态提示必须有收回出口', () => {
  it('retryNotice 必须在正文到达时被清除(否则"X 秒后继续"永久停留)', () => {
    expect(PAGE).toContain('retryNotice: {')
    const deltaIdx = PAGE.indexOf('assistantText += delta')
    expect(deltaIdx, '找不到 onDelta 的正文累加点').toBeGreaterThan(0)
    const near = PAGE.slice(deltaIdx, deltaIdx + 600)
    expect(near, 'onDelta 内没有清除 retryNotice').toMatch(/retryNotice: undefined/)
  })

  it('清除是条件式的,不无谓重渲(无 retryNotice 时走另一分支)', () => {
    expect(PAGE).toMatch(/m\.retryNotice \? \{ \.\.\.m, content: m\.content \+ delta, retryNotice: undefined \}/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
