// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Skill 市场「条目互动」出口:评分 / 评分列表 / 订阅(跨端共享,2026-10-26 立)。
 *
 * 域边界:同目录 `skills-market.ts` 只管「目录检索 + 启停 + listing 归属」,
 * 本件只管「人对条目做的事」(打分、订阅)。两侧不重叠、不互相 re-export,
 * 合并导出由 `packages/api-client/src/index.ts` 负责(AGENTS §0.6 单一真相源:
 * 同一判据/同一封装全仓只许一份,不得在第二个文件里重写同一路径)。
 *
 * 后端契约取证(全部经 apps/api Fastify 代理,信封一律 `{code,message,data}`,
 * `fetchApi` 已拆包为 `ApiResult<T>`,故此处声明的是 **data 本体**形态):
 *  - POST /api/skills/:name/rate        → 201 data=单条 SkillRating
 *      (apps/api/src/routes/skills.ts:1072-1115;请求体 rateSchema 同文件 230-233:
 *       score 整数 1-5、comment 可选 ≤2000 字;写成功后服务端顺带把市场条目的
 *       rating(平均)与 ratingCount(条数)重算落回目录,故调用方评分完必须刷新列表)
 *  - GET  /api/skills/:name/ratings     → data={ ratings, total }
 *      (apps/api/src/routes/skills.ts:1119-1130)
 *      ⚠ 不是裸数组:web 侧 `apps/web/src/lib/skills-market-api.ts:43` 把它按
 *        `SkillRating[]` 声明并直接 `.map()`,即页面里那段"最近评分"恒不渲染。
 *        本出口按**后端实际写入的契约**声明(AGENTS §0.5「没判过不许写成判过」的反面
 *        —— 读了后端就照后端写),不得为了跟 web 一样而把 `{ratings,total}` 折成数组。
 *  - POST   /api/skills/:name/subscribe    → 201 data={ subscribed:true, subscriberCount }
 *      (apps/api/src/routes/skills.ts:1135-1157;条目不存在 404)
 *  - DELETE /api/skills/:name/subscribe    → data={ subscribed:false, subscriberCount }
 *      (apps/api/src/routes/skills.ts:1160-1176)
 *  - GET  /api/skills/:name/subscription → data={ subscribed, subscriberCount }
 *      (apps/api/src/routes/skills.ts:1179-1193;subscribed 由服务端按 request.userId
 *       判 Redis Set 成员,不接受客户端自报 —— AGENTS §5「认证不等于授权」)
 *
 * 五个端点都要求登录(checkAuth),未登录 401 由 `fetchApi` 落成 `success:false`。
 */

import { fetchApi } from '../client.js'

/** 单条评分(与 `@ihui/shared/skills/market` 的 `SkillRating` 同形;本包按零依赖边界就地声明) */
export interface SkillMarketRating {
  id: string
  /** `users.id` 是 uuid 原文,不得强转数字(见 shared 契约注释:NaN === NaN 为假) */
  userId: string
  userName: string
  skillName: string
  score: number
  comment?: string
  createdAt: string
}

/** 评分列表请求体(后端 rateSchema 的可选集) */
export interface SkillMarketRatePayload {
  /** 1-5 整数,越界后端 400 */
  score: number
  /** ≤2000 字;空/空白按未填处理(与 web 同口径:提交前 trim) */
  comment?: string
}

/** GET /skills/:name/ratings 的 data 本体(**对象**,不是裸数组) */
export interface SkillMarketRatingsResult {
  ratings: SkillMarketRating[]
  total: number
}

/** 订阅状态 + 订阅人数 */
export interface SkillMarketSubscriptionState {
  subscribed: boolean
  subscriberCount: number
}

function skillPath(name: string, suffix: string): string {
  return `/api/skills/${encodeURIComponent(name)}${suffix}`
}

/** 对某个市场条目评分(1-5,评论可选)。成功后市场平均分/评分数已在服务端更新 */
export function rateSkillMarket(name: string, body: SkillMarketRatePayload) {
  return fetchApi<SkillMarketRating>(skillPath(name, '/rate'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 某个市场条目的评分列表(含 total) */
export function fetchSkillMarketRatings(name: string) {
  return fetchApi<SkillMarketRatingsResult>(skillPath(name, '/ratings'))
}

/** 订阅某个市场条目(更新时服务端给订阅者投递通知) */
export function subscribeSkillMarket(name: string) {
  return fetchApi<SkillMarketSubscriptionState>(skillPath(name, '/subscribe'), {
    method: 'POST',
  })
}

/** 取消订阅 */
export function unsubscribeSkillMarket(name: string) {
  return fetchApi<SkillMarketSubscriptionState>(skillPath(name, '/subscribe'), {
    method: 'DELETE',
  })
}

/** 查询当前用户对该条目的订阅态与订阅人数 */
export function fetchSkillMarketSubscription(name: string) {
  return fetchApi<SkillMarketSubscriptionState>(skillPath(name, '/subscription'))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
