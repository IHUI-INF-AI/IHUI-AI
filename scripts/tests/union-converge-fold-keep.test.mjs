// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 G-310 同族镜像测试:活文档折叠层的「声明式 keeper」出口(`--fold-keep`)。
 *
 * 判据一律 import 源模块(§22c),本文件不复制任何"什么算同题组"的实现。
 * 钉四件事:
 *   A. 判据有牙 —— 两侧各改写一版而无人声明时,折叠层**拒绝裁定**并把该组以「未判定」送进落地闸
 *      (静默不折 = 把裁定权留给不在场的人,§0.10 的反方向);
 *   B. 出口真能收 —— 人声明 keeper 后,产物面只留那一版,且**被折那版的独有注记必须被并入**
 *      (放行不等于丢信息;这一维由折叠自己的注记守恒守着,测试只验结果);
 *   C. 出口不是免死金牌 —— 指纹本轮无组 / 声明行不在组里 ⇒ 「声明未命中」判红,不记通过;
 *   D. 锁"旗 ↔ 出路" —— CLI 四个入口校验(读不到档 / 空理由 / fp 与 keep 现算不一致 /
 *      同指纹两个 keeper)全部 exit 2 点名,绝不静默当成"没有声明"。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { __test__ as U } from '../union-converge.mjs'
import { extractTaskFingerprint } from '../check-plan-task-duplicates.mjs'

const GIT = resolveGitBin() || 'git'
const DOC = 'PROJECT_PLAN.md'
const T = 'G-700 断线窗口待决审批的重放承取证标题需要够长'
const L0 = `- [ ] **${T}** —— 同一句正文 〔注A〕`
const L1 = `- [ ] **${T}** —— 同一句正文 〔注B〕`
const L2 = `- [ ] **${T}** —— 同一句正文 〔注C〕`

/** base 有原文,本侧与对侧**各改写一遍**(两版都 ≠ base 且彼此不同)⇒ 折叠层无从裁定。 */
function fixtureTwoRewrites() {
  const dir = mkScratch('union-fk-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.autocrlf=false', ...a], {
      // §12g:派生 git 必须显式给 stdio(不给在本机稳定 EBUSY)
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
    }).trim()
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  const put = (text) => {
    writeFileSync(join(dir, DOC), text, 'utf8')
    run('add', '-A')
    run('commit', '-qm', 'c')
  }
  put(`# 台账\n\n${L0}\n`)
  const base = run('rev-parse', 'HEAD')
  put(`# 台账\n\n${L1}\n`)
  const ours = run('rev-parse', 'HEAD')
  run('checkout', '-q', base)
  put(`# 台账\n\n${L2}\n`)
  const theirs = run('rev-parse', 'HEAD')
  run('update-ref', 'refs/heads/main', ours)
  run('checkout', '-q', 'main')
  // foldKeep 的形状是 Map<文档路径, Map<指纹, keeper 行逐字>>。
  // 直接把内层当外层传 ⇒ get(路径) 落空 ⇒ 声明"看起来配了其实一条没吃",本文件的夹具就踩过这一脚。
  const picksFor = (keep) => new Map([[DOC, new Map([[extractTaskFingerprint(keep), keep]])]])
  return { dir, run, base, ours, theirs, picksFor }
}

const call = (f, picks) => U.buildUnion(f.base, f.ours, f.theirs, f.dir, new Set(), new Map(), null, new Set(), null, picks)

test('A 阳性对照:两侧各改写一版且无人声明 ⇒ 折叠拒绝裁定,并以「未判定」进落地闸', () => {
  const f = fixtureTwoRewrites()
  try {
    const b = call(f, null)
    const amb = b.foldAmbiguous?.get?.(DOC) || []
    assert.equal(amb.length, 1, `该组必须被点名,实得 ${JSON.stringify(amb)}`)
    assert.equal(amb[0].lines.length, 2, '两版并存 = 一条都没折')
    assert.ok(b.tree, '树仍要产出(只判不修不给出路)')
    const doc = U.show(b.tree, DOC, f.dir)
    assert.ok(doc.includes(L1) && doc.includes(L2), '未裁定时两版都留在产物面,不静默挑一版')
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('A2 该族必须挡住落地 —— 不是"报个数就过"', () => {
  const f = fixtureTwoRewrites()
  try {
    const p = U.plan(f.ours, f.theirs, f.dir)
    assert.ok(
      p.bad.some((b) => String(b).includes('同题两版并存') && String(b).includes('拒绝裁定')),
      `落地闸必须拦,实得:${p.bad.map((b) => String(b).slice(0, 60)).join(' / ') || '(空)'}`,
    )
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('B 人声明 keeper ⇒ 只留声明那一版,且被折那版的独有注记并入(放行不丢信息)', () => {
  const f = fixtureTwoRewrites()
  try {
    const b = call(f, f.picksFor(L1))
    assert.equal((b.foldAmbiguous?.get?.(DOC) || []).length, 0, '声明已裁定 ⇒ 不该再有点名')
    assert.equal((b.foldStalePicks?.get?.(DOC) || []).length, 0, '本轮真命中的声明不该记陈旧')
    const doc = U.show(b.tree, DOC, f.dir)
    assert.ok(doc.includes(L1), 'keeper 行必须在产物面')
    assert.ok(!doc.includes(L2), '另一版必须被折掉')
    assert.ok(doc.includes('〔注C〕'), `被折行的独有注记必须并入 keeper 行,实得:${JSON.stringify(doc)}`)
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('C1 声明的指纹本轮没有分组 ⇒ 记陈旧、不记通过', () => {
  const f = fixtureTwoRewrites()
  try {
    const keep = '- [ ] **本轮根本不存在的一组同题行标题需要够长** —— x 〔注Z〕'
    const b = call(f, f.picksFor(keep))
    const stale = b.foldStalePicks?.get?.(DOC) || []
    assert.ok(stale.length >= 1, `陈旧声明必须喊出来,实得 ${JSON.stringify(stale)}`)
    const p = U.plan(f.ours, f.theirs, f.dir, new Set(), new Map(), new Set(), null, null, null, f.picksFor(keep))
    assert.ok(
      p.bad.some((x) => String(x).includes('fold-keep 声明未命中')),
      `未命中的声明必须进落地闸,实得:${p.bad.map((x) => String(x).slice(0, 60)).join(' / ')}`,
    )
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('C2 指纹对得上但那一行不在本组(已漂开)⇒ 整组不折并点名', () => {
  const f = fixtureTwoRewrites()
  try {
    const fp = extractTaskFingerprint(L1)
    const drift = `- [ ] **${T}** —— 同一句正文 〔注Z〕`
    const b = call(f, new Map([[DOC, new Map([[fp, drift]])]]))
    const stale = b.foldStalePicks?.get?.(DOC) || []
    assert.ok(stale.some((s) => String(s.reason).includes('不在本组')), `实得 ${JSON.stringify(stale)}`)
    const doc = U.show(b.tree, DOC, f.dir)
    assert.ok(doc.includes(L1) && doc.includes(L2), '串档声明不许把整组折掉(折半即有损)')
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('D 旗 ↔ 出路:CLI 四个入口校验全部 exit 2 点名,绝不静默当成"没有声明"', () => {
  const root = join(import.meta.dirname, '..', '..')
  const runWith = (decl) => {
    const file = join(root, '.ihui-agent', 'tmp', `fk-cli-${Math.random().toString(36).slice(2)}.json`)
    writeFileSync(file, JSON.stringify(decl), 'utf8')
    const r = spawnSync(
      process.execPath,
      ['scripts/union-converge.mjs', '--fold-keep', `${DOC}=${file}`],
      { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 },
    )
    return { ...r, file }
  }
  const cases = [
    ['空理由', [{ keep: L1, why: '   ' }], /都不得为空|没有 why|理由/],
    ['声明行算不出指纹', [{ keep: '- [ ] 短', why: '理由' }], /算不出标题指纹/],
    ['fp 与 keep 现算不一致(串档)', [{ keep: L1, why: '理由', fp: '故意写错的指纹' }], /不一致/],
    ['同指纹给两个 keeper(歧义)', [{ keep: L1, why: '理由' }, { keep: L1, why: '另一条' }], /两个 keeper/],
  ]
  for (const [name, decl, re] of cases) {
    const r = runWith(decl)
    const text = `${r.stdout || ''}${r.stderr || ''}`
    assert.equal(r.status, 2, `${name}:必须 exit 2(取不到/不成立就不判),实得 status=${r.status}\n${text.slice(0, 300)}`)
    assert.match(text, re, `${name}:要点名原因,实得:${text.slice(0, 300)}`)
  }
  // 读不到声明档那一臂单独跑(它给的是一个不存在的文件名)
  const missing = spawnSync(process.execPath, ['scripts/union-converge.mjs', '--fold-keep', `${DOC}=./不存在-的-档.json`], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 300000,
  })
  assert.equal(missing.status, 2, `读不到声明档必须 exit 2,实得 ${missing.status}`)
  assert.match(`${missing.stdout}${missing.stderr}`, /读不到声明档/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
