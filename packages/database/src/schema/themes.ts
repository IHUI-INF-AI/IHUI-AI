import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'

export const themes = pgTable(
  'themes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    isDark: boolean('is_dark').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    isCurrent: boolean('is_current').default(false).notNull(),
    preset: varchar('preset', { length: 50 }),
    settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    currentIdx: index('themes_current_idx').on(t.isCurrent),
    activeIdx: index('themes_active_idx').on(t.isActive),
  }),
)

export const themeColors = pgTable(
  'theme_colors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    themeId: uuid('theme_id').references(() => themes.id, { onDelete: 'cascade' }).notNull(),
    key: varchar('key', { length: 100 }).notNull(),
    value: varchar('value', { length: 100 }).notNull(),
    label: varchar('label', { length: 100 }),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    themeIdx: index('theme_colors_theme_idx').on(t.themeId),
  }),
)

export const themeFonts = pgTable(
  'theme_fonts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    themeId: uuid('theme_id').references(() => themes.id, { onDelete: 'cascade' }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    family: varchar('family', { length: 200 }).notNull(),
    url: varchar('url', { length: 500 }),
    isDefault: boolean('is_default').default(false).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    themeIdx: index('theme_fonts_theme_idx').on(t.themeId),
  }),
)

export const themeAssets = pgTable(
  'theme_assets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    themeId: uuid('theme_id').references(() => themes.id, { onDelete: 'cascade' }).notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    url: varchar('url', { length: 500 }).notNull(),
    label: varchar('label', { length: 100 }),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    themeIdx: index('theme_assets_theme_idx').on(t.themeId),
  }),
)

export const themePresets = pgTable(
  'theme_presets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    preset: varchar('preset', { length: 50 }).notNull(),
    description: text('description'),
    config: jsonb('config').$type<Record<string, unknown>>().default({}).notNull(),
    isBuiltIn: boolean('is_built_in').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    presetIdx: index('theme_presets_preset_idx').on(t.preset),
  }),
)

export type Theme = typeof themes.$inferSelect
export type NewTheme = typeof themes.$inferInsert
export type ThemeColor = typeof themeColors.$inferSelect
export type NewThemeColor = typeof themeColors.$inferInsert
export type ThemeFont = typeof themeFonts.$inferSelect
export type NewThemeFont = typeof themeFonts.$inferInsert
export type ThemeAsset = typeof themeAssets.$inferSelect
export type NewThemeAsset = typeof themeAssets.$inferInsert
export type ThemePreset = typeof themePresets.$inferSelect
export type NewThemePreset = typeof themePresets.$inferInsert
