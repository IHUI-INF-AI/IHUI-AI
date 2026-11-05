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

// ===========================================================================
// 人工阀前置闸(2026-11-01 接线)
// ===========================================================================
//
// 病灶实测(回源核对,非推测):`scripts/human-gates.mjs` 的 `classify()` 在派发路径上
// **零调用** —— auto-evolve 只 loadHumanGates + summarizeHumanGates 打印了一句
// "自决 4 条 / 停机等人 7 条"。那 7 条"停机等人"既没进票 prompt、也没在任何动作前被问,
// 所以闸不在发信处,而在被派起的会话手里 —— 一个自觉遵守的闸等于没有闸。
//
// 分类判据一律 import `scripts/lib/human-valve.mjs`(§0.6 唯一实现),本层不另写第二份关键词表。
// 该实现是 fail-closed 的:动作不在已知清单 ⇒ stop-for-human。
// 因此这一档**必须从 observe 起步**:直接 enforce 会把所有未知措辞的票一律停掉,
// 等于刚把发起腿修活就把它再锁死。observe 期要量的是"命中分布",看清语料与票面是否对得上,
// 再择档 enforce —— 且 enforce 的前置条件写死在这里:observe 期必须真有过命中。
import { classifyAction, parseValveList, BUCKETS, HumanValveDataError } from './human-valve.mjs'

export const VALVE_MODES = ['observe', 'enforce']

/**
 * 派发前问一次人工阀。返回 action(返回值语义):
 *  - `allow`         未命中停机类(自决类未过期,或不受管)⇒ 放行
 *  - `block`         enforce 档命中停机类 ⇒ 本张票不派(单票跳过,不重试、不绕行)
 *  - `observe-stop`  observe 档命中停机类 ⇒ 本张票不派:派发侧 decideValveDispatch 折成
 *                    `skip-observe-stop` —— 跳过该票、继续本轮(不是照派)
 *  - `unjudged`      档位非法(合法档仅 observe|enforce,on-warn/allow 同属非法)/清单坏/
 *                    分类器拒判 ⇒ 不猜。enforce 档由调用方 fail-closed 整轮停;
 *                    非 enforce 档沿用既有行为照派。
 */
export function gateTicketByHumanValve({ ticketText, mode, valveListText, now = new Date() } = {}) {
  if (!VALVE_MODES.includes(mode)) {
    return { action: 'unjudged', ruleId: null, reason: `humanValveMode 取值非法(${JSON.stringify(mode)})⇒ 不猜档(合法值 ${VALVE_MODES.join('|')})` }
  }
  let rules
  try {
    rules = parseValveList(valveListText).rules
  } catch (e) {
    return { action: 'unjudged', ruleId: null, reason: `人工阀清单取不到或形状坏(${e instanceof HumanValveDataError ? e.message : String(e?.message ?? e)})⇒ 未判定` }
  }
  let verdict
  try {
    verdict = classifyAction(String(ticketText ?? ''), { rules, now })
  } catch (e) {
    return { action: 'unjudged', ruleId: null, reason: `分类器拒绝判定(${e?.message ?? e})⇒ 未判定` }
  }
  const stop = verdict.bucket === BUCKETS.STOP_FOR_HUMAN
  if (!stop) return { action: 'allow', ruleId: verdict.ruleId, reason: verdict.reason }
  return {
    action: mode === 'enforce' ? 'block' : 'observe-stop',
    ruleId: verdict.ruleId,
    reason: verdict.reason,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
