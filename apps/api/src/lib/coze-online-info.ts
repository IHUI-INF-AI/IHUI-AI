// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Coze `GET /v1/bot/get_online_info` 的响应形状 ↔ agents 表缓存列的映射(单源)。
 *
 * 形状取证 2026-10-20 真跑 api.coze.cn(凭据取自交接存档 coze_zhs_py/config.py 的 JWT 应用,
 * 样本 bot 7530528655878078473,工作区 7451231663906193408):
 * - `data` 是**平铺**的,没有 `bot_info` 包裹层;
 * - `model_info` 是**对象**:`{model_id:"1749615103", model_name:"豆包·1.6·自动深度思考",
 *   temperature:0.8, top_p:1, max_tokens:4096, context_round:3, ...}`;
 * - `prompt_info` 是**对象**:`{prompt:"# 角色\n…", prompt_mode:"normal"}`;
 * - `variables` 是**数组**(该 bot 为 `[]`);`version` 是数字串 `"1758001958004"`;
 * - `icon_url` 是带 `x-expires` 的签名地址,现读 **30 天**(而 `/v1/bots` 列表端点那批是 3 天);
 * - 未发布到渠道的 bot 返回 `code=4015`、已删除的返回 `code=4200`,两者 `data` 都是空对象。
 *
 * 刻意不映射的三列(每条都是现读出来的,不是"保守起见"):
 * - `avatar`:远端地址会过期(上面那两个 30 天 / 3 天读数),而本表存的是导入时转存的本地件
 *   `apps/web/public/agents/coze/<bot_id>.webp`;一次"拉取详情"把长效本地路径换成短命签名 URL,
 *   等于把头像刷新成一张若干天后必然 404 的图。
 * - `agent_model`:该列是**可路由**字段 —— `v1-public.ts:1084` 把它当 model 透给 ai-service,
 *   `:454` 又折进 capabilities。Coze 的 `model_id` 是 Coze 侧的数字主键、`model_name` 是中文展示名,
 *   两者拿到我们的路由上都不认识(2026-10-20 导入时就因写展示名把 `/v1/agents/:id/call` 打断过)。
 * - `agent_temperature`:列型是 integer(schema `agents-extended.ts`),而远端是 0.8 这类浮点,
 *   写进去会被 PG 取整成 0/1 的假值 —— 宁可不写。
 */

type CozeModelInfo = {
  model_id?: string
  model_name?: string
  temperature?: number
  top_p?: number
  max_tokens?: number
  context_round?: number
}

type CozePromptInfo = {
  prompt?: string
  prompt_mode?: string
}

export type CozeOnlineInfoData = {
  bot_id?: string
  name?: string
  description?: string
  icon_url?: string
  version?: string | number
  prompt_info?: CozePromptInfo | string
  model_info?: CozeModelInfo | string
  variables?: unknown[]
}

/** 允许被"拉取详情"刷新的列 —— 与 updateAgentDetails 的参数类型同源,收窄到这一组。 */
export type CozeDetailPatch = {
  agentPrompt?: string
  agentVersion?: string
  agentMaxTokens?: number
  agentVariables?: string
}

const AGENT_VERSION_MAX_LEN = 32 // schema: varchar('agent_version', { length: 32 })
const PG_INTEGER_MAX = 2147483647

function promptTextOf(p: CozePromptInfo | string | undefined): string | undefined {
  if (typeof p === 'string') return p.trim() ? p : undefined
  const text = p?.prompt
  return typeof text === 'string' && text.trim() ? text : undefined
}

function versionOf(v: CozeOnlineInfoData['version']): string | undefined {
  const s = typeof v === 'number' ? String(v) : v
  if (typeof s !== 'string') return undefined
  const trimmed = s.trim()
  return trimmed && trimmed.length <= AGENT_VERSION_MAX_LEN ? trimmed : undefined
}

function maxTokensOf(m: CozeModelInfo | string | undefined): number | undefined {
  if (!m || typeof m === 'string') return undefined
  const n = m.max_tokens
  return Number.isInteger(n) && (n as number) > 0 && (n as number) <= PG_INTEGER_MAX ? n : undefined
}

/**
 * 把远端 data 折成"可直接落库的差量"。返回空对象 ⇒ 远端这次没给出任何可用字段,
 * 调用方据此**不写库**(否则只是把 updated_at 顶新、把该条挤到列表前面)。
 */
export function mapCozeOnlineInfo(data: CozeOnlineInfoData | undefined): CozeDetailPatch {
  const patch: CozeDetailPatch = {}
  if (!data) return patch

  const prompt = promptTextOf(data.prompt_info)
  if (prompt !== undefined) patch.agentPrompt = prompt

  const version = versionOf(data.version)
  if (version !== undefined) patch.agentVersion = version

  const maxTokens = maxTokensOf(data.model_info)
  if (maxTokens !== undefined) patch.agentMaxTokens = maxTokens

  if (Array.isArray(data.variables)) patch.agentVariables = JSON.stringify(data.variables)

  return patch
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
