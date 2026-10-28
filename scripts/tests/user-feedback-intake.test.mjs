// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// user-feedback-intake 镜像测试(§22c:判据 import 源脚本 `__test__`,本文件零复制实现)。
//
// 钉八格:
//  ① 正常映射:导出件一行 bug ⇒ source=user_feedback / kind=user_report / severity=warn / route 缺省;
//  ② 缺必填字段拒收:缺 at 的记录整批 exit 2 且一条不落(不拿半批冒充已判定);
//  ③ identity 与 deploy-intake 同源:引用相等 + 源文件不得自带第二份实现;
//  ④ 24h 窗口去重、超窗再产;
//  ⑤ dry-run 零写入(默认档),`--apply` 才落账且二次跑幂等;
//  ⑥ 空输入(0 字节导出件)不崩、signals=0 仍是已判定;
//  ⑦ 陈旧导出件 ⇒ exit 2 未判定(本器唯一自带判据,防"0 字节"被读成"本库零反馈");
//  ⑧ 参数形状坏(未知旗标 / --minutes 非正整数)⇒ exit 2。
//
// 变异自证:`UFI_SRC=<变异体>` 可把被测源换成影子件(仅供变异演练,生产不设该变量;
// 演练记录见交付报告)。身份同源那一例(③)在换掉 identityOf 后必红。
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { identityOf as clusterIdentityOf, loadContract } from '../lib/incident-cluster.mjs'

const SRC = process.env.UFI_SRC
  ? resolve(process.env.UFI_SRC)
  : resolve(fileURLToPath(import.meta.url), '../../user-feedback-intake.mjs')
const UFI = await import(pathToFileURL(SRC).href)
const { __test__ } = UFI
const { planForFeedback, judgeFreshness, RESULT_PREFIX, SOURCE, DEFAULT_STALE_HOURS } = __test__

const contract = loadContract()
const scratch = mkScratch('user-feedback-intake')
after(() => rmScratch(scratch))

const AT = '2026-10-28T10:00:00.000Z'

/** 适配器读到的记录形状(与 auto-triage.readUserFeedback 产出的逐键一致)。 */
function fb(over = {}) {
  return {
    at: AT,
    label: 'bug:导出失败',
    objectText: 'bug|导出失败|点导出没反应',
    evidence: 'type=bug status=pending title=导出失败',
    ...over,
  }
}

/** 导出件一行(readUserFeedback 的 JSONL 契约:at/type/status/title/content/id)。 */
function row(over = {}) {
  return { at: AT, type: 'bug', status: 'pending', title: '导出失败', content: '点导出没反应', id: 'f1', ...over }
}

let seq = 0
function caseDir() {
  const d = join(scratch, `c${++seq}`)
  mkdirSync(d, { recursive: true })
  return d
}

function writeJsonl(dir, rows, name = 'export.jsonl') {
  const p = join(dir, name)
  writeFileSync(p, rows.length ? `${rows.map((r) => JSON.stringify(r)).join('\n')}\n` : '', 'utf8')
  return p
}

function cli(dir, argv) {
  const out = join(dir, 'out.jsonl')
  const r = spawnSync(process.execPath, [SRC, '--out', out, ...argv], { encoding: 'utf8', windowsHide: true })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', out }
}

test('① 正常映射:bug 反馈 ⇒ user_report/warn,route 缺省', () => {
  const dir = caseDir()
  const p = writeJsonl(dir, [row()])
  const r = cli(dir, ['--in', p])
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, new RegExp(`${RESULT_PREFIX} signals=1 skipped=0 undetermined=0 `))
  assert.match(r.stdout, /dry-run=1/)
  assert.equal(existsSync(r.out), false, 'dry-run 不得落盘')

  const one = __test__.recordToSignal(SOURCE, fb(), contract)
  assert.equal(one.produce, true)
  assert.equal(one.signal.source, 'user_feedback')
  assert.equal(one.signal.kind, 'user_report')
  assert.equal(one.signal.severity, 'warn')
  assert.equal('route' in one.signal, false, 'route 必须缺省(退 msg 归一身份)')
})

test('② 缺必填字段拒收:缺 at ⇒ exit 2 且一条不落', () => {
  const dir = caseDir()
  const p = writeJsonl(dir, [row(), { type: 'bug', status: 'pending', title: '缺时刻', content: 'x', id: 'f2' }])
  const r = cli(dir, ['--in', p])
  assert.equal(r.status, 2, `应判未判定,实得 rc=${r.status}`)
  assert.match(r.stderr, /未判定/)
  assert.match(r.stderr, /BAD-ROW/)
  assert.match(r.stdout, /judged=0/)
  assert.doesNotMatch(r.stdout, /signals=1/, '坏行不得连坐成"半批已落"')
  assert.equal(existsSync(r.out), false)
})

test('③ identity 与 deploy-intake 同源(引用相等,禁第二份实现)', () => {
  assert.equal(__test__.identityOf, clusterIdentityOf, 'identityOf 必须是 incident-cluster 的同一个函数对象')
  const src = readFileSync(SRC, 'utf8')
  assert.doesNotMatch(src, /function\s+identityOf\s*\(/, '源文件不得自带第二份 identityOf 实现')
  assert.doesNotMatch(src, /const\s+identityOf\s*=/, '源文件不得自带第二份 identityOf 实现')

  const sig = { source: SOURCE, kind: 'user_report', message: 'bug|导出失败|点导出没反应' }
  assert.equal(__test__.identityOf(sig), clusterIdentityOf(sig))
  assert.notEqual(clusterIdentityOf(sig), clusterIdentityOf({ ...sig, kind: 'http_error' }), '跨 kind 不得并桶')
  assert.notEqual(clusterIdentityOf(sig), clusterIdentityOf({ ...sig, source: 'api_logs' }), '跨 source 不得并桶')
})

test('④ 24h 窗口去重:同身份 1h 内只产一次,超 24h 再产', () => {
  const same = planForFeedback({
    records: [fb(), fb({ at: '2026-10-28T11:00:00.000Z' })],
    contract,
  })
  assert.equal(same.signals.length, 1)
  assert.equal(same.skipped, 1)
  assert.equal(same.undetermined, 0)

  const far = planForFeedback({
    records: [fb(), fb({ at: '2026-10-29T12:00:00.000Z' })],
    contract,
  })
  assert.equal(far.signals.length, 2)

  const idem = planForFeedback({
    records: [fb()],
    contract,
    existing: same.signals,
  })
  assert.equal(idem.signals.length, 0, '--out 已有同身份行必须计入去重')
  assert.equal(idem.skipped, 1)
})

test('⑤ dry-run 零写入;--apply 落账且二次跑幂等', () => {
  const dir = caseDir()
  const p = writeJsonl(dir, [row()])

  const dry = cli(dir, ['--in', p])
  assert.equal(dry.status, 0, dry.stderr)
  assert.equal(existsSync(dry.out), false, '默认档必须零写入')

  const first = cli(dir, ['--in', p, '--apply'])
  assert.equal(first.status, 0, first.stderr)
  assert.match(first.stdout, /signals=1 /)
  assert.equal(existsSync(first.out), true)
  const lines = readFileSync(first.out, 'utf8').trim().split('\n')
  assert.equal(lines.length, 1)
  const sig = JSON.parse(lines[0])
  assert.equal(sig.source, 'user_feedback')
  assert.equal(sig.kind, 'user_report')
  assert.equal(sig.severity, 'warn')
  assert.equal(typeof sig.message, 'string')
  assert.ok(sig.message.length > 0)

  const second = cli(dir, ['--in', p, '--apply'])
  assert.equal(second.status, 0, second.stderr)
  assert.match(second.stdout, /signals=0 skipped=1 /, '同输入重复跑必须追加幂等')
  assert.equal(readFileSync(first.out, 'utf8').trim().split('\n').length, 1)
})

test('⑥ 空输入(0 字节导出件)不崩、signals=0 仍是已判定', () => {
  const dir = caseDir()
  const p = writeJsonl(dir, [])
  assert.equal(readFileSync(p, 'utf8'), '')
  const r = cli(dir, ['--in', p])
  assert.equal(r.status, 0, `空输入应判已判定,实得 rc=${r.status} / ${r.stderr}`)
  assert.match(r.stdout, new RegExp(`${RESULT_PREFIX} signals=0 skipped=0 undetermined=0 `))
  assert.match(r.stdout, /dry-run=1/)

  const empty = planForFeedback({ records: [], contract })
  assert.equal(empty.signals.length, 0)
  assert.equal(empty.undetermined, 0)
})

test('⑦ 陈旧导出件 ⇒ exit 2 未判定(0 字节不得冒充"本库零反馈")', () => {
  const dir = caseDir()
  const p = writeJsonl(dir, [row()])
  const old = new Date('2026-10-01T00:00:00.000Z')
  utimesSync(p, old, old)
  const r = cli(dir, ['--in', p])
  assert.equal(r.status, 2, `陈旧件应判未判定,实得 rc=${r.status}`)
  assert.match(r.stderr, /陈旧/)
  assert.match(r.stdout, /judged=0/)
  assert.equal(existsSync(r.out), false)

  const NOW = Date.parse('2026-10-28T12:00:00.000Z')
  const statOf = (mtimeMs, size = 0) => () => ({ mtimeMs, size })
  assert.equal(judgeFreshness('x', { now: NOW, stat: statOf(NOW - 60_000) }).status, 'fresh')
  assert.equal(judgeFreshness('x', { now: NOW, stat: statOf(NOW - (DEFAULT_STALE_HOURS + 1) * 3_600_000) }).status, 'stale')
  assert.equal(
    judgeFreshness('x', { now: NOW, staleHours: 0, stat: statOf(NOW - 999 * 3_600_000) }).status,
    'fresh',
    'staleHours=0 是显式关闭该维',
  )
  const missing = judgeFreshness('x', {
    now: NOW,
    stat: () => {
      const e = new Error('nope')
      e.code = 'ENOENT'
      throw e
    },
  })
  assert.equal(missing.status, 'missing')
})

test('⑧ 参数形状坏 ⇒ exit 2(未知旗标 / --minutes 非正整数 / --stale-hours 负数)', () => {
  const dir = caseDir()
  const p = writeJsonl(dir, [row()])
  for (const bad of [['--nope'], ['--minutes', '0'], ['--minutes', 'abc'], ['--stale-hours', '-1']]) {
    const r = cli(dir, ['--in', p, ...bad])
    assert.equal(r.status, 2, `argv=${bad.join(' ')} 应 exit 2,实得 ${r.status}`)
    assert.match(r.stderr, /参数错误/, `argv=${bad.join(' ')} 应点名参数错`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
