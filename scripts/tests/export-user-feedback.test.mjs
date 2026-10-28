// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/export-user-feedback.mjs` 的镜像测试(§22c:判据一律 import 源脚本 `__test__`,
 * 本文件**零复制判据**、不重写 SQL 字面量、不自己算导出格式)。
 *
 * 钉十一环:
 *  ① 只读红线 —— SQL 过 `assertReadOnlySql`;同一把尺对写语句**真抛**(不抛则锁是纸的);
 *  ② 取数形状 —— LIMIT 越界回落默认值且不拼进 SQL;
 *  ③ 解析 —— CRLF / 多余分隔符归并 / 坏行丢弃(错位比丢行更难查);
 *  ④ 渲染 —— JSONL 一行一对象;0 行 ⇒ 空串(空文件=判过,不是缺件);
 *  ⑤ 消费面兼容 —— 本器产出必须被 `auto-triage.readUserFeedback` 读成 ok 且只收未结;
 *  ⑥ 落点同源 —— 生产者写盘路径 === 消费方读取路径(同一份分诊配置,不造第二份真相);
 *  ⑦ 0 行 ⇒ rc 0(判过),落空文件;不把"该库该表为空"写成未判定;
 *  ⑧ 取不到 ⇒ rc 2(未判定),不写件、清陈旧件 —— 旧读数不得冒充本轮读数;
 *  ⑨ psql 缺席 / 生产口 / 非回环 ⇒ 未判定且逐条点名;
 *  ⑩ 形状坏 ⇒ rc 1(--limit 非法 / 路径空),不猜默认值;
 *  ⑪ dry-run 与 --keep-stale —— 前者不落盘,后者不清陈旧件。
 */
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as uf } from '../export-user-feedback.mjs'
import { loadConfig, readUserFeedback } from '../auto-triage.mjs'
import { assertReadOnlySql } from '../check-learn-video-mount.mjs'

const scratch = mkScratch('export-user-feedback-test')
after(() => rmScratch(scratch))

const ENV_TEXT = 'DATABASE_URL=postgresql://u:p@localhost:5432/ihui\n'
const readEnv = () => ENV_TEXT
const fakeLocate = () => ({ psql: 'psql-stub', tried: ['stub'] })
const spawnWith = (stdout) => () => ({ status: 0, stdout, stderr: '', lost: '' })
const spawnFail = (stderr) => () => ({ status: 1, stdout: '', stderr, lost: '' })
const sampleLine = 'id-1|bug|pending|报表打不开|点导出就 500|2026-10-28T01:00:00.000Z'

const exportTo = (name, extra = {}) =>
  uf.runExport({
    argv: ['--jsonl', join(scratch, name)],
    readFile: readEnv,
    locate: fakeLocate,
    spawn: spawnWith(`${sampleLine}\n`),
    processEnv: {},
    ...extra,
  })

test('① SQL 是单语句只读;同一把尺对写语句真抛', () => {
  const sql = uf.buildFeedbackExportSql(7)
  assert.doesNotThrow(() => assertReadOnlySql(sql), '本器 SQL 必须过只读闸')
  assert.match(sql, /^SELECT\b/)
  assert.ok(!sql.includes(';'), '不得多语句')
  assert.match(sql, /LIMIT 7$/)
  assert.throws(() => assertReadOnlySql(`${sql} DELETE FROM feedbacks`), /写|只读/)
  assert.throws(() => assertReadOnlySql('UPDATE feedbacks SET status = 1'), /只读|写/)
})

test('② LIMIT 越界回落默认值,不把坏数字拼进 SQL', () => {
  assert.match(uf.buildFeedbackExportSql(0), new RegExp(`LIMIT ${uf.EXPORT_LIMIT_DEFAULT}$`))
  assert.match(uf.buildFeedbackExportSql(uf.EXPORT_LIMIT_MAX + 1), new RegExp(`LIMIT ${uf.EXPORT_LIMIT_DEFAULT}$`))
  assert.match(uf.buildFeedbackExportSql(-5), new RegExp(`LIMIT ${uf.EXPORT_LIMIT_DEFAULT}$`))
})

test('③ 解析:CRLF / 多余分隔符归并 / 坏行丢弃', () => {
  const stdout = `${sampleLine}\r\nbad-line\r\nid-2|feature|reviewing|t|a|b|2026-10-27T00:00:00.000Z\r\n`
  const rows = uf.parseFeedbackRows(stdout)
  assert.equal(rows.length, 2, '坏行必须被丢弃而不是被读成一条空反馈')
  assert.equal(rows[0].id, 'id-1')
  assert.equal(rows[0].at, '2026-10-28T01:00:00.000Z')
  assert.equal(rows[1].content, 'a|b', '多余分隔符必须归并进上一个字段,不得整体错位')
})

test('④ 渲染:一行一对象;0 行 ⇒ 空串', () => {
  assert.equal(uf.renderExport([]), '')
  const body = uf.renderExport([{ at: '2026-10-28T01:00:00.000Z', type: 'bug', status: 'pending', title: 't', content: 'c', id: 'a' }])
  assert.ok(body.endsWith('\n'))
  assert.equal(JSON.parse(body.trim()).at, '2026-10-28T01:00:00.000Z')
})

test('⑤ 产出被 readUserFeedback 读成 ok,且只收未结', () => {
  const p = join(scratch, 'compat.jsonl')
  writeFileSync(p, uf.renderExport([
    { at: '2026-10-28T01:00:00.000Z', type: 'bug', status: 'pending', title: '导出失败', content: '报表打不开', id: 'a' },
    { at: '2026-10-28T02:00:00.000Z', type: 'bug', status: 'resolved', title: '已修', content: 'x', id: 'b' },
  ]), 'utf8')
  const read = readUserFeedback({ jsonlPath: p })
  assert.equal(read.status, 'ok')
  assert.equal(read.records.length, 1, 'resolved 必须被适配器丢掉(生产者已滤,适配器再滤一遍不冲突)')
  assert.match(read.records[0].label, /^bug:导出失败/)
})

test('⑥ 落点同源:配置那格非空 ⇒ 消费方走文件通道,生产者写的就是它读的那一格', () => {
  const cfg = loadConfig()
  const configured = String(cfg.userFeedback?.jsonl ?? '')
  assert.ok(configured.length > 0, '分诊配置必须点名 userFeedback.jsonl(非空才轮到文件通道)')
  const produced = uf.resolveExportPath(cfg, '')
  assert.ok(produced.endsWith(join('.ihui-agent', 'state', 'user-feedback-export.jsonl')), `落点异常:${produced}`)
  assert.ok(produced.endsWith(join(...configured.split('/'))), '生产者不得自持第二份路径字面量')
  // 缺件时消费方仍落「未判定」并点名该路径(说明它读的确实是这一格);生产者此时必须形状坏,两边不各自猜
  const miss = readUserFeedback({ jsonlPath: join(scratch, 'no-such.jsonl'), query: () => ({ status: 'undetermined', why: '夹具' }) })
  assert.equal(miss.status, 'undetermined')
  assert.throws(() => uf.resolveExportPath({ userFeedback: { jsonl: '' } }, ''), uf.ExportShapeError)
})

test('⑦ 查询成功 0 行 ⇒ rc 0(判过)+ 空文件', () => {
  const p = join(scratch, 'zero.jsonl')
  const r = uf.runExport({ argv: ['--jsonl', p], readFile: readEnv, locate: fakeLocate, spawn: spawnWith(''), processEnv: {} })
  assert.equal(r.rc, 0)
  assert.equal(r.status, 'ok')
  assert.equal(r.rows.length, 0)
  assert.ok(existsSync(p), '0 行也要落空文件:空文件是"判过"的留痕')
  assert.equal(readFileSync(p, 'utf8'), '')
  assert.ok(r.lines.some((l) => /不是未判定/.test(l)), '必须显式交代 0 行不是未判定')
})

test('⑧ 取不到 ⇒ rc 2,不写件,并清掉陈旧导出件', () => {
  const p = join(scratch, 'stale.jsonl')
  const old = uf.renderExport([{ at: '2026-10-27T00:00:00.000Z', type: 'bug', status: 'pending', title: '旧', content: '旧', id: 'old' }])
  writeFileSync(p, old, 'utf8')
  const r = uf.runExport({
    argv: ['--jsonl', p],
    readFile: readEnv,
    locate: fakeLocate,
    spawn: spawnFail('relation "feedbacks" does not exist'),
    processEnv: {},
  })
  assert.equal(r.rc, 2)
  assert.equal(r.status, 'undetermined')
  assert.ok(!existsSync(p), '未判定时旧导出件必须被清:否则消费方会把上一轮读数当本轮"无发现"')
  assert.match(r.why, /psql exit 1/, '脱敏可能吃掉文案,退出码必须留在理由里')
  assert.ok(r.lines.some((l) => /未判定/.test(l)))
})

test('⑨ psql 缺席 / 非回环 / 8810 ⇒ 未判定且逐条点名', () => {
  const p = join(scratch, 'guard.jsonl')
  const noPsql = uf.runExport({ argv: ['--jsonl', p], readFile: readEnv, locate: () => ({ psql: '', tried: ['stub'] }), spawn: spawnWith(''), processEnv: {} })
  assert.equal(noPsql.rc, 2)
  assert.match(noPsql.why, /psql/)

  const remote = uf.runExport({ argv: ['--jsonl', p, '--dsn', 'postgresql://u:p@10.0.0.9:5432/ihui'], readFile: readEnv, locate: fakeLocate, spawn: spawnWith(''), processEnv: {} })
  assert.equal(remote.rc, 2)
  assert.match(remote.why, /回环/)

  const tunnel = uf.runExport({ argv: ['--jsonl', p, '--dsn', 'postgresql://u:p@localhost:8810/ihui'], readFile: readEnv, locate: fakeLocate, spawn: spawnWith(''), processEnv: {} })
  assert.equal(tunnel.rc, 2)
  assert.match(tunnel.why, /8810/)
})

test('⑩ 形状坏:--limit 非法 / 路径空 ⇒ ExportShapeError(不猜默认)', () => {
  assert.throws(() => uf.runExport({ argv: ['--limit', '0'], readFile: readEnv, locate: fakeLocate, spawn: spawnWith(''), processEnv: {} }), uf.ExportShapeError)
  assert.throws(() => uf.runExport({ argv: ['--limit', 'abc'], readFile: readEnv, locate: fakeLocate, spawn: spawnWith(''), processEnv: {} }), uf.ExportShapeError)
  assert.throws(() => uf.resolveExportPath({ userFeedback: { jsonl: '' } }, ''), uf.ExportShapeError)
  assert.throws(() => uf.resolveExportPath({}, undefined), uf.ExportShapeError)
})

test('⑪ dry-run 不落盘;--keep-stale 不清陈旧件', () => {
  const dry = join(scratch, 'dry.jsonl')
  const r = uf.runExport({ argv: ['--jsonl', dry, '--dry-run'], readFile: readEnv, locate: fakeLocate, spawn: spawnWith(`${sampleLine}\n`), processEnv: {} })
  assert.equal(r.rc, 0)
  assert.equal(r.rows.length, 1)
  assert.ok(!existsSync(dry), 'dry-run 一个字节都不许落')

  const keep = join(scratch, 'keep.jsonl')
  writeFileSync(keep, `${sampleLine}\n`, 'utf8')
  const k = uf.runExport({ argv: ['--jsonl', keep, '--keep-stale'], readFile: readEnv, locate: fakeLocate, spawn: spawnFail('boom'), processEnv: {} })
  assert.equal(k.rc, 2)
  assert.ok(existsSync(keep), '--keep-stale 时必须保留陈旧件(显式逃生舱)')
})
