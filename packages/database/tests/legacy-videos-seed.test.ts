// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-921 挂载链回归:seed/legacy-videos.ts 的导入映射与落库行为(离线测试,不连真库)。
 *
 * 立因:870 枚历史视频已进桶,但现网 lessons total=0、lesson_chapter_sections.video_url 零行
 * ——挂载脚本(步骤 14)存在却从未被执行环触发。本测试把"脚本本身是对的"钉成可静态证明的一格:
 *   1. 数据完整性:22 门课 / 867 小节 / 3 枚半成品排除(867+3=870 与票面枚数对齐);
 *      rel 全部形如 <课程slug>/<课时>.mp4,无 .fNNNN 单流半成品混入播放行;
 *   2. URL 映射:base + /videos/ + encodeURI(rel),全部 ≤ varchar(512);env 覆写与尾斜杠归一;
 *   3. dry-run 零写:apply=false 时一句写都不发,只出普查计划数;
 *   4. 落库草稿:apply=true 建 lessons+chapters+sections,isPublished=false(先不上架),
 *      小节 videoUrl/duration/isFree 齐,课程 lessonCount 与实建小节数一致;
 *   5. 幂等:同库重跑 added=0、reused=全量,行数不变;
 *   6. 上架开关:publish=true 才置 isPublished=true;
 *   7. 部分已存在:按 title / video_url 两档查重各自复用,不产生重复行。
 *
 * 桩法:vi.mock('../src/client.js') 让 createDb 返回内存 fake db;fake 按 drizzle 条件对象
 * (queryChunks 里的列名 + 参数值)做真过滤,与 apps/api/tests/agent-reviews-routes.test.ts
 * 的 collectColumnNames 同族(沿 queryChunks 摸列、摸值)。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const state = vi.hoisted(() => ({ db: null as unknown }))
vi.mock('../src/client.js', () => ({ createDb: () => state.db }))

import {
  seedLegacyVideos,
  loadLegacyVideoData,
  legacyVideoUrl,
  DEFAULT_LEGACY_ASSET_BASE,
  __test__,
} from '../seed/legacy-videos.js'

// ==================== fake db ====================

const TABLE_NAME = Symbol.for('drizzle:Name')

type FakeRow = Record<string, unknown>

function columnIndex(table: object) {
  const byDbName = new Map<string, string>()
  const byColumn = new Map<object, string>()
  for (const key of Object.keys(table)) {
    const col = (table as Record<string, unknown>)[key] as
      { name?: string; table?: unknown } | undefined
    if (col && typeof col === 'object' && typeof col.name === 'string' && col.table === table) {
      byDbName.set(col.name, key)
      byColumn.set(col, key)
    }
  }
  return { byDbName, byColumn }
}

/** 从 drizzle 条件对象摸出 { 列的 db 名, 参数值列表 };eq → 单值,inArray → 多值 */
function extractWhere(cond: unknown): { column: string; values: unknown[] } {
  let column: string | undefined
  const values: unknown[] = []
  const walk = (node: unknown) => {
    if (node === null || node === undefined) return
    if (Array.isArray(node)) return node.forEach(walk)
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
      values.push(node)
      return
    }
    if (typeof node !== 'object') return
    const obj = node as Record<string, unknown> & { constructor?: { name?: string } }
    if (obj.constructor?.name === 'StringChunk') return
    if (typeof obj.name === 'string' && obj.table) {
      column = obj.name
      return
    }
    if (Array.isArray(obj.queryChunks)) return obj.queryChunks.forEach(walk)
    if ('value' in obj && (typeof obj.value !== 'object' || obj.value === null))
      values.push(obj.value)
  }
  walk(cond)
  if (!column) throw new Error('fake-db: 条件里没摸到列')
  return { column, values }
}

function createFakeDb() {
  const tables = new Map<string, FakeRow[]>()
  const idxCache = new Map<object, ReturnType<typeof columnIndex>>()
  let idSeq = 0
  const nextId = () => `00000000-0000-4000-8000-${String(++idSeq).padStart(12, '0')}`
  const idxOf = (table: object) => {
    if (!idxCache.has(table)) idxCache.set(table, columnIndex(table))
    return idxCache.get(table)!
  }
  const rowsOf = (table: object) => {
    const name = (table as Record<symbol, string>)[TABLE_NAME]
    if (!tables.has(name)) tables.set(name, [])
    return tables.get(name)!
  }
  const selectProject = (rows: FakeRow[], cols?: Record<string, object>, table?: object) => {
    if (!cols || !table) return rows.map((r) => ({ ...r }))
    const idx = idxOf(table)
    return rows.map((r) => {
      const out: FakeRow = {}
      for (const [alias, col] of Object.entries(cols)) {
        const key = idx.byColumn.get(col)
        out[alias] = key ? r[key] : undefined
      }
      return out
    })
  }

  const db = {
    select: (cols?: Record<string, object>) => ({
      from: (table: object) => {
        const chain: Record<string, unknown> = {}
        let filtered: FakeRow[] | null = null
        chain.where = (cond: unknown) => {
          const { column, values } = extractWhere(cond)
          const key = idxOf(table).byDbName.get(column)
          filtered = rowsOf(table).filter((r) => key !== undefined && values.includes(r[key]))
          return chain
        }
        chain.limit = (n: number) =>
          Promise.resolve(selectProject((filtered ?? rowsOf(table)).slice(0, n), cols, table))
        chain.then = (res: (v: FakeRow[]) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve(selectProject(filtered ?? rowsOf(table), cols, table)).then(res, rej)
        return chain
      },
    }),
    insert: (table: object) => ({
      values: (vals: FakeRow) => ({
        returning: (cols: Record<string, object>) => {
          const row: FakeRow = {
            id: nextId(),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...vals,
          }
          rowsOf(table).push(row)
          return Promise.resolve(selectProject([row], cols, table))
        },
      }),
    }),
    update: (table: object) => ({
      set: (vals: FakeRow) => ({
        where: (cond: unknown) => {
          const { column, values } = extractWhere(cond)
          const key = idxOf(table).byDbName.get(column)
          for (const r of rowsOf(table)) if (key && values.includes(r[key])) Object.assign(r, vals)
          return Promise.resolve()
        },
      }),
    }),
  }

  return { db, tables }
}

type Fake = ReturnType<typeof createFakeDb>
const quiet = () => undefined

function useFake(fake: Fake) {
  state.db = fake.db
}

// ==================== 用例 ====================

describe('G-921 legacy-videos 挂载链', () => {
  let fake: Fake
  beforeEach(() => {
    fake = createFakeDb()
    useFake(fake)
  })

  it('数据完整性:22 门课 / 867 小节 / 排除 3 枚 = 票面 870,rel 均为 slug/课时.mp4 且无半成品', () => {
    const data = loadLegacyVideoData()
    expect(data.courses).toHaveLength(22)
    expect(data.excluded).toHaveLength(3)
    const sections = data.courses.flatMap((c) => c.sections)
    expect(sections).toHaveLength(867)
    expect(sections.length + data.excluded.length).toBe(870)
    for (const s of sections) {
      expect(s.rel).toMatch(/^[A-Za-z0-9_\-./]+\/[A-Za-z0-9_\-.\u4e00-\u9fff]+\.mp4$/)
      expect(s.rel).not.toMatch(/\.f\d+\.mp4$/) // 3 枚 yt-dlp 单流半成品不许混进播放行
      expect(s.duration).toBeGreaterThan(0)
      expect(s.bytes).toBeGreaterThan(0)
      expect(s.title.length).toBeLessThanOrEqual(200)
    }
    // 排除名单里的 3 枚与挂载 rel 无交集
    const rels = new Set(sections.map((s) => s.rel))
    for (const ex of data.excluded) expect(rels.has(ex)).toBe(false)
  })

  it('URL 映射:base+/videos/+encodeURI(rel),全量 ≤ varchar(512);env 覆写与尾斜杠归一', () => {
    const url = legacyVideoUrl('3b1b/3b1b_linear_01.mp4')
    expect(url).toBe(`${DEFAULT_LEGACY_ASSET_BASE}/videos/3b1b/3b1b_linear_01.mp4`)
    const data = loadLegacyVideoData()
    for (const c of data.courses) {
      for (const s of c.sections) expect(legacyVideoUrl(s.rel).length).toBeLessThanOrEqual(512)
    }
    process.env.LEGACY_ASSET_BASE_URL = 'https://example.com/legacy-assets/'
    try {
      expect(legacyVideoUrl('a/b.mp4')).toBe('https://example.com/legacy-assets/videos/a/b.mp4')
    } finally {
      delete process.env.LEGACY_ASSET_BASE_URL
    }
  })

  it('dry-run 零写:apply=false 不发一句写,只报计划数', async () => {
    const result = await seedLegacyVideos({ apply: false, log: quiet })
    expect(result.applied).toBe(false)
    expect(result.plannedLessons).toBe(22)
    expect(result.plannedSections).toBe(867)
    expect(result.addedLessons).toBe(0)
    expect(result.addedSections).toBe(0)
    for (const rows of fake.tables.values()) expect(rows).toHaveLength(0) // 三张表零写入
  })

  it('落库草稿:22 课 / 22 章 / 867 小节,isPublished=false,小节 videoUrl+duration 齐,lessonCount 对账', async () => {
    const result = await seedLegacyVideos({ apply: true, publish: false, log: quiet })
    expect(result.applied).toBe(true)
    expect(result.addedLessons).toBe(22)
    expect(result.addedChapters).toBe(22)
    expect(result.addedSections).toBe(867)

    const lessonRows = fake.tables.get('lessons')!
    const chapterRows = fake.tables.get('lesson_chapters')!
    const sectionRows = fake.tables.get('lesson_chapter_sections')!
    expect(lessonRows).toHaveLength(22)
    expect(chapterRows).toHaveLength(22)
    expect(sectionRows).toHaveLength(867)

    for (const l of lessonRows) {
      expect(l.isPublished).toBe(false) // 票面:先不上架
      expect(l.status).toBe(1)
    }
    const data = loadLegacyVideoData()
    for (const c of data.courses) {
      const row = lessonRows.find((l) => l.title === c.title)
      expect(row, `课程缺行:${c.title}`).toBeTruthy()
      expect(row!.lessonCount).toBe(c.sections.length)
    }
    for (const s of sectionRows) {
      expect(typeof s.videoUrl).toBe('string')
      expect((s.videoUrl as string).startsWith(`${DEFAULT_LEGACY_ASSET_BASE}/videos/`)).toBe(true)
      expect(s.duration).toBeGreaterThan(0)
      expect(s.isFree).toBe(true)
    }
    // 每门课恰好一个"完整课程"章,小节全挂在章下
    const chapterIds = new Set(chapterRows.map((c) => c.id))
    expect(chapterIds.size).toBe(22)
    for (const s of sectionRows) expect(chapterIds.has(s.chapterId)).toBe(true)
  })

  it('幂等:同库重跑 added=0、reused=全量,三表行数不变', async () => {
    await seedLegacyVideos({ apply: true, publish: false, log: quiet })
    const before = [
      fake.tables.get('lessons')!.length,
      fake.tables.get('lesson_chapters')!.length,
      fake.tables.get('lesson_chapter_sections')!.length,
    ]
    const again = await seedLegacyVideos({ apply: true, publish: false, log: quiet })
    expect(again.addedLessons).toBe(0)
    expect(again.reusedLessons).toBe(22)
    expect(again.addedChapters).toBe(0)
    expect(again.addedSections).toBe(0)
    expect(again.reusedSections).toBe(867)
    expect([
      fake.tables.get('lessons')!.length,
      fake.tables.get('lesson_chapters')!.length,
      fake.tables.get('lesson_chapter_sections')!.length,
    ]).toEqual(before)
  })

  it('上架开关:缺省草稿,publish=true 才置 isPublished', async () => {
    await seedLegacyVideos({ apply: true, log: quiet })
    expect(fake.tables.get('lessons')!.every((l) => l.isPublished === false)).toBe(true)
    const pub = createFakeDb()
    useFake(pub)
    await seedLegacyVideos({ apply: true, publish: true, log: quiet })
    expect(pub.tables.get('lessons')!.every((l) => l.isPublished === true)).toBe(true)
  })

  it('存量库:草稿已存在时,--publish 重跑要把复用行翻成发布态(现网 total=0 的真因)', async () => {
    // 首轮:模拟现网已挂载但未上架的 22 门课(isPublished=false)
    await seedLegacyVideos({ apply: true, publish: false, log: quiet })
    expect(fake.tables.get('lessons')!.every((l) => l.isPublished === false)).toBe(true)
    const sectionsBefore = fake.tables.get('lesson_chapter_sections')!.length

    // 第二轮:同库 --apply --publish。复用分支此前不带 updateValues ⇒ isPublished 永远停在 false
    const result = await seedLegacyVideos({ apply: true, publish: true, log: quiet })
    expect(result.addedLessons).toBe(0)
    expect(result.reusedLessons).toBe(22)
    const lessonRows = fake.tables.get('lessons')!
    expect(lessonRows).toHaveLength(22)
    expect(lessonRows.every((l) => l.isPublished === true)).toBe(true)
    expect(lessonRows.every((l) => l.status === 1)).toBe(true)
    // 发布不该增生小节;视频行与 lessonCount 对账保持不变
    expect(fake.tables.get('lesson_chapter_sections')!).toHaveLength(sectionsBefore)
    const data = loadLegacyVideoData()
    for (const c of data.courses) {
      expect(lessonRows.find((l) => l.title === c.title)!.lessonCount).toBe(c.sections.length)
    }
  })

  it('部分已存在:课程按 title 复用、小节按 video_url 复用,不产生重复行', async () => {
    const data = loadLegacyVideoData()
    const first = data.courses[0]
    const dupLessonId = 'aaaaaaaa-0000-4000-8000-000000000001'
    fake.tables.set('lessons', [{ id: dupLessonId, title: first.title }])
    fake.tables.set('lesson_chapter_sections', [
      {
        id: 'bbbbbbbb-0000-4000-8000-000000000001',
        videoUrl: __test__.legacyVideoUrl(first.sections[0].rel),
      },
    ])
    const result = await seedLegacyVideos({ apply: true, publish: false, log: quiet })
    expect(result.reusedLessons).toBe(1)
    expect(result.addedLessons).toBe(21)
    expect(result.reusedSections).toBe(1)
    expect(result.addedSections).toBe(866)
    expect(fake.tables.get('lessons')).toHaveLength(22)
    expect(fake.tables.get('lesson_chapter_sections')).toHaveLength(867)
    // 已存在课程不重建章,而是挂到原 lesson 下
    const chapters = fake.tables.get('lesson_chapters')!
    expect(chapters.filter((c) => c.lessonId === dupLessonId)).toHaveLength(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
