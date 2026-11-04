// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自陈述版本(2026-11-04 立)的镜像测试:只吃 `auditGuardianCodeFreshness` 的可注入面,
 * **绝不真重启** —— doRestart 一律用替身,断言只落在"调没调、调几次、审计行写了什么"。
 *
 * 三条行为锁(票面要求的最低集):
 *   T1 无新文件 ⇒ 不判红、不重启;
 *   T2 有新文件且未熔断 ⇒ 触发一次,审计行含触发文件与 mtime;
 *   T3 同一窗口内第二次 ⇒ 只判红不重启(失败同样占坑,不重试)。
 * 另加 T0(--check 零副作用)与 T4(扫描排除面),都是这条腿最容易漂的两格。
 *
 * 夹具一律走 lib/scratch-dir(§15b:禁 os.tmpdir、禁落仓库树内)。
 */

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { auditGuardianCodeFreshness, scanGuardianSources } from '../git-guardian.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const T0 = Date.parse('2026-11-04T05:00:00.000Z')
const START_AT = T0 - 60_000

/** 造一份"只有 a.mjs、比进程旧"的扫描结果。 */
function scanOk(mtimeMs = T0 - 120_000) {
  return {
    ok: true,
    scanned: 1,
    files: [{ path: 'scripts/a.mjs', mtimeMs }],
    maxSourceMtime: mtimeMs,
    maxSourceFile: 'scripts/a.mjs',
    unreadable: [],
  }
}

/** 一次可观测的调用:返回 restarts / notifies / logger 三本账。 */
function run({ dir, scan, now = T0, daemon = true, checkOnly = false }) {
  const trace = { restarts: [], notifies: [], logs: [] }
  const r = auditGuardianCodeFreshness({
    now,
    processStartAt: START_AT,
    scan,
    stateFile: join(dir, 'guardian-self-restart-last.json'),
    auditFile: join(dir, 'guardian-self-restart-audit.jsonl'),
    daemon,
    checkOnly,
    enabled: true,
    logger: (m) => trace.logs.push(String(m)),
    notify: (name, detail, opts) => trace.notifies.push({ name, detail, opts }),
    doRestart: () => {
      trace.restarts.push(now)
      return { ok: true, pid: 4242 }
    },
    beforeRestart: () => {},
  })
  return { r, ...trace }
}

test('T0 --check ⇒ 零副作用(不扫、不判红、不重启)', () => {
  const dir = mkScratch('guardian-self-freshness-t0-')
  try {
    let scans = 0
    const out = run({
      dir,
      checkOnly: true,
      scan: () => {
        scans += 1
        return scanOk()
      },
    })
    assert.equal(out.r.state, 'skipped')
    assert.equal(scans, 0, '--check 连扫描都不该做(CI 口径零副作用)')
    assert.deepEqual(out.restarts, [])
    assert.deepEqual(out.notifies, [])
    assert.equal(existsSync(join(dir, 'guardian-self-restart-last.json')), false)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T1 无新文件 ⇒ 判 ok、不判红、不重启', () => {
  const dir = mkScratch('guardian-self-freshness-t1-')
  try {
    const out = run({ dir, scan: () => scanOk(START_AT - 60_000) })
    assert.equal(out.r.state, 'ok')
    assert.deepEqual(out.restarts, [])
    assert.deepEqual(out.notifies, [])
    assert.match(out.logs.join('\n'), /守护自陈述版本:✅ ok .*newerThanProcess=\[\]/)
    // 绿轮也要有读数:processStartAt / maxSourceMtime 两个数必须在同一行里自陈述
    assert.match(out.logs.join('\n'), /processStartAt=/)
    assert.match(out.logs.join('\n'), /maxSourceMtime=/)
    assert.equal(existsSync(join(dir, 'guardian-self-restart-audit.jsonl')), false)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T2 有新文件且未超熔断 ⇒ 触发一次,审计行含触发文件与 mtime', () => {
  const dir = mkScratch('guardian-self-freshness-t2-')
  try {
    const newerAt = START_AT + 5_000
    const out = run({
      dir,
      scan: () => ({
        ok: true,
        scanned: 2,
        files: [
          { path: 'scripts/lib/immutable-guard.mjs', mtimeMs: newerAt },
          { path: 'scripts/git-guardian.mjs', mtimeMs: START_AT - 1_000 },
        ],
        maxSourceMtime: newerAt,
        maxSourceFile: 'scripts/lib/immutable-guard.mjs',
      }),
    })
    assert.equal(out.r.state, 'stale')
    assert.equal(out.r.restarted, true)
    assert.equal(out.restarts.length, 1, '未熔断时只许触发一次')
    assert.equal(out.notifies.length, 1, '判红必须走既有邮件出口')
    assert.match(out.notifies[0].name, /代码比进程新/)
    assert.match(out.logs.join('\n'), /❌ STALE/)
    // 审计行:动作前落盘,且含触发它的文件与 mtime
    const lines = readFileSync(join(dir, 'guardian-self-restart-audit.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l))
    assert.equal(lines.length, 1)
    assert.equal(lines[0].action, 'restart-self')
    assert.equal(lines[0].triggerFile, 'scripts/lib/immutable-guard.mjs')
    assert.equal(lines[0].triggerMtime, new Date(newerAt).toISOString())
    assert.equal(lines[0].processStartAt, new Date(START_AT).toISOString())
    // 熔断台账:窗口起点必须落在盘上(重启把进程带走之后仍可核)
    const state = JSON.parse(readFileSync(join(dir, 'guardian-self-restart-last.json'), 'utf8'))
    assert.equal(state.lastRestartAtMs, T0)
    assert.equal(state.triggerFile, 'scripts/lib/immutable-guard.mjs')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T3 同窗口第二次 ⇒ 只判红不重启', () => {
  const dir = mkScratch('guardian-self-freshness-t3-')
  try {
    const staleScan = () => scanOk(START_AT + 5_000)
    const first = run({ dir, scan: staleScan, now: T0 })
    const second = run({ dir, scan: staleScan, now: T0 + 30 * 60 * 1000 })
    assert.equal(first.r.restarted, true)
    assert.equal(second.r.state, 'stale')
    assert.equal(second.r.restarted, false)
    assert.equal(second.r.breaker, true, '第二次必须命中熔断,只报红')
    assert.equal(first.restarts.length + second.restarts.length, 1, '窗口内总动作次数 = 1')
    assert.equal(
      first.notifies.length + second.notifies.length,
      2,
      '每轮都要判红,熔断只压动作不压判据',
    )
    assert.match(second.logs.join('\n'), /熔断/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('T4 扫描面:排除 tests/data,只收 .mjs 与 scripts/lib 全量', () => {
  const s = scanGuardianSources()
  assert.equal(s.ok, true, '真实仓的 scripts 面必须可扫')
  assert.ok(s.scanned > 100, `扫描面过窄(scanned=${s.scanned}),可能把整片源码漏在外面`)
  assert.ok(Number.isFinite(s.maxSourceMtime) && s.maxSourceMtime > 0)
  for (const f of s.files) {
    const rel = f.path.replace(/\\/g, '/')
    assert.ok(!/\/tests\//.test(rel), `扫描面混进了测试夹具: ${rel}`)
    assert.ok(!/\/data\//.test(rel), `扫描面混进了配置/台账: ${rel}`)
    assert.ok(/\.mjs$/.test(rel) || /\/scripts\/lib\//.test(rel), `扫描面混进了非源码文件: ${rel}`)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 闭包档(2026-11-05 立)。现读证据:扫描面是全 scripts/(1054 枚),而绝大多数是被 spawn 的子脚本
// —— 子进程每次都用盘上最新字节,常驻守护载不载与它们无关。本仓活跃时"比进程新"结构性恒真:
// 24h 内该主题寄了 7 封、身份在 3 个之间跳,并为"无关文件的字节"重启了 4 次常驻守护。
// 这不是把告警调宽,是把**量错的对象**修窄;被排除的枚数照实进读数,量窄这件事本身不许静默。
// ─────────────────────────────────────────────────────────────────────────────
function scanTwo(newOnes) {
  const files = [
    { path: 'scripts/git-guardian.mjs', mtimeMs: T0 - 120_000 },
    { path: 'scripts/lib/in-proc.mjs', mtimeMs: T0 - 120_000 },
    { path: 'scripts/check-spawned.mjs', mtimeMs: T0 - 120_000 },
  ].map((f) => (newOnes.includes(f.path) ? { ...f, mtimeMs: T0 + 1000 } : f))
  return {
    ok: true,
    scanned: files.length,
    files,
    maxSourceMtime: Math.max(...files.map((f) => f.mtimeMs)),
    maxSourceFile: 'scripts/check-spawned.mjs',
    unreadable: [],
  }
}
const CLOSURE = { set: new Set(['scripts/git-guardian.mjs', 'scripts/lib/in-proc.mjs']), why: '' }

function runClosure({ dir, scan, closure }) {
  const trace = { restarts: 0, notifies: [], logs: [] }
  const r = auditGuardianCodeFreshness({
    now: T0,
    processStartAt: START_AT,
    scan,
    closure,
    stateFile: join(dir, 'self-last.json'),
    auditFile: join(dir, 'self-audit.jsonl'),
    daemon: true,
    checkOnly: false,
    enabled: true,
    logger: (m) => trace.logs.push(String(m)),
    notify: (name, detail, opts) => trace.notifies.push({ name, detail, opts }),
    doRestart: () => {
      trace.restarts += 1
      return { ok: true, pid: 1 }
    },
    beforeRestart: () => {},
  })
  return { r, trace }
}

const CLS = '闭包档'
test(`${CLS}① 闭包内那枚比进程新 ⇒ 仍判红,且读数写明"排除几枚 spawn 面"`, async () => {
  const dir = mkScratch('gsf-')
  try {
    const { r, trace } = runClosure({
      dir,
      scan: () => scanTwo(['scripts/lib/in-proc.mjs', 'scripts/check-spawned.mjs']),
      closure: CLOSURE,
    })
    assert.notEqual(r.state, 'ok', '闭包内变新必须仍喊')
    assert.equal(trace.notifies.length, 1)
    assert.match(trace.logs.join('\n'), /排除 1 枚非本进程加载/)
    assert.match(String(trace.notifies[0].opts.dedupKey), /:closure:/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})
test(`${CLS}② 成对反向:只有 spawn 面变新 ⇒ ok、零发信、零重启`, async () => {
  const dir = mkScratch('gsf-')
  try {
    const { r, trace } = runClosure({
      dir,
      scan: () => scanTwo(['scripts/check-spawned.mjs']),
      closure: CLOSURE,
    })
    assert.equal(r.state, 'ok')
    assert.equal(trace.notifies.length, 0, '与常驻进程无关的字节变化不该喊到人')
    assert.equal(trace.restarts, 0, '更不该为它重启常驻守护')
    assert.match(trace.logs.join('\n'), /都在 spawn 面/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})
test(`${CLS}③ 闭包取不到 ⇒ 退回全量判并点名原因,绝不因量不到而放绿`, async () => {
  const dir = mkScratch('gsf-')
  try {
    const { r, trace } = runClosure({
      dir,
      scan: () => scanTwo(['scripts/check-spawned.mjs']),
      closure: { set: null, why: '注入:闭包不可用' },
    })
    assert.notEqual(r.state, 'ok', '量窄不了的时候必须按老口径喊')
    assert.equal(trace.notifies.length, 1)
    assert.match(trace.logs.join('\n'), /闭包不可用\(注入:闭包不可用\)/)
    assert.match(
      String(trace.notifies[0].opts.dedupKey),
      /:all:/,
      '身份要能区分闭包档与全量档,别混在一个桶里',
    )
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})
test(`${CLS}④ 零复算锁:闭包口径只许 import lib 那一份,守护里不得再拼一份 import 解析`, async () => {
  const src = readFileSync(new URL('../git-guardian.mjs', import.meta.url), 'utf8')
  assert.match(
    src,
    /import \{ relativeImportClosure \} from '\.\/lib\/scratch-module-closure\.mjs'/,
  )
  assert.ok(
    !/matchAll\(\s*\/\(\?:\^\|\n\)[\s\S]{0,80}?from\s/.test(src),
    '本器里出现了第二份 import 解析 ⇒ 两份必漂移(§0.6)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
