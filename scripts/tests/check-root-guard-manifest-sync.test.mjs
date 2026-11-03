// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 275 的镜像测试(§22c:判据 import 源脚本本体,本文件零复制 sha 算法/清单形状)。
 *
 * 三件事:
 *  ① 成对夹具 —— 「改了规则没重封」必须红,「同批重封」必须绿(摘掉新字段即翻红);
 *  ② 接线形状锁 —— 注册条目必须 blocking + skipEnv 成套,script 指向真实文件;
 *  ③ 失效方向锁 —— 取不到输入一律未判定,绝不被读成"没问题"。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { __test__ as G } from '../check-root-guard-manifest-sync.mjs'
import { sha256Of } from '../root-guard.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const RULE = 'scripts/guardian-runner.mjs'
const V1 = '// runner v1\n'
const V2 = '// runner v2 changed, manifest left behind\n'
const manifestFor = (sha) =>
  JSON.stringify({ version: 1, targets: [{ id: 'guardian-runner', path: RULE, mode: 'file', sha256: sha }] })

test('M1 成对锁:改了规则没重封 ⇒ drift;同批重封 ⇒ ok(摘掉 seal 即翻红)', () => {
  const left = G.judge({ manifestRaw: manifestFor(sha256Of(V1)), readRel: () => V2 })
  const sealed = G.judge({ manifestRaw: manifestFor(sha256Of(V2)), readRel: () => V2 })
  assert.equal(left.state, 'drift')
  assert.equal(left.drift.length, 1)
  assert.equal(left.drift[0].id, 'guardian-runner')
  assert.equal(sealed.state, 'ok')
  assert.equal(sealed.drift.length, 0)
})

test('M2 失效方向:清单/目标取不到、清单形状坏 ⇒ 未判定,不冒绿也不冒红', () => {
  const cases = [
    G.judge({ manifestRaw: null, readRel: () => V1 }),
    G.judge({ manifestRaw: manifestFor(sha256Of(V1)), readRel: () => null }),
    G.judge({ manifestRaw: '{"version":9,"targets":[]}', readRel: () => V1 }),
  ]
  for (const c of cases) assert.equal(c.state, 'undetermined')
})

test('M3 advisory 集合与 root-guard 同源(AGENTS.md 漂移不进判红集)', () => {
  const advManifest = JSON.stringify({
    version: 1,
    targets: [
      { id: 'agents-ironlaw', path: 'AGENTS.md', mode: 'section', start: '## 0. 全局铁律', sha256: 'a'.repeat(64) },
    ],
  })
  const r = G.judge({ manifestRaw: advManifest, readRel: () => '## 0. 全局铁律\n\n内容已变\n' })
  assert.equal(r.state, 'ok', 'advisory 漂移不得进 drift 集(否则与 root-guard 自己的定级打架)')
  assert.equal(r.advisory.length, 1)
})

test('M4 面参数非法 ⇒ exit 2(不得默认按"没配好"放行)', () => {
  assert.equal(G.decide('nonsense').exit, 2)
})

test('M5 接线形状锁:调度器在 git-guardian 两处执行体都挂上,且尺子被显式接管 stdio/timeout', () => {
  const g = readFileSync(path.join(ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')
  assert.match(g, /export function auditRootGuardManifestSync\(/, '调度器函数不在位')
  // 双执行体:main 单轮路径 + daemon tick(startDaemon 不重读文件,漏 tick = 常驻守护永不判)
  const calls = [...g.matchAll(/^[ \t]*(?:if \(!CHECK_ONLY\) )?auditRootGuardManifestSync\(\)/gm)].length
  assert.ok(calls >= 2, `挂点只有 ${calls} 处,应 ≥2(main 单轮 + daemon tick)`)
  assert.match(g, /'check-root-guard-manifest-sync\.mjs'/, '调度器没引用本尺子')
  // §12g/守门 80:派生必须显式 stdio + timeout + windowsHide
  const body = g.slice(g.indexOf('export function auditRootGuardManifestSync'))
  const seg = body.slice(0, body.indexOf('\nexport ', 10) > 0 ? body.indexOf('\nexport ', 10) : 6000)
  assert.match(seg, /stdio:\s*\['ignore',\s*'pipe',\s*'pipe'\]/)
  assert.match(seg, /timeout:/)
  assert.match(seg, /windowsHide:\s*true/)
  assert.match(g, /^ {2}auditRootGuardManifestSync,$/m, '未导出给镜像测试(测试只能自造判据 = §22c 禁止)')
})

test('M6 反向锁:本尺子刻意**不**注册进 guardian-runner(挂提交链即 §12e 恒红门)', () => {
  const runner = readFileSync(path.join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  assert.equal(
    (runner.match(/script:\s*'check-root-guard-manifest-sync\.mjs'/g) ?? []).length,
    0,
    '它一旦被注册进提交链,就会把上一席落下的清单漂移定责给下一席 —— 而下一席补不动' +
      '(补 README 点名撞门 173 活性声明开放集合,补 AGENTS 点名撞门 207 体积预算)⇒ 恒红逼人跳门。',
  )
  // 门体头注也不得自称"已接提交链/守门 NNN"(门 89 R1/R2 判撒谎的同一格)
  const gate = readFileSync(path.join(ROOT, 'scripts', 'check-root-guard-manifest-sync.mjs'), 'utf8')
  assert.match(gate, /不进提交链/, '头注应写明档位(守护巡检,不进提交链)')
  assert.doesNotMatch(gate, /已接线.*提交链|blocking,stagedTriggers/, '头注不得自称已接提交链')
})

test('M7 真实仓当下自洽(HEAD 面)—— 本门上线当轮不得给自己造红', () => {
  const r = G.decide('head')
  assert.notEqual(r.exit, 1, `HEAD 面就不自洽 ⇒ 新门一装车即恒红(§12e):${r.lines.join(' | ')}`)
})

/* ── 被审面 = 远端 tip(2026-11-03 补的盲区腿:本机 HEAD 落后时,HEAD 面自洽≠部署环要构建的那面自洽) ── */

test('M8 远端 tip 只认 ls-remote 的当次回答(三种回答各走各的支路)', () => {
  const sha = '37147a7496a2a7384e2ea5ad320a08d8678dc5d6'
  const ok = G.resolveRemoteTip({ run: () => `${sha}\trefs/heads/main\n` })
  assert.deepEqual(ok, { ok: true, sha }, 'ls-remote 正常回显 ⇒ 必须原样交出 40 位 sha')
  // 反向锁:把"必须是 40 位"这一手摘掉(改成只要非空就 ok)⇒ 这一支会冒绿,当场翻红
  const garbage = G.resolveRemoteTip({ run: () => 'refs/heads/main\n' })
  assert.equal(garbage.ok, false, '回显里根本没有 sha ⇒ 不许当成 tip')
  assert.match(garbage.why, /没答出 40 位 sha/, '未判定必须点名"答的是什么"')
  const empty = G.resolveRemoteTip({ run: () => '' })
  assert.equal(empty.ok, false, '空回显 ≠ 远端没有分支,更 ≠ 自洽')
  assert.match(empty.why, /\(空\)/, '空回显要在原因里写出来,不能留一句"失败"')
  const boom = G.resolveRemoteTip({ run: () => { throw new Error('proxy refused') } })
  assert.equal(boom.ok, false, '派生抛错 ⇒ 未判定')
  assert.match(boom.why, /proxy refused/, '原因必须带上游原话,否则排查只能猜')
})

test('M9 tip 的对象不在本地 ⇒ 补取一趟;补不到就未判定,绝不回落 HEAD', () => {
  const sha = '37147a7496a2a7384e2ea5ad320a08d8678dc5d6'
  // ① 对象已在 ⇒ 一趟 fetch 都不许多派(反向锁:短路判据被摘掉就会多派一次 fetch)
  const argv1 = []
  const present = G.resolveDeployFace({
    remote: 'origin',
    run: (a) => {
      argv1.push(a.join(' '))
      if (a[0] === 'ls-remote') return `${sha}\trefs/heads/main\n`
      return ''
    },
  })
  assert.deepEqual(present, { ok: true, sha, fetched: false })
  assert.equal(argv1.filter((s) => s.startsWith('fetch')).length, 0, `对象在手还派 fetch:${argv1}`)
  // ② 第一趟问不到、fetch 之后问到 ⇒ fetched:true,并且 fetch 真在 argv 序列里
  const argv2 = []
  let seen = false
  const afterFetch = G.resolveDeployFace({
    remote: 'origin',
    run: (a) => {
      argv2.push(a.join(' '))
      if (a[0] === 'ls-remote') return `${sha}\trefs/heads/main\n`
      if (a[0] === 'fetch') {
        seen = true
        return ''
      }
      if (!seen) throw new Error('missing object')
      return ''
    },
  })
  assert.deepEqual(afterFetch, { ok: true, sha, fetched: true }, '补取一趟后问到 ⇒ 记 fetched:true 并放行')
  assert.ok(argv2.some((s) => s.startsWith('fetch origin main')), `fetch 序列不对:${argv2}`)
  // ③ 两趟都问不到 ⇒ 未判定,点名"两趟都试过"
  const never = G.resolveDeployFace({
    remote: 'origin',
    run: (a) => {
      if (a[0] === 'ls-remote') return `${sha}\trefs/heads/main\n`
      throw new Error('no such object')
    },
  })
  assert.equal(never.ok, false, '对象取不到却报自洽 = 把"没判"写成"判过"')
  assert.match(never.why, /补取一趟/, '原因要写明这是两趟之后的结论')
})

test('M10 remote 面成对夹具(真实历史两枚:脱钩的那枚必红,同批重封的那枚必绿)', () => {
  // 入场券坏 ⇒ exit 2(不默默按 HEAD 面判,也不记绿)
  assert.equal(G.decide('remote', '').exit, 2, '没给 sha 的 remote 面必须拒判')
  assert.equal(G.decide('remote', 'deadbeef').exit, 2, '残缺 sha 同样拒判')
  // 11-03 12:01/12:03/12:06 部署环三轮 FAIL 的就是这枚:清单绑 12b725982de9 / 面上 d94a84b6a63c
  const bad = G.decide('remote', '35bddefbd9cce78f7621f00dff799efad374404c')
  assert.equal(bad.exit, 1, `这枚面上清单与规则文件脱钩,remote 档必须红:${bad.lines.slice(0, 2)}`)
  assert.ok(
    bad.lines.some((l) => l.includes('guardian-runner') && l.includes('12b725982de9')),
    `红档要点名目标与两侧哈希:${bad.lines.join(' | ').slice(0, 200)}`,
  )
  assert.ok(
    bad.lines.some((l) => l.includes('fail-closed')),
    '红档必须说清后果(部署环拒绝推进),否则收信人不知道墙在哪',
  )
  // 同批重封之后(37147a7496)同一判据转绿 —— 摘掉"同面取材"那一手就会两枚都报绿/都报红
  const good = G.decide('remote', '37147a7496a2a7384e2ea5ad320a08d8678dc5d6')
  assert.equal(good.exit, 0, `重封后的面应当自洽:${good.lines.slice(0, 2)}`)
})

test('M11 装车锁:调度器两面都判(head + 远端 tip),且两面各有独立到人身份', () => {
  const g = readFileSync(path.join(ROOT, 'scripts', 'git-guardian.mjs'), 'utf8')
  const body = g.slice(g.indexOf('export function auditRootGuardManifestSync'))
  const seg = body.slice(0, body.indexOf('\nexport ', 10) > 0 ? body.indexOf('\nexport ', 10) : 9000)
  assert.ok(
    /'--against-remote',\s*'origin'/.test(seg),
    '调度器没派远端 tip 面 ⇒ 本机 HEAD 落后时这格又是盲区(11-03 实测:巡检查 12 轮自洽,部署环同刻三轮 FAIL)',
  )
  assert.equal(
    (seg.match(/const run =[\s\S]*?: \(extraArgs\) => \{/g) ?? []).length,
    1,
    '派生器必须按面接收参数;若把 argv 写死,第二面结构上判不到',
  )
  assert.equal(
    (seg.match(/dedupKey:\s*`face=\$\{x\.label\};manifest-drift`/g) ?? []).length,
    1,
    '两面必须各有独立去重身份(§5e-3:同一条判据的两面红不许互相吞)',
  )
  // 未判定不并桶:至少一面没判 ⇒ 整体记 undetermined,不得读成"两面都自洽"
  assert.ok(/至少一面未判定/.test(seg), '未判定那一支必须留在函数体内')
  // 反向:只判一面的旧形态不得回来(摘掉面循环 ⇒ 本断言翻红)
  assert.ok(!/const stdout = String\(r\.out \?\? r\.stdout \?\? ''\)\n  const stderr/.test(seg), '又变回单面判读了')

  const json = readFileSync(path.join(ROOT, 'scripts', 'check-root-guard-manifest-sync.mjs'), 'utf8')
  assert.ok(
    /rev: face === 'remote' \? rev : null/.test(json),
    '--json 面必须交出被审 tip 的 sha,否则到人的正文只能写"远端 tip",没人知道是哪一枚',
  )
  const runner = readFileSync(path.join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  assert.equal(
    (runner.match(/script:\s*'check-root-guard-manifest-sync\.mjs'/g) ?? []).length,
    0,
    '两面档都不得把它挂进提交链(§12e:远端面的红,本枚提交者结构上补不动)',
  )
})

test('M12 调度器行为锁:两面各判一次;remote 面红单独到人;一面未判定不得读成两面自洽', async () => {
  const Gd = await import('../git-guardian.mjs')
  const root = mkScratch('rgm-audit-')
  const jsonOf = (o) => JSON.stringify(o)
  const okHead = { state: 'ok', face: 'head', rev: null, drift: [], advisory: [], baseState: 'ok', reason: null }
  const driftRemote = {
    state: 'drift',
    face: 'remote',
    rev: '35bddefbd9cce78f7621f00dff799efad374404c',
    drift: [
      {
        id: 'guardian-runner',
        path: 'scripts/guardian-runner.mjs',
        expected: '12b725982de9',
        actual: 'd94a84b6a63c',
      },
    ],
    advisory: [],
    baseState: 'drift',
    reason: null,
  }
  const mkRunner = (byLabel) => (argv) => {
    const label = argv.includes('--against-remote') ? 'remote' : 'head'
    const v = byLabel[label]
    if (v === 'throw') return { ok: false, out: '', err: 'spawn 崩了', status: null }
    return { ok: true, out: jsonOf(v), status: v.state === 'drift' ? 1 : 0 }
  }
  const logs = []
  const mails = []
  const logger = (m) => logs.push(String(m))
  const notify = (subject, body, meta) => mails.push({ subject, body, meta })
  const now = Date.parse('2026-11-03T05:00:00.000Z')
  const tick = (n) => path.join(root, `tick-${n}.json`)

  try {
    // ① 两面都自洽 ⇒ ok,零投递,读数留两行且各带自己的面
    let r = Gd.auditRootGuardManifestSync({
      now,
      tickFile: tick(1),
      logger,
      notify,
      runner: mkRunner({ head: okHead, remote: okHead }),
    })
    assert.equal(r.state, 'ok')
    assert.equal(mails.length, 0, '两面自洽不得寄信')
    assert.equal(r.detail.length, 2, `两面各应留一行读数,实得 ${r.detail.length}`)
    assert.deepEqual(
      r.detail.map((x) => x.label),
      ['head', 'remote'],
    )

    // ② 只 remote 面红(11-03 的真实形状)⇒ 一封,身份带 face=remote,正文点名 tip
    mails.length = 0
    r = Gd.auditRootGuardManifestSync({
      now: now + 60_000,
      tickFile: tick(2),
      logger,
      notify,
      runner: mkRunner({ head: okHead, remote: driftRemote }),
    })
    assert.equal(r.state, 'drift')
    assert.equal(mails.length, 1, '一面红 ⇒ 一封')
    assert.equal(mails[0].meta.dedupKey, 'face=remote;manifest-drift', '两面红不许共用一个身份(§5e-3)')
    assert.match(mails[0].body, /35bddefbd9cc/, '正文必须交出被审 tip,否则收信人不知道是哪一枚')
    assert.match(mails[0].body, /root-guard\.mjs --seal/, '到人必须给可整改动作(§5e-1)')

    // ③ 两面各红 ⇒ 两封,身份互不相同
    mails.length = 0
    r = Gd.auditRootGuardManifestSync({
      now: now + 120_000,
      tickFile: tick(3),
      logger,
      notify,
      runner: mkRunner({ head: { ...driftRemote, face: 'head', rev: null }, remote: driftRemote }),
    })
    assert.equal(r.state, 'drift')
    assert.deepEqual(
      mails.map((m) => m.meta.dedupKey).sort(),
      ['face=head;manifest-drift', 'face=remote;manifest-drift'],
      '两面红必须各自到人',
    )

    // ④ 一面未判定(尺子崩了)⇒ 整体 undetermined,绝不记绿(§0.3)
    logs.length = 0
    r = Gd.auditRootGuardManifestSync({
      now: now + 180_000,
      tickFile: tick(4),
      logger,
      notify,
      runner: mkRunner({ head: okHead, remote: 'throw' }),
    })
    assert.equal(r.state, 'undetermined', '一面没判成 ⇒ 不许报"清单自洽"')
    assert.ok(logs.some((l) => /结论不可用/.test(l)), '未判定要在日志里点名是哪一面')
  } finally {
    rmScratch(root)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
