// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:名单型判据「正向证明义务」对账。
//
// 与源脚本 `--self-test` 的分工:self-test 用**构造面**证明判据逻辑(不依赖仓库状态),
// 本文件证明两件 self-test 结构上做不到的事:
//   ① 真仓当前结论必须是绿 —— 出生即红的门只会逼人 `--no-verify`,连带废掉全部守门;
//   ② 接线状态与定级必须对得上(接线前后各一次的**条件式**断言,沿用守门 99 的形状)——
//      「判据存在而永不调用 = 没有」,而"注册了却非 blocking"同样是半扇门。
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as gate } from '../check-list-predicate-has-positive-proof.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SELF = 'scripts/check-list-predicate-has-positive-proof.mjs'
const SKIP_ENV = 'HUSKY_SKIP_LIST_POSITIVE_PROOF'

const readMap = (m) => (p) => (m.has(p) ? m.get(p) : null)
const readJsonMap = (m) => (p) => {
  if (!m.has(p)) return null
  try {
    return JSON.parse(m.get(p))
  } catch {
    return null
  }
}
const jsEntry = (proofs) => ({
  id: 'x',
  title: 'x',
  list: { kind: 'js', file: 'list.js', name: 'DENIED' },
  proofs,
})
const LIST = "export const DENIED = [\n  'a-alpha',\n] as const\n"

test('T1 登记表非空,且每条 id 唯一(撞号会让跳过开关与失败归属串到别人身上)', () => {
  assert.ok(gate.REGISTRY.length >= 3, '登记表为空 = 本门没有任何覆盖面')
  const ids = gate.REGISTRY.map((e) => e.id)
  assert.equal(new Set(ids).size, ids.length, `登记表 id 重复:${ids.join(',')}`)
})

test('T2 每条登记的名单都必须能被解析出成员,否则本门对它全盲(静默绿灯比红更糟)', () => {
  for (const entry of gate.REGISTRY) {
    const files = new Map()
    for (const p of new Set([
      ...(entry.list.kind === 'js' ? [entry.list.file] : entry.list.files),
      ...entry.proofs,
    ])) {
      try {
        files.set(p, readFileSync(resolve(ROOT, p), 'utf8'))
      } catch {
        // 新文件尚未入库时取不到,由"未判定"分支负责,不在此断言范围内
      }
    }
    const row = gate.judgeEntry(entry, readMap(files), readJsonMap(files))
    if (row.status === 'undetermined') continue // 尚未入库的条目允许未判定
    assert.notEqual(row.status, undefined)
    assert.ok(row.memberCount > 0, `${entry.id} 成员数为 0 ⇒ 判据对它空转`)
  }
})

test('T3 真仓 HEAD 面必须判绿(出生即红的门等于没有门)', () => {
  const out = execFileSync(process.execPath, [SELF], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    windowsHide: true,
  })
  assert.match(out, /取材面=head/)
  assert.match(out, /结论:通过\(判红 0 条\)/)
})

test('T4 声明块不得自证(把名单所在文件当唯一取证面时,只有声明必须判 unproven)', () => {
  // 这一条是 T3 的反面:若判据忘剥声明块,这里会误判 proven,整个门就变成恒绿摆设。
  const m = new Map([['list.js', LIST + '\n// 无 self-test\n']])
  assert.equal(gate.judgeEntry(jsEntry(['list.js']), readMap(m), readJsonMap(m)).status, 'unproven')
  const m2 = new Map([['list.js', LIST + "\nassert(has('a-alpha'))\n"]])
  assert.equal(gate.judgeEntry(jsEntry(['list.js']), readMap(m2), readJsonMap(m2)).status, 'proven')
})

test('T5 遍历判据方向必须是"名单作接收者"(首版写反成方法名在前,静默失效)', () => {
  assert.ok(gate.iterationRegex('DENIED').test('DENIED.some((v) => fn(v))'))
  assert.ok(gate.iterationRegex('DENIED').test('for (const v of DENIED) fn(v)'))
  assert.ok(!gate.iterationRegex('DENIED').test('expect(DENIED).toHaveLength(2)'))
})

test('T6 接线状态与定级必须对得上(未接线⇒本门不进提交链;一旦接线必须 blocking + skipEnv)', () => {
  const runner = readFileSync(resolve(ROOT, 'scripts/guardian-runner.mjs'), 'utf8')
  const wired = runner.includes('check-list-predicate-has-positive-proof.mjs')
  if (!wired) {
    // 主会话尚未接线(本票按任务书不得改注册表)。此分支只允许"如实未接线",
    // 不得被用来掩盖"接线了但没生效"。
    assert.ok(true)
    return
  }
  const block = runner.slice(runner.indexOf('check-list-predicate-has-positive-proof.mjs'))
  const entry = block.slice(0, block.indexOf('script:')).length
    ? block.slice(0, 900)
    : block.slice(0, 900)
  assert.doesNotMatch(entry, /blocking:\s*false/, '本门一旦接线必须 blocking,否则拦不住任何事')
  assert.match(entry, new RegExp(SKIP_ENV), `接线后必须留 ${SKIP_ENV} 应急通道`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
