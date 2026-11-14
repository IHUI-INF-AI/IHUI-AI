// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-account-keepalive.mjs 告警链三缺陷的判据锁(2026-11-15 立)。
 * 判据全部 import 生产端(__test__),测试内零复制(§22c)。每条含「同形正例 + 反向牙」,
 * 旧实现退回时当场红:
 *  ① 投递口径 —— delivered 与 suppressed 必须分别计数,suppressed 不得并进 mailed/delivered;
 *  ② 文件名   —— 冒号等 Windows 非法字符被净化,且不同告警净化后仍不撞名(幂等/可去重);
 *  ③ 判死码   —— 单一真相源命中即跳过本轮重试;【可逆】失败仍保留 6h 解摘再试,别一刀切静默。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { __test__ as k } from '../relay-account-keepalive.mjs'

// 现场残留的非法字符样本:uid 形如 `auto:f15` ⇒ alertId 含半角冒号。
const WIN_ILLEGAL_RE = /[<>:"/\\|?*\x00-\x1f]/
const DOUBAO_DEAD = { providerCode: 'doubao', uid: 'auto:580', lastErrorMessage: 'status_code 712012001 登录校验不合法' }
const ZCODE_DEAD = { providerCode: 'zcode', uid: 'auto:cb6', lastErrorMessage: 'HTTP 401 鉴权失效' }

// ── 缺陷①:投递口径与台账一致 ────────────────────────────────────────────────
test('① dispositionOf:出口 stdout 的机器可读标记分别判 delivered / suppressed,取不到绝不冒充送达', () => {
  assert.equal(
    k.dispositionOf('噪声\n[alert-mail] 已通过 smtp 通道发送告警邮件\n__DISPOSITION__=delivered\n'),
    'delivered',
  )
  assert.equal(
    k.dispositionOf('[alert-mail] 已按标识去重,本轮未寄\n__DISPOSITION__=suppressed\n'),
    'suppressed',
  )
  // 反向牙:suppressed 与 delivered 退出码同为 0,但「中文说已发送」且无标记 ≠ 送达。
  assert.equal(k.dispositionOf('[alert-mail] 已通过 smtp 通道发送告警邮件'), 'undetermined')
  assert.equal(k.dispositionOf(''), 'undetermined')
  assert.equal(k.dispositionOf(null), 'undetermined')
  // 反向牙:标记必须是完整单词,不能被伪造的相邻串骗过(如 delivered-fake 仍取 delivered 边界,
  // 但 suppressedX 不得被当 suppressed)。这里确认正则带词边界。
  assert.equal(k.dispositionOf('__DISPOSITION__=suppressedX'), 'undetermined')
})

test('① tallyMailOutcomes:delivered 与 suppressed 分别计数(证伪守护日志 mailed=8 的抑制误记事故)', () => {
  const zero = { delivered: 0, suppressed: 0, failed: 0, undetermined: 0, skipped: 0 }
  assert.deepEqual(k.tallyMailOutcomes([]), zero)
  // 同形正例:8 条其实全是「已抑制未寄」—— delivered 必须是 0,不得记成 mailed=8。
  const eight = k.tallyMailOutcomes(Array(8).fill('suppressed'))
  assert.deepEqual(eight, { ...zero, suppressed: 8 }, '8 条 suppressed 的 delivered 必须为 0')
  assert.equal(eight.delivered, 0, 'suppressed 绝不能并进 delivered/mailed')
  // 混合:每一格独立,不并桶。
  assert.deepEqual(
    k.tallyMailOutcomes(['delivered', 'delivered', 'suppressed', 'failed', 'undetermined', 'skipped']),
    { delivered: 2, suppressed: 1, failed: 1, undetermined: 1, skipped: 1 },
  )
  // 反向牙:全 delivered 时 suppressed 必须为 0(别把真送达误记成抑制)。
  const allDelivered = k.tallyMailOutcomes(Array(3).fill('delivered'))
  assert.equal(allDelivered.delivered, 3)
  assert.equal(allDelivered.suppressed, 0)
})

test('① hasDeliveredNotice:只有台账里 disposition=delivered 才算「已通知」,suppressed 不算', () => {
  const ledger = [
    JSON.stringify({ alertId: 'relay-keepalive-doubao-auto:580', disposition: 'delivered', source: 'relay-account-keepalive' }),
    JSON.stringify({ alertId: 'relay-keepalive-zcode-auto:f15', disposition: 'suppressed', source: 'relay-account-keepalive' }),
    '半行坏 JSON(读账时跳过)',
  ].join('\n')
  assert.equal(k.hasDeliveredNotice(ledger, 'relay-keepalive-doubao-auto:580'), true)
  // 反向牙(证伪「把抑制当送达」):suppressed 那条不得算通知过,否则判死首封会被直接静默吞掉。
  assert.equal(k.hasDeliveredNotice(ledger, 'relay-keepalive-zcode-auto:f15'), false)
  assert.equal(k.hasDeliveredNotice(ledger, 'relay-keepalive-never-xxxx'), false)
  assert.equal(k.hasDeliveredNotice('', 'relay-keepalive-doubao-auto:580'), false)
  // alertId 精确匹配:别被同前缀的别枚号误命中。
  assert.equal(k.hasDeliveredNotice(ledger, 'relay-keepalive-doubao-auto:58'), false)
})

// ── 缺陷②:Windows 临时正文文件名净化 ─────────────────────────────────────────
test('② sanitizeFileStem:冒号及其它 Windows 非法字符全部净化,幂等', () => {
  const raw = 'relay-keepalive-doubao-auto:580<>/\\|?*"\x00\x1f'
  const cleaned = k.sanitizeFileStem(raw)
  assert.ok(!WIN_ILLEGAL_RE.test(cleaned), `净化后仍含非法字符: ${JSON.stringify(cleaned)}`)
  assert.ok(!cleaned.includes(':'), '半角冒号必须被净化(NTFS 备用数据流事故的根源)')
  // 幂等:再净化一次不变(_ 本身是合法字符)。
  assert.equal(k.sanitizeFileStem(cleaned), cleaned)
})

test('② safeAlertFileName:含冒号的告警不落 ADS,且不同告警净化后仍不撞名(哈希去重)', () => {
  const a = k.safeAlertFileName('relay-keepalive-doubao-auto:580')
  assert.ok(a.endsWith('.md'))
  assert.ok(!WIN_ILLEGAL_RE.test(a), `文件名仍含非法字符: ${a}`)
  assert.ok(!a.includes(':'), '文件名不得含冒号')
  // 幂等:同一 alertId 恒得同一名。
  assert.equal(k.safeAlertFileName('relay-keepalive-doubao-auto:580'), a)
  // 反向牙(不撞名的真反例):两个不同告警净化后主体完全相同 ⇒ 只能靠原文哈希区分。
  const x = 'relay-keepalive-zcode-auto:f15'
  const y = 'relay-keepalive-zcode-auto?f15'
  assert.equal(k.sanitizeFileStem(x), k.sanitizeFileStem(y), '这两个不同告警净化后 stem 理应相同')
  assert.notEqual(k.safeAlertFileName(x), k.safeAlertFileName(y), 'stem 相同也必须不撞名')
  // 不同 uid 也不撞名。
  assert.notEqual(
    k.safeAlertFileName('relay-keepalive-doubao-auto:580'),
    k.safeAlertFileName('relay-keepalive-doubao-auto:581'),
  )
})

test('② alertIdOf 逻辑身份保留冒号(只净化文件名,不改去重身份)反向牙', () => {
  const id = k.alertIdOf({ providerCode: 'doubao', uid: 'auto:580' })
  assert.equal(id, 'relay-keepalive-doubao-auto:580')
  assert.ok(id.includes(':'), '--alert-id 身份保持原样,否则 24h 去重与台账 alertId 会漂移')
})

// ── 缺陷③:判死码单一真相源 ──────────────────────────────────────────────────
test('③ IRREVERSIBLE_VERDICTS:单一真相源冻结、4 条、id 唯一、每条都是正则', () => {
  assert.ok(Object.isFrozen(k.IRREVERSIBLE_VERDICTS), '判死码清单必须冻结,杜绝运行期漂移')
  assert.equal(k.IRREVERSIBLE_VERDICTS.length, 4, 'CodeArts/Trae/豆包/HTTP401 四条一个不少')
  const ids = k.IRREVERSIBLE_VERDICTS.map((v) => v.id)
  assert.equal(new Set(ids).size, 4, 'id 不得重复')
  for (const v of k.IRREVERSIBLE_VERDICTS) assert.ok(v.pattern instanceof RegExp)
})

test('③ irreversibleVerdictOf:四类上游判死码逐个命中(同形正例)', () => {
  const cases = [
    ['codearts-sts5.1806', { providerCode: 'codearts', lastErrorMessage: '刷新失败: STS5.1806 / invalid_grant' }],
    ['trae-refresh-invalid', { providerCode: 'trae', lastErrorMessage: '20101 refresh token is invalid (rt 已废)' }],
    ['doubao-712012001', DOUBAO_DEAD],
    ['http401-auth-rejected', ZCODE_DEAD],
  ]
  for (const [id, row] of cases) {
    assert.equal(k.irreversibleVerdictOf(row), id, `${id} 必须命中`)
    assert.equal(k.isTerminalFailure(row), true, `${id} 必须判为 terminal`)
  }
  // 兼容 snake_case 字段(last_error_message 列名)。
  assert.equal(
    k.irreversibleVerdictOf({ last_error_message: 'STS5.1806' }),
    'codearts-sts5.1806',
  )
  // 超长去重窗必须远大于 24h,否则判死号还会每 24h 放行一封。
  assert.ok(k.TERMINAL_ONCE_DEDUPE_HOURS > k.ALERT_DEDUPE_HOURS)
})

test('③ 反向牙:可逆失败/普通故障绝不被判死(别一刀切把所有失败都静默掉)', () => {
  const reversible = [
    { lastErrorMessage: 'ETIMEDOUT 连接上游超时' },
    { lastErrorMessage: 'HTTP 500 网关错误' },
    { lastErrorMessage: 'HTTP 401' }, // 裸 401,缺「鉴权失效」明确措辞
    { lastErrorMessage: 'HTTP 403 鉴权失效' }, // 需求只认 401,403 不扩权
    { lastErrorMessage: 'HTTP 401 connection reset' }, // 有 401 但无鉴权失效语义
    { lastErrorMessage: 'rate limited, retry later' },
    { lastErrorMessage: '' },
    {}, // 无字段
    { lastErrorMessage: null },
  ]
  for (const row of reversible) {
    assert.equal(k.irreversibleVerdictOf(row), null, `可逆失败被误判死: ${JSON.stringify(row)}`)
    assert.equal(k.isTerminalFailure(row), false)
    assert.equal(k.alertPlanFor(row).verdict, 'reversible')
    assert.equal(k.alertPlanFor(row).skipThisRound, false, '可逆失败不得跳过本轮')
  }
})

// ── 缺陷③:判死命中跳过重试 / 可逆仍按 6h 解摘再试 ────────────────────────────
test('③ alertPlanFor:判死且已通知 ⇒ 跳过本轮保活重试(skipThisRound/silent,不再 6h 撞上游)', () => {
  const silent = k.alertPlanFor(DOUBAO_DEAD, { alreadyNotified: true })
  assert.equal(silent.verdict, 'terminal')
  assert.equal(silent.verdictId, 'doubao-712012001')
  assert.equal(silent.skipThisRound, true, '命中判死码且已通知 ⇒ 本轮必须跳过')
  assert.equal(silent.mode, 'silent')
  assert.equal(silent.dedupeHours, null, '跳过即不再派发去重窗口')
  assert.equal(silent.keepRevive, false, '判死号不再保留 6h 解摘再试')
  assert.equal(silent.reviveBackoffHours, null)
})

test('③ alertPlanFor:判死首封 = 一次性通知(超长窗,不再每 24h 放行),可逆失败仍按 24h 重报', () => {
  const once = k.alertPlanFor(DOUBAO_DEAD, { alreadyNotified: false })
  assert.equal(once.verdict, 'terminal')
  assert.equal(once.mode, 'once')
  assert.equal(once.skipThisRound, false, '首封仍要通知一次(一次性通知,不是直接静默)')
  assert.equal(once.dedupeHours, k.TERMINAL_ONCE_DEDUPE_HOURS)
  assert.equal(once.keepRevive, false)
  assert.equal(once.reviveBackoffHours, null)

  const recurring = k.alertPlanFor({ lastErrorMessage: 'ETIMEDOUT' })
  assert.equal(recurring.mode, 'recurring')
  assert.equal(recurring.dedupeHours, k.ALERT_DEDUPE_HOURS, '可逆失败维持既有 24h 告警去重')
  assert.equal(recurring.skipThisRound, false)
})

test('③ 核心对照(证伪一刀切):可逆失败仍按 6h 解摘再试,判死才摘掉这条语义', () => {
  const rev = k.alertPlanFor({ lastErrorMessage: 'HTTP 500 抖动' })
  const dead = k.alertPlanFor(DOUBAO_DEAD, { alreadyNotified: true })
  // 正例:可逆失败完整保留既有语义 —— 6h 解摘再试 + 24h 重报。
  assert.equal(k.REVIVE_BACKOFF_HOURS, 6)
  assert.equal(k.ALERT_DEDUPE_HOURS, 24)
  assert.equal(rev.verdict, 'reversible')
  assert.equal(rev.keepRevive, true)
  assert.equal(rev.reviveBackoffHours, 6, '可逆失败必须仍是 6h 后自动解摘再试')
  assert.equal(rev.dedupeHours, 24)
  // 反向牙:判死与可逆在 keepRevive / reviveBackoffHours 上必须显式不同,而非一刀切。
  assert.equal(dead.verdict, 'terminal')
  assert.equal(dead.keepRevive, false)
  assert.equal(dead.reviveBackoffHours, null)
  assert.notEqual(dead.reviveBackoffHours, rev.reviveBackoffHours, '判死与可逆必须区分')
  assert.notEqual(dead.skipThisRound, rev.skipThisRound)
})

// ── 回归:既有选靶口径不受三处修复影响 ────────────────────────────────────────
test('回归:alertTargetsOf 仍只挑「已摘除 或 down」,判死分流不扩大选靶面', () => {
  const rows = [
    { providerCode: 'a', uid: 'u1', tempUnschedulable: true, healthStatus: 'unknown' },
    { providerCode: 'a', uid: 'u2', tempUnschedulable: false, healthStatus: 'down' },
    { providerCode: 'a', uid: 'u3', tempUnschedulable: false, healthStatus: 'healthy' },
    null,
  ]
  assert.equal(k.alertTargetsOf(rows).length, 2)
  assert.deepEqual(k.alertTargetsOf(null), [])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
