// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D77(2026-10-17 落地小程序腿)常驻判据:对话流业务表单(form_request)在**小程序端**的
 * 落地成套性(与 tool-approval-wiring 同一姿势;本端 vitest environment 是 'node')。
 *
 * 两条互补腿,缺一即"改了一堆没进渲染的东西,全绿而界面不变":
 *  ① **认领的数据面**:parseFormRequestLine 真解析(正例 + 畸形帧 null);
 *  ② **接线自证**:源码级证明共享投影 → 认领层 → onRawLine 旁路 → 回调表 → 卡片 →
 *     上行出口这条链每一环都真在位(把任一环改名或摘线,本用例必红)。
 *
 * 另含**镜像锁**:共享认领层读的线字段必须与 @ihui/api-client 的 tryParseFormRequest
 * 逐字同集合(两处各读一套是"跨端不同源"的成因,D113/D151 已各栽过一次)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { maybeFormRequestLine, parseFormRequestLine } from '@ihui/shared/chat/form-request-frame'

const HERE = dirname(fileURLToPath(import.meta.url))
const END_ROOT = resolve(HERE, '..', '..', '..', '..')
const REPO_ROOT = resolve(END_ROOT, '..', '..')

const src = (rel: string): string => readFileSync(join(END_ROOT, rel), 'utf8')
const CHAT_SRC = src('src/pkg-ai/ai/chat.tsx')
const API_SRC = src('src/api/index.ts')
const CARD_SRC = src('src/components/BusinessFormCard.tsx')
const CARD_CSS = src('src/components/BusinessFormCard.css')
const API_CLIENT_SRC = readFileSync(join(REPO_ROOT, 'packages/api-client/src/client.ts'), 'utf8')
const SHARED_FRAME_SRC = readFileSync(
  join(REPO_ROOT, 'packages/shared/src/chat/form-request-frame.ts'),
  'utf8',
)
const SHARED_PARSE = readFileSync(join(REPO_ROOT, 'packages/shared/src/utils/sse-parse.ts'), 'utf8')

const VALID_LINE = `data: ${JSON.stringify({
  type: 'form_request',
  requestId: 'frm-w1',
  sessionId: 'sess-w1',
  messageId: 'msg-w1',
  kind: 'email',
  fields: [{ key: 'to', type: 'email', required: true }],
  actions: ['approve', 'reject'],
})}`

describe('D77 ① 认领数据面:parseFormRequestLine 真解析', () => {
  it('完整帧 ⇒ 解析成功,sessionId/messageId 透传', () => {
    const evt = parseFormRequestLine(VALID_LINE)
    expect(evt).toMatchObject({
      requestId: 'frm-w1',
      sessionId: 'sess-w1',
      messageId: 'msg-w1',
      kind: 'email',
    })
    expect(maybeFormRequestLine(VALID_LINE)).toBe(true)
  })

  it('畸形帧一律 null(缺 requestId / fields 空 / 动作不成对 / 坏 JSON)', () => {
    const bad = (o: Record<string, unknown>) =>
      `data: ${JSON.stringify({ type: 'form_request', ...o })}`
    expect(
      parseFormRequestLine(
        bad({ kind: 'email', fields: [{ key: 'to' }], actions: ['approve', 'reject'] }),
      ),
    ).toBeNull()
    expect(
      parseFormRequestLine(
        bad({ requestId: 'r', kind: 'email', fields: [], actions: ['approve', 'reject'] }),
      ),
    ).toBeNull()
    expect(
      parseFormRequestLine(
        bad({ requestId: 'r', kind: 'email', fields: [{ key: 'to' }], actions: ['approve'] }),
      ),
    ).toBeNull()
    expect(parseFormRequestLine('data: {broken}')).toBeNull()
    expect(parseFormRequestLine('data: {"type":"delta"}')).toBeNull()
  })
})

describe('D77 ② 镜像锁:与 @ihui/api-client 的 tryParseFormRequest 逐字同', () => {
  it('api-client 与共享认领层读的线字段键集一致(缺一侧即漂移)', () => {
    const fnStart = API_CLIENT_SRC.indexOf('const tryParseFormRequest =')
    expect(fnStart).toBeGreaterThan(-1)
    const fn = API_CLIENT_SRC.slice(fnStart, fnStart + 4000)
    for (const key of ['requestId', 'kind', 'fields', 'actions', 'sessionId', 'messageId']) {
      expect(fn).toContain(`json.${key}`)
      expect(SHARED_FRAME_SRC).toContain(`json.${key}`)
    }
    // 反向:共享解析面至今没认领这一族帧(本端旁路认领存在的理由,防"改了共享面还留着旁路")
    expect(SHARED_PARSE).not.toContain("'form_request'")
  })
})

describe('D77 ③ 接线自证:旁路 → 回调表 → 卡片 → 上行出口', () => {
  it('api/index.ts 把整行旁路接进 streamSSE 并注册 onFormRequest', () => {
    expect(API_SRC).toContain('onRawLine:')
    expect(API_SRC).toContain('parseFormRequestLine(line)')
    expect(API_SRC).toContain('callbacks.onFormRequest(form)')
    expect(API_SRC).toContain('onFormRequest?: (evt: FormRequestFramePayload) => void')
    // 与 D136 共存:tool-approval 命中即 return,form_request 只在其后补问
    expect(API_SRC).toContain('parseToolApprovalLine(line)')
    expect(API_SRC).toContain('callbacks.onToolApproval(evt)')
  })

  it('chat.tsx 的回调表里有 onFormRequest:投影单源 + 幂等追加', () => {
    expect(CHAT_SRC).toMatch(/^\s*onFormRequest: \(frame\) => \{$/mu)
    expect(CHAT_SRC).toContain('projectFormRequestFrame(frame, String(assistantMsg.timestamp))')
    expect(CHAT_SRC).toContain('f.requestId === entry.requestId')
  })

  it('卡片渲染位 + 上行出口在位(buildFormResponseEvent + postFormResponse 从 api-client 取)', () => {
    expect(CHAT_SRC).toContain('<BusinessFormCard')
    expect(CHAT_SRC).toContain('buildFormResponseEvent')
    expect(CHAT_SRC).toContain('postFormResponse')
    expect(CHAT_SRC).toContain('form-response-no-session-channel')
    // 会话级收口:切换/清空时表单态一并收掉
    expect(CHAT_SRC).toContain('setBusinessForms([])')
  })

  it('卡片本体:判定层字段表/校验/状态机/成对按钮齐,拒绝零副作用(values 恒 null)', () => {
    expect(CARD_SRC).toContain('BUSINESS_FORM_FIELDS[kind]')
    expect(CARD_SRC).toContain('validateFormValues(kind, values)')
    expect(CARD_SRC).toContain('applyFormAction')
    expect(CARD_SRC).toContain('attendeesFoldNeeded')
    expect(CARD_SRC).toContain('data-action="approve"')
    expect(CARD_SRC).toContain('data-action="reject"')
    expect(CARD_SRC).toContain("action: 'reject', kind, values: null")
    expect(CARD_SRC).toContain('data-form-kind={kind}')
    expect(CARD_SRC).toContain('data-form-phase={phase}')
  })
})

describe('D77 ④ i18n:五语 ai.businessForms 块齐(键集与 web 块对齐 + 端内 reason)', () => {
  const REQUIRED = [
    'ariaLabel',
    'aria',
    'fields',
    'action',
    'error',
    'fold',
    'status',
    'reason',
  ] as const
  it('五语 miniapp-taro 语言包都有 ai.businessForms 且键集一致', () => {
    for (const loc of ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']) {
      const pack = JSON.parse(
        readFileSync(join(REPO_ROOT, `packages/i18n/messages/miniapp-taro/${loc}.json`), 'utf8'),
      ) as Record<string, { businessForms?: Record<string, unknown> }>
      const bf = pack.ai?.businessForms
      expect(bf, `${loc} missing ai.businessForms`).toBeTruthy()
      for (const key of REQUIRED) {
        expect(bf, `${loc} missing ${key}`).toHaveProperty(key)
      }
      // 五语取词都是本语种文字(不是占位/空串)
      const bfRecord = bf as Record<string, Record<string, string>>
      expect(bfRecord.action?.approve?.length ?? 0).toBeGreaterThan(0)
      expect(bfRecord.action?.reject?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('web 端 ai.pane.businessForms 块仍在(re-export 后 web 侧取词面不受影响)', () => {
    for (const loc of ['zh-CN', 'en', 'ja', 'ko', 'zh-TW']) {
      const pack = JSON.parse(
        readFileSync(join(REPO_ROOT, `packages/i18n/messages/web/${loc}.json`), 'utf8'),
      ) as Record<string, { pane?: { businessForms?: unknown } }>
      expect(pack.ai?.pane?.businessForms, `${loc} web businessForms`).toBeTruthy()
    }
  })
})

describe('D77 ⑤ UI 纪律:圆角单一真源 / 描边不取墨档 / 图标资产在场', () => {
  it('卡片 CSS:半径只取 var(--radius-*) 档,静态描边不取墨档', () => {
    const radii = [...CARD_CSS.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1]?.trim())
    expect(radii.length).toBeGreaterThan(0)
    for (const value of radii) expect(value).toMatch(/^var\(--radius-(xs|sm|md|lg|xl|2xl)\)$/)
    expect(CARD_CSS).not.toMatch(/border[^;]*var\(--color-(primary|foreground)\)/u)
  })

  it('卡片用的 LineIcon 资产在场,不用 emoji 顶替', () => {
    const icons = readFileSync(join(END_ROOT, 'src/components/LineIcon/icons.ts'), 'utf8')
    for (const name of ['check-success', 'x-error']) {
      expect(icons).toContain(`'${name}':`)
      expect(CARD_SRC).toContain(`name="${name}"`)
    }
    expect(CARD_SRC).not.toMatch(/[👍👎✅❌⚠️🔒🛡]/u)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
