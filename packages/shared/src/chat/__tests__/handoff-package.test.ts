// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D94 失败诊断脱敏交接包 —— 判定层用例(G-127)。
//
// 五条主线:
//   ① 四段齐全(缺一不可)+ 空 ctx 也不得少段;
//   ② **确定性本地规则优先**:外部 down **不得**单独成为结论(台账明文判据);
//   ③ 证据必过脱敏(真实含密样本逐类),且首条恒为 `- 用户可见错误：`;
//   ④ 长度截断**必须记录**字符数;ANSI 必须清掉;
//   ⑤ 无网络(数据源不可达)**降级不阻断**:前三段照常产出,与 §5d 同口径。

import { describe, expect, it } from 'vitest'

import {
  HANDOFF_LOCAL_RULE_IDS,
  HANDOFF_MESSAGE_KEYS,
  HANDOFF_SECTIONS,
  HANDOFF_ZH,
  MAX_EVIDENCE_CHARS,
  buildHandoffPackage,
  buildHandoffText,
  formatHandoffText,
  handoffExternalStatusText,
  handoffFixOutcomeText,
  handoffTruncatedText,
  resolveLocalDiagnosis,
  truncateForHandoff,
  type HandoffContext,
  type HandoffLocalRuleId,
  type HandoffLocalSignals,
} from '../handoff-package'
import { REDACT_IP_MARKER, REDACT_SECRET_MARKER } from '../../utils/redact'

// 真实形态的含密样本(不是 `xxx` 占位 —— 占位断言不出真实规则漏洞)
const SECRET_MESSAGE = [
  'POST /v1/chat failed',
  'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk',
  'key sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789',
  'token ghp_abcdefghijklmnopqrstuvwxyz0123456789',
  'session 5f4dcc3b5aa765d61d8327deb882cf99',
  'from 192.168.31.7:5432',
  'notify chunchuan.li@aizhs.top',
  '-----BEGIN RSA PRIVATE KEY-----',
  'MIIEowIBAAKCAQEAx3fV2Qm9k3J0pQb7t1Vc8yN0mR4uL6wZ0aB1cD2eF3gH4iJ5',
  '-----END RSA PRIVATE KEY-----',
].join('\n')

const fullCtx: HandoffContext = {
  errorMessage: SECRET_MESSAGE,
  fixSteps: [
    { label: '重跑任务', outcome: 'done' },
    { label: '切换备用模型', outcome: 'failed', detail: '仍然超时' },
    { label: '清理缓存', outcome: 'skipped' },
  ],
  localSignals: { timedOut: true, errorCode: 'REQUEST_TIMEOUT' },
  externalSignals: [
    { service: 'ai-service', status: 'down', detail: 'health check 失败' },
    { service: 'gateway', status: 'up' },
  ],
  productSurface: { route: '/workspace/123', panel: '对话流', taskId: 'task-123', turnId: 'turn-7' },
  incidentNames: ['INC-2041', 'INC-2042'],
  occurredAt: '2026-09-24T10:12:33Z',
}

describe('D94 交接单 / 四段齐全', () => {
  it('四段都在,且各自的 titleKey 对应四段标题', () => {
    const pkg = buildHandoffPackage(fullCtx)
    expect(pkg.diagnosis.section).toBe('diagnosis')
    expect(pkg.fixSteps.section).toBe('fixSteps')
    expect(pkg.evidence.section).toBe('evidence')
    expect(pkg.productSurface.section).toBe('productSurface')
    expect(HANDOFF_SECTIONS).toEqual(['diagnosis', 'fixSteps', 'evidence', 'productSurface'])
    expect(pkg.diagnosis.titleKey).toBe('section.diagnosis')
    expect(pkg.evidence.titleKey).toBe('section.evidence')
  })

  it('纯文本含四段标题原文 + 事件行 + 用户可见错误行', () => {
    const text = formatHandoffText(buildHandoffPackage(fullCtx))
    expect(text).toContain(HANDOFF_ZH['section.diagnosis'])
    expect(text).toContain(HANDOFF_ZH['section.fixSteps'])
    expect(text).toContain(HANDOFF_ZH['section.evidence'])
    expect(text).toContain(HANDOFF_ZH['section.productSurface'])
    expect(text).toContain('状态：可能相关的事件：INC-2041、INC-2042')
    expect(text).toContain('- 用户可见错误：')
  })

  it('空上下文也不得少段:四段全在,空态文案各就位', () => {
    const pkg = buildHandoffPackage()
    const text = formatHandoffText(pkg)
    expect(pkg.fixSteps.empty).toBe(true)
    expect(pkg.evidence.empty).toBe(true)
    expect(pkg.productSurface.empty).toBe(true)
    expect(pkg.productSurface.incidentsEmpty).toBe(true)
    expect(text).toContain(HANDOFF_ZH['empty.fixSteps'])
    expect(text).toContain(HANDOFF_ZH['empty.evidence'])
    expect(text).toContain(HANDOFF_ZH['empty.productSurface'])
    expect(text).toContain(HANDOFF_ZH['empty.incidents'])
    expect(pkg.occurredAt).toBe('未提供')
  })

  it('词包契约:20 个叶子键清单不得漂移(组件侧按此做 parity)', () => {
    expect(HANDOFF_MESSAGE_KEYS.length).toBe(20)
    for (const key of HANDOFF_MESSAGE_KEYS) {
      expect(Object.keys(HANDOFF_ZH), key).toContain(key)
    }
  })
})

describe('D94 交接单 / 诊断:本地优先,外部 down 不得单独成结论', () => {
  const ruleCases: { signals: HandoffLocalSignals; ruleId: HandoffLocalRuleId }[] = [
    { signals: { configKeyMissing: 'OPENAI_API_KEY' }, ruleId: 'configMissing' },
    { signals: { httpStatus: 401 }, ruleId: 'authRejected' },
    { signals: { httpStatus: 429 }, ruleId: 'rateLimited' },
    { signals: { httpStatus: 404 }, ruleId: 'resourceNotFound' },
    { signals: { timedOut: true }, ruleId: 'timeout' },
    { signals: { offline: true }, ruleId: 'networkUnreachable' },
    { signals: { exitCode: 137 }, ruleId: 'processExit' },
    { signals: { errorCode: 'CONTEXT_TOO_LONG' }, ruleId: 'errorCode' },
    { signals: { errorName: 'TypeError' }, ruleId: 'errorName' },
  ]

  it('九条本地规则逐条命中(顺序即优先级)', () => {
    expect(HANDOFF_LOCAL_RULE_IDS.length).toBe(ruleCases.length)
    for (const { signals, ruleId } of ruleCases) {
      expect(resolveLocalDiagnosis(signals).ruleId, JSON.stringify(signals)).toBe(ruleId)
    }
    expect(resolveLocalDiagnosis().ruleId).toBe('none')
  })

  it('只有外部 down(无本地判据)⇒ 不下结论,并显式声明外部仅作辅助', () => {
    const pkg = buildHandoffPackage({
      errorMessage: 'gateway 调用失败',
      externalSignals: [{ service: 'ai-service', status: 'down' }],
    })
    expect(pkg.diagnosis.localConfirmed).toBe(false)
    expect(pkg.diagnosis.externalOnly).toBe(true)
    expect(pkg.diagnosis.externalDownCount).toBe(1)
    expect(pkg.diagnosis.method).toContain(HANDOFF_ZH.localUnknown)
    expect(pkg.diagnosis.method).not.toContain('本地确定性规则判定')
    expect(pkg.diagnosis.caveat).toBe(HANDOFF_ZH.externalCaveat)
    const text = formatHandoffText(pkg)
    expect(text).toContain(HANDOFF_ZH.externalCaveat)
    // 外部信号只出现在"辅助信号"行里,不得混进"本地判据"
    expect(text).toContain(`[${HANDOFF_ZH['source.external']}] ai-service=down`)
    expect(text).not.toContain(`[${HANDOFF_ZH['source.local']}] ai-service=down`)
  })

  it('本地判据 + 外部 down ⇒ 结论仍由本地规则给出,外部只留辅助标注', () => {
    const pkg = buildHandoffPackage({
      localSignals: { httpStatus: 429 },
      externalSignals: [{ service: 'ai-service', status: 'down' }],
    })
    expect(pkg.diagnosis.localConfirmed).toBe(true)
    expect(pkg.diagnosis.externalOnly).toBe(false)
    expect(pkg.diagnosis.method.startsWith('本地确定性规则判定:')).toBe(true)
    expect(pkg.diagnosis.caveat).not.toBeNull()
  })

  it('外部只有 up / unknown ⇒ 不触发 externalOnly,也不打辅助声明', () => {
    const pkg = buildHandoffPackage({
      externalSignals: [
        { service: 'ai-service', status: 'up' },
        { service: 'gateway', status: 'unknown' },
      ],
    })
    expect(pkg.diagnosis.externalDownCount).toBe(0)
    expect(pkg.diagnosis.externalOnly).toBe(false)
    expect(pkg.diagnosis.caveat).toBeNull()
  })

  it('错误码走 D71 分类表:认得出补分类,认不出不臆造', () => {
    const known = resolveLocalDiagnosis({ errorCode: 'CONTEXT_TOO_LONG' })
    expect(known.detail).toContain('分类=resourceLimitExceeded')
    const unknown = resolveLocalDiagnosis({ errorCode: 'SOME_NEW_CODE_XYZ' })
    expect(unknown.ruleId).toBe('errorCode')
    expect(unknown.detail).toBe('未收录于错误分类表')
  })
})

describe('D94 交接单 / 修复步骤有序与空态', () => {
  it('按输入顺序编号,三态文案各不相同', () => {
    const pkg = buildHandoffPackage(fullCtx)
    expect(pkg.fixSteps.lines[0]).toBe('1. 重跑任务 → 已完成')
    expect(pkg.fixSteps.lines[1]).toBe('2. 切换备用模型 → 失败(仍然超时)')
    expect(pkg.fixSteps.lines[2]).toBe('3. 清理缓存 → 已跳过')
    expect(new Set([handoffFixOutcomeText('done'), handoffFixOutcomeText('failed'), handoffFixOutcomeText('skipped')]).size).toBe(3)
  })

  it('空列表必须显式写「未尝试任何修复步骤」,不得留空假装没有', () => {
    const pkg = buildHandoffPackage({ errorMessage: 'boom' })
    expect(pkg.fixSteps.empty).toBe(true)
    expect(pkg.fixSteps.lines.length).toBe(0)
    expect(formatHandoffText(pkg)).toContain(`- ${HANDOFF_ZH['empty.fixSteps']}`)
    expect(pkg.fixSteps.emptyText).toBe('未尝试任何修复步骤')
  })

  it('外部服务三态文本互不相同(穷尽 switch 的运行时证据)', () => {
    const set = new Set([
      handoffExternalStatusText('up'),
      handoffExternalStatusText('down'),
      handoffExternalStatusText('unknown'),
    ])
    expect(set.size).toBe(3)
  })
})

describe('D94 交接单 / 证据脱敏 · 截断 · strip_ansi', () => {
  it('真实含密样本:密钥 / token / JWT / 24 位 hex / IP / 邮箱 / PEM 全部被脱敏', () => {
    const pkg = buildHandoffPackage({ errorMessage: SECRET_MESSAGE })
    const text = pkg.evidence.lines.map((l) => l.text).join('\n')
    for (const secret of [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      'dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk',
      'sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789',
      'ghp_abcdefghijklmnopqrstuvwxyz0123456789',
      '5f4dcc3b5aa765d61d8327deb882cf99',
      '192.168.31.7',
      'chunchuan.li@aizhs.top',
      'MIIEowIBAAKCAQEAx3fV2Qm9k3J0pQb7t1Vc8yN0mR4uL6wZ0aB1cD2eF3gH4iJ5',
      '-----BEGIN RSA PRIVATE KEY-----',
    ]) {
      expect(text, secret).not.toContain(secret)
    }
    expect(text).toContain(REDACT_SECRET_MARKER)
    expect(text).toContain(REDACT_IP_MARKER)
  })

  it('导出全文同样不含任何原始密串(可对外提交)', () => {
    const text = buildHandoffText({ ...fullCtx, errorMessage: SECRET_MESSAGE })
    expect(text).not.toContain('sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789')
    expect(text).not.toContain('chunchuan.li@aizhs.top')
    expect(text).not.toContain('192.168.31.7')
    expect(text).not.toContain('5f4dcc3b5aa765d61d8327deb882cf99')
    expect(text).toContain(HANDOFF_ZH.redacted)
  })

  it('超长证据必须截断,并记录截掉多少字符', () => {
    // 用非十六进制字符('z'.repeat):纯 'A' × 5000 会被 24 位 hex 规则整段盖成标记,
    // 测不到截断(这条是本用例第一版自己踩出来的)。
    const long = 'z'.repeat(5000)
    const pkg = buildHandoffPackage({ errorMessage: long })
    const [line] = pkg.evidence.lines
    expect(line?.text.length).toBe(MAX_EVIDENCE_CHARS + 1) // 正文 + 省略号
    expect(line?.truncatedChars).toBe(5000 - MAX_EVIDENCE_CHARS)
    expect(pkg.truncatedChars).toBe(5000 - MAX_EVIDENCE_CHARS)
    expect(formatHandoffText(pkg)).toContain(handoffTruncatedText(5000 - MAX_EVIDENCE_CHARS))
    expect(truncateForHandoff('短文本').truncatedChars).toBe(0)
    expect(truncateForHandoff('短文本').text).toBe('短文本')
  })

  it('ANSI 转义必须清掉(含 OSC 与颜色码)', () => {
    const pkg = buildHandoffPackage({
      errorMessage: '\u001b[31mERROR\u001b[0m: 连接被拒 \u001b]0;title\u0007',
    })
    expect(pkg.evidence.lines[0]?.text).toBe('ERROR: 连接被拒 ')
    expect(formatHandoffText(pkg)).not.toContain('\u001b')
  })

  it('证据为空 ⇒ 显式空态,不得静默省略整段', () => {
    const pkg = buildHandoffPackage({ localSignals: { timedOut: true } })
    expect(pkg.evidence.empty).toBe(true)
    expect(formatHandoffText(pkg)).toContain(`- ${HANDOFF_ZH['empty.evidence']}`)
  })
})

describe('D94 交接单 / 产品界面与事件空态', () => {
  it('有 incident ⇒ 事件行列出全部名称', () => {
    const pkg = buildHandoffPackage({ incidentNames: ['INC-1', 'INC-2'] })
    expect(pkg.productSurface.incidentsEmpty).toBe(false)
    expect(pkg.productSurface.incidentLine).toBe('状态：可能相关的事件：INC-1、INC-2')
  })

  it('incident 为空 ⇒ 明确空态文案(不得空白)', () => {
    const pkg = buildHandoffPackage({ incidentNames: [] })
    expect(pkg.productSurface.incidentsEmpty).toBe(true)
    expect(pkg.productSurface.incidentLine).toBe(
      `状态：可能相关的事件：${HANDOFF_ZH['empty.incidents']}`,
    )
    expect(pkg.productSurface.incidentLine.length).toBeGreaterThan('状态：可能相关的事件：'.length)
  })

  it('产品界面字段逐项渲染,空则空态', () => {
    const pkg = buildHandoffPackage({ productSurface: { route: '/workspace/9', panel: '对话流' } })
    expect(pkg.productSurface.lines).toEqual(['页面:/workspace/9', '面板:对话流'])
    expect(pkg.productSurface.empty).toBe(false)
  })
})

describe('D94 交接单 / 无网络降级不阻断(§5d 同口径)', () => {
  it('数据源不可达 ⇒ 前三段照常产出,整包不失败', () => {
    const pkg = buildHandoffPackage({
      errorMessage: 'fetch failed',
      fixSteps: [{ label: '重试', outcome: 'failed' }],
      localSignals: { dnsFailure: true },
      dataSourceReachable: false,
    })
    expect(pkg.degraded).toBe(true)
    expect(pkg.degradedNote).toBe(HANDOFF_ZH.degraded)
    // 前三段(诊断 / 修复步骤 / 证据)必须有内容
    expect(pkg.diagnosis.method.length).toBeGreaterThan(0)
    expect(pkg.fixSteps.lines.length).toBeGreaterThan(0)
    expect(pkg.evidence.lines.length).toBeGreaterThan(0)
    const text = formatHandoffText(pkg)
    expect(text).toContain(HANDOFF_ZH.degraded)
    expect(text).toContain(HANDOFF_ZH['section.diagnosis'])
    expect(text).toContain(HANDOFF_ZH['section.fixSteps'])
    expect(text).toContain(HANDOFF_ZH['section.evidence'])
  })

  it('脏输入(undefined / 空串 / 空数组)一律不抛错', () => {
    expect(() =>
      buildHandoffPackage({
        errorMessage: '',
        evidence: [],
        fixSteps: [],
        externalSignals: [],
        incidentNames: [],
        productSurface: {},
      }),
    ).not.toThrow()
    expect(() => buildHandoffText()).not.toThrow()
  })
})
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
