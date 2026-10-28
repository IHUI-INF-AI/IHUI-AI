// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D77 业务表单卡 RN 腿的装车证明(源码级 + 词表级,与小程序腿 business-form-wiring.test.ts 同档)。
//
// 为什么这一组断言长这样:RN 腿此前的形态是"回调注册了,但渲染位是一行只读中文"——
// 那既不是表单也没有上行,却会因为"onFormRequest 在回调表里"而被覆盖度机器面记成已覆盖
// (假绿)。所以这里判的三件事必须是可反查的:渲染位真的换成了可填卡、判定层没在端内重写、
// 词表五语齐且不再有硬编码中文。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// 本包 vitest 的 import.meta.url 不是 file: 形态(实测 TypeError: The URL must be of scheme file),
// 而 vitest 的 cwd 恒等于本包根 ⇒ 用 cwd 取路径(与同包 d135-seam-wiring 同一口径)。
const HERE = process.cwd()
import { describe, expect, it } from 'vitest'

const SCREEN = readFileSync(resolve(HERE, 'src/screens/ChatScreen.tsx'), 'utf8')
const SHEET = readFileSync(resolve(HERE, 'src/components/ai/BusinessFormSheet.tsx'), 'utf8')

const locales = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

function formBlockOf(locale: string): Record<string, unknown> {
  const raw = readFileSync(
    resolve(HERE, '../../packages/i18n/messages/mobile-rn/' + locale + '.json'),
    'utf8',
  )
  const j = JSON.parse(raw) as { ai?: { pane?: { businessForms?: Record<string, unknown> } } }
  const block = j.ai?.pane?.businessForms
  if (!block) throw new Error(`${locale}: mobile-rn 词表里没有 ai.pane.businessForms`)
  return block
}

describe('D77 业务表单卡 RN 腿', () => {
  it('① 渲染位是可填卡,不是那行只读中文(旧形态必须消失)', () => {
    expect(SHEET).toContain('useBusinessFormQueue')
    expect(SCREEN).toContain('{businessForm.host}')
    expect(SCREEN).not.toContain('表单请求 ${f.kind}')
  })

  it('② 回调确实接到投影出口(注册 ≠ 渲染,两条都要在场)', () => {
    expect(SCREEN).toContain('businessForm.onFormRequest(event)')
    expect(SCREEN).toContain(
      'useBusinessFormQueue({ fallbackMessageId: () => formAnchorIdRef.current })',
    )
    // 锚点在 send() 里就锁到本轮 assistant 消息,与折叠键同一口径
    expect(SCREEN).toContain('formAnchorIdRef.current = aiMsg.id')
  })

  it('③ 判定层与投影层一律取 @ihui/shared,端内不得有第二份规则', () => {
    expect(SHEET).toContain("from '@ihui/shared/chat/business-forms'")
    expect(SHEET).toContain("from '@ihui/shared/chat/form-request-frame'")
    expect(SHEET).toContain('projectFormRequestFrame')
    expect(SHEET).toContain('validateFormValues')
    expect(SHEET).toContain('applyFormAction')
    expect(SHEET).toContain('attendeesFoldNeeded')
    // 端内不自立字段表/动作表(出现即第二份真相源)
    expect(SHEET).not.toMatch(/const\s+FIELDS\s*[:=]/)
    expect(SHEET).not.toMatch(/const\s+ACTIONS\s*[:=]/)
  })

  it('④ 上行出口与两态形状:approve 带 values、reject 不带 values', () => {
    expect(SHEET).toContain("import { postFormResponse } from '@ihui/api-client'")
    expect(SHEET).toMatch(/action:\s*'approve',\s*values:\s*raw/)
    expect(SHEET).toMatch(/action:\s*'reject',/)
    // 拒绝分支的 body 里不得出现 values 键(拒绝零副作用)
    const rejectBlock = SHEET.slice(SHEET.indexOf("action: 'reject'"))
    const bodySlice = rejectBlock.slice(0, rejectBlock.indexOf('try {'))
    expect(bodySlice).not.toContain('values')
  })

  it('⑤ 无会话锚点不发(造 id 会把应答打到别人会话上)', () => {
    expect(SHEET).toContain('if (!sessionId) {')
    expect(SHEET).toContain("'failed'")
  })

  it('⑥ 词表五语齐备且键集全等(§19 同批补齐)', () => {
    const blocks = locales.map((l) => formBlockOf(l))
    const keySets = blocks.map((b) => JSON.stringify(Object.keys(b).sort()))
    for (const set of keySets) expect(set).toBe(keySets[0])
    for (const b of blocks) {
      expect(Object.keys(b)).toEqual(
        expect.arrayContaining([
          'ariaLabel',
          'aria',
          'fields',
          'action',
          'error',
          'fold',
          'status',
        ]),
      )
    }
  })

  it('⑦ 引用的键必须取得到(端内 t() 用到的命名空间逐条落词表)', () => {
    const zh = formBlockOf('zh-CN')
    const aria = zh.aria as Record<string, string>
    expect(aria.email).toBeTruthy()
    expect(aria.calendarEvent).toBeTruthy()
    const action = zh.action as Record<string, string>
    // 成对动作 + 两形态提交意图(票面:批准操作/拒绝操作成对、日历创建/保存)
    for (const k of ['approve', 'reject', 'create', 'save']) expect(action[k]).toBeTruthy()
    const status = zh.status as Record<string, string>
    for (const k of ['submitting', 'approved', 'rejected', 'failed']) expect(status[k]).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
