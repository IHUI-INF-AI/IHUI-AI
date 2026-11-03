// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 世界跨端契约类型(2026-10-19 立,票「web↔移动端同一契约两份声明」的 6 字段那一族)。
 *
 * 取代端内两份逐字同形的分类声明:
 *   - apps/mobile-rn/src/screens/AiWorldScreen.tsx 的 `interface AiWorldCategory`
 *   - apps/web/app/(main)/ai-world/types.ts 的 `export interface AiCategory`
 * 改前把两份声明体做 sha256 归一化比较(剥类型名与前后空白、逐行折叠缩进),同值
 *   6931ea11e03bf1747f6150044990c97722b5bdca01b2e5521dba2a2936c393a2,
 * 确属同一件东西,故收成单源;两端只改 import,运行时一字未动。
 *
 * 命名取规范名 `AiWorldCategory`(域限定完整,与移动端旧名同名;不用 web 端 `AiCategory`
 * 泛名——那个名字在 admin sites 那份异形本地声明里也存在,并到共享层会误导读者)。
 * 与 `@ihui/database` schema 的 `AiWorldCategory`(Drizzle `$inferSelect` 行,额外含
 * status/createdAt/updatedAt 等落库列)同名而**不同形** —— 前端 apps/web 与 apps/mobile-rn
 * 从不 import `@ihui/database`,后端 apps/api 从不 import `@ihui/types` 的这个符号,
 * 两条消费面互不交叠,不构成消费歧义;若将来某处需要同文件同读两包,再择一改名。
 *
 * 明确**不并入**的相邻同族(票面已裁决,勿再动):
 *   - apps/web/app/(main)/admin/ai-world/sites/page.tsx 的 `AiCategory`(icon 非空 string,
 *     取源端点不同;下游 isIconKey(cat.icon) 会因放宽而 TS2345)。
 *   - 错题本那一族(WrongQuestionListItem 已就位,但两份端侧文件是 ui-routes 派生输入,
 *     卡在派生钉,不属本票)。
 * `apps/web/app/(main)/ai-world/[id]/PageClient.tsx` 的 3 字段本地 `AiWorldCategory` 与
 * 本契约是子集关系(该文件只读 .name/.icon),已随本票把端侧本地声明改为 import 本合同;
 * 端侧运行时未变。
 */

/** AI 世界分类条目(GET /api/ai-world 内嵌 categories 与 GET /api/ai-world/categories 同一形状)。 */
export interface AiWorldCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  sort: number
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
