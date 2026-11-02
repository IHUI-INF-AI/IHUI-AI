// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat S-BYPASS 2026-11-01

/**
 * 票 L33560 验收:冲突标记判据接到**旁路落地的源头**。
 *
 * 钉四件事:
 *   ① 空冲突区(两侧零正文)⇒ `strippable`,**不拦**(票面明令"不得一律禁止手删");
 *   ② 区内有真内容 ⇒ `must-block`,**拦落地**(票面明令"不得一律放过");
 *   ③ 单行 `=======` 不判(P2 回归);
 *   ④ `<<<<<<< SEARCH` / `>>>>>>> REPLACE` 补丁夹具不判(E1 回归 —— 这是最关键的防误报)。
 * 另加两条装车锁:源头判据必须真被 `buildUnion` 调用、且判红走**该器既有**的 bad → exit 1,
 * 以及 `plan()` 在合成仓里对带正文的冲突区真判红(⑤)。
 *
 * 所有落地面跑测都在 `mkScratch`(= os.tmpdir())的合成仓里,**绝不在真仓上跑 --apply**。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import {
  LANDING_MARKER_SKIP_ENV,
  classifyMarkerRegions,
  judgeLandingText,
  gateLandingMarkers,
} from '../lib/conflict-marker-landing-gate.mjs'
import { __test__ as U } from '../union-converge.mjs'

const GIT = resolveGitBin() || 'git'

/** 空冲突区(两侧零正文):票面 ① 的原样形态。 */
const EMPTY_REGION = ['# 标题', '正文', '<<<<<<< HEAD', '=======', '>>>>>>> abc', '尾行'].join('\n')
/** 两侧各有真内容:票面 ② 的原样形态。 */
const CONTENT_LOSS = ['# 标题', '<<<<<<< HEAD', '本侧正文', '=======', '对侧正文', '>>>>>>> feat/x', '尾行'].join('\n')

test('① empty-region(三行空冲突区)⇒ strippable,不拦', () => {
  const regions = classifyMarkerRegions(EMPTY_REGION)
  assert.equal(regions.length, 1, `应识别出 1 对标记,实得 ${regions.length}`)
  assert.equal(regions[0].type, 'empty-region')
  assert.equal(regions[0].verdict, 'strippable')
  assert.equal(regions[0].startLine, 3)
  assert.equal(regions[0].sepLine, 4)
  assert.equal(regions[0].endLine, 5)

  const g = gateLandingMarkers([{ path: 'AGENTS.md', text: EMPTY_REGION }])
  assert.equal(g.verdict, 0, '空冲突区不得拦落地(否则空区永远只能靠人工摘,回到本票立项现场)')
  assert.deepEqual(g.violations, [])
  assert.equal(g.advices.length, 1, '必须报出"建议摘除",不能静默放过')
  assert.match(g.advices[0], /建议摘除/)
})

test('② content-loss(两侧各有真内容)⇒ must-block,拦落地并点名行号原文', () => {
  const regions = classifyMarkerRegions(CONTENT_LOSS)
  assert.equal(regions.length, 1)
  assert.equal(regions[0].type, 'content-loss')
  assert.equal(regions[0].verdict, 'must-block')
  assert.deepEqual(regions[0].oneSideLines, ['本侧正文'])
  assert.deepEqual(regions[0].otherSideLines, ['对侧正文'])

  const g = gateLandingMarkers([{ path: 'AGENTS.md', text: CONTENT_LOSS }])
  assert.equal(g.verdict, 1, '区内有正文 ⇒ 必须判红档')
  assert.equal(g.violations.length, 1)
  assert.match(g.violations[0], /AGENTS\.md:2–6/)
  assert.match(g.violations[0], /拒绝落地/)
  assert.match(g.violations[0], /<<<<<<< HEAD/, '必须点名冲突标记原文')
})

test('②b 只有一侧有正文也判 must-block(摘标记时"选空的那侧"就是静默丢内容)', () => {
  const oneSided = ['<<<<<<< HEAD', '=======', '对侧正文', '>>>>>>> x'].join('\n')
  assert.equal(classifyMarkerRegions(oneSided)[0].verdict, 'must-block')
  // 成对但缺 ======= 分隔行 ⇒ 形态不可辩护,保守归严
  const noSep = ['<<<<<<< HEAD', 'a', 'b', '>>>>>>> x'].join('\n')
  const r = classifyMarkerRegions(noSep)
  assert.equal(r.length, 1)
  assert.equal(r[0].sepLine, null)
  assert.equal(r[0].verdict, 'must-block')
})

test('③ 单行 ======= (setext 下划线 / 表格分隔)⇒ 不判(P2 回归)', () => {
  const md = ['# 标题', '正文', '小节名', '=======', '另一段', '| a | b |', '| --- | --- |'].join('\n')
  assert.deepEqual(classifyMarkerRegions(md), [])
  const g = gateLandingMarkers([{ path: 'README.md', text: md }])
  assert.equal(g.verdict, 0)
  assert.deepEqual(g.violations, [])
  assert.deepEqual(g.advices, [])
})

test('④ <<<<<<< SEARCH / >>>>>>> REPLACE 补丁夹具 ⇒ 不判(E1 防误报回归)', () => {
  // 与 apps/cli/tests/file-edit.test.ts:112-127 的夹具同形(首块开头带 `const patch = \`` 前缀,
  // 第二块开头才在行首):配对判据把这一对归 exempt,本判据只吃 pairs ⇒ 同样放过。
  const patch = [
    'const patch = `<<<<<<< SEARCH',
    'one',
    '=======',
    'ONE',
    '>>>>>>> REPLACE',
    '<<<<<<< SEARCH',
    'three',
    '=======',
    'THREE',
    '>>>>>>> REPLACE`;',
  ].join('\n')
  assert.deepEqual(classifyMarkerRegions(patch), [])
  assert.equal(judgeLandingText('apps/cli/tests/file-edit.test.ts', patch).verdict, 'clean')

  // 真仓 HEAD 上唯一含冲突标记形的那个文件,必须同样判干净(不靠夹具漂移,直接读原件)
  const real = readFileSync(join(import.meta.dirname, '..', '..', 'apps', 'cli', 'tests', 'file-edit.test.ts'), 'utf8')
  assert.deepEqual(
    classifyMarkerRegions(real),
    [],
    '真仓里的 SEARCH/REPLACE 夹具不得被判红(否则本判据一上线就把 HEAD 变成恒红)',
  )
})

test('⑤ 源头判据装车:合成仓里带正文的冲突区 ⇒ plan() 判红进既有 bad 通道', () => {
  const dir = mkScratch('union-marker-gate-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    }).trim()
  try {
    run('init', '-q', '-b', 'main')
    run('config', 'user.email', 't@t')
    run('config', 'user.name', 't')
    run('config', 'core.autocrlf', 'false')
    // 基底
    writeFileSync(join(dir, 'AGENTS.md'), '# 标题\na\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'base')
    // 本侧:只加一个无关文件(AGENTS.md 不动)
    writeFileSync(join(dir, 'ours.txt'), 'ours\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'ours')
    const ours = run('rev-parse', 'HEAD')
    // 对侧:从基底分叉,把「两侧各有真内容」的冲突区写进活文档
    run('checkout', '-q', 'HEAD~1')
    writeFileSync(join(dir, 'AGENTS.md'), `# 标题\na\n${CONTENT_LOSS}\n`, 'utf8')
    writeFileSync(join(dir, 'theirs.txt'), 'theirs\n', 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'theirs')
    const theirs = run('rev-parse', 'HEAD')
    run('update-ref', 'refs/heads/main', ours)
    run('checkout', '-q', 'main')

    const p = U.plan(ours, theirs, dir)
    // 产物面必须**真**带着那对标记(证明红不是从别处飘来的):先自证夹具到位
    const merged = run('show', `${p.tree}:AGENTS.md`)
    assert.match(merged, /^<<<<<<< HEAD$/m, '夹具未生效:产物面里没有冲突标记区,下面那条断言测不到东西')
    const hit = p.bad.find((b) => String(b).includes('AGENTS.md') && String(b).includes('拒绝落地'))
    assert.ok(hit, `带正文的冲突区必须判红并进 bad;实际 bad=${JSON.stringify(p.bad.slice(0, 4))}`)
    assert.match(hit, /AGENTS\.md:\d+–\d+/)
    assert.ok(
      p.bad.length > 0,
      'bad 非空 ⇒ main 的 `if (p.bad.length)` 分支退出 1,轮不到 commit-tree(该器既有判红档)',
    )
  } finally {
    rmScratch(dir)
  }
})

test('⑤b 装车锁:判据必须真被 buildUnion 调用,且判红只走既有 bad → exit 1', () => {
  const src = readFileSync(join(import.meta.dirname, '..', 'union-converge.mjs'), 'utf8')
  assert.match(src, /gateLandingMarkers\(liveDocMarkerEntries/, '源头判据必须真接在产物面那一步(否则只是没装车的备件)')
  assert.match(src, /^\s+for \(const v of markerGate\.violations\) violations\.push\(v\)$/m, '判红必须折进 violations(且不得被注释掉)')
  assert.match(src, /if \(p\.bad\.length\) \{[\s\S]{0,4000}?process\.exit\(1\)/, '判红档必须沿用该器既有的 bad → exit 1')
  const iTree = src.indexOf("const tree = run(['write-tree'])")
  const iGate = src.indexOf('gateLandingMarkers(liveDocMarkerEntries')
  const iCommit = src.indexOf("git(['commit-tree'")
  assert.ok(iTree > 0 && iGate > iTree, 'must 在 write-tree 之后判(产物面已成树,内容已定)')
  assert.ok(iCommit === -1 || iGate < iCommit, 'must 在 commit-tree 落地之前判')
})

test('逃生口:IHUI_LAND_SKIP_CONFLICT_MARKER_GATE=1 ⇒ 整档跳过并**出声**(该期间本判据失效)', () => {
  const logs = []
  const g = gateLandingMarkers([{ path: 'AGENTS.md', text: CONTENT_LOSS }], {
    env: { [LANDING_MARKER_SKIP_ENV]: '1' },
    log: (s) => logs.push(s),
  })
  assert.equal(g.skipped, true)
  assert.equal(g.verdict, 0, '逃生口生效期间判据失效 —— 这一事实必须写在 seat 与留痕行里')
  assert.equal(logs.length, 1)
  assert.match(logs[0], /跳过.*冲突标记自检/)
  assert.match(logs[0], /失效/)
  // 默认不设 env ⇒ 不跳过(默认开启)
  assert.equal(gateLandingMarkers([{ path: 'AGENTS.md', text: CONTENT_LOSS }]).verdict, 1)
})

test('取不到输入 ⇒ 未判定(verdict 2),绝不冒充干净', () => {
  const g = gateLandingMarkers([{ path: 'AGENTS.md', text: null }])
  assert.equal(g.verdict, 2)
  assert.equal(g.undetermined.length, 1)
  assert.match(g.undetermined[0], /未判定/)
  assert.equal(g.judged, 0)
})

// @ihui-seat S-BYPASS2 2026-11-01
// 两份同文档混档:空区(建议摘除)与有正文区(判红)同处一份内容时,**两档不得合并** ——
// 判红照判红,但"建议摘除"那条也一个字都不许被吞(吞掉它,空区就永远没有摘除提示,
// 回潮到本票立项现场:空区只能等人工偶然发现)。这条同时钉住 `judgeLandingText` 的
// 优先级口径(must-block 覆盖 strippable)不外溢成"advices 清零"。
test('⑥ 同一份内容里空区与有正文区并存 ⇒ 判红一档 + 建议一档都如实出(不许合档/不许吞建议)', () => {
  const mixed = [
    '# 标题',
    '<<<<<<< HEAD',
    '=======',
    '>>>>>>> a', // 空冲突区 ⇒ strippable
    '<<<<<<< HEAD',
    '本侧正文',
    '=======',
    '对侧正文',
    '>>>>>>> b', // 有正文 ⇒ must-block
  ].join('\n')
  const j = judgeLandingText('AGENTS.md', mixed)
  assert.equal(j.verdict, 'must-block', '有正文那一区在场 ⇒ 文件级结论必须是 must-block')
  assert.deepEqual(
    j.regions.map((r) => r.verdict),
    ['strippable', 'must-block'],
    '两区必须各自分型,不得按文件级结论一律染成同一档',
  )
  const g = gateLandingMarkers([{ path: 'AGENTS.md', text: mixed }])
  assert.equal(g.verdict, 1, '有 must-block ⇒ 判红档')
  assert.equal(g.violations.length, 1)
  assert.match(g.violations[0], /AGENTS\.md:5–9\(分隔行 7\)/)
  assert.equal(g.advices.length, 1, '判红不得顺手吞掉另一区的"建议摘除"(吞了空区就永远没有摘除提示)')
  assert.match(g.advices[0], /AGENTS\.md:2–4/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
