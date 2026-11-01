// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * autonomy-runner — 自开发发起腿的「执行体存续」判据单源(2026-11-01 立)。
 *
 * 病灶(auto-evolve 台账 53 行现读:dispatch 48 轮里 session-ok 仅 1):
 * `scripts/data/auto-evolve-gates.json` 把 `G:/IHUI-AI/apps/cli/npm-dist/dist/index.js` 钉死 ——
 * 盘符是另一台机的,而且本机 `apps/cli` 下没有 npm-dist 这一层,真实入口是 `apps/cli/dist/index.js`。
 * 后果不只是"起不来":派发器把这种**环境级失败按票面失败计数**,连败 3 次即封票 48h,
 * 于是调度器自己的腿断了,却把债摊到每一张真工作上(实测 B53 被冤封至 2026-11-03)。
 *
 * 本层只做判据,不做 IO 决策:
 *  - 归一口径直接 import `check-service-inventory.mjs` 的 `${REPO_ROOT}` 令牌与盘符 token 正则
 *    (§0.6 单一真相源 —— 同一道"盘符是 §0 七类现读机器事实"的理,不另造第二把尺);
 *  - 判据必须在真派发的那一刻才成立(§0.9):preflight 拿当次仓根去问盘上在不在位,
 *    拿不到输入一律 `undetermined`,绝不回落成"应该能跑"(§0.3)。
 */
import { existsSync, statSync } from 'node:fs'
import { DRIVE_PATH_TOKEN_RE, REPO_ROOT_TOKEN } from '../check-service-inventory.mjs'

export { REPO_ROOT_TOKEN }

/** 仓根的两种分隔符形态(长形优先替换,防半截命中)。
 *  形态坏一律返回 `[]` 交上层落 undetermined —— 静默不匹配比判不出更贵:
 *  实测把 `D:IHUI-AI`(丢了反斜杠)当仓根传进来时,归一与核验都会"一切正常"地放行。 */
export function repoRootVariants(repoRoot) {
  const norm = String(repoRoot ?? '').replace(/[\\/]+$/, '')
  if (!/^[A-Za-z]:[\\/].+/.test(norm)) return []
  return [...new Set([norm, norm.replace(/[\\/]/g, '/')])].sort((a, b) => b.length - a.length)
}

/** 把 `${REPO_ROOT}` 令牌展开成当次实测仓根(反斜杠形,cmd.exe 消费)。 */
export function expandRepoRootTemplate(text, repoRoot) {
  const variants = repoRootVariants(repoRoot)
  if (variants.length === 0) return null
  return String(text ?? '').split(REPO_ROOT_TOKEN).join(variants[0])
}

/**
 * 他机仓根钉死形态 → 当次仓根。
 * 只认「盘符 + 仓根末段逐字同名」这一族(`G:/IHUI-AI`、`g:\IHUI-AI`),
 * 因为仓根末段是本仓自己的名字,不随机器变;`C:\Users\…\node.exe` 这类盘外路径不碰
 * (口径与 bakedRepoPathHits 同:落在仓根之下才算,盘外不算)。
 */
export function rewriteForeignRepoRoot(text, repoRoot) {
  const variants = repoRootVariants(repoRoot)
  if (variants.length === 0) return null
  const base = variants[0].split(/[\\/]/).filter(Boolean).pop()
  if (!base) return null
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|[^A-Za-z0-9])[A-Za-z]:[\\\\/]${escaped}(?![A-Za-z0-9._-])`, 'g')
  return String(text ?? '').replace(re, (_m, lead) => `${lead}${variants[0]}`)
}

/** 配置里的模板 → 本轮真正交给 cmd.exe 的命令行(先救他机钉死,再展开令牌)。 */
export function resolveSessionCommand(template, repoRoot) {
  const rewritten = rewriteForeignRepoRoot(template, repoRoot)
  if (rewritten === null) return null
  return expandRepoRootTemplate(rewritten, repoRoot)
}

/** 命令行里所有带盘符的绝对路径 token(共用 check-service-inventory 的单条正则)。 */
export function extractAbsPathTokens(command) {
  const text = String(command ?? '')
  const out = []
  for (const raw of text.match(DRIVE_PATH_TOKEN_RE) ?? []) {
    const token = raw.replace(/["'`),]+$/, '')
    if (token && !out.includes(token)) out.push(token)
  }
  return out
}

/**
 * 派发前闸:执行体在位才准起会话。
 * state:
 *  - `ready`          每个盘符 token 都问到了且都在位
 *  - `missing`        点名哪几枚不在位(可执行出路 = 改配置或建产物)
 *  - `undetermined`   仓根取不到 / 模板里抽不出任何盘符 token(枚举到 0 判死,不记绿)
 *  - `template-empty` 空模板 = dry-run 档,结构上不派发,不算缺也不算过
 */
export function preflightSessionRunner(template, repoRoot) {
  const tpl = String(template ?? '')
  if (!tpl.trim()) return { state: 'template-empty', checked: [], missing: [], why: '模板空 = dry-run 档' }
  const command = resolveSessionCommand(tpl, repoRoot)
  if (command === null) {
    return { state: 'undetermined', checked: [], missing: [], why: '当次仓根取不到 ⇒ 无法核验执行体在位(§0.3 不回落)' }
  }
  const tokens = extractAbsPathTokens(command)
  if (tokens.length === 0) {
    return { state: 'undetermined', checked: [], missing: [], command, why: '命令行里没有可核验的带盘符路径 ⇒ 执行体存续判不出' }
  }
  const checked = []
  const missing = []
  for (const token of tokens) {
    let inPlace = false
    let isDir = false
    try {
      inPlace = existsSync(token)
      if (inPlace) isDir = statSync(token).isDirectory()
    } catch {
      inPlace = false
    }
    checked.push({ token, inPlace, isDir })
    if (!inPlace) missing.push(token)
  }
  return {
    state: missing.length > 0 ? 'missing' : 'ready',
    checked,
    missing,
    command,
    why: missing.length > 0 ? `${missing.length}/${checked.length} 枚路径不在位` : `${checked.length} 枚路径全部在位`,
  }
}

/**
 * 失败分型:区分「调度器自己的腿断了」与「这张票没干成」。
 * 环境级(ERR_MODULE_NOT_FOUND / Cannot find module / ENOENT / 路径不存在)不计票连败 ——
 * 否则一次配置腐烂会把整张派单面逐枚封禁,而真因一行也没被点名。
 */
export const ENV_FAILURE_SIGNS = [
  'ERR_MODULE_NOT_FOUND',
  'Cannot find module',
  'MODULE_NOT_FOUND',
  'ENOENT',
  'ERR_UNKNOWN_BUILTIN_MODULE',
  'The system cannot find the path specified',
  '系统找不',
]

/**
 * 通路级失败签名(2026-11-01 实测补):发起腿是四层链 —— 配置 → 执行体 → 本地服务 → 上游模型。
 * 实测 probe 把前三层穿通后卡在第三层(CLI 报"网络连接失败",api 侧报 "AI service unreachable:
 * fetch failed")。这类失败同样不是票的错:把它计进连败 = 一次服务抖动就封掉一张真票。
 */
export const TRANSPORT_FAILURE_SIGNS = [
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'fetch failed',
  'unreachable',
  '网络连接失败',
  'SERVICE_UNAVAILABLE',
  'proxyconnect',
]

export function classifySessionFailure({ status, stderr, error }) {
  const blob = `${String(stderr ?? '')}\n${String(error ?? '')}`
  const env = ENV_FAILURE_SIGNS.find((s) => blob.includes(s))
  if (env) return { kind: 'environment', sign: env, why: `执行体/模块级失败(${env})⇒ 属调度器自身故障,不计票连败` }
  const transport = TRANSPORT_FAILURE_SIGNS.find((s) => blob.includes(s))
  if (transport) return { kind: 'transport', sign: transport, why: `通路级失败(${transport})⇒ 服务面/上游依赖,不计票连败` }
  if (status === null || status === undefined) return { kind: 'undetermined', sign: null, why: '退出码取不到 ⇒ 不判成功也不记票失败' }
  if (status === 0) return { kind: 'ok', sign: null, why: '' }
  return { kind: 'session', sign: null, why: `会话自身失败(exit=${status})` }
}

/** 会冤封好票的两型:都不该进票的连败计数。 */
export const NON_TICKET_FAILURE_KINDS = ['environment', 'transport', 'undetermined']
export function isNonTicketFailure(kind) {
  return NON_TICKET_FAILURE_KINDS.includes(kind)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
