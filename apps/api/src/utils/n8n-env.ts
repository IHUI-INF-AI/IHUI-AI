// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * n8n 上游基址的 env 读取唯一出口(issue #71,2026-09-28)。
 *
 * 立因:同一个 n8n 上游在本仓有两个名字 —— `N8N_DOMAIN`(n8n-proxy 的 /cozeZhsApi 代理、
 * `/ai/n8n` 写面、miniapp-compat 列表)与 `N8N_BASE_URL`(ai-vendors/proxy-tools 的
 * GET/POST `/n8n/workflows` 与 `/n8n/workflow/run`、chat-models 的厂商清单)。
 * 各处只认自己那一个名字,于是"运维配了另一个变量名"的表现是**静默未生效**:
 * 一面判"未配置"(503 或 stub),另一面照常工作,而两边都不喊。
 *
 * 三条不可漂的写法:
 * ① **主名优先,别名兜底** —— 每个调用点把自己历史上读的那个名字作为 `primary` 传进来。
 *    于是"该名字已配置"时的基址与改动前同一指向(纯放宽,不动对外语义);只有原先
 *    读不到值的那一格才因为别名而开始工作。反过来若无条件固定顺序,
 *    两个名字同时存在且取值不同时就会有一面的现网指向被换掉 —— 那是改契约。
 *    唯一如实登记的例外:主名写成显式 `http://` 时,过去 n8n-proxy 面会剥掉协议再强制
 *    `https://`(见改动前 `https://${domain.replace(/^https?:\/\//,'')}`),现在照写 http。
 *    该档不构成"原本能用却被改掉" —— 按旧写法它今天就必须跑在 443/https 上,
 *    配 http:// 的运维本来就连不上,所以这一格只有"变对"没有"变坏"。
 * ② **判据与形态归一都只有一份** —— 哪些名字算 n8n 基址、空值/纯空白算不算"未配置"、
 *    尾斜杠怎么去、bare host 怎么补 scheme,全部住在本文件;调用点禁止再写
 *    `process.env.N8N_DOMAIN` / `process.env.N8N_BASE_URL`,也禁止自己再拼 `https://`
 *    或再 `.replace(/^https?:\/\//,'')`(本仓最高频失效型就是两处算同一件事必漂移)。
 *    这一条不是洁癖:两个名字的**书写习惯不同** —— `N8N_BASE_URL` 历来带 scheme,
 *    `N8N_DOMAIN` 历来是裸主机名(n8n-proxy 靠 `https://${domain}` 补)。只换名字而不补
 *    scheme,别名那一格会拼出 `n8n.example.com/api/v1/...` 这种无协议 URL,
 *    fetch 当场抛 → 502,表现从"明确未配置"变成"明确看不懂",那不是放宽,是换一个坏法。
 * ③ **命中来源随值返回**(`source`)—— 报错与日志要能说出"用的是哪个变量",
 *    否则排障仍然回到"读不到却不知为何"。
 */

/** n8n 基址的两个合法名字(新增第三个名字必须先改这里,不得在调用点加)。 */
export type N8nBaseEnvName = 'N8N_DOMAIN' | 'N8N_BASE_URL'

/** 全部合法别名;顺序仅是清单,真正的优先级由调用点的 primary 决定。 */
export const N8N_BASE_URL_ALIASES: readonly N8nBaseEnvName[] = ['N8N_DOMAIN', 'N8N_BASE_URL']

export interface N8nBaseSource {
  /** 带 scheme 的绝对基址,无尾斜杠:原值已带 https?:// 就照原样,裸主机名按 https 补。 */
  origin: string
  /** 命中的是哪一个变量名(排障用)。 */
  source: N8nBaseEnvName
}

export interface N8nCredentials extends N8nBaseSource {
  apiKey: string
}

const isPresent = (v: string | undefined): v is string => typeof v === 'string' && v.trim() !== ''

/**
 * 归一为可直接拼 `/api/v1...` 的绝对基址(唯一的 scheme 判据,调用点不得各写一遍)。
 * 只剩协议或全斜杠的值(如 `///`、`http://`)量不出主机 ⇒ 返回 null,由调用方按"未配置"办 ——
 * 放过去只会产出一个必失败的 URL,那比 503 更难归因。
 */
export function toN8nOrigin(raw: string): string | null {
  const value = raw.trim()
  const scheme = /^(https?:\/\/)/i.exec(value)?.[1]
  // 先按"有没有协议"分岔,再剥尾斜杠 —— 顺序反了会把 'http://' 剥成 'http:' 而认不出协议,
  // 于是补出一个 https://http: 这种更坏的 URL(本函数第一条用例就是抓它的)。
  const host = (scheme ? value.slice(scheme.length) : value).replace(/\/+$/, '')
  if (host === '') return null
  return scheme ? `${scheme}${host}` : `https://${host}`
}

/**
 * 按 "primary 优先、其余别名兜底" 解析 n8n 基址。
 * 全部候选都没配 ⇒ null(调用点决定自己的未配置档:503 / stub / 空态,本出口不替它判)。
 */
export function readN8nBaseUrl(
  primary: N8nBaseEnvName,
  env: NodeJS.ProcessEnv = process.env,
): N8nBaseSource | null {
  const order: N8nBaseEnvName[] = [primary, ...N8N_BASE_URL_ALIASES.filter((n) => n !== primary)]
  for (const name of order) {
    const raw = env[name]
    if (!isPresent(raw)) continue
    const origin = toN8nOrigin(raw)
    if (origin) return { origin, source: name }
  }
  return null
}

/** 基址 + `N8N_API_KEY` 都在位才算"已配置";缺一即 null(与两个面改动前的与条件同形)。 */
export function readN8nCredentials(
  primary: N8nBaseEnvName,
  env: NodeJS.ProcessEnv = process.env,
): N8nCredentials | null {
  const base = readN8nBaseUrl(primary, env)
  if (!base) return null
  const key = env.N8N_API_KEY
  if (!isPresent(key)) return null
  return { ...base, apiKey: key.trim() }
}

/** 只涉及基址的那一档(如 /n8n/workflow/run 的 key 走厂商配置出口,不该在文案里提 N8N_API_KEY)。 */
export const n8nBaseHint = (primary: N8nBaseEnvName): string => {
  const other = N8N_BASE_URL_ALIASES.find((n) => n !== primary)
  return other ? `${primary}(或别名 ${other})` : primary
}

/** 未配置时对运维说话的那句话(两个面共用,免得一处列全名、另一处只列一个)。 */
export const n8nNotConfiguredHint = (primary: N8nBaseEnvName): string =>
  `未配置 ${n8nBaseHint(primary)}/N8N_API_KEY`
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
