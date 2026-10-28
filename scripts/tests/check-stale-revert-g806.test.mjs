// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 84 的「巡检档」镜像测试(G-806 续,§22c:直接 import 源模块,不复制实现)。
 *
 * 票面:窗口扩容的前置是先量成本 —— 本文件钉四件事:
 *  P1 成本读数:audit 每轮输出尾行必须带机器可 grep 的 `[成本读数]` 行(耗时 / 逐路径祖先
 *     取材次数 / 祖先提交总量 / 窗口截断数)。没有它,扩容定档永远靠体感。
 *  P2 截断报名:祖先清单被窗口截断(确证窗外还有)时必须点名路径与窗口值(`⚠️ [窗口截断]`),
 *     且结论行带"窗口不足"尾注 —— 不得静默绿;反向对照:浅历史路径不得虚报截断(报名吃证据)。
 *  P3 巡检档三档:`runWindowProbe`/`renderProbe` 每档读数齐全、形状可 grep、深档取到更多提交,
 *     且默认三档 = ×1/×2/×8(40/80/320)。
 *  P4 probe 只读:跑完 probe 再判,同一夹具的判定结果与未跑过完全一致,默认窗口不被改动
 *     (ANCESTOR_WINDOW 仍 40 —— 扩容定档是下一票,本票只补读数与报名)。
 *
 * 跑法:node --test scripts/tests/check-stale-revert-g806.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-stale-revert.mjs'

const GIT = 'C:/Program Files/Git/cmd/git.exe'

function put(dir, rel, text) {
  const abs = join(dir, rel)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text, 'utf8')
}

function repo() {
  const dir = mkScratch('stale-revert-g806-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 300000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  run('config', 'core.autocrlf', 'false')
  return { dir, run }
}

/** 造 depth 枚"动过 rel"的提交(每次整文件替换成单行 v<i>),与 window 镜像测试同源。 */
function buildDepth(dir, run, rel, depth) {
  put(dir, rel, 'v1\n')
  run('add', '-A')
  run('commit', '-qm', `${rel} v1`)
  for (let i = 2; i <= depth; i++) {
    put(dir, rel, `v${i}\n`)
    run('commit', '-qam', `${rel} v${i}`)
  }
}

/**
 * 成本读数的字段名取自**门体导出的那一份**(`COST_READOUT_FIELDS` 正是 `renderCostLine`
 * 自己拼行时用的顺序表)。§22c:测试里再写一遍字段名就是第二份真相 —— 门加/改字段那天
 * 测试照绿,而读数(给窗口扩容定档用的唯一账面)从此没人看守。
 * 字段**值的判据**仍留在本文件:抄字段名是复制判据,写"必须 ≥1"才是本测试要证的事。
 */
const readoutField = (name) => {
  assert.ok(
    gate.COST_READOUT_FIELDS.includes(name),
    `门体导出的成本读数字段清单里没有 ${name} ⇒ 读数形状已换,本锁必须跟着改而不是放过`,
  )
  return name
}

test('P1 成本读数:audit 输出必须带机器可 grep 的 [成本读数] 行(耗时/取材次数/截断数,窗口截断计 1)', () => {
  const { dir, run } = repo()
  try {
    buildDepth(dir, run, 'deep.ts', gate.ANCESTOR_WINDOW + 5)
    put(dir, 'deep.ts', 'v1\n') // 写回第 1 枚:在窗口外,必然触发窗口截断
    run('add', '--', 'deep.ts')
    const r = gate.audit(dir, { staged: true })
    const costLine = r.lines.find((l) => l.includes('[成本读数]'))
    assert.ok(costLine, `必须有成本读数行,实得:${r.lines.join(' | ').slice(0, 300)}`)
    // 字段名取自门体那一份(见文件头 readoutField);值谓词仍是本测试自己的事。
    assert.match(costLine, new RegExp(`${readoutField('mode')}=staged`), '档位必须随调用面如实报')
    assert.match(
      costLine,
      new RegExp(`${readoutField('paths')}=[1-9]`),
      '判定路径数必须 ≥1(本夹具恰 1 条)',
    )
    assert.match(
      costLine,
      new RegExp(`${readoutField('elapsed_ms')}=[\\d.]+`),
      '必须有耗时读数',
    )
    assert.match(
      costLine,
      new RegExp(`${readoutField('git_log')}=[1-9]`),
      '必须有逐路径祖先取材次数(深路径必取)',
    )
    assert.match(
      costLine,
      new RegExp(`${readoutField('ancestor_commits')}=[1-9]`),
      '必须有祖先提交总量(≈cat-file 规模)',
    )
    assert.match(
      costLine,
      new RegExp(`${readoutField('window_truncated')}=1`),
      `deep.ts 深于窗口 ⇒ 截断数必须为 1,实得:${costLine}`,
    )
    // 成本读数与截断报名必须同源:报名块点名了几条路径,读数就计几条。
    const named = r.lines.filter((l) => l.trim().startsWith('- deep.ts: 窗口'))
    assert.equal(
      named.length >= 1 && new RegExp(`${readoutField('window_truncated')}=1`).test(costLine),
      true,
      '报名块与 window_truncated 计数必须一致',
    )
  } finally {
    rmScratch(dir)
  }
})

test('P2 截断报名:窗口外回写必须点名路径与窗口值且结论带尾注(不得静默绿);浅历史不得虚报', () => {
  const { dir, run } = repo()
  try {
    buildDepth(dir, run, 'deep.ts', gate.ANCESTOR_WINDOW + 5)
    put(dir, 'deep.ts', 'v1\n')
    run('add', '--', 'deep.ts')
    const r = gate.audit(dir, { staged: true })
    const out = r.lines.join('\n')
    assert.equal(r.code, 0, '窗口外无从取证 ⇒ 不判红(判红=凭空定罪);但绿必须带着报名')
    assert.match(out, /⚠️\s*\[窗口截断\]/, '截断发生必须报名,不得静默')
    assert.ok(out.includes('deep.ts'), '必须点名路径')
    assert.ok(
      out.includes(`窗口 ${gate.ANCESTOR_WINDOW} 枚用尽`),
      `必须点名窗口值(${gate.ANCESTOR_WINDOW}),实得:${out.slice(0, 400)}`,
    )
    assert.match(out, /\[R1 未判定\]/, '"没判"与"判过"必须在账面上长得不一样')
    assert.match(out, /窗口不足未判定\(R1\)/, '结论行必须把这型未判带进尾注')
    // 反向对照:浅历史路径的正当编辑 ⇒ 既无截断报名块,读数行的截断数也必须为 0(点名吃证据)。
    put(dir, 'shallow.txt', 'a\n')
    run('add', '-A')
    run('commit', '-qm', 'shallow v1')
    put(dir, 'shallow.txt', 'b\n')
    run('add', '--', 'shallow.txt')
    const r2 = gate.audit(dir, { staged: true })
    const cost2 = r2.lines.find((l) => l.includes('[成本读数]'))
    assert.match(cost2, new RegExp(`${readoutField('window_truncated')}=0`), '浅历史不得虚报截断')
    assert.ok(
      !r2.lines.some((l) => l.includes('[窗口截断]')),
      '没有截断就不得喊 —— 否则报名沦为恒喊的噪音',
    )
  } finally {
    rmScratch(dir)
  }
})

test('P3 巡检档三档:默认档 = ×1/×2/×8(40/80/320);小档演练下读数齐全、可 grep、深档取到更多', () => {
  assert.deepEqual(
    gate.WINDOW_PROBE_TIERS,
    [40, 80, 320],
    '三档 = ×1/×2/×8(票面定档,probe 量的是这三档的取材耗时)',
  )
  assert.deepEqual(gate.WINDOW_PROBE_DEFAULT_PATHS, ['PROJECT_PLAN.md'], '缺省量热路径台账')
  const { dir, run } = repo()
  try {
    buildDepth(dir, run, 'deep.ts', 12)
    const results = gate.runWindowProbe(dir, ['deep.ts'], [4, 8, 12])
    assert.equal(results.length, 3, '三档各一行读数')
    assert.deepEqual(
      results.map((r) => r.window),
      [4, 8, 12],
      '档位顺序必须与传入一致',
    )
    for (const r of results) {
      assert.equal(r.path, 'deep.ts')
      assert.equal(r.error ?? null, null, `probe 不得报错:${r.error}`)
      assert.equal(typeof r.logMs, 'number', 'log 段必须有毫秒读数')
      assert.equal(typeof r.catMs, 'number', 'cat 段必须有毫秒读数')
      assert.equal(typeof r.totalMs, 'number', '必须有总耗时')
      assert.equal(typeof r.truncated, 'boolean', '窗口是否用尽必须如实报')
      assert.ok(r.fetched >= 0 && r.fetched <= r.window + 1, '探针取 window+1 枚,不得超')
    }
    assert.ok(
      results[2].fetched > results[0].fetched,
      `×8 档必须取到更多提交(取材路径真的随窗口变深),实得 ${results.map((r) => r.fetched).join('/')}`,
    )
    const out = gate.renderProbe(results).join('\n')
    assert.equal((out.match(/\[window-probe\]/g) ?? []).length, 3, '每档一行,前缀固定可 grep')
    assert.match(out, /\[window-probe 汇总\] path=deep\.ts/, '必须有三档汇总行')
    assert.match(out, /log_ms=[\d.]+ cat_ms=[\d.]+ total_ms=[\d.]+ commits=\d+/, '读数字段形状固定')
  } finally {
    rmScratch(dir)
  }
})

test('P4 probe 只读不落状态:跑完 probe 再判,同一夹具判定结果与默认窗口一字不差', () => {
  assert.equal(gate.ANCESTOR_WINDOW, 40, '默认窗口不得被本票改大(扩容定档是下一票)')
  const { dir, run } = repo()
  try {
    buildDepth(dir, run, 'notes/x.txt', 3)
    put(dir, 'notes/x.txt', 'brand-new-never-committed\n')
    run('add', '--', 'notes/x.txt')
    const before = gate.analyze(dir, ['notes/x.txt'])
    gate.runWindowProbe(dir, ['notes/x.txt'], [1, 2, 3])
    const after = gate.analyze(dir, ['notes/x.txt'])
    assert.deepEqual(after, before, 'probe 只读:判定结果不得因巡检而漂')
    assert.deepEqual(after, [], '夹具本身是真新编辑 ⇒ 两臂都必须不判红')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
