// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ts-nocheck
/**
 * safe-gc.mjs 的镜像测试(§22c)。
 *
 * 为什么这道器必须有它:2026-10-11 实测本仓 9785 枚未备份悬空 commit 里,9677 枚的 top-level tree
 * 在整个可达历史**一份副本都没有**(最老那枚 `5e56b6ba3aa32d500f4eb6a318e36f2aefeed972` 就是
 * 本仓被重写前的 Initial commit —— 可达 main 的根是同号不同物的 `cf2d9ab3d278…`)。
 * 而改动前的 `safe-gc.mjs` 把 `git gc --prune=now` 写死在 main() 里,AGENTS §5b 又把它推荐为
 * 唯一 GC 出口 ⇒ 任何人跑一次,上述内容全部永久消失,且工具不会问一句。
 * 本文件钉的就是"这一次修好了"之后**不许退回去**的那条线(回归锁住在每次提交都跑的那一层)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
// 动态取模块,**不得**在 Windows 上把绝对路径直接塞进 import()(§22c 记过:恒抛会被读成"判过了")
const SRC_PATH = join(HERE, '..', 'safe-gc.mjs')
const mod = await import(pathToFileURL(SRC_PATH).href)
const T = mod.__test__

const OIDS = ['a'.repeat(40), 'b'.repeat(40)]

// ─── 两档的参数出口 ─────────────────────────────────────────
test('缺省档必须给 --prune=never:整理空间而不销毁任何不可达对象', () => {
  assert.deepEqual(T.gcArgsFor({ destructive: false }), ['gc', '--prune=never'])
  assert.ok(
    !T.gcArgsFor({}).some((a) => String(a).includes('now')),
    '缺省档的参数里不得出现 now(销毁通道不能被"顺手默认打开")',
  )
})

test('破坏性档只在显式 destructive=true 时才产出 --prune=now', () => {
  assert.deepEqual(T.gcArgsFor({ destructive: true }), ['gc', '--prune=now'])
})

// ─── 缺省档不受前置牵制(否则"整理一下"也要先过 fsck,人们会直接跳过工具) ───
test('decideGcRun: 缺省档即使有违规也放行 —— 它一个对象都不删', () => {
  const d = T.decideGcRun({
    destructive: false,
    violations: [{ name: '工作区干净', count: 1, remedy: 'x' }],
    undetermined: [],
  })
  assert.equal(d.action, 'gc')
  assert.equal(d.args[1], '--prune=never')
})

// ─── 破坏性档的两条拒绝分支,各有成对夹具 ───────────────────
test('decideGcRun: 破坏性档遇实测违规 ⇒ 拒绝,并把出路逐条带出', () => {
  const pre = T.preconditionViolations({ statusLines: ['MM PROJECT_PLAN.md'], stashLines: [], unbackedHashes: OIDS })
  const d = T.decideGcRun({ destructive: true, violations: pre.violations, undetermined: pre.undetermined })
  assert.equal(d.action, 'refuse')
  assert.ok(d.violations.some((v) => v.name === '工作区干净'), '拒绝理由必须点名是哪一项')
  assert.ok(
    d.violations.every((v) => typeof v.remedy === 'string' && v.remedy.length > 0),
    '每条拒绝必须带一条跑得通的出路(§16"没有出路"与"有出路但很难"在用户眼里同形)',
  )
})

test('decideGcRun: 前置量不到 ⇒ 拒绝 —— 未判定绝不折成"通过"', () => {
  const pre = T.preconditionViolations({ statusLines: null, stashLines: null, unbackedHashes: null })
  assert.equal(pre.violations.length, 0, '量不到不得冒充违规')
  assert.equal(pre.undetermined.length, 3, `三项都该落未判定,实得 ${pre.undetermined.length}`)
  const d = T.decideGcRun({ destructive: true, violations: pre.violations, undetermined: pre.undetermined })
  assert.equal(d.action, 'refuse', '一把量不到的尺子不得授权销毁')
  assert.match(d.why, /量不到|未判定/)
})

test('decideGcRun: 三项都量到且全空 ⇒ 破坏性档放行(护栏不得变成永久禁行)', () => {
  const pre = T.preconditionViolations({ statusLines: [], stashLines: [], unbackedHashes: [] })
  assert.deepEqual(pre.violations, [])
  assert.deepEqual(pre.undetermined, [])
  const d = T.decideGcRun({ destructive: true, violations: pre.violations, undetermined: pre.undetermined })
  assert.equal(d.action, 'gc')
  assert.equal(d.args[1], '--prune=now')
})

// ─── 与守门 30a 清单出口的契约(它断了,前置就会把"近万枚没备份"读成"干净") ───
test('parseUnbackedList: rc=0 而无清单头 ⇒ [](该缺头在此有含义,不是解析失败)', () => {
  assert.deepEqual(T.parseUnbackedList('── 4. 综合判定 ──\n  ✅ 未发现风险\n', 0), [])
})

test('parseUnbackedList: rc=1 且有头 ⇒ 逐枚 oid,尾随文字自动止住', () => {
  const out = `  --list-unbacked:2 枚(完整 oid,可直接喂 git tag)\n${OIDS[0]}\n${OIDS[1]}\n\n❌ 阻塞`
  assert.deepEqual(T.parseUnbackedList(out, 1), OIDS)
})

test('parseUnbackedList: rc=1 却取不到清单 ⇒ null(未判定),绝不折成 0 枚', () => {
  assert.equal(T.parseUnbackedList('❌ 阻塞但没打清单', 1), null)
})

test('parseUnbackedList: rc=2(门自身异常)⇒ null,不得被读成"干净"', () => {
  assert.equal(T.parseUnbackedList('--list-unbacked:1 枚\n' + OIDS[0], 2), null)
})

test('parseUnbackedList: 输出取不到(undefined)⇒ null', () => {
  assert.equal(T.parseUnbackedList(undefined, 1), null)
})

// ─── 装车证明 + 回归形状锁(读源码面) ───────────────────────
const src = readFileSync(SRC_PATH, 'utf8')

test('装车证明: main 必须真走 decideGcRun / gcArgsFor 这条链,而不是自己拼命令', () => {
  assert.match(src, /const decision = decideGcRun\(\{ destructive/, 'main 必须调判据')
  assert.match(src, /\.\.\.decision\.args/, '派生 git 必须吃判据给出的参数')
  assert.match(src, /measurePreconditions\(repoRoot\)/, '破坏性档必须实测前置')
})

test('回归锁: 旧的写死销毁调用不得回来(`run(\'git gc --prune=now\')`)', () => {
  assert.ok(
    !src.includes("run('git gc --prune=now'"),
    '2026-08-06 至 2026-10-11 的实现形态:唯一 GC 出口无条件销毁,已定性为缺陷',
  )
})

test('回归锁: 顺序必须是 acquire 锁 → 量前置 → 决定(锁外量到的"干净"不作数)', () => {
  // 只在 main 的函数体内找 —— 全文 indexOf 会先命中**函数定义**本身(measurePreconditions 的
  // 声明就在 main 之前),那样这条锁对任何正确代码都恒红、对"把测量挪到锁外"却毫无反应。
  const body = src.slice(src.indexOf('function main()'))
  assert.ok(body.length > 0, 'main 必须在位')
  const acquire = body.indexOf('git-lock.mjs acquire')
  const measure = body.indexOf('measurePreconditions(repoRoot)')
  const decide = body.indexOf('const decision = decideGcRun')
  assert.ok(acquire >= 0 && measure >= 0 && decide >= 0, `三处调用必须在 main 内各出现一次(得 ${acquire}/${measure}/${decide})`)
  assert.ok(acquire < measure && measure < decide, `顺序错:acquire=${acquire} measure=${measure} decide=${decide}`)
})

test('回归锁: --window-days 0 必须出现在清单调用里(销毁不看窗)', () => {
  const i = src.indexOf('function listUnbackedHashes')
  assert.ok(i > 0, '清单消费函数必须在位')
  const body = src.slice(i, src.indexOf('\n}', i))
  assert.ok(body.includes("'--window-days'") && body.includes("'0'"), '全量档契约:窗只决定拦哪一档,不决定毁哪一档')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
