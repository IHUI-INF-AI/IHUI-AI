// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 模型「免费 / 付费」徽章的**唯一判据**(小程序端与 RN 端共用)。
 *
 * 消费方式只能是子路径 `@ihui/shared/ui/model-badge-facts` —— 按本仓 2026-09-27 立的规矩,
 * 新增导出一律走子路径,**不得**挂进 `src/ui/index.ts` 或根 barrel(根桶会把整棵 src/chat
 * 拉进被检程序,`model-list-spec.ts` 头注记过同一教训)。
 *
 * ## 为什么必须有这一份(不是偏好,是收口)
 * 立门前实测到 RN 内部就有**两套互不相等**的判据,各住在一个屏幕里:
 *  - `apps/mobile-rn/src/screens/AgentScreen.tsx` 的 `toModelListItem()`:
 *    `isFree: inputPrice === 0 && outputPrice === 0`(读的是 `AiModel.inputPrice/outputPrice`,
 *    缺失时先 `?? 0` 再比,即"价格在场以价格为准");
 *  - `apps/mobile-rn/src/screens/AiAssistantN8nScreen.tsx` 的 `modelListItems`:
 *    `isFree: /^@cf\/|^pollinations\/|^llm7\/|^aihorde\//.test(m.id)`(n8n 目录**不带价格字段**,
 *    只能按 zero_cost provider 前缀判,注释自述"与后端 free_provider_registry 对齐")。
 * 小程序侧则两条都没有:徽章**恒真**地渲染「免费」,对付费模型也说"免费" —— 那是假陈述,
 * 不是"少一个徽章"。本票把判据收成这一份,第三个端不得再抄第三种写法。
 *
 * ## 判序(两条,顺序不可交换)
 *  1. **有任一价格字段是 `number` ⇒ 以价格为准**:`(inputPrice ?? 0) === 0 && (outputPrice ?? 0) === 0`。
 *     价格是权威事实(id 前缀只是"没有价格时的分类线索"),所以字段在场就不许走回落档;
 *     `?? 0` 与 AgentScreen 同形 —— 缺 output_price 不等于收费(`packages/api-client` 的
 *     `LlmModel` 就只有 `input_price` 没有 output_price,小程序吃的正是这张契约)。
 *  2. **两个字段都缺失(null 亦视同缺失)⇒ 回落 `FREE_GATEWAY_ID_RE.test(id)`**。
 *     回落档是必需的,不是兜底装饰:n8n 目录(`AiAssistantN8nScreen`)根本没有价格字段,
 *     没有这一档就只有两种错法 —— 把"无价格"当成"免费"(与 AgentScreen 那套合不起来),
 *     或当成"付费"(把 4 个自由网关 provider 全标成收费)。
 *
 * `null` 与 `undefined` 同视:判据问的是"这份数据里有没有价格事实",不是"键在不在对象上"。
 */

/**
 * 自由网关 provider 的 id 前缀(仅在价格字段完全缺失时使用)。
 * 逐字取自 RN `AiAssistantN8nScreen.tsx` 的现网判据,其后端对照物是 `free_provider_registry`;
 * 换 provider 改这一处,两端跟随。不得在任何端再抄一份同义正则(那正是本模块存在的理由)。
 */
export const FREE_GATEWAY_ID_RE = /^@cf\/|^pollinations\/|^llm7\/|^aihorde\//

/**
 * 判据入参刻意是**结构最小集**而非某个端的模型类型:
 * RN 侧字段是 camelCase(`inputPrice`/`outputPrice`),小程序侧是 snake_case
 * (`input_price`,且契约里没有 output_price)。调用方做一次字段投影即可,
 * 本模块不得反过来认识任何一端的完整类型(那会把跨端共享层钉死在某一端的契约上)。
 */
export interface ModelPriceFacts {
  id: string
  inputPrice?: number | null
  outputPrice?: number | null
}

/**
 * 该模型是否免费。判序与理由见文件头(价格优先 → id 前缀回落),两条不可交换。
 */
export function modelIsFree(model: ModelPriceFacts): boolean {
  const hasPriceFact = typeof model.inputPrice === 'number' || typeof model.outputPrice === 'number'
  if (hasPriceFact) {
    return (model.inputPrice ?? 0) === 0 && (model.outputPrice ?? 0) === 0
  }
  return FREE_GATEWAY_ID_RE.test(model.id)
}
