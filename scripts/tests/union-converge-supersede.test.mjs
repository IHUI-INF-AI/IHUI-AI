// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 G-310 镜像测试:活文档落地闸的「声明式取代」出口(`--supersede`)。
 *
 * 判据一律 import 源模块(§22c:在测试里再抄一份"什么算同一件事",两边必漂移)。
 * 本文件钉四件事,少一件都等于没修:
 *   A. 判据仍有牙 —— 不声明时"本侧已改写却被取回"的旧行照旧判红(阳性对照);
 *   B. 出口真能收 —— 声明过了 `supersedeProof`(= 折叠四问)才销账,且报名并计入 `superseded`;
 *   C. 出口不是免死金牌 —— 假去向行 / 自取代 / 无原因 / 异主键 / 清单陈旧 全部照旧红;
 *   D. 锁"旗 ↔ 出路":CLI 认这面旗,声明档读不到 ⇒ exit 2 点名,绝不当成"没有声明"。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { __test__ as U } from '../union-converge.mjs'

const GIT = resolveGitBin() || 'git'

const OLD = '- [ ] **G-100 甲任务标题需要够长才不被判退化** —— 初版现状:等环境条件'
const NEW =
  '- [ ] **G-100 甲任务标题需要够长才不被判退化** —— 初版现状:等环境条件 〔进展@2026-10-20/主会话:已量到出口形状〕'
const OTHER = '- [ ] **G-200 乙任务标题同样需要够长** —— 对侧自己新写的一行'

/**
 * 造一枚"归并产物树":旧行连同改写行一起在场(真仓那 9 行就是这个形状 —— 归档反查那支
 * 按"失效方向只能多带一行"把它取回的)。`theirs` 取本侧同一枚,使期望表落到 0,
 * 判据于是只看产物面,不受夹具里其他分支干扰。
 */
function fixtureMergedTree() {
  const dir = mkScratch('union-sup-')
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
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# 台账\n\n${OLD}\n`, 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'base')
  const base = run('rev-parse', 'HEAD')
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# 台账\n\n${NEW}\n`, 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'ours-rewrite')
  const ours = run('rev-parse', 'HEAD')
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# 台账\n\n${NEW}\n${OLD}\n${OTHER}\n`, 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'merged-shape')
  const tree = run('rev-parse', 'HEAD^{tree}')
  run('checkout', '-q', ours)
  run('update-ref', 'refs/heads/main', ours)
  return { dir, run, base, ours, tree }
}

const supMap = (declared) => new Map([['PROJECT_PLAN.md', new Map([declared])]])

test('A 阳性对照:不声明 ⇒ "旧行被复活"照旧判红(出口没把判据变成摆设)', () => {
  const f = fixtureMergedTree()
  try {
    const bad = U.verifyUnion(f.ours, f.ours, f.tree, f.dir, f.base, null, null, null)
    assert.ok(
      bad.some((b) => String(b).includes('旧行被复活')),
      `判据必须有牙,实得:${bad.map(String).join(' / ') || '(空)'}`,
    )
    assert.equal((bad.superseded || []).length, 0, '没声明就不许有销账记录')
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('B 声明通过 ⇒ 复活销账、superseded 报名带份数,且判据其余各格一处不松', () => {
  const f = fixtureMergedTree()
  try {
    const bad = U.verifyUnion(
      f.ours,
      f.ours,
      f.tree,
      f.dir,
      f.base,
      null,
      null,
      supMap([OLD, { kept: NEW, why: '本侧已就地改写,语义在改写行' }]),
    )
    assert.deepEqual(bad.map(String).filter((b) => b.includes('PROJECT_PLAN')), [], `应清零,实得:${bad.join(' / ')}`)
    assert.equal(bad.superseded.length, 1, '必须逐条报名')
    const s = bad.superseded[0]
    assert.equal(s.kind, '旧行被复活')
    assert.equal(s.copies, 1, '少带/复活的份数必须如实带出')
    assert.equal(s.kept, NEW)
    assert.equal(s.doc, 'PROJECT_PLAN.md')
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('C1 去向行不在产物面 ⇒ 照旧判红并带原因(声明不是选边的别名)', () => {
  const f = fixtureMergedTree()
  try {
    const bad = U.verifyUnion(
      f.ours,
      f.ours,
      f.tree,
      f.dir,
      f.base,
      null,
      null,
      supMap([OLD, { kept: '- [ ] **G-999 产物面没有这一行** —— z', why: '假声明' }]),
    )
    assert.ok(
      bad.some((b) => String(b).includes('已声明但举证不成立') && String(b).includes('产物面一份都没有')),
      `实得:${bad.join(' / ')}`,
    )
    assert.equal((bad.superseded || []).length, 0)
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('C2 自取代(去向行 = 被取代行)⇒ 判红,空调用不放行', () => {
  const f = fixtureMergedTree()
  try {
    const bad = U.verifyUnion(
      f.ours,
      f.ours,
      f.tree,
      f.dir,
      f.base,
      null,
      null,
      supMap([OLD, { kept: OLD, why: '自取代' }]),
    )
    assert.ok(bad.some((b) => String(b).includes('自取代')), `实得:${bad.join(' / ')}`)
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('C3 声明没写原因 ⇒ 判红(无原因的放行等于没有判据)', () => {
  const f = fixtureMergedTree()
  try {
    const bad = U.verifyUnion(
      f.ours,
      f.ours,
      f.tree,
      f.dir,
      f.base,
      null,
      null,
      supMap([OLD, { kept: NEW, why: '   ' }]),
    )
    assert.ok(bad.some((b) => String(b).includes('没写原因')), `实得:${bad.join(' / ')}`)
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('C4 去向行是另一件事(主键/指纹都不等)⇒ 判红,并直说这是真删除不是折叠', () => {
  const f = fixtureMergedTree()
  try {
    const bad = U.verifyUnion(
      f.ours,
      f.ours,
      f.tree,
      f.dir,
      f.base,
      null,
      null,
      supMap([OLD, { kept: OTHER, why: '并到乙任务' }]),
    )
    assert.ok(bad.some((b) => String(b).includes('不是同一件事')), `实得:${bad.join(' / ')}`)
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('C5 清单陈旧(本轮没命中这一行)⇒ 不记通过,原红也一处不松', () => {
  const f = fixtureMergedTree()
  try {
    const stray = '- [ ] **G-777 本轮根本不欠的行** —— y'
    const bad = U.verifyUnion(
      f.ours,
      f.ours,
      f.tree,
      f.dir,
      f.base,
      null,
      null,
      supMap([stray, { kept: NEW, why: '陈旧清单' }]),
    )
    assert.ok(bad.some((b) => String(b).includes('声明未命中')), `实得:${bad.join(' / ')}`)
    assert.ok(bad.some((b) => String(b).includes('旧行被复活')), '原判红必须仍在(放行了别的东西不替它销账)')
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('C6 supersedeProof 与 attestFoldPair 同源:同一组入参给出同一结论(§0.6 禁第二份判据)', () => {
  const m = new Map([[NEW, 1], [OLD, 1]])
  const viaProof = U.supersedeProof({ kept: NEW, why: '本侧已就地改写' }, OLD, m)
  const viaFold = U.attestFoldPair({ dropped: OLD, kept: NEW }, m)
  assert.equal(viaProof.status, viaFold.status)
  assert.equal(viaProof.kept, viaFold.kept)
  assert.equal(viaFold.status, 'attested', '正向对照:这组入参本该通过四问')
})

test('D 旗 ↔ 出路:CLI 认 --supersede,声明档读不到 ⇒ exit 2 点名,不回落成"没有声明"', () => {
  const out = spawnSync(
    process.execPath,
    ['scripts/union-converge.mjs', '--supersede', 'PROJECT_PLAN.md=./不存在-的-声明档.json'],
    {
      cwd: join(import.meta.dirname, '..', '..'),
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300000,
    },
  )
  const text = `${out.stdout || ''}${out.stderr || ''}`
  assert.equal(out.status, 2, `取不到输入必须 exit 2(§0.3),实得 status=${out.status}\n${text.slice(0, 400)}`)
  assert.match(text, /读不到声明档/, `要点名是哪个声明档:\n${text.slice(0, 400)}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
