// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试 —— 直接 import 源脚本的 `__test__`,不复制判据(两份真相必然漂移)。
// 三条"只有源码级锁能防"的东西:
//   ① 本门编号在 runner 里必须恰好出现一次,且全 runner 无重复号(撞号会串 skipEnv 与失败归属);
//   ② 台账必须真在被审面上才算存在 —— 只躺工作树的台账等于没有台账(G-183 同型);
//   ③ 判据不得退回按磁盘读(工作树档被拒),且文档必须点名(守门 89 R4 同一条要求)。
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { __test__ as src } from '../check-cross-end-ui-parity.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const RUNNER = resolve(ROOT, 'scripts/guardian-runner.mjs')
const SELF = resolve(ROOT, 'scripts/check-cross-end-ui-parity.mjs')
const LEDGER_REL = 'scripts/cross-end-ui-parity-baseline.json'
const LEDGER = resolve(ROOT, LEDGER_REL)

const git = (args) => spawnSync('git', ['-c', 'safe.directory=*', ...args], { cwd: ROOT, encoding: 'utf8' })
const headHasLedger = () => git(['cat-file', '-e', `HEAD:${LEDGER_REL}`]).status === 0

/** runner 里定位本门注册块:label 与 script 之间会被 prettier 折行,所以不吃换行。 */
function runnerBlock() {
  const txt = readFileSync(RUNNER, 'utf8')
  const m = txt.match(/id: '(\d+)',[\s\S]{0,400}?script: 'check-cross-end-ui-parity\.mjs',/)
  assert.ok(m, 'guardian-runner 里没有本门(造好没装车)')
  const start = txt.indexOf(m[0])
  return { id: m[1], block: txt.slice(start, start + 1600) }
}

const finding = (name, miniapp = [], rn = []) => ({
  name,
  named: [],
  geometry: { onlyMiniapp: miniapp, onlyRn: rn },
  waived: false,
})

test('T1 装车证明:runner 里必须有本门,且 blocking + skipEnv + stagedTriggers 齐备', () => {
  const { block } = runnerBlock()
  assert.match(block, /mode:\s*'blocking'/, '本门必须是 blocking')
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_CROSS_END_UI_PARITY'/, '无应急出口的 blocking 门只会逼人 --no-verify')
  assert.match(block, /stagedTriggers:/, '必须只在触及两端组件面时问责,否则与改动无关的提交也被钉红')
  assert.match(block, /apps\/miniapp-taro\/src\/components\//, '触发面必须含小程序组件面')
  assert.match(block, /packages\/app\/src\/components\//, '触发面必须含 RN 组件面')
})

test('T2 编号成套:本门在 runner 恰好一次,且全 runner 任何编号不得出现两次', () => {
  const { id } = runnerBlock()
  const txt = readFileSync(RUNNER, 'utf8')
  const all = [...txt.matchAll(/^\s*id: '([^']+)',$/gm)].map((x) => x[1])
  assert.equal(all.filter((x) => x === id).length, 1, `本门编号 ${id} 出现不止一次`)
  const dupes = [...new Set(all.filter((x, i) => all.indexOf(x) !== i))]
  assert.equal(dupes.length, 0, `runner 存在重复编号:${dupes.join(',')} —— 会串 skipEnv 与失败归属`)
})

test('T3 AGENTS.md 与 README.md 必须点名本门(守门 89 R4 的同一条要求)', () => {
  for (const f of ['AGENTS.md', 'README.md'])
    assert.match(readFileSync(resolve(ROOT, f), 'utf8'), /check-cross-end-ui-parity/, `${f} 未点名本门`)
})

test('T4 棘轮两侧都有牙:超锚点红 / 等锚点绿 / 无台账则锚点为 0 / 变好只提示', () => {
  const f = [finding('X', [8, 9])] // diffCount = 2
  assert.equal(src.verdictOf(f, { counts: { X: 2 } }).red.length, 0, '等于锚点不算回潮')
  assert.equal(src.verdictOf(f, { counts: { X: 1 } }).red.length, 1, '超过锚点必须红')
  assert.equal(src.verdictOf(f, {}).red.length, 1, '台账缺该组件 ⇒ 锚点 0 ⇒ 新差异直接红')
  assert.equal(src.verdictOf([finding('Y', [8])], { counts: { Y: 5 } }).shrunk.length, 1, '变好只提示下调,不自动改账')
  assert.equal(src.verdictOf([finding('Z', [8])], { waivers: { Z: { reason: '平台 chrome 负责顶距' } } }).red.length, 0)
})

test('T5 台账必须在索引里且非空(不在被审面上 = 判据退化成全红)', () => {
  assert.ok(existsSync(LEDGER), '台账文件必须在仓内')
  assert.ok(git(['ls-files', '--', LEDGER_REL]).stdout.trim().length > 0, '台账未进索引 ⇒ 它不构成被审面的一部分')
  const led = JSON.parse(readFileSync(LEDGER, 'utf8'))
  assert.ok(Object.keys(led.counts).length > 0, '台账不得为空表(空表 = 把全部存量判红)')
  assert.deepEqual(led.waivers, {}, '本票不预先豁免任何组件;要豁免必须逐条写 reason')
})

test('T5b 台账一旦进 HEAD,全量面必须认它(存量锚点永不生效 = 台账白装)', () => {
  if (!headHasLedger()) return // 首次装车那一枚提交尚未落地,由 T8 在 --staged 面证明
  /**
   * "同一枚提交里既收紧判据、又按新口径重锚台账"是本仓的正当形态(与本门 `--staged` 索引优先、
   * 守门 89 的文档面 HEAD∪索引例外同一条理由)。此刻索引里的台账**比 HEAD 新**,
   * 拿旧台账去判新判据必然红 —— 那一红不是在说"锚点没被读到",而是在说"这枚提交还没落地"。
   * 判据失效的表现必须是红,不是"逼人绕钩子",所以这里按面分流:索引与 HEAD 的台账不一致 ⇒ 走 `--staged`
   * (审的就是这枚待落地的状态);两面一致 ⇒ 照旧要求全量面绿。
   */
  const ledgerDirty = git(['diff', '--cached', '--name-only', '--', LEDGER_REL]).stdout.trim().length > 0
  const args = ledgerDirty ? [SELF, '--staged'] : [SELF]
  const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 180000 })
  assert.equal(
    r.status,
    0,
    `台账已在 HEAD 而${ledgerDirty ? '索引' : '全量'}面仍判红 ⇒ 存量锚点没被读到:\n${r.stdout.slice(-500)}`,
  )
})

test('T6 判据有牙:同一份差异在 .jsx 与 .tsx 上必须同判', () => {
  assert.equal(src.scan(['a/NavBar.tsx'], ['b/NavBar.tsx']).pairs.length, 1)
  assert.equal(src.scan(['a/NavBar.jsx'], ['b/NavBar.tsx']).pairs.length, 1, '换成 .jsx 就看不见 = 该形态零判据')
})

test('T6b 空扫不得记通过(判据失明必须与"没有差异"可分)', () => {
  assert.equal(src.scan([], []).undetermined, true)
  assert.equal(src.scan(['a/X.tsx'], []).undetermined, true, '一端为空同样是失明')
})

test('T7 工作树档必须被拒(按磁盘判会把错数写回棘轮台账)', () => {
  assert.throws(() => src.faceFromArgv(['--worktree']), /工作树/)
  assert.throws(() => src.faceFromArgv(['--staged', '--worktree']), /不得同用|互斥/)
})

test('T8 真仓跑通:索引面 exit 0,且逐组件实测数与台账锚点逐条相等', () => {
  const r = spawnSync(process.execPath, [SELF, '--staged', '--json'], { cwd: ROOT, encoding: 'utf8', timeout: 180000 })
  assert.equal(r.status, 0, `索引面判红:\n${r.stdout.slice(-600)}`)
  const j = JSON.parse(r.stdout)
  assert.ok(j.pairCount > 0, '配对数 0 = 判据失明')
  const led = JSON.parse(readFileSync(LEDGER, 'utf8'))
  for (const f of j.findings) assert.equal(f.diffCount, led.counts[f.name], `${f.name} 实测与台账不符`)
  for (const k of Object.keys(led.counts))
    assert.ok(j.findings.some((f) => f.name === k), `台账挂着一条已不存在的账:${k}(清单腐烂)`)
})

test('T9 主判定不得被摘线(函数在但没人调 = 提交链上一路绿灯)', () => {
  const txt = readFileSync(SELF, 'utf8')
  assert.ok(/export function collect\(/.test(txt), 'collect 被摘线')
  assert.ok(/audit\(collected\.pairs/.test(txt), 'main 不再调用主判定 ⇒ 门形同虚设')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
