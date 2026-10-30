// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Skill 市场「互动面」端点封装:评分 / 订阅 / 通知(补 RN 承载用,2026-10-27 后端契约现读)。
 *
 * 与既有 endpoints/skills-market.ts 的分工(不要合并,职责不同):
 *  - skills-market.ts:市场目录列表 + 安装 + 用户级启停 + listing 上下架 + owner 判定
 *  - 本文件:条目互动 —— 评分、订阅、通知
 *
 * 后端契约(均在 apps/api/src/routes/skills.ts,经 routes/index.ts:987 以 prefix `/api` 注册,
 * 全部 `checkAuth` 需登录):
 *  - POST   /api/skills/:name/rate            → 201 success(rating 裸对象)   skills.ts:1072-1116
 *  - GET    /api/skills/:name/ratings         → success({ ratings, total })    skills.ts:1119-1130
 *      ↑ 注意:web 侧 `apps/web/src/lib/skills-market-api.ts:43-45` 把该端点声明成
 *        `Promise<SkillRating[]>`,与后端 `{ ratings, total }` 信封不符(web 详情弹层的
 *        评列表因此恒不渲染)。RN 侧按**后端实际信封**声明,不改后端、不照抄 web 的错声明。
 *  - POST   /api/skills/:name/subscribe       → 201 success({ subscribed, subscriberCount }) skills.ts:1135-1157
 *  - DELETE /api/skills/:name/subscribe       → success({ subscribed, subscriberCount })      skills.ts:1160-1176
 *  - GET    /api/skills/:name/subscription    → success({ subscribed, subscriberCount })      skills.ts:1179-1193
 *  - GET    /api/skills/notifications         → success(SkillNotification[] 裸数组)          skills.ts:1196-1217
 *  - POST   /api/skills/notifications/read    → success({ marked })                          skills.ts:1220-1236
 *
 * 评分写入口径(rateSchema,skills.ts:230-233):score 为 1-5 整数,comment 可选且 ≤2000 字。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

/** 单条评分(GET /api/skills/:name/ratings → data.ratings) */
export interface SkillRating {
  id: string
  userId: string
  /** 后端现写法为 `user-<userId>`(skills.ts:1099),不做二次加工 */
  userName: string
  skillName: string
  /** 1-5 */
  score: number
  comment?: string
  createdAt: string
}

/** 评分列表信封(后端 `{ ratings, total }`,skills.ts:1129) */
export interface SkillRatingsResult {
  ratings: SkillRating[]
  total: number
}

/** 评分请求体(rateSchema,skills.ts:230-233) */
export interface SkillRateBody {
  score: number
  comment?: string
}

/** 订阅状态 + 订阅人数(POST/DELETE /subscribe 与 GET /subscription 同形) */
export interface SkillSubscriptionState {
  subscribed: boolean
  subscriberCount: number
}

/** 订阅通知行(GET /api/skills/notifications → data) */
export interface SkillNotificationItem {
  id: string
  skillName: string
  /** ISO 时间串 */
  timestamp: string
  message: string
  version?: string
}

/** 给某个市场条目打分(重复提交会追加一条评分并重算均分,后端 skills.ts:1105-1113) */
export function rateSkillEntry(
  name: string,
  body: SkillRateBody,
): Promise<ApiResult<SkillRating>> {
  return fetchApi<SkillRating>(`/api/skills/${encodeURIComponent(name)}/rate`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 某条目的评分列表(信封是 `{ ratings, total }`,不是裸数组 —— 见文件头注) */
export function fetchSkillRatings(name: string): Promise<ApiResult<SkillRatingsResult>> {
  return fetchApi<SkillRatingsResult>(`/api/skills/${encodeURIComponent(name)}/ratings`)
}

/** 订阅条目更新(新版本发布时后端按订阅关系投递通知,skills.ts:1031) */
export function subscribeSkillEntry(name: string): Promise<ApiResult<SkillSubscriptionState>> {
  return fetchApi<SkillSubscriptionState>(`/api/skills/${encodeURIComponent(name)}/subscribe`, {
    method: 'POST',
  })
}

/** 取消订阅 */
export function unsubscribeSkillEntry(name: string): Promise<ApiResult<SkillSubscriptionState>> {
  return fetchApi<SkillSubscriptionState>(`/api/skills/${encodeURIComponent(name)}/subscribe`, {
    method: 'DELETE',
  })
}

/** 查询当前用户对某条目的订阅状态与订阅人数 */
export function fetchSkillSubscription(name: string): Promise<ApiResult<SkillSubscriptionState>> {
  return fetchApi<SkillSubscriptionState>(
    `/api/skills/${encodeURIComponent(name)}/subscription`,
  )
}

/** 当前用户的订阅通知列表 */
export function fetchSkillNotifications(): Promise<ApiResult<SkillNotificationItem[]>> {
  return fetchApi<SkillNotificationItem[]>('/api/skills/notifications')
}

/** 全部通知标记为已读(后端语义 = 清空通知 List) */
export function markSkillNotificationsRead(): Promise<ApiResult<{ marked: number }>> {
  return fetchApi<{ marked: number }>('/api/skills/notifications/read', { method: 'POST' })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
