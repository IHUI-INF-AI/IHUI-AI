// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * `scripts/check-model-capacity-parity.mjs` 的 §22c 镜像测试。
 *
 * 为什么必须存在:该门的判据是"两侧同一批事实逐项等值",而它自己**也是两侧之一** ——
 * 它读五份输入、跑一套解析器。测试里若复制一份解析逻辑,就成了"用另一把尺子量同一件事",
 * 源门漂移时测试照样绿(§22c 的原始动因:镜像常量漂移 = 测试只复读实现就是复读机)。
 * 所以本文件**只 import 生产实现**(`__test__`),一条解析规则都不重写。
 *
 * 跑法:`node --test scripts/tests/check-model-capacity-parity.test.mjs`
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate } from '../check-model-capacity-parity.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC_NAME = 'check-model-capacity-parity.mjs'

const gitShow = (refPath) =>
  execFileSync('git', ['-c', 'safe.directory=*', '-C', ROOT, 'show', refPath], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    timeout: 120_000,
  })

/** 真仓 HEAD 的五份输入(纯函数判据要用它,不依赖工作树是否滞后)。 */
function realContents() {
  const out = {}
  for (const [, rel] of Object.entries(gate.FILES)) {
    out[rel] = gitShow(`HEAD:${rel}`)
  }
  return out
}

test('T1 门体不得有第二份解析真相:测试文件必须 import 生产实现', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'tests', `${SRC_NAME.replace('.mjs', '')}.test.mjs`), 'utf8')
  assert.match(src, /from '\.\.\/check-model-capacity-parity\.mjs'/, '没 import 生产实现 ⇒ 本测试只是在复读自己的副本')
  // 反向锁:不得在测试里重写表解析(这些标识符只属于源门)
  assert.doesNotMatch(src, /EXACT_CAPACITY\s*=|LOW_WINDOW_OVERRIDES\s*=/, '测试里出现表定义 ⇒ 第二份真相')
})

test('T2 真仓 HEAD 面必须"看得见且不判红":看不见=门瞎,判红=恒红门', () => {
  const r = gate.decide(realContents())
  assert.ok(r.tables, `判据输入读不出表(未判定即失明):${JSON.stringify(r.undetermined)}`)
  // tables 的值是**各侧读到的条数/取值**(门自己已把"0 条"折进 undetermined,这里再独立验一次):
  // 任何一格是 0 / 空 ⇒ "扫到 0"要先怀疑尺子,不得当成"两侧一致"。
  for (const [k, v] of Object.entries(r.tables)) {
    const nonEmpty = Array.isArray(v) ? v.length > 0 : typeof v === 'number' ? v > 0 : v && typeof v === 'object' && Object.keys(v).length > 0
    assert.ok(nonEmpty, `表 ${k} 读出空值(${JSON.stringify(v)})⇒ 判据对该维度失明`)
  }
  assert.deepEqual(r.drifts, [], `真仓 HEAD 现读漂移 ⇒ 这道门不能以 blocking 接进提交链:${JSON.stringify(r.drifts)}`)
  assert.deepEqual(r.undetermined, [], '既有输入被判不出 ⇒ 不得把"没判"当成通过')
})

test('T3 阳性对照:只改 Python 兜底一个数,必须只红兜底那一条并点名两侧值', () => {
  const c = realContents()
  const py = gate.FILES.pyWindow
  const injected = c[py].replace('DEFAULT_CONTEXT_WINDOW = 128_000', 'DEFAULT_CONTEXT_WINDOW = 120_000')
  assert.notEqual(injected, c[py], '注入未命中 ⇒ 这条对照是空转(必须改锚点而不是删测试)')
  const r = gate.decide({ ...c, [py]: injected })
  assert.equal(r.drifts.length, 1, JSON.stringify(r.drifts))
  assert.match(JSON.stringify(r.drifts), /120000|120_000/, '结论行要能把两侧量出来')
})

test('T4 阴性对照:两侧同值时不得产出任何红(与 T3 成对,证明 T3 不是恒真)', () => {
  const r = gate.decide(realContents())
  assert.equal(r.drifts.length, 0)
})

test('T5 任一份输入取不到 ⇒ 记"未判定",绝不记绿也不冒红', () => {
  const c = realContents()
  const missingKey = gate.FILES.tsEffort
  const r = gate.decide({ ...c, [missingKey]: '' })
  assert.equal(r.tables, null)
  assert.equal(r.drifts.length, 0, '取不到输入却判红 = 把工具故障算成仓库违规')
  assert.match(String(r.undetermined[0]), /取不到|无法判定/, JSON.stringify(r.undetermined))
})

test('T6 注释里的键值行不得被读成条目(两侧同一防线)', () => {
  const c = realContents()
  const ts = gate.FILES.tsCapacity
  const polluted = `${c[ts]}\n// 说明:示例 'fake-probe-model': 7_000 只是文档,不是条目\n`
  const r = gate.decide({ ...c, [ts]: polluted })
  assert.equal(r.drifts.length, 0, `注释行被判成漂移:${JSON.stringify(r.drifts)}`)
})

test('T7 装车证明:已注册则必须成套(blocking + skipEnv 用门自己声明的名 + 输入清单在位)', () => {
  const runner = gitShow('HEAD:scripts/guardian-runner.mjs')
  const at = runner.indexOf(`  script: '${SRC_NAME}'`)
  if (at < 0) {
    // 未注册不是错误,但**不得被读成已装车**:本仓"造好没装车"记过最多次,方向性对照必须存在。
    assert.fail(`${SRC_NAME} 尚未注册进 guardian-runner —— 这条镜像用例的意义就是拦住"以为已接线"`)
  }
  const entry = runner.slice(Math.max(0, at - 900), at + 900)
  assert.match(entry, /mode:\s*'blocking'/)
  assert.match(entry, new RegExp(`skipEnv:\\s*'${gate.SELF_SKIP}'`), '应急跳过名必须与门自己声明的同一个')
})

test('T8 门自己不得谎报接线(头注措辞受守门 89 R1 管辖)', () => {
  const head = readFileSync(join(ROOT, 'scripts', SRC_NAME), 'utf8').slice(0, 4000)
  assert.doesNotMatch(head, /已接 pre-commit|CI 必跑/, '头注写死"已接线"而未接线 = 守门 89 的 R1 恒红')
})
