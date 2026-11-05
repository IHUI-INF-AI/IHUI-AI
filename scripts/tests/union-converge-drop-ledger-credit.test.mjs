// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「摘除台账已声明正当删除」接进 union 零损失闸的镜像测试(2026-11-01)。
 *
 * 立因(现读事故,不是推测):两条正牌收敛出口同时拒推进 —— sync-converge 判「PROJECT_PLAN.md 旧行被
 * 复活(本侧已改写/删除):重数 1 > 期望 0」并拒绝推进 HEAD,而那 13 行在 `.ihui-agent/state/plan-row-drop.jsonl`
 * 里**逐字有留痕**(kind=closed-row-reclose-open-form)。台账本来就是"这条删除的既成留痕",判据却不看它
 * ⇒ 闸只挡住了正牌通道(普通 `git merge` 结构上不走这里,06:33 那枚 8c9d77f9ef 正是"普通 merge 带回旧行
 * → head-recall 兜底轮再摘掉"的产物),每次撞上都要各席手工绕一次 —— §12f:只判不修逼人绕过。
 *
 * 因此这三例的分工:
 *  D1 正控:台账逐字在册 ∧ 本侧 0 份 ∧ 是登记行 ⇒ 不再硬拒,且**逐条报名**(带份数与去向说明);
 *  D2 反控:同样现场而台账没这条 ⇒ 「旧行被复活」照旧判红(出口没把判据变成摆设);
 *  D3 反控:台账在册但那一行**不是登记行形** ⇒ 三条条件缺一不成集,照旧判红(放行不扩面)。
 * §22c:判据一律 import 生产实现,本文件不复制一条正则。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { __test__ as U } from '../union-converge.mjs'

const GIT = resolveGitBin() || 'git'
const DROP_REL = '.ihui-agent/state/plan-row-drop.jsonl'

const OLD = '- [ ] **G-100 甲任务标题需要够长才不被判退化** —— 初版现状:等环境条件'
const KEEP = '- [ ] **G-200 乙任务标题同样需要够长** —— 本侧一直在册的一行'
const PLAIN = '这一行不是登记行形,台账里也不该由它触发放行,长度足够避开短行过滤'

/**
 * 造"本侧已删掉 OLD,而合并产物把 OLD 带回"的三面现场。
 * `withLedger` 决定夹具根下那份摘除台账怎么写(判据从**判定面同一个根**取台账,
 * 生产面 cwd 就是仓根 ⇒ 与改前逐字同形;夹具面才可测)。
 */
function fixture({ withLedger = true, ledgerRow = OLD } = {}) {
  const dir = mkScratch('union-dropcap-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.autocrlf=false', ...a], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
    }).trim()
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  // base:OLD + KEEP 都在册
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# 台账\n\n${OLD}\n${KEEP}\n`, 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'base')
  const base = run('rev-parse', 'HEAD')
  // ours(本侧):按 §1「完成即删」把 OLD 整行删净,并留下一枚非登记行的普通正文变化
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# 台账\n\n${KEEP}\n${PLAIN}\n`, 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'ours-drop-the-row')
  const ours = run('rev-parse', 'HEAD')
  // 归并产物面:普通 merge 把 OLD 带了回来(这正是本闸要判的形状)
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# 台账\n\n${KEEP}\n${OLD}\n${PLAIN}\n`, 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'merged-shape')
  const tree = run('rev-parse', 'HEAD^{tree}')
  run('update-ref', 'refs/heads/main', ours)
  if (withLedger) {
    const abs = join(dir, DROP_REL)
    mkdirSync(join(dir, '.ihui-agent', 'state'), { recursive: true })
    writeFileSync(
      abs,
      JSON.stringify({
        at: '2026-11-01T00:00:00.000Z',
        kind: 'closed-row-reclose-open-form',
        rowBefore: ledgerRow,
      }) + '\n',
      'utf8',
    )
  }
  return { dir, base, ours, tree }
}

const reviveReds = (bad) => bad.map(String).filter((b) => b.includes('旧行被复活'))

test('D1 正控:台账逐字在册 ∧ 本侧 0 份 ∧ 登记行 ⇒ 不硬拒,且逐条报名带份数', () => {
  const f = fixture()
  try {
    const bad = U.verifyUnion(f.ours, f.ours, f.tree, f.dir, f.base, null, null, null)
    assert.deepEqual(reviveReds(bad), [], `在册的正当摘除仍被硬拒 ⇒ 死锁没解开:${bad.join(' / ')}`)
    assert.equal((bad.dropLedgerCredited || []).length, 1, '放行必须逐条报名,不得静默')
    const c = bad.dropLedgerCredited[0]
    assert.equal(c.doc, 'PROJECT_PLAN.md')
    assert.equal(c.line, OLD)
    assert.equal(c.copies, 1, '复活的份数要如实带出')
    // 其余各格一处不松:本侧独有的普通正文行仍必须在产物面保住
    assert.ok(bad.superseded === undefined || Array.isArray(bad.superseded))
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('D2 反控:同样的现场而台账没这条 ⇒ 「旧行被复活」照旧判红(出口不是免检)', () => {
  const f = fixture({ withLedger: false })
  try {
    const bad = U.verifyUnion(f.ours, f.ours, f.tree, f.dir, f.base, null, null, null)
    assert.ok(reviveReds(bad).length >= 1, `判据被出口废掉了:${bad.join(' / ') || '(空)'}`)
    assert.equal((bad.dropLedgerCredited || []).length, 0, '没在册却记了销账 = 无凭据放行')
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('D3 反控:在册但不是登记行形 ⇒ 三条条件缺一不成集,照旧判红(放行不扩面)', () => {
  const f = fixture({ ledgerRow: PLAIN })
  try {
    const bad = U.verifyUnion(f.ours, f.ours, f.tree, f.dir, f.base, null, null, null)
    assert.ok(
      reviveReds(bad).length >= 1,
      `普通正文行也吃放行 ⇒ 出口被扩到登记行以外:${bad.join(' / ')}`,
    )
    assert.equal((bad.dropLedgerCredited || []).length, 0)
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('D4 形状锁:判据必须同源 declaredDropCaps,且台账与判定面同根(§0.6/§0.4)', () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'union-converge.mjs'),
    'utf8',
  )
  assert.match(src, /declaredDropCaps\(a, declaredRows\(cwd\)\.set\)/)
  const verifyFace = src.slice(src.indexOf('export function verifyUnion'))
  assert.doesNotMatch(
    verifyFace,
    /declaredDropCaps\(a\)/,
    '又回到"读死 ROOT" ⇒ 夹具面测不到这条放行,生产面也少一层"清单与内容同面同轮"的纪律',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
