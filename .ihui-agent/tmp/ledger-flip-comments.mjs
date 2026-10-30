// 台账本轮改判:comments → aligned(接线复用,逐语义核过);certificate/download 保持 gap 但补真因证据。
import fs from 'node:fs'

const p = 'scripts/data/web-rn-screen-map.jsonl'
const text = fs.readFileSync(p, 'utf8')
const lines = text.split('\n')
const rows = lines.filter(Boolean).map((l) => JSON.parse(l))
const byKey = new Map(rows.map((r, i) => [r.web, i]))

function patch(web, next) {
  const i = byKey.get(web)
  if (i === undefined) {
    console.error(`无此行: ${web} ⇒ 不落盘`)
    process.exit(2)
  }
  // 只改指定字段,其余逐字保留;复合主键(web)不动
  rows[i] = { ...rows[i], ...next }
}

const before = JSON.stringify(rows.map((r) => [r.web, r.status]))

patch('comments', {
  status: 'aligned',
  rn: 'apps/mobile-rn/src/screens/MyCommentsScreen.tsx',
  note:
    'Wave3-c@2026-10-27: 接线复用既有屏(零新代码,逐语义核过)。web /comments 只有两条数据动作: ' +
    'GET /api/comments/mine?page&pageSize=20(page.tsx:86,44)+ DELETE /api/comments/:id 带确认弹窗(page.tsx:91,211);' +
    '既有 RN 屏 MyCommentsScreen 正好同两条 —— getMyComments({page,pageSize:PAGE_SIZE=20})(:41,:18)' +
    '与 deleteMyComment + Alert 确认(:70,:61),路由 MyComments 已在 RootNavigator:523 注册。' +
    '它的数据面 GET /api/comments/mine 是上一枚(d9e1d9c5)才在 apps/api/src/routes/comments.ts 补注册的,' +
    '此前该路径全仓零命中 ⇒ 本条从"打空面"变成真承载,不是补数字。',
  at: '2026-10-27',
})

patch('certificate/download', {
  note:
    'Wave3-c@2026-10-27 复核:保持 gap,**但缺的不是屏也不是端点**。后端两面都在:' +
    'GET /certificates/my(certificate.ts:129,注释写明 userId 强制当前登录用户)与' +
    'POST /certificates/:id/download(certificate.ts:164,PDFKit 服务端产 PDF,非本人 403)。' +
    '卡点在 RN 平台侧没有二进制下载原语:唯一出口 api-client fetchRaw 返回 Blob,而' +
    'apps/mobile-rn/src/screens/PublishAccountsScreen.tsx:102-104 已实测记录"RN 的 Blob 到不了渲染层,' +
    '要吃得再引 base64/落盘依赖",且端内现无 bytes→base64 手段(grep toBase64/base64-js/Encoding 零命中);' +
    '该下载面又是 POST-only,expo-file-system 的 downloadAsync 只支持 GET。' +
    '⇒ 闭合要先定"给 RN 加二进制落盘原语"这条基础设施(引哪个依赖、放共享层还是端内),不在补屏范围内。',
  at: '2026-10-27',
})

const after = JSON.stringify(rows.map((r) => [r.web, r.status]))
const changedStatus = rows.filter((r, i) => before !== after && r.web === 'comments').length
const out = rows.map((r) => JSON.stringify(r)).join('\n') + '\n'
const reparsed = out.split('\n').filter(Boolean).map(JSON.parse)
const seen = new Set()
let dup = 0
for (const r of reparsed) {
  if (seen.has(r.web)) dup++
  seen.add(r.web)
}
const c = {}
for (const r of reparsed) c[r.status] = (c[r.status] || 0) + 1
console.log('行数', reparsed.length, '(前', rows.length, ')', JSON.stringify(c), '重复键', dup)
console.log('状态改判:', reparsed.filter((r, i) => r.status !== rows.map((x) => x)[i]?.status).map((r) => r.web).join(',') || '(见下行断言)')
if (reparsed.length !== 449 || dup > 0) {
  console.error('断言不过 ⇒ 不落盘')
  process.exit(2)
}
fs.writeFileSync(p, out)
console.log('已落盘;comments =', reparsed.find((r) => r.web === 'comments').status, '| certificate/download =', reparsed.find((r) => r.web === 'certificate/download').status)
void changedStatus
