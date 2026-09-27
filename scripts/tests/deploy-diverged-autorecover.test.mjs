// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 部署环「分叉先自愈、连续多轮才报警」的镜像测试(§22c:不复制实现,只锁真文件的结构)。
 *
 * 为什么需要它:ihui-deploy.ps1 一被执行就真的部署,不能被 import;而这条修复的全部价值都在
 * **调用点的顺序**上 —— 把 `exit 0` 那一支删掉,计数与收敛调用都还在、函数都还绿,但线上行为
 * 退回"每撞一次分叉寄一封"。那种回归只有源码锁能拦住(§22c「判据失效的表现永远是安静」同族)。
 *
 * 三条锁对应三个真实成因:
 *  L1 报警必须先经过连续轮数阈值 —— 多会话并发推造成的分叉是常态中间态,不是事故;
 *  L2 必须真的调用 git-sync-converge.mjs —— 旧代码只把它名字写进日志"请人工跑",从未调用;
 *  L3 取 node 必须走 Resolve-NodeExe —— 服务身份(LocalSystem)PATH 里没有 node,
 *     裸 `node` 会得到一个静默失败,现象是"自动收敛"永远不生效而账面看不出来。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC = readFileSync(join(ROOT, 'deploy/win/ihui-deploy.ps1'), 'utf8')

test('L2 收敛出口真的被调用,而不是只写在日志文案里', () => {
  assert.match(SRC, /function\s+Invoke-AutoConverge\b/, '缺 Invoke-AutoConverge 定义')
  assert.match(SRC, /Invoke-AutoConverge\s*$/m, '分叉分支里必须真的调用它(只在注释里提到不算装车)')
  assert.match(SRC, /git-sync-converge\.mjs/, '必须调本仓唯一收敛出口,不得自造第二套合并逻辑')
})

test('L3 取 node 走绝对路径兜底,不裸写 node', () => {
  const body = SRC.slice(SRC.indexOf('function Invoke-AutoConverge'))
  const head = body.slice(0, body.indexOf('\nfunction ', 10) > 0 ? body.indexOf('\nfunction ', 10) : 4000)
  assert.match(head, /Resolve-NodeExe/, '服务身份 PATH 无 node ⇒ 必须走该出口')
  assert.doesNotMatch(head, /Start-Process\s+node[\s'"]/, '不得裸 `node`(会得到静默失败)')
  assert.match(head, /取不到 node/, '取不到 node 必须喊出来,不得静默当成已收敛')
})

test('L1 报警前必须过连续轮数阈值,且未达阈值是优雅退出而非"部署成功"', () => {
  const i = SRC.indexOf('Not possible to fast-forward')
  assert.ok(i > 0, '分叉判据分支不在了')
  const win = SRC.slice(i, i + 2600)
  const order = [
    ['计数', /streak\s*=\s*Add-DivergedStreak/],
    ['收敛', /Invoke-AutoConverge/],
    ['阈值门', /\$streak\s*-lt\s+\$DivergedAlertStreak/],
    ['退出码', /exit\s+0/],
    ['报警', /Fail\s+"git merge --ff-only/],
  ]
  let at = -1
  for (const [name, re] of order) {
    const m = win.search(re)
    assert.ok(m >= 0, `缺少「${name}」这一步`)
    assert.ok(m > at, `「${name}」顺序不对(必须在 ${name === '报警' ? '阈值门之后' : '上一步之后'}) ⇒ 阈值失去意义`)
    at = m
  }
  assert.match(win, /Release-DeployLock/, '提前退出必须放锁,否则下一轮白等一个超时窗口')
})

test('成功快进后连续计数必须归零', () => {
  const i = SRC.indexOf('merge 完成')
  assert.ok(i > 0)
  assert.match(SRC.slice(Math.max(0, i - 260), i), /Reset-DivergedStreak/, '不清零 ⇒ 一次抖动永久累加到阈值')
})

test('未引入任何强推或破坏性 git 动作', () => {
  const added = ['git push --force', 'push -f', 'reset --hard', 'git stash', 'clean -fd']
  for (const a of added) assert.equal(SRC.includes(a), false, `新增破坏性动作:${a}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
