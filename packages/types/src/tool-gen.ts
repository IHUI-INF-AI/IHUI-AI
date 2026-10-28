// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Admin 工具代码生成器契约单一真相源(2026-10-24 立)。
 *
 * 立项凭据:此前 `GenType / GenField / GenInput / GenResult` 在
 * `packages/api-client/src/endpoints/admin-tool-gen.ts` 与
 * `apps/api/src/services/code-generator.ts` 各写一份,而 server 还独占一条运行期数组
 * `GEN_TYPES`(client 无对应物)⇒ 加一个 type 要改 server 三处、client 两处,
 * **没有任何一道门会响**(守门 219 的端内射程不含 packages/api-client,更是双盲)。
 * 本文件把四枚类型 + 那条运行期数组收成一份;两侧一律 `import`/`export … from '@ihui/types'` 消费。
 *
 * 形态约束(不能改的兼容面):
 *  - `GEN_TYPES` 必须是**可变数组**(`GenType[]`)而不是 readonly 元组 —— 消费侧
 *    `apps/api/src/routes/admin/tool/gen-post.ts` 写的是 `z.enum(GEN_TYPES as [string, ...string[]])`,
 *    readonly 形态会把那两枚 routes 文件顶红,而它们不在本切片的允许清单内。
 *  - 运行期数组与 union 必须同源派生:字面量在本文件只出现一次(`GEN_TYPES_LIST`),
 *    `GenType` 由它派生,`GEN_TYPES` 由它复制;加一个 type 只改这一行。
 *
 * 只经主入口导出(不新增子路径,同 tool-contract / exam / image-gen 的口径)。
 */

/** 闭集字面量的唯一出处。新增档位只改这一行。 */
const GEN_TYPES_LIST = ['list', 'page', 'detail', 'dialog'] as const

/** 由运行期数组派生,禁止另写字面量联合。 */
export type GenType = (typeof GEN_TYPES_LIST)[number]

/** 生成器支持的类型清单(运行期,GET 元信息与 POST 入参校验共用)。 */
export const GEN_TYPES: GenType[] = [...GEN_TYPES_LIST]

export interface GenField {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date'
  label?: string
  required?: boolean
}

export interface GenInput {
  type: GenType
  name: string
  fields: GenField[]
  options?: {
    withSearch?: boolean
    withPagination?: boolean
    withActions?: boolean
  }
}

export interface GenResult {
  type: GenType
  moduleName: string
  files: Array<{ path: string; content: string }>
  /** 合并所有文件,方便前端单预览框展示 */
  combined: string
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
