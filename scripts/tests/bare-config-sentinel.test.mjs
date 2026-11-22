// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// 钉住五件事:
//  ① bare 行纯文本读数三态齐全:true / false / 键不存在,注释行与非布尔值**不猜**,
//     原样带回 —— "没读到"绝不折成 false(§0.3);
//  ② 变化分档语义:content-change / mtime-only / appear / vanish / heal-false /
//     flip-true,且 flip-true 盖过 content-change(发作优先定名)、vanish 最重;
//  ③ 窗口锚翻译:anchorForWindow 正常路径 = 窗口中点 ± (半宽 + 守护规则②同窗),
//     窗口端取不到 ⇒ anchorDegraded=true 且窗口不冒充"无限宽";
//  ④ 保留期清理只认 event-*.json 形状,异形状一律 skipped(不跟随、不误删);
//  ⑤ 端到端:CLI 在 scratch 夹具上跑 --once,首轮立基线、改 config ⇒ flip-true 件
//     自带前后全文哈希 + 事件窗口 + 快照自证(空清单不得记 ok),且哨兵**绝不改写
//     config**(写后哈希 == 事件件 after.sha256)。
// 全程只在 scratch 夹具上跑,不依赖真仓 gitdir,不 spawn git(哨兵本身设计即零 git 调用)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  readBareFromConfigText,
  classifySideChange,
  anchorForWindow,
  eventFileName,
  decideEventRetention,
  SENTINEL_SINCE,
} from '../bare-config-sentinel.mjs'
import { __test__ as G } from '../git-guardian.mjs'

const NODE = process.execPath
const SENTINEL = fileURLToPath(new URL('../bare-config-sentinel.mjs', import.meta.url))

function sha(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

// ── ① bare 行读数 ──────────────────────────────────────────────
test('readBareFromConfigText: true / false / 键不存在 / 注释行 / 非布尔 五态', () => {
  const base = '[core]\n\trepositoryformatversion = 1\n'
  assert.equal(readBareFromConfigText(base + '\tbare = true\n').bare, true)
  assert.equal(readBareFromConfigText(base + '\tbare = false\n').bare, false)
  const noKey = readBareFromConfigText(base)
  assert.equal(noKey.bare, null)
  assert.match(noKey.why, /没有 bare 行/)
  const commented = readBareFromConfigText(base + '\t# bare = true\n')
  assert.equal(commented.bare, null)
  const weird = readBareFromConfigText(base + '\tbare = yes\n')
  assert.equal(weird.bare, null)
  assert.equal(weird.raw, 'yes')
  // 空全文也不得折成 false
  assert.equal(readBareFromConfigText('').bare, null)
  assert.equal(readBareFromConfigText(null).bare, null)
})

// ── ② 变化分档 ────────────────────────────────────────────────
test('classifySideChange: 七档语义与优先级', () => {
  const F = (over = {}) => ({ exists: true, mtimeMs: 1000, size: 10, sha256: 'aaa', bytes: 10, bare: false, observedAtMs: 1000, ...over })
  assert.deepEqual(classifySideChange(null, F()), { kind: 'none', severity: 'none' }) // 首轮建基线
  assert.deepEqual(classifySideChange(F(), F()), { kind: 'none', severity: 'none' })
  assert.deepEqual(classifySideChange({ exists: false }, F()), { kind: 'appear', severity: 'change' })
  assert.deepEqual(classifySideChange(F(), { exists: false }), { kind: 'vanish', severity: 'critical' })
  assert.deepEqual(classifySideChange(F(), F({ sha256: 'bbb' })), { kind: 'content-change', severity: 'change' })
  assert.deepEqual(classifySideChange(F({ bare: true, sha256: 'aaa' }), F({ bare: false, sha256: 'bbb' })), { kind: 'heal-false', severity: 'change' })
  assert.deepEqual(classifySideChange(F({ mtimeMs: 1000 }), F({ mtimeMs: 2000 })), { kind: 'mtime-only', severity: 'touch' })
  // 发作盖过内容变化:哈希变了且 bare 现读 true ⇒ 定名 flip-true,不读成普通 content-change
  assert.deepEqual(classifySideChange(F(), F({ sha256: 'bbb', bare: true })), { kind: 'flip-true', severity: 'flip-true' })
})

// ── ③ 窗口锚翻译 ──────────────────────────────────────────────
test('anchorForWindow: 正常窗口取中点,半宽外扩守护同窗;端取不到 ⇒ 退化并报名', () => {
  const a = anchorForWindow(0, 4000, 9999)
  assert.equal(a.anchorMs, 2000)
  assert.equal(a.windowMs, 2000 + G.BARE_AUDIT_WINDOW_MS)
  assert.equal(a.anchorDegraded, false)
  const d = anchorForWindow(null, 4000, 5000)
  assert.equal(d.anchorDegraded, true)
  assert.equal(d.anchorMs, 5000)
  assert.equal(d.windowMs, G.BARE_AUDIT_WINDOW_MS)
})

// ── ④ 保留期 ──────────────────────────────────────────────────
test('decideEventRetention: 只认 event-*.json 形状,保留最新 N 份,异形状 skipped', () => {
  const names = ['state.json', 'event-b-2.json', 'event-a-1.json', 'event-c-3.json', '.event-x.tmp']
  const ret = decideEventRetention(names.map((name) => ({ name })), 2)
  // 排序后 [a,b,c],保留最新 2 份 = {b,c},只删 a;state.json/.tmp 是异形状,一律不碰
  assert.deepEqual(ret.remove.sort(), ['event-a-1.json'])
  assert.deepEqual(ret.keep.sort(), ['event-b-2.json', 'event-c-3.json'])
  assert.ok(ret.skipped.every((s) => s.name !== 'event-c-3.json'))
  assert.ok(ret.skipped.some((s) => s.name === 'state.json'))
  // 件名形状稳定且落进保留判据
  assert.match(eventFileName(new Date(0)), /^event-\d{4}-\d{2}-\d{2}T/)
})

// ── ⑤ 端到端(scratch 夹具,零 git 依赖) ─────────────────────────
function runSentinel(args, cwd) {
  return execFileSync(NODE, [SENTINEL, ...args], {
    encoding: 'utf8',
    cwd,
    windowsHide: true,
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

test('CLI 端到端: 基线 → 翻 true 出 flip-true 件(前后哈希+窗口+自证) → 绝不改写 config', () => {
  const dir = mkScratch('sentinel-e2e-')
  try {
    const gitdir = join(dir, 'gitdir')
    const backup = join(dir, 'backup')
    const out = join(dir, 'out')
    mkdirSync(gitdir, { recursive: true })
    mkdirSync(backup, { recursive: true })
    const liveCfg = join(gitdir, 'config')
    writeFileSync(liveCfg, '[core]\n\tbare = false\n')
    writeFileSync(join(backup, 'config'), '[core]\n\tbare = false\n')
    const beforeSha = sha(readFileSync(liveCfg))

    // 第一轮:两侧建基线,不得出事件件
    runSentinel(['--once=1', '--gitdir=' + gitdir, '--backup=' + backup, '--out=' + out, '--quiet'], dir)
    const state = JSON.parse(readFileSync(join(out, 'state.json'), 'utf8'))
    assert.equal(state.live.sha256, beforeSha)
    assert.equal(state.live.bare, false)
    assert.equal(state.backup.bare, false, '恢复源侧基线也必须立起来')
    // 首轮(before=null)分类为 none ⇒ 无事件件
    const round1Events = readdirSync(out).filter((n) => n.startsWith('event-'))
    assert.equal(round1Events.length, 0, '首轮建基线不得出事件件,实得: ' + round1Events.join(','))

    // 写入者登场:把 bare 翻成 true(这就是 G-111 的"不明写入者"动作)
    writeFileSync(liveCfg, '[core]\n\trepositoryformatversion = 1\n\tbare = true\n')
    const flippedSha = sha(readFileSync(liveCfg))

    const r2 = runSentinel(['--once=1', '--gitdir=' + gitdir, '--backup=' + backup, '--out=' + out], dir)
    assert.match(r2, /flip-true/)
    const events = readdirSync(out).filter((n) => /^event-.*-live\.json$/.test(n))
    assert.equal(events.length, 1, '应恰好一份 live 事件件')
    const ev = JSON.parse(readFileSync(join(out, events[0]), 'utf8'))
    assert.equal(ev.schema, 'bare-config-sentinel-event/v1')
    assert.equal(ev.kind, 'flip-true')
    assert.equal(ev.before.sha256, beforeSha)
    assert.equal(ev.after.sha256, flippedSha)
    assert.equal(ev.after.bare, true)
    assert.ok(Number.isFinite(ev.window.widthMs) && ev.window.widthMs >= 0, '事件窗口必须量到: ' + JSON.stringify(ev.window))
    assert.equal(ev.window.undetermined, null)
    // 自证:快照成败必须被点名,"零命中"绝不构成"无人写过"
    assert.ok(ev.selfCheck && typeof ev.selfCheck.verdict === 'string')
    if (ev.snapshot.state !== 'ok' || ev.selfCheck.counts.processes === 0) {
      assert.ok(ev.selfCheck.reasons.length > 0, '快照未量到时 selfCheck 必须带 reason')
    }
    if (ev.snapshot.state === 'ok') {
      // 命中规则①/②的候选至少要带 matchedRules 结构(win32 真跑下此处必然走到)
      for (const c of ev.candidates) assert.ok(Array.isArray(c.matchedRules))
    }
    // 哨兵纯读:config 内容与写入者写下的逐字节一致
    assert.equal(sha(readFileSync(liveCfg)), flippedSha)
    assert.equal(readBareFromConfigText(readFileSync(liveCfg, 'utf8')).bare, true)
    // SINCE 在位(零记录 ≠ 零事故 的防误读标记)
    assert.ok(typeof SENTINEL_SINCE === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(SENTINEL_SINCE))
  } finally {
    rmScratch(dir)
  }
})

test('CLI 端到端: 守护归一(true→false)定名 heal-false,不得冤判为普通写入', () => {
  const dir = mkScratch('sentinel-heal-')
  try {
    const gitdir = join(dir, 'gitdir')
    const backup = join(dir, 'backup')
    const out = join(dir, 'out')
    mkdirSync(gitdir, { recursive: true })
    mkdirSync(backup, { recursive: true })
    writeFileSync(join(gitdir, 'config'), '[core]\n\tbare = false\n')
    writeFileSync(join(backup, 'config'), '[core]\n\tbare = false\n')
    runSentinel(['--once=1', '--gitdir=' + gitdir, '--backup=' + backup, '--out=' + out, '--quiet'], dir)
    // 先把基线拔成 true 态(模拟基线即发作),再归一 false
    writeFileSync(join(gitdir, 'config'), '[core]\n\tbare = true\n')
    runSentinel(['--once=1', '--gitdir=' + gitdir, '--backup=' + backup, '--out=' + out, '--quiet'], dir)
    writeFileSync(join(gitdir, 'config'), '[core]\n\tbare = false\n')
    const r3 = runSentinel(['--once=1', '--gitdir=' + gitdir, '--backup=' + backup, '--out=' + out], dir)
    assert.match(r3, /heal-false/)
  } finally {
    rmScratch(dir)
  }
})

// ── 与守护判据的互证(parseProcessSnapshot 形状契约,单一真相源) ──
test('哨兵候选名单复用守护 parseProcessSnapshot:命令行含 core.bare 的进程必须被规则①点名', () => {
  const line = 'git.exe|123|4|20261018101010.123456+480|git.exe --git-dir D:/IHUI-AI-git-repo config core.bare true\n'
  const { processes, malformed } = G.parseProcessSnapshot(line)
  assert.equal(malformed.length, 0)
  assert.equal(processes.length, 1)
  const cands = G.selectBareFlipCandidates(processes, { anchorMs: Date.parse('2026-10-18T10:10:10+08:00'), windowMs: G.BARE_AUDIT_WINDOW_MS })
  assert.equal(cands.length, 1)
  assert.ok(cands[0].matchedRules.includes('cmdline:core-bare-arg'))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
