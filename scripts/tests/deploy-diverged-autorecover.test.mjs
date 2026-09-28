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

/**
 * ff 竞态这一族的源码级锁(2026-09-28 实测逼出)。
 *
 * 抽成**纯函数 + 构造面**而不是只对着真文件断言,理由与本仓守门 103 T12 同一课:
 * 只读真文件的绿色断言证明不了判据有牙 —— 它此刻恰好满足而已。下面每一条都配一条
 * "把它改回出事形态必须翻红"的变异对照(G-OLD / G-NOANC / G-NOFAIL)。
 *
 * 三条锁对应的现场:
 *  R1 远端 tip 必须在 fetch 之后**立刻定格成显式 sha**,且形状不可解析即 fail-closed
 *     —— FETCH_HEAD 是全机共享单文件,push-guard / git-guardian / 别的会话一次 fetch 就换掉它。
 *  R2 behind / 挡路清单 / merge 三处决策一律只认该变量,不得再回头看 FETCH_HEAD
 *     —— 实测 09-28 09:02 那轮:behind 现读 15,merge 却打印 "Already up to date." 且 exit 0,
 *        旧代码只看退出码 ⇒ 照常切流**没动过的旧提交**,而这条链一次告警都不会响。
 *  R3 merge 之后必须用 `merge-base --is-ancestor` 复核"HEAD 真的包含了那一枚",且失败支
 *     必须 Fail(不是只 Log)并排在成功结论之前 —— 用 is-ancestor 而不是字符串等值:
 *     并发会话在 tip 之上又本地提交一枚时 HEAD 是它的**后代**,那种必须放过。
 */
function stripPsComments(src) {
  return src
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('#'))
    .join('\n')
}

function assertFfRaceGuards(src) {
  const code = stripPsComments(src)
  const fails = []
  const need = (re, why) => {
    if (!re.test(code)) fails.push(why)
  }
  const ban = (re, why) => {
    if (re.test(code)) fails.push(why)
  }
  need(/\$remoteTipRaw\s*=\s*\(& git rev-parse FETCH_HEAD/, 'R1 没把当次 FETCH_HEAD 定格成显式 sha')
  need(/remoteTipRaw\s*-notmatch\s*'\^\[0-9a-f\]\{40\}\$'/, 'R1 定格后没做 40 位十六进制形状校验(取不到必须 fail-closed)')
  need(/cat-file -e "\$remoteTip\^\{commit\}"/, 'R1 远端对象不在本地时没有定向补取/判无法判定这一步')
  need(/rev-list --count "HEAD\.\.\$remoteTip"/, 'R2 behind 仍在读共享的 FETCH_HEAD')
  need(/git merge --ff-only \$remoteTip/, 'R2 merge 的目标不是本轮定格的 sha')
  need(/diff --name-only HEAD \$remoteTip/, 'R2 挡路路径清单算的是另一个面(与 merge 不同面 ⇒ 点名会错)')
  need(/merge-base --is-ancestor \$remoteTip HEAD/, 'R3 merge 之后没有复核 HEAD 真的包含那一枚(退出码不携带信息)')
  ban(/HEAD\.\.FETCH_HEAD/, 'R2 behind 回退到读 FETCH_HEAD(竞态原样回来)')
  ban(/--ff-only FETCH_HEAD/, 'R2 merge 回退到读 FETCH_HEAD(竞态原样回来)')
  // 复核必须排在"成功结论"之前,否则它只是日志里的一句事后说明,拦不住切流。
  const anc = code.search(/merge-base --is-ancestor \$remoteTip HEAD/)
  const okLine = code.indexOf('merge 完成')
  if (anc >= 0 && okLine >= 0 && anc > okLine) fails.push('R3 复核排在成功结论之后 ⇒ 拦不住按旧提交切流')
  // 复核失败那一支必须是 Fail(只 Log = 门对自己立项那一型全盲)。
  const after = code.slice(anc, anc + 1400)
  if (!/Fail\s+"/.test(after)) fails.push('R3 复核不成立那支没有 Fail,只喊不构成阻止')
  if (fails.length) throw new Error(`ff 竞态锁不成立:\n  - ${fails.join('\n  - ')}`)
}

test('R1–R3 部署环 ff 竞态锁:真文件成套在位', () => {
  assertFfRaceGuards(SRC)
})

test('R-OLD 变异:整段退回"处处读 FETCH_HEAD、无复核"必须翻红', () => {
  const old = SRC.replace(/\$remoteTip\b/g, 'FETCH_HEAD').replace(/merge-base --is-ancestor FETCH_HEAD HEAD/, 'noop-removed')
  assert.throws(() => assertFfRaceGuards(old), /ff 竞态锁不成立/, '退回旧形态却被判通过 ⇒ 这条锁没有牙')
})

test('R-NOANC 变异:只删复核那一刀必须翻红(不是靠前面几刀连带)', () => {
  const noAnc = SRC.replace(/& git merge-base --is-ancestor \$remoteTip HEAD/, '& git noop-ancestor-check')
  assert.notEqual(noAnc, SRC, '夹具没生效(定位不到复核调用)')
  assert.throws(() => assertFfRaceGuards(noAnc), /R3/, '删掉复核仍然通过 ⇒ 退出码仍是唯一判据,竞态没关')
})

test('R-NOFAIL 变异:复核只 Log 不 Fail 必须翻红', () => {
  const i = SRC.search(/merge-base --is-ancestor \$remoteTip HEAD/)
  assert.ok(i > 0, '夹具定位失败')
  const win = SRC.slice(i, i + 1400)
  const patched = SRC.replace(win, win.replace(/Fail\s+"/, 'Log "'))
  assert.throws(() => assertFfRaceGuards(patched), /R3/, '把阻止降级成提示 = 门对自己立项那一型全盲')
})

test('R-COMMENT 反向锁:注释里描述旧形态不得被算成违规', () => {
  // 头注与成因注释大量提到 FETCH_HEAD(那是"为什么这么改"的证据)。若判据按整档文本搜
  // "--ff-only FETCH_HEAD",门会在自己解释自己的散文上恒红 —— 与本仓"注释不得被读成代码"
  // 那条同型(守门 131 判据面先剥注释同理)。
  const withExtraDoc = SRC + '\n# 历史写法曾为 git merge --ff-only FETCH_HEAD 与 HEAD..FETCH_HEAD\n'
  assertFfRaceGuards(withExtraDoc)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
