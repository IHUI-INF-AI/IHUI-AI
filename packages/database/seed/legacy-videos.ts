// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 历史存档课程视频 → lessons / lesson_chapters / lesson_chapter_sections
//
// 数据来源是 `legacy-video-courses.json`(由存档侧从旧项目视频语料**实测**生成:时长取 mp4 的
// moov/mvhd duration/timescale,分辨率取 tkhd 尾部 16.16 定点;3 枚 yt-dlp 单流半成品 `.fNNNN.mp4`
// 已排除,不建播放行)。
//
// 标题口径:课程名只取**文件名里字面可证**的人名/校名/框架名(见 JSON 里 namingEvidence),小节名一律
// 「第 N 集」并把原始文件名留在 content —— 存档里没有逐集标题,造标题就是造数据。
//
// CLI:`tsx seed/legacy-videos.ts` 缺省 dry-run(纯读普查,一句写都不发);`--apply` 才写库;
// `--publish` 才置 isPublished(默认全部草稿,上架与否归内容侧)。作为 seed 步骤被 index.ts 调用时
// 走 `apply=true, publish=false`。
//
// 存量库重跑:`--apply --publish` **也会把已存在的 22 门课翻成发布态**(upsert 的复用分支带
// updateValues) —— 只补新增行、不翻旧行的话,现网 total=0 永远修不好:视频行早已在库,缺的是
// isPublished/status 这两个公开列表的过滤谓词。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { eq, inArray } from 'drizzle-orm'
import { createDb } from '../src/client.js'
import { lessons, lessonChapters, lessonChapterSections } from '../src/schema/learn.js'
import { upsertByUnique } from './_utils/upsert-by-unique.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))

type Course = {
  seriesKey: string
  title: string
  lecturerName: string | null
  namingEvidence: string
  sections: Array<{
    title: string
    rel: string
    duration: number
    bytes: number
    width: number | null
    height: number | null
  }>
}
type LegacyVideoData = { courses: Course[]; excluded: string[] }

export const DEFAULT_LEGACY_ASSET_BASE = 'https://test-for-dp.oss-cn-guangzhou.aliyuncs.com/legacy-assets'

export function legacyAssetBaseUrl(): string {
  return (process.env.LEGACY_ASSET_BASE_URL ?? DEFAULT_LEGACY_ASSET_BASE).replace(/\/$/, '')
}

export function loadLegacyVideoData(): LegacyVideoData {
  return JSON.parse(fs.readFileSync(path.join(HERE, 'legacy-video-courses.json'), 'utf8')) as LegacyVideoData
}

export function legacyVideoUrl(rel: string): string {
  return `${legacyAssetBaseUrl()}/videos/${encodeURI(rel)}`
}

const introOf = (c: Course) =>
  `历史存档课程(2026-10 自旧项目视频语料重建)。小节按原始文件序号命名,时长与分辨率为实测值,标题待人工校订。命名依据:${c.namingEvidence}`

export interface SeedLegacyVideosOptions {
  apply?: boolean
  publish?: boolean
  databaseUrl?: string
  log?: (line: string) => void
}

export interface SeedLegacyVideosResult {
  courses: number
  sections: number
  addedLessons: number
  reusedLessons: number
  addedChapters: number
  addedSections: number
  reusedSections: number
  plannedLessons: number
  plannedSections: number
  applied: boolean
}

export async function seedLegacyVideos(opts: SeedLegacyVideosOptions = {}): Promise<SeedLegacyVideosResult> {
  const apply = opts.apply ?? true
  const publish = opts.publish ?? false
  const log = opts.log ?? ((l: string) => console.log(l))
  const data = loadLegacyVideoData()
  const db = createDb(opts.databaseUrl ?? process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/ihui')

  const allTitles = data.courses.map((c) => c.title)
  const allUrls = data.courses.flatMap((c) => c.sections.map((s) => legacyVideoUrl(s.rel)))

  // 只读普查:两档都先量"库里已有什么"
  const [existingLessons, existingSections] = await Promise.all([
    db.select({ id: lessons.id, title: lessons.title }).from(lessons).where(inArray(lessons.title, allTitles)),
    db
      .select({ id: lessonChapterSections.id, videoUrl: lessonChapterSections.videoUrl })
      .from(lessonChapterSections)
      .where(inArray(lessonChapterSections.videoUrl, allUrls)),
  ])
  const knownTitles = new Set(existingLessons.map((r) => r.title))
  const knownUrls = new Set(existingSections.map((r) => r.videoUrl as string))
  const plannedLessons = allTitles.filter((t) => !knownTitles.has(t)).length
  const plannedSections = allUrls.filter((u) => !knownUrls.has(u)).length

  log(
    `[legacy-videos] ${apply ? 'APPLY' : 'DRY-RUN(只读,不写库)'} 课程 ${data.courses.length} 门(待新增 ${plannedLessons})/ ` +
      `小节 ${allUrls.length} 条(待新增 ${plannedSections},已存在 ${knownUrls.size})/ 排除半成品 ${data.excluded.length} 枚`,
  )
  log(`  base=${legacyAssetBaseUrl()}  isPublished=${publish}`)

  const result: SeedLegacyVideosResult = {
    courses: data.courses.length,
    sections: allUrls.length,
    addedLessons: 0,
    reusedLessons: 0,
    addedChapters: 0,
    addedSections: 0,
    reusedSections: 0,
    plannedLessons,
    plannedSections,
    applied: apply,
  }
  if (!apply) {
    log('[legacy-videos] DRY-RUN 结束。确认无误后加 --apply 落库(可再配 --publish)。')
    return result
  }

  for (const c of data.courses) {
    const lessonValues = {
      title: c.title,
      coverImage: null,
      intro: introOf(c),
      categoryId: null,
      lecturerId: null,
      lecturerName: c.lecturerName,
      difficulty: null,
      price: '0.00',
      originalPrice: null,
      isFree: true,
      isPublished: publish,
      sort: 0,
      lessonCount: c.sections.length,
      status: 1,
    }
    const { id: lessonId, action } = await upsertByUnique(db as never, {
      table: lessons,
      uniqueBy: { column: lessons.title, value: c.title },
      // helper 的 idColumn 缺省 = 查重列(此处即 title)⇒ 不显式点名主键就会把标题当 id 回给下游
      idColumn: lessons.id,
      insertValues: {
        ...lessonValues,
      },
      // 复用分支:仅 publish 时翻发布态(草稿重跑不改线上状态);lessonCount 是本节点数,恒可校正。
      updateValues: publish
        ? { isPublished: true, status: 1, lessonCount: c.sections.length }
        : { lessonCount: c.sections.length },
    })
    if (action === 'inserted') result.addedLessons++
    else result.reusedLessons++

    const existing = await db
      .select({ id: lessonChapters.id })
      .from(lessonChapters)
      .where(eq(lessonChapters.lessonId, lessonId as string))
      .limit(1)
    let chapterId = existing[0]?.id as string | undefined
    if (!chapterId) {
      const ins = await db
        .insert(lessonChapters)
        .values({ lessonId: lessonId as string, title: '完整课程', sortOrder: 0 })
        .returning({ id: lessonChapters.id })
      chapterId = ins[0].id as string
      result.addedChapters++
    }

    let sortOrder = 0
    for (const s of c.sections) {
      const r = await upsertByUnique(db as never, {
        table: lessonChapterSections,
        uniqueBy: { column: lessonChapterSections.videoUrl, value: legacyVideoUrl(s.rel) },
        insertValues: {
          chapterId,
          title: s.title,
          content: `原文件名:${s.rel};字节:${s.bytes};分辨率:${s.width ?? '未知'}x${s.height ?? '未知'}`,
          videoUrl: legacyVideoUrl(s.rel),
          duration: s.duration,
          sortOrder: sortOrder++,
          isFree: true,
        },
      })
      if (r.action === 'inserted') result.addedSections++
      else result.reusedSections++
    }
    log(`  ${action === 'inserted' ? '[+]' : '[=]'} ${c.title} — ${c.sections.length} 集`)
  }

  log(
    `[legacy-videos] 落库结果:课程 新增 ${result.addedLessons}/复用 ${result.reusedLessons};章节 新增 ${result.addedChapters};` +
      `小节 新增 ${result.addedSections}/复用 ${result.reusedSections}`,
  )
  return result
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  await seedLegacyVideos({
    apply: process.argv.includes('--apply'),
    publish: process.argv.includes('--publish'),
  })
}

export const __test__ = { legacyVideoUrl, loadLegacyVideoData, introOf }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
