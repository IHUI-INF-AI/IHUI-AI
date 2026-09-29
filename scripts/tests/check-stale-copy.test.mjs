// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试 — scripts/check-stale-copy.mjs 的「修复出路可兑现性」判据。
//
// 立票:台账 G-816503(原编号 G-815998)。病灶是门失败时打印的一条"详细检测法:
// .ihui-agent/tmp/detect-stale2.mjs" —— 该路径在工作树、索引、HEAD 树与
// `git log --all --diff-filter=A` 全量零命中,从来没被版本化过(而 `.ihui-agent/tmp/`
// 整目录被 gitignore,结构上不可能成为受版本控制的出路)。
//
// 为什么这些断言各自存在:
//  T1/T2 判据在位**且真被接线调用**(本仓最高频事故是"函数在、没人调 ⇒ 一路绿灯");
//  T3 正例 + T4 反例成对(只判一边 = 允许整块被摘线);
//  T5 取不到面不得被记成通过;T6 死指针字面量不得回来。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { catBatch } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-stale-copy.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE_REL = 'scripts/check-stale-copy.mjs'
const hints = gate.repairHintLines()

/** 被审面(HEAD)的 has —— 判据读哪一面,测试就验哪一面,不得混取。 */
function headHas(candidates) {
  const specs = candidates.map((p) => `HEAD:${p}`)
  const map = catBatch(ROOT, specs)
  return (p) => {
    const v = map.get(`HEAD:${p}`)
    return v !== undefined && v !== null
  }
}

test('T1 出路文本真被 main() 打印(不是只定义在文件里)', () => {
  const src = catBatch(ROOT, [`HEAD:${GATE_REL}`]).get(`HEAD:${GATE_REL}`)
  assert.ok(src && src.length > 0, 'HEAD 面取不到门体,本断言等于没跑')
  // 失败分支必须是 `for (const line of repairHintLines())` 这种**调用**形态,
  // 而不是把同一段文案再抄一份 console.error(抄的那份永远不会被自检判到)。
  assert.match(src, /for \(const line of repairHintLines\(\)\) console\.error\(line\)/)
})

test('T2 可兑现性判据真挂在失败路径上(判据在而无人调 = 没有)', () => {
  const src = catBatch(ROOT, [`HEAD:${GATE_REL}`]).get(`HEAD:${GATE_REL}`)
  assert.match(src, /const v = checkExitsResolvable\(/)
  // 且自检入口真被 CLI 派发(否则 --self-test 是一句跑不通的出路 —— 正是本票那一型)
  assert.match(src, /process\.argv\.includes\('--self-test'\)\)\s*process\.exit\(selfTest\(\)\)/)
})

test('T3 正例:真门体打印的出路全部在被审面上可兑现,且候选非空', () => {
  const candidates = gate.printedPathCandidates(hints)
  assert.ok(candidates.length >= 1, '零候选的"全部可兑现"是空话,判据必须能问出候选')
  const v = gate.checkExitsResolvable({ lines: hints, has: headHas(candidates) })
  assert.equal(v.kind, 'pass', `出路不可兑现:${JSON.stringify(v.missing)} ${v.why}`)
})

test('T4 反例:面里取不到的出路必须 fail 并点名(否则判据恒绿)', () => {
  const v = gate.checkExitsResolvable({
    lines: ['详细检测法:.ihui-agent/tmp/never-committed-xyz.mjs'],
    has: () => false,
  })
  assert.equal(v.kind, 'fail')
  assert.deepEqual(v.missing, ['.ihui-agent/tmp/never-committed-xyz.mjs'])
})

test('T5 没注入被审面读取器 ⇒ undetermined,不得被记成通过', () => {
  const v = gate.checkExitsResolvable({ lines: hints })
  assert.equal(v.kind, 'undetermined')
  assert.match(v.why, /无从验证/)
})

test('T6 本票点名的死指针不得再出现在门体的 HEAD blob 里', () => {
  const src = catBatch(ROOT, [`HEAD:${GATE_REL}`]).get(`HEAD:${GATE_REL}`)
  assert.ok(src, 'HEAD 面取不到门体')
  assert.equal((src.match(/detect-stale2/g) || []).length, 0, '死指针回潮(该路径从未入库)')
  // 出路文本里不得再指向 gitignore 的临时目录 —— 那里的一切只存在于一台机器
  assert.doesNotMatch(hints.join('\n'), /\.ihui-agent\/tmp/)
})

test('T7 变异自证的载体:摘掉 printedPathCandidates 里的两型前缀 ⇒ T3 立即拿不到候选', () => {
  // 不真改门体,而是构造一份"只认 scripts/ 不认 .ihui-agent/tmp/"的判据输入,
  // 证明本票那一型的检出依赖这条正则的前缀交替(把它写死成只认一边就是漏报)。
  const onlyTmp = gate.printedPathCandidates(['详见 scripts/a.mjs 与 .ihui-agent/tmp/b.mjs'])
  assert.deepEqual(onlyTmp, ['.ihui-agent/tmp/b.mjs', 'scripts/a.mjs'])
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
