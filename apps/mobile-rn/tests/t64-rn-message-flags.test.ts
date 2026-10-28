// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票64(消息级 pin/书签)RN 腿的装车证明(源码级 + 词表级,与 d77-rn-business-form 同档)。
//
// 为什么判这几件事:本屏的历史消息 id 带 `-${idx}` 显示后缀(给 FlatList 防撞 key),
// 拿它去调标记接口会打一条不存在的行 —— 那正是"点了没反应但界面看着正常"的成因。
// 另一型失效是"字段在 API 回了、屏内没接":本屏的映射是按名挑字段的,漏列即静默丢维,
// 所以两条映射(历史回放 + live 透传)都必须在证据里出现。词表缺语会掉回显 key,
// 而 key 是英文标识符 —— 繁体/韩文屏上出现拉丁键名就是没接线,不是"翻译缺失"。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// 本包 vitest 的 import.meta.url 不是 file: 形态,而 vitest 的 cwd 恒等于本包根 ⇒ 用 cwd 取路径。
const HERE = process.cwd()
import { describe, expect, it } from 'vitest'

const SCREEN = readFileSync(resolve(HERE, 'src/screens/ChatScreen.tsx'), 'utf8')
// 2026-10-19:D99/T1 拆分后,pin/书签/举报三枚按钮的单一实现(flagButtons)落至共享
// ChatMessageList,屏侧只保留网络出口并经 rateMessage prop 装车 —— ⑥ 的实现面断言改读新家。
const MESSAGE_LIST = readFileSync(resolve(HERE, 'src/components/chat/ChatMessageList.tsx'), 'utf8')
const API_CLIENT = readFileSync(
  resolve(HERE, '../../packages/api-client/src/endpoints/chat.ts'),
  'utf8',
)
const SHARED_TYPE = readFileSync(resolve(HERE, '../../packages/types/src/app-message.ts'), 'utf8')

const locales = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
const flagKeys = ['pin', 'unpin', 'bookmark', 'unbookmark', 'flagFailed'] as const

function chatBlockOf(locale: string): Record<string, unknown> {
  const raw = readFileSync(
    resolve(HERE, '../../packages/i18n/messages/mobile-rn/' + locale + '.json'),
    'utf8',
  )
  const j = JSON.parse(raw) as { chat?: Record<string, unknown> }
  if (!j.chat) throw new Error(`${locale}: mobile-rn 词表里没有顶层 chat`)
  return j.chat
}

describe('票64 RN 腿 · 写链与读面接缝', () => {
  it('① 走 @ihui/api-client 的 setMessageFlags,不在端内重写一遍 fetch', () => {
    expect(SCREEN).toContain('  setMessageFlags,\n')
    expect(API_CLIENT).toContain('/api/chat/messages/${encodeURIComponent(input.messageId)}/flags`')
    expect(API_CLIENT).toContain("method: 'PATCH'")
  })

  it('② 写入用的是 flagTargetId(真实库 id),不是带显示后缀的 item.id', () => {
    expect(SCREEN).toContain('const targetId = item.flagTargetId ?? item.id')
    expect(SCREEN).toContain('messageId: targetId')
    // 阳性对照:把后缀 id 直接交给接口那一型必须不存在
    expect(SCREEN).not.toMatch(/setMessageFlags\(\{\s*messageId:\s*item\.id/)
  })

  it('③ 两条映射都按名列出标记字段(漏列即静默丢维,刷新后"看起来没存住")', () => {
    const listed = SCREEN.match(/flagTargetId:/g) ?? []
    expect(listed.length).toBeGreaterThanOrEqual(2)
    expect(SCREEN).toContain('id: `${m.id}-${idx}`')
    expect(SCREEN).toMatch(/flagTargetId: m\.id,/)
  })

  it('④ 成功态取服务端回写行;失败信封只提示、不改本地态(不做乐观翻转)', () => {
    expect(SCREEN).toContain('const written = res.data?.message')
    expect(SCREEN).toContain('pinnedAt: written?.pinnedAt ?? null')
    expect(SCREEN).toContain('if (!res.success) {')
    expect(SCREEN).toContain("showToast('error', t('chat.flagFailed'))")
  })

  it('⑤ 共享镜像类型挂了这三场(端内不另立第二份形状)', () => {
    for (const field of [
      'pinnedAt?: string | null',
      'bookmarkedAt?: string | null',
      'flagTargetId?: string',
    ]) {
      expect(SHARED_TYPE).toContain(field)
    }
  })

  it('⑥ 两枚按钮只有一份实现,AI 行与用户行共用(与 web 同口径),且文案全部取词', () => {
    const defs = MESSAGE_LIST.match(/const flagButtons: (?:React\.)?ReactNode = \(/g) ?? []
    const uses = MESSAGE_LIST.match(/\{flagButtons\}/g) ?? []
    expect(defs.length).toBe(1)
    // 两处消费:AI 消息的操作行 + 用户消息新增那一行
    expect(uses.length).toBe(2)
    expect(MESSAGE_LIST).toContain(
      '{isUser ? <View style={styles.msgActions}>{flagButtons}</View> : null}',
    )
    for (const key of flagKeys.slice(0, 4)) expect(MESSAGE_LIST).toContain(`t('chat.${key}')`)
    // 装车证明:屏侧必须真把网络出口传进共享列表(组件造好没装车 = 守门 64/70 的成因)
    expect(SCREEN).toContain('rateMessage={rateMessage}')
  })
})

describe('票64 RN 腿 · 词表五语', () => {
  it('每个 locale 的五把键都齐且非空', () => {
    for (const loc of locales) {
      const block = chatBlockOf(loc)
      for (const key of flagKeys) {
        const v = block[key]
        expect(typeof v, `${loc}.chat.${key}`).toBe('string')
        expect((v as string).trim().length, `${loc}.chat.${key} 空值`).toBeGreaterThan(0)
      }
    }
  })

  it('语种纯度:ko 不得含中日汉字,zh-TW 不得含"钉/存储"这一型简体残留', () => {
    const ko = chatBlockOf('ko')
    for (const key of flagKeys) {
      expect(String(ko[key])).not.toMatch(/[一-鿿]/)
    }
    const tw = chatBlockOf('zh-TW')
    for (const key of flagKeys) {
      const v = String(tw[key])
      expect(v).not.toMatch(/钉|储|固解除$/)
    }
    expect(String(tw.pin)).toBe('釘選')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
