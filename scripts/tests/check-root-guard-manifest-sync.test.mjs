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
import { existsSync, readFileSync } from 'node:fs'
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

test('M5 接线形状锁:275 已注册且 blocking + skipEnv 成套,script 指向真实文件', () => {
  const runner = readFileSync(path.join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  // 锚定行首:头注里照抄一遍 `id: '275'` 是登记惯例(见 274 那条),不锚定就会把注释当注册块
  const block = runner.match(/^[ \t]*id:\s*'275',[\s\S]{0,900}/m)
  assert.ok(block, "guardian-runner 里找不到行首的 id: '275', ⇒ 门体存在但没装车")
  assert.match(block[0], /mode:\s*'blocking'/)
  assert.match(block[0], /skipEnv:\s*'HUSKY_SKIP_ROOT_GUARD_MANIFEST_SYNC'/)
  const script = block[0].match(/script:\s*'([^']+)'/)?.[1]
  assert.equal(script, 'check-root-guard-manifest-sync.mjs')
  assert.ok(existsSync(path.join(ROOT, 'scripts', script)), `${script} 文件不存在`)
  // R13 同形防线:一个注册对象里不得出现两个 id:/script:
  const head = block[0].slice(0, block[0].indexOf('onFailHint') > 0 ? block[0].indexOf('onFailHint') : 900)
  assert.equal([...head.matchAll(/^[ \t]*id:\s*'/gm)].length, 1, '同一注册块出现两个 id: ⇒ 后写覆盖前写')
  assert.equal([...head.matchAll(/^[ \t]*script:\s*'/gm)].length, 1)
})

test('M6 编号唯一:275 在整份 runner 里只出现一次(门 89 R5 反查同口径)', () => {
  const runner = readFileSync(path.join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const hits = [...runner.matchAll(/^[ \t]*id:\s*'275',/gm)].length
  assert.equal(hits, 1)
})

test('M7 真实仓当下自洽(HEAD 面)—— 本门上线当轮不得给自己造红', () => {
  const r = G.decide('head')
  assert.notEqual(r.exit, 1, `HEAD 面就不自洽 ⇒ 新门一装车即恒红(§12e):${r.lines.join(' | ')}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
