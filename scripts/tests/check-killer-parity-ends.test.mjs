// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 `scripts/check-killer-parity-ends.mjs` 的 §22c 镜像测试。
//
// 为什么要有这一份:该门判的是"某个值有没有被二次写死",而它自己最可能坏在两处 ——
// ① 豁免表被写成"整片放行"(那它下一步就是把真违例也放掉);② 取材退回磁盘(共享工作树常年
// 滞后 HEAD,于是别人的在途改动被算成本仓违例、而已入库的违例反而看不见)。这两种坏法都不
// 报错,只让账面变干净,所以必须用**源码级反向锁**钉,而不是再加几条判据断言(断言会跟着漂绿)。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')
const SRC_REL = 'scripts/check-killer-parity-ends.mjs'

const gate = await import('../check-killer-parity-ends.mjs')
const { RULES, EXEMPT, inScope, scanSource, validateExemptRegistry, exemptionsFor, analyze } =
  gate.__test__

const CHEVRON = 'packages/shared/src/ui/back-chevron-spec.ts'
const OTHER = 'apps/web/src/components/some-card.tsx'
const headBlob = (rel) =>
  execFileSync(
    'git',
    ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', 'show', `HEAD:${rel}`],
    {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      windowsHide: true,
    },
  )

/* T1–T2:豁免必须是"按规则"的,不得整片放行(那等于该文件从此不受本门看守)。 */
test('T1 被规则级豁免的 0.6 不判红,而同文件的其它规则照判红', () => {
  const six = headBlob(CHEVRON)
  const a = scanSource(CHEVRON, six)
  assert.equal(a.violations.length, 0, `真仓那一行应被豁免,实得:${JSON.stringify(a.violations)}`)
  assert.equal(a.exempted.length, 1, '豁免必须留痕(计数),不得静默放过')
  assert.match(a.exempted[0].reasons[0], /同值不同义/)

  const proto = "export const P = '2024-11-05'\n"
  const keep = 'const keepRecent = 6\n'
  const b = scanSource(CHEVRON, proto + keep)
  assert.equal(
    b.violations.length,
    2,
    '同一文件在别的规则上写死必须照判红 —— 豁免不得被写成文件级整片放行',
  )
})

test('T2 未豁免文件的同一形状必须判红(豁免不得按值扩散到全仓)', () => {
  const r = scanSource(OTHER, 'export const OPACITY = 0.6\n')
  assert.equal(r.violations.length, 1)
  assert.equal(r.violations[0].rule, RULES[2].name)
  assert.deepEqual(exemptionsFor(OTHER, RULES[2].name), [], '该路径不在豁免表里')
})

/* T3:阳性对照 —— 判据真能认出被审面上的那个形态(否则"违例 0"是瞎出来的)。 */
test('T3 真仓内容 + 空豁免表 ⇒ 必须判红', () => {
  const six = headBlob(CHEVRON)
  const naked = scanSource(CHEVRON, six, RULES, [])
  assert.ok(naked.violations.length >= 1, 'pattern 认不出真仓那一行 ⇒ 本门对该型失明')
  assert.equal(naked.violations[0].rule, RULES[2].name)
})

/* T4:坏登记表必须拒绝出结论,而不是"照常跑但没人生效"。 */
test('T4 豁免表坏了(规则名写歪 / 缺理由)⇒ 报问题,且 analyze 直接拒绝出结论', () => {
  assert.equal(
    validateExemptRegistry(RULES, [{ file: /x$/, reason: 'r', rule: '不存在的名字' }]).length,
    1,
  )
  assert.equal(validateExemptRegistry(RULES, [{ file: /x$/, rule: RULES[2].name }]).length, 1)
  assert.deepEqual(validateExemptRegistry(RULES, EXEMPT), [], '入库的那份表必须是好的')
  assert.throws(
    () =>
      analyze({
        face: 'head',
        rules: RULES,
        exempts: [{ file: /y$/, rule: '不存在的名字', reason: 'r' }],
      }),
    /豁免登记表坏了/,
  )
})

/* T5:扫描集口径 —— 与旧磁盘 walk 同形(目录排除、单源跳过、只看三种扩展名)。 */
test('T5 inScope 与旧 walk 同形,且单源包/产物目录不进射程', () => {
  assert.equal(inScope('packages/shared/src/ui/x.ts'), true)
  assert.equal(inScope('apps/cli/src/a/b.tsx'), true)
  assert.equal(inScope('packages/context-compaction/src/x.ts'), false, '单源侧包必须跳过')
  assert.equal(inScope('apps/web/src/a/dist/x.ts'), false)
  assert.equal(inScope('apps/web/src/.cache/x.ts'), false, '点开头目录整棵跳过')
  assert.equal(inScope('apps/web/src/x.css'), false)
})

/* T6:取材面反向锁(源码级)。判据失效的表现永远是安静,所以这一条不看行为只看形状。 */
test('T6 取材必须走层(catBatch/readWorktreeFile),不得退回磁盘读被审内容', () => {
  const src = fs.readFileSync(path.join(ROOT, SRC_REL), 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '必须引共用取材层')
  assert.match(src, /catBatch\(/, '内容必须经层的 catBatch')
  assert.match(src, /readWorktreeFile\(/, 'worktree 档也必须经层,而不是 readFileSync')
  assert.match(src, /selectFace\(/, '必须经层选面(两面旗同给由层判死)')
  assert.doesNotMatch(src, /readFileSync\(/, '不得再出现磁盘 readFileSync(守门 118 的 loose-fs)')
  assert.doesNotMatch(src, /readdirSync\(/, '不得再用目录 walk 枚举被审内容')
  assert.match(src, /isDirectRun/, '§22d:测试 import 时不得触发 CLI 副作用')
})

/* T7:两面旗同给 ⇒ exit 2(不冒红也不记绿)。端到端 spawn,不靠读代码猜。 */
test('T7 --staged --worktree 同给 ⇒ rc=2 并给出可诊断原因', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, SRC_REL), '--staged', '--worktree'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120000,
    windowsHide: true,
  })
  assert.equal(r.status, 2, `实得 rc=${r.status} out=${r.stdout} err=${r.stderr}`)
  assert.ok((r.stdout + r.stderr).trim().length > 0, '判死必须大声给原因')
})

/* T8:装车证明 —— 本门必须真被某个调度器跑。它**不在提交链**(不改运行时能力,挂 blocking
      就是与任何提交都无关的恒红门,§12e),而在 `pnpm check:all` —— 所以"已接线"的形态是
      `check:all` 里挂着一个别名、别名那条脚本体真调用本文件。只按 `scripts/<name>` 子串判会
      漏掉这种两跳形态(第一版就在这里误红:门明明在跑,报告却说没人调)。 */
test('T8 已接线:check:all 经别名真调用本脚本,且脚本在 HEAD 面上存在', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))
  const scripts = pkg.scripts || {}
  const base = SRC_REL.split('/').pop() // check-killer-parity-ends.mjs
  const stem = base.replace(/\.mjs$/, '')
  const callsThisScript = (cmd) => {
    const s = String(cmd).replace(/\\/g, '/')
    return (
      s.includes(`scripts/${base}`) || s.includes(`scripts/${stem}`) || s.includes(`node ${base}`)
    )
  }
  const direct = Object.entries(scripts).filter(([, v]) => callsThisScript(v))
  assert.ok(direct.length >= 1, `没有任何脚本调用 ${base} ⇒ "门存在但无人跑"`)
  const aliases = direct.map(([k]) => k)
  const all = String(scripts['check:all'] || '')
  const viaAlias = aliases.some((a) =>
    new RegExp(`(^|\\s|&&)\\s*pnpm\\s+${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$|:)`).test(
      all,
    ),
  )
  assert.ok(
    viaAlias || callsThisScript(all),
    `check:all 未挂本门(本次红就是在它身上量到的)。候选别名:${aliases.join(', ')};check:all:${all.slice(0, 120)}…`,
  )
  const tree = execFileSync('git', ['-c', 'safe.directory=*', 'ls-tree', 'HEAD', '--', SRC_REL], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  })
  assert.match(tree, /check-killer-parity-ends\.mjs/, '脚本必须在被审面上,否则注册是空指针')
})

/* T9:自检必须真跑通(端到端,不是 import 判据函数 —— 恒绿的自检比没有自检更糟)。 */
test('T9 --self-test 端到端 rc=0', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, SRC_REL), '--self-test'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 300000,
    windowsHide: true,
  })
  assert.equal(r.status, 0, `自检未通过:${r.stdout}\n${r.stderr}`)
  assert.match(r.stdout, /自检 \d+\/\d+ 通过/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
