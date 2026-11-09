// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `heal-worktree-tracked.mjs` 运行档判定的镜像锁(§22c:判据 import 源脚本,本文件零复制)。
 *
 * 钉的是这台机上共享工作树的一条高危入口:旧写法 `dryRun = includes('--dry-run') || includes('--check')`
 * ⇒ **裸跑与敲错旗标都按"真恢复"执行**,会把他人有意留下的未暂存删除 `git restore` 复活
 * (2026-09-24 实测差点咬掉并发会话正在收口的 4 个分类栏文件)。
 * 修法不是拒绝退出(守护按 stdout 最后一行 JSON 判账,"拒"会被读成自愈失败),
 * 而是**降到只读档并点名**。
 *
 * 成对要求:合法调用方(`--align-drift --json`,union-converge / plan-union-merge 真传的形态)
 * 必须**仍然**是写盘档 —— 这一条要是红了,就是我把自愈腿冻住了。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { healRunMode } from '../heal-worktree-tracked.mjs'

test('运行档:只读降级只发生在"不认识旗标"上,合法档一律不变', () => {
  const bare = healRunMode([])
  assert.equal(bare.dryRun, false, '裸跑仍是真恢复(守护靠它干活,本枚不动默认)')
  assert.equal(bare.degradedToReadOnly, false)

  const check = healRunMode(['--check'])
  assert.equal(check.dryRun, true, '--check 必须是只读(§5b 承诺零副作用)')
  assert.equal(check.degradedToReadOnly, false, '已经是只读,不该再喊一次降级')

  const typo = healRunMode(['--hlep'])
  assert.equal(typo.dryRun, true, '手滑一枚 ⇒ 必须降到只读,绝不能按真恢复执行')
  assert.equal(typo.degradedToReadOnly, true, '降级要可被点名(不是静默少做)')
  assert.deepEqual(typo.unknown, ['--hlep'])

  const eq = healRunMode(['--check=1'])
  assert.equal(eq.degradedToReadOnly, true, '带值的近似写法同样算不认识 ⇒ 同样只读')

  // 合法发射侧(现读 union-converge.mjs:4759 与 plan-union-merge.mjs:364 真传的 argv)
  const legal = healRunMode(['--align-drift', '--json'])
  assert.equal(legal.dryRun, false, '合法档不许被降级 ⇒ 否则本枚就是把自愈腿冻住的那一刀')
  assert.deepEqual(legal.unknown, [])
  assert.equal(legal.help, false)

  const help = healRunMode(['--help'])
  assert.equal(help.help, true, '--help 只打用法,不进任何写盘分支')
  assert.equal(healRunMode(['-h']).help, true)
  assert.equal(healRunMode(['--self-test']).selfTest, true)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
