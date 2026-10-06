// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「枚举取不到 ⇒ 静默落到更宽的权限/能力档」判据(G-816027,2026-10-05 立)。
 *
 * 拦这两型(票面原文的病灶形态):
 *  ① `switch` 的 `default` 分支返回更宽的权限/能力档 —— 上游实测锚点是
 *     `subagent.ts:476-489` 的 `default: return parentMode`(认不出的 permissionMode
 *     **静默继承父档**,父为 yolo 时权限即被放大)。我方 HEAD 面该形态现量 0(动手前复跑过
 *     `git grep -cE "default: *(return|=) *(parent|ctx|config)" HEAD -- apps/cli/src/subagents
 *     packages/types/src/permission-mode.ts` ⇒ RC=1 无输出),写成结论前先把它当**并列事实**记着。
 *  ② 同族的 `x?.enumKey ?? <档名字面量>` —— 票面 W6-69 补注点名的**我方真站点**是
 *     `apps/cli/src/commands/agent.ts` 的 `const dangerLevel = tool?.dangerLevel ?? 'read';`
 *     (未声明即取档,再喂下一行的 `checkPermission`)。
 *
 * Python 侧同语法锚点必须一起认(守门 117 那一课:漏一种语法 = 该语言整型隐身):
 * `match/case` 的 `case _`、`.get(key, 宽档)`、`X or 宽档`。
 *
 * 判据(唯一一条,不放宽):只有当兜底/默认值**落在权限或能力的宽档集合内**才判红。
 * 宽档集合**由被审面的类型定义现读推导**,门内不写第二份档名清单(清单必然腐烂):
 *  · 档名来自 `packages/types/src/permission-mode.ts` 的 `PERMISSION_MODES` /
 *    `PERMISSION_MODE_ALIASES` / `PERMISSION_MODE_WIRE` 与
 *    `apps/ai-service/app/core/permission_mode.py` 的 `PERMISSION_MODES` 元组;
 *  · "宽"这条性质也来自同一张面:`POLICY_BY_MODE` 里策略名含 `auto-approve` 的档,
 *    且必须与 Python 侧 `skips_approval_permission_mode()` 的成员元组**逐字相等** ——
 *    两侧推导冲突 ⇒ 整个集合判「未判定」,绝不各取一侧。
 *  · ToolClass / ApprovalClass / ChatMode 的字面量**不参与判红**:被审面只给了工具轴的
 *    严重度表(`_TOOLS_SEVERITY`),审批轴没有;而 'all' 与 'none' 在两轴同名反极
 *    (工具轴 'all'=全开最宽,审批轴 'all'=逐个审批最严),同一字面量在两面之间无从判定
 *    ⇒ 落「未判定」并点名。这不是偷懒,是拒绝在门里补一份"哪个档更宽"的手抄结论。
 *  · 集合推导不出来 ⇒ 判「未判定」并点名原因,绝不记为通过(--strict 下 exit 2)。
 *
 * G-816027 补账(2026-10-05 现读 7 处未判定的逐条定性,结论写在这里以便下次复跑对得上):
 *  · (b) 正当形态 1 处 —— `apps/cli/src/commands/agent.ts:2961` `stopReasonToExitCode()` 的
 *    `default: return 1`:兜底值是**数字**退出码,而本门四份词表全部由字符串字面量推导,
 *    数字在集合构造上不可能被含进;该槽位(switch 主表达式 `reason`)也不踩权限轴。
 *    ⇒ 判据里给了这条绿路(见 `classify()` 内注释),它从"未判定"移到"放过(带理由)"。
 *    边界一并钉死:权限轴槽位上的数字兜底(`switch (permissionMode) { default: return 0 }`)
 *    仍是未判定 —— 那要读消费方才知道 0 是宽是严(成对锁 ES29)。
 *  · (c) 判不出 6 处 —— 形态都已经被认到,缺的是"这一处的档名是不是那个它"之外的知识,
 *    而且它不在本门的判据形状里(本门只答"缺席取到的那个值是不是宽档"):
 *      ① `permission_mode.py:361` `or "build"`(ChatMode 轴两极:工具轴全开 / 审批轴不放宽);
 *      ② `agent.ts:2271` `?? 'read'`(dangerLevel 词表声明在 `tools/index.ts:156`,射程外;
 *        而真正的宽严住在 `tools/permissions.ts` 的 mode 矩阵里 —— "取最窄档名 ⇒ 消费方给免批"
 *        这一条不在本门的形状里,补它要把消费方读进来,属另一型 ⇒ 留未判定,不代主会话落槌);
 *      ③ `agent.ts:1575` `?? 'auto'`(需要 `Settings.nativeFunctionCalling` 的声明类型,射程外);
 *      ④ `precedence.ts:212` `?? 'none'`(隔离轴 'none'=从不隔离最宽,与工具轴 'none' 同名反极);
 *      ⑤ `worker-entry.ts:197` `?? 'default'`(modelId 是路由键,词表在别的包);
 *      ⑥ `permission-mode.ts:150` `?? 'unknown'`(展示层哨兵,要读它的消费方才知道会不会被当档用)。
 *    六处一律保留未判定并逐条点名;`--strict` 因此仍出 exit 2。**没有**为了归零去猜档名或塞白名单。
 *  · (a) 判据盲区:7 处未判定本身都不是形态盲区(它们全是已认到的 `??` / `default:` 写法)。
 *    但形态盲区确实存在,只是它不体现在未判定计数里(**没入候选的站点根本不计数**):
 *    解构默认值、JS 形参默认值、Python `def` 形参默认值这三型 HEAD 面 0 落点、全仓 958 个产品文件
 *    仅 5 处正当写法(实测见探针),旧版一条都不认 ⇒ 本次一并补锚(形态②b)+ 成对自检 ES21–ES27。
 *    仍**未**补的两型如实登记:三元 else 支(`cfg ? cfg.mode : '宽档'` —— 条件是不是"在场测试"要读
 *    上半句才能知道,收进来必带假红)与 `Object.assign` 默认对象(方向决定语义,写反了就不是缺席)。
 *
 * 与既有门的分工(不得重叠计账,守门 83 那格写过:同一处两门各计一次会让两份基线互相顶掉):
 *  · `scripts/check-credential-presence-bypass.mjs`(G-459)判的是**按凭据在场即放行**
 *    —— 形态是 `if (request.headers['x-…']) return`,条件里带凭据引用 + 体是裸 return;
 *  · `scripts/check-gate-presence-exemption.mjs` 判的是**按门/开关在场即豁免**;
 *  · 本门判的是**按枚举缺席即取档** —— 形态必须带 `default:` / `case _:` / `?? | \|\| | or |
 *    .get(k, 值)` 的兜底槽位,或"只在没给参数时才生效"的解构/形参默认值(G-816027 补的形态②b)。
 *    两族在语法形态上互斥(凭据门那一族没有兜底字面量,本门不认
 *    裸 `if (x) return`),故同一站点不会被两门各记一次;反向锁在 `--self-test` ES11/ES27 与镜像
 *    测试 T12 里钉着,不靠人记得(G-816027 交付时另跑了双向站点比对:另两门在本门射程内 0 站点,
 *    本门 11 处候选与它们交集为空)。
 *
 * 口径同 70/77/83/98/101/103/118/135/150:全量档判 **HEAD blob**、`--staged` 判**索引 blob**、
 * `--worktree` 仅人工逃生舱、两面旗同给判死、取不到判「无法判定」且**不回落**另一个面、
 * 枚举到 0 个候选判死不记绿;清单与正文**同面同轮**取(一次 `cat-file --batch`)。
 * 遮罩只引 `scripts/lib/code-mask.mjs` 那一份实现:JS/TS 侧用 `maskedSpans`(注释+字符串都遮,
 * 本门判的是代码形态,而档名住在字符串里 ⇒ 按**偏移**判定"这个形态是不是写在注释/串内"),
 * Python 侧的 `#` 注释用同层的 `scanScriptCommentSpans(src,'sh')`(同一份分词器族里唯一认 `#`
 * 的档)。**已记盲区**(写在这里而不是假装没有):code-mask 没有 Python 方言,三引号 docstring
 * 的体不被当作串遮 ⇒ 若某句散文恰好写成 `or "bypassPermissions"` 形态,本门会把它判进来。
 * 现读的 py 面上没有这一型;补 Python 方言之前不把它说成"已覆盖"。
 *
 * 定级:**warn**。默认面只报数 + 逐处点名,不判红(存量非零时恒红门的唯一结局是逼人
 * `--no-verify`,连带链上全部守门作废,§12e/§12f);`--strict` 才把判红转成 exit 1、
 * 把"未判定"转成 exit 2(拒绝出具合格证)。升 blocking 的前置条件是真实 HEAD 面现读 0,
 * 且**不得为变绿放宽判据**。
 *
 * 手动:`node scripts/check-enum-default-widening.mjs [--staged|--worktree|--json|--strict|--self-test]`
 * 注册与记账由主会话单做(本次交付不动 guardian-runner / package.json)。
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import {
  maskedSpans,
  maskScriptComments,
  scanScriptCommentSpans,
} from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT_MS = 120_000

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
}

/**
 * 射程:票面写的是 `apps/cli/src/subagents/**` + 两侧档定义文件。
 * 第四个目标 `apps/cli/src/commands/agent.ts` 是**票面 W6-69 补注点名的真站点所在文件** ——
 * 不把它放进射程,本门就对自己立项那一型失明(判据覆盖门要防的写法,是同仓反复记过的第一条
 * 设计约束;第一版漏掉 `x?.enumKey ?? 档` 的教训就写在这段注释里)。
 * 加目标必须同批改本注释,否则会出现"扫到了但没判"的静默失明。
 */
const SCAN_DIRS = ['apps/cli/src/subagents']
const TS_REGISTRY = 'packages/types/src/permission-mode.ts'
const PY_REGISTRY = 'apps/ai-service/app/core/permission_mode.py'
const REAL_SITE_FILE = 'apps/cli/src/commands/agent.ts'
const REGISTRY_FILES = [TS_REGISTRY, PY_REGISTRY]
const SCAN_TARGETS = [...SCAN_DIRS, ...REGISTRY_FILES, REAL_SITE_FILE]
const SCAN_EXTS = /\.(ts|mts|js|mjs|cjs|py)$/
const TESTISH = /(\.test\.|\.spec\.|__tests__|[/\\]tests[/\\])/

/** 结构词太通用,当"档槽位"证据会让门把每次赋值都读成权限判定(实测 modelId/status 这类)。 */
const GENERIC_TOKENS = new Set([
  'id',
  'ids',
  'key',
  'keys',
  'value',
  'values',
  'name',
  'names',
  'error',
  'raw',
  'out',
  'by',
  'check',
  'list',
  'dict',
  'tuple',
  'final',
  'literal',
  'annotations',
  'cast',
])

// ─── 取材:清单与正文同面同轮 ────────────────────────────────────────────────
function listFiles(face, root) {
  const args =
    face === 'head'
      ? ['ls-tree', '-r', '--name-only', 'HEAD', '--', ...SCAN_TARGETS]
      : ['ls-files', '--', ...SCAN_TARGETS]
  return gitRaw(args, root, { timeout: GIT_TIMEOUT_MS })
    .split(/\r?\n/)
    .filter((p) => p && SCAN_EXTS.test(p) && !TESTISH.test(p))
}

/** 本次带进来的路径(--staged 收窄用,免得存量红期间人人必红,§12e)。 */
function stagedPaths(root) {
  return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], root, {
    timeout: GIT_TIMEOUT_MS,
  })
    .split(/\r?\n/)
    .filter(Boolean)
}

// ─── 集合推导(唯一一处手写的"从哪读",没有第二份档名清单)──────────────────
/** 取 `NAME = [ ... ]` / `NAME: Final[tuple[...]] = ( ... )` 里的字面量成员(按声明序)。 */
function arrayMembers(src, name) {
  const re = new RegExp(`\\b${name}\\b[^=\\n]*=\\s*[\\[(]`, 'm')
  const m = re.exec(src)
  if (!m) return null
  const open = src[m.index + m[0].length - 1]
  const close = open === '[' ? ']' : ')'
  let depth = 0
  let i = m.index + m[0].length - 1
  for (; i < src.length; i++) {
    if (src[i] === open) depth++
    else if (src[i] === close) {
      depth--
      if (depth === 0) break
    }
  }
  const body = src.slice(m.index + m[0].length, i)
  return [...body.matchAll(/(['"])((?:(?!\1)[^\\\n]|\\.*)*)\1/g)].map((x) => x[2])
}

/** 取 `NAME = { k: 'v', ... }` 的成对映射(键可带引号,TS 的 `as const` / Py 的注解都吃得下)。 */
function dictPairs(src, name) {
  const re = new RegExp(`\\b${name}\\b[^{=]*=\\s*\\{`, 'm')
  const m = re.exec(src)
  if (!m) return null
  let depth = 0
  let i = m.index + m[0].length - 1
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) break
    }
  }
  const body = src.slice(m.index + m[0].length, i)
  const pairs = []
  for (const line of body.split('\n')) {
    const e = /^\s*(?:['"]([^'"]+)['"]|([A-Za-z_$][\w$]*))\s*:\s*(['"])((?:(?!\3)[^\\]|\\.)*)\3/.exec(
      line,
    )
    if (e) pairs.push({ key: e[1] ?? e[2], value: e[4] })
  }
  return pairs
}

/** `type ToolClass = 'all' | 'readonly' | 'none'` / `ToolClass = Literal["all", ...]`。 */
function unionMembers(src, name) {
  const re = new RegExp(`\\b${name}\\b[^=\\n]*=\\s*([^\\n;]*)`, 'm')
  const m = re.exec(src)
  if (!m) return null
  return [...m[1].matchAll(/(['"])((?:(?!\1)[^\\\n]|\\.*)*)\1/g)].map((x) => x[2])
}

/** Python 的 `mode in ("a", "b")` 成员元组(skips_approval_permission_mode 的判据面)。 */
function pySkipsApproval(src) {
  const m = /\bdef skips_approval_permission_mode\b[\s\S]{0,800}?\bin \(([^)]*)\)/.exec(src)
  if (!m) return null
  const vals = [...m[1].matchAll(/(['"])((?:(?!\1)[^\\]|\\.)*)\1/g)].map((x) => x[2])
  return vals.length ? vals : null
}

/** 驼峰 + 蛇形 + 中划线拆词,并去一个尾 's'(modes→mode、classes→class)。 */
export function tokensOf(text) {
  const out = new Set()
  for (const piece of String(text ?? '').split(/[^A-Za-z0-9]+/)) {
    for (const w of piece.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/\s+/)) {
      if (!w || w.length < 3) continue
      out.add(w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)
    }
  }
  return out
}

/**
 * 从两侧注册表推导档名宇宙。返回:
 *  `{ok, reason, wide, narrow, classes, chat, axisTokens, nameTokens, evidence}`
 * `ok:false` 时**所有**候选一律落未判定(推导不出集合 ≠ 集合为空)。
 */
export function deriveUniverse(tsRaw, pyRaw) {
  const evidence = []
  const failures = []
  // 注册表自身的散文不是判据面:先剥注释(字符串留着 —— 档名就住在字符串里)。
  const ts = typeof tsRaw === 'string' ? maskScriptCommentsGuard(tsRaw, 'js') : ''
  const py = typeof pyRaw === 'string' ? maskScriptComments(pyRaw, 'sh') : ''

  const tsIds = arrayMembers(ts, 'PERMISSION_MODES')
  const pyIds = arrayMembers(py, 'PERMISSION_MODES')
  const tsAlias = dictPairs(ts, 'PERMISSION_MODE_ALIASES')
  const pyAlias = dictPairs(py, 'PERMISSION_MODE_ALIASES')
  const tsWireMap = dictPairs(ts, 'PERMISSION_MODE_WIRE')
  const tsPolicy = dictPairs(ts, 'POLICY_BY_MODE')
  const pySkips = pySkipsApproval(py)
  const tsToolClasses = unionMembers(ts, 'ToolClass')
  const tsApprovalClasses = unionMembers(ts, 'ApprovalClass')
  const pyToolClasses = unionMembers(py, 'TOOL_CLASSES')
  const pyApprovalClasses = unionMembers(py, 'APPROVAL_CLASSES')
  const tsChatIds = unionMembers(ts, 'ChatModeId') ?? arrayMembers(ts, 'CHAT_MODE_IDS')
  const pyChatIds = unionMembers(py, 'ChatModeId') ?? arrayMembers(py, 'CHAT_MODES')

  if (!tsIds || !tsIds.length) failures.push(`${TS_REGISTRY} 的 PERMISSION_MODES 成员表读不出`)
  if (!pyIds || !pyIds.length) failures.push(`${PY_REGISTRY} 的 PERMISSION_MODES 成员表读不出`)
  if (!tsPolicy || !tsPolicy.length) failures.push(`${TS_REGISTRY} 的 POLICY_BY_MODE 策略表读不出`)
  if (!pySkips) failures.push(`${PY_REGISTRY} 的 skips_approval_permission_mode 成员元组读不出`)
  if (!tsAlias || !tsAlias.length) failures.push(`${TS_REGISTRY} 的 PERMISSION_MODE_ALIASES 读不出`)
  if (!pyAlias || !pyAlias.length) failures.push(`${PY_REGISTRY} 的 PERMISSION_MODE_ALIASES 读不出`)
  if (tsIds && pyIds && tsIds.join(',') !== pyIds.join(','))
    failures.push(
      `两侧 PERMISSION_MODES 成员不同序/不等值(TS=${tsIds.join('/')} | PY=${pyIds.join('/')})`,
    )

  // "宽"这条性质也必须是现读的,不是门里写死的:策略名含 auto-approve = 审批被跳过。
  const wideFromPolicy = new Set(
    (tsPolicy ?? []).filter((p) => /auto-approve/.test(p.value)).map((p) => p.key),
  )
  const skips = new Set(pySkips ?? [])
  if (tsPolicy && pySkips) {
    const a = [...wideFromPolicy].sort().join(',')
    const b = [...skips].sort().join(',')
    if (a !== b) failures.push(`宽档两侧推导冲突(TS 策略=${a || '空'} vs PY 免批元组=${b || '空'})`)
  }
  const allIds = [...new Set([...(tsIds ?? []), ...(pyIds ?? [])])]
  if (!allIds.length) failures.push('档名宇宙为空 ⇒ 无从判定任何回落值')
  for (const id of wideFromPolicy)
    if (!allIds.includes(id)) failures.push(`免批档 ${id} 不在 PERMISSION_MODES 里(注册表自相矛盾)`)

  // 拼写闭包:规范档 + 别名键(指向宽档的那些)+ wire 拼写,全部从表里取,不手写。
  const wide = new Set()
  const narrow = new Set()
  const wideIds = new Set(allIds.filter((id) => wideFromPolicy.has(id) || skips.has(id)))
  const addSpell = (set, v) => {
    if (v) set.add(v)
  }
  for (const id of allIds) (wideIds.has(id) ? wide : narrow).add(id)
  for (const a of [...(tsAlias ?? []), ...(pyAlias ?? [])]) {
    addSpell(wideIds.has(a.value) ? wide : narrow, a.key)
    addSpell(wideIds.has(a.value) ? wide : narrow, a.value)
  }
  // wire 表的键就是规范档 ⇒ 宽严跟着**键**判,值(kebab 拼写)只是多一个面具。
  for (const w of tsWireMap ?? []) addSpell(wideIds.has(w.key) ? wide : narrow, w.value)

  const classes = new Set(
    [...(tsToolClasses ?? []), ...(pyToolClasses ?? []), ...(tsApprovalClasses ?? []), ...(pyApprovalClasses ?? [])],
  )
  const chat = new Set([...(tsChatIds ?? []), ...(pyChatIds ?? [])])
  for (const v of [...wide]) narrow.delete(v)

  // 槽位词表也从同一张面取(声明名拆词),不在门里另写"mode|permission|…"关键字清单。
  const declaredNames = [
    ...String(ts).matchAll(/\b(?:export\s+)?(?:const|type|function)\s+([A-Za-z_$][\w$]*)/g),
    ...String(py).matchAll(/^\s*(?:def|class)\s+([A-Za-z_][\w]*)/gm),
    ...String(py).matchAll(/^([A-Z][A-Z0-9_]*)\s*:/gm),
    ...String(py).matchAll(/^([A-Za-z_][\w]*)\s*=\s*(?:Literal|Final)/gm),
  ].map((m) => m[1])
  const nameTokens = tokensOf(declaredNames.join(' '))
  for (const t of GENERIC_TOKENS) nameTokens.delete(t)
  // "槽位像不像权限/能力档"的证据词表**就是同一张面上声明名拆出来的词**,不另写关键字清单
  // (写第二份清单就是本票明令禁止的那件事)。
  const axisTokens = nameTokens

  evidence.push(
    `宽档集合由 ${TS_REGISTRY}(POLICY_BY_MODE 含 auto-approve)+ ${PY_REGISTRY}(skips_approval 元组)现读推导`,
  )
  return {
    ok: failures.length === 0,
    reason: failures.join(';') || null,
    wide,
    narrow,
    classes,
    chat,
    nameTokens,
    axisTokens,
    ids: allIds,
    evidence,
  }
}

/** JS/TS 的注释遮噪用同一份 lib 的 maskComments 语义,但**保长度**(偏移要对得上原文)。 */
function maskScriptCommentsGuard(src, lang) {
  if (lang !== 'js') return maskScriptComments(src, 'sh')
  // JS 侧的注释区间由 maskedSpans 给(kind==='comment'),等长遮罩自己不做词法。
  const out = src.split('')
  for (const s of maskedSpans(src)) {
    if (s.kind !== 'comment') continue
    for (let k = s.start; k < s.end && k < out.length; k++)
      if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' '
  }
  return out.join('')
}

// ─── 判据 ────────────────────────────────────────────────────────────────────
/** 一个回落值能不能被本门定性?返回 {kind, why}。 */
export function classify(expr, slotText, u, keyText = '') {
  if (!u.ok)
    return { kind: 'undetermined', why: `档名集合推导失败:${u.reason};不得把"没判"写成"判过了"` }
  const body = String(expr ?? '')
  // 判序要紧:`throw new Error('unknown permissionMode')` 里也有字符串 —— 先认"显式抛错"这一支,
  // 否则门会把自己的合法出口读成兜底字面量(成对自检 ES2 钉的就是这条)。
  if (/^\s*(?:throw|raise)\b/.test(body)) return { kind: 'green', why: '显式抛错,不静默取档' }
  /**
   * 槽位一致性:档名会跨词表撞名(实测 `'auto'` 既是 acceptEdits 的历史别名拼写,也是
   * `settings.nativeFunctionCalling ?? 'auto'` 的原生 FC 三态档;`'none'` 既是工具轴也是隔离档)。
   * 集合-membership 只回答"这个名字是不是宽档",回答不了"这一处的它是不是那个它"。
   * 所以红与绿都要过同一道**槽位**检验(判据对被检对象的适用性),过不了就落未判定并点名 ——
   * 两侧同尺,不在宽档一侧冒红、在窄档一侧静默放过。
   */
  const slotKey = keyText || slotText
  const axisHit = [...tokensOf(slotKey)].some((t) => u.axisTokens.has(t))
  /**
   * G-816027 定性第 (b) 类(正当形态)的落槌处:HEAD 面 7 处未判定里,
   * `apps/cli/src/commands/agent.ts:2961` 的 `stopReasonToExitCode()` 里 `default: return 1`
   * 是**这一档**。为什么它不属本型(写在判据旁边而不是只写在报告里):
   *  · 本门的四份词表(wide / narrow / classes / chat)全部由**字符串字面量**现读推导 ——
   *    纯数字字面量在集合构造上就不可能被含进任何一份,这不是"猜它不是档",是推导器给的界;
   *  · 该处"缺席"取的是**退出码**(给 CI/脚本读的返回值),与展示名/颜色/排序键同族,
   *    它放大或收窄的不是权限,是"这次运行算不算失败"。
   * 只在槽位**没踩到权限轴**(axisHit 为假)时这样放过:`switch (permissionMode) { default: return 0 }`
   * 那一型("消费方把 0 读成允许")仍落未判定 —— 要读消费方才知道 0 是宽是严,不在本门射程。
   * 收窄的是这一处的形态,不是宽严判据本身:默认返回宽档仍是红(ES1/ES29 成对钉着)。
   */
  if (!axisHit && /^\s*-?\d[\d_]*\s*$/.test(body))
    return {
      kind: 'green',
      why: `兜底值 ${body.trim()} 是数字字面量(退出码/计数一类的数值),不可能落在任何由字符串档名推导出的集合里;且槽位(${clip(slotKey, 40)})未踩权限轴 ⇒ 该处"缺席"取的不是档,不属本型`,
    }
  const lit = stringLiteralOf(body)
  if (lit === null) {
    return {
      kind: 'undetermined',
      why: `兜底值 ${expr.trim().slice(0, 40) || '(空)'} 不是档名字面量(变量/表达式),无法证明它不落在宽档集合`,
    }
  }
  if (u.wide.has(lit)) {
    if (!axisHit)
      return {
        kind: 'undetermined',
        why: `回落值 '${lit}' 是现读推导出的免批档拼写,但该兜底槽位(${clip(slotKey, 40)})不像权限/能力档 ⇒ 同名跨词表,判不出它此处指权限档还是别的枚举 ⇒ 不冒红也不放过`,
      }
    return {
      kind: 'red',
      why: `回落档 '${lit}' 属免审批/自动放行档(由被审面的 POLICY_BY_MODE + skips_approval 元组现读推导)⇒ 枚举缺席即放大权限`,
    }
  }
  if (u.classes.has(lit))
    return {
      kind: 'undetermined',
      why: `回落值 '${lit}' 落在 ToolClass/ApprovalClass 两轴同名而宽严相反的字面量集里,被审面没有可推导的审批轴严重度表 ⇒ 判不出属于哪一轴`,
    }
  if (u.chat.has(lit))
    return {
      kind: 'undetermined',
      why: `回落值 '${lit}' 是 ChatMode 档:工具轴给它全开、审批轴不放宽,两轴结论相反 ⇒ 判不出宽严`,
    }
  if (u.narrow.has(lit)) {
    if (!axisHit)
      return {
        kind: 'undetermined',
        why: `回落值 '${lit}' 是权限档名,但该槽位(${clip(slotKey, 40)})不像权限/能力档 ⇒ 同名跨词表,判不出它此处指什么`,
      }
    return { kind: 'green', why: `回落档 '${lit}' 在被审面上不收窄审批(非免批档),不属本型` }
  }
  return {
    kind: 'undetermined',
    why: `回落值 '${lit}' 不在被审面可推导的任何档词表内(该枚举的词表声明处不在射程)⇒ 无从判定宽严`,
  }
}

/** 报告里的证据文本要短要单行(整行源码进结论会把一条未判定写成一首诗)。 */
function clip(text, n) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n)
}

/**
 * 取算符**左边紧邻的那个标识符**(允许 `a.b?.c` 的取属性形态与 `f(x)` 的调用形态)。
 * 它是"这一处的槽位是不是权限/能力档"的最直接证据 —— 用整行文本当证据会被同一行里的
 * 无关标识符顶掉(实测 `settings.nativeFunctionCalling ?? 'auto'` 那行的 `'tools'` 就来自上一行)。
 */
function keyBeforeOp(text, opIdx) {
  const left = String(text ?? '').slice(0, opIdx).replace(/[ \t]+$/, '')
  const call = /([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*$/.exec(left)
  if (call) return call[1]
  const prop = /([A-Za-z_$][\w$]*)\s*(?:\?\.|\.)?\s*$/.exec(left)
  return prop ? prop[1] : ''
}

/** 取 `switch (X)` / `match X:` 的主表达式(它是 default / `case _` 分支的槽位)。 */
function subjectOfSwitch(head) {
  const m = /\bswitch\s*\(([^)]{0,120})\)/.exec(String(head ?? ''))
  return m ? m[1] : ''
}
function subjectOfMatch(beforeText) {
  const all = [...String(beforeText ?? '').matchAll(/\bmatch\s+([^\n:]{0,120}):/g)]
  return all.length ? all[all.length - 1][1] : ''
}

/** 取表达式里第一个字符串字面量的**体**;不是字面量返回 null。 */
function stringLiteralOf(expr) {
  const m = /(['"])((?:(?!\1)[^\\]|\\.)*)\1/.exec(String(expr ?? ''))
  if (m) return m[2]
  return null
}

/** 该偏移是否写在注释或字符串里(遮罩只引一份实现:maskedSpans 给注释+串区间,py 另并 `#` 区间)。 */
function buildNoise(text, lang) {
  const noise = new Uint8Array(text.length)
  for (const s of maskedSpans(text))
    for (let k = s.start; k < s.end && k < noise.length; k++) noise[k] = 1
  if (lang === 'py')
    for (const [from, to] of scanScriptCommentSpans(text, 'sh'))
      for (let k = from; k < to && k < noise.length; k++) noise[k] = 1
  return noise
}

function lineStarts(text) {
  const out = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') out.push(i + 1)
  return out
}

/** 取"这一处兜底属于哪个槽位"的证据文本:本行算符左侧 + 赋值/声明目标 + .get 的键。 */
function slotTextFor(text, starts, matchStart, extra) {
  let ln = 0
  while (ln + 1 < starts.length && starts[ln + 1] <= matchStart) ln++
  const from = starts[ln]
  const left = text.slice(from, matchStart)
  const prevLine = ln > 0 ? text.slice(starts[ln - 1], starts[ln]) : ''
  return `${prevLine}${left}${extra ?? ''}`.slice(-240)
}

/**
 * 扫一个文件,返回候选清单(每条带分类)。
 * `u` 是集合推导的结果;`u.ok===false` 时每条都是未判定并带同一条原因。
 */
export function scanSource(rel, src, u) {
  const lang = /\.py$/.test(rel) ? 'py' : 'js'
  const noise = buildNoise(src, lang)
  const starts = lineStarts(src)
  const lineOf = (off) => {
    let ln = 0
    while (ln + 1 < starts.length && starts[ln + 1] <= off) ln++
    return ln + 1
  }
  const isCode = (i) => !noise[i]
  const out = []
  const push = (off, expr, slot, form, key = '') => {
    const c = classify(expr, slot, u, key)
    out.push({
      file: rel,
      line: lineOf(off),
      form,
      expr: String(expr ?? '').trim().slice(0, 60),
      kind: c.kind,
      why: c.why,
    })
  }

  // 形态①:JS/TS 的 switch → default 分支;Python 的 match → `case _:` 分支。
  if (lang === 'js') {
    for (const m of src.matchAll(/\bswitch\s*\(/g)) {
      if (!isCode(m.index)) continue
      const blockEnd = matchBrace(src, afterChar(src, m.index + m[0].length, '{'), noise)
      if (blockEnd < 0) {
        out.push({
          file: rel,
          line: lineOf(m.index),
          form: 'switch-default',
          expr: '(配平失败)',
          kind: 'undetermined',
          why: 'switch 块花括号配平失败 ⇒ 该 switch 的 default 分支判不出,不猜',
        })
        continue
      }
      const region = src.slice(m.index, blockEnd)
      for (const d of region.matchAll(/\bdefault\s*:/g)) {
        const abs = m.index + d.index + d[0].length
        if (!isCode(abs - 1)) continue
        const rest = region.slice(d.index + d[0].length)
        const stop = firstClauseEdge(rest)
        const body = rest.slice(0, stop)
        if (!body.trim()) continue // 空 default(fallthrough)不取任何档
        push(
          abs,
          decisiveExpr(body),
          region.slice(0, d.index),
          'switch-default',
          subjectOfSwitch(region.slice(0, d.index)),
        )
      }
    }
  } else {
    for (const m of src.matchAll(/^\s*case\s+_\s*:/gm)) {
      if (!isCode(m.index + m[0].length - 1)) continue
      const caseIndent = (/^[ \t]*/.exec(m[0])?.[0] ?? '').length
      const after = src.slice(m.index + m[0].length)
      const bodyEnd = pyIndentedBody(after, caseIndent)
      const body = after.slice(0, bodyEnd)
      if (!body.trim()) continue
      push(
        m.index,
        decisiveExpr(body),
        src.slice(Math.max(0, m.index - 300), m.index),
        'case-underscore',
        subjectOfMatch(src.slice(Math.max(0, m.index - 1500), m.index)),
      )
    }
  }

  // 形态②:兜底槽位 `x ?? 'lit'` / `x || 'lit'` / Python `x or "lit"` / `d.get(k, "lit")`。
  const res =
    lang === 'py'
      ? [
          {
            re: /\bor\s+(['"])((?:(?!\1)[^\\]|\\.)*)\1/g,
            lit: (m) => m[2],
            extra: () => '',
          },
          {
            // `d.get(k, "档")`:键也要进槽位证据(真仓的 `cfg.get("permission_mode", …)` 就靠它)
            re: /\.get\s*\(\s*([^,()\n]+?)\s*,\s*(['"])((?:(?!\2)[^\\]|\\.)*)\2\s*\)/g,
            lit: (m) => m[3],
            extra: (m) => ` ${m[1]}`,
            key: (m) => m[1],
          },
        ]
      : [
          {
            re: /(?:\?\?|\|\|)\s*(['"])((?:(?!\1)[^\\]|\\.)*)\1/g,
            lit: (m) => m[2],
            extra: () => '',
          },
        ]
  for (const { re, lit: litOf, extra: extraOf, key: keyOf } of res) {
    for (const m of src.matchAll(re)) {
      if (!isCode(m.index)) continue
      const lit = litOf(m)
      const slot = slotTextFor(src, starts, m.index, extraOf(m))
      const keyText = keyOf ? keyOf(m) : keyBeforeOp(src, m.index)
      const slotTok = tokensOf(slot)
      const uTokens = u.nameTokens
      let mentionsSlot = false
      for (const t of slotTok)
        if (uTokens.has(t)) {
          mentionsSlot = true
          break
        }
      const isTierName =
        u.wide.has(lit) || u.narrow.has(lit) || u.classes.has(lit) || u.chat.has(lit)
      // 候选的**入队**条件放宽(槽位提到注册表词表里的词,或回落值本身就是档名),
      // 但只收"像档名"的字面量:空串与散文(`?? '上下文已超出模型窗口…'`)不是枚举档,
      // 收进来只会把 12 条信号淹成 30 条噪声。收窄的是**形态**,不是宽严判据。
      const tierShaped = /^[A-Za-z][\w.:-]{0,48}$/.test(lit)
      // 但集合推不出时**这道收窄本身不可信**(词表是残缺的)⇒ 一律入候选,由 classify 落未判定。
      if (u.ok && !(tierShaped && mentionsSlot) && !isTierName) continue
      push(m.index, `'${lit}'`, slot, lang === 'py' ? 'py-fallback' : 'js-fallback', keyText)
    }
  }

  /**
   * 形态②b(G-816027 补的三道锚):兜底值写在**只有"没给参数"才生效**的语法位上 ——
   *  · JS 解构默认值 `const { permissionMode = '宽档' } = ctx`
   *  · JS 形参默认值 `function f(permissionMode = '宽档')` / `(a, mode = '宽档') =>` / 方法签名
   *  · Python def 形参默认值 `def resolve(permission_mode="宽档")`
   * 这三型此前**整型隐身**(票面把它们列为"判据盲区"要点名的形态;实测:HEAD 面 12 文件 0 落点,
   * 全仓 958 个产品文件里该写法有 5 处正当样本,一条都没被读过)。
   * 为什么按语法位置收、而不是按整行 `name = '值'` 收:普通赋值(`mode = 'auto'`)与关键字实参
   * (`dict(permission_mode="auto")`)都是**无条件写死**,不是"缺席即取档",收进来就是把别的判据的
   * 地盘扫成本型 ⇒ 假红。签名与调用的区分靠收尾:JS 只认 `) [返回类型] {` 或 `) =>`(调用点的 `)`
   * 后面紧跟 `;`/`,`/`)`,进不来),Python 只认 `def …(…):`(含 `-> 注:` 形态)。
   * 入队过滤与形态②共用同一条(档形字面量 + 槽位提到注册表词,或本身就是档名),
   * 遮噪与行号也走同一套偏移判定 ⇒ 新锚不引入第二把尺子。
   */
  const defShapes =
    lang === 'py'
      ? [/\b(?:async\s+)?def\s+[\w$]+\s*\(([^()]*)\)\s*(?:->[^:\n]{0,80})?:/g]
      : [
          /\{([^{}]*)\}\s*=\s*(?=[A-Za-z_$([])/g,
          /\(([^()]*)\)\s*(?::[^(){};=]{0,80})?\s*(?:\{|=>)/g,
        ]
  const anchored = new Set()
  for (const re of defShapes) {
    for (const m of src.matchAll(re)) {
      const grp = m[1]
      if (!grp) continue
      const gStart = m.index + m[0].indexOf(grp)
      for (const d of grp.matchAll(/(?:^|[{,(])\s*([A-Za-z_$][\w$]*)\s*=\s*(['"])((?:(?!\2)[^\\]|\\.)*)\2/g)) {
        const off = gStart + d.index + d[0].indexOf(d[2])
        // 遮噪判定取**等号那一位**,不取引号那一位:maskedSpans 的串区间含引号本身,
        // 拿引号位去问 isCode 会把自己刚认出来的合法形态判成"写在串里"(ES21 第一版就栽在这)。
        const codeProbe = gStart + d.index + d[0].indexOf('=')
        if (!isCode(codeProbe)) continue
        if (anchored.has(off)) continue
        anchored.add(off)
        const lit = d[3]
        const keyText = d[1]
        const slot = `${slotTextFor(src, starts, codeProbe)} ${keyText}=`
        const uTokens = u.nameTokens
        let mentionsSlot = false
        for (const t of tokensOf(slot))
          if (uTokens.has(t)) {
            mentionsSlot = true
            break
          }
        const isTierName =
          u.wide.has(lit) || u.narrow.has(lit) || u.classes.has(lit) || u.chat.has(lit)
        const tierShaped = /^[A-Za-z][\w.:-]{0,48}$/.test(lit)
        if (u.ok && !(tierShaped && mentionsSlot) && !isTierName) continue
        push(off, `'${lit}'`, slot, 'default-param', keyText)
      }
    }
  }
  return out
}

/** 从 idx 起找第一个未被遮的 ch,返回其下标;找不到 -1。 */
function afterChar(text, idx, ch) {
  for (let i = idx; i < text.length; i++) if (text[i] === ch) return i
  return -1
}
/** 配对花括号(注释/串内的括号不算 —— 按 noise 面跳过)。 */
function matchBrace(text, openIdx, noise) {
  if (openIdx < 0) return -1
  let depth = 0
  for (let i = openIdx; i < text.length; i++) {
    if (noise[i]) continue
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) return i + 1
    }
  }
  return -1
}
/** default 体的收尾:下一个同层的 case/default 或块结束。 */
function firstClauseEdge(rest) {
  const m = /\b(?:case\s|default\s*:)/.exec(rest)
  const br = rest.indexOf('\n    }')
  return m ? m.index : br > 0 ? br : rest.length
}
/** 取 default/`case _` 体里**真正落槌**的那个表达式(先 return,再赋值,再整段)。 */
function decisiveExpr(body) {
  const t = String(body ?? '').trim().slice(0, 300)
  // 抛错族整段留给 classify(它认 `^\s*(throw|raise)`),否则关键字被剥掉就成了"表达式取不到档"。
  if (/^(?:throw|raise)\b/.test(t)) return t
  const r = /\breturn\b([^;\n]*)/.exec(t)
  if (r) return r[1]
  const a = /^[A-Za-z_$][\w$.[\]?]*\s*[:=]\s*([^;\n]+)/.exec(t)
  if (a) return a[1]
  return t
}

/** Python `case _:` 的体:同行余文 + 之后比 `case` 行更缩进的连续行。 */
function pyIndentedBody(after, caseIndent) {
  const lines = after.split('\n')
  const first = lines[0] ?? ''
  if (first.trim()) return first.length
  let used = 0
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i]
    if (!l.trim()) {
      used += l.length + 1
      continue
    }
    const ind = (l.match(/^[ \t]*/)?.[0] ?? '').length
    if (ind <= caseIndent) break
    used += l.length + 1
  }
  return used
}

// ─── 判定(把候选折成三态,三态不并桶)──────────────────────────────────────
export function decide(candidates) {
  const red = []
  const green = []
  const undetermined = []
  for (const c of candidates) {
    if (c.kind === 'red') red.push(c)
    else if (c.kind === 'green') green.push(c)
    else undetermined.push(c)
  }
  return { red, green, undetermined }
}

export function analyze({ face, root = ROOT } = {}) {
  let files
  try {
    files =
      face === 'worktree'
        ? listFiles('head', root) // 磁盘档也按同一份清单走(读盘用 readWorktreeFile)
        : listFiles(face, root)
    if (face === 'staged') {
      const st = new Set(stagedPaths(root))
      files = files.filter((p) => st.has(p))
    }
  } catch (e) {
    throw new Error(`文件清单取不到:${String(e?.message ?? e).split('\n')[0]}`)
  }
  const pre = face === 'staged' ? ':' : 'HEAD:'
  // 注册表**总是**进同一批读取:它是量具,不能因为"本次暂存集里没有它"就取不到
  // (取不到量具 = 整门未判定,那是环境问题伪装成业务结论)。清单与正文仍同面同轮。
  const wantList = [...new Set([...files, ...REGISTRY_FILES])]
  const specs = wantList.map((p) => `${pre}${p}`)
  let contents
  try {
    contents =
      face === 'worktree'
        ? new Map()
        : catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT_MS })
  } catch (e) {
    throw new Error(`内容取不到:${String(e?.message ?? e).split('\n')[0]}`)
  }
  const read = (rel) => {
    if (face === 'worktree') {
      const r = readWorktreeFile(root, rel)
      return typeof r === 'string' ? r : null
    }
    return contents.get(`${pre}${rel}`) ?? null
  }
  const registry = {}
  const unreadableRegistries = []
  for (const rel of REGISTRY_FILES) {
    const t = read(rel)
    if (typeof t !== 'string') unreadableRegistries.push(rel)
    registry[rel] = t
  }
  const u = deriveUniverse(registry[TS_REGISTRY] ?? '', registry[PY_REGISTRY] ?? '')
  // 注册表在本面取不到 ⇒ 集合根本无从推导 ⇒ 整门判「无法判定」(exit 2),既不冒红也绝不记绿,
  // 并且**不回落另一个面**(口径同 70/77/83/98/101)。
  if (unreadableRegistries.length)
    return {
      files,
      universe: u,
      candidates: [],
      fatal: `注册表在本面取不到:${unreadableRegistries.join(' ')} ⇒ 档名集合无法推导(未判定,不回落另一个面)`,
    }
  const candidates = []
  const unreadable = []
  for (const rel of files) {
    const src = read(rel)
    if (typeof src !== 'string') {
      unreadable.push(rel)
      candidates.push({
        file: rel,
        line: 0,
        form: 'face',
        expr: '(取不到)',
        kind: 'undetermined',
        why: `${face} 面取不到该文件内容 ⇒ 未判定(不回落另一个面)`,
      })
      continue
    }
    candidates.push(...scanSource(rel, src, u))
  }
  return { files, universe: u, candidates, unreadable, registry, fatal: null }
}

// ─── 自检(成对:必须有牙,且证明牙咬在推导得出的集合上)──────────────────────
export function selfTest(root = ROOT) {
  let pass = 0
  let fail = 0
  const t = (name, cond, extra = '') => {
    if (cond) {
      pass++
      console.log(`✅ ${name}`)
    } else {
      fail++
      console.log(`${C.red}❌ ${name}${extra ? ` —— ${extra}` : ''}${C.reset}`)
    }
  }
  let a
  try {
    a = analyze({ face: 'head', root })
  } catch (e) {
    t(`EA1 真仓取材跑不动(未判定,不等于通过):${e.message}`, false)
    return { pass, fail, fatal: true }
  }
  const u = a.universe
  t('EA2 档名集合必须由两侧注册表现读推导成功', u.ok, u.reason ?? '')
  if (!u.ok) return { pass, fail, fatal: true }
  // 正控不手抄档名:拿推导出来的宽档/窄档当夹具(集合若腐烂,这一格自己会失真)。
  const WIDE = [...u.wide][0]
  const NARROW = [...u.narrow][0]
  t('EA3 宽档集合非空(否则本门对"落宽档"整型失明)', u.wide.size > 0, `wide=${u.wide.size}`)
  t('EA4 宽窄两集不得交叠', ![...u.wide].some((v) => u.narrow.has(v)))
  const sw = (body) => `function f(permissionMode){\n  switch (permissionMode) {\n    case 'plan': return 'ask';\n    default: ${body}\n  }\n}`
  const s = (src, lang = 'ts') => scanSource(`a.${lang}`, src, u)
  const reds = (r) => r.filter((x) => x.kind === 'red')
  const unds = (r) => r.filter((x) => x.kind === 'undetermined')

  // ① 票面验收第一条:default 返回更宽档 ⇒ 红
  t('ES1 default 返回宽档必须判红', reds(s(sw(`return '${WIDE}';`))).length === 1, JSON.stringify(s(sw(`return '${WIDE}';`))))
  // ② default 显式抛错 / 返回最窄档 ⇒ 绿
  t('ES2 default 抛错必须放过', s(sw('throw new Error("unknown permissionMode");')).every((x) => x.kind === 'green'), JSON.stringify(s(sw('throw new Error("x");'))))
  t('ES3 default 返回非宽档(推导出的窄档)必须放过', s(sw(`return '${NARROW}';`)).every((x) => x.kind === 'green'), JSON.stringify(s(sw(`return '${NARROW}';`))))
  // ③ 集合推导失败 ⇒ 未判定,绝不记为通过
  const broken = { ...u, ok: false, reason: '夹具:成员表读不出' }
  const r3 = s(sw(`return '${WIDE}';`), 'ts')
  const brokenRes = scanSource('a.ts', sw(`return '${WIDE}';`), broken)
  t('ES4 集合推导失败 ⇒ 一律未判定(不得记绿也不得记红)', brokenRes.length > 0 && brokenRes.every((x) => x.kind === 'undetermined') && reds(r3).length === 1, JSON.stringify(brokenRes))
  // ④ 注释与字符串里的形态不得命中(遮噪方向:判代码形态 ⇒ 注释/串都遮)
  const inComment = `// default: return '${WIDE}' 是错的写法\n/* const mode = ctx.permissionMode ?? '${WIDE}'; */\nconst x = 1;`
  t('ES5 注释里的该形态不得计入', s(inComment).length === 0, JSON.stringify(s(inComment)))
  const inString = `const doc = "const mode = ctx.permissionMode ?? '${WIDE}';";\nexport { doc };`
  t('ES6 字符串里的该形态不得计入', s(inString).length === 0, JSON.stringify(s(inString)))
  // Python 侧同语法锚点:漏一条 = 该语言整型隐身(守门 117 那一课)
  const pyCase = `def resolve(permission_mode: object) -> str:\n    match permission_mode:\n        case "plan":\n            return "ask"\n        case _:\n            return "${WIDE}"\n`
  t('ES7 Python `case _` 返回宽档必须判红', reds(s(pyCase, 'py')).length === 1, JSON.stringify(s(pyCase, 'py')))
  const pyGet = `def pick(cfg):\n    return cfg.get("permission_mode", "${WIDE}")\n`
  t('ES8 Python `.get(key, 宽档)` 必须判红', reds(s(pyGet, 'py')).length === 1, JSON.stringify(s(pyGet, 'py')))
  const pyOr = `def pick(permission_mode):\n    mode = permission_mode or "${WIDE}"\n    return mode\n`
  t('ES9 Python `x or 宽档` 必须判红', reds(s(pyOr, 'py')).length === 1, JSON.stringify(s(pyOr, 'py')))
  const pyComment = `# cfg.get("permission_mode", "${WIDE}") 是错的\n`
  t('ES10 Python 注释里的该形态不得计入', s(pyComment, 'py').length === 0, JSON.stringify(s(pyComment, 'py')))
  // 与凭据门不得重叠计账:同一处两门各计一次会让两份基线互相顶掉
  const credShape = `async function h(request, reply){\n  if (request.headers['x-internal-service-token']) return\n  if (!verifyCsrfToken(a, b)) return reply.status(403).send(1)\n}`
  t('ES11 凭据在场即放行的形态不属本型(与 check-credential-presence-bypass 分工,不双计)', s(credShape).length === 0, JSON.stringify(s(credShape)))
  // 票面点名的我方真站点:必须入候选,且按判据落未判定(集合推不到 dangerLevel 词表)
  const REAL = "          const dangerLevel = tool?.dangerLevel ?? 'read';"
  const rReal = s(REAL)
  t('ES12 agent.ts 真站点形态必须入候选', rReal.length === 1, JSON.stringify(rReal))
  t('ES13 该处必须落未判定并点名词表(不代主会话落槌,也不静默放过)', rReal.length === 1 && rReal[0].kind === 'undetermined', JSON.stringify(rReal))
  // 兜底不是档名也不是枚举槽位 ⇒ 不入候选(否则噪声淹信号)
  const noiseF = `const s = String(text ?? '')\nconst n = budget ?? 4\nconst arr = xs ?? []\n`
  t('ES14 非档名/非枚举槽位的兜底不得入候选', s(noiseF).length === 0, JSON.stringify(s(noiseF)))
  // default 返回变量(上游 parentMode 那一型):无法证明不落在宽档 ⇒ 未判定
  const rVar = s(sw('return parentMode;'))
  t('ES15 default 返回变量必须落未判定(不得读成干净,也不得凭空判红)', rVar.length === 1 && rVar[0].kind === 'undetermined', JSON.stringify(rVar))
  // 扫描面在位(空枚举判死,不记绿)
  t(`ES16 HEAD 面必须扫到射程内文件(现读 ${a.files.length} 个)`, a.files.length > 0)
  t('ES17 注册表两文件必须在扫描面内', REGISTRY_FILES.every((f) => a.files.includes(f)), JSON.stringify(a.files))
  // ES18/ES19 是现量逼出来的两格精度锁(HEAD 面第一版把 `'auto'` 那处读成了判红):
  //  ① 档名会跨词表撞名(`'auto'` 既是 acceptEdits 的历史别名拼写,也是 nativeFunctionCalling
  //     的三态档)⇒ 槽位不像权限/能力档时**不冒红**,落未判定并点名;
  //  ② 空串/散文/数字兜底不是档名形态,收进来只会把信号淹成噪声(实测 12 条未判定里 5 条是它)。
  const collide = `const nativeToolsMode =\n    opts.providerSupportsTools !== undefined\n      ? opts.providerSupportsTools\n      : settings.nativeFunctionCalling ?? '${WIDE}';`
  const rCol = s(collide)
  t(
    'ES18 档名跨词表撞名而槽位不是权限档 ⇒ 未判定(不冒红,也不静默放过)',
    rCol.length === 1 && rCol[0].kind === 'undetermined',
    JSON.stringify(rCol),
  )
  const prose = `const a = String(alert.toolName ?? '')\nconst b = reason ?? '上下文已超出模型窗口,请开新会话'\nconst c = budget ?? 4\n`
  t(
    'ES19 空串/散文/数字兜底不得入候选(收窄的是形态,不是宽严判据)',
    s(prose).length === 0,
    JSON.stringify(s(prose)),
  )
  // ES20 取材面纪律的机器面:同一处内容在 HEAD 面与索引面必须各自独立成读(不回落)
  t(
    'ES20 注册表必须进同一批 cat-file 规格(量具不得因"本次没暂存它"而取不到)',
    String(analyze).includes('...files, ...REGISTRY_FILES'),
    ' analyze() 里找不到"注册表总是进批次"这一句',
  )
  // ES21–ES26:G-816027 补的"缺席才生效"三道锚(解构默认值 / JS 形参默认值 / Python def 形参默认值)。
  // 成对方向都各给正反两例:新锚必须咬住推导出的宽档,同形的正当写法必须一条不收。
  const dParam = `function f(permissionMode = '${WIDE}') {\n  return permissionMode\n}`
  t('ES21 JS 形参默认值落宽档必须判红(旧版整型隐身)', reds(s(dParam)).length === 1, JSON.stringify(s(dParam)))
  const dArrow = `const g = (a, permissionMode = '${WIDE}') => a + permissionMode`
  t('ES22 箭头形参默认值同锚必须命中(不只在 function 形态上有牙)', reds(s(dArrow)).length === 1, JSON.stringify(s(dArrow)))
  const dDestruct = `const { permissionMode = '${WIDE}' } = ctx`
  t('ES23 解构默认值落宽档必须判红', reds(s(dDestruct)).length === 1, JSON.stringify(s(dDestruct)))
  const dPyDef = `def resolve(permission_mode="${WIDE}"):\n    return permission_mode\n`
  t('ES24 Python def 形参默认值落宽档必须判红', reds(s(dPyDef, 'py')).length === 1, JSON.stringify(s(dPyDef, 'py')))
  // 逐字取自全仓实测的 5 处正当写法(形参默认值写死 host/包名/展示串),它们都不是枚举档 ⇒ 一条不得入候选
  const legitDef = `function openBrowser(host = '127.0.0.1', errorType = 'unknown') {\n  return host\n}\nconst label = (packageName = '@ihui/cli') => packageName\n`
  t('ES25 成对:同形但兜底不是档名的形参默认值不得入候选(正当样本不被扫进)', s(legitDef).length === 0, JSON.stringify(s(legitDef)))
  const legitDestruct = `const { permissionMode = '${NARROW}' } = ctx`
  t('ES26 成对:解构默认值落非免批档 ⇒ 放过(既不得冒红也不得整条消失)', s(legitDestruct).length === 1 && s(legitDestruct)[0].kind === 'green', JSON.stringify(s(legitDestruct)))
  // 无条件写死不是"缺席即取档":关键字实参必须留在门外(否则本门侵占别的判据地盘并造出假红)
  const kwArg = `def build():\n    return dict(permission_mode="${WIDE}")\n`
  t('ES27 成对:Python 关键字实参(无条件写死)不属本型,不得入候选', s(kwArg, 'py').length === 0, JSON.stringify(s(kwArg, 'py')))
  // ES28–ES30:G-816027 定性 (b) —— `default: return 1` 这一档从"未判定"移到"放过"。
  // 夹具逐字取自 HEAD:apps/cli/src/commands/agent.ts:2940-2964(stopReasonToExitCode)。
  const exitCode = `export function stopReasonToExitCode(reason: AgentStopReason): number {\n  switch (reason) {\n    case 'error':\n      return 1;\n    default:\n      return 1;\n  }\n}`
  const rExit = s(exitCode)
  t('ES28 数字兜底且槽位不踩权限轴 ⇒ 放过(退出码不是档)', rExit.length === 1 && rExit[0].kind === 'green', JSON.stringify(rExit))
  const rAxisNum = s(sw('return 0;'))
  t('ES29 成对:同一数字兜底写在权限轴槽位上仍落未判定(不得把"数字"当成一律干净)', rAxisNum.length === 1 && unds(rAxisNum).length === 1, JSON.stringify(rAxisNum))
  const rAxisWide = s(sw(`return '${WIDE}';`))
  t('ES30 成对:加了数字这条绿路之后,default 返回宽档依旧是红(判据没被放宽)', reds(rAxisWide).length === 1, JSON.stringify(rAxisWide))
  return { pass, fail, fatal: false, live: a }
}

function reportLive(a) {
  const d = decide(a.candidates)
  return { ...d, files: a.files.length, candidates: a.candidates.length }
}

function main(argv) {
  if (argv.includes('--self-test')) {
    const r = selfTest()
    console.log(`\n[enum-default-widening] 自检 ${r.pass} 通过 / ${r.fail} 失败`)
    if (r.fail > 0 || r.fatal) return 1
    const lv = reportLive(r.live)
    console.log(
      `✅ 自检真仓对照:HEAD 面 扫 ${lv.files} 文件 / 候选 ${lv.candidates} / 判红 ${lv.red.length} / 放过 ${lv.green.length} / 未判定 ${lv.undetermined.length}`,
    )
    return 0
  }
  const sel = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (sel.error) {
    console.error(`${C.red}❌ ${sel.error}${C.reset}`)
    return 2
  }
  const strict = argv.includes('--strict')
  let a
  try {
    a = analyze({ face: sel.face })
  } catch (e) {
    console.error(`${C.red}❌ 无法判定(不冒红也不记绿):${e.message}${C.reset}`)
    return 2
  }
  if (a.fatal) {
    console.error(`${C.red}❌ 未判定(档名集合推导失败,绝不记为通过):${a.fatal}${C.reset}`)
    return 2
  }
  const d = decide(a.candidates)
  if (!a.universe.ok) {
    // 集合推导失败 = 门失灵:它既不是判红也不是放过,而是未判定,并且当场 exit 2 ——
    // 绝不因为"红数是 0"就被读成绿灯(把没判写成判过了是本仓最高频的失效型)。
    console.error(
      `${C.red}❌ 未判定:档名宽档集合推导失败 —— ${a.universe.reason}(候选 ${a.candidates.length} 处一律未判定,不记通过)${C.reset}`,
    )
    return 2
  }
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          face: sel.face,
          files: a.files,
          universe: {
            ok: a.universe.ok,
            reason: a.universe.reason,
            wide: [...a.universe.wide],
            ids: a.universe.ids,
            evidence: a.universe.evidence,
          },
          candidates: a.candidates,
          red: d.red,
          green: d.green,
          undetermined: d.undetermined,
          counts: {
            files: a.files.length,
            candidates: a.candidates.length,
            red: d.red.length,
            green: d.green.length,
            undetermined: d.undetermined.length,
          },
        },
        null,
        2,
      ),
    )
  } else {
    if (a.files.length === 0 && sel.face === 'staged') {
      console.log(
        `${C.cyan}[enum-default-widening] 判定面=staged:本次没有射程内文件 ⇒ 本门不适用,不是"已判定干净"。${C.reset}`,
      )
      return 0
    }
    if (a.files.length === 0) {
      console.error(`${C.red}❌ 枚举到 0 个候选文件 ⇒ 判据失明,不记通过${C.reset}`)
      return 2
    }
    console.log(
      `${C.cyan}[enum-default-widening] 判定面=${sel.face === 'worktree' ? '工作树(仅人工)' : sel.face}:扫 ${a.files.length} 文件;兜底/默认值候选 ${a.candidates.length} 处 —— 判红 ${d.red.length} / 放过 ${d.green.length} / 未判定 ${d.undetermined.length}。${C.reset}`,
    )
    console.log(
      `${C.cyan}   宽档集合来源:${a.universe.evidence.join(' / ')};现读宽档 ${[...a.universe.wide].join(' / ')}。${C.reset}`,
    )
    for (const c of d.red)
      console.log(`  ${C.red}❌ ${c.file}:${c.line} [${c.form}] ${c.expr} —— ${c.why}${C.reset}`)
    for (const c of d.undetermined)
      console.log(`  ${C.yellow}ℹ 未判定 ${c.file}:${c.line} [${c.form}] ${c.expr} —— ${c.why}${C.reset}`)
    for (const c of d.green)
      console.log(`  ${C.green}✅ ${c.file}:${c.line} [${c.form}] ${c.expr} —— ${c.why}${C.reset}`)
    if (d.red.length === 0 && d.undetermined.length === 0)
      console.log(`${C.green}✅ 射程内每一处兜底都不落在现读推导的宽档集合上。${C.reset}`)
    else if (d.red.length === 0)
      console.log(
        `${C.green}✅ 无判红;另有 ${d.undetermined.length} 处未判定(不等于通过)。${C.reset}`,
      )
  }
  if (d.red.length > 0) return strict ? 1 : 0
  if (strict && d.undetermined.length > 0) return 2
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ ${String(e?.message ?? e)}`)
    process.exit(2)
  }
}

export const __test__ = {
  deriveUniverse,
  classify,
  scanSource,
  decide,
  analyze,
  selfTest,
  tokensOf,
  arrayMembers,
  dictPairs,
  unionMembers,
  pySkipsApproval,
  maskScriptCommentsGuard,
  SCAN_TARGETS,
  REGISTRY_FILES,
  TS_REGISTRY,
  PY_REGISTRY,
  REAL_SITE_FILE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
