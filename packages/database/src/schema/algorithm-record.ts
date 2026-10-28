// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/**
 * 国家网信办「算法/模型备案」公开清单表(algorithm_record)。
 *
 * 数据来源:国家互联网信息办公室分批发布的官方清单 docx(免登录下载):
 * - 互联网信息服务算法备案清单(算法推荐类,含算法类别列)
 * - 境内深度合成服务算法备案清单(深度合成/生成合成类,含角色列,最贴近"大模型备案")
 *
 * 两套清单统一为 8 列,落库如下:
 * - kind: 来源清单类型,algorithm_recommend(算法推荐) / deep_synthesis(深度合成)
 * - algName: 算法名称(下标1)
 * - category: 算法类别(算法推荐) 或 角色(深度合成),如 个性化推送类/服务提供者/生成合成类
 * - provider: 主体名称(备案服务提供者,企业全称)(下标3)
 * - product: 应用产品(下标4)
 * - purpose: 主要用途(下标5)
 * - recordNo: 备案编号(下标6,形如"网信算备…号"),作为全局去重主键
 * - batch: 所属批次(如 2026-07)
 * - sourceUrl: 来源公告页 URL
 * - rowNo: 清单内序号(原始序);可能为空,用行号兜底
 */
export const algorithmRecord = pgTable(
  'algorithm_record',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    kind: varchar('kind', { length: 32 }).notNull(),
    algName: varchar('alg_name', { length: 512 }).notNull(),
    category: varchar('category', { length: 128 }),
    provider: varchar('provider', { length: 512 }).notNull(),
    product: text('product'),
    purpose: text('purpose'),
    recordNo: varchar('record_no', { length: 128 }).notNull(),
    batch: varchar('batch', { length: 32 }),
    sourceUrl: varchar('source_url', { length: 512 }),
    rowNo: integer('row_no'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    recordNoUniq: uniqueIndex('uq_algorithm_record_record_no').on(t.recordNo),
    algNameIdx: index('ix_algorithm_record_alg_name').on(t.algName),
    providerIdx: index('ix_algorithm_record_provider').on(t.provider),
    kindIdx: index('ix_algorithm_record_kind').on(t.kind),
    categoryIdx: index('ix_algorithm_record_category').on(t.category),
  }),
)

export type AlgorithmRecord = typeof algorithmRecord.$inferSelect
export type NewAlgorithmRecord = typeof algorithmRecord.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
