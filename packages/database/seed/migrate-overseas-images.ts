// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 数据侧迁移:把线上库中「境外图片域名」的渲染用图片列,映射到境内可达图源池。
 *
 * 射程列(任务书指定的三列,不多不少):
 *   carousels.image_url / agents.avatar / lessons.cover_image
 * 判据(任务书 ④):迁移后射程三列内不再残留境外图片域名 —— 脚本每次跑完都现库复核并打印判定行。
 *
 * 用法(与 seed 目录同口径:DSN 一律经 DATABASE_URL 环境变量注入,不落文件):
 *   cd packages/database
 *   DATABASE_URL="<apps/api/.env 里的 DATABASE_URL>" pnpm exec tsx seed/migrate-overseas-images.ts            # 默认 = 只读 dry-run,零写库
 *   DATABASE_URL=... pnpm exec tsx seed/migrate-overseas-images.ts --self-test                                 # 无库自检(零 DB 副作用)
 *   DATABASE_URL=... IHUI_IMAGE_MIGRATION_CONFIRM=apply pnpm exec tsx seed/migrate-overseas-images.ts --apply  # 写库(双确认闸)
 *
 * 写库安全链(全部同时成立才允许写):
 *   ① 必须显式给了 DATABASE_URL(缺省回退 DSN 可能悄悄打到别的库);
 *   ② 必须带 --apply 且环境变量 IHUI_IMAGE_MIGRATION_CONFIRM=apply(§5 测试隔离铁律取向:默认永远只读);
 *   ③ 写前把受影响行逐条(表/id/列/改前/改后)备份到 §15b 唯一备份目录
 *      `<盘符由 scripts/lib/gitdir.mjs 的 gitArchiveDir() 推导>/../sql/image-source-migration/*.json`,
 *      备份落盘失败即中止,不执行任何 UPDATE;DSN 在备份与输出中恒为脱敏态(密码不落任何文件/日志)。
 *   ④ 全程单事务;失败回滚,备份文件留在盘上供人工核对。
 *
 * 幂等:映射只命中境外域名,迁完即不再命中;跑两次结果一致(第二次现读 0 行)。
 * 如实登记:agents.cover 等其余图片列不属任务书射程,只现读报数、不改动(见输出「射程外存量」行)。
 */
import { createDb } from '../src/client.js'
import { carousels } from '../src/schema/carousels.js'
import { agents } from '../src/schema/agents-extended.js'
import { lessons } from '../src/schema/learn.js'
import { eq } from 'drizzle-orm'
import {
  DOMESTIC_IMAGE_POOL,
  isOverseasImageUrl,
} from '../../shared/src/constants/image-source-pool.ts'
// @ts-expect-error — 根 tooling 层无类型声明;此为 AGENTS §15b 规定的备份落点唯一出口,禁止硬编码盘符
import { gitArchiveDir } from '../../../scripts/lib/gitdir.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'

const TARGETS = [
  { name: 'carousels', table: carousels, idCol: carousels.id, urlCol: carousels.imageUrl },
  { name: 'agents', table: agents, idCol: agents.agentId, urlCol: agents.avatar },
  { name: 'lessons', table: lessons, idCol: lessons.id, urlCol: lessons.coverImage },
] as const

/** DSN 脱敏:任何输出/备份里都不得出现口令(按"authority 内最后一个 @"切 userinfo) */
export function redactDsn(dsn: string): string {
  const m = /^(postgres(?:ql)?:\/\/)([^/?#]*)(.*)$/.exec(dsn)
  if (!m) return dsn
  const at = m[2].lastIndexOf('@')
  if (at < 0) return dsn
  const userinfo = m[2].slice(0, at)
  const colon = userinfo.indexOf(':')
  const user = colon < 0 ? userinfo : userinfo.slice(0, colon)
  return `${m[1]}${user}:***@${m[2].slice(at + 1)}${m[3]}`
}

/**
 * 备份落点:gitArchiveDir() 给出 `<盘符>/DevEnv/backups/git`(§15b 唯一备份目录的既有出口),
 * 本脚本取 backups 根下的 sql/image-source-migration(与 pg dump 落 backups/pg、git 归档落 backups/git 同族)。
 * 出口返回 null(夹具/无法交出落点)⇒ 拒写。
 */
export function backupDirFor(worktree: string): string {
  const gitArch = gitArchiveDir(worktree)
  if (!gitArch) {
    throw new Error('gitArchiveDir() 无法交出备份落点(疑似夹具工作树),拒绝写库')
  }
  const backupsRoot = dirname(gitArch) // <X>/DevEnv/backups/git -> <X>/DevEnv/backups
  return join(backupsRoot, 'sql', 'image-source-migration').replace(/\\/g, '/')
}

type MigrationRow = { table: string; id: string; column: string; old: string; next: string }

/** 纯函数:从现读行集推导映射(轮转分配,顺序按表序+id 升序,可测幂等) */
export function planMigration(
  reads: Array<{ table: string; column: string; rows: Array<{ id: string; url: unknown }> }>,
): MigrationRow[] {
  const plan: MigrationRow[] = []
  let k = 0
  for (const r of reads) {
    for (const row of r.rows) {
      if (typeof row.url !== 'string') continue
      if (!isOverseasImageUrl(row.url)) continue
      plan.push({
        table: r.table,
        id: row.id,
        column: r.column,
        old: row.url,
        next: DOMESTIC_IMAGE_POOL[k % DOMESTIC_IMAGE_POOL.length],
      })
      k++
    }
  }
  return plan
}

/** 纯函数:把映射应用后的行集喂回自身,应零命中(幂等判据) */
export function isIdempotent(plan: MigrationRow[]): boolean {
  return plan.every((p) => !isOverseasImageUrl(p.next))
}

async function selfTest() {
  const cases: string[] = []
  const ok = (name: string, cond: boolean) => {
    cases.push(`${cond ? '✅' : '❌'} ${name}`)
    if (!cond) process.exitCode = 1
  }
  ok(
    '阳性对照:旧 seed 行里的 picsum URL 判境外',
    isOverseasImageUrl('https://picsum.photos/seed/python/400/300'),
  )
  ok('境内池成员不判境外', !DOMESTIC_IMAGE_POOL.some((u) => isOverseasImageUrl(u)))
  ok(
    'dicebear 头像服务判境外',
    isOverseasImageUrl('https://api.dicebear.com/9.x/initials/svg?seed=AI'),
  )
  ok(
    'wikimedia 判境外',
    isOverseasImageUrl('https://upload.wikimedia.org/wikipedia/commons/x/y.png'),
  )
  ok('x.ai 的 og 图判境外', isOverseasImageUrl('https://x.ai/images/news/grok-4-5-og.png'))
  ok('x.ai 的博客链接不误判', !isOverseasImageUrl('https://x.ai/blog/grok-4-5'))
  ok(
    '已停用的 bspapp(境内主体)不按境外判(不属本型)',
    !isOverseasImageUrl('https://x.cdn.bspapp.com/a.png'),
  )
  const fake = [
    {
      table: 'lessons',
      column: 'cover_image',
      rows: [
        { id: '1', url: 'https://picsum.photos/seed/a/400/300' },
        { id: '2', url: 'https://statics.moonshot.cn/keep.png' },
        { id: '3', url: null },
        { id: '4', url: 'https://cdn.sanity.io/images/x/y.jpg' },
      ],
    },
  ]
  const plan = planMigration(fake)
  ok('映射只命中境外行(2/4)', plan.length === 2 && plan[0].id === '1' && plan[1].id === '4')
  ok(
    '轮转取自同一份池',
    plan.every((p) => DOMESTIC_IMAGE_POOL.includes(p.next)),
  )
  ok('幂等:映射后的值不再命中判据', isIdempotent(plan))
  ok(
    '幂等:对已迁移行集重跑 plan 得 0 行',
    planMigration(
      fake.map((f) => ({
        ...f,
        rows: f.rows.map((r) =>
          plan.find((p) => p.id === r.id)
            ? { ...r, url: plan.find((p) => p.id === r.id)!.next }
            : r,
        ),
      })),
    ).length === 0,
  )
  ok(
    'DSN 脱敏',
    redactDsn('postgresql://u:p@ss!w@localhost:8810/db') === 'postgresql://u:***@localhost:8810/db',
  )
  let threw = false
  try {
    backupDirFor(process.cwd())
  } catch {
    threw = true
  }
  ok('备份落点推导可达(非夹具环境)', !threw || !gitArchiveDir(process.cwd()))
  const dir = threw ? '' : backupDirFor(process.cwd())
  ok(
    `备份落点在 §15b 唯一备份目录内且不含写死盘符字面:${dir || '(未交出)'}`,
    dir.includes('/DevEnv/backups/sql/image-source-migration'),
  )
  console.log(cases.join('\n'))
  console.log(
    `--self-test:${(cases.find((c) => c.startsWith('✅')) || '').length > 0 && process.exitCode !== 1 ? '全绿' : '有红'}`,
  )
  return
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) {
    await selfTest()
    return
  }
  const apply = args.includes('--apply')
  const dsn = process.env.DATABASE_URL
  if (apply) {
    if (!dsn) {
      console.error('拒绝写库:--apply 必须显式设置 DATABASE_URL(缺省回退 DSN 可能打到别的库)')
      process.exit(2)
    }
    if (process.env.IHUI_IMAGE_MIGRATION_CONFIRM !== 'apply') {
      console.error(
        '拒绝写库:需同时设置环境变量 IHUI_IMAGE_MIGRATION_CONFIRM=apply(双确认闸,防误触发)',
      )
      process.exit(2)
    }
  }
  if (!dsn) {
    console.error(
      '无法判定:请经 DATABASE_URL 注入目标库 DSN(与 seed 目录同口径);dry-run 也要求显式 DSN,以免悄悄打到回退库',
    )
    process.exit(2)
  }
  const db = createDb(dsn)
  const reads: Array<{ table: string; column: string; rows: Array<{ id: string; url: unknown }> }> =
    []
  for (const t of TARGETS) {
    // @ts-expect-error — 三表列型不同,drizzle select 形态在此按列名泛化取
    const rows = await db.select({ id: t.idCol, url: t.urlCol }).from(t.table).orderBy(t.idCol)
    reads.push({ table: t.name, column: (t.urlCol as unknown as { name: string }).name, rows })
  }
  const plan = planMigration(reads)
  const mode = apply ? 'APPLY(写库)' : 'DRY-RUN(只读,零写库)'
  console.log(`=== 境外图片域名迁移 — ${mode} ===`)
  console.log(`目标库:${redactDsn(dsn)}`)
  // 每表现读摘要:防"空表被读成通过"(本仓最高频失效型:把没看见写成看见了)
  for (const r of reads) {
    const hosts = new Map<string, number>()
    let overseas = 0
    for (const row of r.rows) {
      if (typeof row.url !== 'string' || row.url.length === 0) continue
      const h = /^https?:\/\/([^/]+)/.exec(row.url)?.[1] ?? '(非URL)'
      hosts.set(h, (hosts.get(h) ?? 0) + 1)
      if (isOverseasImageUrl(row.url)) overseas++
    }
    const top = [...hosts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([h, n]) => `${h}×${n}`)
      .join(' ')
    console.log(
      `  现读 ${r.table}.${r.column}:总 ${r.rows.length} 行 · 境外 ${overseas} 行 · host 分布(前3):${top || '(空表/无图片列值)'}`,
    )
  }
  for (const p of plan) {
    console.log(`  [${p.table}#${p.id}] ${p.column}`)
    console.log(`    改前:${p.old}`)
    console.log(`    改后:${p.next}`)
  }
  if (!apply) {
    console.log(
      `判据(现读):射程三列(carousels.image_url/agents.avatar/lessons.cover_image)残留境外行 = ${plan.length} ⇒ 通过条件是 0(当前 ${plan.length === 0 ? '已为 0' : '尚需 --apply'});dry-run 不改库`,
    )
    process.exit(0)
  }
  if (plan.length === 0) {
    console.log('合计 0 行待迁移 ⇒ 幂等复跑,无需写库;仍做终判。')
  }
  // —— 写库前:先备份受影响行(§15b 唯一备份目录,经 gitArchiveDir() 出口推导)——
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = backupDirFor(process.cwd())
  const backupFile = join(dir, `overseas-images-${stamp}.json`)
  const payload = {
    note: 'migrate-overseas-images.ts --apply 事前备份;恢复=逐行 UPDATE <table> SET <column>=<old> WHERE id=<id>',
    generatedAt: new Date().toISOString(),
    dsn: redactDsn(dsn),
    rows: plan,
  }
  mkdirSync(dirname(backupFile), { recursive: true })
  writeFileSync(backupFile, JSON.stringify(payload, null, 2) + '\n', 'utf8')
  console.log(`备份已落盘:${backupFile}`)
  // —— 单事务写库(失败整体回滚,备份文件保留)——
  await db.transaction(async (tx) => {
    for (const p of plan) {
      const t = TARGETS.find((x) => x.name === p.table)!
      // @ts-expect-error — 同上,按列名泛化更新
      const done = await tx
        .update(t.table)
        // @ts-expect-error — 三表列名不同,计算键 set 无法由联合表型推出
        .set({ [t.urlCol.name]: p.next })
        // @ts-expect-error — idCol 随表型变化,泛型循环内推不出同表实例
        .where(eq(t.idCol, p.id))
        // @ts-expect-error — 同上,returning 列同表实例限制
        .returning({ id: t.idCol })
      if (done.length !== 1) {
        throw new Error(
          `写库确认失败:${p.table}#${p.id} RETURNING ${done.length} 行(应为 1),整体回滚`,
        )
      }
    }
  })
  console.log(`写库完成:${plan.length} 行`)
  // —— 终判(任务书判据 ④):射程三列现读,境外域名残留必须为 0 ——
  const recheck: Array<{
    table: string
    column: string
    rows: Array<{ id: string; url: unknown }>
  }> = []
  for (const t of TARGETS) {
    // @ts-expect-error — 三表列型不同,select 形态按列名泛化取
    const rows = await db.select({ id: t.idCol, url: t.urlCol }).from(t.table).orderBy(t.idCol)
    recheck.push({ table: t.name, column: (t.urlCol as unknown as { name: string }).name, rows })
  }
  const residue = planMigration(recheck)
  // 射程外存量(只报数不动):agents.cover 列现读
  // @ts-expect-error — agents.cover 可空,与 unknown 行集在下游按 typeof 过滤
  const coverRows = await db
    .select({ id: agents.agentId, url: agents.cover })
    .from(agents)
    .orderBy(agents.agentId)
  const coverOut = coverRows.filter(
    (r: { url: unknown }) => typeof r.url === 'string' && isOverseasImageUrl(r.url),
  )
  console.log(
    `判据:射程三列(carousels.image_url/agents.avatar/lessons.cover_image)残留境外行 = ${residue.length} ⇒ ${residue.length === 0 ? '通过 ✅' : '未通过 ❌'}`,
  )
  console.log(`射程外存量(只报数,不属任务书列集):agents.cover 境外行 = ${coverOut.length}`)
  process.exit(residue.length === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('失败:', e instanceof Error ? e.message : e)
  process.exit(2)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
