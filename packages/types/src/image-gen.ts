// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * POST /api/image-gen/generate 响应 `data` 契约(web ↔ RN 同一份形状,2026-10-22 收成单源)。
 * 端点契约见 apps/api/src/routes/other/image-gen-routes.ts:
 * 带 imageUrl 的请求返回 { item, imageUrl };生成链路未接通时回 503 CAPABILITY_UNAVAILABLE,
 * 绝不伪造 imageUrl 冒充成功(503 是 2026-10-18 机主拍板的设计终态,不是缺陷)。
 */

/**
 * 201 响应 `data.item` —— 后端 `db.insert(aiGcContent)....returning()` 落库的那一条
 * `ai_gc_content` 行(权威源像 = apps/api/src/routes/other/image-gen-routes.ts 的 201 分支,
 * 列集 = packages/database/src/schema/ai-gc.ts 的 `aiGcContent` + `AiGcContent`)。
 *
 * 逐列按 **JSON 上线形态** 声明:timestamp 列经 Fastify 序列化后是 ISO 字符串而不是 `Date`,
 * 端上 `JSON.parse` 拿到的就是字符串;无 `.notNull()` 的列一律 `| null`(default 不等于非空)。
 */
export interface ImageGenResultItem {
  id: string
  userUuid: string
  agentId: string | null
  gcType: string | null
  content: string | null
  status: number | null
  createdAt: string
  updatedAt: string
}

export interface ImageGenResult {
  imageUrl: string
  /**
   * 201 必然随行的生成记录(断言见 apps/api/tests/image-gen-generate-contract.test.ts 的
   * `expect(body.data.item).toEqual(item)`)。此前本类型**少声明这一枚**,两端各自用泛型 cast
   * 把它抹平 ⇒ tsc 全绿而契约说谎(门 219 头注那一型:漂移没有编译期症状)。
   */
  item: ImageGenResultItem
  /**
   * **死字段:当前无后端产出通路** —— 现读 `git grep revisedPrompt HEAD -- apps/api` = 0 命中,
   * 201 分支只回 `{ item, imageUrl }`,没有任何出图链路会生成改写后的提示词。
   *
   * 处置(2026-10-23 定档):声明保留(出图通路接通日两端不必再改一遍形状),但两端的渲染腿
   * 已撤 —— web `app/(main)/image-gen/page.tsx` 与 RN `src/screens/ImageGenCreateScreen.tsx`
   * 都不得据它出图/出字(留着不渲染 = 继续撒谎)。真正接通时必须同批:后端补产出 + 两端把
   * 渲染腿改回 + 本注记摘除。
   */
  revisedPrompt?: string
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
