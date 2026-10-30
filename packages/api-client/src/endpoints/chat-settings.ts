// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 聊天设置端点封装(补 RN 承载用,2026-10-27 后端契约现读)
 *
 *  - PUT /api/chat/settings
 *    (apps/api/src/routes/chat.ts:2183-2255,chatRoutes 挂 prefix /api/chat,
 *     apps/api/src/routes/index.ts:580;requireAuth)
 *    body = chatSettingsPutSchema(chat.ts:2183-2188):
 *      model 1-128 字符串;temperature coerce 0-2;maxTokens coerce int 1-2_000_000;
 *      systemPrompt ≤20000 **可选,缺省 = 后端不修改旧值**(chat.ts:2244-2251)。
 *    信封成功返回 success({model,temperature,maxTokens,systemPrompt})(chat.ts:2252-2254),
 *    400 = zod issues[0].message(chat.ts:2223)。
 *  - GET /settings(chat.ts:2191-2214)在册但 **web 基准页不消费**:
 *    apps/web/app/(main)/chat/settings/page.tsx 只做 PUT + 硬编码初值(0.7/2048/'' + 下拉首项),
 *    不做服务端注水。RN 与 web 同口径:本文件不封装 GET,薄壳不请求 /settings,
 *    避免"RN 注水、web 不注水"的双端行为漂移。若日后 web 先做 GET 注水,两端同批改。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** PUT /api/chat/settings 请求体(web page.tsx:67-73 同源构造) */
export interface ChatSettingsInput {
  model: string
  /** 0-2(web 前端校验口径;后端上限 2 同值) */
  temperature: number
  /** web 前端校验 1-32768(严于后端 2_000_000 上限,照抄 web 口径) */
  maxTokens: number
  /** 空串 web 侧转 undefined = 不修改(chat settings page.tsx:72 `|| undefined`) */
  systemPrompt?: string
}

/** PUT 返回 data(chat.ts:2253 逐字段现读) */
export interface ChatSettingsPutResult {
  model: string
  temperature: number
  maxTokens: number
  systemPrompt: string | null
}

export async function updateChatSettings(
  input: ChatSettingsInput,
): Promise<ApiResult<ChatSettingsPutResult>> {
  return fetchApi<ChatSettingsPutResult>('/api/chat/settings', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
