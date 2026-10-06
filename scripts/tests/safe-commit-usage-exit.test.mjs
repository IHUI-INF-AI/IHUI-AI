// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 用法错必须读出非零退出码 —— 钉住 safe-commit 的「失败不伪装成成功」这一条。
//
// 成因(2026-10-06 台账 G-1058630 实测):`node scripts/safe-commit.mjs -m "…"` 漏掉 `-- <文件清单>`
// 时,stdout 末行明确写着 `❌ 必须提供至少一个文件路径`,而**进程退出码是 0**。后果不是难看而是
// 静默丢交付:后台任务通知回 `completed (exit code 0)`,调用方据此以为提交在跑,实际整轮文件留在
// 索引里没进库,直到 git log 迟迟不出现那枚提交才发现。同族账本仓记过多次(守门 70「不带该参数
// 永远 exit 0」、门 150 的恒绿断言、live-doc-edit 已把用法错定成 exit 2),所以这里按同一档定：
// 用法错 = 2、业务拒绝 = 1、已落地 = 0。
//
// 判据形态:四条**行为臂**(真派生 CLI 读退出码),不做字符窗口型形状锁 —— 形状锁会在别人把
// 同一条判据改成别的写法时漂成恒红,而退出码是调用方真正消费的那个量。
// 派生的安全性由臂 5 当场自证:用法错的分支排在「0. 环境检查 / 0.5 git 写锁」之前,
// 所以它结构上碰不到共享索引(safe-commit 正常流程第一步是 `git reset HEAD`,会清掉别人的暂存)。
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'safe-commit.mjs')
const REPO = join(HERE, '..', '..')
const LOCK = join(REPO, '.git', 'ihui-git-write.lock')
/** 问 git 要当刻 HEAD sha;问不到就明写"本臂结论无效",不得把工具失效伪装成仓库结论。 */
function gitHeadSha() {
  const r = spawnSync(GIT, ['-c', 'safe.directory=*', 'rev-parse', 'HEAD'], {
    cwd: REPO,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 15000,
  })
  assert.equal(
    r.status,
    0,
    '问不到 HEAD,本臂结论无效(git 不可用,不是仓库缺陷):' +
      String(r.stderr || (r.error && r.error.message)).slice(0, 160),
  )
  return r.stdout.trim()
}
// git 一律按解析出的绝对路径派生,不靠 PATH(§5b:服务账户与交互账户的 PATH/safe.directory 互不相通,
// 拿 PATH 命中当"能跑"会造出一台在故障现场报绿的尺子)。
const GIT = resolveGitBin()

/** 直接派生,不经 shell、不经管道 —— 管道尾的 $? 不是退出码。 */
function runCli(...argv) {
  const r = spawnSync(process.execPath, [SCRIPT, ...argv], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    cwd: REPO,
  })
  assert.ok(!r.error, `派生 safe-commit 失败(不是它的结论):${r.error && r.error.message}`)
  return r
}

const headBefore = gitHeadSha()

// ── 臂 1-3:三种用法错都要读出 2 ────────────────────────────────────────────
const bare = runCli()
test('U1 一个参数都不给 ⇒ exit 2(不得 0)', () => {
  assert.equal(bare.status, 2, `实得 rc=${bare.status};输出:${(bare.stderr || '').slice(0, 200)}`)
  // 非零本身不构成分档理由:崩溃也可能读出非零。必须同时读出「是参数校验给的结论」这句话。
  assert.match(
    bare.stderr,
    /必须提供 -m <commit message>/,
    'rc=2 却没点名校验对象 ⇒ 可能是崩溃而非裁决',
  )
})

const msgOnly = runCli('-m', '只读取证:这条不得真的提交任何东西')
test('U2 漏掉文件清单 ⇒ exit 2 并点名"文件路径"(票面实测的那一型)', () => {
  assert.equal(msgOnly.status, 2, `实得 rc=${msgOnly.status};旧缺陷正是"打印 ❌ 却 rc=0"`)
  assert.match(
    msgOnly.stderr,
    /必须提供至少一个文件路径/,
    '措辞要点名缺的是文件清单,不是笼统的用法错',
  )
})

const dashDashEmpty = runCli('-m', '只读取证', '--')
test('U3 写了 `--` 但后面空 ⇒ 同样 exit 2(票面误用的第二种写法)', () => {
  assert.equal(dashDashEmpty.status, 2, `实得 rc=${dashDashEmpty.status}`)
  assert.match(
    dashDashEmpty.stderr,
    /必须提供至少一个文件路径/,
    '同 U2:要读出的是校验的结论,不是任意非零',
  )
})

// ── 臂 4:正向对照 ────────────────────────────────────────────────────────
// 没有这一臂,U1-U3 就与"脚本 import 期就崩"完全同形(崩溃也读得出非零)。
// 必须有一臂证明**同一个尺子在正当用法上读出 0**,那三条非零才是判据给的结论。
const help = runCli('--help')
test('U4 --help ⇒ exit 0 且不打 ❌(证明非零档不是恒档)', () => {
  assert.equal(help.status, 0, `实得 rc=${help.status};stderr:${(help.stderr || '').slice(0, 200)}`)
  assert.doesNotMatch(help.stderr, /❌/, '帮助路径不得顺带报用法错')
  assert.match(help.stdout, /safe-commit\.mjs -m/, '帮助里得写着那条正确用法')
})

// ── 臂 5:零副作用自证 ─────────────────────────────────────────────────────
// 本文件会真派生全队共用的提交入口,所以必须当场证明那四次派生什么都没动:
// HEAD 未前进(没替我提交)、git 写锁没被创建(没进入 0.5 那段临界区)。
test('U5 用法错的四条派生未触碰仓库与写锁', () => {
  const headAfter = gitHeadSha()
  assert.equal(
    headAfter,
    headBefore,
    'HEAD 前进了 ⇒ 某条"用法错"臂其实走到 commit,本文件的零副作用前提破了',
  )
  assert.ok(!existsSync(LOCK), '锁目录存在 ⇒ 用法错臂越过了参数校验,进入了会清共享索引的临界区')
})

// ── 臂 6:反向形状锁(只在行为臂之间判方向,不锁具体行号/窗口)──────────────
// 判"两条校验都还在,且都在 commit 临界区之前":按语句块判,不按字符窗口判。
test('U6 两条参数校验仍在环境检查之前,且都走非零档', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  const guardMsg = /if \(!message\) \{[\s\S]{0,200}?process\.exit\(2\)\s*\}/
  const guardFiles = /if \(expectedFiles\.length === 0\) \{[\s\S]{0,200}?process\.exit\(2\)\s*\}/
  assert.match(src, guardMsg, '缺 -m 的校验被摘掉或退成了别的档')
  assert.match(src, guardFiles, '缺文件清单的校验被摘掉或退成了别的档')
  const iMsg = src.search(guardMsg)
  const iEnv = src.indexOf('0. 环境检查')
  assert.ok(
    iMsg !== -1 && iEnv !== -1 && iMsg < iEnv,
    '参数校验排到了环境检查之后 ⇒ 用法错会先碰共享索引',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
