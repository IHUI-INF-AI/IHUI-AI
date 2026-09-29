#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-desktop-event-wiring.mjs
 *
 * 守门脚本: 桌面端(Tauri)事件链路接线守门(2026-09-22 立)
 *
 * 立门动机(真实事故):
 *   用户反馈"桌面端托盘右键菜单的『切换主题』和『打开设置』点击后没任何反应"。
 *   根因是三层事件链的第 3 层断裂 ——
 *     Rust emit → use-desktop.ts 转 CustomEvent → ??? 无 addEventListener 消费方
 *   useDesktopEvents() 把 `desktop-tray-action` 的 5 个 action 转发成 CustomEvent,
 *   其中 new_chat / check_update / quit 三个有正式消费方,而 desktop-theme-toggle
 *   与 desktop-open-settings **全仓零监听** —— dispatch 成功但无副作用,
 *   用户侧表现为"完全没反应";Rust 侧 `let _ = window.emit(...)` 又吞掉了返回值,
 *   连日志都查不到,只能靠肉眼 diff 三层源码定位。
 *   同一模式的问题还有一处:系统级快捷键 Ctrl+Shift+S 派发的
 *   `desktop-quick-screenshot` 同样无任何消费方。
 *
 * 校验目标(三层闭环,任一断裂即阻断):
 *   [层 1] 生产端:apps/desktop/src-tauri/src/**\/*.rs 的 `.emit("事件名", payload)`
 *          payload 为字符串字面量时即 action(payload 为 () 表示无 action)。
 *   [层 2] 桥接端:apps/web/src/hooks/use-desktop.ts 的 `listen('事件名')` +
 *          块内 `case 'action':` + `new CustomEvent('自定义事件名')`。
 *          (责任文件唯一:use-desktop.ts)
 *   [层 3] 消费端:apps/web/src/**\/*.{ts,tsx} 的 `addEventListener('自定义事件名')`
 *          + 事件注册表常量块(如 SHORTCUT_ROUTES / MODE_SHORTCUT_EVENTS,
 *            这类表以 addEventListener(event, handler) 变量形态注册,
 *            静态字面量扫不到,必须显式纳入)。
 *
 * 对账规则:
 *   规则 A(阻断):Rust emit 的事件名必须在 use-desktop.ts 有对应 listen()
 *   规则 B(阻断):Rust emit 的 (事件名, action) 必须在桥接端对应块内有 case 分支
 *   规则 C(阻断):桥接端 dispatch 出的每个 CustomEvent 必须在层 3 有消费方
 *                (本次事故的核心规则:缺消费方 = 点击/快捷键"没反应")
 *   规则 D(阻断):扫描器自失效防护 —— 各层命中数低于阈值即报错,防正则腐化空转变绿
 *   规则 E(阻断,2026-09-25 立):桌面两条链的**语义分层** ——
 *     chain: continuous(实时链,Rust 事件总线,无 id 无队列)与
 *     chain: replayable(重放链,api `agent.action` + WS 投递,至少一次故必须按 id 幂等)。
 *     E1 实时链不得混入重放载体;E2 重放链不得摘掉幂等键;E3 两条链的链名标记必须在源码里。
 *     实测分层结论:两条链本就分属不同通道,故这里只钉"不得混用/不得摘标记",不改生产链路。
 *   规则 F(阻断,2026-09-25 立):Rust 主进程不得持有 task/session 业务状态 ——
 *     进程级状态声明里出现业务名词即红,零容忍不设清单豁免(清单会腐烂),
 *     唯一出口是行内 `rust-state-exempt: <原因>`;扫到 0 处声明先判"扫描器失效"。
 *   规则 G(阻断,2026-09-26 立 · A10C-1):深链「未就绪不丢,就绪后补投」机制对账 ——
 *     本门立项两年看不见 `desktop-deep-link` 这一路:层 1 正则只认 payload 为字符串字面量
 *     或 `()` 的 emit,而深链 payload 是 URL 变量 ⇒ 结构上永不命中(实测 `grep -c desktop-deep-link`
 *     本门 = 0)。而这条链承载的是 SSO 一次性登录码:冷启动时 Rust 派发早于前端 listen,
 *     旧实现 `if let Some(window) = …{ emit }`(无 else)+ 只取 `urls().first()` ⇒ 登录码静默蒸发。
 *     G 组登记的是**机制**而非事件名:G1 投递出口唯一 / G2 未就绪必有"入队"这个去向 /
 *     G3 队列有上限且丢弃必须计数+喊 / G4 取即清 + 就绪标记 + 按 label 绑定 + 命令已注册 /
 *     G5 目标窗口销毁清账 / G6 桥接端先 listen 后 take、补投走同一条处理链、只真成功才广播、
 *     不得在前端自建去重集合(那是把实时链改造成隐形重放链,同规则 E1) / G7 事件名与命令名两边同形 /
 *     G8 整页导航发起处必须先复位深链闸门 /
 *   规则 G9(阻断,2026-09-29 立 · G-407 票①):**整页导航发起点必须先触发"存草稿"出口。**
 *     立据不是假想而是现读:`lib.rs` 的 CloseRequested 分支**无条件**
 *     `emit("desktop-before-close", ())`(注释原文"三种去向都照发…先存草稿"),而
 *     `auto_refresh.rs` 的 5 处 `eval("location.reload()" / "location.href=…")` 由宿主直接
 *     掀掉渲染端 ⇒ 那条 emit 一次都不会发生,热刷新/离线切换时正在编辑的草稿整块丢失
 *     (现读行号 275/318/347/366/394,与票面引用的历史读数逐字相同)。
 *     三条不可漂的设计:① 发起点枚举**只有一份** `collectPageNavSites`,G8 与 G9 共用 ——
 *     两处各写一遍判据正则必然漂移(守门 102 的 GA1/GA4 共用同一遍遍历是同一条规矩);
 *     ② "找不到发起点即失明"的护栏**只住在 G8**,G9 反向依赖它而**不复制第二份**
 *     (复制出来的第二份护栏永远不会与被审面同步 —— 镜像测试 T6 钉死);
 *     ③ 存量 5 处走「该文件 HEAD 自身缺口数」棘轮 ⇒ 全量档只报数、`--staged` 只拦本次带进来的
 *     新账(§12e:当场把存量判红就是恒红门,唯一结局是各会话跳钩子、连带链上全部守门作废)。
 *     渲染面(`apps/web` 的 `window.location.*`,现读 10 处 / 8 文件)**逐文件报名但不判红**,
 *     理由写在 `pageNavScopeOf` 的注释里:宿主闸不在那一侧,而该 CustomEvent 当前零消费方 ——
 *     判它等于要求注销跳转去派发一个没人接的事件,产出的只会是空操作或伪造豁免。
 *   规则 H(阻断,2026-09-27 立 · 随 5637972f4c 的**写法变更**同步扫描器):托盘每个菜单项都必须有
 *     **可识别的去向** —— 要么 emit 到 desktop-tray-action(旧形态,层1 看得见),要么在 Rust 侧自己
 *     把活儿干完(原生形态:show/hide/set_focus 或 exit 一族)。立据不是假想而是当日的真红:「托盘退出
 *     改为立即退出」把 tray.quit 从 emit 链换成 arm_forced_exit + app.exit(0)
 *     (apps/desktop/src-tauri/src/lib.rs 的 "tray.quit" 分支),层1 的 emit 计数于是从 8 掉到 7,
 *     而**功能没坏** —— 掉的是一道本该被认出来的新写法。只把阈值 8 改成 7 就是把这台自失效防护改成
 *     永远绿灯的假工具(AGENTS §12f「修红不得顺手放宽判据」),所以这里改的是**覆盖面**:H 认原生去向,
 *     并新增「托盘菜单项数」这一维 tripwire,使"退出分支被清空"仍然当场判红。
 *
 * 取材面(2026-09-26 收口,与守门 36/93/118/124 同口径):
 *   默认判 **HEAD blob**,`--staged` 判**索引 blob**(这次提交会带走的那一份 —— 盘上随后改对
 *   不算修好),`--worktree` 只作人工逃生舱;两个面旗同给 = 自相矛盾 ⇒ 判死。
 *   **路径清单与正文同面同轮**:HEAD 档用 `git ls-tree -r HEAD -- <dir>`、索引档用
 *   `git ls-files -- <dir>`,内容一律经 `scripts/lib/face-reader.mjs` 的 `catBatch` 一次批量读满。
 *   旧形态是 `readFileSync(join(ROOT, …))` 按磁盘判,而共享工作树常年滞后 HEAD ⇒ 同一份 HEAD
 *   代码会在"恒红 / 假绿"之间来回跳,并把错数写回棘轮基线;那正是守门 118 判红本门的原因。
 *   任一面取不到(目录列空 / 清单里的路径读不出正文)⇒ **exit 2「无法判定」并点名路径**,
 *   既不冒红也不记绿,且**不回落**到另一个面 —— 回落就是把"没判"写成"判过了"。
 *
 * 退出码:
 *   0 = 三层接线闭环通过
 *   1 = 发现链路断裂或扫描器失效,阻断
 *   2 = 无法判定(两面旗同给 / 该面取不到清单或正文)—— 绝不记为通过
 *
 * 用法:
 *   node scripts/check-desktop-event-wiring.mjs             全量(HEAD blob)
 *   node scripts/check-desktop-event-wiring.mjs --staged    索引面(本次提交会带走的那一份)
 *   node scripts/check-desktop-event-wiring.mjs --worktree  人工排查(盘上内容,提交链不走这档)
 *   node scripts/check-desktop-event-wiring.mjs --self-test E/F/G 判据 + 取材面三态自检
 * 紧急跳过(需 PR 说明):
 *   HUSKY_SKIP_DESKTOP_EVENT_WIRING=1 git commit ...
 */

import { readdirSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

// 取材只走这一层:绝对路径 git + safe.directory + quotepath + windowsHide + maxBuffer +
// "输出被截断 ⇒ 无法判定" —— 这五处易错点各门自己写一遍就会各漏一遍(AGENTS 守门 118)。
import { Undetermined, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')

// R74 v3 tee: 同时把守门结果写到磁盘(sandbox 不返回 stdout 时也能 Read)
const RESULT_FILE = path.join(ROOT, '__gate_result.txt')
try {
  writeFileSync(RESULT_FILE, '')
} catch {} // 清空
function tee(line) {
  try {
    appendFileSync(RESULT_FILE, line.replace(/\x1b\[[0-9;]*m/g, '') + '\n')
  } catch {}
}
const _origLog = console.log.bind(console)
const _origErr = console.error.bind(console)
console.log = (...args) => {
  _origLog(...args)
  tee(args.join(' '))
}
console.error = (...args) => {
  _origErr(...args)
  tee('[ERR] ' + args.join(' '))
}

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
}

const errors = []
const passed = []
const warnings = []

/**
 * 规则 C 豁免:桥接端派发但**不要求**前端消费方的 CustomEvent(警告不阻断)。
 * 每项必须写清理由;新增条目须在 PR 描述给出同等证据(与 check-agent-event-parity.mjs
 * 的 WHITELIST 同治理标准)。
 */
const CONSUMER_WHITELIST = [
  {
    name: 'desktop-sso-success',
    reason:
      'SSO 登录闭环在 lib/sso-desktop-bridge.ts 内已自洽(exchange token → 写入 auth store),' +
      '本事件仅为可选的 UI 通知(如 toast),无监听不影响登录功能成立',
  },
  {
    name: 'desktop-before-close',
    reason:
      'Rust 侧 emit 本意是"关主窗口前让前端保存草稿",但 main 窗口 CloseRequested 实际是' +
      'hide 到托盘(webview 存活,React 状态不丢);真正退出走 tray.quit 的**原生立即退出**' +
      '(5637972f4:arm_forced_exit + app.exit(0),不再 emit 给前端)。属设计意图已过时的通知事件,' +
      '非功能断裂 —— 2026-09-27 更正:原文写的"退出走 desktop-quit-request 并由 guard 消费"已不成立,' +
      '那条链与守卫、遮罩同日一并移除',
  },
  {
    name: 'desktop-updater-pending',
    reason:
      '更新倒计时启动时的可选广播;主消费方(UpdatePrompt)直接消费 useUpdater 的返回值而非监听本事件' +
      '(见 use-updater.ts startRestartCountdown 注释)。属冗余通知,删除不影响既有行为',
  },
]
const CONSUMER_WHITELIST_SET = new Set(CONSUMER_WHITELIST.map((w) => w.name))

// ============================================================================
// 取材面(2026-09-26 收口)—— 清单与正文同面同轮,一律经 scripts/lib/face-reader.mjs
//
// 为什么必须整道换掉而不是只换新加的 G 组:守门 118 的判据锚在"本次改动动过的门",
// 而按磁盘判的门在共享工作区里会在"恒红"与"假绿"之间来回跳(工作树常年滞后 HEAD)。
// 本门读的是**三个目录 + 若干单点文件**(层1 的 .rs、层2/层3 的 web 源码),
// 只要还有一处 readFileSync(join(ROOT, …)),判定面就仍然部分跟着盘走。
//
// 覆盖面(与旧实现逐字同形,只是取材换了面):
//   目录  apps/desktop/src-tauri/src (.rs) / apps/web/src (.ts,.tsx)
//   单点  桥接端 + 两条链的消费端 + Rust 主进程 lib.rs(G 组要的那一份)
//   过滤  SKIP_DIRS 整段目录剔除 + .test/.spec 文件剔除 —— 旧 walk() 的同一条规矩
// ============================================================================

/** 递归收集时跳过的目录(构建产物 / 测试夹具 / Rust target),按**任一路径段**命中 */
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.next',
  '__tests__',
  '.turbo',
  'coverage',
  'target',
  'vendor',
])
/** 组件层测试文件不参与接线对账(它们随会被移动/改名,且不构成运行时链路) */
const TEST_FILE_RE = /\.(test|spec)\.[cm]?[jt]sx?$/

/** 目录扫描面 */
const RUST_SRC_DIR = 'apps/desktop/src-tauri/src'
const WEB_SRC_DIR = 'apps/web/src'
/**
 * 单点必读文件(仓库相对 posix 路径,**唯一一份名字**):桥接端(层2)+ 两条链各自的
 * 消费端(规则 E2/E3)+ Rust 主进程(规则 G)。下方 REPLAY_FILES / G_DEEP_LINK_* 一律
 * 引用这几个常量,不再抄第二遍字符串 —— 两处名字各写各的,改一处就会让判据看不见被审文件。
 */
const BRIDGE_REL = 'apps/web/src/hooks/use-desktop.ts'
const WEB_AGENT_CONTROL_REL = 'apps/web/src/hooks/use-agent-control.ts'
const EXT_AGENT_BRIDGE_REL = 'apps/extension/lib/agent-control-bridge.ts'
const RUST_LIB_REL = 'apps/desktop/src-tauri/src/lib.rs'
const SCAN_FILES = [BRIDGE_REL, WEB_AGENT_CONTROL_REL, EXT_AGENT_BRIDGE_REL, RUST_LIB_REL]

const GIT_LS_TIMEOUT = 60000

/**
 * 纯函数:argv → 判定面(默认 **head**)。导出并单列自检,是为了"默认不再是磁盘"这一格
 * 能被构造面证明,而不是等人跑一次真仓看结论行 —— 结论行会被人改,函数不会。
 */
export function faceFromArgv(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

const FACE_SEL = faceFromArgv(process.argv.slice(2))
const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
}

/** 磁盘面的递归收集:返回**仓库相对 posix 路径**(与 git 两面的输出同形) */
function walkRel(dirRel, exts, out = []) {
  const abs = path.join(ROOT, dirRel)
  if (!existsSync(abs)) return out
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walkRel(`${dirRel}/${entry.name}`, exts, out)
    } else if (exts.some((e) => entry.name.endsWith(e)) && !TEST_FILE_RE.test(entry.name)) {
      out.push(`${dirRel}/${entry.name}`)
    }
  }
  return out
}

/** 某个面上的路径清单(仓库相对 posix 路径)。git 两面与磁盘面同一条过滤,免得三面不同形。 */
function keepListed(p, exts) {
  if (TEST_FILE_RE.test(p)) return false
  const segs = p.split('/')
  if (segs.some((s) => SKIP_DIRS.has(s))) return false
  return exts.some((e) => p.endsWith(e))
}

/**
 * 单目录清单:HEAD 档 `ls-tree -r HEAD`、索引档 `ls-files`、磁盘档 walkRel。
 * 三条都只回答"哪些路径在这个面上",正文另一次批量读满 —— 但**同一个面**,
 * 否则就是"清单来自磁盘 + 内容来自 git"那把自洽却基准错位的尺子(守门 98 记过同型)。
 */
export function listFaceDir(repoRoot, face, dir, exts) {
  if (face === 'worktree') return walkRel(dir, exts).filter((p) => keepListed(p, exts))
  const rows =
    face === 'staged'
      ? gitRaw(['ls-files', '-z', '--', dir], repoRoot, { timeout: GIT_LS_TIMEOUT })
      : gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', dir], repoRoot, {
          timeout: GIT_LS_TIMEOUT,
        })
  return rows
    .split('\0')
    .filter(Boolean)
    .filter((p) => keepListed(p, exts))
}

/**
 * 一批路径的正文,一次 `cat-file --batch` 读满(磁盘面逐文件走 readWorktreeFile)。
 * 清单里有、正文取不到 ⇒ **抛 Undetermined**(调用方折成 exit 2 并点名路径):
 * 静默少扫一道文件正是一道假绿,而"少扫"在输出上和"没问题"长得一模一样。
 */
export function readFaceBlobs(repoRoot, face, relPaths) {
  const map = new Map()
  const paths = [...new Set(relPaths)]
  if (paths.length === 0) return map
  const missing = []
  if (face === 'worktree') {
    for (const p of paths) {
      const t = readWorktreeFile(repoRoot, p)
      if (t === null || t === undefined) missing.push(p)
      else map.set(p, t)
    }
  } else {
    const rev = face === 'staged' ? ':' : 'HEAD:'
    const specs = paths.map((p) => rev + p)
    const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 28 })
    paths.forEach((p, i) => {
      const t = got.get(specs[i])
      if (t === null || t === undefined) missing.push(p)
      else map.set(p, t)
    })
  }
  if (missing.length) {
    throw new Undetermined(
      `${FACE_TXT[face]} 列到了 ${missing.length} 个路径却取不到正文(前 5:${missing.slice(0, 5).join(', ')})`
    )
  }
  return map
}

/**
 * 建本轮唯一的取材面(清单 + 正文,**同一面同一轮**):返回
 * `{ contents:Map<仓库相对路径,文本>, rustFiles:[…], webFiles:[…] }`。
 * 清单为空(某面一个文件都没列出)⇒ 判死为"无法判定",不冒绿 —— 空扫正是本门要防的形态。
 * 单点文件**不在清单里**时不算失败:那是"文件被移动/改名"的正当红,旧实现也是这么报的
 * (errors.push "桥接端被移动/改名"),交给后面的判据去点名,免得把业务结论伪装成取材故障。
 */
export function buildFaceContents(repoRoot, face) {
  const dirSpecs = [
    { key: 'rust', dir: RUST_SRC_DIR, exts: ['.rs'] },
    { key: 'web', dir: WEB_SRC_DIR, exts: ['.ts', '.tsx'] },
  ]
  const files = {}
  const listed = []
  for (const { key, dir, exts } of dirSpecs) {
    const found = listFaceDir(repoRoot, face, dir, exts)
    if (found.length === 0)
      throw new Undetermined(`${FACE_TXT[face]} 在 ${dir} 下列出 0 个受管文件 ⇒ 覆盖面为空,不记为通过`)
    files[key] = found
    listed.push(...found)
  }
  files.web = files.web.filter((p) => p !== BRIDGE_REL)
  listed.push(...SCAN_FILES)
  return { contents: readFaceBlobs(repoRoot, face, listed), rustFiles: files.rust, webFiles: files.web }
}

/** 内容表 → 取文本;面上没有这个路径 ⇒ ''(交判据按"文件不存在/被改名"报红,与旧行为同形) */
function textOf(contents, relPath) {
  return contents.get(relPath) ?? ''
}


// ============================================================================
// 规则 E/F 的判据(纯函数)—— 两条链的语义分层 + Rust 进程的状态归属
//
// 为什么要在这里分命名(2026-09-25 立):本 gate 此前只核**实时链**的三层接线
// (Rust `.emit` → use-desktop.ts `listen` → 前端 `addEventListener`),而桌面端还有
// 第二条语义完全不同的链:api 的 `agent.action` 指令链 —— 它按 requestId 幂等去重,
// 断线重连后同一条指令可能再送达一次。前者是 **continuous**(掉线即丢,无 id 无队列),
// 后者是 **replayable**(至少一次,必须幂等)。两条链共用一个词"事件"却没有任何标记,
// 于是"改了 stream/snapshot/queue/重连"只需实时链绿就算验过 —— 本规则把这条空档钉住。
// 口径:**两条链本就分属不同通道**(Tauri 原生事件总线 vs WS + `_pending` 会合),
// 所以这里只补防回退断言,不改生产链路;但链名必须落进源码,否则下一个接手者仍会混用。
// ============================================================================

/** 链名的规范拼写(文档、注释、本判据一律用这两个词,不再写"实时事件/推送指令"等口径) */
const CHAIN_CONTINUOUS = 'continuous'
const CHAIN_REPLAYABLE = 'replayable'

/**
 * E1: 实时链必须保持"无 id、无队列"的本性。
 * 判据 = 桥接端文件(use-desktop.ts)里出现 requestId 形态的重放语义载体即红:
 * 一旦有人把去重/补发塞进这条链,它就悄悄变成了第二条 replayable 链,而它的投递面
 * (`webview.eval`/Tauri 事件总线)没有任何持久队列可为补发兜底 —— 那种"看起来更可靠"
 * 的实现恰恰是最危险的形态(失败不可见)。
 */
function findContinuousChainDrift(bridgeSource) {
  const hits = []
  const lines = bridgeSource.split('\n')
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    if (/\brequestId\b|processedIds|Set<string>\(\s*\)\s*;?\s*\/\/?\s*queue/i.test(line)) {
      hits.push(`L${i + 1}: ${trimmed.slice(0, 120)}`)
    }
  })
  return hits
}

/**
 * E2: 重放链必须保住幂等标记。
 * 判据 = 该端消费 `agent.action` 的文件里,既要有 requestId 去重集,也要真的查它。
 * 少任何一半即红:去掉重连后的重复指令会被执行两次(表单重复提交、剪贴板被覆写),
 * 而症状只在断网/重连时出现,日常测试完全看不到。
 */
function findReplayableIdempotencyLoss(source, label) {
  const problems = []
  if (!/requestId/.test(source)) problems.push(`${label}: 全文无 requestId —— 幂等键被摘走`)
  if (!/processedIds\s*\.\s*has\s*\(/.test(source))
    problems.push(`${label}: 无 processedIds.has(...) 查重 —— 重连后同一条令会执行两次`)
  return problems
}

/** E3: 链名必须在源码里可 grep 到(命名是制度件,只写在文档里等于没命名)。 */
function findChainNameMarker(source, chainName, label) {
  const re = new RegExp(`chain:\\s*${chainName}\\b`)
  return re.test(source) ? [] : [`${label}: 缺少 \`chain: ${chainName}\` 标记`]
}

/**
 * F: Rust 主进程不得持有 task/session 业务状态(2026-09-25 立)。
 * 判据 = 进程级状态声明(static / static mut,含 LazyLock/OnceLock/Mutex 形态)的标识符或类型里
 * 出现业务状态名词即红,**零容忍、不设清单豁免** —— 豁免清单会腐烂(本仓对 RN_ONLY_BRAND_KEYS 已记过一次),
 * 而界面 chrome 状态(窗口几何、托盘节流)天然不含这些名词,不需要清单也能过。
 * 真要保留一个带业务名词的常量,唯一出口是行内 `rust-state-exempt: <原因>`(须带原因)。
 * 立据:桌面是薄壳,业务状态的唯一所有者是 web 前端 + 服务端;Rust 一旦存下 task/session,
 * 更新/重启即丢,且两条链谁是真相源再也问不出来 —— 正是本规则要防的形态。
 */
const RUST_BUSINESS_STATE_NOUNS =
  /\b(task|session|conversation|chat|message|turn|prompt|thread|goal|agent|todos?)\b/i
/** 标识符按 `_` 切成词元再比名词 —— `\bsession\b` 匹配不到 `SESSION_QUEUE`(下划线是词字符)。 */
const BUSINESS_NOUN_TOKENS = ['task', 'session', 'conversation', 'chat', 'message', 'turn', 'prompt', 'thread', 'goal', 'agent', 'todo', 'todos']

function rustStateNounHit(name, typeText) {
  const tokens = name
    .split(/[_\s]+/)
    .map((t) => t.toLowerCase())
    .filter(Boolean)
  const inName = BUSINESS_NOUN_TOKENS.find((noun) => tokens.includes(noun))
  if (inName) return inName
  const m = RUST_BUSINESS_STATE_NOUNS.exec(typeText)
  return m ? m[1] : null
}

function findRustStateViolations(source, file) {
  const violations = []
  const lines = source.split('\n')
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//')) return
    const decl = /^(?:pub\s+)?static(?:\s+mut)?\s+([A-Z_][A-Z0-9_]*)\s*:\s*(.+)$/.exec(trimmed)
    if (!decl) return
    const name = decl[1]
    const typeText = decl[2]
    if (/rust-state-exempt:/.test(line) || /rust-state-exempt:/.test(lines[i - 1] ?? '')) return
    const noun = rustStateNounHit(name, typeText)
    if (!noun) return
    violations.push(
      `${file}:${i + 1} Rust 进程级状态 \`${name}\`(${typeText.trim().slice(0, 60)})持有业务名词 ` +
        `"${noun}" —— task/session 业务状态的唯一所有者是 web 前端与服务端,Rust 主进程只承载窗口/托盘/IPC`,
    )
  })
  return violations
}

/** F 的自失效防护:Rust 里一个进程级状态都没扫到,先怀疑正则而不是相信世界干净。 */
function countRustStateDecls(source) {
  let n = 0
  for (const line of source.split('\n')) {
    if (/^\s*\/\//.test(line)) continue
    if (/^(?:pub\s+)?static(?:\s+mut)?\s+[A-Z_][A-Z0-9_]*\s*:/.test(line.trim())) n++
  }
  return n
}

// ============================================================================
// 规则 G: 深链「未就绪不丢,就绪后补投」机制对账(2026-09-26 立 · A10C-1)
//
// 为什么规则 A–D 看不见这一路:层 1 的正则只认 **payload 为字符串字面量或 `()`** 的 emit,
// 而深链的 payload 是 URL 变量(`emit(DEEP_LINK_EVENT, &url)`)⇒ 结构上永不命中,
// 于是 `desktop-deep-link` 这条承载 SSO 登录码的链路在三层对账里是隐形的
// (实测 `grep -c desktop-deep-link` 本门 = 0)。一条门只管自己立项那一型,就是这一型的洞
// (与守门 102 立项时"字符集只有右向箭头"同一条教训)。
//
// 这里登记的是**机制**而不是事件名:投递出口的唯一性、未就绪必入队、上限与丢弃计数、
// 取即清的幂等来源、销毁清账、以及"注册监听在前、取回积压在后"的时序。
// 判据全部是静态源码判据(提交者可满足),不判机器态 ⇒ 可以作为 blocking。
// ============================================================================

const G_DEEP_LINK_EVENT = 'desktop-deep-link'
const G_DEEP_LINK_TAKE_COMMAND = 'take_pending_deep_links'
/** 路径名**只有一处**(上方 SCAN_FILES 的取材面就用它),此处只做别名供文案使用 */
const G_DEEP_LINK_RUST_FILE = RUST_LIB_REL
const G_DEEP_LINK_BRIDGE_FILE = BRIDGE_REL
/** G8 的被审面:整页导航的发起处(热刷新 / 离线切换都从这里走) */
const G_DEEP_LINK_NAV_FILE = 'apps/desktop/src-tauri/src/auto_refresh.rs'

// ============================================================================
// 整页导航发起点的**唯一一份**枚举实现(G8 与 G9 共用)
//
// 为什么必须共用而不是各写一遍:形态集合一旦分叉,"G8 看见而 G9 看不见"(或反过来)就成了
// 常态 —— 与守门 102 的 GA1/GA4 共用同一遍遍历是同一条禁令。G9 是**反向依赖** G8 的这一份
// 枚举与它的"找不到发起点即失明"护栏,而不是把那条护栏复制一份(复制出来的第二份护栏
// 永远不会与被审面同步,见本门镜像测试的形状锁)。
// ============================================================================

/** 渲染端整页导航的四种写法(赋值式与调用式);`href ===` 这类比较刻意不纳 */
const PAGE_NAV_LOCATION_RE = /\blocation\s*\.\s*(?:href\s*=(?!=)|reload\s*\(|assign\s*\(|replace\s*\()/
/** Rust 侧注入器:导航载荷在 `.eval(` 的字符串参数里 ⇒ 必须与 location 形态同行 */
const PAGE_NAV_EVAL_CARRIER_RE = /\.eval\s*\(/
/** Tauri 侧直接调用的重载/导航 API —— **只在 .rs 上判**:web 端 `store.navigate(url)` 是业务方法,不是页面导航 */
const PAGE_NAV_RUST_API_RE = /\b(?:webview|webview_window|window|w)\s*\.\s*(?:reload|navigate)\s*\(/

/**
 * 枚举"整页导航发起点"。入参必须是**已遮噪**(blankComments)的文本。
 * @param {string} maskedText
 * @param {{rust?: boolean}} opts  rust=true 时认 Tauri API 形态,并要求 eval 载荷同行
 * @returns {{line:number, text:string}[]} 行号 1 基
 */
export function collectPageNavSites(maskedText, { rust = false } = {}) {
  const hits = []
  String(maskedText)
    .split(/\r?\n/)
    .forEach((l, i) => {
      const byLocation = PAGE_NAV_LOCATION_RE.test(l)
      const isSite = rust
        ? (PAGE_NAV_EVAL_CARRIER_RE.test(l) && byLocation) || PAGE_NAV_RUST_API_RE.test(l)
        : byLocation
      if (isSite) hits.push({ line: i + 1, text: l.trim() })
    })
  return hits
}

// ---- 规则 G9:发起点 ⇒ 同文件必须有"触发存草稿"的出口 ----------------------
//
// 立因(G-407 票①,2026-09-29):`apps/desktop/src-tauri/src/lib.rs` 的 CloseRequested 分支
// **无条件** emit `desktop-before-close`(注释原文:"三种去向都照发…先存草稿")。但
// `auto_refresh.rs` 的 5 处 `eval("location.reload()" / "location.href=…")` 是**宿主直接把
// 渲染端掀了** —— 那条 emit 一次都不会发生,用户正在编辑的草稿随页面一起没了,而窗口本来
// 就在关闭路径上,现象读起来是"关掉重开草稿没了",极难归因到热刷新。
// 判据只问一句话:**这个文件里既然有整页导航发起点,它有没有触发存草稿的出口?**
//
// 出口形态按现读的 desktop-before-close 实现链定(.emit / dispatchEvent(new CustomEvent) /
// invoke 命令),并额外接受"具名草稿落盘函数"(flush/persist/save …Draft) —— 现仓**尚无**
// 该具名函数(git grep `flush.*Draft` = 0),列进认法是为了修复落地时不必再改判据,
// 而不是替一条已存在的能力背书。
const PAGE_NAV_FLUSH_EXIT_RE =
  /(?:\.emit(?:_to|_filter)?\s*\([^)]{0,80}["']desktop-before-close|dispatchEvent\s*\(\s*new\s+CustomEvent\s*\(\s*["']desktop-before-close|invoke\s*(?:<[^>]*>)?\s*\(\s*["'][^"']*(?:flush|draft)[^"']*["']|(?:window\s*\.\s*)?\b(?:flush|persist|save)[A-Za-z0-9_]*[Dd]raft[A-Za-z0-9_]*\s*\()/i

/** G9 的人工出口:逐行生效,且必须带原因(裸标记不救 —— 与守门 102/83 同一条口径) */
const PAGE_NAV_EXEMPT_RE = /page-nav-exempt:\s*(\S.*)/
/** 什么不算"原因":剥掉注释闭合符与标点后必须还剩词字符(含中文)。 */
const NOT_A_REASON_RE = /[\s*/})\]>$#.,;:、，。；：!\-]+/g

/**
 * 一个文件 = 发起点数、出口在位与否、逐行豁免命中数。纯函数,不碰文件系统。
 * @param {string} rel 仓库相对路径(只为文案)
 * @param {string} maskedText 遮噪后的被审文本
 * @param {string} rawText 原文(豁免标记住在注释里,必须看原文)
 */
export function auditPageNavExit(rel, maskedText, rawText) {
  const rust = /\.rs$/.test(rel)
  const sites = collectPageNavSites(maskedText, { rust })
  const maskedLines = String(maskedText).split(/\r?\n/)
  const rawLines = String(rawText).split(/\r?\n/)
  const hasExit = PAGE_NAV_FLUSH_EXIT_RE.test(String(maskedText))
  // 逐行豁免:命中行或其紧邻上一行写了带原因的标记 ⇒ 该发起点不计缺口
  const exempt = sites.filter((s) => {
    for (const idx of [s.line - 1, s.line - 2]) {
      const m = (rawLines[idx] ?? '').match(PAGE_NAV_EXEMPT_RE)
      if (m && /[\w一-鿿]/.test((m[1] ?? '').replace(NOT_A_REASON_RE, ''))) return true
    }
    return false
  })
  const counted = sites.filter((s) => !exempt.includes(s))
  return {
    rel,
    sites: sites.length,
    exempted: exempt.length,
    gaps: hasExit ? 0 : counted.length,
    counted,
    // **判据盲区探针**:有 eval 注入器、同行却读不出导航载荷形态的行(跨行 concat!、
    // 变量拼串那一类)。按行扫的判据在这里结构上看不见,所以必须**报名**而不是静默算 0 ——
    // 只报数等于把这一格永久锁死(守门 128 配对名单"报名不得只报数"同一条)。
    probes: maskedLines
      .map((l, i) => (PAGE_NAV_EVAL_CARRIER_RE.test(l) && !PAGE_NAV_LOCATION_RE.test(l) ? i + 1 : 0))
      .filter((n) => n > 0),
  }
}

/**
 * G9 的两侧切分。**宿主面(.rs)判红;渲染面(.ts/.tsx)逐文件报名、不进判据。**
 * 这不是为变绿收窄,而是被审的那条闸住在哪一侧决定的:`desktop-before-close` 由 Rust 在
 * `CloseRequested` 上 emit(lib.rs:2766),所以"绕过了它"只可能发生在**宿主发起**的整页导航上;
 * 渲染端的 `window.location.reload()` 没有那道闸可绕。而实测更硬的一条:该 CustomEvent
 * **当前零消费方**(本门规则 C 的白名单里就记着这事,`git grep "flush.*Draft"` = 0),
 * 于是把渲染面判红等于要求 `location.href = '/login'`(注销跳转,本来没草稿)去派发一个
 * 没人接的事件 —— 产出只会是空操作或伪造豁免,两样本仓都记过账。
 * 要纳管渲染面,前置是**先立一个真消费方**,那是 web 端持有人的职权(§24),不是这道门能顺手判的;
 * 前置未满足期间,两侧计数都必须打印出来 —— 覆盖面边界要报名,不得只报数(守门 128 同一条)。
 * @returns {'host'|'renderer'}
 */
export function pageNavScopeOf(rel) {
  return /\.rs$/.test(rel) ? 'host' : 'renderer'
}

/**
 * 缺口是否算"这次带进来的新账"。**锚点 = 该文件在 HEAD 自身的缺口数**,
 * 所以全量档(判 HEAD)天然 anchors==judged ⇒ 存量只报数不判红(§12e:恒红门的唯一结局是
 * 各会话跳钩子、连带约 185 道门对该提交作废)。
 * 两种"缺席"必须分开,不得并桶:
 *  - 锚点**显式为 0**(该文件不在 HEAD ⇒ 本次新增文件)⇒ 每条缺口都是新账,判红;
 *  - 锚点**根本没给**(HEAD 面上有这条路径却取不到正文 = 未判定)⇒ 落 `unanchored` 只报名。
 *    **不得**把 0 当锚点顶缸 —— 那等于把"没判"写成"这次新增了 N 条",一次假红就把整条提交链
 *    变成跳门理由(与本仓"把没判写成判过了"是同一条禁令的两个方向,两边都禁)。
 * @returns {{reds:Array, unanchored:string[]}}
 */
export function decidePageNavReds(judged, anchors) {
  const reds = []
  const unanchored = []
  for (const info of judged) {
    if (info.gaps === 0) continue
    if (!anchors.has(info.rel)) {
      unanchored.push(info.rel)
      continue
    }
    const anchor = anchors.get(info.rel)
    if (info.gaps > anchor) reds.push({ ...info, anchor, added: info.gaps - anchor })
  }
  return { reds, unanchored }
}

/** 取 `app.deep_link().on_open_url({ ... })` 那个闭包的整体文本(花括号配平,失败返回 null)。 */
function extractOnOpenUrlBody(rustText) {
  const at = rustText.indexOf('.on_open_url(')
  if (at < 0) return null
  const braceStart = rustText.indexOf('{', at)
  if (braceStart < 0) return null
  let depth = 0
  for (let i = braceStart; i < rustText.length; i++) {
    const ch = rustText[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return rustText.slice(braceStart, i + 1)
    }
  }
  return null
}

/** 取某个 `fn 名字` 的函数体(到下一个顶层 `fn `/`mod ` 之前的粗粒度切片,够本判据用)。 */
function extractRustFn(rustText, fnName) {
  const at = rustText.indexOf(`fn ${fnName}(`)
  if (at < 0) return null
  const braceStart = rustText.indexOf('{', at)
  if (braceStart < 0) return null
  let depth = 0
  for (let i = braceStart; i < rustText.length; i++) {
    const ch = rustText[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return rustText.slice(at, i + 1)
    }
  }
  return null
}

/** 桥接端深链那一段:从它自己的 listen( 起,到下一个 listen( 或文件末 */
function extractBridgeDeepLinkBlock(bridgeText) {
  const re = /listen(?:<[^>]*>)?\(\s*'([a-z][a-z0-9-]*)'/g
  const positions = [...bridgeText.matchAll(re)]
  const idx = positions.findIndex((m) => m[1] === G_DEEP_LINK_EVENT)
  if (idx < 0) return null
  const start = positions[idx].index
  const end = idx + 1 < positions.length ? positions[idx + 1].index : bridgeText.length
  return bridgeText.slice(start, end)
}

/**
 * 索引保真的"注释抹白":把 // 与 /\* *\// 注释替换成空格(长度不变 ⇒ 下标仍可比)。
 * 为什么必须先抹再比:**顺序判据拿到的下标如果包含注释,就会被文档里那句
 * "先 listen 后 take"读成"代码真的先 listen 后 take"**(或反过来)—— 本仓对"字面量尺子
 * 量到自己的解释文字"已记过多次,这条是同一型。字符串字面量整体保留(判据要看其中的名字)。
 *
 * `apostropheIsStringDelimiter`:TS 侧单引号是字符串定界符,必须认;Rust 侧**绝不能认** ——
 * `MutexGuard<'static, …>` 的撇号会被当成开引号,把后面几百行吞进"字符串"里,判据于是对
 * 那一大片完全失明(假绿)。Rust 只按双引号划字符串,字符字面量里的 `//` 属可忽略的边角。
 */
function blankComments(text, { apostropheIsStringDelimiter = true } = {}) {
  const stringDelims = apostropheIsStringDelimiter ? new Set(['"', "'", '`']) : new Set(['"', '`'])
  const out = []
  const n = text.length
  let i = 0
  while (i < n) {
    const ch = text[i]
    if (ch === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') {
        out.push(' ')
        i++
      }
      continue
    }
    if (ch === '/' && text[i + 1] === '*') {
      out.push(' ', ' ')
      i += 2
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) {
        out.push(text[i] === '\n' ? '\n' : ' ')
        i++
      }
      out.push(' ', ' ')
      i += 2
      continue
    }
    if (stringDelims.has(ch)) {
      out.push(ch)
      i++
      while (i < n) {
        if (text[i] === '\\') {
          out.push(text[i], text[i + 1] ?? ' ')
          i += 2
          continue
        }
        out.push(text[i])
        if (text[i] === ch) {
          i++
          break
        }
        i++
      }
      continue
    }
    out.push(ch)
    i++
  }
  return out.join('')
}

/**
 * 深链机制判据主体(纯函数,`--self-test` 直接喂夹具字符串)。
 * 返回 violations 字符串数组 —— 空数组 = 机制在位。
 */
function auditDeepLinkMechanism(rawRust, rawBridge, rawNav) {
  const rustText = blankComments(rawRust ?? '', { apostropheIsStringDelimiter: false })
  const bridgeText = blankComments(rawBridge ?? '', { apostropheIsStringDelimiter: true })
  const navGiven = typeof rawNav === 'string'
  const navText = blankComments(rawNav ?? '', { apostropheIsStringDelimiter: false })
  const violations = []
  const say = (msg) => violations.push(msg)

  // G1 —— 投递出口唯一:on_open_url 闭包只允许把整批 URL 交给唯一入口,不得自己 emit
  const body = extractOnOpenUrlBody(rustText)
  if (body === null) {
    say(`G1 ${G_DEEP_LINK_RUST_FILE} 里找不到 .on_open_url( 注册点 —— 深链能力被摘线`)
  } else {
    if (!/dispatch_deep_links\s*\(/.test(body))
      say('G1 on_open_url 回调未调用唯一投递入口 dispatch_deep_links( ⇒ 投递逻辑又回到"就地 emit"的老形态')
    if (/urls\(\)\s*\.\s*first\(\)/.test(body) || /urls\(\)\.first\(\)/.test(body))
      say('G1 on_open_url 回调里重新出现 urls().first() —— 一批多条时第 2 条起静默丢弃')
    if (/\.emit\s*\(/.test(body))
      say('G1 on_open_url 回调体内不得直接 emit:未就绪的判定与暂存必须在唯一入口里发生,否则又是"发了就当送达"')
  }

  // G2 —— 未就绪 ⇒ 入队(纯函数分支形态);判据即"false 分支产出 Queue"
  const decide = extractRustFn(rustText, 'decide_deep_link_deliveries')
  if (decide === null) {
    say(`G2 找不到 decide_deep_link_deliveries —— 去向判定被内联回调用处,变异对照就再也跑不动了`)
  } else if (!/DeepLinkDelivery::Queue/.test(decide) || !/DeepLinkDelivery::Emit/.test(decide)) {
    say('G2 decide_deep_link_deliveries 两个出口不齐(Emit/Queue)—— 少一个出口就意味着某一种状态下 URL 没有去向')
  }
  if (!/enum\s+DeepLinkDelivery\b/.test(rustText)) say('G2 DeepLinkDelivery 枚举被摘走')

  // G3 —— 队列有上限、去重、溢出必须计数(静默变短 = 伪造完整性)
  const push = extractRustFn(rustText, 'push')
  if (!/const\s+DEEP_LINK_PENDING_CAP\s*:/.test(rustText))
    say('G3 pending 队列上限常量 DEEP_LINK_PENDING_CAP 不见了 ⇒ 队列退化成无界累积')
  if (push === null || !/self\.dropped\s*\+=\s*1/.test(push))
    say('G3 入队函数里没有丢弃计数(self.dropped += 1)—— 溢出丢东西必须能被发现')
  if (push === null || !/log::warn!/.test(push))
    say('G3 丢弃路径没有 warn 日志(§5e「失败必须响」同一条禁令)')

  // G4 —— 取即清(幂等的唯一来源)+ 就绪标记 + 按 label 绑定
  const takeAll = extractRustFn(rustText, 'take_all')
  if (!takeAll || !/mem::take|drain/.test(takeAll))
    say('G4 take_all 不再清空队列 —— 取即清是"同一个 sso_code 只换一次 token"的唯一保证')
  const takeCmd = extractRustFn(rustText, G_DEEP_LINK_TAKE_COMMAND)
  if (!takeCmd) say(`G4 命令 ${G_DEEP_LINK_TAKE_COMMAND} 不见了(前端就绪后无处可取)`)
  else {
    // "置就绪"允许被**提成交给同文件的一个 helper**(实测:导航复位那票把 `target_ready = true`
    // 与"首次 take"的判定一起收进 `apply_take_ready`)。只认命令体内字面量 ⇒ 门对它自己
    // 产出的形态失明(§4 圆角门同型教训)。允许一跳,但必须真在命令体里被调用。
    const setsReady = (body) => /target_ready\s*=\s*true/.test(body)
    const helperNames = [...takeCmd.matchAll(/\b([a-z][a-z0-9_]*)\s*\(/g)].map((m) => m[1])
    const readyViaHelper = helperNames.some((n) => setsReady(extractRustFn(rustText, n) ?? ''))
    if (!setsReady(takeCmd) && !readyViaHelper)
      say('G4 取回积压时未把闸门置为已就绪(命令体内无 `target_ready = true`,其调用链里也没有) ⇒ 此后每条深链都只会堆进队列,永不直投')
    if (!/label\(\)/.test(takeCmd))
      say('G4 取回命令不再按窗口 label 绑定 ⇒ 别的窗口(admin)可以把 main 的登录码取走(串号)')
  }
  if (
    !new RegExp(`generate_handler!\\[[\\s\\S]*?${G_DEEP_LINK_TAKE_COMMAND}`).test(rustText)
  )
    say(`G4 ${G_DEEP_LINK_TAKE_COMMAND} 未注册进 invoke_handler —— 命令存在但前端调不到`)

  // G5 —— 销毁清账:不得留跨会话残留
  const resetFn = extractRustFn(rustText, 'reset_deep_link_gate_on_destroy')
  if (!resetFn) say('G5 窗口销毁的清账出口被摘走 —— 积压的登录码会活到下一次冷启动')
  else if ((rustText.match(/reset_deep_link_gate_on_destroy\s*\(/g) ?? []).length < 2)
    say('G5 清账函数在位但无人调用 —— 判据必须挂在 WindowEvent::Destroyed 分支上')

  // G6 —— 桥接端时序:先注册监听、后取回积压;补投走同一条处理链
  const block = extractBridgeDeepLinkBlock(bridgeText)
  if (block === null) {
    say(`G6 ${G_DEEP_LINK_BRIDGE_FILE} 里没有 listen('${G_DEEP_LINK_EVENT}') —— 深链无人接收`)
  } else {
    // 顺序判据比的是**调用点**:桥接端可以把命令名提成常量(声明行必然在文件靠前处),
    // 拿裸字面量的首个出现当调用点会把"声明"读成"调用",顺序结论整个反掉。
    const listenAt = bridgeText.search(/listen(?:<[^>]*>)?\(\s*'desktop-deep-link'/)
    const takeCallRe = new RegExp(
      `invoke(?:<[^>]*>)?\\(\\s*(?:'${G_DEEP_LINK_TAKE_COMMAND}'|DEEP_LINK_TAKE_COMMAND\\b)`,
    )
    const invokeAt = bridgeText.search(takeCallRe)
    if (invokeAt < 0)
      say(`G6 桥接端注册完监听后未取回积压(缺 invoke(${G_DEEP_LINK_TAKE_COMMAND}…))—— 冷启动的登录码仍会留在队列里`)
    else if (invokeAt < listenAt)
      say('G6 取回积压排在 listen() 之前 —— 先取后订阅等于把补投投给还不存在的监听')
    if (/new\s+Set[<(]/.test(block))
      say('G6 桥接端自建去重集合 —— 幂等必须来自 Rust 侧「取即清」,在前端补队列就是把实时链改造成隐形重放链(同规则 E1)')
    if (!/if\s*\(ok\)\s*\{[\s\S]{0,160}new CustomEvent\(\s*'desktop-sso-success'/.test(block))
      say("G6 desktop-sso-success 不再受「处理真成功」条件保护(失败也广播成功 = 用户看到已登录而实际未登录)")
    if (!/deliverDeepLinkUrl\s*\(/.test(block))
      say('G6 深链块内找不到统一处理链 deliverDeepLinkUrl( ⇒ 实时事件与补投各走各的,幂等与告警只能漏一半')
  }
  // G7 —— 事件名/命令名三处同形(字面量对账,改名必须同时改三处)
  if (!new RegExp(`const\\s+DEEP_LINK_EVENT\\s*:\\s*&str\\s*=\\s*"${G_DEEP_LINK_EVENT}"`).test(rustText))
    say(`G7 Rust 侧事件名常量不再是 "${G_DEEP_LINK_EVENT}" —— 与桥接端 listen 的名字已分叉`)
  if (!new RegExp(`const\\s+DEEP_LINK_TAKE_COMMAND\\s*:\\s*&str\\s*=\\s*"${G_DEEP_LINK_TAKE_COMMAND}"`).test(rustText))
    say(`G7 Rust 侧命令名常量不再是 "${G_DEEP_LINK_TAKE_COMMAND}" —— 与桥接端 invoke 的名字已分叉`)
  if (!bridgeText.includes(`'${G_DEEP_LINK_TAKE_COMMAND}'`))
    say(`G7 桥接端不再以字面量出现命令名 "${G_DEEP_LINK_TAKE_COMMAND}" —— 名字只写在 Rust 侧就是两边分叉`)

  // G8 —— 整页导航发起处必须先复位闸门(2026-09-26 A10C-2:重载期间渲染进程不存在,
  // 而"曾经就绪"若是永久布尔,那条深链会被直投给一个已不存在的 webview 而静默消失)
  //
  // 发起点由 `collectPageNavSites`(本文件唯一一份枚举)给出。旧写法是这里内联一条
  // `/\.eval\(/ && /location\.(href\s*=|reload\(\))/` —— 它只认 eval 注入形态,于是
  // `webview.reload()` 这类 Tauri 原生重载**对 G8 全盲**(与守门 102 立项时"字符集只有右向
  // 箭头"同一条教训)。扩展到 `rust:true` 是**收紧**判据面,不是放宽颜色:被复位的站更多了,
  // 而"每个发起点都必须先复位"这条要求一个字没改。
  if (navGiven) {
    const navLines = navText.split(/\r?\n/)
    const navSites = collectPageNavSites(navText, { rust: true })
    for (const s of navSites) {
      const win = navLines.slice(Math.max(0, s.line - 1 - 8), s.line)
      if (!win.some((w) => w.includes('reset_deep_link_gate_for_navigation')))
        say(
          `G8 ${G_DEEP_LINK_NAV_FILE} 第 ${s.line} 行发起整页导航而未先复位深链闸门 ⇒ 重载期间抵达的链接会被直投丢失: ${s.text.slice(0, 90)}`,
        )
    }
    // 这条"找不到发起点 ⇒ 失明"的护栏是本文件唯一一份;规则 G9 反向依赖它,不得复制第二份
    // (护栏一复制,两处就会与取材面各漂各的 —— 镜像测试 T9 钉住这条形状)。
    if (navSites.length === 0)
      say(
        `G8 在 ${G_DEEP_LINK_NAV_FILE} 里找不到任何整页导航发起点 —— 判据已对该文件失明(不是"没有违规")`,
      )
  } else {
    say(`G8 未取到 ${G_DEEP_LINK_NAV_FILE} 内容 ⇒ 导航期复位这条判据本轮未判定(不记为通过)`)
  }

  return violations
}

// ============================================================================
// 规则 H: 托盘菜单项「去向」对账(2026-09-27 立,随 5637972f4c 的写法变更同步扫描器)
//
// 为什么必须加这一维而不是把阈值 8 调成 7:层1 的 emit 计数是唯一替"托盘点着没反应"兜底的
// 数字闸,而它只认 `emit("desktop-tray-action", "<字面量>")` 这一种写法。tray.quit 改成 Rust
// 原生退出后不再 emit —— 于是计数掉了 1,而**没有任何一处代码变坏**。这种时刻只有两个出路:
// 要么让判据认下新写法(H),要么把数字调小(= 给一台安全尺子发通行证,AGENTS §12f 明令禁止)。
// H 做的正是"跟随代码":它问的不是"有没有 emit",而是"这一项按下去之后,事情到底有没有人做"。
//
// 三条判据,全部静态可判(提交者能满足 ⇒ 可以 blocking):
//   H1 注册点与分发点都在位(一个托盘项都扫不到 = 判据失明,不是"没有违规")
//   H2 菜单项 ↔ on_menu_event 分支双向同形(注册了没分支 = 点了静默;有分支没这项 = 菜单与分发分叉)
//   H3 每个分支必须有可识别去向:emit 到 desktop-tray-action(且该 action 必须真被层1 抓到,
//      否则这一路在三层对账里隐形)或原生效果调用(show/hide/set_focus/exit 一族)
// 判据面**先剥注释**(复用 blankComments 那一份实现,Rust 侧不认单引号定界):lib.rs 的 quit 分支
// 里就写着「原设计是 emit 给前端 → 前端查更新」,拿原文判去向等于让解释文字给自己发合格证
// (本仓 §22c / 守门 70 / 守门 131 同型,已记过多次)。
//
// 2026-09-28 同型再补(本票):5637972f4c 之后菜单构建又从"手列 7 个 builder"改成**表驱动**
// (`MenuItemBuilder::with_id(format!("tray.{}", item.id), …)`,id 清单唯一登记在
// desktop_prefs.rs 的 `TRAY_MENU_ITEMS`),而 quit 的去向从 `app.exit(0)` 提成了
// `exit_application(app)`(仓内唯一退出序列)。两个后果都是"功能没坏、判据瞎了":
// 字面量正则扫不到任何菜单项 ⇒ H1 报失明 + H2 把 7 条真分支全判成孤儿;原生族认不出
// exit_application ⇒ H3 把真退出的分支判成"没反应"。修法与 H 立项时同一条:**扩覆盖面,
// 不削判据** —— id 清单从被审面的登记表**现读**(不在门里抄第二份名单,守门 131 现读注册表
// 同取向),原生族加 exit_application。反向对照由 --self-test 钉死:删掉 quit 分支仍必须红。
// ============================================================================

const TRAY_ACTION_EVENT = 'desktop-tray-action'

/** 托盘项注册点·旧字面量形态:`MenuItemBuilder::with_id("tray.<id>", …)` */
const TRAY_ITEM_ID_RE = /MenuItemBuilder::with_id\(\s*"tray\.([a-z_]+)"/g
/**
 * 托盘项注册点·表驱动形态(2026-09-28 起的真形态):
 * `MenuItemBuilder::with_id(format!("tray.{}", item.id), …)` —— id 不再以字面量出现,
 * 清单唯一来源是 desktop_prefs.rs 的 TRAY_MENU_ITEMS 登记表(下方现读,不在本门抄第二份)。
 */
const TRAY_ITEM_ID_FORMAT_RE = /MenuItemBuilder::with_id\(\s*format!\(\s*"tray\.\{\}"/
/** 托盘登记表所在文件(RUST_SRC_DIR 内的清单本就会列出它;此处只点名,供判据取文) */
const RUST_DESKTOP_PREFS_REL = 'apps/desktop/src-tauri/src/desktop_prefs.rs'
/** 分支体内把活儿交给前端的形态(与层1 同形:action 必须是字符串字面量) */
const TRAY_ARM_EMIT_RE = new RegExp(`"${TRAY_ACTION_EVENT}"\\s*,\\s*"([a-z_]+)"`, 'g')
/**
 * 原生去向:Rust 自己把活儿干完的可识别效果。
 * 刻意**不含** `.close()` / `.destroy()` —— 那只是"窗口没了",不是"该菜单项的语义被执行了";
 * 把它们当去向,会让"退出分支被清空只剩关窗"蒙混过关(正是本判据要防的那一型)。
 * `exit_application(` 于 2026-09-28 加入:它是 lib.rs:322 自述的「真正终止进程的**唯一**序列」
 * (quit_app / tray.quit / 关窗决策共用),与旧的 `app.exit(0)` 同语义 —— 只是被提成函数,
 * 判据不认它就是把门自己的立项形态(原生立即退出)判成违规。
 */
const TRAY_ARM_NATIVE_RE =
  /\.(?:show|hide|set_focus|minimize|maximize|unminimize)\s*\(\s*\)|\bapp\s*\.\s*exit\s*\(|\barm_forced_exit\s*\(|\bexit_application\s*\(|\bstd\s*::\s*process\s*::\s*exit\s*\(/

/**
 * 从被审面现读托盘项登记表:`pub const TRAY_MENU_ITEMS: [TrayMenuItem; N] = [ … ]`。
 * 返回 `{ ids: string[], declared: number }`;任何一步解析不出(声明不见 / 括号配平失败 /
 * 实收条目数 ≠ 声明的 N)⇒ null,调用方必须把它读成**判据失明**而不是"没有菜单项"。
 * 数量对账是防"清单腐烂成第二份假账":改表忘改 `[; N]`(编译会红,但门不能等编译)。
 */
export function extractTrayRegistryItems(prefsText) {
  const raw = blankComments(prefsText ?? '', { apostropheIsStringDelimiter: false })
  const decl = /pub const TRAY_MENU_ITEMS\s*:\s*\[\s*TrayMenuItem\s*;\s*(\d+)\s*\]\s*=\s*\[/.exec(raw)
  if (!decl) return null
  const bracketStart = decl.index + decl[0].length - 1
  let depth = 0
  let end = -1
  for (let i = bracketStart; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end < 0) return null
  const body = raw.slice(bracketStart, end + 1)
  const ids = [...body.matchAll(/TrayMenuItem\s*\{\s*id:\s*"([a-z_]+)"/g)].map((m) => m[1])
  const declared = Number(decl[1])
  if (declared !== ids.length) return null
  return { ids, declared }
}

/** 取 `.on_menu_event(|app, event| match … { … })` 那个闭包的主体(花括号配平,失败 null)。 */
function extractOnMenuEventBody(rustText) {
  const at = rustText.indexOf('.on_menu_event(')
  if (at < 0) return null
  const braceStart = rustText.indexOf('{', at)
  if (braceStart < 0) return null
  let depth = 0
  for (let i = braceStart; i < rustText.length; i++) {
    const ch = rustText[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return rustText.slice(braceStart, i + 1)
    }
  }
  return null
}

/** 取分发体里所有 `"tray.<id>" => { … }` 分支(同名重复取第一处,配平失败则整段丢弃该项)。 */
function extractTrayArms(body) {
  const arms = new Map()
  const re = /"tray\.([a-z_]+)"\s*=>\s*\{/g
  let m
  while ((m = re.exec(body)) !== null) {
    const id = m[1]
    const braceStart = body.indexOf('{', m.index + m[0].length - 1)
    if (braceStart < 0) continue
    let depth = 0
    for (let i = braceStart; i < body.length; i++) {
      const ch = body[i]
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) {
          if (!arms.has(id)) arms.set(id, body.slice(braceStart, i + 1))
          re.lastIndex = i + 1
          break
        }
      }
    }
  }
  return arms
}

/**
 * 判据主体(纯函数,`--self-test` 直接喂夹具字符串)。
 * @param emittedActions 层1 已抓到的 desktop-tray-action action 集合;传 null 表示跳过 H3 的一致性交叉核对
 * @param registryText desktop_prefs.rs 在被审面上的正文(表驱动形态的 id 清单唯一来源);
 *                     字面量形态在场时不依赖它,表驱动形态解析不出 ⇒ 判"失明",不记通过
 * @returns {{items:Set<string>, arms:Map<string,string>, native:number, emitted:number,
 *            emitIds:string[], nativeIds:string[], violations:string[]}}
 */
function auditTrayItemDestinations(rawRust, emittedActions = null, registryText = null) {
  const rustText = blankComments(rawRust ?? '', { apostropheIsStringDelimiter: false })
  const violations = []
  const say = (msg) => violations.push(msg)
  // 菜单项 id 的两种真形态:
  //   旧 MenuItemBuilder::with_id("tray.<id>", …) ⇒ 字面量直接进集合;
  //   新 with_id(format!("tray.{}", item.id), …) ⇒ 清单从被审面的 TRAY_MENU_ITEMS 登记表现读。
  const items = new Set([...rustText.matchAll(TRAY_ITEM_ID_RE)].map((m) => m[1]))
  const tableDriven = TRAY_ITEM_ID_FORMAT_RE.test(rustText)
  if (tableDriven) {
    const registry = extractTrayRegistryItems(registryText ?? '')
    if (registry === null) {
      say(
        'H1 检出表驱动 MenuItemBuilder::with_id(format!("tray.{}", …)),但 TRAY_MENU_ITEMS 登记表' +
          `(${RUST_DESKTOP_PREFS_REL})解析不出或条目数与 [; N] 声明不符 ⇒ 判据失明(不得记为通过)` +
          ' —— 本门刻意不在自己源码里抄第二份 id 名单,清单漂了就必须喊,不能静默补',
      )
    } else {
      for (const id of registry.ids) items.add(id)
    }
  }
  const body = extractOnMenuEventBody(rustText)
  if (body === null) {
    say('H1 找不到 .on_menu_event( 注册点 —— 托盘菜单事件分发被摘线,所有菜单项都不再被看守')
    return { items, arms: new Map(), native: 0, emitted: 0, emitIds: [], nativeIds: [], violations }
  }
  const arms = extractTrayArms(body)
  // H1 空枚举判死:扫不到任何一项 ⇒ 先怀疑判据,而不是相信"托盘没有菜单"
  if (items.size === 0)
    say(
      'H1 一个托盘项都没扫到(字面量 with_id("tray.*") 与表驱动 format!("tray.{}", …) 两族均为空)' +
        ' ⇒ 判据对该文件失明(不得记为通过)',
    )
  if (arms.size === 0)
    say('H1 on_menu_event 体内找不到任何 "tray.*" => 分支 ⇒ 判据失明(不得记为通过)')

  let native = 0
  let emitted = 0
  /** 去向分类只在这里算一次;报告若另写一遍同一条判据,两处必然漂移 */
  const emitIds = []
  const nativeIds = []
  for (const id of items) {
    if (!arms.has(id))
      say(
        `H2 托盘项 "tray.${id}" 已注册进菜单,却没有 on_menu_event 分支 —— 点它静默无反应(与本门立项那一型同体)`,
      )
  }
  for (const id of arms.keys()) {
    if (!items.has(id))
      say(
        `H2 分支 "tray.${id}" 在菜单里找不到同名项 —— 菜单构建与事件分发已分叉(要么漏注册,要么留死分支)`,
      )
  }
  for (const [id, arm] of arms) {
    const actions = [...arm.matchAll(TRAY_ARM_EMIT_RE)].map((m) => m[1])
    if (actions.length > 0) {
      emitted++
      emitIds.push(id)
      for (const a of actions) {
        if (emittedActions && !emittedActions.has(a))
          say(
            `H3 分支 "tray.${id}" emit 的 action "${a}" 未被层1 抓到(多半是变量形态 payload)—— 这一路在三层对账里完全隐形`,
          )
      }
      continue
    }
    if (TRAY_ARM_NATIVE_RE.test(arm)) {
      native++
      nativeIds.push(id)
      continue
    }
    say(
      `H3 分支 "tray.${id}" 没有任何可识别去向:既不 emit 到 ${TRAY_ACTION_EVENT},也没有原生效果` +
        `(show/hide/set_focus/exit 一族)—— 用户点这一项就是"完全没反应"。注释里写着怎么做不算去向。`,
    )
  }
  return { items, arms, native, emitted, emitIds, nativeIds, violations }
}

// ---------------------------------------------------------------------------
// --self-test:用夹具证明 E/F/G 三组判据各自有牙(不是恰好绿)
// ---------------------------------------------------------------------------

function runSelfTest() {
  const cases = []
  const check = (label, got, expectEmpty) => {
    const bad = expectEmpty ? got.length !== 0 : got.length === 0
    cases.push(`${bad ? '✗' : '✓'} ${label}${got.length ? ' → ' + got.join(' | ').slice(0, 160) : ''}`)
    return !bad
  }
  let ok = true
  // E1 正/反
  ok =
    check(
      'E1 实时链出现 requestId 去重 ⇒ 判红',
      findContinuousChainDrift("const processedIds = new Set()\nif (req.requestId) processedIds.add(req.requestId)\n"),
      false,
    ) && ok
  ok =
    check(
      'E1 只 listen+dispatch 的实时链 ⇒ 放过',
      findContinuousChainDrift("const unlisten = await listen('desktop-tray-action', () => {})\n"),
      true,
    ) && ok
  // E2 正/反
  ok =
    check(
      'E2 幂等键被摘 ⇒ 判红',
      findReplayableIdempotencyLoss('void executeAction(req)\n', 'demo.ts'),
      false,
    ) && ok
  ok =
    check(
      'E2 保留 requestId + 查重 ⇒ 放过',
      findReplayableIdempotencyLoss(
        'if (processedIds.has(req.requestId)) return\nprocessedIds.add(req.requestId)\n',
        'demo.ts',
      ),
      true,
    ) && ok
  // E3 正/反
  ok =
    check(
      'E3 缺链名标记 ⇒ 判红',
      findChainNameMarker('export function useDesktopEvents() {}\n', CHAIN_CONTINUOUS, 'demo.ts'),
      false,
    ) && ok
  ok =
    check(
      'E3 有链名标记 ⇒ 放过',
      findChainNameMarker('// chain: continuous —— 实时链\n', CHAIN_CONTINUOUS, 'demo.ts'),
      true,
    ) && ok
  // F 正/反
  ok =
    check(
      'F Rust 持有 session 业务状态 ⇒ 判红',
      findRustStateViolations('static SESSION_QUEUE: LazyLock<Mutex<Vec<String>>> = x();\n', 'a.rs'),
      false,
    ) && ok
  ok =
    check(
      'F 注释里的同类标识符 ⇒ 不判(判据只看声明行)',
      findRustStateViolations('// static SESSION_QUEUE: 只是说明文字\n', 'a.rs'),
      true,
    ) && ok
  ok =
    check(
      'F 界面 chrome 状态(不含业务名词)⇒ 放过',
      findRustStateViolations(
        'static WINDOW_STATE_LAST_SAVE: LazyLock<Mutex<HashMap<String, Instant>>> = x();\n',
        'a.rs',
      ),
      true,
    ) && ok
  ok =
    check(
      'F 行内豁免带理由 ⇒ 放过(豁免面只能逐条点名,不能成清单)',
      findRustStateViolations(
        '// rust-state-exempt: 仅缓存托盘提示文案,非业务状态\nstatic AGENT_TRAY_TIP: &str = "x";\n',
        'a.rs',
      ),
      true,
    ) && ok
  ok =
    check(
      'F 声明计数不空转(有状态时必 >0)',
      countRustStateDecls('static WINDOW_STATE_LAST_SAVE: LazyLock<Mutex<u8>> = x();\n') === 1
        ? []
        : ['计数失效'],
      true,
    ) && ok

  // ---------------------------------------------------------------------------
  // G 组夹具:先造一份"机制齐备"的最小 Rust + 桥接端文本,再逐条变异证明每条判据有牙。
  // 注意:夹具不是规格抄写 —— 它的每个片段都对应 lib.rs / use-desktop.ts 里的真实出口,
  // 名字一改(如 take_all 不再清空)这里就必须跟着红,否则本组判据就是装饰。
  // ---------------------------------------------------------------------------
  const gRust = (mutate = (s) => s) =>
    mutate(`
const DEEP_LINK_EVENT: &str = "desktop-deep-link";
const DEEP_LINK_TAKE_COMMAND: &str = "take_pending_deep_links";
const DEEP_LINK_PENDING_CAP: usize = 8;
enum DeepLinkDelivery { Emit(String), Queue(String) }
fn decide_deep_link_deliveries(target_ready: bool, urls: &[String]) -> Vec<DeepLinkDelivery> {
    urls.iter().map(|url| if target_ready { DeepLinkDelivery::Emit(url.clone()) } else { DeepLinkDelivery::Queue(url.clone()) }).collect()
}
impl DeepLinkPending {
    fn push(&mut self, url: &str) -> bool {
        while self.urls.len() > DEEP_LINK_PENDING_CAP { self.dropped += 1; log::warn!("溢出丢弃"); }
        true
    }
    fn take_all(&mut self) -> Vec<String> { std::mem::take(&mut self.urls).into_iter().collect() }
}
fn take_pending_deep_links(window: tauri::WebviewWindow) -> Vec<String> {
    if window.label() != "main" { return Vec::new(); }
    gate.target_ready = true;
    gate.pending.take_all()
}
fn reset_deep_link_gate_on_destroy(label: &str) { gate.pending.clear(); }
fn dispatch_deep_links(app: &tauri::AppHandle, urls: &[String]) {
    match w.emit(DEEP_LINK_EVENT, &url) { Ok(_) => {} Err(e) => { log::warn!("emit 失败: {}", e); } }
}
pub fn run() {
    app.deep_link().on_open_url({
        let app = app.handle().clone();
        move |event| { let urls: Vec<String> = event.urls().iter().map(|u| u.as_str().to_string()).collect(); dispatch_deep_links(&app, &urls); }
    });
    .invoke_handler(tauri::generate_handler![get_app_info, take_pending_deep_links])
    reset_deep_link_gate_on_destroy(&label);
}
`)
  const gBridge = (mutate = (s) => s) =>
    mutate(`
unlistenDeepLink = await listen<string>('desktop-deep-link', (event) => { void deliverDeepLinkUrl(event.payload) })
const backlog = await invoke<string[]>('take_pending_deep_links')
for (const url of backlog) { await deliverDeepLinkUrl(url) }
async function deliverDeepLinkUrl(raw: string): Promise<void> {
  const ok = await handleDesktopDeepLink(raw)
  if (ok) {
    window.dispatchEvent(new CustomEvent('desktop-sso-success'))
  }
}
`)
  /** G8 的"齐备"夹具:5 处整页导航,每处上方都有复位调用。
   *  站点之间必须隔 ≥9 行 —— 判据的窗口是"上方 8 行",不留间隔会让上一个站点的
   *  复位被当成下一个站点的证据,变异(删掉某一处复位)就测不出红。 */
  const gNavOk = [
    'fn a(){ reset_deep_link_gate_for_navigation("main"); let _ = w.eval("location.href=u", None); }',
    'fn b(){ reset_deep_link_gate_for_navigation("main"); let _ = w.eval("location.reload()", None); }',
    'fn c(){ reset_deep_link_gate_for_navigation("main"); let _ = w.eval("location.reload()", None); }',
    'fn d(){ reset_deep_link_gate_for_navigation("main"); let _ = w.eval("location.href=u", None); }',
    'fn e(){ reset_deep_link_gate_for_navigation("main"); let _ = w.eval("location.reload()", None); }',
  ].join('\n\n\n\n\n\n\n\n\n')
  const gCount = (rust, bridge, nav) =>
    auditDeepLinkMechanism(rust ?? gRust(), bridge ?? gBridge(), nav === undefined ? gNavOk : nav)

  /** 反向锁:每条变异必须红在**它自己那一组**判据上 —— 只要求"有违规"会被别的判据凑数,
   *  于是判据失效表现为"绿",而不是"红在错的地方"。 */
  const checkHas = (label, got, prefix) => {
    const hit = got.filter((v) => v.startsWith(prefix))
    const bad = hit.length === 0
    cases.push(`${bad ? '✗' : '✓'} ${label}${bad ? ` —— 无 ${prefix} 违规,实得: ${got.join(' | ').slice(0, 140)}` : ` → ${hit[0].slice(0, 120)}`}`)
    return !bad
  }

  ok =
    check('G 机制齐备的夹具 ⇒ 0 违规(否则下面所有变异用例都无意义)', gCount(), true) && ok
  ok =
    checkHas(
      'G2 未就绪 ⇒ 丢弃(把 Queue 改成什么都不给)必红',
      gCount(gRust((s) => s.replace('else { DeepLinkDelivery::Queue(url.clone()) }', 'else { return; }'))),
      'G2',
    ) && ok
  ok =
    checkHas(
      'G1 on_open_url 回退回"就地 emit + 只取 first"必红',
      gCount(
        gRust((s) =>
          s.replace(
            'dispatch_deep_links(&app, &urls); }',
            'if let Some(first_url) = event.urls().first() { let _ = w.emit("desktop-deep-link", first_url); } }',
          ),
        ),
      ),
      'G1',
    ) && ok
  ok =
    checkHas(
      'G3 溢出丢弃不计数(删 dropped)必红',
      gCount(gRust((s) => s.replace('self.dropped += 1; ', ''))),
      'G3',
    ) && ok
  ok =
    checkHas(
      'G4 take_all 改成不清空(只读不取)必红',
      gCount(
        gRust((s) =>
          s.replace('std::mem::take(&mut self.urls).into_iter().collect()', 'self.urls.iter().cloned().collect()'),
        ),
      ),
      'G4',
    ) && ok
  ok =
    checkHas(
      'G4 取回命令摘出 invoke_handler 必红',
      gCount(gRust((s) => s.replace('get_app_info, take_pending_deep_links', 'get_app_info'))),
      'G4',
    ) && ok
  ok =
    checkHas(
      'G5 清账函数在位但无人调用必红',
      gCount(gRust((s) => s.replace('\n    reset_deep_link_gate_on_destroy(&label);', ''))),
      'G5',
    ) && ok
  ok =
    checkHas(
      'G6 先取回、后注册监听(时序颠倒)必红',
      gCount(
        undefined,
        gBridge((s) =>
          s.replace(
            "unlistenDeepLink = await listen<string>('desktop-deep-link', (event) => { void deliverDeepLinkUrl(event.payload) })\nconst backlog = await invoke<string[]>('take_pending_deep_links')",
            "const backlog = await invoke<string[]>('take_pending_deep_links')\nunlistenDeepLink = await listen<string>('desktop-deep-link', (event) => { void deliverDeepLinkUrl(event.payload) })",
          ),
        ),
      ),
      'G6',
    ) && ok
  ok =
    checkHas(
      'G6 桥接端自建去重 Set(把实时链改造成隐形重放链)必红',
      gCount(undefined, gBridge((s) => s.replace('const backlog', 'const seen = new Set<string>()\nconst backlog'))),
      'G6',
    ) && ok
  ok =
    checkHas(
      'G6 无条件 dispatch desktop-sso-success(失败也广播成功)必红',
      gCount(
        undefined,
        gBridge((s) =>
          s.replace(
            "if (ok) {\n    window.dispatchEvent(new CustomEvent('desktop-sso-success'))\n  }",
            "window.dispatchEvent(new CustomEvent('desktop-sso-success'))",
          ),
        ),
      ),
      'G6',
    ) && ok
  ok =
    checkHas(
      'G7 事件名两边分叉(Rust 侧常量被改名)必红',
      gCount(gRust((s) => s.replace('const DEEP_LINK_EVENT: &str = "desktop-deep-link";', 'const DEEP_LINK_EVENT: &str = "desktop-deeplink";'))),
      'G7',
    ) && ok
  ok =
    checkHas(
      'G8 导航发起处删掉复位调用必红(重载期直投丢失那一型)',
      gCount(
        null,
        null,
        gNavOk.replace(
          'fn c(){ reset_deep_link_gate_for_navigation("main"); let _ = w.eval("location.reload()", None); }',
          'fn c(){ let _ = w.eval("location.reload()", None); }',
        ),
      ),
      'G8',
    ) && ok
  ok =
    checkHas(
      'G8 导航面一个发起点都找不到 ⇒ 判"失明"而不是通过',
      gCount(null, null, 'fn noop(){ /* 没有导航 */ }'),
      'G8',
    ) && ok
  ok =
    checkHas(
      'G8 未取到导航文件 ⇒ 计未判定(不得记为通过)',
      gCount(null, null, null),
      'G8',
    ) && ok
  ok =
    check(
      'G4 "置就绪"提成交给同文件 helper ⇒ 不得判红(门必须认自己产出的形态)',
      gCount(
        gRust((s) =>
          s
            .replace('    gate.target_ready = true;\n', '    apply_take_ready(&mut gate);\n')
            .replace(
              'fn reset_deep_link_gate_on_destroy',
              'fn apply_take_ready(gate: &mut DeepLinkGateState) -> bool { gate.target_ready = true; true }\nfn reset_deep_link_gate_on_destroy',
            ),
        ),
      ),
      true,
    ) && ok
  ok =
    checkHas(
      'G4 命令体与 helper 都不置就绪 ⇒ 必红(允许一跳不等于放过)',
      gCount(
        gRust((s) => s.replace('    gate.target_ready = true;\n', '    apply_take_ready(&mut gate);\n')),
      ),
      'G4',
    ) && ok

  // ===========================================================================
  // G9:整页导航发起点 ⇒ 同文件必须有触发存草稿的出口(G-407 票①)。
  // 夹具的**每一段**都逐字取自真仓:`auto_refresh.rs:366` 的 `w.eval("location.reload()")`、
  // `lib.rs:2766` 的 `window.emit("desktop-before-close", ())`。不用自造形状 ——
  // §22c:镜像/自检只复读实现就是复读机,夹具复刻的若是想象,判据对真形态照样全盲。
  // ===========================================================================
  const g9NoExit = [
    'fn hot_reload(w: &tauri::WebviewWindow) {',
    '    let _ = w.eval("location.reload()");',
    '}',
    '',
    'fn go_offline(w: &tauri::WebviewWindow) {',
    '    let _ = w.eval(&format!("location.href={}", js_string(OFFLINE_URL)));',
    '}',
  ].join('\n')
  const g9WithEmit = `fn flush_before_nav(w: &tauri::WebviewWindow) {\n    let _ = w.emit("desktop-before-close", ());\n${g9NoExit.replace(
    /^fn /,
    '    // 站点在同一条链上\nfn ',
  )}`
  const g9WithFlushDraft = `async function nav(u: string) {\n  flushPromptDraft()\n  window.location.href = u\n}\n`
  const g9CommentOnly = '// 这里只是解释热刷新会走 location.reload()\nfn noop() {}\n'
  const g9Exempted =
    'fn boot(w: &tauri::WebviewWindow) {\n    // page-nav-exempt: 冷启动首屏尚未渲染,输入框不可能有草稿\n    let _ = w.eval("location.reload()");\n}\n'
  const g9BareExempt = 'fn boot(w: &tauri::WebviewWindow) {\n    let _ = w.eval("location.reload()"); // page-nav-exempt:\n}\n'
  const g9RustNativeReload = 'fn r(w: &tauri::WebviewWindow) {\n    let _ = w.reload();\n}\n'
  const a9 = (rel, text) => auditPageNavExit(rel, blankComments(text, { apostropheIsStringDelimiter: !rel.endsWith('.rs') }), text)
  ok =
    check('G9 两处发起点且本文件无出口 ⇒ 必红', a9('a.rs', g9NoExit).gaps === 2 ? [] : ['实得缺口 != 2'], true) && ok
  ok =
    check(
      'G9 同文件补上 emit("desktop-before-close") ⇒ 必绿',
      a9('a.rs', g9WithEmit).gaps === 0 ? [] : ['补出口后仍判缺口'],
      true,
    ) && ok
  ok =
    check(
      'G9 认具名草稿落盘出口(flushPromptDraft())⇒ 必绿(修法不止 emit 一种)',
      a9('b.ts', g9WithFlushDraft).gaps === 0 ? [] : ['具名出口没被认出来'],
      true,
    ) && ok
  ok =
    check(
      'G9 注释里的该形态不得计入(判据面必须先剥注释)',
      a9('a.rs', g9CommentOnly).sites === 0 ? [] : ['注释形态被当成发起点 ⇒ 判据会把自己的说明判成违规'],
      true,
    ) && ok
  ok =
    check(
      'G9 逐行豁免带原因 ⇒ 放过且不记缺口',
      a9('a.rs', g9Exempted).gaps === 0 && a9('a.rs', g9Exempted).exempted === 1
        ? []
        : ['带原因的逐行豁免没生效'],
      true,
    ) && ok
  ok =
    check(
      'G9 裸标记(无原因)不得放行 —— 豁免必须带交代',
      a9('a.rs', g9BareExempt).gaps === 1 ? [] : ['裸 page-nav-exempt: 被当成了有效豁免'],
      true,
    ) && ok
  ok =
    check(
      'G9 Tauri 原生 w.reload() 也算发起点(G8 旧内联式对这一型全盲)',
      a9('a.rs', g9RustNativeReload).sites === 1 ? [] : ['webview.reload() 没被认成发起点'],
      true,
    ) && ok
  ok =
    check(
      'G9 同一形态写在 .ts 里的 `store.navigate(url)` 不得算发起点(只认 location.*)',
      a9('c.ts', 'panel.navigate(u)\n').sites === 0 ? [] : ['业务方法被当成整页导航 ⇒ 假阳'],
      true,
    ) && ok
  ok =
    check(
      'G9 盲区探针:eval 载体行读不出载荷 ⇒ 报名(不得静默算"没有")',
      a9('a.rs', 'fn x(w: &WebviewWindow) {\n    let _ = w.eval(concat!(\n        "location.reload()"\n    ));\n}\n')
        .probes.length >= 1
        ? []
        : ['跨行 eval 没被报成盲区'],
      true,
    ) && ok
  // 棘轮方向:锚点=该文件 HEAD 自身 ⇒ 存量不得判红,新增才红;锚点没给 ⇒ 报名不顶缸
  ok =
    check(
      'G9 棘轮:现读 2 处而 HEAD 锚点 2 ⇒ 不判红(存量属他人的账,不是本次带进来的)',
      decidePageNavReds([a9('a.rs', g9NoExit)], new Map([['a.rs', 2]])).reds.length === 0
        ? []
        : ['存量被判成了新增 ⇒ 这台尺子会逼人跳门'],
      true,
    ) && ok
  ok =
    check(
      'G9 棘轮:锚点 1 而现读 2 ⇒ 必红且点名新增 1',
      (() => {
        const { reds } = decidePageNavReds([a9('a.rs', g9NoExit)], new Map([['a.rs', 1]]))
        return reds.length === 1 && reds[0].added === 1 ? [] : ['实得:' + JSON.stringify(reds.map((r) => r.added))]
      })(),
      true,
    ) && ok
  ok =
    check(
      'G9 棘轮:锚点根本没给(取不到正文)⇒ 落 unanchored 报名,不得把 0 当锚点顶缸',
      (() => {
        const r = decidePageNavReds([a9('a.rs', g9NoExit)], new Map())
        return r.reds.length === 0 && r.unanchored.join() === 'a.rs'
          ? []
          : ['实得 reds=' + r.reds.length + ' unanchored=' + r.unanchored.join(',')]
      })(),
      true,
    ) && ok
  ok =
    check(
      'G9 新文件(显式锚点 0,即 HEAD 面没有它)⇒ 每一条缺口都算新账',
      decidePageNavReds([a9('a.rs', g9NoExit)], new Map([['a.rs', 0]])).reds.length === 1
        ? []
        : ['显式 0 锚点没判红(与"没给锚点"必须不同形)'],
      true,
    ) && ok
  // 射程切分:宿主面判、渲染面报名 —— 两侧都必须"看得见",只是处置不同
  ok =
    check(
      'G9 射程:.rs ⇒ host(进判据)/ .ts·.tsx ⇒ renderer(只报名,不判红)',
      pageNavScopeOf('apps/desktop/src-tauri/src/auto_refresh.rs') === 'host' &&
        pageNavScopeOf('apps/web/src/lib/menu-actions.ts') === 'renderer' &&
        pageNavScopeOf('apps/web/src/components/x.tsx') === 'renderer'
        ? []
        : ['两侧切分漂移 ⇒ 会把渲染端的注销跳转判成宿主绕过'],
      true,
    ) && ok
  ok =
    check(
      'G9 渲染端同样两处站点仍要**被数出来**(不判红 ≠ 看不见)',
      a9('m.ts', 'window.location.reload()\nwindow.location.href = u\n').sites === 2
        ? []
        : ['渲染面枚举为 0 ⇒ 报名那一栏会变成空表'],
      true,
    ) && ok

  // 形状锁(G9 ↔ G8 的分工:"G9 必须反向依赖 G8 那一份枚举与它的失明护栏,不得复制第二份")
  // 刻意放在 §22c 镜像测试而不是这里 —— 读本门自身源码要 readFileSync,而本门的 node:fs
  // import 行**禁止**出现 readFileSync(镜像 T5 的锁:被审内容不得从磁盘直读)。
  // 行为用例在这里,形状锁在那里,两边都有牙。

  // ===========================================================================
  // H 组:托盘项去向。夹具 = lib.rs 的真实形态(4 项 emit + show/hide 原生 + quit 原生退出)。
  // quit 那一支**故意在分支体内留着**历史注释「原设计: emit … 然后 app.exit(0)」——
  // 于是"把真代码删掉、只剩注释"这一支变异,只有在判据确实看剥注释面时才红;
  // blankComments 一旦失效(或有人把判据面换回原文),H3 立刻变绿而报告一切正常。
  // 这正是本仓记过最多次的那一型:说明性文字也会带执行性字符。
  // ===========================================================================
  const H_QUIT_OK =
    '"tray.quit" => { /* 原设计: emit("desktop-tray-action", "quit") 然后 app.exit(0) */ arm_forced_exit(app, 3); app.exit(0); }'
  const hRust = (mutate = (s) => s) =>
    mutate(`
fn build_tray(app: &tauri::AppHandle) -> Result<(), String> {
    let new_chat_item = MenuItemBuilder::with_id("tray.new_chat", labels[0]).build(app)?;
    let show_item = MenuItemBuilder::with_id("tray.show", labels[1]).build(app)?;
    let hide_item = MenuItemBuilder::with_id("tray.hide", labels[2]).build(app)?;
    let theme_item = MenuItemBuilder::with_id("tray.theme", labels[3]).build(app)?;
    let settings_item = MenuItemBuilder::with_id("tray.settings", labels[4]).build(app)?;
    let update_item = MenuItemBuilder::with_id("tray.update", labels[5]).build(app)?;
    let quit_item = MenuItemBuilder::with_id("tray.quit", labels[6]).build(app)?;
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray.new_chat" => { if let Err(e) = window.emit("desktop-tray-action", "new_chat") { log::warn!("{}", e); } }
            "tray.show" => { let _ = window.show(); let _ = window.set_focus(); }
            "tray.hide" => { let _ = window.hide(); }
            "tray.theme" => { if let Err(e) = window.emit("desktop-tray-action", "toggle_theme") { log::warn!("{}", e); } }
            "tray.settings" => { if let Err(e) = window.emit("desktop-tray-action", "open_settings") { log::warn!("{}", e); } }
            "tray.update" => { if let Err(e) = window.emit("desktop-tray-action", "check_update") { log::warn!("{}", e); } }
            ${H_QUIT_OK}
            _ => {}
        })
}
`)
  const hEmitted = new Set(['new_chat', 'toggle_theme', 'open_settings', 'check_update'])
  const hRun = (rust) => auditTrayItemDestinations(rust ?? hRust(), hEmitted)
  /** 收 rust 字符串(不是判据结果)—— 上一版这里收对象,而对象没有 .violations 之外的字段可读,
   *  判据结果 .violations 恒 undefined 直到 filter 抛 TypeError 才暴露:
   *  夹具没真喂进判据的自检,等于没有自检。 */
  const hViolationsOf = (rust, prefix) => hRun(rust).violations.filter((v) => v.startsWith(prefix))
  /** 把 quit 那一支换成 body(保留分支头,只改去向) */
  const hQuitBody = (body) => hRust((s) => s.replace(H_QUIT_OK, `"tray.quit" => { ${body} }`))

  ok =
    check('H 齐备夹具(4 emit + 2 原生窗口 + quit 原生退出)⇒ 0 违规', hRun().violations, true) && ok
  ok =
    check(
      'H 计数如实:emitted 4 / native 3(证明两族各被认到,不是整片放过)',
      hRun().emitted === 4 && hRun().native === 3
        ? []
        : [`实得 emitted=${hRun().emitted} native=${hRun().native}`],
      true,
    ) && ok
  ok =
    checkHas(
      'H3 quit 只剩"存窗口状态"、去向全在注释里 ⇒ 必红(剥注释失效就会在这里变绿)',
      hViolationsOf(hQuitBody('let _ = save_window_state(None, app.clone());'), 'H3'),
      'H3',
    ) && ok
  ok =
    checkHas(
      'H3 quit 只剩 .close()(关窗 ≠ 执行该项语义)⇒ 必红',
      hViolationsOf(hQuitBody('let _ = window.close();'), 'H3'),
      'H3',
    ) && ok
  ok =
    check(
      'H3 quit 只留 arm_forced_exit(兜底本身会终止进程)⇒ 放过(门不得要求两种写法同时在场)',
      hRun(hQuitBody('arm_forced_exit(app, 3);')).violations,
      true,
    ) && ok
  ok =
    checkHas(
      'H2 注册了 quit 项却删掉它的分支 ⇒ 必红(点了静默无反应)',
      hViolationsOf(
        hRust((s) => s.replace(`            ${H_QUIT_OK}\n`, '')),
        'H2',
      ),
      'H2',
    ) && ok
  ok =
    checkHas(
      'H2 有分支但菜单里没有这一项(菜单与分发分叉)⇒ 必红',
      hViolationsOf(
        hRust((s) =>
          s
            .replace(
              '    let quit_item = MenuItemBuilder::with_id("tray.quit", labels[6]).build(app)?;\n',
              '',
            )
            .replace(H_QUIT_OK, '"tray.quit" => { app.exit(0); }'),
        ),
        'H2',
      ),
      'H2',
    ) && ok
  ok =
    checkHas(
      'H3 分支 emit 变量形态 payload ⇒ 静态无可证去向,必红(不得静默算去向)',
      hViolationsOf(
        hRust(
          (s) =>
            s.replace(
              'window.emit("desktop-tray-action", "toggle_theme")',
              'window.emit("desktop-tray-action", &action_var)',
            ),
          // 该项已从层1 的 action 集合里消失 ⇒ 交叉核对那一支不该来兜这个场景
        ),
        'H3',
      ),
      'H3',
    ) && ok
  ok =
    checkHas(
      'H3 分支 emit 的字面量 action 未被层1 抓到(两把正则漂移)⇒ 必红,不得两边各绿一次',
      auditTrayItemDestinations(hRust(), new Set(['toggle_theme', 'open_settings', 'check_update'])) // 故意漏掉 new_chat
        .violations.filter((v) => v.startsWith('H3')),
      'H3',
    ) && ok
  ok =
    checkHas(
      'H1 分发体在、但一个托盘项都扫不到 ⇒ 判"失明"(不是"没有违规")',
      hViolationsOf(
        hRust((s) => s.replace(/ {4}let \w+_item = MenuItemBuilder::with_id\([^\n]*\n/g, '')),
        'H1',
      ),
      'H1',
    ) && ok
  ok =
    checkHas(
      'H1 一个托盘项都扫不到(连分发体也没了)⇒ 同样判"失明"',
      hViolationsOf('fn nothing() {}', 'H1'),
      'H1',
    ) && ok
  ok =
    checkHas(
      'H1 找不到 on_menu_event ⇒ 判"分发被摘线"',
      hViolationsOf(
        hRust((s) => s.replace('.on_menu_event(', '.on_something_else(')),
        'H1',
      ),
      'H1',
    ) && ok

  // ===========================================================================
  // H' 组(2026-09-28):表驱动菜单构建 + exit_application 原生退出。
  // 夹具逐字取自 lib.rs:443 / desktop_prefs.rs:73 的真实形态 —— 菜单项 id 不再以字面量出现,
  // 清单唯一来源是登记表;quit 的去向是 exit_application(仓内唯一退出序列出口)。
  // 本组存在的理由:上一代门对这两个真形态全盲(H1 报失明、H2 把 7 条真分支判孤儿、
  // H3 把真退出判成"没反应"),而功能一个字没坏 —— 判据必须认自己该认的世界,
  // 但**认新的不等于放过缺的**:每条"补齐 ⇒ 绿"都配一条"删掉 ⇒ 仍红"。
  // ===========================================================================
  const hPrefs = (mutate = (s) => s) =>
    mutate(`
pub const TRAY_MENU_ITEMS: [TrayMenuItem; 7] = [
    TrayMenuItem { id: "new_chat", label_index: 0, group: 0 },
    TrayMenuItem { id: "show", label_index: 1, group: 1 },
    TrayMenuItem { id: "hide", label_index: 2, group: 1 },
    TrayMenuItem { id: "theme", label_index: 3, group: 2 },
    TrayMenuItem { id: "settings", label_index: 4, group: 2 },
    TrayMenuItem { id: "update", label_index: 5, group: 2 },
    TrayMenuItem { id: "quit", label_index: 6, group: 3 },
];
`)
  const H_TABLE_QUIT_ARM = '"tray.quit" => { /* 原设计曾 emit 给前端 */ exit_application(app); }'
  const hRustTable = (mutate = (s) => s) =>
    mutate(`
fn build_tray(app: &tauri::AppHandle) -> Result<(), String> {
    for id in &prefs.tray_menu_items {
        let Some(item) = tray_menu_item(id) else { continue; };
        let menu_item =
            MenuItemBuilder::with_id(format!("tray.{}", item.id), labels[item.label_index])
                .build(app)?;
    }
        .on_menu_event(|app, event| match event.id().as_ref() {
            "tray.new_chat" => { if let Err(e) = window.emit("desktop-tray-action", "new_chat") { log::warn!("{}", e); } }
            "tray.show" => { let _ = window.show(); let _ = window.set_focus(); }
            "tray.hide" => { let _ = window.hide(); }
            "tray.theme" => { if let Err(e) = window.emit("desktop-tray-action", "toggle_theme") { log::warn!("{}", e); } }
            "tray.settings" => { if let Err(e) = window.emit("desktop-tray-action", "open_settings") { log::warn!("{}", e); } }
            "tray.update" => { if let Err(e) = window.emit("desktop-tray-action", "check_update") { log::warn!("{}", e); } }
            ${H_TABLE_QUIT_ARM}
            _ => {}
        })
}
`)
  const hTableRun = (rust, prefs) =>
    auditTrayItemDestinations(rust ?? hRustTable(), hEmitted, prefs ?? hPrefs())
  const hTableViolationsOf = (rust, prefs, prefix) =>
    hTableRun(rust, prefs).violations.filter((v) => v.startsWith(prefix))

  ok =
    check('H 表驱动夹具(登记表 7 项 + format! 构建 + quit 走 exit_application)⇒ 0 违规', hTableRun().violations, true) && ok
  ok =
    check(
      'H 表驱动计数如实:emitted 4 / native 3 且 quit 记在 native(证明 exit_application 真被认,不是整片放过)',
      (() => {
        const a = hTableRun()
        return a.emitted === 4 && a.native === 3 && a.nativeIds.includes('quit')
          ? []
          : [`实得 emitted=${a.emitted} native=${a.native} nativeIds=[${a.nativeIds}]`]
      })(),
      true,
    ) && ok
  ok =
    checkHas(
      'H2 表驱动形态:删掉整条 quit 分支(登记表仍列着 quit)⇒ 必红 —— 本票的反向对照,门改宽后"退出分支没了"必须照样炸',
      hTableViolationsOf(
        hRustTable((s) => s.replace(`            ${H_TABLE_QUIT_ARM}\n`, '')),
        undefined,
        'H2',
      ),
      'H2',
    ) && ok
  ok =
    checkHas(
      'H3 表驱动形态:quit 分支只剩注释(真调用被删)⇒ 必红 —— 注释提到 exit_application 也不给合格证',
      hTableViolationsOf(
        hRustTable((s) => s.replace('exit_application(app);', '/* 这里原本调用 exit_application(app) */')),
        undefined,
        'H3',
      ),
      'H3',
    ) && ok
  ok =
    checkHas(
      'H1 表驱动形态但登记表解析不出(文件被搬走/改名)⇒ 判"失明",绝不拿分支头当清单静默通过',
      hTableViolationsOf(undefined, '', 'H1'),
      'H1',
    ) && ok
  ok =
    checkHas(
      'H1 登记表条目数与 [; N] 声明不符(清单腐烂)⇒ 必红',
      hTableViolationsOf(
        // 只改声明数、不删条目 ⇒ 6 ≠ 7 实收 ⇒ 判腐烂;若连条目一起删会自洽漏判(第一版就栽在这)
        undefined,
        hPrefs((s) => s.replace('[TrayMenuItem; 7]', '[TrayMenuItem; 6]')),
        'H1',
      ),
      'H1',
    ) && ok
  ok =
    checkHas(
      'H2 登记表改名 id:"quit"→"terminate"(双向分叉:新项无分支 + 旧分支无此项)⇒ 必红',
      hTableViolationsOf(
        undefined,
        hPrefs((s) => s.replace('id: "quit"', 'id: "terminate"')),
        'H2',
      ),
      'H2',
    ) && ok
  ok =
    checkHas(
      'H3 表驱动 quit 分支只剩 .close()(关窗 ≠ 退出语义)⇒ 必红(原生族加 exit_application 不放宽 close 判口)',
      hTableViolationsOf(
        hRustTable((s) => s.replace(H_TABLE_QUIT_ARM, '"tray.quit" => { let _ = window.close(); }')),
        undefined,
        'H3',
      ),
      'H3',
    ) && ok

  // ===========================================================================
  // F 组(取材面):证明"默认档判 HEAD 而不是磁盘"不是文案,而是**读到的字节不一样**。
  // 做法是在临时 git 仓里让同一文件的 HEAD / 索引 / 磁盘三份内容**互异**,再逐面读它。
  // 为什么必须造这个现场:本门此前所有判据都只喂字符串夹具,而"读哪个面"这一格
  // 用夹具证不了 —— 只有真仓的索引≠磁盘才能区分三面(守门 91/118 的 F1–F4 同型)。
  // ===========================================================================
  const HEAD_TXT = '面=HEAD 的内容 marker-HEAD\n'
  const INDEX_TXT = '面=索引 的内容 marker-INDEX\n'
  const DISK_TXT = '面=磁盘 的内容 marker-DISK\n'
  let repo = null
  try {
    repo = mkScratch('debw-face-')
    gitRaw(['init', '-q'], repo)
    gitRaw(['config', 'user.name', 'gate-self-test'], repo)
    gitRaw(['config', 'user.email', 'gate@example.invalid'], repo)
    mkdirSync(path.join(repo, 'src'), { recursive: true })
    writeFileSync(path.join(repo, 'src', 'a.ts'), HEAD_TXT)
    writeFileSync(path.join(repo, 'extra.ts'), HEAD_TXT)
    gitRaw(['add', '--', 'src/a.ts', 'extra.ts'], repo)
    gitRaw(['commit', '-q', '-m', 'face fixture base'], repo)
    // 索引与磁盘分叉:先按 INDEX 内容暂存,再把磁盘改成 DISK(索引不回写)
    writeFileSync(path.join(repo, 'src', 'a.ts'), INDEX_TXT)
    gitRaw(['add', '--', 'src/a.ts'], repo)
    writeFileSync(path.join(repo, 'src', 'a.ts'), DISK_TXT)

    ok =
      check(
        'F1 默认档是 HEAD 而不是磁盘(无旗时必须 face==="head")',
        faceFromArgv([]).face === 'head' ? [] : [`实得 ${String(faceFromArgv([]).face)}`],
        true,
      ) && ok
    ok =
      check(
        'F1b 无旗读到的字节 = HEAD 那份(证明默认面不是盘)',
        textOf(readFaceBlobs(repo, faceFromArgv([]).face, ['src/a.ts']), 'src/a.ts') === HEAD_TXT
          ? []
          : ['默认面读到了非 HEAD 的内容'],
        true,
      ) && ok
    ok =
      check(
        'F2 三面三答:HEAD / 索引 / 磁盘各读各的,互不回落',
        (() => {
          const h = textOf(readFaceBlobs(repo, 'head', ['src/a.ts']), 'src/a.ts')
          const s = textOf(readFaceBlobs(repo, 'staged', ['src/a.ts']), 'src/a.ts')
          const w = textOf(readFaceBlobs(repo, 'worktree', ['src/a.ts']), 'src/a.ts')
          return h === HEAD_TXT && s === INDEX_TXT && w === DISK_TXT
            ? []
            : [`head=${JSON.stringify(h.slice(-12))} staged=${JSON.stringify(s.slice(-13))} worktree=${JSON.stringify(w.slice(-12))}`]
        })(),
        true,
      ) && ok
    ok =
      check(
        'F2b 清单也同面:摘出索引后 staged 档列不到该路径(不借 HEAD 凑数)',
        (() => {
          gitRaw(['rm', '--cached', '-q', '--', 'extra.ts'], repo)
          const listed = listFaceDir(repo, 'staged', '.', ['.ts'])
          const listedHead = listFaceDir(repo, 'head', 'src', ['.ts'])
          return !listed.includes('extra.ts') && listed.includes('src/a.ts') && listedHead.includes('src/a.ts')
            ? []
            : [`staged 清单=${JSON.stringify(listed)} head 清单=${JSON.stringify(listedHead)}`]
        })(),
        true,
      ) && ok
    ok =
      check(
        'F3 两面旗同给 ⇒ 判死(不自选一个面假装判过)',
        faceFromArgv(['--staged', '--worktree']).error ? [] : ['两面旗同给却无 error'],
        true,
      ) && ok
    ok =
      check(
        'F4 清单里有、正文取不到(未合并路径)⇒ 抛 Undetermined,绝不静默少扫',
        (() => {
          const r2 = mkScratch('debw-unmerged-')
          try {
            gitRaw(['init', '-q'], r2)
            gitRaw(['config', 'user.name', 'gate-self-test'], r2)
            gitRaw(['config', 'user.email', 'gate@example.invalid'], r2)
            mkdirSync(path.join(r2, 'c'), { recursive: true })
            writeFileSync(path.join(r2, 'c', 'm.ts'), 'base\n')
            gitRaw(['add', '--', 'c/m.ts'], r2)
            gitRaw(['commit', '-q', '-m', 'base'], r2)
            const trunk = gitRaw(['rev-parse', '--abbrev-ref', 'HEAD'], r2).trim()
            gitRaw(['checkout', '-q', '-b', 'side'], r2)
            writeFileSync(path.join(r2, 'c', 'm.ts'), 'side\n')
            gitRaw(['commit', '-q', '-am', 'side'], r2)
            gitRaw(['checkout', '-q', trunk], r2)
            writeFileSync(path.join(r2, 'c', 'm.ts'), 'trunk\n')
            gitRaw(['commit', '-q', '-am', 'trunk'], r2)
            try {
              gitRaw(['merge', '-q', 'side'], r2)
            } catch {
              /* 预期:冲突让 merge 非零退出 */
            }
            const listed = listFaceDir(r2, 'staged', 'c', ['.ts'])
            if (!listed.includes('c/m.ts')) return ['夹具未造出未合并态(清单里没有该路径)']
            try {
              readFaceBlobs(r2, 'staged', listed)
              return ['未合并却顺利返回内容 ⇒ 少扫被伪装成扫过']
            } catch (e) {
              return e instanceof Undetermined ? [] : [`抛了非 Undetermined:${String(e?.message ?? e).slice(0, 60)}`]
            }
          } finally {
            rmScratch(r2)
          }
        })(),
        true,
      ) && ok
  } catch (e) {
    cases.push(`✗ F 组取材面临时仓建立失败 —— ${String(e?.message ?? e).slice(0, 160)}`)
    ok = false
  } finally {
    if (repo) rmScratch(repo)
  }
  console.log(`--self-test 共 ${cases.length} 例:`)
  for (const line of cases) console.log('  ' + line)
  console.log(ok ? '✅ 全部通过' : '❌ 存在失效判据')
  process.exit(ok ? 0 : 1)
}

if (process.argv.includes('--self-test')) runSelfTest()

// ============================================================================
// 取材面落地:两面旗同给 / 该面取不到 ⇒ exit 2「无法判定」,既不冒红也不记绿,
// 且**不回落**到另一个面。这里先于任何判据发生,因为"读哪个面"不是某个判据的私事。
// ============================================================================

if (FACE_SEL.error) {
  console.error(`[check-desktop-event-wiring] ❌ 无法判定:${FACE_SEL.error}`)
  process.exit(2)
}
const FACE = FACE_SEL.face
console.log(`  ${C.dim}取材面:${FACE_TXT[FACE]}${C.reset}`)

let FACE_INPUT
try {
  FACE_INPUT = buildFaceContents(ROOT, FACE)
} catch (e) {
  const known = e instanceof Undetermined
  console.error(
    `[check-desktop-event-wiring] 取不到输入(${FACE_TXT[FACE]})⇒ 无法判定(不记为通过):${
      known ? e.message : (e?.stack ?? e)
    }`
  )
  process.exit(2)
}
/** 层1 的 .rs 清单与层3 的 web 清单:与正文**同一个面的同一轮**清单,不再各遍历一次 */
const CONTENTS = FACE_INPUT.contents
const RUST_FILES = FACE_INPUT.rustFiles
const WEB_FILES = FACE_INPUT.webFiles

// ============================================================================
// [1/3] 层 1: Rust 生产端扫描
// ============================================================================

console.log(`${C.cyan}[1/3] 层1: Rust 事件生产者扫描${C.reset}`)

// 两种 payload 形态分别捕获:
//   "action" → 具名 action;`()` → unit(纯通知,无 payload)
// 注意:`()` 必须整体匹配 —— 早期写成 `([^\n]*?)\)` 时被非贪婪吃掉左括号(payload 变 "("),
//       导致 unit 形态 emit 静默漏抓、自失效阈值误报。
const RUST_EMIT_RE =
  /\.emit(?:_to|_filter)?\((?:\s*[^,\n]*,\s*)?"([a-z][a-z0-9-]*)"\s*,\s*(?:"([a-z_]+)"|\(\))/g
const UNIT_PAYLOAD = '«unit»' // 无 payload 的 emit(())

/** 事件名 → Set<action>(无 payload 时记 UNIT_PAYLOAD) */
const rustEmits = new Map()
/** 事件名 → 来源文件集合 */
const rustSources = new Map()
let rustEmitHits = 0
/** 规则 G 复用同一遍取材的 lib.rs 文本(不另开一次读:取材面纪律见守门 118) */
let rustLibText = ''
/** G8 的导航发起面:与 lib.rs 同一次 catBatch 取,不另开读、也不按磁盘判 */
let rustNavText = ''

for (const f of RUST_FILES) {
  const text = textOf(CONTENTS, f)
  if (f === G_DEEP_LINK_RUST_FILE) rustLibText = text
  if (f === G_DEEP_LINK_NAV_FILE) rustNavText = text
  for (const m of text.matchAll(RUST_EMIT_RE)) {
    const event = m[1]
    // 变量形态 payload(payload 非字符串字面量/unit)不在静态对账范围,正则本就不匹配
    const action = m[2] ?? UNIT_PAYLOAD
    if (!rustEmits.has(event)) {
      rustEmits.set(event, new Set())
      rustSources.set(event, new Set())
    }
    rustEmits.get(event).add(action)
    rustSources.get(event).add(f)
    rustEmitHits++
  }
}

console.log(
  `  命中 emit ${rustEmitHits} 处, 覆盖 ${rustEmits.size} 个事件名 ← apps/desktop/src-tauri/src`,
)
for (const [event, actions] of [...rustEmits.entries()].sort()) {
  console.log(
    `  ${C.dim}emit:${C.reset} ${event} ${C.dim}[${[...actions].filter((a) => a !== UNIT_PAYLOAD).join(', ') || '(无 payload)'}] ← ${[...rustSources.get(event)].join(', ')}${C.reset}`,
  )
}

/**
 * 规则 H 的取证:与层1 **同一轮、同一面**的 lib.rs 文本,不另开一次读(取材面纪律见守门 118)。
 * 放在这里(而不是判据段)是为了让下面的 SANITY_MIN 能拿到"托盘菜单项数"这一维数字。
 * 表驱动形态的 id 清单也取自**同一个 CONTENTS**(desktop_prefs.rs 本就在 RUST_SRC_DIR 清单里)——
 * 清单与内容混面会造出自洽却基准错位的尺子,登记表不在面上 ⇒ 判"失明",不借 HEAD 凑数。
 */
const TRAY_EMITTED_ACTIONS = rustEmits.get(TRAY_ACTION_EVENT) ?? new Set()
const trayRegistryText = textOf(CONTENTS, RUST_DESKTOP_PREFS_REL)
const trayAudit = auditTrayItemDestinations(rustLibText, TRAY_EMITTED_ACTIONS, trayRegistryText)
console.log(
  `  ${C.dim}托盘项去向: 菜单 ${trayAudit.items.size} 项 / 分支 ${trayAudit.arms.size} 个 → emit ${trayAudit.emitted} 项 · 原生 ${trayAudit.native} 项${C.reset}`,
)

// ============================================================================
// [2/3] 层 2: 桥接端(use-desktop.ts)扫描
// ============================================================================

console.log(`\n${C.cyan}[2/3] 层2: 桥接端 use-desktop.ts 解析${C.reset}`)

const BRIDGE_PRESENT = CONTENTS.has(BRIDGE_REL)
if (!BRIDGE_PRESENT) {
  errors.push('apps/web/src/hooks/use-desktop.ts 不存在(桥接端被移动/改名,请同步本守门)')
}
const bridgeText = textOf(CONTENTS, BRIDGE_REL)

// listen('xxx') 出现位置 → 块 = [当前位置, 下一个 listen 或文件末]
const LISTEN_RE = /listen(?:<[^>]*>)?\(\s*'([a-z][a-z0-9-]*)'/g
const listenPositions = [...bridgeText.matchAll(LISTEN_RE)].map((m) => ({
  event: m[1],
  index: m.index,
}))

/** 事件名 → { cases: Set<action>, dispatches: Set<customEvent>, source: string } */
const bridge = new Map()
let caseHits = 0
let dispatchHits = 0

for (let i = 0; i < listenPositions.length; i++) {
  const cur = listenPositions[i]
  const end = i + 1 < listenPositions.length ? listenPositions[i + 1].index : bridgeText.length
  const block = bridgeText.slice(cur.index, end)
  const entry = bridge.get(cur.event) ?? { cases: new Set(), dispatches: new Set() }
  for (const m of block.matchAll(/case\s*'([a-z_]+)':/g)) {
    entry.cases.add(m[1])
    caseHits++
  }
  for (const m of block.matchAll(/new CustomEvent\(\s*'([a-z][a-z0-9:-]*)'/g)) {
    entry.dispatches.add(m[1])
    dispatchHits++
  }
  bridge.set(cur.event, entry)
}

console.log(
  `  listen() ${listenPositions.length} 处, case 分支 ${caseHits} 个, CustomEvent 派发 ${dispatchHits} 处`,
)
for (const [event, entry] of [...bridge.entries()].sort()) {
  console.log(
    `  ${C.dim}bridge:${C.reset} ${event}${C.reset} → cases[${[...entry.cases].join(', ') || '无'}] → dispatches[${[...entry.dispatches].join(', ')}]`,
  )
}

/** 桥接端派发的所有 CustomEvent 名 */
const allDispatches = new Set()
for (const entry of bridge.values()) {
  for (const d of entry.dispatches) allDispatches.add(d)
}

// ============================================================================
// [3/3] 层 3: 前端消费方扫描
// ============================================================================

console.log(`\n${C.cyan}[3/3] 层3: 前端消费方扫描${C.reset}`)

/** CustomEvent 名 → 消费来源 */
const consumers = new Map()
function addConsumer(name, source) {
  if (!consumers.has(name)) consumers.set(name, new Set())
  consumers.get(name).add(source)
}

/**
 * 规则 D 用:apps/web/src 内部(非桥接文件)的 CustomEvent 派发点。
 * 2026-09-22 立:规则 C 只盯 use-desktop.ts 一条桥接链,结果像 `ihui:retry-message`
 * (消息气泡「重试」按钮)这类组件层派发到空气的缺陷照样溜出去 —— 与本 gate 守护的
 * 托盘「切换主题/打开设置」是**同一个失效模式**(dispatch 成功、零副作用),故一并纳入守护。
 */
const webDispatches = new Map()
function addWebDispatch(name, source) {
  if (!webDispatches.has(name)) webDispatches.set(name, new Set())
  webDispatches.get(name).add(source)
}
/** 正则命中偏移 → 行号 */
const lineOf = (text, index) => text.slice(0, index).split('\n').length

// WEB_SRC_DIR / BRIDGE_REL 等路径常量在上方"取材面"一节统一定义,这里只声明计数
let literalListenerHits = 0
let registryKeyHits = 0

/**
 * 事件注册表常量块:`addEventListener(event, handler)` 这种变量形态注册静态扫不到,
 * 故把形如 `const XXX_ROUTES: Record<string, string> = { 'global-shortcut:new-chat': '/chat', ... }`
 * 的映射表 key 一并计入消费方(表名约定以 ROUTES / EVENTS 结尾)。
 */
const REGISTRY_BLOCK_RE =
  /const\s+[A-Z][A-Z0-9_]*_(?:ROUTES|EVENTS)\s*(?::\s*Record<[^>]*>)?\s*=\s*\{([\s\S]*?)\n\}/g

for (const f of WEB_FILES) {
  const text = textOf(CONTENTS, f)
  for (const m of text.matchAll(/addEventListener\(\s*'([a-z][a-z0-9:-]*)'/g)) {
    addConsumer(m[1], `${f} (addEventListener)`)
    literalListenerHits++
  }
  for (const m of text.matchAll(REGISTRY_BLOCK_RE)) {
    for (const k of m[1].matchAll(/'([a-z][a-z0-9:-]*)'/g)) {
      addConsumer(k[1], `${f} (事件注册表常量)`)
      registryKeyHits++
    }
  }
  // 规则 D:同一文件内的派发点(dispatchEvent(new CustomEvent('xxx')))
  for (const m of text.matchAll(/dispatchEvent\(\s*new CustomEvent\(\s*'([a-z][a-z0-9:-]*)'/g)) {
    addWebDispatch(m[1], `${f}:${lineOf(text, m.index)}`)
  }
}

console.log(
  `  扫描 ${WEB_FILES.length} 个文件: 字面量监听 ${literalListenerHits} 处, 注册表常量 ${registryKeyHits} 处`,
)

// ============================================================================
// 自失效防护(防空转变绿)
// ============================================================================

console.log(`\n${C.cyan}扫描器自失效防护${C.reset}`)

const SANITY_MIN = [
  {
    label: 'Rust emit 命中数',
    actual: rustEmitHits,
    // 8 → 7 自 2026-09-27(5637972f4c):tray.quit 不再 emit,改由 Rust 原生退出
    // (lib.rs 的 "tray.quit" 分支 = arm_forced_exit + app.exit(0))。
    // **这一维掉 1 不是无人看守了**:那个分支的去向由规则 H 认(它同时把 show/hide 两向一并纳管),
    // 且下面新加的「托盘菜单项数」把整张菜单钉在 7 项 —— 少一项、或某项没有去向,都当场判红。
    min: 7,
    hint: '托盘 4 action(quit 走原生分支,去向由规则 H 判)+ before-close + 快捷键 2',
  },
  {
    label: 'Rust emit 事件名数',
    actual: rustEmits.size,
    min: 3,
    hint: 'tray-action / shortcut / before-close',
  },
  {
    label: '托盘菜单项数',
    actual: trayAudit.items.size,
    min: 7,
    hint: 'new_chat / show / hide / theme / settings / update / quit —— 规则 H 的覆盖面基线',
  },
  {
    label: '托盘项有去向的分支数',
    actual: trayAudit.emitted + trayAudit.native,
    min: 7,
    hint: 'emit 与原生效果**合起来**必须覆盖全部 7 项(只认 emit 的旧判据对原生形态失明)',
  },
  {
    label: '桥接端 listen 数',
    actual: listenPositions.length,
    min: 4,
    hint: 'tray / shortcut / before-close / deep-link',
  },
  // 2026-09-27:托盘「退出」改为 Rust 侧立即退出(5637972f4),桥接端的 `case 'quit'` 与它派发的
  // desktop-quit-request 随之消失 ⇒ 这两条期望数各减 1。这是"代码真少了一条"后的同步更新,
  // 不是放宽判据:阈值仍等于**当前真实条数**,再删一条立刻翻红。
  { label: '桥接端 case 分支数', actual: caseHits, min: 6, hint: 'tray 4 + shortcut 2' },
  {
    label: '桥接端 CustomEvent 派发数',
    actual: dispatchHits,
    min: 8,
    hint: '每个 case 各一处 + deep-link 的 sso-success',
  },
  {
    label: '前端消费点总数',
    actual: literalListenerHits + registryKeyHits,
    min: 50,
    hint: '含 SHORTCUT_ROUTES / MODE_SHORTCUT_EVENTS 注册表',
  },
  {
    label: 'web 组件层 CustomEvent 派发数',
    actual: webDispatches.size,
    min: 12,
    hint: '规则 D 基线: ihui:regenerate/branch/edit/reply/retry/scroll-to 等',
  },
]
for (const { label, actual, min, hint } of SANITY_MIN) {
  if (actual < min) {
    errors.push(
      `扫描器疑似失效: ${label} 仅命中 ${actual} 处(阈值 ${min})— ${hint}。正则/路径需随代码同步更新,禁止空转变绿`,
    )
  } else {
    passed.push(`扫描器健康: ${label} (${actual} ≥ ${min})`)
  }
}

// ============================================================================
// 三层闭环对账
// ============================================================================

console.log(`\n${C.cyan}三层闭环对账${C.reset}`)

// —— 规则 A: Rust emit 的事件名必须有桥接端 listen ——
console.log(`\n${C.cyan}规则 A: Rust emit 事件 ⊆ 桥接端 listen${C.reset}`)
let ruleAHits = 0
for (const event of rustEmits.keys()) {
  if (!bridge.has(event)) {
    errors.push(
      `链路断裂(规则 A): Rust emit 事件 "${event}" 但 use-desktop.ts 无 listen('${event}') — 事件发出后无人接收`,
    )
    console.log(`  ${C.red}✗ ${event}: Rust 有 emit 但桥接端无 listen${C.reset}`)
    ruleAHits++
  }
}
if (ruleAHits === 0) {
  console.log(`  ${C.green}✓ 全部 ${rustEmits.size} 个 Rust 事件均有桥接端监听${C.reset}`)
  passed.push(`规则 A: Rust emit 事件全部有桥接端 listen (${rustEmits.size} 个)`)
}

// —— 规则 B: Rust emit 的 (事件, action) 必须在桥接端有 case ——
console.log(`\n${C.cyan}规则 B: Rust emit (事件, action) ⊆ 桥接端 case 分支${C.reset}`)
let ruleBHits = 0
let ruleBChecked = 0
for (const [event, actions] of rustEmits.entries()) {
  for (const action of actions) {
    if (action === UNIT_PAYLOAD) continue // 无 payload 事件不校验 case
    ruleBChecked++
    const entry = bridge.get(event)
    if (!entry) continue // 规则 A 已报错
    if (!entry.cases.has(action)) {
      errors.push(
        `链路断裂(规则 B): Rust emit "${event}" action "${action}" 但 use-desktop.ts 对应 listen 块内无 case '${action}' 分支 — 该 action 被静默丢弃`,
      )
      console.log(`  ${C.red}✗ ${event}/${action}: 桥接端无对应 case${C.reset}`)
      ruleBHits++
    }
  }
}
if (ruleBHits === 0) {
  console.log(`  ${C.green}✓ ${ruleBChecked} 个 (事件, action) 全部有 case 分支${C.reset}`)
  passed.push(`规则 B: Rust emit action 全部有桥接端 case 分支 (${ruleBChecked} 个)`)
}

// —— 规则 C: 桥接端派发的 CustomEvent 必须有消费方(本次事故核心规则)——
console.log(`\n${C.cyan}规则 C: 桥接端 CustomEvent ⊆ 前端消费方(防"点击没反应")${C.reset}`)
let ruleCHits = 0
let ruleCWhitelisted = 0
for (const name of [...allDispatches].sort()) {
  const points = consumers.get(name)
  if (!points || points.size === 0) {
    if (CONSUMER_WHITELIST_SET.has(name)) {
      const entry = CONSUMER_WHITELIST.find((w) => w.name === name)
      warnings.push(`规则 C 豁免: CustomEvent "${name}" 无前端消费方 — ${entry.reason}`)
      console.log(
        `  ${C.yellow}○ ${name}: 白名单豁免${C.reset} ${C.dim}— ${entry.reason}${C.reset}`,
      )
      ruleCWhitelisted++
      continue
    }
    errors.push(
      `链路断裂(规则 C): use-desktop.ts 派发 CustomEvent "${name}" 但 apps/web/src 全量无任何消费方 — ` +
        `表现为托盘菜单项/快捷键"点击完全没反应"。请在根级 Provider(props 稳定、不依赖深层组件挂载)补齐 addEventListener, ` +
        `或改派发到已存在的等价事件(如 global-shortcut:* 系列)。`,
    )
    console.log(`  ${C.red}✗ ${name}: 无消费方(点击无反应)${C.reset}`)
    ruleCHits++
  } else {
    console.log(`  ${C.green}✓ ${name}${C.reset} ${C.dim}← ${[...points].join(', ')}${C.reset}`)
  }
}
if (ruleCHits === 0) {
  passed.push(`规则 C: 全部 ${allDispatches.size} 个 CustomEvent 均有前端消费方`)
}

// —— 规则 D: apps/web/src 全量 CustomEvent 派发都应有监听方(2026-09-22 增)——
console.log(
  `\n${C.cyan}规则 D: apps/web/src 组件层 CustomEvent ⊆ 消费方(规则 C 的泛化版)${C.reset}`,
)
let ruleDHits = 0
let ruleDWhitelisted = 0
for (const name of [...webDispatches.keys()].sort()) {
  const points = consumers.get(name)
  if (points && points.size > 0) continue // 已有监听方(含同文件自产自销)
  if (CONSUMER_WHITELIST_SET.has(name)) {
    const entry = CONSUMER_WHITELIST.find((w) => w.name === name)
    warnings.push(`规则 D 豁免: CustomEvent "${name}" 无监听方 — ${entry?.reason ?? '见白名单'}`)
    console.log(
      `  ${C.yellow}○ ${name}: 白名单豁免${C.reset} ${C.dim}— ${entry?.reason ?? ''}${C.reset}`,
    )
    ruleDWhitelisted++
    continue
  }
  const sites = [...(webDispatches.get(name) ?? [])].join(', ')
  errors.push(
    `链路断裂(规则 D): ${sites} 派发 CustomEvent "${name}",但 apps/web/src 全量无 addEventListener('${name}') — ` +
      `用户触发该交互后零副作用(按钮点了没反应,与桌面托盘菜单同型)。` +
      `修法二选一:① 在正确的挂载点补监听(MessageList / 根 Provider,别挂在会被卸载的深层组件);` +
      `② 删掉这段死派发,直接调用目标能力(store action / router.push / hook 函数)。`,
  )
  console.log(`  ${C.red}✗ ${name}: 派发到空气${C.reset} ${C.dim}← ${sites}${C.reset}`)
  ruleDHits++
}
if (ruleDHits === 0) {
  console.log(`  ${C.green}✓ ${webDispatches.size} 个组件层 CustomEvent 派发全部有监听方${C.reset}`)
  passed.push(`规则 D: apps/web/src ${webDispatches.size} 个 CustomEvent 派发全部有监听方`)
}

// ============================================================================
// 规则 E: 两条链的语义分层(continuous 实时链 / replayable 重放链)
// ============================================================================

console.log(`\n${C.cyan}规则 E: 链语义分层对账${C.reset}`)

const REPLAY_FILES = [
  { file: WEB_AGENT_CONTROL_REL, label: '桌面 agent.action 消费端' },
  { file: EXT_AGENT_BRIDGE_REL, label: '扩展 agent.action 消费端' },
]

let ruleEErrors = 0
/**
 * 规则 E 的取文**只查本轮取材面**(与层1/2/3 同一份 CONTENTS,不再各读一次盘)。
 * 面上没有这个路径 ⇒ '' ⇒ 下面的判据按"取不到内容"报红,与旧实现同形。
 */
const chainRead = (p) => textOf(CONTENTS, p)
const bridgeChainText = chainRead(BRIDGE_REL)

// E1 —— 实时链不得混入重放语义
const e1 = findContinuousChainDrift(bridgeChainText)
for (const hit of e1) {
  errors.push(
    `链语义混用(规则 E1): 实时链桥接端 use-desktop.ts ${hit} —— 这条链的投递面(Tauri 事件总线)没有持久队列,` +
      `按 requestId 去重/补发只会把"投递失败"伪装成"已处理"。重放语义属 replayable 链` +
      `(api \`agent.action\` + \`_pending\` 会合),不得搬进这里。`,
  )
  console.log(`  ${C.red}✗ E1 use-desktop.ts 混入重放语义:${hit}${C.reset}`)
  ruleEErrors++
}
if (e1.length === 0) {
  passed.push('规则 E1: 实时链(use-desktop.ts)无重放语义载体')
  console.log(`  ${C.green}✓ E1 实时链保持 continuous 本性(无 id / 无队列)${C.reset}`)
}

// E2 —— 重放链不得丢掉幂等标记
for (const { file, label } of REPLAY_FILES) {
  const src = chainRead(file)
  if (!src) {
    errors.push(`规则 E2 无法判定: ${file} 取不到内容(被移动/改名?)—— 判据不得静默放过`)
    ruleEErrors++
    continue
  }
  const problems = findReplayableIdempotencyLoss(src, label)
  for (const p of problems) {
    errors.push(
      `链语义断裂(规则 E2): ${p} —— replayable 链的投递保证是"至少一次"(WS 重连/同用户多连接都会重复送达),` +
        `去掉幂等键等于让同一条指令执行两次(重复输入/重复点击),而这只在断线时显形。`,
    )
    console.log(`  ${C.red}✗ E2 ${p}${C.reset}`)
    ruleEErrors++
  }
  if (problems.length === 0) {
    passed.push(`规则 E2: ${file} 保留 requestId 幂等`)
    console.log(`  ${C.green}✓ E2 ${file} 幂等键在位${C.reset}`)
  }
}

// E3 —— 链名必须写进源码(不写进源码的命名等于不存在)
for (const { file, chain } of [
  { file: BRIDGE_REL, chain: CHAIN_CONTINUOUS },
  { file: WEB_AGENT_CONTROL_REL, chain: CHAIN_REPLAYABLE },
]) {
  const src = chainRead(file)
  const problems = src ? findChainNameMarker(src, chain, file) : [`未取到 ${file}`]
  for (const p of problems) {
    errors.push(
      `链命名缺失(规则 E3): ${p} —— 本仓把两条桌面链定名为 ${CHAIN_CONTINUOUS} / ${CHAIN_REPLAYABLE},` +
        `标记必须随行,否则改 stream/snapshot/queue 时仍会只验到另一条链。`,
    )
    console.log(`  ${C.red}✗ E3 ${p}${C.reset}`)
    ruleEErrors++
  }
  if (problems.length === 0) {
    passed.push(`规则 E3: ${file} 带 chain: ${chain} 标记`)
    console.log(`  ${C.green}✓ E3 ${file} 标注 chain: ${chain}${C.reset}`)
  }
}
if (ruleEErrors === 0) {
  console.log(
    `  ${C.dim}分层结论:两条链分属不同通道(Tauri 事件总线 ↔ WS agent.action + api _pending),` +
      `故本规则只钉"不得混用、不得摘标记",不引入新的载体${C.reset}`,
  )
}

// ============================================================================
// 规则 F: Rust 主进程不得持有 task/session 业务状态
// ============================================================================

console.log(`\n${C.cyan}规则 F: Rust 进程状态归属对账${C.reset}`)

/** 层1 的 .rs 清单只在取材那一遍走一次(旧实现在这里又遍历了一遍目录、又读了一遍盘) */
const rustFiles = RUST_FILES
let rustDeclTotal = 0
let ruleFErrors = 0
for (const f of rustFiles) {
  const text = textOf(CONTENTS, f)
  rustDeclTotal += countRustStateDecls(text)
  for (const v of findRustStateViolations(text, f)) {
    errors.push(`状态归属越界(规则 F): ${v}`)
    console.log(`  ${C.red}✗ ${v}${C.reset}`)
    ruleFErrors++
  }
}
if (rustFiles.length > 0 && rustDeclTotal === 0) {
  errors.push(
    `扫描器疑似失效(规则 F): apps/desktop/src-tauri/src 共 ${rustFiles.length} 个 .rs,` +
      `进程级状态声明扫到 0 处 —— HEAD 至少有窗口节流表,判据不得空转变绿`,
  )
  console.log(`  ${C.red}✗ F 声明计数为 0,判据失效${C.reset}`)
  ruleFErrors++
}
if (ruleFErrors === 0) {
  passed.push(`规则 F: Rust ${rustFiles.length} 个 .rs / ${rustDeclTotal} 处进程级状态,无业务状态持有者`)
  console.log(
    `  ${C.green}✓ F Rust 进程级状态 ${rustDeclTotal} 处,逐个标识符/类型都不含业务名词(无清单豁免)${C.reset}`,
  )
}

// ============================================================================
// 规则 G: 深链「未就绪不丢,就绪后补投」机制对账(2026-09-26 立 · A10C-1)
// ============================================================================

console.log(`\n${C.cyan}规则 G: 深链就绪闸门机制对账(desktop-deep-link)${C.reset}`)

if (!rustLibText) {
  // 取不到被审文件 ≠ 通过 —— 与本门其余判据同一条规矩
  errors.push(`规则 G 无法判定: ${G_DEEP_LINK_RUST_FILE} 未在本轮 Rust 扫描中取到内容(改名/搬走?)—— 深链机制不再被看守`)
  console.log(`  ${C.red}✗ G ${G_DEEP_LINK_RUST_FILE} 取不到,计「无法判定」${C.reset}`)
} else if (!bridgeText) {
  errors.push(`规则 G 无法判定: ${G_DEEP_LINK_BRIDGE_FILE} 内容为空 —— 深链机制不再被看守`)
  console.log(`  ${C.red}✗ G 桥接端取不到内容,计「无法判定」${C.reset}`)
} else {
  const gViolations = auditDeepLinkMechanism(rustLibText, bridgeText, rustNavText)
  for (const v of gViolations) {
    errors.push(`深链机制断裂(规则 G): ${v}`)
    console.log(`  ${C.red}✗ ${v}${C.reset}`)
  }
  if (gViolations.length === 0) {
    passed.push('规则 G: 深链闸门 7 组判据(唯一出口/未就绪入队/上限计数/取即清/销毁清账/时序/同名)全部在位')
    console.log(
      `  ${C.green}✓ G 深链闸门机制在位:${C.dim} 未就绪⇒暂存 / 队列有上限且丢弃计数 / 取即清 / Destroyed 清账 / 先 listen 后 take${C.reset}`,
    )
  }
}

// ============================================================================
// 规则 H: 托盘菜单项去向对账(2026-09-27 立 —— 随写法变更同步扫描器,不是放宽判据)
// ============================================================================

console.log(`\n${C.cyan}规则 H: 托盘菜单项去向对账(emit 或原生效果,二者必居其一)${C.reset}`)

if (!rustLibText) {
  errors.push(
    `规则 H 无法判定: ${RUST_LIB_REL} 未在本轮取材中取到内容 —— 托盘项去向不再被看守(不记为通过)`,
  )
  console.log(`  ${C.red}✗ H ${RUST_LIB_REL} 取不到,计「无法判定」${C.reset}`)
} else {
  for (const v of trayAudit.violations) {
    errors.push(`托盘接线断裂(规则 H): ${v}`)
    console.log(`  ${C.red}✗ ${v}${C.reset}`)
  }
  if (trayAudit.violations.length === 0) {
    passed.push(
      `规则 H: 托盘 ${trayAudit.items.size} 项全部有可识别去向(emit ${trayAudit.emitted} / 原生 ${trayAudit.native})`,
    )
    console.log(
      `  ${C.green}✓ H 托盘 ${trayAudit.items.size} 项均有去向${C.reset} ` +
        `${C.dim}emit:[${trayAudit.emitIds.join(', ')}] 原生:[${trayAudit.nativeIds.join(', ')}]` +
        ` — quit 走原生即 5637972f4c 的写法变更,本判据认它${C.reset}`,
    )
  }
}

// ============================================================================
// 规则 G9: 整页导航发起点必须先触发"存草稿"出口(2026-09-29 立 · G-407 票①)
//
// 病灶:`lib.rs` 的 CloseRequested 无条件 `emit("desktop-before-close", ())` —— 注释原文
// "三种去向都照发…先存草稿"。而 `auto_refresh.rs` 的五处 `eval("location.reload()" /
// "location.href=…")` 由宿主直接掀掉渲染端,那条 emit 一次都不会发生 ⇒ 热刷新/离线切换
// 时正在编辑的草稿整块丢失,现象却长在"关掉重开就没存住"上,极难归因。
//
// 定级(§12e 前置):现读 HEAD 面**存量非零**(见下方打印的"本轮发起点/缺口"数字),
// 所以锚点取「该文件 HEAD 自身的缺口数」⇒ 全量档只报数、`--staged` 只拦本次带进来的新账。
// 当场把存量判红就是一台与任何提交都无关的恒红门,唯一结局是各会话 `--no-verify`、
// 连带链上全部守门对该提交作废。
//
// 与 G8 的分工:G8 判"导航前有没有复位深链闸门",G9 判"导航前有没有触发存草稿" —— 两问
// 正交,同面同轮。G9 **反向依赖** G8 那一份 `collectPageNavSites` 枚举与它的"找不到发起点
// 即失明"护栏,自己不再复制一条(镜像测试 T9 把这条形状钉死)。
// ============================================================================

console.log(`\n${C.cyan}规则 G9: 整页导航发起点必须先触发存草稿出口(desktop-before-close)${C.reset}`)

/**
 * 一批路径在 **HEAD 面**的缺口锚点。三条结论必须分开:
 *  - 路径在 HEAD 面上**不存在** ⇒ 本次新增文件 ⇒ 锚点显式 0(它带进来的每一条缺口都是新账);
 *  - 路径在面上但正文取不到 ⇒ **根本不写进 Map** ⇒ 调用方读成"未判定",只报名不判红
 *    (拿 0 顶缸等于把"没判"写成"这次新增了 N 条",与本仓"把没判写成判过了"同禁);
 *  - 正常 ⇒ 用与判据**完全相同**的那一遍扫描算缺口数(同一份实现,此处禁止再抄一条正则)。
 */
function pageNavHeadAnchors(relPaths) {
  const out = new Map()
  if (relPaths.length === 0) return out
  let listed
  try {
    listed = gitRaw(
      ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...relPaths],
      ROOT,
      { timeout: GIT_LS_TIMEOUT },
    )
      .split('\0')
      .filter(Boolean)
  } catch {
    // 整个 HEAD 面问不到 ⇒ 全部落"未写进 Map"(调用方报未判定,不判红)
    return out
  }
  const inHead = new Set(listed)
  const toRead = relPaths.filter((p) => inHead.has(p))
  let got = new Map()
  if (toRead.length > 0) {
    try {
      got = catBatch(ROOT, toRead.map((p) => `HEAD:${p}`), { maxBuffer: 1 << 28 })
    } catch {
      got = new Map()
    }
  }
  for (const p of relPaths) {
    if (!inHead.has(p)) {
      out.set(p, 0) // 新文件:锚点显式 0
      continue
    }
    const text = got.get(`HEAD:${p}`)
    if (typeof text !== 'string') continue // 在面上却取不到 ⇒ 未判定
    const masked = blankComments(text, { apostropheIsStringDelimiter: !/\.rs$/.test(p) })
    out.set(p, auditPageNavExit(p, masked, text).gaps)
  }
  return out
}

const g9Judged = []
const g9RendererLedger = []
const g9ProbeLines = []
for (const [rel, raw] of CONTENTS) {
  if (!/\.(rs|ts|tsx)$/.test(rel)) continue
  const masked = blankComments(raw, { apostropheIsStringDelimiter: !/\.rs$/.test(rel) })
  const info = auditPageNavExit(rel, masked, raw)
  if (info.sites > 0) {
    // 判红只落在宿主面:整页导航绕过的是**宿主的** CloseRequested 闸,出口也住在宿主侧。
    // 渲染面(`window.location.*`)的站点逐文件报名、不进判据 —— 那里没有宿主闸可绕,
    // 而要求的出口(`desktop-before-close`)当前零消费方,判红只会逼人派发一个空操作或写假豁免。
    if (pageNavScopeOf(rel) === 'host') g9Judged.push(info)
    else g9RendererLedger.push({ rel, sites: info.sites, lines: info.counted.map((s) => s.line) })
  }
  for (const n of info.probes) g9ProbeLines.push(`${rel}:${n}`)
}

const g9Sites = g9Judged.reduce((a, i) => a + i.sites, 0)
const g9Gaps = g9Judged.reduce((a, i) => a + i.gaps, 0)
const g9Exempted = g9Judged.reduce((a, i) => a + i.exempted, 0)
console.log(
  `  宿主面发起点 ${g9Sites} 处 / 缺出口 ${g9Gaps} 处 / 逐行豁免放过 ${g9Exempted} 处 / ` +
    `盲区(eval 载体行读不出载荷,不判也不静默)${g9ProbeLines.length} 处`,
)
if (g9ProbeLines.length > 0)
  console.log(
    `  ${C.dim}盲区报名:${g9ProbeLines.slice(0, 12).join(', ')}` +
      `${g9ProbeLines.length > 12 ? ` …共 ${g9ProbeLines.length} 处` : ''}${C.reset}`,
  )
if (g9RendererLedger.length > 0) {
  const n = g9RendererLedger.reduce((a, i) => a + i.sites, 0)
  console.log(
    `  ${C.yellow}⚠ 渲染面同类发起点 ${n} 处 / ${g9RendererLedger.length} 文件 —— **未纳入 G9 射程**,逐条报名` +
      `(判它的前置是先给 desktop-before-close 立一个真消费方,那是 web 端持有人的职权,不是这道门能顺手判的)${C.reset}`,
  )
  for (const i of g9RendererLedger)
    console.log(`      ${C.dim}${i.rel} ${i.sites} 处[第 ${i.lines.join('/')}]${C.reset}`)
}

// 锚点:全量档判的就是 HEAD ⇒ 锚点即本轮读数(存量只报数);索引/工作树档才去 HEAD 现读
let g9Reds = []
const g9AnchorUndetermined = []
if (g9Gaps > 0) {
  const dirty = g9Judged.filter((i) => i.gaps > 0)
  const anchors =
    FACE === 'head'
      ? new Map(dirty.map((i) => [i.rel, i.gaps]))
      : pageNavHeadAnchors(dirty.map((i) => i.rel))
  const dec = decidePageNavReds(g9Judged, anchors)
  g9Reds = dec.reds
  g9AnchorUndetermined.push(...dec.unanchored)
}

for (const r of g9Reds) {
  const where = r.counted.map((s) => `${s.line}`).join('/')
  errors.push(
    `整页导航未触发存草稿(规则 G9): ${r.rel} 有 ${r.gaps} 处整页导航发起点而本文件没有 desktop-before-close 出口` +
      `(HEAD 锚点 ${r.anchor},本次新增 ${r.added})第 ${where} 行 —— 宿主掀掉渲染端时那条 emit 不会发生,草稿随页面一起丢。` +
      `补法:导航前 .emit("desktop-before-close", ()) / 调用同一个草稿落盘出口;确属"该导航不涉及草稿",` +
      `在发起点同行或其上一行写 page-nav-exempt: <原因>`,
  )
  console.log(`  ${C.red}✗ G9 ${r.rel} 新增 ${r.added} 处(锚点 ${r.anchor} → 现读 ${r.gaps})第 ${where} 行${C.reset}`)
}
if (g9AnchorUndetermined.length > 0) {
  console.log(
    `  ${C.yellow}⚠ G9 锚点未判定:${g9AnchorUndetermined.join(', ')} —— HEAD 面上有该路径却取不到正文,` +
      `本轮对这些文件**不出具**"没有新增"的结论(既不冒红也不记绿)${C.reset}`,
  )
}
if (g9Reds.length === 0 && g9Gaps > 0) {
  // 存量必须**逐文件报名**:只印一个总数,拿到数字的人无法判断哪些是同一件事、
  // 该由谁清 —— 派单会要么整片重派、要么谁都不派(守门 128"报名不得只报数"同一条)。
  const per = g9Judged
    .filter((i) => i.gaps > 0)
    .map((i) => `${i.rel} ${i.gaps} 处[第 ${i.counted.map((s) => s.line).join('/')} 行]`)
  console.log(
    `  ${C.yellow}⚠ G9 存量 ${g9Gaps} 处未清(${per.length} 个文件;逐条带原因的新账才会判红,` +
      `不得为让本行归零去改判据)${C.reset}`,
  )
  for (const p of per) console.log(`      ${C.dim}${p}${C.reset}`)
}
if (g9Sites > 0 && g9Gaps === 0 && g9Exempted === 0) {
  passed.push(`规则 G9: ${g9Sites} 处整页导航发起点全部落在有存草稿出口的文件内`)
  console.log(`  ${C.green}✓ G9 发起点 ${g9Sites} 处均有出口${C.reset}`)
}

// ============================================================================
// 汇总
// ============================================================================

console.log(`\n${'='.repeat(60)}`)
console.log(`${C.cyan}桌面端事件链路接线守门汇总${C.reset}`)
console.log(`${'='.repeat(60)}`)
console.log(
  `层1 Rust emit: ${rustEmitHits} 处 / ${rustEmits.size} 事件 | 层2 桥接: ${listenPositions.length} listen | 层3 消费: ${consumers.size} 事件`,
)
// 结论行必须点名取材面:同一份"通过/失败"在三个面上可以各自成立,
// 不带面的读法无法判断它说的是哪一次提交(与守门 36/93/124 同形)。
console.log(`取材面: ${FACE_TXT[FACE]}`)
console.log(`${C.green}通过检查: ${passed.length}${C.reset}`)
console.log(`${C.yellow}白名单豁免(不阻断): ${ruleCWhitelisted + ruleDWhitelisted}${C.reset}`)
console.log(`${C.red}错误(阻断): ${errors.length}${C.reset}`)

if (errors.length > 0) {
  console.log(`\n${C.red}阻断 commit:${C.reset}`)
  for (const e of errors) console.log(`  - ${e}`)
  console.log(`\n修复路径: 补齐缺失的一层接线(参考 use-desktop.ts 顶部注释的事件/消费方对照表)`)
  console.log(`紧急跳过: HUSKY_SKIP_DESKTOP_EVENT_WIRING=1 git commit ...(需 PR 说明)`)
  process.exit(1)
}

console.log(`\n${C.green}✅ 桌面端事件链路三层接线闭环通过${C.reset}`)
process.exit(0)
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
