// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `visit_logs` 页面路径存量归一(2026-10-26 立)。
 *
 * 立因(生产实测,不是推测):
 *  - 页面排行按**原始 url** 分组 ⇒ 同一页面因 query 不同被拆成多行
 *    (`/chat` 与 `/chat?conversationId=…` 各占一行);「共 N 个页面」实测 235(真实约 30)。
 *  - 历史行里留着**授权凭据**:`/?sso_code=…`、`/callback?platform=wechat&code=…&state=…`
 *    —— 它们会原样出现在管理端「页面访问排行」上,任何人登录后台就能读到授权码。
 *
 * 本脚本是**写入面归一的一次性补账**:写入面已改由服务端归一(见
 * `apps/api/src/db/visit-tracking-queries.ts` 的 `saveVisitLog`),存量按同一把尺子补齐,
 * 于是读侧不必再写第二份归一表达式(单一真相源 = `@ihui/shared/utils/visit-url`)。
 *
 * 语义:
 *  - 归一后变了 ⇒ 改写 url;
 *  - 归一不出来(静态资源 / 路由组形态)⇒ url 置 NULL。
 *    **置 NULL 而不是删行**:行仍计入 PV/UV 总量(「有人访问过」这个事实不丢),
 *    只是不再作为页面参与排行 —— 噪声路径不该占排行位。
 *  - referer 一并剥凭据段(host 保留 ⇒「访问来源」按主机分桶不受影响)。
 *
 * 用法:
 *   pnpm --filter @ihui/api exec tsx scripts/normalize-visit-paths.mts           # dry-run:只报告
 *   pnpm --filter @ihui/api exec tsx scripts/normalize-visit-paths.mts --apply   # 落库
 *
 * 环境:DATABASE_URL(缺省读 apps/api/.env);连不上 ⇒ 显式未判定(exit 2),不回落成"零脏值"。
 */
import 'dotenv/config'
import postgres from 'postgres'
import { normalizeVisitPath } from '@ihui/shared/utils/visit-url'
import { stripUrlCredentialSegments } from '@ihui/shared/utils/sanitize-url'

const APPLY = process.argv.includes('--apply')
const url = process.env.DATABASE_URL
if (!url) {
  console.error('未判定:DATABASE_URL 缺失 —— 取不到观测面就不落库,也不报"零脏值"(AGENTS §0.3)')
  process.exit(2)
}

const sql = postgres(url, { max: 1, idle_timeout: 5, connect_timeout: 8 })

/** 归一不出来的 url ⇒ 置 NULL(不是页面)。 */
function normalizeOrNull(raw: string | null): string | null {
  return normalizeVisitPath(raw)
}

/** referer:剥凭据段,host 保留;空 ⇒ null。 */
function normalizeReferer(raw: string | null): string | null {
  const value = (raw ?? '').trim()
  if (!value) return null
  const stripped = stripUrlCredentialSegments(value).trim()
  return stripped ? stripped.slice(0, 512) : null
}

try {
  const [before] = await sql`
    select count(*)::int as rows,
           count(distinct url)::int as distinct_url,
           count(*) filter (where url is not null)::int as rows_with_url
    from visit_logs
  `

  const urls = await sql`
    select url, count(*)::int as pv
    from visit_logs
    where url is not null
    group by url
    order by count(*) desc
  `

  const referers = await sql`
    select referer, count(*)::int as pv
    from visit_logs
    where referer is not null
    group by referer
    order by count(*) desc
  `

  // url 侧:哪些要改
  const urlPlan: Array<{ from: string; to: string | null; pv: number }> = []
  for (const row of urls) {
    const to = normalizeOrNull(row.url)
    if (to !== row.url) urlPlan.push({ from: row.url, to, pv: row.pv })
  }

  // referer 侧:哪些要改
  const refererPlan: Array<{ from: string; to: string | null; pv: number }> = []
  for (const row of referers) {
    const to = normalizeReferer(row.referer)
    if (to !== row.referer) refererPlan.push({ from: row.referer, to, pv: row.pv })
  }

  console.log('=== 存量页面路径归一(dry-run) ===')
  console.log(`判定面:visit_logs 全量 ${before?.rows ?? 0} 行 / 去重 url ${before?.distinct_url ?? 0} 个`)
  console.log(`需改写的 url 值 ${urlPlan.length} 个;需改写的 referer 值 ${refererPlan.length} 个`)
  if (urlPlan.length > 0) {
    console.log('\n-- url --')
    for (const p of urlPlan) {
      console.log(`  pv=${String(p.pv).padStart(4)}  ${JSON.stringify(p.from)} ⇒ ${JSON.stringify(p.to)}`)
    }
  }
  if (refererPlan.length > 0) {
    console.log('\n-- referer --')
    for (const p of refererPlan) {
      console.log(`  pv=${String(p.pv).padStart(4)}  ${JSON.stringify(p.from)} ⇒ ${JSON.stringify(p.to)}`)
    }
  }

  if (!APPLY) {
    console.log('\n未落库(dry-run)。加 --apply 才写。')
    process.exit(0)
  }

  let urlRows = 0
  for (const p of urlPlan) {
    const res = await sql`
      update visit_logs set url = ${p.to} where url = ${p.from}
    `
    urlRows += res.count
  }
  let refererRows = 0
  for (const p of refererPlan) {
    const res = await sql`
      update visit_logs set referer = ${p.to} where referer = ${p.from}
    `
    refererRows += res.count
  }

  const [after] = await sql`
    select count(distinct url)::int as distinct_url,
           count(*) filter (where url is not null)::int as rows_with_url
    from visit_logs
  `

  console.log('\n=== 已落库 ===')
  console.log(`改写 url 行数 ${urlRows};改写 referer 行数 ${refererRows}`)
  console.log(
    `去重 url ${before?.distinct_url ?? 0} ⇒ ${after?.distinct_url ?? 0};带 url 的行 ${before?.rows_with_url ?? 0} ⇒ ${after?.rows_with_url ?? 0}`,
  )

  const top = await sql`
    select url, count(*)::int as pv
    from visit_logs
    where url is not null
    group by url
    order by count(*) desc
    limit 12
  `
  console.log('\n-- 归一后页面排行 TOP12 --')
  for (const row of top) {
    console.log(`  pv=${String(row.pv).padStart(5)}  ${row.url}`)
  }
} catch (err) {
  console.error('未判定:归一脚本执行失败:', (err as Error)?.message)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 3 })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
