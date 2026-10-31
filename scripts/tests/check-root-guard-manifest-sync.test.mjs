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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
