// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「跨端登记自动器」装车的接线锁(2026-10-25 立;同日由同步 runLogged 档改版为 detached 后台派发档)。
 *
 * 锁的是哪一格:器物 scripts/auto-register-cross-end.mjs 造完后**全仓零调用方**
 * (2026-10-25 现读:`.husky/`、`scripts/guardian-runner.mjs`、`scripts/lib/pre-commit-hook.js`、
 * 根 `package.json` 四处各 grep 一次,零命中)—— AGENTS.md §0.9「造好没装车 = 没有」。
 * 本仓多会话共享工作区,并发旧基线提交会静默把这条腿写回"没有"(同型事故见该文件头注与守门 226 立因),
 * 所以装车必须有锁,不靠口头"我记得装了"。
 *
 * 改版立因(主会话实测,本锁随之以新形态为准):旧档 runLogged→execSync 同步等子扫描,
 * 480000ms 到点把孩子掐死(留痕 lastResult="failed" + cmd.exe ETIMEDOUT),且等待期间
 * **全程持有 post-commit 第 0 段的 git 写锁**——最坏情况别人 acquire --timeout 180000 超时,
 * 自动推送腿不跑。⇒ 本腿语义 = 不占锁、不等结论的后台派发,对齐第 7 段「快档延后守门补跑」范式。
 * 旧的"timeout 档 ≥300000ms"锁因此作废,由 ⑤ 的后台派发形状锁替代。
 *
 * ⚠ 本锁只判**接线形态**(源码里锚点是否成套:派发形态、状态先写后派的时序、双旗、
 * 子侧回写出口),**不判运行时行为**。原因不是偷懒:节流判据 `crossEndThrottleVerdict`
 * 与派发器都住在那枚 CJS 正文里,而该文件**被薄壳直启、不被 import** —— require 它 =
 * 真跑一遍推送链(禁止);在测试里另抄一份判据 = 违反 §22c(第二份必然漂移,有门 191 判红)。
 * 故"派发是否真的跑成"不在本锁射程内——它的物证面是
 * `.ihui-agent/state/cross-end-autoreg.json`(lastResult: dispatched→ok/failed/spawn-failed)
 * 与 `.ihui-agent/state/hook-logs/post-commit-cross-end-autoreg.log` 的子侧留痕块;
 * 本锁保证的是"这条腿装成了必留痕的形状,断在哪一档都会有名字"。
 *
 * 比对一律先剥整行注释、再折叠空白(`norm`),按子串/正则比 —— 本仓 prettier/eslint 会折行,
 * 按原始缩进或行号比会造出与正确性无关的假红(AGENTS.md §1「证据指针禁止行号」同理)。
 * 派发器源码常量 CROSS_END_AUTOREG_WRAPPER_SRC 里的 spawnSync 是**子侧(后台)行为**,
 * 判"腿内不得同步等待"时先把该数据区抠掉(elideWrapper),不许连子侧一起禁。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const HOOK_PATH = join(ROOT, 'scripts', 'lib', 'post-commit-hook.js')
const SHELL_PATH = join(ROOT, '.husky', 'post-commit')

const HOOK_RAW = readFileSync(HOOK_PATH, 'utf8')
const SHELL_RAW = readFileSync(SHELL_PATH, 'utf8')
/** 折叠连续空白为单空格:锚点比对只看形态,不看换行/缩进 */
const norm = (s) => String(s).replace(/\s+/g, ' ')
const HOOK = norm(HOOK_RAW)

/** 本腿在正文里的起点:段标题注释(找不到即红 —— 腿整段没了正是本锁要拦的事) */
function legStartIndex(src) {
  const i = src.indexOf('跨端登记自动链路')
  assert.ok(i >= 0, 'post-commit-hook.js 里找不到「跨端登记自动链路」段标题 ⇒ 这条腿不存在')
  return i
}

/** 剥掉整行注释后的文本(注释里合法出现"本腿绝不 git add"这类字样,判禁令时必须先剥) */
const stripLineComments = (text) =>
  text
    .split(/\r?\n/)
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')

/** 本腿区间文本:起点(段标题注释)到 EOF,剥整行注释、折叠空白;起点找不到返回 ''(由调用方判缺) */
function legNormOf(src) {
  const start = src.indexOf('跨端登记自动链路')
  if (start < 0) return ''
  return norm(stripLineComments(src.slice(start)))
}

/** 抠掉派发器源码数组这一段(它是"子侧数据",里面的 spawnSync 不属于腿内同步等待) */
function elideWrapper(legN) {
  const wStart = legN.indexOf('CROSS_END_AUTOREG_WRAPPER_SRC = [')
  const wEndNeedle = "].join('\\n')"
  const wEnd = legN.indexOf(wEndNeedle)
  if (wStart < 0 || wEnd <= wStart) return legN
  return legN.slice(0, wStart) + ' [WRAPPER-ELIDED] ' + legN.slice(wEnd + wEndNeedle.length)
}

/**
 * 接线锚点表(单份实现:① 与 ⑦ 共用同一把尺子 —— 成对反控不是另抄一套判据)。
 * 返回缺失锚点的描述数组;空数组 = 这套锚点在源码里成套在位。
 * 2026-10-25 改版:旧"label 必须真被 runLogged 用作首参"锚点作废,换成派发三件套
 * (派发器源码常量 + node -e 实参 + spawn 直启);日志 label 保留 —— 子侧仍同名落痕。
 */
function missingWiringAnchors(src) {
  const s = legNormOf(src)
  const missing = []
  if (!/post-commit-cross-end-autoreg\.log/.test(s))
    missing.push("日志留痕文件名 'post-commit-cross-end-autoreg.log'")
  if (!/CROSS_END_AUTOREG_WRAPPER_SRC/.test(s))
    missing.push('子侧派发器源码常量 CROSS_END_AUTOREG_WRAPPER_SRC(父不等结论,结论只能子侧回写,子侧必须有可跑的执行器)')
  if (!/-e', CROSS_END_AUTOREG_WRAPPER_SRC/.test(s))
    missing.push("派发器源码必须真被送进 node -e 实参(只声明不派发不算接线)")
  if (!/spawn\(\s?process\.execPath/.test(s))
    missing.push('spawn(process.execPath, …) 直启派发(取代 runLogged/execSync 同步等待)')
  if (!/--apply/.test(s))
    missing.push('器物子调用带 --apply(预演档一行都不写盘 = 不登记)')
  if (!/CROSS_END_AUTOREG_SCRIPT/.test(s))
    missing.push('命令由脚本路径常量 CROSS_END_AUTOREG_SCRIPT 拼出(不许出现第二处硬写路径)')
  // 双旗守卫缺一不可:应急放行 + 防递归,且递归旗要随 env 透给派发器(派发器再透给器物)
  if (!/process\.env\.HUSKY_SKIP_CROSS_END_AUTOREG !== '1'/.test(s))
    missing.push('应急放行旗 HUSKY_SKIP_CROSS_END_AUTOREG')
  if (!/process\.env\.IHUI_CROSS_END_AUTOREG_COMMIT !== '1'/.test(s))
    missing.push('防递归旗 IHUI_CROSS_END_AUTOREG_COMMIT')
  if (!/env: \{ \.\.\.process\.env, IHUI_CROSS_END_AUTOREG_COMMIT: '1' \}/.test(s))
    missing.push('递归旗随 spawn env 透给子进程(将来本腿若接提交就是递归坑)')
  return missing
}

test('① 接线锚点成套:label + --apply + 双旗(env 守卫与透传)同区出现', () => {
  assert.deepEqual(missingWiringAnchors(HOOK_RAW), [], '这条腿在正文里缺以下锚点(见数组)')
})

test('② 命令实参解析出的器物路径:要么在位,要么本腿带点名跳过守卫(二者皆无=死链,§0.8)', () => {
  const m = /const CROSS_END_AUTOREG_SCRIPT = '([^']+)'/.exec(HOOK)
  assert.ok(m, '缺 CROSS_END_AUTOREG_SCRIPT 常量 ⇒ 命令拼不出真实路径')
  const rel = m[1].replace(/\\/g, '/')
  assert.equal(
    rel,
    'scripts/auto-register-cross-end.mjs',
    '本腿指向的器物路径被改写 ⇒ 请连同本锁一起改,并说明为什么',
  )
  const onDisk = existsSync(join(ROOT, rel))
  if (!onDisk) {
    // CI/别的 checkout 拿不到未入库的器物时不许变恒红(§12e):改判"本腿是否显式点名跳过"。
    assert.ok(
      /existsSync\(join\(ROOT, CROSS_END_AUTOREG_SCRIPT\)\)/.test(HOOK),
      `器物 ${rel} 不在位,而本腿也没有"不在位⇒显式点名跳过"的守卫 ⇒ 每次都会派生一个必死的孩子`,
    )
    return
  }
  const body = readFileSync(join(ROOT, rel), 'utf8')
  assert.ok(/--apply/.test(body), '器物不认 --apply 旗 ⇒ 本腿的命令是跑不通的出路(§0.8)')
})

test('③ 节流凭据形态成套:状态文件路径 + 窗口常量 + headSha + 先盖时刻后派发', () => {
  assert.ok(
    HOOK.includes("'.ihui-agent', 'state', 'cross-end-autoreg.json'") ||
      /cross-end-autoreg\.json/.test(HOOK),
    '缺仓外状态文件路径常量 ⇒ 节流无从落脚',
  )
  assert.match(
    HOOK,
    /const CROSS_END_AUTOREG_WINDOW_MS = 30 \* 60 \* 1000/,
    '节流窗口常量必须是 30 分钟(整轮扫描实测以分钟计,不能每次提交都跑)',
  )
  // headSha 进状态文件:供人判读"这轮登记是对着哪枚 HEAD 算的"
  const leg = stripLineComments(HOOK_RAW.slice(legStartIndex(HOOK_RAW)))
  assert.ok(
    /headSha/.test(leg) && /lastRunAt/.test(leg),
    '状态文件必须同时记 lastRunAt 与 headSha(只有时刻就没法判读是哪枚提交触的)',
  )
  // 时序不变式(本仓事故型"自愈配额写在阻塞调用之后 ⇒ 计数恒 0、每周期重犯"的反面):
  // 先写 lastRunAt + lastResult:'dispatched' 在飞凭据,再 spawn 派发 —— 反过来(先派后写)
  // 父已退出而状态未落,窗口不成立,同一枚慢提交会反复触发同一条重活。
  const legN = legNormOf(HOOK_RAW)
  const stampIdx = legN.indexOf('lastRunAt: new Date().toISOString()')
  const inflightIdx = legN.indexOf("lastResult: 'dispatched'")
  const spawnIdx = legN.search(/spawn\(\s?process\.execPath/)
  assert.ok(
    stampIdx >= 0 && inflightIdx >= 0 && spawnIdx >= 0 && stampIdx < inflightIdx && inflightIdx < spawnIdx,
    `lastRunAt 与 dispatched 在飞凭据必须盖在 spawn 之前(stamp=${stampIdx}, dispatched=${inflightIdx}, spawn=${spawnIdx})`,
  )
  // 判据取输入的那一句必须是"状态文本 + Date.now()",不许有人把它换成别的时钟源
  assert.match(
    legN,
    /crossEndThrottleVerdict\(readCrossEndAutoregState\(\), Date\.now\(\)\)/,
    '节流判据的输入面被改写 ⇒ 本锁的"读不到⇒该跑"结论不再成立',
  )
  // 在飞守卫成套:后台档没有旧同步档的超时兜底,不拦"上一枚 dispatched 未收尾再派"就是叠扫描;
  // 而 dispatchedAt 取不到/坏形/在未来 ⇒ 不设防(失效方向恒为多跑一次,§0.3)。
  assert.match(
    legN,
    /st\.lastResult === 'dispatched'/,
    '节流判据里的在飞守卫被摘 ⇒ 后台派发失去叠扫描防线(超时掐孩子那档已随同步形态一起没了)',
  )
  assert.match(
    HOOK,
    /const CROSS_END_AUTOREG_RUNNING_CAP_MS = 60 \* 60 \* 1000/,
    '在飞上限常量缺失或数值形态被改 ⇒ 守卫无数值可依(上限取值须显著高于一轮扫描)',
  )
})

test('④ 本腿绝不落库:区间内(剥注释后)无 git add / 无提交出口', () => {
  const leg = stripLineComments(HOOK_RAW.slice(legStartIndex(HOOK_RAW)))
  for (const forbidden of [/git add/, /git commit/, /commit-tree/, /update-ref/, /safe-commit/]) {
    assert.ok(
      !forbidden.test(leg),
      `本腿出现了 ${forbidden} —— 落库唯一出口是 scripts/auto-commit-quiet.mjs 收编工作树改动;自行 add/commit 就是在别人未提交的内容上叠提交,并与 O43②「钩子运行期外来件」护栏结构性冲突`,
    )
  }
})

test('⑤ 后台派发档:父侧不得同步等待(execSync/runLogged 零命中)+ detached 派发 + 在飞上限 ≥ 节流窗口', () => {
  // 2026-10-25 改版:本腿从 runLogged/execSync 同步等子扫描,改成 detached 后台派发
  // (旧同步档 480000ms 掐死孩子,且等待期间全程持 post-commit 第 0 段 git 写锁 ⇒
  //  别人 acquire --timeout 180000 超时、自动推送腿不跑)。
  // ⇒ 旧的「timeout 档 ≥300000ms」锁随同步形态一起作废(钩子正文里已明写这层),
  //  本条改锁**新形态**:父侧不等待(不持锁)、子侧 detached、上一枚在飞有上限兜底。
  // 判的是"形态"不是"运行时行为" —— 运行时物证在 .ihui-agent/state/cross-end-autoreg.json。
  // 子侧派发器里的 spawnSync 是**子侧**行为,不算父侧同步等待 ⇒ 先把该数据区抠掉。
  const legN = elideWrapper(legNormOf(HOOK_RAW))
  for (const forbidden of [/execSync/, /runLogged/]) {
    assert.ok(
      !forbidden.test(legN),
      `本腿出现 ${forbidden} —— 父侧同步等待 = 全程持 git 写锁等一轮分钟级扫描(2026-10-25 事故:480s 掐死孩子 + 别人 acquire 超时)`,
    )
  }
  assert.ok(/detached: true/.test(legN), '本腿必须 detached 派发(不 detached = 父退出时孩子被一起带走)')
  // 在飞上限必须 ≥ 节流窗口:否则窗口到点时上一枚还在跑,叠扫描没有防线
  const capM = /const CROSS_END_AUTOREG_RUNNING_CAP_MS = (\d+) \* 60 \* 1000/.exec(HOOK)
  const winM = /const CROSS_END_AUTOREG_WINDOW_MS = (\d+) \* 60 \* 1000/.exec(HOOK)
  assert.ok(capM && winM, '缺在飞上限或节流窗口常量')
  assert.ok(
    Number(capM[1]) >= Number(winM[1]),
    `在飞上限 ${Number(capM[1])}min 必须 ≥ 节流窗口 ${Number(winM[1])}min(否则窗口到点时上一枚还在跑)`,
  )
  // 成对反控(防本锁空转):把 detached 摘掉 ⇒ 本锁必须立刻读出缺项
  const noDetached = HOOK_RAW.replace(/detached: true/g, 'detached: false')
  assert.ok(noDetached !== HOOK_RAW, '摘不到 detached 锚点 ⇒ 反控失去比对对象')
  assert.ok(
    !/detached: true/.test(elideWrapper(legNormOf(noDetached))),
    '摘掉 detached 后本锁仍绿 ⇒ 本锁是永绿的装饰',
  )
})

test('⑥ 钩子装载形态:薄壳仍是 #!/bin/sh,正文不是 sh 壳(阳性对照,守门 226 H1 同判据)', () => {
  const shellFirst = SHELL_RAW.split(/\r?\n/, 1)[0].trim()
  assert.equal(
    shellFirst,
    '#!/bin/sh',
    '.husky/post-commit 首行必须是 #!/bin/sh —— 写成 node 正文时,PATH 里没 node 就整条链静默死(2026-10-18/10-19 实测)',
  )
  assert.match(
    SHELL_RAW,
    /scripts\/lib\/post-commit-hook\.js/,
    '薄壳必须引用正文,否则本腿随正文一起没人启动(H2 死链)',
  )
  // 阳性对照:同一把尺子量正文文件 —— 它**不该**是 sh 壳(它就该是 node 正文)。
  // 若哪天有人把正文塞回钩子文件,这条与上面那条会同时翻脸,这正是 226 拦的形态。
  const hookFirst = HOOK_RAW.split(/\r?\n/, 1)[0].trim()
  assert.ok(
    !/^#!(\/bin\/sh|\/usr\/bin\/env sh|\/bin\/bash)/.test(hookFirst),
    'scripts/lib/post-commit-hook.js 变成了 sh 壳 ⇒ 与薄壳角色互换,装载形态对账必红',
  )
  assert.ok(
    !hookFirst.startsWith('#!'),
    `正文首行不该有任何 shebang(它由薄壳经 node 直启):${hookFirst}`,
  )
})

test('⑦ 成对反控(防本锁空转):摘掉锚点/摘掉整段,同一把尺子必须读出缺项', () => {
  // 反控一:把 label 整片换成别的字 ⇒ ① 那套锚点必须立刻读出缺项(否则 ① 是永绿的装饰)
  const noLabel = HOOK_RAW.replace(/post-commit-cross-end-autoreg/g, 'renamed-leg')
  assert.ok(
    missingWiringAnchors(noLabel).length > 0,
    '摘掉 label 后锚点仍读成套 ⇒ 本锁判不出"腿被人改名/摘走"',
  )
  // 反控二:把整段(含节流常量与 --apply 调用)从末尾剪掉 ⇒ 起点找不到、锚点全缺
  const legGone = HOOK_RAW.slice(0, legStartIndex(HOOK_RAW))
  assert.throws(
    () => legStartIndex(legGone),
    /跨端登记自动链路/,
    '整段没了却还能找到起点 ⇒ 起点判据空转',
  )
  assert.ok(
    missingWiringAnchors(legGone).length >= 5,
    `整段没了应至少读出 5 项缺锚点,实得 ${JSON.stringify(missingWiringAnchors(legGone))}`,
  )
  // 反控三:节流窗口被人改成"每次提交都跑"(窗口常量被换走)⇒ ③ 的窗口锚点必须翻红
  const WINDOW_DECL = 'const CROSS_END_AUTOREG_WINDOW_MS = 30 * 60 * 1000'
  const noWindow = HOOK_RAW.replace(WINDOW_DECL, 'const CROSS_END_AUTOREG_WINDOW_MS = 0')
  assert.ok(
    noWindow !== HOOK_RAW,
    `正文里找不到窗口常量声明「${WINDOW_DECL}」⇒ 反控三与 ③ 都失去了比对对象`,
  )
  assert.doesNotMatch(
    norm(noWindow),
    /const CROSS_END_AUTOREG_WINDOW_MS = 30 \* 60 \* 1000/,
    '窗口常量被人改走而锚点仍绿 ⇒ 节流形态没被锁住(这条腿会每次提交都跑 4.5 分钟)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
