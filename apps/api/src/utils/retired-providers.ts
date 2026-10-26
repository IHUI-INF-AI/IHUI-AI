// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 退役 provider 守卫 + 默认对话模型解析(2026-10-26 立)。
 *
 * 背景(事实,不是推测):stepfun(阶跃星辰)订阅失效后被机主**永久除名**,
 * 不得再以任何形式回到调用链。而 apps/api 侧曾有 4 处把默认模型写死成
 * `process.env.LITELLM_MODEL || '<stepfun 档>'` 形态 —— 生产 .env 实测**没有**
 * LITELLM_MODEL ⇒ 那 4 处真的会落到已 400 的 provider,且没有任何自动修复路径
 * (上游换名/换版本只能人工逐处改字面量)。
 *
 * 本文件是 apps/api 侧的唯一解析入口,与 Python 侧
 * `apps/ai-service/app/core/default_model.py` 同名同义:
 *   - `RETIRED_PROVIDER_PREFIXES` ≡ Python 侧 `RETIRED_MODEL_PREFIXES`
 *   - `isRetiredModel()` ≡ Python 侧 `is_retired_model()`
 *   - `resolveDefaultChatModel()` ≡ Python 侧 `default_chat_model()`
 * 两侧各存一份清单(跨语言无法 import),靠
 * `scripts/tests/retired-providers-parity.test.mjs` 对账:任一侧增删必须同改另一侧。
 *
 * 解析优先级(靠前者胜,每一档都过退役守卫):
 *   1. 调用方显式传入的 explicit(留空/空串/退役档 ⇒ 顺延,绝不返回退役档)
 *   2. 环境变量 `LITELLM_MODEL`(被改回退役档 ⇒ 同样顺延)
 *   3. 末位兜底链 `LAST_RESORT_MODEL_CHAIN`(上游全不可用时的最后防线)
 *
 * 退役守卫的方向恒为「多要一次定向说明」:命中退役前缀 ⇒ 跳过该候选继续往下找,
 * 而不是「多放一次跳门」—— 任何时候都不得因为守卫而跳过调用方真正要的模型语义。
 */
import { env } from 'node:process'

/**
 * 永久退役的 provider **模型前缀**清单。
 *
 * 2026-10-26:stepfun 订阅失效(余额 -0.09 CNY,chat 恒定 400)且机主明确不再续费。
 * 与 Python 侧 `RETIRED_MODEL_PREFIXES` 逐字同源(两侧必须同改)。
 */
export const RETIRED_PROVIDER_PREFIXES = ['stepfun/'] as const

/**
 * 末位兜底链(上游不可用时的最后防线)。
 *
 * 每一档都在解析时过退役守卫 —— 写死多档是允许的(那正是"上游全挂时还能发出去"的
 * 兜底),但**任何一档都不得是退役 provider**。取用理由:
 * agnes/agnes-2.5-flash 与 agnes/agnes-2.0-flash 是仓内已知可用(ai-service
 * `default_models.json` / `llm_gateway` 的免费档),pollinations/openai-fast 是
 * 无需 key 的免费档(ai-service 主链路 fallback 同样用它)。同 Python 侧
 * `_LAST_RESORT_CHAIN` 同族同序。
 */
export const LAST_RESORT_MODEL_CHAIN = [
  'agnes/agnes-2.5-flash',
  'agnes/agnes-2.0-flash',
  'pollinations/openai-fast',
] as const

/**
 * 模型 id 是否属于已永久退役的 provider。
 *
 * 大小写不敏感;空值/未定义 ⇒ false(不是退役档,只是没给)。
 *
 * @param model 带 provider 前缀的模型 id(如 `agnes/agnes-2.5-flash`)
 */
export function isRetiredModel(model: string | null | undefined): boolean {
  if (!model) return false
  const m = model.trim().toLowerCase()
  return RETIRED_PROVIDER_PREFIXES.some((prefix) => m.startsWith(prefix.toLowerCase()))
}

/**
 * 解析当前应当使用的通用对话模型。
 *
 * @param explicit 调用方自己的显式覆盖(模块专用 env / 会话里指定的模型)。
 *   为空、为空串或为退役档时继续往下找,**不会**把退役档直接返回。
 * @returns 可直接传给 ai-service `/api/llm/complete` 的模型 id(带 provider 前缀);
 *   恒为非退役档。
 */
export function resolveDefaultChatModel(explicit?: string | null): string {
  const candidates: string[] = []

  const explicitModel = explicit?.trim()
  if (explicitModel) candidates.push(explicitModel)

  // env 走 apps/api 既有读法(node:process 的 env,与 ai-feed-service.ts 同源)。
  // 注意:这里读的是**运行期现值**,不是 import 期快照 —— 改 env 立即生效。
  const envModel = env.LITELLM_MODEL?.trim()
  if (envModel) candidates.push(envModel)

  candidates.push(...LAST_RESORT_MODEL_CHAIN)

  for (const candidate of candidates) {
    if (candidate && !isRetiredModel(candidate)) return candidate
  }
  // 理论上不可达(兜底链一定非退役档),留作最后防线。
  return LAST_RESORT_MODEL_CHAIN[0]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
