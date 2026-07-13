import { pgTable, uuid, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core'

/**
 * MCP 服务器表 - 记录可调用的 MCP 服务端点。
 */
export const mcpServers = pgTable('mcp_servers', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  endpoint: varchar('endpoint', { length: 500 }).notNull(),
  status: integer('status').default(1).notNull(), // 1=启用 0=禁用
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type McpServer = typeof mcpServers.$inferSelect
export type NewMcpServer = typeof mcpServers.$inferInsert
