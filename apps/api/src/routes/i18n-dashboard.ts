import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { authenticate, requireActiveUser } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

const ADMIN_ROLE_ID = 1

const MESSAGES_DIR = process.env.I18N_MESSAGES_DIR ?? join(process.cwd(), '..', 'web', 'messages')

const LOCALE_NAMES: Record<string, string> = {
  'zh-CN': '简体中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  'zh-TW': '繁體中文',
}

const BASE_LOCALE = 'zh-CN'
const SUPPORTED_LOCALES = Object.keys(LOCALE_NAMES)

type Dict = Record<string, unknown>

const cache = new Map<string, { dict: Dict; mtime: number }>()

async function loadDict(locale: string): Promise<Dict> {
  const filePath = join(MESSAGES_DIR, `${locale}.json`)
  const buf = await readFile(filePath)
  const dict = JSON.parse(buf.toString('utf8')) as Dict
  return dict
}

async function loadDictCached(locale: string): Promise<Dict> {
  const filePath = join(MESSAGES_DIR, `${locale}.json`)
  const stats = await stat(filePath)
  const cached = cache.get(locale)
  if (cached && cached.mtime === stats.mtimeMs) return cached.dict
  const dict = await loadDict(locale)
  cache.set(locale, { dict, mtime: stats.mtimeMs })
  return dict
}

function flattenKeys(obj: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}.${k}` : k
      if (v && typeof v === 'object') {
        for (const [sub, val] of flattenKeys(v, key)) out.set(sub, String(val))
      } else {
        out.set(key, String(v ?? ''))
      }
    }
  }
  return out
}

function getNamespace(key: string): string {
  const idx = key.indexOf('.')
  return idx > 0 ? key.slice(0, idx) : key
}

interface CompareEntry {
  key: string
  namespace: string
  left?: string
  right?: string
}

interface MissingKey {
  key: string
  namespace: string
  locale: string
}

interface LangProgress {
  locale: string
  name: string
  total: number
  translated: number
  missing: number
  completion: number
}

interface RecentUpdate {
  id: string
  locale: string
  key: string
  namespace: string
  updatedAt: string
  author?: string
}

interface I18nOverview {
  languages: LangProgress[]
  totalMissing: number
  recentUpdates: RecentUpdate[]
}

export const i18nDashboardRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || 'Authentication required'
      return reply.status(statusCode).send(error(statusCode, message))
    }
    try {
      await requireActiveUser(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || '账号已注销'
      return reply.status(statusCode).send(error(statusCode, message))
    }
    const roleId = request.jwtPayload?.roleId ?? 0
    if (roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '需要管理员权限'))
    }
  })

  server.get('/i18n-dashboard', async (_request, reply) => {
    try {
      const baseDict = await loadDictCached(BASE_LOCALE)
      const baseKeys = flattenKeys(baseDict)
      const totalBase = baseKeys.size

      const languages: LangProgress[] = []
      let totalMissing = 0
      const allMissing: MissingKey[] = []

      for (const locale of SUPPORTED_LOCALES) {
        const dict = await loadDictCached(locale)
        const keys = flattenKeys(dict)
        const missing: MissingKey[] = []
        if (locale !== BASE_LOCALE) {
          for (const [key] of baseKeys) {
            if (!keys.has(key) || keys.get(key) === '') {
              missing.push({ key, namespace: getNamespace(key), locale })
              totalMissing++
              allMissing.push({ key, namespace: getNamespace(key), locale })
            }
          }
        }
        const translatedCount = locale === BASE_LOCALE ? totalBase : totalBase - missing.length
        const completion = totalBase === 0 ? 100 : Math.round((translatedCount / totalBase) * 100)
        languages.push({
          locale,
          name: LOCALE_NAMES[locale] ?? locale,
          total: totalBase,
          translated: translatedCount,
          missing: missing.length,
          completion,
        })
      }

      const recentUpdates: RecentUpdate[] = []
      let idx = 0
      for (const m of allMissing.slice(0, 10)) {
        recentUpdates.push({
          id: String(++idx),
          locale: m.locale,
          key: m.key,
          namespace: m.namespace,
          updatedAt: new Date().toISOString(),
        })
      }

      return reply.send(success<I18nOverview>({ languages, totalMissing, recentUpdates }))
    } catch (e) {
      const message = (e as Error).message || '加载 i18n 数据失败'
      return reply.status(500).send(error(500, message))
    }
  })

  server.get<{
    Querystring: { left?: string; right?: string }
  }>('/i18n-dashboard/compare', async (request, reply) => {
    const left = request.query.left ?? BASE_LOCALE
    const right = request.query.right ?? 'en'
    if (!SUPPORTED_LOCALES.includes(left) || !SUPPORTED_LOCALES.includes(right)) {
      return reply.status(400).send(error(400, '不支持的语言代码'))
    }
    try {
      const [leftDict, rightDict] = await Promise.all([loadDictCached(left), loadDictCached(right)])
      const leftKeys = flattenKeys(leftDict)
      const rightKeys = flattenKeys(rightDict)
      const allKeys = new Set<string>([...leftKeys.keys(), ...rightKeys.keys()])
      const entries: CompareEntry[] = []
      for (const key of allKeys) {
        entries.push({
          key,
          namespace: getNamespace(key),
          left: leftKeys.get(key),
          right: rightKeys.get(key),
        })
      }
      entries.sort((a, b) => a.key.localeCompare(b.key))
      return reply.send(success({ entries, leftLocale: left, rightLocale: right }))
    } catch (e) {
      const message = (e as Error).message || '加载对比数据失败'
      return reply.status(500).send(error(500, message))
    }
  })

  server.get<{
    Querystring: { locale?: string; pageSize?: number }
  }>('/i18n-dashboard/missing', async (request, reply) => {
    const locale = request.query.locale ?? 'all'
    const pageSize = Math.min(Math.max(request.query.pageSize ?? 200, 1), 1000)
    if (locale !== 'all' && !SUPPORTED_LOCALES.includes(locale)) {
      return reply.status(400).send(error(400, '不支持的语言代码'))
    }
    try {
      const baseDict = await loadDictCached(BASE_LOCALE)
      const baseKeys = flattenKeys(baseDict)
      const targetLocales =
        locale === 'all' ? SUPPORTED_LOCALES.filter((l) => l !== BASE_LOCALE) : [locale]
      const list: MissingKey[] = []
      for (const loc of targetLocales) {
        const dict = await loadDictCached(loc)
        const keys = flattenKeys(dict)
        for (const [key] of baseKeys) {
          if (!keys.has(key) || keys.get(key) === '') {
            list.push({ key, namespace: getNamespace(key), locale: loc })
          }
        }
      }
      list.sort((a, b) => a.namespace.localeCompare(b.namespace) || a.key.localeCompare(b.key))
      const paged = list.slice(0, pageSize)
      return reply.send(success({ list: paged, total: list.length }))
    } catch (e) {
      const message = (e as Error).message || '加载缺失列表失败'
      return reply.status(500).send(error(500, message))
    }
  })
}
