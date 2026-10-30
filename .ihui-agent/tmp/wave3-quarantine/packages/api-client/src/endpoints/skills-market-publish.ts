// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Skill 市场「上架投稿 + 更新通知」出口(跨端共享,2026-10-26 立)。
 *
 * 域边界:投稿(我把自己写的 skill 推到货架)与它产生的更新通知(订阅者收到)
 * 是同一条业务腿的两端,故并成一册;目录检索/启停在 `skills-market.ts`,
 * 评分/订阅在 `skills-market-engagement.ts`,三册不重叠。
 *
 * 后端契约取证(信封 `{code,message,data}`,`fetchApi` 已拆包,此处声明 data 本体):
 *  - POST /api/skills/market → 201 data=新建/更新后的市场条目
 *      (apps/api/src/routes/skills.ts:921 注册,1040-1068 组装 entry 并 `success(entry)`;
 *       请求体 publishSchema 同文件 235 起:name ≤64 字、description/tags/author/version/
 *       license/content 必填)
 *      ⚠ `author` 由服务端按调用身份推导(`resolveServerAuthor(request.userId)`),
 *        客户端自报只在无归属场景被采纳;作者名撞上内置保护作者名 ⇒ 403
 *        (skills.ts:1040-1048),调用方须把该 403 当业务失败展示,不得静默。
 *      ⚠ 同 name 再次提交 = 版本更新(保留 installCount/rating,刻意不动 enabled),
 *        不是新建 —— skills.ts:1009-1022。
 *  - GET  /api/skills/notifications → data=SkillNotification[](裸数组)
 *      (apps/api/src/routes/skills.ts:1196-1216;LRANGE 全量,解析失败的行服务端已剔除)
 *  - POST /api/skills/notifications/read → data={ marked: number }
 *      (apps/api/src/routes/skills.ts:1219-1234;先数条数再 DEL,返回的就是被清的条数)
 *
 * 三个端点均 checkAuth,未登录 401 落成 `success:false`。
 */

import { fetchApi } from '../client.js'
import type { SkillMarketItem } from './skills-market.js'

/** 上架/更新投稿请求体(字段与后端 publishSchema 一一对应) */
export interface SkillMarketPublishPayload {
  name: string
  description: string
  tags: string[]
  author: string
  version: string
  license: string
  /** skill 正文(Markdown/JSON),安装时复制进用户私有库;市场条目本身只存元数据 */
  content: string
}

/** 订阅者收到的更新通知 */
export interface SkillMarketNotification {
  id: string
  skillName: string
  message: string
  version?: string
  timestamp: string
}

/** 把 skill 投稿到市场(新 name 即新建,已有 name 即版本更新);返回服务端落库后的条目 */
export function publishSkillMarket(body: SkillMarketPublishPayload) {
  return fetchApi<SkillMarketItem>('/api/skills/market', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** 当前用户的通知列表(裸数组) */
export function fetchSkillMarketNotifications() {
  return fetchApi<SkillMarketNotification[]>('/api/skills/notifications')
}

/** 全部标记已读(服务端 DEL 通知 List),返回被清的条数 */
export function markSkillMarketNotificationsRead() {
  return fetchApi<{ marked: number }>('/api/skills/notifications/read', {
    method: 'POST',
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
