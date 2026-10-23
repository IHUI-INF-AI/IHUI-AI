// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/auto-update-readme-recent.mjs(§22c:判据一律 import 源脚本的 __test__,不复制)。
//
// 钉什么(2026-10-23 立):
//   本器旧实现遇到「RECENT UPDATES 锚点缺失/成双/错位」时 `continue` —— 既不写盘也**不出声**,
//   末尾还照打 `✅ 最近更新无新增提交,跳过`(AGENTS §0.3「没判绝不写成判过」)。而本仓当下真实
//   发生的形态是:活文档归并器(`union-converge` 行级 union、`merge-live-doc` 的
//   「无锚点⇒追加到文件末尾」)把块内条目整段甩到 `END` **之后**,README 尾部因此反复长出
//   同族重复段。实测一轮清扫(README 7534→5794 行)在约四十分钟内被归并合回,`### 通病 ②`
//   那枚重复标题从 20 份涨到 24 份 —— 只洗文档、不动器物,下一轮必然再长回来。
//   所以这里钉三件事:①锚点不成立 ⇒ **不落盘**(字节逐字不变)且点名、退出码 2;
//   ②阳性对照:锚点成立时**必须照写**(防把守卫做成恒拒 ⇒ 该器失效 = 没有);
//   ③形状锁:拒写分支里不得出现任何写盘动作,全器只许有一处写 README 的 `writeFileSync`。
//
// 临时仓落点 = `scripts/lib/scratch-dir.mjs` 的 mkScratch()(§15b/§15c:仓树内绝不 nesting git 仓)。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../..')
const SRC = join(REPO, 'scripts/auto-update-readme-recent.mjs')
const SRC_TEXT = readFileSync(SRC, 'utf8')
const { __test__ } = await import(pathToFileURL(SRC).href)
const { assessAnchors, countEntriesOutsideBlock, BEGIN, END, ALL_LABELS, ALL_EMOJIS, selfTest } = __test__

/** 造一份"锚点齐备、块内有内容"的 README(其余三份不存在即被跳过,不影响判定)。 */
const docWith = (inner) => `# T\n\n## 最近更新(自动维护)\n${BEGIN}\n${inner}\n${END}\n尾行\n`

// ── 纯判据面(零 IO,正反成对)───────────────────────────────────────────────
test('A1 单对锚点 ⇒ ok', () => {
  assert.equal(assessAnchors(docWith('**2026-01-01**'), BEGIN, END).state, 'ok')
})

test('A2 缺 END ⇒ missing 且把枚数报出来(不静默)', () => {
  const v = assessAnchors(`x\n${BEGIN}\n内容`, BEGIN, END)
  assert.equal(v.state, 'missing')
  assert.equal(v.endCount, 0)
  assert.match(v.reason, /END 0 枚/)
})

test('A3 缺 BEGIN ⇒ missing', () => {
  assert.equal(assessAnchors(`内容\n${END}`, BEGIN, END).state, 'missing')
})

test('A4 锚点成双 ⇒ ambiguous —— indexOf 取第一对会把中间内容整段覆盖,必须拒写', () => {
  const v = assessAnchors(`${BEGIN}\na\n${END}\n${BEGIN}\nb\n${END}\n`, BEGIN, END)
  assert.equal(v.state, 'ambiguous')
  assert.equal(v.beginCount, 2)
  assert.equal(v.endCount, 2)
})

test('A5 END 在 BEGIN 之前 ⇒ inverted', () => {
  assert.equal(assessAnchors(`${END}\n${BEGIN}\n`, BEGIN, END).state, 'inverted')
})

test('A6 自检面本身评估得动(守门 89 同型:门造好没接线 = 没有)', () => {
  assert.equal(selfTest(), 0)
})

test('B1/B2 块外散落探测:块内不算散落、块外逐条数到', () => {
  const inside = docWith('**2026-01-01**\n- 🐞 修复:样例 (abcdef12345)')
  assert.equal(countEntriesOutsideBlock(inside, BEGIN, END, ALL_LABELS, ALL_EMOJIS), 0)
  const stray = `${inside}\n- 🚀 新功能/改进:尾上一枚 (1234567)\n- 🐞 Fix:one in english (abcdef12345)\n`
  assert.equal(countEntriesOutsideBlock(stray, BEGIN, END, ALL_LABELS, ALL_EMOJIS), 2)
})

test('B3 取不到区间 ⇒ -1 未判定,绝不冒充 0', () => {
  assert.equal(countEntriesOutsideBlock('没有标记的文档', BEGIN, END, ALL_LABELS, ALL_EMOJIS), -1)
})

test('B4 普通散文(无类型 emoji / 无括号提交号)不被数进来', () => {
  const t = `${docWith('**d**')}\n- 一条普通说明,不带提交号\n`
  assert.equal(countEntriesOutsideBlock(t, BEGIN, END, ALL_LABELS, ALL_EMOJIS), 0)
})

// ── 形状锁(判据在源码里的落点,防"守卫被摘")───────────────────────────────
test('S1 形状锁:全器只有一处写 README 的 writeFileSync,且它排在锚点判定之后', () => {
  const writes = SRC_TEXT.split('\n').filter((l) => /fs\.writeFileSync\(p,/.test(l))
  assert.equal(writes.length, 1, `写文档的 writeFileSync 只许一处,现读 ${writes.length} 处`)
  const guardAt = SRC_TEXT.indexOf("verdict.state !== 'ok'")
  const writeAt = SRC_TEXT.indexOf('fs.writeFileSync(p,')
  assert.ok(guardAt > 0 && writeAt > guardAt, '必须先判锚点、后才允许写盘')
})

test('S2 形状锁:拒写分支体内不含任何写盘动作', () => {
  const at = SRC_TEXT.indexOf("if (verdict.state !== 'ok') {")
  assert.ok(at > 0, '拒写分支必须存在')
  const body = SRC_TEXT.slice(at, SRC_TEXT.indexOf('\n    }', at))
  assert.ok(!/writeFileSync|gitRaw|execSync|appendFileSync/.test(body), `拒写分支里出现了写动作:\n${body}`)
})

test('S3 形状锁:「追加到文件末尾」这条路在本器里不存在(失效方向是拒写,不是多放一次)', () => {
  assert.ok(!/out\.push|concat\(|\+=\s*block/.test(SRC_TEXT), '不得出现把内容甩到全文末尾的写法')
  assert.ok(/REFUSED:/.test(SRC_TEXT), '拒写必须点名')
})

// ── 端到端:真仓之外跑一次,证明"不落盘"是字节层面的事实──────────────────────
/** 只把 git 取料层换成语义等价的薄壳(execFileSync + 绝对 stdio),判据本体逐字取真仓源文件。 */
function buildScratchRepo(kind) {
  const dir = mkScratch('readme-anchor-guard')
  mkdirSync(join(dir, 'scripts/lib'), { recursive: true })
  copyFileSync(SRC, join(dir, 'scripts/auto-update-readme-recent.mjs'))
  writeFileSync(
    join(dir, 'scripts/lib/face-reader.mjs'),
    [
      "import { execFileSync } from 'node:child_process'",
      'export function gitRaw(args, cwd) {',
      "  return execFileSync('git', ['-c', 'safe.directory=*', ...args], {",
      '    cwd, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"],',
      '  })',
      '}',
      '',
    ].join('\n'),
  )
  const git = (args) => execFileSync('git', ['-c', 'safe.directory=*', ...args], { cwd: dir, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  git(['init', '-q'])
  git(['config', 'user.email', 'fixture@example.invalid'])
  git(['config', 'user.name', 'fixture'])

  const inner = '**2026-01-01**\n- 🐞 修复:块内原有的一枚 (deadbeef1)'
  let text
  if (kind === 'missing-end') text = docWith(inner).replace(`${END}\n`, '')
  else if (kind === 'ambiguous') text = `${docWith(inner)}\n${BEGIN}\n另一对\n${END}\n`
  else if (kind === 'inverted') text = `# T\n${END}\n块内\n${BEGIN}\n尾行\n`
  else text = docWith(inner)

  writeFileSync(join(dir, 'README.md'), text)
  git(['add', 'README.md'])
  git(['commit', '-q', '-m', 'chore: seed fixture'])
  const seedSha = git(['rev-parse', 'HEAD']).trim()
  // 基线钉在首枚 ⇒ 第二枚提交才产出条目(否则 last-sha..HEAD 为空,阳性对照写不出东西)
  mkdirSync(join(dir, '.doc-autoupdate'), { recursive: true })
  writeFileSync(join(dir, '.doc-autoupdate', 'last-sha'), `${seedSha}\n`)
  writeFileSync(join(dir, 'other.txt'), 'x\n')
  git(['add', 'other.txt'])
  git(['commit', '-q', '-m', 'fix: 修掉一个用户可感的问题'])
  return { dir, git, text, seedSha }
}

function runTool(dir) {
  try {
    const out = execFileSync(process.execPath, ['scripts/auto-update-readme-recent.mjs'], {
      cwd: dir, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { code: 0, out: `${out}` }
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout || ''}${e.stderr || ''}` }
  }
}

for (const kind of ['missing-end', 'ambiguous', 'inverted']) {
  test(`E2E 锚点${kind} ⇒ 不落盘 + 点名 + exit 2(README 字节逐字不变)`, () => {
    const { dir, text, seedSha } = buildScratchRepo(kind)
    try {
      const r = runTool(dir)
      assert.equal(r.code, 2, `退出码必须是 2(未判定),实读 ${r.code}\n${r.out}`)
      assert.match(r.out, /REFUSED:README\.md/, '必须逐条点名被拒的文档')
      assert.doesNotMatch(r.out, /无新增提交,跳过/, '拒写轮绝不再打"成功跳过"')
      assert.equal(readFileSync(join(dir, 'README.md'), 'utf8'), text, '锚点不成立时 README 必须逐字节不动')
      assert.equal(
        readFileSync(join(dir, '.doc-autoupdate', 'last-sha'), 'utf8').trim(),
        seedSha,
        '拒写轮不得推进增量基线(否则这一轮的提交永远不再进最近更新)',
      )
    } finally {
      rmScratch(dir)
    }
  })
}

test('E2E 阳性对照:锚点齐备 ⇒ 块真的被刷新(守卫不是恒拒,防 §12e 把器物做成摆设)', () => {
  const { dir } = buildScratchRepo('ok')
  try {
    const before = readFileSync(join(dir, 'README.md'), 'utf8')
    const r = runTool(dir)
    assert.equal(r.code, 0, r.out)
    const after = readFileSync(join(dir, 'README.md'), 'utf8')
    assert.notEqual(after, before, '锚点齐备时块必须被写入新条目')
    assert.match(after, /修掉一个用户可感的问题/, '新条目应来自 last-sha..HEAD 的那枚提交')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
