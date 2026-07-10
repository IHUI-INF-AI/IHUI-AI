import {
  pgTable,
  bigserial,
  varchar,
  integer,
  text,
  timestamp,
  bigint,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';

/**
 * 代码生成业务表（gen_table）。
 * 存储导入的表元数据用于代码生成。
 * - tpl_category: crud/tree/sub。
 * - gen_type: 0=zip, 1=自定义路径。
 * 旧架构继承 TimestampMixin（created_at/updated_at）并显式定义 create_time/update_time，完整保留。
 */
export const genTable = pgTable(
  'gen_table',
  {
    tableId: bigserial('table_id', { mode: 'number' }).primaryKey(),
    tableName: varchar('table_name', { length: 200 }).default('').notNull(),
    tableComment: varchar('table_comment', { length: 500 }).default('').notNull(),
    subTableName: varchar('sub_table_name', { length: 200 }),
    subTableFkName: varchar('sub_table_fk_name', { length: 200 }),
    className: varchar('class_name', { length: 200 }).default('').notNull(),
    tplCategory: varchar('tpl_category', { length: 10 }).default('crud').notNull(),
    tplWebType: varchar('tpl_web_type', { length: 10 }).default('tailwind').notNull(),
    packageName: varchar('package_name', { length: 100 }).default('').notNull(),
    moduleName: varchar('module_name', { length: 100 }).default('').notNull(),
    businessName: varchar('business_name', { length: 100 }).default('').notNull(),
    functionName: varchar('function_name', { length: 500 }).default('').notNull(),
    functionAuthor: varchar('function_author', { length: 100 }).default('').notNull(),
    genType: varchar('gen_type', { length: 1 }).default('0').notNull(),
    genPath: varchar('gen_path', { length: 200 }),
    options: text('options'),
    createBy: varchar('create_by', { length: 64 }).default('').notNull(),
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow().notNull(),
    updateBy: varchar('update_by', { length: 64 }).default('').notNull(),
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow().notNull(),
    remark: text('remark'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    createByIdx: index('ix_gen_table_create_by').on(t.createBy),
    updateByIdx: index('ix_gen_table_update_by').on(t.updateBy),
  }),
);

/**
 * 代码生成业务字段表（gen_table_column）。
 * - is_pk/is_increment/is_required/is_insert/is_edit/is_list/is_query: "1"=是, "0"=否。
 * - query_type: EQ/NE/GT/LT/LIKE/BETWEEN。
 * - html_type: input/textarea/select/checkbox/radio/datetime/image/upload/editor。
 */
export const genTableColumn = pgTable(
  'gen_table_column',
  {
    columnId: bigserial('column_id', { mode: 'number' }).primaryKey(),
    tableId: bigint('table_id', { mode: 'number' }),
    columnName: varchar('column_name', { length: 200 }).default('').notNull(),
    columnComment: varchar('column_comment', { length: 1000 }).default('').notNull(),
    columnType: varchar('column_type', { length: 100 }).default('').notNull(),
    javaType: varchar('java_type', { length: 100 }).default('').notNull(),
    javaField: varchar('java_field', { length: 200 }).default('').notNull(),
    isPk: varchar('is_pk', { length: 1 }).default('0').notNull(),
    isIncrement: varchar('is_increment', { length: 1 }).default('0').notNull(),
    isRequired: varchar('is_required', { length: 1 }).default('0').notNull(),
    isInsert: varchar('is_insert', { length: 1 }).default('0').notNull(),
    isEdit: varchar('is_edit', { length: 1 }).default('0').notNull(),
    isList: varchar('is_list', { length: 1 }).default('0').notNull(),
    isQuery: varchar('is_query', { length: 1 }).default('0').notNull(),
    queryType: varchar('query_type', { length: 200 }).default('EQ').notNull(),
    htmlType: varchar('html_type', { length: 200 }).default('input').notNull(),
    dictType: varchar('dict_type', { length: 200 }).default('').notNull(),
    sort: integer('sort').default(0).notNull(),
    createBy: varchar('create_by', { length: 64 }).default('').notNull(),
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow().notNull(),
    updateBy: varchar('update_by', { length: 64 }).default('').notNull(),
    updateTime: timestamp('update_time', { withTimezone: true }).defaultNow().notNull(),
    remark: text('remark'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    createByIdx: index('ix_gen_table_column_create_by').on(t.createBy),
    updateByIdx: index('ix_gen_table_column_update_by').on(t.updateBy),
  }),
);

/**
 * Tbox 系统 Bean/配置表（tbox_bean）。
 * - bean_data: Bean 数据（JSON 文本）。
 * - status: 0=禁用, 1=启用。
 */
export const tboxBean = pgTable(
  'tbox_bean',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    beanType: varchar('bean_type', { length: 50 }),
    beanData: text('bean_data'),
    status: integer('status').default(1).notNull(),
    createTime: timestamp('create_time', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_tbox_bean_status').on(t.status),
  }),
);

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
);

export type GenTable = typeof genTable.$inferSelect;
export type NewGenTable = typeof genTable.$inferInsert;
export type GenTableColumn = typeof genTableColumn.$inferSelect;
export type NewGenTableColumn = typeof genTableColumn.$inferInsert;
export type TboxBean = typeof tboxBean.$inferSelect;
export type NewTboxBean = typeof tboxBean.$inferInsert;
export type AdminUserPost = typeof adminUserPost.$inferSelect;
export type NewAdminUserPost = typeof adminUserPost.$inferInsert;
