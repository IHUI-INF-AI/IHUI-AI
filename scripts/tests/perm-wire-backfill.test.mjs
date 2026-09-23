// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:直接 import 源脚本的 __test__,不复制判据实现。
// 全程不连库 —— 所有断言都是纯函数/字符串层面的。
// 运行:node --test scripts/tests/perm-wire-backfill.test.mjs

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as B } from '../perm-wire-backfill.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC_FILE = join(ROOT, 'scripts', 'perm-wire-backfill.mjs')
const registrySrc = readFileSync(join(ROOT, B.REGISTRY_REL), 'utf8')
const mapping = B.deriveMapping(registrySrc)
const TARGET = B.normalizeTarget({})

test('__test__ 锚点齐全(防镜像漂移)', () => {
  for (const k of [
    'deriveMapping',
    'planApplyGates',
    'buildUpdateSql',
    'buildRollbackSql',
    'parseSnapshotCsv',
    'runVerify',
  ]) {
    assert.ok(k in B, `缺少导出判据 ${k}`)
  }
})

test('映射派生自注册表:只含"落库拼写 ≠ 规范拼写"的对,无恒等项', () => {
  assert.deepEqual(mapping.pairs, [
    { from: 'accept-edits', to: 'acceptEdits' },
    { from: 'bypass-permissions', to: 'bypassPermissions' },
  ])
  for (const p of mapping.pairs) assert.notEqual(p.from, p.to)
})

test('注册表漂移即抛错(不凭记忆构造映射)', () => {
  const drop = registrySrc.replace(/export const PERMISSION_MODE_WIRE\b[\s\S]*?\n\s*\}/, '')
  assert.throws(() => B.deriveMapping(drop), /未找到 PERMISSION_MODE_WIRE/)
  // 键不在 PERMISSION_MODES 内
  assert.throws(
    () =>
      B.deriveMapping(
        registrySrc.replace("acceptEdits: 'accept-edits'", "acceptEditsX: 'accept-edits'"),
      ),
    /不在 PERMISSION_MODES 内/,
  )
  // 值不在 PERMISSION_MODE_WIRE_VALUES 内
  assert.throws(
    () =>
      B.deriveMapping(
        registrySrc.replace(
          "bypassPermissions: 'bypass-permissions'",
          "bypassPermissions: 'bypass-all'",
        ),
      ),
    /不在 PERMISSION_MODE_WIRE_VALUES 内/,
  )
  // 全部恒等(两侧同步改)→ 无事可做,同样拒绝空跑
  const identity = registrySrc
    .replace("acceptEdits: 'accept-edits'", "acceptEdits: 'acceptEdits'")
    .replace("bypassPermissions: 'bypass-permissions'", "bypassPermissions: 'bypassPermissions'")
    .replace("'accept-edits',", "'acceptEdits',")
    .replace("'bypass-permissions',", "'bypassPermissions',")
  assert.throws(() => B.deriveMapping(identity), /映射为空/)
})

test('SQL 文本形态:UPDATE 只认 kebab、SET 只写 camel', () => {
  const countSql = B.buildCountSql(mapping, TARGET)
  assert.match(countSql, /SELECT 'accept-edits' AS legacy_value, count\(\*\) AS rows_to_update/)
  assert.match(countSql, /UNION ALL/)
  const updates = B.buildUpdateSql(mapping, TARGET)
  assert.deepEqual(updates, [
    `UPDATE "workspace_permissions" SET "mode" = 'acceptEdits' WHERE "mode" = 'accept-edits'`,
    `UPDATE "workspace_permissions" SET "mode" = 'bypassPermissions' WHERE "mode" = 'bypass-permissions'`,
  ])
  assert.match(
    B.buildSnapshotSql(TARGET, mapping),
    /SELECT "id" AS id, "mode" AS before_value FROM "workspace_permissions" WHERE "mode" IN \('accept-edits', 'bypass-permissions'\) ORDER BY 1/,
  )
  assert.match(
    B.buildNewKebabWritesSql(TARGET, mapping, '2026-09-20T00:00:00Z'),
    /AND "updated_at" >= '2026-09-20T00:00:00Z'::timestamptz/,
  )
})

test('幂等:SET 值永不出现在任何 WHERE 里,二次执行必 0 命中', () => {
  const fromSql = B.buildUpdateSql(mapping, TARGET).map((s) => {
    const m = /SET "mode" = '([^']+)' WHERE "mode" = '([^']+)'/.exec(s)
    assert.ok(m, `UPDATE 语句形态非法:${s}`)
    return { set: m[1], where: m[2] }
  })
  assert.deepEqual(
    fromSql,
    mapping.pairs.map((p) => ({ set: p.to, where: p.from })),
  )
  const whereValues = new Set(fromSql.map((x) => x.where))
  for (const x of fromSql) assert.equal(whereValues.has(x.set), false, `${x.set} 二次跑仍会被命中`)
  // 已是 camel 的行:没有任何一条 WHERE 能匹配 → 0 影响
  const camelRows = mapping.pairs.map((p) => p.to)
  assert.equal(camelRows.filter((v) => whereValues.has(v)).length, 0)
})

test('未知值一律抛错,绝不猜映射', () => {
  assert.equal(
    B.assertKnownValues(['default', 'accept-edits', 'acceptEdits', 'plan'], mapping),
    true,
  )
  assert.throws(() => B.assertKnownValues(['Accept-Edits'], mapping), /未知落库值/)
  assert.throws(
    () => B.assertKnownValues(['auto', 'plan-only', 'acceptEdits'], mapping),
    /未知落库值:auto, plan-only/,
  )
})

test('闸1:缺 confirm 串即拒绝(错值同样拒绝,且不回显)', () => {
  const base = {
    dsn: 'postgres://x@db.internal:5432/d',
    confirm: B.CONFIRM_STRING,
    verifyRanInProcess: true,
  }
  assert.equal(B.planApplyGates(base).ok, true)
  for (const bad of [undefined, '', 'perm-wire-backfill-step2', `${B.CONFIRM_STRING} `, 'OTHER']) {
    const g = B.planApplyGates({ ...base, confirm: bad })
    assert.equal(g.ok, false, `confirm=${JSON.stringify(bad)} 必须被拒`)
    assert.match(g.reasons.join('\n'), /闸1/)
    const echoed = g.reasons.join('\n')
    if (bad) assert.ok(!echoed.includes(String(bad)), '拒绝理由不得回显传入值')
  }
})

test('闸2:生产目标默认拒绝;未申报 dsn 也拒绝', () => {
  assert.equal(B.isProdTarget('postgres://u:p@api.aizhs.top/ihui'), true)
  assert.equal(B.isProdTarget('postgresql://u:p@10.0.0.7:8810/ihui'), true)
  assert.equal(B.isProdTarget('postgres://u:p@127.0.0.1:5432/ihui'), false)
  const prod = {
    dsn: 'postgres://u:p@api.aizhs.top/ihui',
    confirm: B.CONFIRM_STRING,
    verifyRanInProcess: true,
  }
  const g = B.planApplyGates(prod)
  assert.equal(g.ok, false)
  assert.match(g.reasons.join('\n'), /闸2/)
  // 申报窗口后放行,但缺窗口仍拒
  assert.equal(B.planApplyGates({ ...prod, target: 'prod', window: '09-25 02:00' }).ok, true)
  assert.equal(B.planApplyGates({ ...prod, target: 'prod' }).ok, false)
  assert.match(B.planApplyGates({ ...prod, dsn: '' }).reasons.join('\n'), /未提供 --dsn/)
})

test('闸3:只传参数不算,必须本次进程内实际先跑 --verify', () => {
  const paramsOnly = {
    dsn: 'postgres://u:p@127.0.0.1:5432/d',
    confirm: B.CONFIRM_STRING,
    verifyRanInProcess: false,
  }
  const g = B.planApplyGates(paramsOnly)
  assert.equal(g.ok, false)
  assert.match(g.reasons.join('\n'), /闸3 未通过:本次进程内未先成功执行 --verify/)
  const verifyFailed = {
    ...paramsOnly,
    verifyRanInProcess: true,
    verifyErrors: ['未知落库值: foo'],
  }
  assert.match(B.planApplyGates(verifyFailed).reasons.join('\n'), /闸3 未通过:--verify 阶段报错/)
})

test('闸3:--apply 缺 --since 即拒绝(无法量化"kebab 新增写入 = 0")', () => {
  const base = {
    dsn: 'postgres://u:p@127.0.0.1:5432/d',
    confirm: B.CONFIRM_STRING,
    verifyRanInProcess: true,
    requireObserveWindow: true,
  }
  assert.match(B.planApplyGates(base).reasons.join('\n'), /必须给 --since/)
  assert.equal(B.planApplyGates({ ...base, since: '2026-09-20T00:00:00Z' }).ok, true)
  // 回滚是修复动作,不要求观察窗口
  assert.equal(B.planApplyGates({ ...base, requireObserveWindow: false }).ok, true)
})

test('不碰迁移账本:生成的 SQL 只有目标表的 SELECT/UPDATE,无 journal / __drizzle_migrations / DDL', () => {
  const all = [
    B.buildCountSql(mapping, TARGET),
    B.buildSnapshotSql(TARGET, mapping),
    B.buildDistributionSql(TARGET, mapping),
    B.buildDistinctSql(TARGET),
    B.buildNewKebabWritesSql(TARGET, mapping, '2026-09-20T00:00:00Z'),
    ...B.buildUpdateSql(mapping, TARGET),
    ...B.buildRollbackSql([{ id: 'a1', before: 'accept-edits', after: 'acceptEdits' }], TARGET),
  ].join('\n')
  assert.ok(!/__drizzle_migrations|journal/i.test(all), '回填工具不得触碰迁移账本')
  assert.ok(!/^\s*(CREATE|ALTER|DROP)\b/m.test(all), '第②步是数据回填,不是 schema 变更')
  assert.ok(!/\bINSERT\b|\bDELETE\b/i.test(all), '只允许 SELECT 与幂等 UPDATE')
})

test('连接串脱敏:密码/主机/端口一律不外泄', () => {
  const out = B.redactDsn('postgres://u:S3cr3tPwd@api.aizhs.top:8810/ihui')
  for (const secret of ['S3cr3tPwd', 'aizhs', '8810', 'u:']) {
    assert.ok(!out.includes(secret), `脱敏结果泄漏 ${secret}:${out}`)
  }
  assert.match(out, /^postgr\*\*\*\w+$/)
  assert.equal(B.redactDsn(''), '<未提供>')
  assert.equal(B.redactDsn('abc'), '***')
})

test('快照 → 回滚双向可逆,且按 id + 当前值双限定', () => {
  const rows = [
    { id: 'a1', before: 'accept-edits', after: 'acceptEdits' },
    { id: 'b2', before: 'bypass-permissions', after: 'bypassPermissions' },
  ]
  const csv = B.formatSnapshotCsv(TARGET, rows, { created: '2026-09-23T00:00:00.000Z' })
  const parsed = B.parseSnapshotCsv(csv)
  assert.deepEqual(parsed.target, TARGET)
  assert.deepEqual(parsed.rows, rows)
  assert.equal(B.validateRollbackRows(parsed.rows, mapping), true)
  assert.deepEqual(B.buildRollbackSql(parsed.rows, parsed.target), [
    `UPDATE "workspace_permissions" SET "mode" = 'accept-edits' WHERE "id" = 'a1' AND "mode" = 'acceptEdits'`,
    `UPDATE "workspace_permissions" SET "mode" = 'bypass-permissions' WHERE "id" = 'b2' AND "mode" = 'bypassPermissions'`,
  ])
  assert.throws(
    () =>
      B.validateRollbackRows([{ id: 'x', before: 'accept-edits', after: 'accept-edits' }], mapping),
    /快照行不自洽/,
  )
  assert.throws(() => B.parseSnapshotCsv('id,before\nx,y'), /表头/)
  assert.throws(
    () => B.parseSnapshotCsv('# table=t column=m id_column=id\nid,before,after\n'),
    /快照为空/,
  )
  assert.throws(
    () => B.parseSnapshotCsv('# table=t column=m id_column=id\nid,before,after\nx,y,z,w'),
    /格式非法/,
  )
})

test('快照落点必须留在仓库内 logs/ 或 .ihui-agent/ 下', () => {
  assert.match(
    B.resolveSnapshotPath(ROOT, undefined, 'ts').file,
    /\.ihui-agent[/\\]tmp[/\\]perm-wire-backfill[/\\]perm-wire-snapshot-ts\.csv$/,
  )
  assert.match(
    B.resolveSnapshotPath(ROOT, 'logs', 'ts').file,
    /logs[/\\]perm-wire-snapshot-ts\.csv$/,
  )
  assert.throws(() => B.resolveSnapshotPath(ROOT, '../outside', 'ts'), /越出仓库/)
  assert.throws(() => B.resolveSnapshotPath(ROOT, ROOT, 'ts'), /越出仓库/)
  assert.throws(() => B.resolveSnapshotPath(ROOT, 'tmp', 'ts'), /仓库内 logs/)
})

test('离线 --verify:不连库,估算诚实标注"需连库"且不给假数字', async () => {
  const lines = []
  const r = await B.runVerify({ mapping, target: TARGET, dsn: '', log: (l) => lines.push(l) })
  const text = lines.join('\n')
  assert.equal(r.errors.length, 0)
  assert.equal(r.connected, false)
  assert.match(text, /UPDATE "workspace_permissions" SET "mode" = 'acceptEdits'/)
  assert.match(text, /估算需连库|离线模式不连库,估算需连库/)
  assert.match(text, /行数 = 需连库\(禁止估算\)/)
  assert.ok(!/待回填 \d+ 行/.test(text), '离线模式不得编出行数')
})

test('标识符白名单:非法 --table/--column 直接抛错', () => {
  assert.throws(() => B.normalizeTarget({ table: 'x"; DROP TABLE users; --' }), /非法 SQL 标识符/)
  assert.throws(() => B.normalizeTarget({ column: '1abc' }), /非法 SQL 标识符/)
})

test('判据有效性:注入"去掉 confirm 校验"的变异体,同一断言必须红', async () => {
  const src = readFileSync(SRC_FILE, 'utf8')
  const anchor = 'opts.confirm !== CONFIRM_STRING'
  assert.ok(src.includes(anchor), '变异锚点丢失:请同步本测试')
  const mutantDir = join(ROOT, '.ihui-agent', 'tmp', 'perm-wire-backfill-test')
  mkdirSync(mutantDir, { recursive: true })
  const mutantFile = join(mutantDir, 'mutant-no-confirm.mjs')
  const depHref = pathToFileURL(join(ROOT, 'scripts', 'check-permission-mode-vocabulary.mjs')).href
  const mutantSrc = src
    .replace("from './check-permission-mode-vocabulary.mjs'", `from '${depHref}'`)
    .replace(anchor, 'false /* 人为移除闸1 */')
  assert.notEqual(mutantSrc, src, '变异未生效,断言会假绿')
  writeFileSync(mutantFile, mutantSrc, 'utf8')
  try {
    const M = (await import(pathToFileURL(mutantFile).href)).__test__
    const probe = {
      dsn: 'postgres://u:p@127.0.0.1:5432/d',
      confirm: undefined,
      verifyRanInProcess: true,
    }
    // 真源码:必须拒(若有人删掉闸1,这条立即红)
    assert.equal(B.planApplyGates(probe).ok, false)
    // 变异体:同一入参被放行 ⇒ 证明本测试确实咬住了 confirm 判据
    const mutated = M.planApplyGates(probe)
    assert.equal(mutated.ok, true, `变异体仍拒绝,说明断言没咬住判据:${mutated.reasons.join('|')}`)
    assert.notDeepEqual(
      B.planApplyGates(probe).reasons.filter((r) => r.startsWith('闸1')).length,
      M.planApplyGates(probe).reasons.filter((r) => r.startsWith('闸1')).length,
    )
  } finally {
    rmSync(mutantDir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
