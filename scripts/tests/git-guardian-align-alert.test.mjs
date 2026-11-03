// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守护「收敛器收尾对齐停摆 → 喊人」镜像测试(§22c:import 源模块 __test__,零复制实现)。
//
// 立因(票 O74):收敛器 alignWorktreeAfterHeadMove 长期失败(锁一直被占)过去只记日志。
// 现由收敛器写 .ihui-agent/state/converge-align-state.json,守护每轮读它并按阈值
// 经 notifyGuardRed('converge-align-stall', …) 走 §5e 唯一邮件通道。本测试钉:
//   (a) 阳性对照:连续 3 次 + 最后失败 12 分钟前 ⇒ 该喊;
//   (b) 反向对照:2 次不喊 / 3 次但 1 分钟前不喊 / 成功归零不喊 / 状态缺失不喊;
//   (c) 坏 JSON ⇒ 不喊且不崩(判据失效不得表现为事故,也不得表现为红);
//   (d) 阈值 env 可覆盖(IHUI_ALIGN_STALL_FAILS / IHUI_ALIGN_STALL_AGE_MS);
//   (e) 装车证明:tick 真正会执行的分支上调了 checkConvergeAlignStall,派发名逐字为
//       'converge-align-stall'(挂错分支 = 永不执行,本仓记过两次)。
// 全部用**构造输入**取证,假 notify 注入 ⇒ 零网络、零真邮件、零生产端口。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as G } from '../git-guardian.mjs'

const NOW = 1_700_000_000_000
const MIN = 60_000

/** 只测判据本体:显式喂默认阈值,不吃进程 env(环境是别人的) */
const DFLT = { cfg: { minFails: 3, minAgeMs: 10 * MIN } }

function stallState(fails, ageMs, extra = {}) {
  return {
    consecutiveFailures: fails,
    lastFailAt: NOW - ageMs,
    lastOkAt: null,
    lastNote: 'rc=1 fatal: Unable to create index.lock: File exists',
    ...extra,
  }
}

test('(a)阳性对照:连续 3 次 + 12 分钟前 ⇒ 判该喊人', () => {
  const d = G.shouldAlertAlignStall(stallState(3, 12 * MIN), NOW, DFLT.cfg)
  assert.equal(d.alert, true)
  assert.equal(d.fails, 3)
  assert.ok(d.ageMs >= 10 * MIN)
})

test('(b)反向对照:2 次 / 3 次但 1 分钟前 / 成功归零 / 状态缺失 ⇒ 都不喊', () => {
  assert.equal(G.shouldAlertAlignStall(stallState(2, 60 * MIN), NOW, DFLT.cfg).alert, false)
  assert.equal(G.shouldAlertAlignStall(stallState(3, 1 * MIN), NOW, DFLT.cfg).alert, false)
  assert.equal(
    G.shouldAlertAlignStall(
      { consecutiveFailures: 0, lastFailAt: NOW - 60 * MIN, lastOkAt: NOW },
      NOW,
      DFLT.cfg,
    ).alert,
    false,
  )
  assert.equal(G.shouldAlertAlignStall(null, NOW, DFLT.cfg).alert, false, '状态文件不存在绝不喊人')
  assert.equal(G.shouldAlertAlignStall({ lastNote: '没有计数' }, NOW, DFLT.cfg).alert, false)
  assert.equal(
    G.shouldAlertAlignStall(stallState(9, 99 * MIN), NOW, { minFails: 10, minAgeMs: 10 * MIN })
      .alert,
    false,
  )
})

test('(b2)lastFailAt 不可用 ⇒ 无法判定,不喊', () => {
  assert.equal(
    G.shouldAlertAlignStall({ consecutiveFailures: 5, lastFailAt: '昨天' }, NOW, DFLT.cfg).alert,
    false,
  )
})

test('(d)env 覆盖阈值:IHUI_ALIGN_STALL_FAILS / IHUI_ALIGN_STALL_AGE_MS', () => {
  const before = {
    f: process.env.IHUI_ALIGN_STALL_FAILS,
    a: process.env.IHUI_ALIGN_STALL_AGE_MS,
  }
  try {
    process.env.IHUI_ALIGN_STALL_FAILS = '2'
    process.env.IHUI_ALIGN_STALL_AGE_MS = String(2 * MIN)
    assert.equal(G.shouldAlertAlignStall(stallState(2, 3 * MIN), NOW, {}).alert, true)
    process.env.IHUI_ALIGN_STALL_FAILS = 'not-a-number' // 坏 env ⇒ 回默认 3
    assert.equal(G.shouldAlertAlignStall(stallState(2, 3 * MIN), NOW, {}).alert, false)
    const t = G.alignStallThresholds({})
    assert.equal(t.minFails, 3)
    assert.equal(t.minAgeMs, 2 * MIN, '数值 env 仍生效')
  } finally {
    if (before.f === undefined) delete process.env.IHUI_ALIGN_STALL_FAILS
    else process.env.IHUI_ALIGN_STALL_FAILS = before.f
    if (before.a === undefined) delete process.env.IHUI_ALIGN_STALL_AGE_MS
    else process.env.IHUI_ALIGN_STALL_AGE_MS = before.a
  }
})

test('(c)+派发实参:达阈值时 notify 恰一次,name/内容含 rc、真因、次数、状态文件路径', () => {
  const dir = mkScratch('gg-align-alert-')
  try {
    const p = join(dir, 'converge-align-state.json')
    writeFileSync(p, JSON.stringify(stallState(4, 30 * MIN)), 'utf8')
    const calls = []
    const r = G.checkConvergeAlignStall({
      now: NOW,
      statePath: p,
      cfg: DFLT.cfg,
      notify: (name, detail) => calls.push({ name, detail }),
    })
    assert.equal(r.alert, true)
    assert.equal(calls.length, 1, '绝不直发真邮件:出口只有注入的假 notify')
    assert.equal(calls[0].name, 'converge-align-stall')
    assert.match(calls[0].detail, /连续失败 4 次/)
    assert.match(calls[0].detail, /rc=1 fatal: Unable to create index\.lock/)
    assert.match(calls[0].detail, /converge-align-state\.json/)
  } finally {
    rmScratch(dir)
  }
})

test('(c)坏 JSON ⇒ 不喊、不派发、不抛(状态文件不得成为新故障源)', () => {
  const dir = mkScratch('gg-align-alert-')
  try {
    const p = join(dir, 'converge-align-state.json')
    writeFileSync(p, '{ broken', 'utf8')
    const calls = []
    let r
    assert.doesNotThrow(() => {
      r = G.checkConvergeAlignStall({
        now: NOW,
        statePath: p,
        cfg: DFLT.cfg,
        notify: () => calls.push(1),
      })
    })
    assert.equal(r.alert, false)
    assert.equal(calls.length, 0)
    // 文件不存在同理
    const r2 = G.checkConvergeAlignStall({
      now: NOW,
      statePath: join(dir, 'nope.json'),
      cfg: DFLT.cfg,
      notify: () => calls.push(1),
    })
    assert.equal(r2.alert, false)
    assert.equal(calls.length, 0)
  } finally {
    rmScratch(dir)
  }
})

test('(e)装车证明:tick 真执行分支调用 checkConvergeAlignStall,名与状态文件同源', () => {
  const rel = 'scripts/git-guardian.mjs'
  let head = ''
  try {
    head = execFileSync('git', ['show', `HEAD:${rel}`], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 32 << 20,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    /* 问不到走工作树 */
  }
  let src = head
  if (!src.includes('checkConvergeAlignStall')) {
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
    src = readFileSync(join(repoRoot, rel), 'utf8')
    assert.ok(src.includes('checkConvergeAlignStall'), '守护侧连函数都不在 ⇒ 根本没接')
    console.warn('⚠️ 装车证明暂以工作树取证(HEAD 尚未包含本票改动,提交后自动升为 HEAD 面)')
  }
  // 主 tick(main 健康分支)必须挂在 !CHECK_ONLY 上 —— CHECK_ONLY 早退分支当挂点等于永不执行
  assert.match(src, /if \(!CHECK_ONLY\) checkConvergeAlignStall\(\)/)
  // daemon tick 分支也要有(双执行体并存,见 §5b)
  const daemonSeg = src.slice(src.indexOf('function startDaemon'))
  assert.match(daemonSeg, /checkConvergeAlignStall\(\)/)
  // 派发名逐字固定;状态文件路径与收敛器写入侧同源(.ihui-agent/state/converge-align-state.json)
  //
  // 2026-10-04 放宽了这条断言的**形状**(存量红的根因修复,不是把判据放松):
  // 原式 `/notify\('converge-align-stall', detail\)/` 要求**恰好两个参数**,而提交 25ce43fc6a
  // (全域告警 §5e-1 审计整改)已给它加了第三个参数 `{ dedupKey }` —— HEAD 面
  // `scripts/git-guardian.mjs:2090` 起就是三参形态。也就是说这条断言从那次提交起一直是红的,
  // 而它红在 origin/main 上,所以没人当回事(守门 130 那条"与提交无关的恒红门只会逼人
  // --no-verify"的同型)。**判据要钉的是"派发名逐字固定"这件事**,不是"恰好两个参数" ——
  // 逐字名 + 变量名仍在本条正则内,加参数不该让"装车证明"失效。
  // 判别力已变异验证:把派发名改掉(挪到别的 alert 身份)仍会被这条正则抓住。
  assert.match(src, /notify\('converge-align-stall', detail\b/)
  assert.match(src, /'.ihui-agent', 'state', 'converge-align-state\.json'/)
  // __test__ 暴露判据(§22c)—— 钉的是**运行时真取得到那三个判据**,不是"在源码里截 600 个字符
  // 找 `key,`"。窗口式文本判据在 HEAD 面长期红:键住在一个大对象字面量里(:587 起),越出窗口
  // 就被读成"没导出",而"越窗"根本不是这件事要证的东西(§12e:与提交内容无关的恒红只会逼人跳门)。
  // 判别力不降反升:改掉导出名 ⇒ typeof 立刻不是 function;只在注释/字符串里出现该名的,
  // 运行时也拿不到 ⇒ 一样红。
  const exposed = G
  for (const k of ['shouldAlertAlignStall', 'checkConvergeAlignStall', 'alignStallThresholds']) {
    assert.equal(typeof exposed[k], 'function', `__test__ 缺运行时可调用的 ${k}`)
  }
})

/**
 * (f) 出路真实性锁(2026-10-18 立)。
 *
 * 现场不是假设:本告警正文里印着「node scripts/git-sync-converge.mjs --status(只读看对齐状态)」,
 * 而收敛器的 argv **从来没有认过这个旗号**。未识别的旗号在那里被静默忽略 ⇒ 收信人照信里那一行回车,
 * 实际执行的是整轮收敛(clean stale lock / fetch / merge-tree / commit-tree / update-ref / 推送)。
 * 一条自称只读却会动共享面的指令,比"没有这条出路"更坏(§0.8:给用户的每条命令必须真跑得通且语义相符)。
 * 本轮已把 `--status` 补成真正的只读档;这条锁的作用是**防它再腐烂**:以后谁往告警正文里加出路,
 * 只要那个旗号在目标脚本里无人认领,这里就红。
 */
const SCRIPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 从告警正文里挑出每条 `node scripts/x.mjs [--flag]`,返回"站不住的出路"清单(空数组 = 全部可核) */
function unverifiableRoutes(detail) {
  const bad = []
  const seen = new Set()
  for (const m of String(detail).matchAll(/node\s+(scripts\/[\w.\-]+\.mjs)((?:\s+--[\w-]+)?)/g)) {
    const rel = m[1]
    const flag = (m[2] || '').trim()
    const id = flag ? `${rel} ${flag}` : rel
    if (seen.has(id)) continue
    seen.add(id)
    const abs = join(SCRIPTS_DIR, rel.replace(/^scripts\//, ''))
    let src = null
    try {
      src = readFileSync(abs, 'utf8')
    } catch {
      bad.push(`${rel} (查无此文件)`)
      continue
    }
    if (flag && !src.includes(flag)) bad.push(id)
  }
  return bad
}

test('(f)装车证明:告警正文里每条 node scripts/*.mjs 出路都必须真被目标脚本认(§0.8 不许跑不通的出路)', () => {
  const dir = mkScratch('gg-align-routes-')
  try {
    const p = join(dir, 'converge-align-state.json')
    writeFileSync(p, JSON.stringify(stallState(4, 30 * MIN)), 'utf8')
    const calls = []
    const r = G.checkConvergeAlignStall({
      now: NOW,
      statePath: p,
      cfg: DFLT.cfg,
      notify: (name, detail) => calls.push({ name, detail }),
    })
    assert.equal(r.alert, true)
    assert.equal(calls.length, 1)
    const bad = unverifiableRoutes(calls[0].detail)
    assert.deepEqual(bad, [], `告警正文里有出路在目标脚本中无人认领:${bad.join(' / ')}`)
    // 前提自证:正文里确实至少有一条带旗号的出路,否则上面那条断言可以靠"正文没有命令"糊过去
    assert.match(calls[0].detail, /node scripts\/[\w.\-]+\.mjs --[\w-]+/, '正文必须含带旗号的出路')

    // 阳性对照:同一把尺必须能认出一个不存在的旗号(否则它就是恒绿的空扫)
    const doctored = `${calls[0].detail}\n出路:node scripts/git-sync-converge.mjs --definitely-not-a-flag`
    assert.deepEqual(unverifiableRoutes(doctored), [
      'scripts/git-sync-converge.mjs --definitely-not-a-flag',
    ])
    // 反向对照:文件不在位也要报,不能被 catch 吞成"没问题"
    assert.deepEqual(unverifiableRoutes('node scripts/no-such-tool.mjs'), [
      'scripts/no-such-tool.mjs (查无此文件)',
    ])
  } finally {
    rmScratch(dir)
  }
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
