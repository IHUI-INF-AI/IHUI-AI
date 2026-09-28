// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// D94 失败诊断交接包 / 脱敏 —— **共享层唯一实现**(2026-09-24 立)
//
// **自证结论(改本文件前先读)**:
//   · 既有脱敏**有两处**,且**都不在共享层**:
//     ① `apps/ai-service/app/core/output_cleaning.py::redact_secrets` —— 出库边界
//        (SSE / transcript / 工具输出 / MCP 回包),标记 `[REDACTED_SECRET]`,11 类正则;
//        调用点:`services/importers/ir.py:230`、`services/mcp_server.py:1454/1960/2061`。
//     ② `apps/cli/src/redact.ts::redactSecrets` —— CLI 日志与审计,标记 `***REDACTED***`,
//        11 类正则 + URL query 12 类敏感参数 + 用户路径。
//   · `packages/shared/src/utils/` 下**没有**任何 redact / sanitize(全目录 grep
//     `redact|sanitize` 0 命中),而 D94 的交接单要同时供 web、运维邮件(唯一到人通道,
//     AGENTS.md §5e)与工单粘贴使用 ⇒ 按 AGENTS.md「共享层优先」在共享层立**唯一**
//     实现,端内不得再建第二套脱敏规则。
//
// **严禁另起一套**:规则集 = ①② 的**并集**,逐条注明来源;两条同时存在时阈值取
// **更严**的一侧(宁可多盖,不可漏 —— 漏了交接单会外泄,多盖只是少一点上下文)。
// 标记沿用既有形态:凭据 → `[REDACTED_SECRET]`(①的出库标记),URL query 值 →
// `***REDACTED***`(②的既有标记)。**没有新造标记**。
//
// **本票新增(①② 都缺、D94 明文要求必须盖)**:邮箱、IPv4、24 位以上十六进制串,
// 集中在 `D94_ADDED_PATTERNS` / `redactEmails` / `redactIps`,来源标注 `D94`。
//
// **2026-09-27 追加(崩溃上报链路,守门「崩溃上报出口脱敏对账」的靶心)**:新增
// `USER_HOME_PATH_RULES` / `redactUserHomePathLiterals` / `redactCrashText`,来源标注
// `crash-report`。这不是"另起一套",而是给本模块补上**拿不到注入值时也必须盖住用户目录**
// 的那一档(浏览器与"收到别人机器路径"的服务端都无法注入 home/user)——规则与本文件其余
// 规则同源同处,出口只有一个 `redactCrashText`。
//
// 顺序沿用①的既有链路(`ir.py:230` = `redact_secrets(strip_ansi(x))`):
//   strip_ansi → URL query → 凭据正则 → 本票新增三类 → 用户路径。
// (先 strip_ansi 再脱敏:转义序列可能把完整凭据"切断"成一串短片段,先清掉才盖得住。)
//
// **平台约束**:共享层要跑在 miniapp-taro / mobile-rn,**不得 import `node:os`** ——
// ②里的 `os.homedir()` / `os.userInfo()` 改为**注入式**(`RedactOptions.home/user`),
// 不注入则该步空转(交接单里没有路径可盖时不盖,绝不因此失败)。

/** ① `output_cleaning.py` 的出库脱敏标记 */
export const REDACT_SECRET_MARKER = '[REDACTED_SECRET]' as const

/** ② `cli/redact.ts` 的 URL query 值脱敏标记(既有形态,沿用不改名) */
export const REDACT_QUERY_MARKER = '***REDACTED***' as const

/** 邮箱脱敏:保留首字符 + 掩码 + 域名(可定位到"哪个域",但不外泄账号) */
export const REDACT_EMAIL_LOCAL_MASK = '***' as const

/** IPv4:整段替换(交接单不需要知道具体地址) */
export const REDACT_IP_MARKER = '[REDACTED_IP]' as const

/** 规则来源(便于守门脚本按来源统计、防有人偷偷加自有正则) */
export type RedactRuleSource = 'output_cleaning.py' | 'cli/redact.ts' | 'D94' | 'crash-report'

export interface RedactRule {
  readonly source: RedactRuleSource
  readonly pattern: RegExp
  readonly replacement: string
}

/**
 * 凭据正则**并集**(顺序敏感:先盖"凭据头 + 值"整块,再盖裸 key 形态,最后盖通用赋值)。
 * 与 ① 的顺序、与 ② 的阈值取舍一致,逐条注明来源。
 */
export const SECRET_RULES: readonly RedactRule[] = [
  // PEM 私钥块(整块盖掉,含中间内容)[① 同名规则;② 的第 11 条同形,阈值更松]
  {
    source: 'output_cleaning.py',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: REDACT_SECRET_MARKER,
  },
  // Authorization: Bearer xxx(①:>=16 位;②:保留前 4 位 —— 取更严的①,整段盖掉)
  {
    source: 'output_cleaning.py',
    pattern: /(\bbearer\b[ \t]+)[A-Za-z0-9._~+/-]{16,}=*/gi,
    replacement: `$1${REDACT_SECRET_MARKER}`,
  },
  // URL 内联凭据 scheme://user:pass@host [①]
  {
    source: 'output_cleaning.py',
    pattern: /(\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:)[^\s/@]+@/gi,
    replacement: `$1${REDACT_SECRET_MARKER}@`,
  },
  // OpenAI / Anthropic 风格 sk-(proj-|ant-)xxxx [①:20+;②:8+12 —— 取①]
  {
    source: 'output_cleaning.py',
    pattern: /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}/g,
    replacement: REDACT_SECRET_MARKER,
  },
  // 上游号池密钥 sk_xxxx [①]
  {
    source: 'output_cleaning.py',
    pattern: /\bsk_[A-Za-z0-9]{16,}\b/g,
    replacement: REDACT_SECRET_MARKER,
  },
  // IHUI 对客 key ihui_xxxx [①]
  {
    source: 'output_cleaning.py',
    pattern: /\bihui_[A-Za-z0-9]{16,}\b/g,
    replacement: REDACT_SECRET_MARKER,
  },
  // AWS Access Key ID:AKIA(①16 位)/ ASIA(②12 位)—— 取更严的②
  {
    source: 'cli/redact.ts',
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{12,}\b/g,
    replacement: REDACT_SECRET_MARKER,
  },
  // GitHub token ghp_/gho_/ghu_/ghs_/ghr_/github_pat_ [①:20+;②:16+ —— 取①]
  {
    source: 'output_cleaning.py',
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
    replacement: REDACT_SECRET_MARKER,
  },
  // Google API key AIza + 30 位(①已放宽尾边界以兼容拼接输出行)[①]
  {
    source: 'output_cleaning.py',
    pattern: /\bAIza[0-9A-Za-z_-]{30,}/g,
    replacement: REDACT_SECRET_MARKER,
  },
  // Slack token xox[baprs]- [①] + Slack xapp- [②] + GitLab glpat- [②]
  {
    source: 'output_cleaning.py',
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g,
    replacement: REDACT_SECRET_MARKER,
  },
  {
    source: 'cli/redact.ts',
    pattern: /\b(?:xapp-|glpat-)[A-Za-z0-9-]{6,}\b/g,
    replacement: REDACT_SECRET_MARKER,
  },
  // JWT(三段 base64url)[①]
  {
    source: 'output_cleaning.py',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    replacement: REDACT_SECRET_MARKER,
  },
  // Authorization: Basic xxx [②]
  {
    source: 'cli/redact.ts',
    pattern: /(Authorization\s*:\s*Basic\s+)[A-Za-z0-9+/=]{8,}/gi,
    replacement: `$1${REDACT_SECRET_MARKER}`,
  },
  // 通用 k=v / k: v 赋值(保留键名、分隔符、引号,只盖值;值为 `${VAR}` / os.getenv /
  // settings.x 等引用形态时不盖 —— ①的误伤防护)[①:值 >=8]
  //
  // `(?!\[REDACTED|\*\*\*REDACTED)` 是**本票补的防二次处理闸门**:① 把值盖成
  // `[REDACTED_SECRET]` 后,② 的短值规则会把它当成一个 15 位"新值"再盖一次
  // (实测产出 `password=[R[REDACTED_SECRET]` —— 由本文件单测抓到)。两条规则都必须
  // 跳过已是标记的值,否则脱敏不幂等、标记会堆叠。
  {
    source: 'output_cleaning.py',
    pattern:
      /\b(api[_-]?key|access[_-]?token|auth[_-]?token|token|secret|password|passwd|pwd|client[_-]?secret|private[_-]?key|encryption[_-]?key)\b(\s*[:=]\s*)(["']?)(?!\[REDACTED)(?!\*\*\*REDACTED)(?![${)&])(?!os\.|get_|settings\.|process\.|env\[)([^\s"',;]{8,})/gi,
    replacement: `$1$2$3${REDACT_SECRET_MARKER}`,
  },
  // password / api_key 的短值补盖 [②:前缀 2 字符 + 后缀 >=4,即 6 位起 —— 比①更严]
  {
    source: 'cli/redact.ts',
    pattern:
      /((?:password|passwd|pwd|api[_-]?key)\s*[:=]\s*"?)(?!\[REDACTED)(?!\*\*\*REDACTED)(?!os\.|get_|settings\.|process\.|env\[)(?![${)&])([^\s"',;]{2})[^\s"',;]{4,}/gi,
    replacement: `$1$2${REDACT_SECRET_MARKER}`,
  },
]

/**
 * **本票新增**的三类(①② 都没有,而 D94 验收明文要求"密钥/邮箱/IP/token 必须脱敏")。
 * 与凭据并集分开存放,便于守门脚本单独统计"哪些规则是仓库既有、哪些是本票新增"。
 */
export const D94_ADDED_PATTERNS: readonly RedactRule[] = [
  // 24 位以上十六进制串(ObjectId / 随机 token / 会话标识)。副作用已登记:
  // 40 位 git SHA 也会被盖 —— 交接单以"不出事"优先,排障需要 SHA 时走仓库内部渠道。
  {
    source: 'D94',
    pattern: /\b[0-9a-fA-F]{24,}\b/g,
    replacement: REDACT_SECRET_MARKER,
  },
]

/** 敏感 query 参数名(大小写不敏感)—— 沿用 ② 的 12 类,**不增删** */
export const SENSITIVE_QUERY_PARAMS: ReadonlySet<string> = new Set([
  'access_token', 'api_key', 'apikey', 'auth', 'authorization',
  'code', 'password', 'passwd', 'refresh_token', 'secret',
  'token', 'client_secret', 'private_key',
])

const ANSI_ESCAPE_RE =
  // 含 \x1b 控制字符(ANSI 转义),源码里 unavoidable —— 移植自 python `_ANSI_ESCAPE_RE`
  /\x1b(?:\[[0-9;?<=>!]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)?|[@-Z\\-_])/g

const EMAIL_RE = /\b([A-Za-z0-9._%+-])([A-Za-z0-9._%+-]*)@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})\b/g
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g

export interface RedactOptions {
  /** $HOME(注入式:共享层不得依赖 `node:os`,miniapp/rn 无此模块) */
  readonly home?: string | null
  /** 当前用户名(同上,注入式) */
  readonly user?: string | null
}

/** 剥离 ANSI 转义序列(CSI / OSC / 单字符转义)—— 直接移植 ① 的 `_ANSI_ESCAPE_RE` */
export function stripAnsi(text: string): string {
  if (!text) return text
  if (!text.includes('\x1b')) return text
  return text.replace(ANSI_ESCAPE_RE, '')
}

/** URL 中敏感 query 参数的值脱敏(移植 ② 的 `redactUrl`,12 类参数名与标记均不变) */
export function redactUrl(input: string): string {
  if (!input) return input
  return input.replace(/((?:https?|ftp|file):\/\/[^\s"'<>#?]*\?)([^\s"'<>#]*)/gi, (_m, prefix: string, query: string) => {
    if (!query) return prefix
    const parts = query.split('&').map((kv) => {
      const eq = kv.indexOf('=')
      if (eq === -1) return kv
      const key = kv.slice(0, eq)
      if (SENSITIVE_QUERY_PARAMS.has(decodeURIComponent(key).toLowerCase())) {
        return `${key}=${REDACT_QUERY_MARKER}`
      }
      return kv
    })
    return prefix + parts.join('&')
  })
}

/**
 * 邮箱脱敏:`chunchuan.li@aizhs.top` → `c***@aizhs.top`。
 * 保留域名(交接单需要知道"涉及哪个域"),账号部分一律掩码。
 */
export function redactEmails(text: string): string {
  if (!text) return text
  return text.replace(EMAIL_RE, (_m, first: string, _rest: string, domain: string) =>
    `${first}${REDACT_EMAIL_LOCAL_MASK}@${domain}`,
  )
}

/** IPv4 整段替换(不含 IPv6 —— 见文件头"剩余缺口") */
export function redactIps(text: string): string {
  if (!text) return text
  return text.replace(IPV4_RE, REDACT_IP_MARKER)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 用户绝对路径脱敏(移植 ② 的 `redactUserPaths`,`os.*` 改为注入式):
 * `$HOME` → `~`,`Users/<name>`、`/home/<name>` → `<user>`。
 * 不注入 home/user 时该步空转(不报错、不改文本)。
 */
export function redactUserPaths(input: string, options: RedactOptions = {}): string {
  if (!input) return input
  let result = input
  const home = options.home
  if (home && home.length > 3) {
    result = result.replace(new RegExp(escapeRegExp(home), 'gi'), '~')
  }
  const user = options.user
  if (user && user.length > 1) {
    result = result.replace(
      new RegExp(`((?:[/\\\\]Users[/\\\\])|(/home/))${escapeRegExp(user)}`, 'gi'),
      '$1<user>',
    )
  }
  return result
}

/**
 * 崩溃上报专用:**无需注入**的用户主目录字面量规则(2026-09-27 立)。
 *
 * 为什么 `redactUserPaths` 不够:它按 `RedactOptions.home/user` 注入式匹配,而崩溃上报的
 * 两个现场都拿不到注入值 —— ① 浏览器侧根本不知道用户主目录在哪(也不能知道,那是新的隐私面);
 * ② 服务端收到的是**别人机器上**的路径,`os.homedir()` 是本机的。所以"用户路径"这一档在崩溃
 * 链路上必须是**形状匹配**而不是"与本机 home 比对",否则它永远空转。
 * 本组规则住在同一个 redact 模块、同一个出口函数里 —— **不得在端内再抄一份路径正则**
 * (两处算同一件事必漂移,是本仓记过最多次的失败型)。
 *
 * 保守性(判据必须"命中形状才遮"):
 *  - 只替换 `<name>` 这一段,路径其余部分原样保留 ⇒ 堆栈仍然可读(能定位到是哪个文件);
 *  - 尾随断言 `(?=[\\/]|$)` 要求用户名后必须是分隔符或结尾 ⇒ 业务路由
 *    `/src/pages/home/index.tsx:10:5` 这类"名字后面接的是 `:`(行列号)"不被判成用户目录;
 *  - 字符类排除 `: * ? " < > | 空白`,Windows 非法文件名字符不可能被误吞进用户名段。
 * 标记沿用 `redactUserPaths` 已有的 `<user>`,**没有新造第三种标记**。
 */
export const USER_HOME_PATH_RULES: readonly RedactRule[] = [
  // Windows `C:\Users\<name>\` / Git-Bash `/c/Users/<name>/` / macOS `/Users/<name>/`
  // (大小写不敏感:git-bash 与部分打包器会把它写成 `/users/`)
  {
    source: 'crash-report',
    pattern: /([\\/]Users[\\/])([^\\/:*?"<>|\s]{1,64})(?=[\\/]|$)/gi,
    replacement: `$1<user>`,
  },
  // Linux `/home/<name>/`(刻意**不**加 i:大小写敏感的 POSIX 路径里 `/HOME/` 多半是业务目录名)
  {
    source: 'crash-report',
    pattern: /([\\/]home[\\/])([^\\/:*?"<>|\s]{1,64})(?=[\\/]|$)/g,
    replacement: `$1<user>`,
  },
]

/** 用户主目录字面量脱敏(形状匹配,不需要注入 home/user) */
export function redactUserHomePathLiterals(text: string): string {
  if (!text) return text
  let out = text
  for (const rule of USER_HOME_PATH_RULES) out = out.replace(rule.pattern, rule.replacement)
  return out
}

/**
 * 凭据脱敏主入口:**既有规则并集 + 本票新增三类 + 用户路径**。
 * (不含 strip_ansi —— 需要清转义请用 `sanitizeEvidenceText`。)
 */
export function redactSecrets(text: string, options: RedactOptions = {}): string {
  if (!text) return text
  let out = redactUrl(text)
  for (const rule of SECRET_RULES) out = out.replace(rule.pattern, rule.replacement)
  for (const rule of D94_ADDED_PATTERNS) out = out.replace(rule.pattern, rule.replacement)
  out = redactEmails(out)
  out = redactIps(out)
  return redactUserPaths(out, options)
}

/**
 * 交接单证据的**唯一**净化入口:strip_ansi → 脱敏(顺序与 ① 的 `ir.py:230` 一致)。
 * 交接单里任何对外可见的字符串都必须先过这里,**禁止直接拼原文**。
 */
export function sanitizeEvidenceText(text: string, options: RedactOptions = {}): string {
  return redactSecrets(stripAnsi(text), options)
}

/**
 * **崩溃上报文本的唯一脱敏出口**(2026-09-27 立)。
 *
 * 病灶:`apps/web/src/components/common/ErrorBoundary.tsx` 把 `error.message` / `error.stack`
 * 原样 POST 到 `/api/crash-reports`,而接收端只有 zod 长度上限(4000/20000),**零脱敏**,
 * 且该端点**匿名可写**(见 `apps/api/src/routes/crash-reports.ts` 的设计注释)。
 * ⇒ 错误消息里内嵌的 API key / Bearer token / 用户机器绝对路径会明文进入 `crash_reports`
 * (保留 90 天,见 `apps/api/src/jobs/pii-retention-cleanup.ts`)并出现在 admin 面板。
 *
 * 组成 = `sanitizeEvidenceText`(strip_ansi → URL query → 凭据并集 → 邮箱/IP → 注入式用户路径)
 * ⊕ `redactUserHomePathLiterals`(形状匹配的用户主目录)。多这一档的理由见该常量注释:
 * 崩溃链路两个现场都拿不到注入值,只靠 `redactUserPaths` 那一档**永远空转**。
 *
 * 幂等:两趟调用字节相同(凭据侧由 SECRET_RULES 的 `(?![REDACTED` 闸门兜住,
 * 路径侧 `<user>` 含 `<>` 不在字符类里 ⇒ 第二次匹配不上)。
 *
 * **端内不得再写第二份脱敏规则**,也不得拿 `redactSecrets` 之外的自有正则替代本出口 ——
 * 崩溃上报的发射点与落库点由守门「崩溃上报出口脱敏对账」按本函数名逐处对账。
 */
export function redactCrashText(text: string, options: RedactOptions = {}): string {
  return redactUserHomePathLiterals(sanitizeEvidenceText(text, options))
}
