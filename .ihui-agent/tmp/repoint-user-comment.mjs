// web /user/comment 改打自范围面(消"取错数据":authorId 不在公开列表面的 query 模式里)
import fs from 'node:fs'

const p = 'apps/web/app/(main)/user/comment/page.tsx'
let s = fs.readFileSync(p, 'utf8')

const urlOld = '/api/comments?authorId='
const i = s.indexOf(urlOld)
if (i < 0) {
  console.error('URL 锚未命中 ⇒ 不落盘')
  process.exit(2)
}
// 原行形如:  `/api/comments?authorId=${user!.id}`  —— 整段模板串替换为无参自范围面
const q = s.indexOf('`', i - 1)
const end = s.indexOf('`', i)
s = s.slice(0, q) + '`/api/comments/mine`' + s.slice(end + 1)

const anchor = `    queryKey: ['user', 'comment', user?.id],`
if (!s.includes(anchor)) {
  console.error('queryKey 锚未命中 ⇒ 不落盘')
  process.exit(2)
}
s = s.replace(
  anchor,
  [
    '    // 2026-10-27:改打自范围面 GET /api/comments/mine。',
    "    // 原来打 `/api/comments?authorId=` —— 该列表面的 query 模式只认 resourceType/resourceId/parentId,",
    '    // zod 默认剥未知键 ⇒ authorId 被静默丢弃,页面拿回的是"全站顶级评论"而非本人评论(取错数据,',
    '    // 比 404 更难被发现)。新面的主体取自令牌,页面无需也不该自报用户 id。',
  ].join('\n') + '\n' + anchor,
)

fs.writeFileSync(p, s)
const hasOld = (s.match(/api\/comments\?authorId/g) || []).length
console.log('改面完成;残留旧面引用:', hasOld)
console.log('新面在位:', s.includes('/api/comments/mine'))
