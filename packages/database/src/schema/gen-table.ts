// 注意：该文件中的表当前无 API 引用，保留以备未来代码生成模块需求
import {
  pgTable,
  timestamp,
  bigint,
  primaryKey,
} from 'drizzle-orm/pg-core'

/**
 * 代码生成业务表（gen_table）。
 * 存储导入的表元数据用于代码生成。
 * - tpl_category: crud/tree/sub。
 * - gen_type: 0=zip, 1=自定义路径。
 * 旧架构继承 TimestampMixin（created_at/updated_at）并显式定义 create_time/update_time，完整保留。
 */

/**
 * 代码生成业务字段表（gen_table_column）。
 * - is_pk/is_increment/is_required/is_insert/is_edit/is_list/is_query: "1"=是, "0"=否。
 * - query_type: EQ/NE/GT/LT/LIKE/BETWEEN。
 * - html_type: input/textarea/select/checkbox/radio/datetime/image/upload/editor。
 */

/**
 * Tbox 系统 Bean/配置表（tbox_bean）。
 * - bean_data: Bean 数据（JSON 文本）。
 * - status: 0=禁用, 1=启用。
 */

/**
 * 管理员-岗位关联表（admin_user_post）。
 * 复合主键 (user_id, post_id)；旧架构继承 TimestampMixin，保留 created_at/updated_at。
 */
export const adminUserPost = pgTable(
  'admin_user_post',
  {
    userId: bigint('user_id', { mode: 'number' }).notNull(),
    postId: bigint('post_id', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.postId] }),
  }),
)

export type AdminUserPost = typeof adminUserPost.$inferSelect
export type NewAdminUserPost = typeof adminUserPost.$inferInsert

