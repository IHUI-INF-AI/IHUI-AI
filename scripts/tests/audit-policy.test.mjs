// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 审计策略判据的回归网(2026-11-26 立,第十八件)。
 *
 * 钉住四类边界:
 *   (a) auditpol /r 的 CSV 解析 —— 含本机实测到的三处形状:
 *       ① 表头行必须丢;② Subcategory 列大量为空(只剩 GUID)仍要解析成功;
 *       ③ BOM 前缀不能污染第一列。
 *   (b) 设置值归四档,中英双语(本机现读是英文,但中文系统会是「成功和失败」)。
 *   (c) 判分三态:fetchError / 零行 ⇒ undetermined(不冒绿);critical 缺失 ⇒ breach;
 *       只缺 standard ⇒ ok + 观察。
 *   (d) 补齐命令形态:必须带花括号 GUID、必须双开 success+failure。
 *
 * 样本是固定夹具,不代表现读策略;实现层真跑 auditpol(见 check-audit-policy.mjs)。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AUDIT_POLICY_STATE,
  AUDIT_SUBCATEGORIES,
  INTENTIONALLY_UNSET,
  buildAuditSetCommands,
  judgeAuditPolicy,
  levelOfSetting,
  normalizeGuid,
  parseAuditPolicyCsv,
  remediationForAuditPolicy,
  splitCsvLine,
} from '../security/lib/audit-policy.mjs'

const HEADER = 'Machine Name,Policy Target,Subcategory,Subcategory GUID,Inclusion Setting,Exclusion Setting'

/** 造一条 auditpol CSV 行(默认 Subcategory 为空,复刻本机实测形状)。 */
function row(guid, setting, { sub = '', target = 'System', machine = '' } = {}) {
  return `${machine},${target},${sub},{${guid}},${setting},`
}

/** 造「全部关键子类都双开」的 CSV。 */
function allBothCsv() {
  return [HEADER, ...AUDIT_SUBCATEGORIES.map((s) => row(s.guid, 'Success and Failure'))].join('\n')
}

test('splitCsvLine:引号内的逗号不切分', () => {
  assert.deepEqual(splitCsvLine('a,"b,c",d'), ['a', 'b,c', 'd'])
  assert.deepEqual(splitCsvLine('a,b,c,d,e,f'), ['a', 'b', 'c', 'd', 'e', 'f'])
})

test('normalizeGuid:去花括号转小写', () => {
  assert.equal(normalizeGuid('{0CCE9215-69AE-11D9-BED3-505054503030}'), '0cce9215-69ae-11d9-bed3-505054503030')
  assert.equal(normalizeGuid('  0CCE9217-69AE-11D9-BED3-505054503030  '), '0cce9217-69ae-11d9-bed3-505054503030')
  assert.equal(normalizeGuid(null), '')
})

test('parseAuditPolicyCsv:表头行与空行丢弃,合法行保留', () => {
  const csv = [HEADER, '', row('0CCE9215-69AE-11D9-BED3-505054503030', 'Success and Failure')].join('\n')
  const rows = parseAuditPolicyCsv(csv)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].guid, '0cce9215-69ae-11d9-bed3-505054503030')
  assert.equal(rows[0].setting, 'Success and Failure')
})

test('parseAuditPolicyCsv:Subcategory 列为空仍解析成功(本机实测形状)', () => {
  const csv = [HEADER, row('0CCE9215-69AE-11D9-BED3-505054503030', 'No Auditing')].join('\n')
  const rows = parseAuditPolicyCsv(csv)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].subcategory, '')
  assert.equal(rows[0].setting, 'No Auditing')
})

test('parseAuditPolicyCsv:BOM 前缀不污染第一列', () => {
  const csv = `\uFEFF${HEADER}\n${row('0CCE9210-69AE-11D9-BED3-505054503030', 'Success')}`
  const rows = parseAuditPolicyCsv(csv)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].guid, '0cce9210-69ae-11d9-bed3-505054503030')
})

test('parseAuditPolicyCsv:GUID 非法的行丢弃(不猜)', () => {
  const csv = [HEADER, ',System,,{not-a-guid},Success,'].join('\n')
  assert.equal(parseAuditPolicyCsv(csv).length, 0)
})

test('levelOfSetting:四档 + 中英双语', () => {
  assert.equal(levelOfSetting('Success and Failure'), 'both')
  assert.equal(levelOfSetting('成功和失败'), 'both')
  assert.equal(levelOfSetting('Success'), 'success')
  assert.equal(levelOfSetting('成功'), 'success')
  assert.equal(levelOfSetting('Failure'), 'failure')
  assert.equal(levelOfSetting('失败'), 'failure')
  assert.equal(levelOfSetting('No Auditing'), 'none')
  assert.equal(levelOfSetting('无审核'), 'none')
  assert.equal(levelOfSetting(''), 'none')
  assert.equal(levelOfSetting(null), 'none')
})

test('judgeAuditPolicy:fetchError ⇒ undetermined(不冒绿)', () => {
  const r = judgeAuditPolicy({ rows: null, fetchError: 'auditpol 调用失败: 拒绝访问' })
  assert.equal(r.state, AUDIT_POLICY_STATE.UNDETERMINED)
  assert.match(r.reason, /拒绝访问/)
  assert.ok(r.observations.length > 0)
})

test('judgeAuditPolicy:零行 ⇒ undetermined(枚举 0 个候选不记绿)', () => {
  const r = judgeAuditPolicy({ rows: [] })
  assert.equal(r.state, AUDIT_POLICY_STATE.UNDETERMINED)
  assert.equal(r.checkedCount, 0)
})

test('judgeAuditPolicy:关键子类全双开 ⇒ ok', () => {
  const r = judgeAuditPolicy({ rows: parseAuditPolicyCsv(allBothCsv()) })
  assert.equal(r.state, AUDIT_POLICY_STATE.OK)
  assert.equal(r.critical.length, 0)
  assert.equal(r.bothCount, AUDIT_SUBCATEGORIES.length)
  assert.equal(r.checkedCount, AUDIT_SUBCATEGORIES.length)
})

test('judgeAuditPolicy:critical 缺失(No Auditing)⇒ breach 并点名', () => {
  const sc = AUDIT_SUBCATEGORIES.find((s) => s.name === 'Credential Validation')
  const csv = allBothCsv().replace(row(sc.guid, 'Success and Failure'), row(sc.guid, 'No Auditing'))
  const r = judgeAuditPolicy({ rows: parseAuditPolicyCsv(csv) })
  assert.equal(r.state, AUDIT_POLICY_STATE.BREACH)
  assert.equal(r.critical.length, 1)
  assert.equal(r.critical[0].name, 'Credential Validation')
  assert.equal(r.critical[0].missingSide, '全部(现在无审核)')
  assert.match(r.reason, /Credential Validation/)
})

test('judgeAuditPolicy:critical 只有 Success ⇒ breach 且缺失败面', () => {
  const sc = AUDIT_SUBCATEGORIES.find((s) => s.name === 'Security Group Management')
  const csv = allBothCsv().replace(row(sc.guid, 'Success and Failure'), row(sc.guid, 'Success'))
  const r = judgeAuditPolicy({ rows: parseAuditPolicyCsv(csv) })
  assert.equal(r.state, AUDIT_POLICY_STATE.BREACH)
  assert.equal(r.critical[0].name, 'Security Group Management')
  assert.equal(r.critical[0].missingSide, '失败面')
})

test('judgeAuditPolicy:子类完全不在输出里 ⇒ 按缺失处理(不当作已开)', () => {
  const csv = [HEADER, ...AUDIT_SUBCATEGORIES.filter((s) => s.guid !== '0cce9228-69ae-11d9-bed3-505054503030').map((s) => row(s.guid, 'Success and Failure'))].join('\n')
  const r = judgeAuditPolicy({ rows: parseAuditPolicyCsv(csv) })
  assert.equal(r.state, AUDIT_POLICY_STATE.BREACH)
  assert.equal(r.critical[0].name, 'Sensitive Privilege Use')
  assert.equal(r.critical[0].setting, '(未出现在 auditpol 输出里)')
})

test('judgeAuditPolicy:只缺 standard ⇒ ok + observation', () => {
  const standard = AUDIT_SUBCATEGORIES.find((s) => s.level === 'standard')
  const csv = allBothCsv().replace(
    row(standard.guid, 'Success and Failure'),
    row(standard.guid, 'No Auditing'),
  )
  const r = judgeAuditPolicy({ rows: parseAuditPolicyCsv(csv) })
  assert.equal(r.state, AUDIT_POLICY_STATE.OK)
  assert.equal(r.standard.length, 1)
  assert.ok(r.observations.some((o) => o.includes(standard.name)))
})

test('judgeAuditPolicy:includeStandard 档下同样情形判 breach', () => {
  const standard = AUDIT_SUBCATEGORIES.find((s) => s.level === 'standard')
  const csv = allBothCsv().replace(
    row(standard.guid, 'Success and Failure'),
    row(standard.guid, 'No Auditing'),
  )
  const r = judgeAuditPolicy({ rows: parseAuditPolicyCsv(csv), includeStandard: true })
  assert.equal(r.state, AUDIT_POLICY_STATE.BREACH)
})

test('buildAuditSetCommands:带花括号 GUID 且双开 success+failure', () => {
  const cmds = buildAuditSetCommands([
    { guid: '0cce923f-69ae-11d9-bed3-505054503030', name: 'Credential Validation' },
  ])
  assert.equal(cmds.length, 1)
  assert.deepEqual(cmds[0], [
    '/set',
    '/subcategory:{0cce923f-69ae-11d9-bed3-505054503030}',
    '/success:enable',
    '/failure:enable',
  ])
})

test('buildAuditSetCommands:空集不造命令', () => {
  assert.equal(buildAuditSetCommands([]).length, 0)
  assert.equal(buildAuditSetCommands(undefined).length, 0)
})

test('remediationForAuditPolicy:三态各自给得出可执行下一步', () => {
  const breach = remediationForAuditPolicy({
    state: AUDIT_POLICY_STATE.BREACH,
    critical: [{ guid: '0cce923f-69ae-11d9-bed3-505054503030', name: 'Credential Validation', why: '4776' }],
  })
  assert.ok(breach.some((s) => s.includes('--apply')))
  assert.ok(breach.some((s) => s.includes('auditpol /set')))

  const undet = remediationForAuditPolicy({ state: AUDIT_POLICY_STATE.UNDETERMINED })
  assert.ok(undet.some((s) => s.includes('auditpol /get')))

  const ok = remediationForAuditPolicy({ state: AUDIT_POLICY_STATE.OK })
  assert.ok(ok.length > 0)
  assert.ok(ok.every((s) => typeof s === 'string' && s.length > 4))
})

test('关键子类表自身:22 条、GUID 唯一、level 只有两档', () => {
  assert.equal(AUDIT_SUBCATEGORIES.length, 22)
  const guids = new Set(AUDIT_SUBCATEGORIES.map((s) => s.guid))
  assert.equal(guids.size, AUDIT_SUBCATEGORIES.length)
  for (const s of AUDIT_SUBCATEGORIES) {
    assert.match(s.guid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    assert.ok(s.level === 'critical' || s.level === 'standard')
  }
  assert.ok(INTENTIONALLY_UNSET.length >= 5)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
