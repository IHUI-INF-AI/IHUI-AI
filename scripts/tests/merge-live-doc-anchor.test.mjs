// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `merge-live-doc.mjs` 的 CLI 级装车证明(2026-09-25 立)
 *
 * 为什么这一份必须存在,而文件内 `--self-test` 的 13→16 例不够:
 * `merge-live-doc.mjs` 顶层就是 CLI 主流程、**没有 §22d 的 isDirectRun 守卫**(它的相似度
 * 工具因此早已被抽到 `lib/live-doc-similarity.mjs`),所以测试无法 `import` 它的判据函数。
 * 本测试改用**同形取证**:把脚本连同一个临时 git 仓摆好,直接 spawn 已装车的 CLI。
 *
 * 两臂都是必须的:
 *   A 就地改写(改的是行**中段**,旧行既不逐字存活、Jaccard 也低于阈值)⇒ 真丢失必须 = 0。
 *     立因:2026-09-25 我改守门 84 的登记行,工具判"真丢失"并要求 `--apply`,而照它做就是把
 *     新旧两行同时留下 —— 本仓已出现三次的重复登记行正是这么造出来的。
 *   B 整行删除 ⇒ 真丢失必须 = 1。锚点规则只能把"改写"从"丢失"里分出来,绝不能反过来
 *     替真删除洗地(那是比误报更坏的一侧)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 按 §22c:取真值源,不在测试里复制一份实现(相似度工具正是为此被抽成 lib 的)。
import { SIM_THRESHOLD, jaccard, tokenize } from '../lib/live-doc-similarity.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GIT = 'git'

// 两行刻意"中段全换":锚点 `- **闸门甲**(7)` 相同,正文几乎不重叠。
const OLD_LINE = '- **闸门甲**(7):旧口径把 merge 与 cherry-pick 一起整轮放行,取证 8 例'
const NEW_LINE =
  '- **闸门甲**(7):新口径只在 MERGE_HEAD 上跑三条件窄判据 ours==theirs ∧ index!=ours ∧ index∈历史祖先,取证扩到 12 例并补一把反向回归锁,真仓两条口径复测均 rc=0'

function seedRepo() {
  const dir = mkScratch('merge-live-doc-cli-')
  execFileSync(GIT, ['-c', 'safe.directory=*', 'init', '-q', '--initial-branch=main'], { cwd: dir })
  const g = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', ...a], { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 120000 })
  g('config', 'user.email', 't@t')
  g('config', 'user.name', 't')
  // 被测对象是**仓库里那份**脚本(不是复制品)—— 拷贝只为让它在新仓里可被 spawn。
  mkdirSync(join(dir, 'scripts', 'lib'), { recursive: true })
  copyFileSync(join(REPO, 'scripts/merge-live-doc.mjs'), join(dir, 'scripts/merge-live-doc.mjs'))
  copyFileSync(
    join(REPO, 'scripts/lib/live-doc-similarity.mjs'),
    join(dir, 'scripts/lib/live-doc-similarity.mjs'),
  )
  const doc = (body) => writeFileSync(join(dir, 'AGENTS.md'), body, 'utf8')
  doc(`# 头\n${OLD_LINE}\n- 无关行\n`)
  g('add', '-A')
  g('commit', '-qm', 'seed')
  const run = () => {
    try {
      return execFileSync(
        process.execPath,
        [join(dir, 'scripts/merge-live-doc.mjs'), '--file', 'AGENTS.md'],
        { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 120000 },
      )
    } catch (e) {
      // 判红时 CLI 以非零退出;报告正文仍要读出来算数
      return String(e.stdout || '')
    }
  }
  const counts = (out) => ({
    lost: Number(/真丢失\(需插回\)= (\d+)/.exec(out)?.[1] ?? -1),
    superseded: Number(/被就地改写取代\(不插回\)= (\d+)/.exec(out)?.[1] ?? -1),
  })
  return { dir, doc, run, counts }
}

test('A 就地改写(锚点相同、正文全换)⇒ 真丢失=0,且不再要求 --apply', () => {
  const { dir, doc, run, counts } = seedRepo()
  try {
    doc(`# 头\n${NEW_LINE}\n- 无关行\n`)
    const out = run()
    const c = counts(out)
    assert.equal(c.lost, 0, `改写被判吃掉 ⇒ 会逼人 --apply 造出重复登记行。报告:\n${out}`)
    assert.equal(c.superseded, 1, '应恰有一行判"被就地改写取代"')
    assert.match(out, /可安全提交/, '结论行应转为可安全提交')
  } finally {
    rmScratch(dir)
  }
})

test('B 反向对照:整行删除 ⇒ 真丢失仍=1(锚点规则不得替真删除洗地)', () => {
  const { dir, doc, run, counts } = seedRepo()
  try {
    doc('# 头\n- 无关行\n') // 登记行被整个删掉,工作树没有同锚点行
    const c = counts(run())
    assert.equal(c.lost, 1, `真删除必须报丢失,实际 lost=${c.lost}(本测试是判据失效的哨兵)`)
    assert.equal(c.superseded, 0, '没有任何同锚点的新行,不该被判成改写')
  } finally {
    rmScratch(dir)
  }
})

test('C 对照组自证:两行确实"不像",否则 A 臂测的是别的东西', () => {
  // A 臂之所以能证明锚点规则在起作用,前提是这条改写**既不逐字存活、Jaccard 也低于阈值**;
  // 若哪天有人把夹具改成"很像"的两行,A 臂就退化成容器短路的测试了 —— 这一条就是防它退化。
  assert.ok(
    jaccard(tokenize(OLD_LINE), tokenize(NEW_LINE)) < SIM_THRESHOLD,
    '夹具失效:两行已足够相似,A 臂不再能证明锚点规则',
  )
  assert.ok(!NEW_LINE.includes(OLD_LINE), '夹具失效:旧行逐字存活 ⇒ A 臂走的是容器短路而非锚点')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
