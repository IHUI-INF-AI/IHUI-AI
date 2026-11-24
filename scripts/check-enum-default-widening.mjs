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
 * 判据(唯一一条,不放宽):只有当兜底/默认值**落在某条轴的宽端**才判红。词表与宽严序
 * **一律由被审面现读推导**,门内不写第二份档名清单(清单必然腐烂)。
 *
 * ── 轴模型(G-816027 收尾:把"档词表推导面"从两文件扩到七条轴)────────────────
 * 每条轴 = 词表(声明处现读)+ **可选的**声明型宽严序源。序源只认三种,按可靠性排:
 *  ① 该轴自己的**整型序表** —— 工具轴 `ToolClass` ← `permission_mode.py:_TOOLS_SEVERITY`;
 *  ② **投影**到① —— 聊天轴 `ChatMode` ← `CHAT_MODE_TOOL_AXIS`(py 与 ts 两份互证)→ ToolClass;
 *  ③ 面声明的"免批"性质 —— PermissionMode 轴 ← `POLICY_BY_MODE` 含 auto-approve ∩
 *     `skips_approval_permission_mode()` 元组(两侧冲突 ⇒ 整个集合判未判定,绝不各取一侧)。
 * **两种被明令拒绝的"序源"**(这是本门全部克制所在,也是它不会自己造出判反的原因):
 *  · **联合类型的声明序**:被审面里 `DangerLevel = 'read'|'write'|'dangerous'`(声明序 = 由窄到宽)
 *    与 `ToolApprovalDangerLevel = 'high'|'medium'|'low'`(声明序 = 由宽到窄)**方向相反**,
 *    借声明序必把其中一轴判反;票面取证那条也白纸黑字写着"不硬编码 read<write<dangerous"。
 *  · **跨轴借序**:`'none'`/`'all'` 同时是工具轴与审批轴的档,而两轴里它们是**相反两极**
 *    (工具轴 'all'=全开最宽 / 审批轴 'none'=免审批最宽),并成一张表等于把一轴的最宽当另一轴的最窄。
 * 因此一条轴没有①②③任何一项时,落在它上面的兜底一律「未判定」并点名"该轴无声明型序源"——
 * **不冒红、也绝不静默放过**(把没判写成判过了是本仓最高频失效型)。成对锁:自检 ES33/ES34/ES35/ES37
 * + 镜像 T13/T14;三条变异(把无序改成放过 / 把声明序当序 / 让审批轴借工具轴的序)各自翻红。
 *
 * 七条轴的现读定义点(= `MEASURE_FILES`,**只读词表、不当被扫面**):
 *  · PermissionMode:`packages/types/src/permission-mode.ts` ∩ `apps/ai-service/app/core/permission_mode.py`;
 *  · ToolClass / ApprovalClass / ChatMode:同上两文件的 `TOOL_CLASSES`/`APPROVAL_CLASSES`/`ToolClass`/
 *    `ApprovalClass`/`CHAT_MODES`/`CHAT_MODE_IDS`/`ChatModeId` + `CHAT_MODE_TOOL_AXIS`(两份互证);
 *  · DangerLevel:`packages/types/src/agent-runtime.ts` + `apps/api/src/services/clawdbot/permission-guard.ts`
 *    + `apps/ai-service/app/types/api_client.py`(三处同集合且同序,但无序表 ⇒ 该轴不参与宽严);
 *  · ToolApprovalDangerLevel:`packages/types/src/ai.ts`;
 *  · IsolationMode:`apps/cli/src/subagents/precedence.ts` 与 `api_client.py` 两份 —— 现读**成员集不同**
 *    (三档 vs 两档),这条不自洽由轴自己报名。
 *
 * G-816027 补账(收尾这一笔把候选 11 处的读数从「判红 0 / 放过 5 / 未判定 6」推到
 * 「判红 1 / 放过 5 / 未判定 5」—— 少的那个未判定不是被吞掉,是**新读出了它的序源**;
 * 逐条定性如下,证据一律用内容锚点,不写行号):
 *  · 正当形态 1 处 —— `stopReasonToExitCode()` 的 `default: return 1`:兜底是**数字**退出码,
 *    各轴词表全由字符串字面量推导,数字在构造上装不进去;该槽位(switch 主表达式 `reason`)
 *    也归不到任何一条轴 ⇒ 「放过(带理由)」,边界钉死:权限档槽位上的数字兜底仍是未判定(ES29)。
 *  · **本轮由"未判定"移到"判红" 1 处** —— `resolve_mode_policy()` 里 `normalize_chat_mode(...) or "build"`:
 *    聊天轴的序经 `CHAT_MODE_TOOL_AXIS → _TOOLS_SEVERITY` 现读投影得出,'build' 与该面里名次相同
 *    (与 'spec' 并列最宽)⇒ 枚举认不出时**能力端落到最宽档**。这是扩面新量到的一格,不是把措辞
 *    改硬:持有人若裁定"这是有意默认",出路是登记该站点并说明理由,**不是**放宽投影判据。
 *    同一函数里紧邻的 `or "default"`(权限档槽位)按 ③ 判"非免批档" ⇒ 放过,一字未动。
 *  · 仍判不出 5 处(每条都点名归到哪条轴、缺的是哪一件东西,**没有**为了归零去猜档名或塞白名单):
 *    ① `?? 'read'`(工具危险档轴:词表三处声明已现读,缺的是该轴的声明型序源 —— 要判它得读
 *      `tools/permissions.ts` 的 mode 矩阵,那是"取窄档 ⇒ 消费方给免批"的另一型,票面已另计一票);
 *    ② `?? 'none'`(隔离轴:两处成员集互不一致且无序源;与工具轴 'none' 同名反极 ⇒ 不借序);
 *    ③ `?? 'auto'`(nativeFunctionCalling 三态)与 ④ `?? 'default'`(model 槽)—— 档名跨词表撞名:
 *      槽位归不到任何一条轴 ⇒ 不冒红也不放过;
 *    ⑤ `?? 'unknown'`(展示层哨兵,不在任何一条现读轴的词表里 —— 这条 catch-all 保留是**如实**:
 *      它的词表声明处确实不在量具面,而不是我把"没读到"写成了"没有宽档")。
 *  · 计数读法:`--strict` 下有未判定即拒绝出合格证(exit 2),这一维现在由 `exitCodeFor()` 一份算法
 *    钉住并在构造面成对取证(ES38 / 镜像 T9)—— 真仓此刻**有 1 条判红**,所以 strict 走的是 1 而不是 2;
 *    判红在 warn 定级下不改默认面退出码(仍 0),否则就是一台与任何提交都无关的恒红门(§12e)。
 *  · 形态盲区(与上轮同一格,仍未补):三元 else 支(`cfg ? cfg.mode : '宽档'` —— 条件是不是"在场
 *    测试"要读上半句才判得出,收进来必带假红)与 `Object.assign` 默认对象(方向决定语义)。
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
import { maskedSpans, maskScriptComments, scanScriptCommentSpans } from './lib/code-mask.mjs'

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
/**
 * **量具面(只读词表,不当被扫面)** —— G-816027 收尾扩的正是这一层。
 * 每条轴的定义点在这里登记的是「从哪读」(文件 + 声明名),**不是档名清单**;
 * 档名一律由 `deriveAxes()` 从这些文件的现读内容里取。加一条轴必须同笔加它的定义点,
 * 否则那条轴读不出 ⇒ 落在它上面的兜底只能报"判不出"(不会静默放过)。
 * 刻意**不把这些文件加进 SCAN_TARGETS**:扫描面答"哪儿有兜底写法",量具面答"这个词表与序住在哪儿",
 * 两者混同会让一个纯类型文件里的无关三元/兜底被顺手扫进来(噪声,且与本门立项无关)。
 */
const DANGER_TS = 'packages/types/src/agent-runtime.ts'
const DANGER_API = 'apps/api/src/services/clawdbot/permission-guard.ts'
const DANGER_PY = 'apps/ai-service/app/types/api_client.py'
const APPROVAL_DANGER_TS = 'packages/types/src/ai.ts'
const ISOLATION_CLI = 'apps/cli/src/subagents/precedence.ts'
const MEASURE_FILES = [
  TS_REGISTRY,
  PY_REGISTRY,
  DANGER_TS,
  DANGER_API,
  DANGER_PY,
  APPROVAL_DANGER_TS,
  ISOLATION_CLI,
]
const REGISTRY_FILES = [TS_REGISTRY, PY_REGISTRY]
// precedence.ts 已被 SCAN_DIRS 覆盖,不再单列(重叠 pathspec 会让同一文件被枚举两次)
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
    const e =
      /^\s*(?:['"]([^'"]+)['"]|([A-Za-z_$][\w$]*))\s*:\s*(['"])((?:(?!\3)[^\\]|\\.)*)\3/.exec(line)
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

/**
 * 取 `NAME = { k: 3, ... }` 的**整型**映射 —— 它是"声明型宽严序"的唯一可机读形态。
 * G-816027 收尾新增的这一把尺子,存在的理由就一条:**联合类型的声明序不能当宽严序用**。
 * 实测被审面同形状声明方向相反:`DangerLevel = 'read'|'write'|'dangerous'(声明序 = 由窄到宽)`
 * 而 `ToolApprovalDangerLevel = 'high'|'medium'|'low`(声明序 = 由宽到窄)——
 * 拿声明序当序,两轴里必有一轴被判反(而判反的表现不是报错,是"该红的绿/不该红的红")。
 * 只有面上**自带整型序表**(如 `_TOOLS_SEVERITY`)或**能投影到有这样的表**的轴,才允许有宽严序。
 */
function intMap(src, name) {
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
  // 逐行匹配会把**写成一行**的表(`{"none": 0, "readonly": 1, "all": 2}`)整张读成空 ——
  // 那正是"读不到"伪装成"该轴没有序源"的形态,所以按全局扫描取对,不押书写形状。
  const out = []
  for (const e of body.matchAll(/(?:['"]([^'"]+)['"]|([A-Za-z_$][\w$]*))\s*:\s*(-?\d+)(?![\d.])/g))
    out.push({ key: e[1] ?? e[2], value: Number(e[3]) })
  return out.length ? out : null
}

/** 驼峰 + 蛇形 + 中划线拆词,并去一个尾 's'(modes→mode、classes→class)。 */
export function tokensOf(text) {
  const out = new Set()
  for (const piece of String(text ?? '').split(/[^A-Za-z0-9]+/)) {
    for (const w of piece
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/\s+/)) {
      if (!w || w.length < 3) continue
      out.add(w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)
    }
  }
  return out
}

/**
 * 从**量具面**(MEASURE_FILES 定义的各声明点)推导档名宇宙与每条轴的宽严序。
 * 入参 `sources` 是 `{ 相对路径: 该面文本 | null }`;返回
 *  `{ok, reason, wide, narrow, classes, chat, nameTokens, axisTokens, ids, axes, evidence}`。
 * `ok:false` 时**所有**候选一律落未判定(推导不出集合 ≠ 集合为空)。
 *
 * 轴(axis)= 一条独立的能力/权限阶梯。设计前提三条,都是这条判据的全部价值所在:
 *  ① **词表**从声明处现读,门内不抄档名;
 *  ② **宽严序**只认"声明型序源":该轴自带的整型序表(intMap),或能投影到有这样的表的轴
 *     (ChatMode → CHAT_MODE_TOOL_AXIS → ToolClass → _TOOLS_SEVERITY)。
 *     **联合类型的声明序一律不当序源** —— 被审面里 `'read'|'write'|'dangerous'` 与
 *     `'high'|'medium'|'low'` 的声明序方向相反,借声明序就等于对其中一轴判反;
 *  ③ 两轴的档**不得并成一张表**:同名(如 'none' 同时是工具轴的"无工具"与审批轴的"免审批")
 *     在两轴里是**相反两极**,并表即把一个轴的最宽当另一个轴的最窄。因此每条轴各自带
 *     `keyTokens`(它自己的声明名里最具区分度的词)用于把"这一处兜底"归到某条轴上。
 */
export function deriveUniverse(sources = {}) {
  const evidence = []
  const failures = []
  const text = (rel) => (typeof sources[rel] === 'string' ? sources[rel] : null)
  // 注册表自身的散文不是判据面:先剥注释(字符串留着 —— 档名就住在字符串里)。
  const tsRaw = text(TS_REGISTRY)
  const pyRaw = text(PY_REGISTRY)
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

  const classes = new Set([
    ...(tsToolClasses ?? []),
    ...(pyToolClasses ?? []),
    ...(tsApprovalClasses ?? []),
    ...(pyApprovalClasses ?? []),
  ])
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

  const axes = deriveAxes({
    text,
    ts,
    py,
    ids: allIds,
    wide,
    narrow,
    wideIds,
    toolTuple: arrayMembers(py, 'TOOL_CLASSES'),
    tsToolClasses,
    pyToolClasses,
    approvalTuple: arrayMembers(py, 'APPROVAL_CLASSES'),
    tsApprovalClasses,
    pyApprovalClasses,
    tsChatIds,
    pyChatIds,
  })

  evidence.push(
    `宽档集合由 ${TS_REGISTRY}(POLICY_BY_MODE 含 auto-approve)+ ${PY_REGISTRY}(skips_approval 元组)现读推导`,
  )
  for (const a of axes) evidence.push(a.evidence)
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
    axes,
    evidence,
  }
}

/** 集合相同、顺序可不同:返回两侧差异描述(null = 同集合)。 */
function setDiff(a, b) {
  const x = [...new Set(a ?? [])]
  const y = [...new Set(b ?? [])]
  const onlyA = x.filter((v) => !y.includes(v))
  const onlyB = y.filter((v) => !x.includes(v))
  return onlyA.length === 0 && onlyB.length === 0
    ? null
    : `仅前者:${onlyA.join('/') || '无'} / 仅后者:${onlyB.join('/') || '无'}`
}

/** 把"轴名"压成该轴最具区分度的槽位词(取声明类型名里的核心词,不取档名)。 */
function axisKeyTokens(tokens) {
  const out = new Set()
  for (const t of tokens) if (!GENERIC_TOKENS.has(t) && t !== 'class' && t !== 'axis') out.add(t)
  return out
}

/**
 * 逐轴推导。每条轴的形态:`{id,label,keyTokens:Set,tiers:Set,wide:Set|null,rank:Map|null,
 * problem:string|null,evidence:string,orderSource:string|null}`。
 * `wide`/`rank` 至多一个非空(都没有 ⇒ 该轴无声明型序源 ⇒ 落在它上面的兜底只能报"判不出")。
 */
function deriveAxes(ctx) {
  const { text, ts, py } = ctx
  const masked = (rel, lang) => {
    const raw = text(rel)
    if (typeof raw !== 'string') return null
    return lang === 'py' ? maskScriptComments(raw, 'sh') : maskScriptCommentsGuard(raw, 'js')
  }
  const axes = []

  // ── 轴①PermissionMode:宽 = 面声明的"免批"性质(POLICY_BY_MODE ∩ skips_approval)────────
  const permWide = new Set([...ctx.wideIds])
  const permTiers = new Set([...ctx.ids, ...ctx.wide, ...ctx.narrow])
  axes.push({
    id: 'permission-mode',
    label: 'PermissionMode(审批轴)',
    keyTokens: axisKeyTokens(['permission']),
    tiers: permTiers,
    wide: permWide,
    rank: null,
    orderSource: `${TS_REGISTRY}:POLICY_BY_MODE(auto-approve) ∩ ${PY_REGISTRY}:skips_approval 元组`,
    problem: ctx.wideIds.size === 0 ? '免批档集合为空 ⇒ 该轴无宽端可判' : null,
    evidence: `轴①PermissionMode:现读 ${ctx.ids.length} 个规范档 + 别名/wire 拼写,免批端现读 ${[...permWide].join('/') || '空'}`,
  })

  // ── 轴②ToolClass:唯一带整型序表的轴(序源 = _TOOLS_SEVERITY),并核 TOOL_CLASSES 声明序单调 ──
  const toolRankRows = intMap(py, '_TOOLS_SEVERITY')
  const toolTuple = arrayMembers(py, 'TOOL_CLASSES')
  const toolTiers = new Set([
    ...(toolTuple ?? []),
    ...(ctx.pyToolClasses ?? []),
    ...(ctx.tsToolClasses ?? []),
  ])
  let toolRank = null
  let toolProblem = null
  if (!toolRankRows || !toolRankRows.length) {
    toolProblem = `${PY_REGISTRY} 的 _TOOLS_SEVERITY 整型序表读不出 ⇒ 该轴无宽严序`
  } else if (!toolTiers.size) {
    toolProblem = 'ToolClass 词表读不出(TOOL_CLASSES / py Literal / ts 联合三处都空)'
  } else {
    const d1 = setDiff(toolTuple, ctx.pyToolClasses)
    const d2 = setDiff(toolTuple, ctx.tsToolClasses)
    if (d1) toolProblem = `py TOOL_CLASSES 与 py ToolClass 联合不同集合:${d1}`
    else if (d2) toolProblem = `py TOOL_CLASSES 与 ts ToolClass(${TS_REGISTRY})不同集合:${d2}`
    else {
      const m = new Map(toolRankRows.map((r) => [r.key, r.value]))
      const missing = [...toolTiers].filter((t) => !m.has(t))
      const extra = [...m.keys()].filter((k) => !toolTiers.has(k))
      if (missing.length || extra.length)
        toolProblem = `_TOOLS_SEVERITY 与词表不闭合(缺:${missing.join('/') || '无'} / 多:${extra.join('/') || '无'})`
      else {
        const seq = (toolTuple ?? []).map((t) => m.get(t))
        const monotone = seq.every((v, i) => i === 0 || v > seq[i - 1])
        if (!monotone)
          toolProblem = `TOOL_CLASSES 的声明序与 _TOOLS_SEVERITY 不单调同向(${(toolTuple ?? []).join('/')} → ${seq.join('/')})⇒ 序源自相矛盾`
        else toolRank = m
      }
    }
  }
  axes.push({
    id: 'tool',
    label: 'ToolClass(工具能力轴)',
    keyTokens: axisKeyTokens(['tool']),
    tiers: toolTiers,
    wide: null,
    rank: toolRank,
    orderSource: toolRank
      ? `${PY_REGISTRY}:_TOOLS_SEVERITY(整型序表,且与 TOOL_CLASSES 声明序单调同向)`
      : null,
    problem: toolProblem,
    evidence: toolRank
      ? `轴②ToolClass:词表 ${[...toolTiers].join('/')} · 序源 _TOOLS_SEVERITY = ${[...toolRank.entries()].map(([k, v]) => `${k}:${v}`).join('/')}`
      : `轴②ToolClass:序源不可用 —— ${toolProblem}`,
  })

  // ── 轴③ApprovalClass:词表读得出,但被审面**没有**它的整型序表 ⇒ 该轴无宽严序(不借工具轴的)──
  const approvalTiers = new Set([
    ...(arrayMembers(py, 'APPROVAL_CLASSES') ?? []),
    ...(ctx.pyApprovalClasses ?? []),
    ...(ctx.tsApprovalClasses ?? []),
  ])
  axes.push({
    id: 'approval',
    label: 'ApprovalClass(审批轴)',
    keyTokens: axisKeyTokens(['approval']),
    tiers: approvalTiers,
    wide: null,
    rank: null,
    orderSource: null,
    problem: approvalTiers.size
      ? '该轴在被审面上没有声明型宽严序源(工具轴有 _TOOLS_SEVERITY,审批轴没有),而它与工具轴存在同名反极档 ⇒ 不跨轴借序'
      : 'ApprovalClass 词表读不出',
    evidence: `轴③ApprovalClass:词表 ${[...approvalTiers].join('/') || '读不出'} · 无整型序表 ⇒ 该轴不参与"宽/窄"结论(与轴②刻意不并表)`,
  })

  // ── 轴④ChatMode:序由**投影**得到(chat → CHAT_MODE_TOOL_AXIS → ToolClass → 轴②的 rank)──
  const chatTiers = new Set([...(ctx.tsChatIds ?? []), ...(ctx.pyChatIds ?? [])])
  const pyChatMap = dictPairs(py, 'CHAT_MODE_TOOL_AXIS')
  const tsChatMap = dictPairs(ts, 'CHAT_MODE_TOOL_AXIS')
  let chatRank = null
  let chatProblem = null
  if (!chatTiers.size)
    chatProblem = 'ChatMode 词表读不出(CHAT_MODES / CHAT_MODE_IDS / ChatModeId 都空)'
  else if (!pyChatMap || !pyChatMap.length)
    chatProblem = `${PY_REGISTRY} 的 CHAT_MODE_TOOL_AXIS 投影表读不出`
  else if (!tsChatMap || !tsChatMap.length)
    chatProblem = `${TS_REGISTRY} 的 CHAT_MODE_TOOL_AXIS 读不出 ⇒ 两侧投影无法互证(不取单侧)`
  else {
    const d = setDiff(
      pyChatMap.map((p) => `${p.key}=${p.value}`),
      tsChatMap.map((p) => `${p.key}=${p.value}`),
    )
    if (d) chatProblem = `两侧 CHAT_MODE_TOOL_AXIS 不一致:${d}`
    else if (!toolRank) chatProblem = '投影的终点(轴②ToolClass)自己没有可用序源 ⇒ 投影不出宽严'
    else {
      const m = new Map()
      const holes = []
      for (const t of chatTiers) {
        const hit = pyChatMap.find((p) => p.key === t)
        if (!hit || !toolRank.has(hit.value)) holes.push(t)
        else m.set(t, toolRank.get(hit.value))
      }
      const unmapped = pyChatMap.filter((p) => !chatTiers.has(p.key)).map((p) => p.key)
      if (holes.length || unmapped.length)
        chatProblem = `CHAT_MODE_TOOL_AXIS 与词表不闭合(词表里没投影:${holes.join('/') || '无'} / 投影里多出的键:${unmapped.join('/') || '无'})`
      else chatRank = m
    }
  }
  axes.push({
    id: 'chat-mode',
    label: 'ChatMode(模式轴)',
    keyTokens: axisKeyTokens(['chat']),
    tiers: chatTiers,
    wide: null,
    rank: chatRank,
    orderSource: chatRank
      ? `投影链 ${PY_REGISTRY}:CHAT_MODE_TOOL_AXIS(与 ${TS_REGISTRY} 同面互证)→ ToolClass → _TOOLS_SEVERITY`
      : null,
    problem: chatProblem,
    evidence: chatRank
      ? `轴④ChatMode:词表 ${[...chatTiers].join('/')} · 能力档经 CHAT_MODE_TOOL_AXIS 投影 = ${[...chatRank.entries()].map(([k, v]) => `${k}:${v}`).join('/')}(注意:这一序**只**说工具能力,审批侧另是一条轴,不在此序内)`
      : `轴④ChatMode:序不可推导 —— ${chatProblem}`,
  })

  // ── 轴⑤DangerLevel 与轴⑥ToolApprovalDangerLevel:词表可读,**声明序方向相反** ⇒ 一律无序 ──
  const dangerDecls = [
    { file: DANGER_TS, src: masked(DANGER_TS, 'js'), name: 'DangerLevel' },
    { file: DANGER_API, src: masked(DANGER_API, 'js'), name: 'DangerLevel' },
    { file: DANGER_PY, src: masked(DANGER_PY, 'py'), name: 'DangerLevel' },
  ].map((d) => ({ ...d, members: d.src ? unionMembers(d.src, d.name) : null }))
  const dangerReadable = dangerDecls.filter((d) => d.members && d.members.length)
  const dangerTiers = new Set(dangerReadable.flatMap((d) => d.members))
  const dangerOrderAgrees =
    dangerReadable.length >= 2 &&
    dangerReadable.every(
      (d) => d.members.join('\u0000') === dangerReadable[0].members.join('\u0000'),
    )
  axes.push({
    id: 'danger-level',
    label: 'DangerLevel(工具危险档轴)',
    keyTokens: axisKeyTokens(['danger', 'level']),
    tiers: dangerTiers,
    wide: null,
    rank: null,
    orderSource: null,
    problem: dangerTiers.size
      ? `该轴词表已在 ${dangerReadable.map((d) => d.file).join(' + ')} 现读到(同集合${dangerOrderAgrees ? '且同序' : '但序不同'}),但被审面上没有它的整型序表/投影链;而另一条轴 ToolApprovalDangerLevel 的声明序方向**相反** ⇒ 借声明序必判反其中一轴 ⇒ 本轴不产宽严结论`
      : `DangerLevel 词表在 ${DANGER_TS}/${DANGER_API}/${DANGER_PY} 都读不出`,
    evidence: `轴⑤DangerLevel:词表 ${[...dangerTiers].join('/') || '读不出'}(${dangerReadable.length} 处声明)· 无声明型序源 ⇒ 不参与宽严`,
  })

  const adSrc = masked(APPROVAL_DANGER_TS, 'js')
  const adTiers = adSrc ? new Set(unionMembers(adSrc, 'ToolApprovalDangerLevel') ?? []) : new Set()
  axes.push({
    id: 'approval-danger-level',
    label: 'ToolApprovalDangerLevel(审批流危险等级轴)',
    keyTokens: axisKeyTokens(['approval', 'danger']),
    tiers: adTiers,
    wide: null,
    rank: null,
    orderSource: null,
    problem: adTiers.size
      ? `该轴成员 ${[...adTiers].join('/')} 与轴⑤${[...dangerTiers].join('/')} **同词不同义**,且两轴声明序方向相反(高→低 vs 读→危险);同形状的高/中/低阶梯在被审面还至少服务于工单优先级、风险分档、图片质量等无关轴 ⇒ 既不并表也不借序`
      : `${APPROVAL_DANGER_TS} 的 ToolApprovalDangerLevel 读不出`,
    evidence: `轴⑥ToolApprovalDangerLevel:成员 ${[...adTiers].join('/') || '读不出'} · 无整型序表且与轴⑤不得并表 ⇒ 不参与宽严`,
  })

  // ── 轴⑦IsolationMode:两处声明成员不同 ⇒ 词表本身不自洽(如实报名),更谈不上序 ──
  const isoCli = masked(ISOLATION_CLI, 'js')
  const isoPy = masked(DANGER_PY, 'py')
  const isoCliTiers = isoCli ? arrayMembers(isoCli, 'ISOLATION_MODES') : null
  const isoPyTiers = isoPy ? unionMembers(isoPy, 'IsolationMode') : null
  const isoTiers = new Set([...(isoCliTiers ?? []), ...(isoPyTiers ?? [])])
  const isoDiff = isoCliTiers && isoPyTiers ? setDiff(isoCliTiers, isoPyTiers) : null
  axes.push({
    id: 'isolation-mode',
    label: 'IsolationMode(隔离轴)',
    keyTokens: axisKeyTokens(['isolation']),
    tiers: isoTiers,
    wide: null,
    rank: null,
    orderSource: null,
    problem: isoTiers.size
      ? `${ISOLATION_CLI} 声明 ${JSON.stringify(isoCliTiers ?? null)} 而 ${DANGER_PY} 声明 ${JSON.stringify(isoPyTiers ?? null)}${isoDiff ? ` —— 两处成员集不一致(${isoDiff}),词表本身不自洽` : ''};且该轴没有声明型序源 ⇒ 判不出宽严`
      : 'IsolationMode 词表两处都读不出',
    evidence: `轴⑦IsolationMode:成员 ${[...isoTiers].join('/') || '读不出'}${isoDiff ? ' · **两处声明不同集合**' : ''} · 无序源 ⇒ 不参与宽严`,
  })

  return axes
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
  const slotTok = tokensOf(slotKey)
  const axisHit = [...slotTok].some((t) => u.axisTokens.has(t))
  /**
   * G-816027 定性第 (b) 类(正当形态)的落槌处:`stopReasonToExitCode()` 里 `default: return 1`
   * 是**这一档**。为什么它不属本型(写在判据旁边而不是只写在报告里):
   *  · 各轴词表全部由**字符串字面量**现读推导 —— 纯数字字面量在集合构造上不可能被含进任何一份,
   *    这不是"猜它不是档",是推导器给的界;
   *  · 该处"缺席"取的是**退出码**(给 CI/脚本读的返回值),它放大或收窄的不是权限,
   *    是"这次运行算不算失败"。
   * 只在槽位**既没被归到任何一条轴、也不像权限/能力档**时这样放过:
   * `switch (permissionMode) { default: return 0 }` 那一型("消费方把 0 读成允许")仍落未判定 ——
   * 要读消费方才知道 0 是宽是严,不在本门射程。
   * 收窄的是这一处的形态,不是宽严判据本身:兜底落在某条轴的最宽档仍是红(ES1/ES29/ES31 成对钉着)。
   */
  const slotAxes = (u.axes ?? []).filter(
    (a) => a.keyTokens && [...a.keyTokens].some((t) => slotTok.has(t)),
  )
  if (!axisHit && slotAxes.length === 0 && /^\s*-?\d[\d_]*\s*$/.test(body))
    return {
      kind: 'green',
      why: `兜底值 ${body.trim()} 是数字字面量(退出码/计数一类的数值),不可能落在任何由字符串档名推导出的集合里;且槽位(${clip(slotKey, 40)})既未归到任何一条现读轴、也不像权限/能力档 ⇒ 该处"缺席"取的不是档,不属本型`,
    }
  const lit = stringLiteralOf(body)
  if (lit === null) {
    return {
      kind: 'undetermined',
      why: `兜底值 ${expr.trim().slice(0, 40) || '(空)'} 不是档名字面量(变量/表达式),无法证明它不落在宽档集合`,
    }
  }
  /**
   * **归轴**(G-816027 收尾扩的面):档名会跨词表撞名('none' 既是工具轴的"无工具可执行"、
   * 又是审批轴的"免审批",两轴里是**相反两极**;`'auto'` 既是 acceptEdits 的历史拼写、又是
   * `nativeFunctionCalling` 的三态档)。集合-membership 只回答"这个名字是不是宽档",
   * 回答不了"这一处的它是不是那个它"。所以先用槽位证据把这一处归到**一条**轴,再问该轴有没有
   * 声明型宽严序 —— 两侧同尺:不在宽档一侧冒红、在窄档一侧静默放过,也不在归不出轴时硬判。
   */
  const containing = (u.axes ?? []).filter((a) => a.tiers && a.tiers.has(lit))
  const matched = slotAxes.filter((a) => a.tiers.has(lit))
  if (matched.length > 1)
    return {
      kind: 'undetermined',
      why: `回落值 '${lit}' 同时落在槽位(${clip(slotKey, 40)})指向的多条轴的词表里(${matched.map((a) => a.id).join(' + ')})⇒ 同名跨轴,判不出这一处指哪条轴 ⇒ 不并表、不冒红也不放过`,
    }
  let axis = matched.length === 1 ? matched[0] : null
  if (!axis && containing.length === 1 && axisHit) axis = containing[0]
  if (!axis) {
    if (!containing.length)
      return {
        kind: 'undetermined',
        why: `回落值 '${lit}' 不在被审面可推导的任何档词表内(${(u.axes ?? []).map((a) => a.id).join('/')} 都不含它;该枚举的词表声明处不在量具面)⇒ 无从判定宽严`,
      }
    return {
      kind: 'undetermined',
      why: `回落值 '${lit}' 是 ${containing.map((a) => a.label).join(' / ')} 的档,但该兜底槽位(${clip(slotKey, 40)})未被归到任何一条现读轴 ⇒ 同名跨词表,判不出它此处指哪条轴 ⇒ 不冒红也不放过`,
    }
  }
  return decideOnAxis(axis, lit)
}

/**
 * 在**已归好的那条轴上**判这一处。入参只有"轴 + 档名"两个 —— 槽位证据在 `classify` 的
 * **归轴**那一步就用完了,这里再收一份槽位文本等于给同一件事留第二个判点(必漂)。
 * 三种结局:
 *  · 轴有 `wide`(面声明的"免批"性质)⇒ 落在 wide 上红,否则绿;
 *  · 轴有 `rank`(整型序表或经互证的投影链)⇒ 落在该轴最大 rank 上红,否则绿(理由里带序源与该档名次);
 *  · 两者都没有 ⇒ **未判定**,并点名"这条轴的宽严序在被审面上没有声明型序源" ——
 *    这一支是本门拒绝的事:`'read'|'write'|'dangerous'` 与 `'high'|'medium'|'low'` 的声明序方向
 *    相反,借序就会把其中一轴判反(AGENTS §12e 同一条:宁可少判,不可把没判写成判过了)。
 */
export function decideOnAxis(axis, lit) {
  if (axis.wide) {
    if (axis.wide.has(lit))
      return {
        kind: 'red',
        why: `回落档 '${lit}' 属 ${axis.label} 的免审批/自动放行档(序源:${axis.orderSource})⇒ 枚举缺席即放大权限`,
      }
    if (axis.problem)
      return {
        kind: 'undetermined',
        why: `回落值 '${lit}' 归到 ${axis.label},但该轴存在自相矛盾:${axis.problem} ⇒ 不据残缺集合放过`,
      }
    return {
      kind: 'green',
      why: `回落档 '${lit}' 在 ${axis.label} 上不是免批档(序源:${axis.orderSource}),不属本型`,
    }
  }
  if (axis.rank) {
    const max = Math.max(...[...axis.rank.values()])
    const mine = axis.rank.get(lit)
    if (mine === undefined)
      return { kind: 'undetermined', why: `${axis.label} 的序表里没有 '${lit}' ⇒ 判不出名次` }
    if (mine === max)
      return {
        kind: 'red',
        why: `回落档 '${lit}' 是 ${axis.label} 现读序里的**最宽档**(名次 ${mine},序源:${axis.orderSource})⇒ 枚举缺席即落到能力/权限的最宽端`,
      }
    return {
      kind: 'green',
      why: `回落档 '${lit}' 在 ${axis.label} 的现读序里名次 ${mine} < 最宽 ${max}(序源:${axis.orderSource})⇒ 不是"缺席即取宽档";注意:这不等于该处无风险 —— 消费方可能把低名次档读成免批(那是"取窄档⇒免批"的另一型,要读消费方才判得出,不在本门形状内)`,
    }
  }
  // **没有声明型序源**这条路径必须是有牙的活路径,不是靠 `problem` 早退代劳的兜底:
  // 否则一旦某轴"词表干净但没有序"(没有 problem),它就掉到别处去 —— 变异取证(m1)实测过这一格。
  return {
    kind: 'undetermined',
    why: `回落值 '${lit}' 已归到 ${axis.label}(词表 ${[...axis.tiers].join('/') || '空'} 现读自该轴声明处),但这条轴在被审面上**没有声明型宽严序源**(既没有整型序表、也没有可互证的投影链)⇒ 判不出宽严;借别的轴的序、或把联合类型的声明序当序,都会把其中一条轴判反${axis.problem ? `;该轴另有自相矛盾处:${axis.problem}` : ''}`,
  }
}

/**
 * 候选**入队**用的档名判据:值是不是某一条现读轴的词表成员。
 * 这里刻意"跨轴并查"—— 入队只回答"这个词像不像某条轴的档",
 * **判**宽严时才分轴(见 `classify` 的归轴 + `decideOnAxis`),两件事不得混成一个集合。
 */
export function anyAxisHasTier(u, lit) {
  for (const a of u?.axes ?? []) if (a.tiers && a.tiers.has(lit)) return true
  return (
    (u?.wide?.has(lit) || u?.narrow?.has(lit) || u?.classes?.has(lit) || u?.chat?.has(lit)) === true
  )
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
  const left = String(text ?? '')
    .slice(0, opIdx)
    .replace(/[ \t]+$/, '')
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
      expr: String(expr ?? '')
        .trim()
        .slice(0, 60),
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
      const isTierName = anyAxisHasTier(u, lit)
      // 候选的**入队**条件放宽(槽位提到注册表词表里的词,或回落值本身就是任一现读轴的档名),
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
      for (const d of grp.matchAll(
        /(?:^|[{,(])\s*([A-Za-z_$][\w$]*)\s*=\s*(['"])((?:(?!\2)[^\\]|\\.)*)\2/g,
      )) {
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
        const isTierName = anyAxisHasTier(u, lit)

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
  const t = String(body ?? '')
    .trim()
    .slice(0, 300)
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
  // 量具面**总是**进同一批读取:它们是尺子,不能因为"本次暂存集里没有它们"就取不到
  // (取不到尺子 = 未判定,那是环境问题伪装成业务结论)。清单与正文仍同面同轮。
  const wantList = [...new Set([...files, ...REGISTRY_FILES, ...MEASURE_FILES])]
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
  const sources = {}
  const unreadableRegistries = []
  const unreadableMeasure = []
  for (const rel of REGISTRY_FILES) {
    const t = read(rel)
    if (typeof t !== 'string') unreadableRegistries.push(rel)
    sources[rel] = t
  }
  // 其余量具面取不到 ⇒ **不**把整门判死(注册表已经能推出主集合),但那条轴必须报名 ——
  // 让"量具缺一块"表现为"这条轴判不出",而不是"这条轴没有档"(那会把未判定写成放过)。
  for (const rel of MEASURE_FILES) {
    if (rel in sources) continue
    const t = read(rel)
    if (typeof t !== 'string') unreadableMeasure.push(rel)
    sources[rel] = t
  }
  const u = deriveUniverse(sources)
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
  const unreadable = [...unreadableMeasure]
  if (unreadableMeasure.length)
    candidates.push({
      file: '(量具面)',
      line: 0,
      form: 'measure-face',
      expr: unreadableMeasure.join(' '),
      kind: 'undetermined',
      why: `量具面在本面取不到:${unreadableMeasure.join(' ')} ⇒ 落在这些声明点上的轴只能报"判不出",绝不把"没读到词表"写成"没有宽档"`,
    })
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
  return { files, universe: u, candidates, unreadable, sources, fatal: null }
}

/**
 * 退出码的**唯一**算法(定级契约住在这里,不散在 main 的 if 链里):
 *  · 判红 > 0:warn 面(非 strict)⇒ 0,问责面(strict)⇒ 1;
 *  · 判红 = 0 但仍有未判定 且 strict ⇒ **2 —— 拒绝出具合格证**,绝不因为"红是 0"就报通过;
 *  · 其余 ⇒ 0。
 * 三条各有成对自检(ES32),因为"把没判写成判过了"是本仓最高频的失效型。
 */
export function exitCodeFor({ strict = false, redCount = 0, undeterminedCount = 0 } = {}) {
  if (redCount > 0) return strict ? 1 : 0
  if (strict && undeterminedCount > 0) return 2
  return 0
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
  const sw = (body) =>
    `function f(permissionMode){\n  switch (permissionMode) {\n    case 'plan': return 'ask';\n    default: ${body}\n  }\n}`
  const s = (src, lang = 'ts') => scanSource(`a.${lang}`, src, u)
  const reds = (r) => r.filter((x) => x.kind === 'red')
  const unds = (r) => r.filter((x) => x.kind === 'undetermined')

  // ① 票面验收第一条:default 返回更宽档 ⇒ 红
  t(
    'ES1 default 返回宽档必须判红',
    reds(s(sw(`return '${WIDE}';`))).length === 1,
    JSON.stringify(s(sw(`return '${WIDE}';`))),
  )
  // ② default 显式抛错 / 返回最窄档 ⇒ 绿
  t(
    'ES2 default 抛错必须放过',
    s(sw('throw new Error("unknown permissionMode");')).every((x) => x.kind === 'green'),
    JSON.stringify(s(sw('throw new Error("x");'))),
  )
  t(
    'ES3 default 返回非宽档(推导出的窄档)必须放过',
    s(sw(`return '${NARROW}';`)).every((x) => x.kind === 'green'),
    JSON.stringify(s(sw(`return '${NARROW}';`))),
  )
  // ③ 集合推导失败 ⇒ 未判定,绝不记为通过
  const broken = { ...u, ok: false, reason: '夹具:成员表读不出' }
  const r3 = s(sw(`return '${WIDE}';`), 'ts')
  const brokenRes = scanSource('a.ts', sw(`return '${WIDE}';`), broken)
  t(
    'ES4 集合推导失败 ⇒ 一律未判定(不得记绿也不得记红)',
    brokenRes.length > 0 &&
      brokenRes.every((x) => x.kind === 'undetermined') &&
      reds(r3).length === 1,
    JSON.stringify(brokenRes),
  )
  // ④ 注释与字符串里的形态不得命中(遮噪方向:判代码形态 ⇒ 注释/串都遮)
  const inComment = `// default: return '${WIDE}' 是错的写法\n/* const mode = ctx.permissionMode ?? '${WIDE}'; */\nconst x = 1;`
  t('ES5 注释里的该形态不得计入', s(inComment).length === 0, JSON.stringify(s(inComment)))
  const inString = `const doc = "const mode = ctx.permissionMode ?? '${WIDE}';";\nexport { doc };`
  t('ES6 字符串里的该形态不得计入', s(inString).length === 0, JSON.stringify(s(inString)))
  // Python 侧同语法锚点:漏一条 = 该语言整型隐身(守门 117 那一课)
  const pyCase = `def resolve(permission_mode: object) -> str:\n    match permission_mode:\n        case "plan":\n            return "ask"\n        case _:\n            return "${WIDE}"\n`
  t(
    'ES7 Python `case _` 返回宽档必须判红',
    reds(s(pyCase, 'py')).length === 1,
    JSON.stringify(s(pyCase, 'py')),
  )
  const pyGet = `def pick(cfg):\n    return cfg.get("permission_mode", "${WIDE}")\n`
  t(
    'ES8 Python `.get(key, 宽档)` 必须判红',
    reds(s(pyGet, 'py')).length === 1,
    JSON.stringify(s(pyGet, 'py')),
  )
  const pyOr = `def pick(permission_mode):\n    mode = permission_mode or "${WIDE}"\n    return mode\n`
  t(
    'ES9 Python `x or 宽档` 必须判红',
    reds(s(pyOr, 'py')).length === 1,
    JSON.stringify(s(pyOr, 'py')),
  )
  const pyComment = `# cfg.get("permission_mode", "${WIDE}") 是错的\n`
  t(
    'ES10 Python 注释里的该形态不得计入',
    s(pyComment, 'py').length === 0,
    JSON.stringify(s(pyComment, 'py')),
  )
  // 与凭据门不得重叠计账:同一处两门各计一次会让两份基线互相顶掉
  const credShape = `async function h(request, reply){\n  if (request.headers['x-internal-service-token']) return\n  if (!verifyCsrfToken(a, b)) return reply.status(403).send(1)\n}`
  t(
    'ES11 凭据在场即放行的形态不属本型(与 check-credential-presence-bypass 分工,不双计)',
    s(credShape).length === 0,
    JSON.stringify(s(credShape)),
  )
  // 票面点名的我方真站点:必须入候选,且按判据落未判定(集合推不到 dangerLevel 词表)
  const REAL = "          const dangerLevel = tool?.dangerLevel ?? 'read';"
  const rReal = s(REAL)
  t('ES12 agent.ts 真站点形态必须入候选', rReal.length === 1, JSON.stringify(rReal))
  t(
    'ES13 该处必须落未判定并点名词表(不代主会话落槌,也不静默放过)',
    rReal.length === 1 && rReal[0].kind === 'undetermined',
    JSON.stringify(rReal),
  )
  // ES13b(G-816027 收尾新增的可见差别):该处的原因**不再是**"词表读不出"这张万能 catch-all ——
  // 词表已经现读到(read/write/dangerous 三处声明同集合),缺的是"这一轴的宽严序源"。
  // 这一格钉的是"扩面确实扩到了",不是措辞好看:推导面退回原状时它会红。
  t(
    'ES13b 该处未判定的原因必须点名到具体轴(证明词表已现读,而不是仍走"不在任何词表内"的 catch-all)',
    rReal.length === 1 &&
      /DangerLevel/.test(rReal[0].why) &&
      !/不在被审面可推导的任何档词表内/.test(rReal[0].why),
    JSON.stringify(rReal),
  )
  // 兜底不是档名也不是枚举槽位 ⇒ 不入候选(否则噪声淹信号)
  const noiseF = `const s = String(text ?? '')\nconst n = budget ?? 4\nconst arr = xs ?? []\n`
  t('ES14 非档名/非枚举槽位的兜底不得入候选', s(noiseF).length === 0, JSON.stringify(s(noiseF)))
  // default 返回变量(上游 parentMode 那一型):无法证明不落在宽档 ⇒ 未判定
  const rVar = s(sw('return parentMode;'))
  t(
    'ES15 default 返回变量必须落未判定(不得读成干净,也不得凭空判红)',
    rVar.length === 1 && rVar[0].kind === 'undetermined',
    JSON.stringify(rVar),
  )
  // 扫描面在位(空枚举判死,不记绿)
  t(`ES16 HEAD 面必须扫到射程内文件(现读 ${a.files.length} 个)`, a.files.length > 0)
  t(
    'ES17 注册表两文件必须在扫描面内',
    REGISTRY_FILES.every((f) => a.files.includes(f)),
    JSON.stringify(a.files),
  )
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
  t(
    'ES21 JS 形参默认值落宽档必须判红(旧版整型隐身)',
    reds(s(dParam)).length === 1,
    JSON.stringify(s(dParam)),
  )
  const dArrow = `const g = (a, permissionMode = '${WIDE}') => a + permissionMode`
  t(
    'ES22 箭头形参默认值同锚必须命中(不只在 function 形态上有牙)',
    reds(s(dArrow)).length === 1,
    JSON.stringify(s(dArrow)),
  )
  const dDestruct = `const { permissionMode = '${WIDE}' } = ctx`
  t('ES23 解构默认值落宽档必须判红', reds(s(dDestruct)).length === 1, JSON.stringify(s(dDestruct)))
  const dPyDef = `def resolve(permission_mode="${WIDE}"):\n    return permission_mode\n`
  t(
    'ES24 Python def 形参默认值落宽档必须判红',
    reds(s(dPyDef, 'py')).length === 1,
    JSON.stringify(s(dPyDef, 'py')),
  )
  // 逐字取自全仓实测的 5 处正当写法(形参默认值写死 host/包名/展示串),它们都不是枚举档 ⇒ 一条不得入候选
  const legitDef = `function openBrowser(host = '127.0.0.1', errorType = 'unknown') {\n  return host\n}\nconst label = (packageName = '@ihui/cli') => packageName\n`
  t(
    'ES25 成对:同形但兜底不是档名的形参默认值不得入候选(正当样本不被扫进)',
    s(legitDef).length === 0,
    JSON.stringify(s(legitDef)),
  )
  const legitDestruct = `const { permissionMode = '${NARROW}' } = ctx`
  t(
    'ES26 成对:解构默认值落非免批档 ⇒ 放过(既不得冒红也不得整条消失)',
    s(legitDestruct).length === 1 && s(legitDestruct)[0].kind === 'green',
    JSON.stringify(s(legitDestruct)),
  )
  // 无条件写死不是"缺席即取档":关键字实参必须留在门外(否则本门侵占别的判据地盘并造出假红)
  const kwArg = `def build():\n    return dict(permission_mode="${WIDE}")\n`
  t(
    'ES27 成对:Python 关键字实参(无条件写死)不属本型,不得入候选',
    s(kwArg, 'py').length === 0,
    JSON.stringify(s(kwArg, 'py')),
  )
  // ES28–ES30:G-816027 定性 (b) —— `default: return 1` 这一档从"未判定"移到"放过"。
  // 夹具逐字取自 HEAD:apps/cli/src/commands/agent.ts:2940-2964(stopReasonToExitCode)。
  const exitCode = `export function stopReasonToExitCode(reason: AgentStopReason): number {\n  switch (reason) {\n    case 'error':\n      return 1;\n    default:\n      return 1;\n  }\n}`
  const rExit = s(exitCode)
  t(
    'ES28 数字兜底且槽位不踩权限轴 ⇒ 放过(退出码不是档)',
    rExit.length === 1 && rExit[0].kind === 'green',
    JSON.stringify(rExit),
  )
  const rAxisNum = s(sw('return 0;'))
  t(
    'ES29 成对:同一数字兜底写在权限轴槽位上仍落未判定(不得把"数字"当成一律干净)',
    rAxisNum.length === 1 && unds(rAxisNum).length === 1,
    JSON.stringify(rAxisNum),
  )
  const rAxisWide = s(sw(`return '${WIDE}';`))
  t(
    'ES30 成对:加了数字这条绿路之后,default 返回宽档依旧是红(判据没被放宽)',
    reds(rAxisWide).length === 1,
    JSON.stringify(rAxisWide),
  )

  // ── ES31–ES38:G-816027 收尾扩的"档词表推导面"(轴模型)。───────────────────
  // 每一格都成对给正反例,并且**档名一律从推导出的轴里取**,不在自检里抄第二份清单 ——
  // 抄了就等于:轴腐烂时自检还绿着(§22c"镜像只复读实现就是复读机"同一条禁令的自检版)。
  const axisById = new Map((u.axes ?? []).map((a) => [a.id, a]))
  const ranked = (id) => {
    const a = axisById.get(id)
    if (!a || !a.rank || a.problem) return null
    const entries = [...a.rank.entries()]
    const max = Math.max(...entries.map(([, v]) => v))
    const min = Math.min(...entries.map(([, v]) => v))
    return {
      axis: a,
      widest: entries.filter(([, v]) => v === max).map(([k]) => k),
      narrowest: entries.filter(([, v]) => v === min).map(([k]) => k),
    }
  }
  // ES31 轴②ToolClass:序源 = 面上现读的整型序表(_TOOLS_SEVERITY)。阳性对照必须钉在"最宽档"上。
  const toolR = ranked('tool')
  t(
    'ES31 工具轴(整型序表现读推导):default 返回该轴最宽档必红、最窄档与显式抛错必绿',
    !!toolR &&
      reds(
        s(
          `function f(toolClass){\n  switch (toolClass) {\n    default: return '${toolR.widest[0]}';\n  }\n}`,
        ),
      ).length === 1 &&
      s(
        `function f(toolClass){\n  switch (toolClass) {\n    default: return '${toolR.narrowest[0]}';\n  }\n}`,
      ).every((x) => x.kind === 'green') &&
      s(
        `function f(toolClass){\n  switch (toolClass) {\n    default: throw new Error('unknown tool class');\n  }\n}`,
      ).every((x) => x.kind === 'green'),
    JSON.stringify(
      toolR && { widest: toolR.widest, narrowest: toolR.narrowest, problem: toolR.axis.problem },
    ),
  )
  // ES32 轴④ChatMode:序不是它自己的,而是**投影**出来的(chat → CHAT_MODE_TOOL_AXIS → 工具轴整型序),
  // 两侧投影表必须同面互证;这里同时钉"投影链给了它红端与绿端",不是只换了措辞。
  const chatR = ranked('chat-mode')
  t(
    'ES32 聊天轴(投影序源):default 返回投影出的最宽模式必红、最窄模式必绿',
    !!chatR &&
      reds(
        s(
          `function f(chatMode){\n  switch (chatMode) {\n    default: return '${chatR.widest[0]}';\n  }\n}`,
        ),
      ).length === 1 &&
      s(
        `function f(chatMode){\n  switch (chatMode) {\n    default: return '${chatR.narrowest[0]}';\n  }\n}`,
      ).every((x) => x.kind === 'green'),
    JSON.stringify(
      chatR && { widest: chatR.widest, narrowest: chatR.narrowest, problem: chatR.axis.problem },
    ),
  )
  // ES33 **两轴不并表**的正面证明:同一个字面量(同时是工具轴与审批轴的档)在一轴有结论、
  // 在另一轴必须**没有**结论(审批轴无声明型序源)。并表的话两条断言不可能同时成立。
  const shared = [...axisById.get('tool').tiers].filter((v) =>
    axisById.get('approval').tiers.has(v),
  )
  const sharedWide = shared.filter(
    (v) => toolR && toolR.axis.rank.get(v) === Math.max(...[...toolR.axis.rank.values()]),
  )
  t(
    'ES33 同一字面量在工具轴判红、在审批轴判不出 ⇒ 两轴未被并成一张表(并表即一视同仁)',
    shared.length > 0 &&
      sharedWide.length > 0 &&
      reds(
        s(
          `function f(toolClass){\n  switch (toolClass) {\n    default: return '${sharedWide[0]}';\n  }\n}`,
        ),
      ).length === 1 &&
      unds(
        s(
          `function f(approvalClass){\n  switch (approvalClass) {\n    default: return '${sharedWide[0]}';\n  }\n}`,
        ),
      ).length === 1,
    JSON.stringify({ shared, sharedWide }),
  )
  // ES34 **声明序不得当宽严序用**(票面对 DangerLevel 明令"不硬编码 read<write<dangerous"):
  //  声明序最末那一档在工具危险档轴上既不得判红、也不得判绿,只能点名"该轴无序源"。
  const danger = axisById.get('danger-level')
  const dangerLast = [...(danger?.tiers ?? [])].slice(-1)[0]
  const rDanger = dangerLast
    ? s(
        `function f(dangerLevel){\n  switch (dangerLevel) {\n    default: return '${dangerLast}';\n  }\n}`,
      )
    : []
  t(
    'ES34 工具危险档轴:词表已现读、但声明序不作序源 ⇒ 最末一档既不红也不绿,且必须点名归到哪条轴',
    !!danger &&
      danger.tiers.size > 0 &&
      !danger.rank &&
      !danger.wide &&
      rDanger.length === 1 &&
      rDanger[0].kind === 'undetermined' &&
      rDanger[0].why.includes(danger.label),
    JSON.stringify(rDanger),
  )
  // ES35 第二条危险等级阶梯(审批流)是**另一条轴**:成员与轴⑤同词不同义,归轴后各自报名。
  const ad = axisById.get('approval-danger-level')
  const adFirst = [...(ad?.tiers ?? [])][0]
  const rAd = adFirst
    ? s(
        `function f(approvalDangerLevel){\n  switch (approvalDangerLevel) {\n    default: return '${adFirst}';\n  }\n}`,
      )
    : []
  t(
    'ES35 ToolApprovalDangerLevel 与 DangerLevel 各归各轴:两侧点名到各自的轴,不互相借序',
    !!ad &&
      ad.tiers.size > 0 &&
      ![...ad.tiers].some((v) => danger.tiers.has(v)) &&
      rAd.length === 1 &&
      rAd[0].kind === 'undetermined' &&
      /ToolApprovalDangerLevel/.test(rAd[0].why),
    JSON.stringify({ tiers: [...(ad?.tiers ?? [])], danger: [...(danger?.tiers ?? [])], hit: rAd }),
  )
  // ES36 覆盖面自证:量具面上一条轴都读不出词表时,该轴必须带 problem 报名,
  //  绝不允许"轴没了/词表空"被当成"这一族没有宽档"(那才是把没判写成判过了)。
  t(
    'ES36 覆盖面自证:每条轴要么有词表、要么带 problem 报名;轴数不得少于登记的定义点族',
    (u.axes ?? []).length >= 7 && (u.axes ?? []).every((a) => a.tiers.size > 0 || a.problem),
    JSON.stringify(
      (u.axes ?? []).map((a) => ({ id: a.id, tiers: a.tiers.size, problem: a.problem })),
    ),
  )
  const starved = deriveUniverse({
    [TS_REGISTRY]:
      'export const PERMISSION_MODES = ["plan", "manual"] as const\nexport const PERMISSION_MODE_ALIASES: Record<string,string> = { readonly: "plan" }\nconst POLICY_BY_MODE: Record<string,string> = { plan: "readonly", manual: "ask" }\n',
    [PY_REGISTRY]:
      'PERMISSION_MODES = ("plan", "manual")\nPERMISSION_MODE_ALIASES = {"readonly": "plan"}\ndef skips_approval_permission_mode(mode):\n    return mode in ("plan",)\n',
  })
  t(
    'ES37 量具面残缺(只有两轴读得出)时:残缺轴点名,且绝不因"推不出"就记通过',
    starved.axes.length === 7 &&
      starved.axes.filter((a) => a.problem).length >= 5 &&
      starved.axes.find((a) => a.id === 'chat-mode')?.problem ===
        'ChatMode 词表读不出(CHAT_MODES / CHAT_MODE_IDS / ChatModeId 都空)' &&
      starved.axes.every((a) => !a.rank),
    JSON.stringify(starved.axes.map((a) => ({ id: a.id, problem: a.problem }))),
  )
  // ES38 退出码契约(唯一算法 exitCodeFor):**有未判定而无判红时 strict 必须是 2** ——
  //  这一格是"拒绝出合格证"的性质本身;真仓此刻有判红,所以性质只能在构造面上钉。
  t(
    'ES38 退出码三态成对:无判红+有未判定 strict⇒2(拒出合格证);有判红 strict⇒1、warn 面⇒0;两者皆无⇒0',
    exitCodeFor({ strict: true, redCount: 0, undeterminedCount: 5 }) === 2 &&
      exitCodeFor({ strict: true, redCount: 1, undeterminedCount: 5 }) === 1 &&
      exitCodeFor({ strict: false, redCount: 1, undeterminedCount: 5 }) === 0 &&
      exitCodeFor({ strict: true, redCount: 0, undeterminedCount: 0 }) === 0,
    JSON.stringify([
      exitCodeFor({ strict: true, redCount: 0, undeterminedCount: 5 }),
      exitCodeFor({ strict: true, redCount: 1 }),
      exitCodeFor({ strict: false, redCount: 1 }),
    ]),
  )
  // ES39 真仓对照的**形状**锁(不钉具体数字,免得台账腐烂):每一条判红都必须点名它的序源,
  //  每一条未判定都必须点名它归到哪条轴或"不在任何词表内" —— 两者都不许是空原因。
  const liveDec = decide(a.candidates)
  t(
    'ES39 真仓每条判红都必须带现读序源、每条未判定都必须点名归轴结果(不得出现无原因结论)',
    liveDec.red.every((c) => /最宽档|免审批/.test(c.why)) &&
      liveDec.undetermined.every((c) => /轴|词表|序源|不是档名字面量|取不到/.test(c.why)) &&
      liveDec.green.every((c) => /轴|数字字面量|抛错/.test(c.why)),
    JSON.stringify([...liveDec.red, ...liveDec.undetermined].map((c) => c.why.slice(0, 40))),
  )
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
      console.log(
        `  ${C.yellow}ℹ 未判定 ${c.file}:${c.line} [${c.form}] ${c.expr} —— ${c.why}${C.reset}`,
      )
    for (const c of d.green)
      console.log(`  ${C.green}✅ ${c.file}:${c.line} [${c.form}] ${c.expr} —— ${c.why}${C.reset}`)
    if (d.red.length === 0 && d.undetermined.length === 0)
      console.log(`${C.green}✅ 射程内每一处兜底都不落在现读推导的宽档集合上。${C.reset}`)
    else if (d.red.length === 0)
      console.log(
        `${C.green}✅ 无判红;另有 ${d.undetermined.length} 处未判定(不等于通过)。${C.reset}`,
      )
  }
  return exitCodeFor({ strict, redCount: d.red.length, undeterminedCount: d.undetermined.length })
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
  deriveAxes,
  classify,
  decideOnAxis,
  anyAxisHasTier,
  exitCodeFor,
  scanSource,
  decide,
  analyze,
  selfTest,
  tokensOf,
  arrayMembers,
  dictPairs,
  intMap,
  unionMembers,
  pySkipsApproval,
  setDiff,
  axisKeyTokens,
  maskScriptCommentsGuard,
  SCAN_TARGETS,
  REGISTRY_FILES,
  MEASURE_FILES,
  TS_REGISTRY,
  PY_REGISTRY,
  REAL_SITE_FILE,
  DANGER_TS,
  DANGER_API,
  DANGER_PY,
  APPROVAL_DANGER_TS,
  ISOLATION_CLI,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
