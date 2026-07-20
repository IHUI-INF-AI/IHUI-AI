/**
 * AdminContent 10 type 配置(desktop 端业务层 100% 覆盖)。
 *
 * 背景:subagent A 实装的 `/api/admin/content/:type/:id` 端点支持 10 种 type
 * (announcement / help-article / help-category / doc / article / advertise /
 *  about-us / contact / recommendation / mobile-adapter)。本文件:
 *  1. 列出全部 10 type
 *  2. 定义每种 type 的字段 schema(对话框按 schema 渲染)
 *  3. 提供 wrapper 函数复用 `lib/api/admin-content` 已有的 list/create/update/delete
 *     (该文件被 §12 列入只读,通过 `as` 拓宽类型接入 10 type,函数实现零修改)。
 *
 * 业务侧 `AdminContent.tsx` 直接消费本文件,从 4 Tab 扩到 10 Tab。
 */
import {
  listAdminContent as listAdminContentBase,
  createAdminContent as createAdminContentBase,
  updateAdminContent as updateAdminContentBase,
  deleteAdminContent as deleteAdminContentBase,
  type ContentRow,
  type ContentListParams,
} from './api/admin-content'

/** 10 种内容 type(与后端端点对齐) */
export const ALL_CONTENT_TYPES = [
  'announcement',
  'help-article',
  'help-category',
  'doc',
  'article',
  'advertise',
  'about-us',
  'contact',
  'recommendation',
  'mobile-adapter',
] as const

export type ContentType = (typeof ALL_CONTENT_TYPES)[number]

/** 向后兼容:保留旧常量名(4 个 type 的子集) */
export const CONTENT_TYPES = ALL_CONTENT_TYPES

/** 字段类型 */
export type FieldKind = 'text' | 'textarea' | 'number' | 'bool' | 'url' | 'datetime'

export type FormValue = string | number | boolean

export type FormValues = Record<string, FormValue | undefined>

export interface FieldDef {
  /** 字段名(直接对应 API body 字段名) */
  name: string
  /** i18n label key(全名,如 admin.content.formTitle) */
  labelKey: string
  kind: FieldKind
  required?: boolean
  defaultValue?: FormValue
  placeholderKey?: string
}

export interface TypeConfig {
  type: ContentType
  /** tab i18n key 段, e.g. 'tabHelpCategory' → admin.content.tabHelpCategory */
  tabKey: string
  /** dialog type select i18n key 段, e.g. 'typeHelpCategory' → admin.content.typeHelpCategory */
  typeKey: string
  /** 字段 schema(按数组顺序渲染) */
  fields: readonly FieldDef[]
}

const L = (s: string): string => `admin.content.form${s}`

export const TYPE_CONFIGS: Record<ContentType, TypeConfig> = {
  announcement: {
    type: 'announcement',
    tabKey: 'tabAnnouncement',
    typeKey: 'typeAnnouncement',
    fields: [
      { name: 'title', labelKey: L('Title'), kind: 'text', required: true },
      { name: 'content', labelKey: L('Content'), kind: 'textarea', required: true },
      { name: 'isPublished', labelKey: L('Status'), kind: 'bool', defaultValue: false },
      { name: 'isPinned', labelKey: L('IsPinned'), kind: 'bool', defaultValue: false },
      { name: 'sortOrder', labelKey: L('SortOrder'), kind: 'number', defaultValue: 0 },
    ],
  },
  'help-article': {
    type: 'help-article',
    tabKey: 'tabHelpArticle',
    typeKey: 'typeHelpArticle',
    fields: [
      { name: 'title', labelKey: L('Title'), kind: 'text', required: true },
      { name: 'content', labelKey: L('Content'), kind: 'textarea', required: true },
      { name: 'category', labelKey: L('Category'), kind: 'text' },
      { name: 'slug', labelKey: L('Slug'), kind: 'text' },
      { name: 'isPublished', labelKey: L('Status'), kind: 'bool', defaultValue: false },
      { name: 'sortOrder', labelKey: L('SortOrder'), kind: 'number', defaultValue: 0 },
    ],
  },
  'help-category': {
    type: 'help-category',
    tabKey: 'tabHelpCategory',
    typeKey: 'typeHelpCategory',
    fields: [
      { name: 'name', labelKey: L('Name'), kind: 'text', required: true },
      { name: 'slug', labelKey: L('Slug'), kind: 'text' },
      { name: 'description', labelKey: L('Description'), kind: 'textarea' },
      { name: 'icon', labelKey: L('Icon'), kind: 'text' },
      { name: 'sortOrder', labelKey: L('SortOrder'), kind: 'number', defaultValue: 0 },
    ],
  },
  doc: {
    type: 'doc',
    tabKey: 'tabDoc',
    typeKey: 'typeDoc',
    fields: [
      { name: 'title', labelKey: L('Title'), kind: 'text', required: true },
      { name: 'content', labelKey: L('Content'), kind: 'textarea', required: true },
      { name: 'category', labelKey: L('Category'), kind: 'text' },
      { name: 'status', labelKey: L('Status'), kind: 'number' },
      { name: 'sortOrder', labelKey: L('SortOrder'), kind: 'number', defaultValue: 0 },
    ],
  },
  article: {
    type: 'article',
    tabKey: 'tabArticle',
    typeKey: 'typeArticle',
    fields: [
      { name: 'title', labelKey: L('Title'), kind: 'text', required: true },
      { name: 'summary', labelKey: L('Summary'), kind: 'textarea' },
      { name: 'content', labelKey: L('Content'), kind: 'textarea', required: true },
      { name: 'coverImage', labelKey: L('CoverImage'), kind: 'url' },
      { name: 'isPublished', labelKey: L('Status'), kind: 'bool', defaultValue: false },
      { name: 'isPinned', labelKey: L('IsPinned'), kind: 'bool', defaultValue: false },
      { name: 'sort', labelKey: L('SortOrder'), kind: 'number', defaultValue: 0 },
    ],
  },
  advertise: {
    type: 'advertise',
    tabKey: 'tabAdvertise',
    typeKey: 'typeAdvertise',
    fields: [
      { name: 'title', labelKey: L('Title'), kind: 'text' },
      { name: 'position', labelKey: L('Position'), kind: 'text', required: true },
      { name: 'imageUrl', labelKey: L('ImageUrl'), kind: 'url', required: true },
      { name: 'linkUrl', labelKey: L('LinkUrl'), kind: 'url' },
      { name: 'description', labelKey: L('Description'), kind: 'textarea' },
      { name: 'sort', labelKey: L('SortOrder'), kind: 'number', defaultValue: 0 },
      { name: 'status', labelKey: L('Status'), kind: 'number' },
    ],
  },
  'about-us': {
    type: 'about-us',
    tabKey: 'tabAboutUs',
    typeKey: 'typeAboutUs',
    fields: [
      { name: 'network', labelKey: L('Network'), kind: 'text' },
      { name: 'phone', labelKey: L('Phone'), kind: 'text' },
      { name: 'socialMedia', labelKey: L('SocialMedia'), kind: 'textarea' },
      { name: 'experience', labelKey: L('Experience'), kind: 'textarea' },
      { name: 'description', labelKey: L('Description'), kind: 'textarea' },
    ],
  },
  contact: {
    type: 'contact',
    tabKey: 'tabContact',
    typeKey: 'typeContact',
    fields: [
      { name: 'introduction', labelKey: L('Introduction'), kind: 'textarea', required: true },
      { name: 'corporateCulture', labelKey: L('CorporateCulture'), kind: 'textarea' },
    ],
  },
  recommendation: {
    type: 'recommendation',
    tabKey: 'tabRecommendation',
    typeKey: 'typeRecommendation',
    fields: [
      { name: 'key', labelKey: L('Key'), kind: 'text', required: true },
      { name: 'value', labelKey: L('Value'), kind: 'textarea' },
      { name: 'type', labelKey: L('ConfigType'), kind: 'text' },
      { name: 'description', labelKey: L('Description'), kind: 'textarea' },
      { name: 'isPublic', labelKey: L('IsPublic'), kind: 'bool', defaultValue: false },
    ],
  },
  'mobile-adapter': {
    type: 'mobile-adapter',
    tabKey: 'tabMobileAdapter',
    typeKey: 'typeMobileAdapter',
    fields: [
      { name: 'key', labelKey: L('Key'), kind: 'text', required: true },
      { name: 'value', labelKey: L('Value'), kind: 'textarea' },
      { name: 'type', labelKey: L('ConfigType'), kind: 'text' },
      { name: 'description', labelKey: L('Description'), kind: 'textarea' },
      { name: 'isPublic', labelKey: L('IsPublic'), kind: 'bool', defaultValue: false },
    ],
  },
}

export function getTypeConfig(type: ContentType): TypeConfig {
  return TYPE_CONFIGS[type]
}

/** 将 form values 规整成 API body(string 字段 trim,其他原样) */
export function formValuesToBody(values: FormValues): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) continue
    if (typeof v === 'string') body[k] = v.trim()
    else body[k] = v
  }
  return body
}

// ============ API wrapper(拓宽类型,转发到 lib/api/admin-content) ============

type ListResult = Awaited<ReturnType<typeof listAdminContentBase>>
type ItemResult = Awaited<ReturnType<typeof createAdminContentBase>>
type DeleteResult = Awaited<ReturnType<typeof deleteAdminContentBase>>

export async function listAdminContent(
  type: ContentType,
  params: ContentListParams,
): Promise<ListResult> {
  return listAdminContentBase(type as never, params) as Promise<ListResult>
}

export async function createAdminContent(
  type: ContentType,
  body: Record<string, unknown>,
): Promise<ItemResult> {
  return createAdminContentBase(type as never, body) as Promise<ItemResult>
}

export async function updateAdminContent(
  type: ContentType,
  id: string,
  body: Record<string, unknown>,
): Promise<ItemResult> {
  return updateAdminContentBase(type as never, id, body) as Promise<ItemResult>
}

export async function deleteAdminContent(type: ContentType, id: string): Promise<DeleteResult> {
  return deleteAdminContentBase(type as never, id) as Promise<DeleteResult>
}

export type { ContentRow }
