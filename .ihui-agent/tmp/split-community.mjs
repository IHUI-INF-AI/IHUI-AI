// P10 混域端点件拆分:wave3-community.ts → 按域四件 + 私信形状并入既有 private-letters.ts
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'D:/IHUI-AI-wt/gap-screens'
const SRC = path.join(ROOT, 'packages/api-client/src/endpoints/wave3-community.ts')
const lines = fs.readFileSync(SRC, 'utf8').split('\n')
const head3 = lines.slice(0, 3).join('\n') // 水印头(逐字节拷贝,零宽链不可重打)

const markerIdx = lines
  .map((l, i) => (/^\/\/ =+ /.test(l) ? i : -1))
  .filter((i) => i >= 0)
if (markerIdx.length !== 5) {
  console.error(`段落数异常: ${markerIdx.length} (期望 5) ⇒ 不落盘`)
  process.exit(2)
}
const tailMark = lines.map((l) => l.includes('\u2060')).lastIndexOf(true)
const sections = markerIdx.map((start, i) => {
  const end = i + 1 < markerIdx.length ? markerIdx[i + 1] : tailMark
  return { title: lines[start], body: lines.slice(start, end).join('\n').trimEnd() }
})

const DOCS = {
  invitations: [
    ' * 邀请码与受邀名单端点(Wave3 补 RN 承载,2026-10-26 后端契约现读):',
    ' *  - GET  /api/invitations          → data { list }          (apps/api/src/routes/promotions.ts:190)',
    ' *  - POST /api/invitations          → 201 data { invitation } (apps/api/src/routes/promotions.ts:130/185)',
    ' *  - GET  /api/invitations/invitees → data { list }           (apps/api/src/routes/promotions.ts:198)',
    ' * fetchApi 已拆 { code, message, data } 信封,本文件 data 泛型即信封内层形状。',
  ],
  'circles-post': [
    ' * 圈子发帖端点(Wave3 补 RN 承载,2026-10-26 后端契约现读):',
    ' *  - POST /api/circles/:id/posts → 201 data { post } (apps/api/src/routes/community/circles.ts:457/532)',
    ' * 圈子列表/详情 GET 面复用既有 community.ts 的 getCircles(§3 共享层优先),本件只补缺的写面。',
  ],
  'news-category': [
    ' * 资讯分类页端点(Wave3 补 RN 承载,2026-10-26 后端契约现读):',
    ' *  - GET /api/news/categories → data { list } (apps/api/src/routes/news.ts:136;后端仅下发启用分类)',
    ' *  - GET /api/news/articles   → data { list,total,page,pageSize } (apps/api/src/routes/news.ts:167;categoryId 须为 uuid)',
  ],
  'search-history': [
    ' * 搜索历史端点(Wave3 补 RN 承载,2026-10-26 后端契约现读):',
    ' *  - GET    /api/search/history → data { list }      (apps/api/src/routes/search.ts:205/232)',
    ' *  - DELETE /api/search/history → data { deletedCount } (apps/api/src/routes/search.ts:237)',
    ' *  - DELETE /api/search/history/:id → data { id }    (apps/api/src/routes/search.ts:243)',
  ],
}

const PLAN = [
  { file: 'invitations.ts', sec: 0 },
  { file: 'circles-post.ts', sec: 1 },
  { file: 'news-category.ts', sec: 2 },
  { file: 'search-history.ts', sec: 3 },
]

const created = []
for (const { file, sec } of PLAN) {
  const body = sections[sec].body
  const imports = []
  if (/\bApiResult\b/.test(body)) imports.push("import type { ApiResult } from '@ihui/types'")
  if (/\bfetchApi\b/.test(body)) imports.push("import { fetchApi } from '../client.js'")
  const utils = []
  if (/\bbuildQs\(/.test(body)) utils.push('buildQs')
  if (/\bPageData\b/.test(body)) utils.push('type PageData')
  if (utils.length) imports.push(`import { ${utils.join(', ')} } from '../utils.js'`)
  const doc = ['/**', ...(DOCS[file.replace('.ts', '')] || [' * (无契约注记)']), ' */'].join('\n')
  const text = `${head3}\n\n${doc}\n${imports.join('\n')}\n\n${body}\n`
  const out = path.join(ROOT, 'packages/api-client/src/endpoints', file)
  if (fs.existsSync(out)) {
    console.error(`目标已存在,拒绝覆盖: ${file} ⇒ 不落盘`)
    process.exit(2)
  }
  fs.writeFileSync(out, text)
  created.push({ file, exports: (body.match(/^export /gm) || []).length })
}

// 私信形状修正并入既有 private-letters.ts(同域第二份 = §0.6 禁止)
const PL = path.join(ROOT, 'packages/api-client/src/endpoints/private-letters.ts')
let pl = fs.readFileSync(PL, 'utf8')
const lettersBody = sections[4].body
  .split('\n')
  .slice(1)
  .join('\n')
  .trim()
const plLines = pl.split('\n')
const plTail = plLines.map((l) => l.includes('\u2060')).lastIndexOf(true)
if (plTail <= 0) {
  console.error('private-letters.ts 末行水印定位失败 ⇒ 不落盘')
  process.exit(2)
}
plLines.splice(plTail, 0, '', lettersBody, '')
fs.writeFileSync(PL, plLines.join('\n'))
created.push({ file: 'private-letters.ts(并入)', exports: (lettersBody.match(/^export /gm) || []).length })

console.log('拆分产出:')
for (const c of created) console.log(`  ${c.file} 导出 ${c.exports}`)
console.log('段落标题核对:', sections.map((s) => s.title.replace(/^\/\/ =+ /, '').replace(/ =+$/, '')).join(' | '))
