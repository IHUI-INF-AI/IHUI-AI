// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D49① + D111 残余(小程序端):消息评价与审批三键的"接线自证"。
//
// 本端 vitest environment 是 'node'(无 DOM),@tarojs/components 在 node 下不可渲染,
// 因此 ChatMessageItem 的**渲染级**断言在本端测不到 —— 这里只做两件事:
//  ① 纯逻辑:三键 → wire 值(decision/scope)与取词/兜底(不依赖 Taro 运行时);
//  ② 源码级接线:证明消费点真的存在且走 @ihui/api-client(而不是端内 Taro.request 另调),
//     以及真实词包里那两个键确实取得到词(否则界面只会显示中文兜底, parity 未做)。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  APPROVAL_ACTIONS,
  resolveApprovalActionLabels,
  type TranslateWithFallback,
} from '../permission-tier-text'

const END_ROOT = join(__dirname, '..', '..', '..', '..')
const REPO_ROOT = join(END_ROOT, '..', '..')

function fakeTt(dict: Record<string, string>): TranslateWithFallback {
  return (key, fallback) => dict[key] ?? fallback
}

describe('resolveApprovalActionLabels(D111 审批三键取词 + 兜底)', () => {
  it('三键顺序与 wire 值:允许一次 / 始终允许 / 拒绝 → approve+once、approve+always、reject(无 scope)', () => {
    expect(APPROVAL_ACTIONS.map((a) => a.id)).toEqual(['allowOnce', 'alwaysAllow', 'reject'])
    expect(APPROVAL_ACTIONS[0]).toMatchObject({ decision: 'approve', scope: 'once' })
    expect(APPROVAL_ACTIONS[1]).toMatchObject({ decision: 'approve', scope: 'always' })
    // 拒绝不得带授权作用域:scope 缺省即"不落任何授权"(与 @ihui/types ToolApprovalScope 语义一致)
    expect(APPROVAL_ACTIONS[2]?.scope).toBeUndefined()
    expect(APPROVAL_ACTIONS[2]?.decision).toBe('reject')
  })

  it('词表完备时走本地化值,不吐 raw key 也不吐兜底中文', () => {
    const labels = resolveApprovalActionLabels(
      fakeTt({
        'editor.toolApproval.scopeOnce': 'LIKE_ONCE',
        'editor.toolApproval.scopeAlways': 'LIKE_ALWAYS',
        'editor.toolApproval.reject': 'DENY',
      }),
    )
    expect(labels.map((l) => l.label)).toEqual(['LIKE_ONCE', 'LIKE_ALWAYS', 'DENY'])
  })

  it('缺键时按端内中文兜底(不渲染 editor.toolApproval.* 这类 raw key)', () => {
    const labels = resolveApprovalActionLabels(fakeTt({}))
    expect(labels.map((l) => l.label)).toEqual(['允许一次', '始终允许', '拒绝'])
    for (const l of labels) expect(l.label).not.toContain('editor.toolApproval.')
  })
})

describe('审批三键取词键在真实词包中的可得性(shared ×5 语言)', () => {
  const locales = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
  function pack(locale: string): Record<string, unknown> {
    return JSON.parse(
      readFileSync(join(REPO_ROOT, `packages/i18n/messages/shared/${locale}.json`), 'utf8'),
    ) as Record<string, unknown>
  }
  for (const locale of locales) {
    it(`${locale}: editor.toolApproval.scopeOnce / scopeAlways 存在且非空`, () => {
      const ed = pack(locale)['editor'] as Record<string, unknown> | undefined
      const ta = ed?.['toolApproval'] as Record<string, unknown> | undefined
      expect(typeof ta?.['scopeOnce'] === 'string' && ta['scopeOnce'].length > 0).toBe(true)
      expect(typeof ta?.['scopeAlways'] === 'string' && ta['scopeAlways'].length > 0).toBe(true)
      // reject 键仓库尚未收录(packages/i18n 在本票禁改)⇒ 此处断言"缺键"这一事实,
      // 一旦主 agent 补键,本断言会变红并提醒同步删除端内兜底。
      expect(ta?.['reject'] ?? null).toBeNull()
    })
  }
})

describe('接线自证(源码级):评价与审批必须经 @ihui/api-client', () => {
  const itemSrc = readFileSync(join(END_ROOT, 'src/pkg-ai/ai/ChatMessageItem.tsx'), 'utf8')
  const apiSrc = readFileSync(join(END_ROOT, 'src/api/index.ts'), 'utf8')

  it('api/index.ts 从 @ihui/api-client 引入并 re-export 两个共享端点', () => {
    expect(apiSrc).toMatch(/rateChatMessage as _rateChatMessage[\s\S]{0,200}from '@ihui\/api-client'/)
    expect(apiSrc).toContain('export const rateChatMessage = _rateChatMessage')
    expect(apiSrc).toContain('export const sendToolApprovalResponse = _sendToolApprovalResponse')
  })

  it('ChatMessageItem 从 @/api 取用两端点,并真的发出调用', () => {
    expect(itemSrc).toMatch(/import \{[\s\S]*?rateChatMessage[\s\S]*?\} from '@\/api'/)
    expect(itemSrc).toContain('await rateChatMessage({ messageId, rating: next })')
    expect(itemSrc).toContain('await sendToolApprovalResponse({')
  })

  it('端内不得另起传输层直调这两个端点(§3 共享层优先;路径只允许出现在注释里)', () => {
    expect(itemSrc).not.toMatch(/Taro\.request\(/)
    expect(itemSrc).not.toMatch(/\bfetch\(/)
    expect(itemSrc).not.toMatch(/from '@\/utils\/api-bridge'/)
    // 去注释后再查:确保端点路径没有出现在可执行代码里
    const code = itemSrc.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).not.toMatch(/messages\/feedback/)
    expect(code).not.toMatch(/approval-response/)
  })

  it('点赞/点踩与审批三键都有渲染落点(不允许造好没装车)', () => {
    expect(itemSrc).toContain("name=\"check-success\"")
    expect(itemSrc).toContain("name=\"x-error\"")
    expect(itemSrc).toContain('onClick={() => void handleRate(\'like\')}')
    expect(itemSrc).toContain('onClick={() => void handleRate(\'dislike\')}')
    expect(itemSrc).toContain('onClick={() => void handleApproval(action.id)}')
  })

  it('UI 图标位不得用 emoji 充当点赞/点踩', () => {
    expect(itemSrc).not.toMatch(/[👍👎👏✅❌]/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
