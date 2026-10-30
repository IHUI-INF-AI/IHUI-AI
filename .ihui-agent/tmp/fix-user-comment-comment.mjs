// 修 /user/comment 页里那条与代码矛盾的旧注释(它还写着 authorId 语义)
import fs from 'node:fs'

const p = 'apps/web/app/(main)/user/comment/page.tsx'
let s = fs.readFileSync(p, 'utf8')

const old = '  // 2026-10-15 登录态门:/api/comments?authorId= = 当前用户的评论,未就绪/未登录不发注定 401 的查询'
if (!s.includes(old)) {
  console.error('注释锚未命中 ⇒ 不落盘')
  process.exit(2)
}
const rep = [
  '  // 2026-10-15 登录态门:未就绪/未登录不发注定 401 的查询。',
  '  // 2026-10-27 改面:原先打 `/api/comments?authorId=` —— 该公开列表面的 query 模式只认',
  '  // resourceType/resourceId/parentId,zod 默认剥未知键 ⇒ authorId 被静默丢弃,页面拿回的是',
  '  // "全站顶级评论"而不是本人的(取错数据,比 404 更难发现)。现改打自范围面',
  '  // GET /api/comments/mine,主体取自令牌,页面不再也不该自报用户 id(§5 认证不等于授权)。',
].join('\n')
s = s.replace(old, rep)
fs.writeFileSync(p, s)
console.log('注释已更正;残留旧语义引用:', (s.match(/api\/comments\?authorId=\s*=/g) || []).length, '(应为 1:注释里对历史的说明)')
