// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import postgres from 'postgres'
import { plainTitleText } from '@ihui/shared'

/**
 * 历史脏标题一次性修复(2026-11-23 立)。
 *
 * 背景:会话标题由 LLM 生成,早期清洗只去引号/「标题:」前缀 —— 模型开口的
 * `1. **分析用户的请求:**`、`<think>…</think>` 残留被原样入库,而侧栏按纯文本渲染,
 * 星号与行首编号直接暴露在用户眼前。生成侧已接 shared 的 plainTitleText
 * (此后不再产生新脏值),本脚本只负责存量:
 *
 *   1. 逐行读 title + metadata.originalTitle + 首条用户消息;
 *   2. 用同一份 plainTitleText 判定/清洗(不引入第二套规则,§0.6 单一真相源);
 *   3. 清洗后为空(整条都是思考残渣)⇒ 改用首条用户消息兜底,再空则回落「新对话」,
 *      让 auto-title 在下次发消息时按新规则重起;
 *   4. metadata.titleSource='manual'(用户手动改名)一律跳过 —— 用户起的名字不归我们改。
 *
 * 用法(默认 dry-run,只报数不写):
 *   pnpm --filter @ihui/api exec tsx scripts/clean-dirty-conversation-titles.ts
 *   pnpm --filter @ihui/api exec tsx scripts/clean-dirty-conversation-titles.ts --apply
 * 连库串只从 DATABASE_URL 取,不打印、不落日志。
 */

const APPLY = process.argv.includes('--apply')
/** 与 conversation-title.ts 的 TITLE_MAX_CHARS 同档(标题栏就按这个字数排) */
const TITLE_MAX_CHARS = 24
/** 与 schema 默认值一致:兜底不出可读标题时回落到它,auto-title 会再次接管 */
const DEFAULT_TITLE = '新对话'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('[clean-title] 未判定: 缺少 DATABASE_URL(本脚本不读 .env,连库串由调用方注入)')
  process.exit(2)
}

const sql = postgres(url, { max: 1 })

interface Row {
  id: string
  title: string
  metadata: Record<string, unknown> | null
  first_user: string | null
}

interface Plan {
  id: string
  before: string
  after: string
  metadata: Record<string, unknown>
  originalChanged: boolean
}

/** 读全量(会话量有限;这里刻意不用分页游标,一次读以保证判定集完整) */
const rows = await sql<Row[]>`
  select c.id,
         c.title,
         c.metadata,
         (select m.content
            from chat_messages m
           where m.conversation_id = c.id
             and m.role = 'user'
           order by m.created_at asc
           limit 1) as first_user
    from chat_conversations c
`

const plans: Plan[] = []
let skippedManual = 0
let dirtyCount = 0

for (const row of rows) {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>
  // 用户手动改名:名字归用户,一个字符都不动
  if (metadata['titleSource'] === 'manual') {
    skippedManual++
    continue
  }
  // 判定面用"不截断"的净化结果:只有**符号被剥掉 / 整条是思考残渣**才算脏。
  // 干净但超过 24 字的历史标题一律不动 —— 那是正常内容,截断是内容损失不是修复。
  const plain = plainTitleText(row.title, 0)
  const fallback = plain
    ? plain.length > TITLE_MAX_CHARS
      ? plain.slice(0, TITLE_MAX_CHARS).trim()
      : plain
    : ((row.first_user ? plainTitleText(row.first_user, TITLE_MAX_CHARS) : null) ?? DEFAULT_TITLE)
  if (plain === row.title) continue
  dirtyCount++
  const rawOriginal =
    typeof metadata['originalTitle'] === 'string' ? metadata['originalTitle'] : null
  const nextOriginal = rawOriginal ? plainTitleText(rawOriginal, TITLE_MAX_CHARS) : null
  const nextMetadata = { ...metadata }
  const originalChanged = Boolean(rawOriginal && nextOriginal && nextOriginal !== rawOriginal)
  if (nextOriginal && originalChanged) nextMetadata['originalTitle'] = nextOriginal
  plans.push({
    id: row.id,
    before: row.title,
    after: fallback,
    metadata: nextMetadata,
    originalChanged,
  })
}

console.log(
  `[clean-title] 扫描 ${rows.length} 条会话, 脏标题 ${dirtyCount} 条, 跳过手动改名 ${skippedManual} 条, 模式 ${
    APPLY ? 'apply' : 'dry-run'
  }`,
)

for (const plan of plans.slice(0, 10)) {
  console.log(
    `  · ${plan.id}  「${plan.before}」 → 「${plan.after}」${plan.originalChanged ? ' (含原始标题)' : ''}`,
  )
}
if (plans.length > 10) console.log(`  … 其余 ${plans.length - 10} 条省略`)

if (!APPLY) {
  console.log('[clean-title] dry-run 结束;确认无误后加 --apply 写回')
  await sql.end()
  process.exit(0)
}

let updated = 0
let held = 0
for (const plan of plans) {
  // CAS:只在 title 仍是扫描时那一份时才写,避免覆盖扫描后被用户/自动任务改掉的新值。
  // metadata 走 JSON.stringify + ::jsonb(而非 sql.json):后者不接受 Record<string, unknown>
  // 的宽类型,而这份 metadata 本来就是未定形状的用户态字段。
  const res = await sql`
    update chat_conversations
       set title = ${plan.after},
           metadata = ${JSON.stringify(plan.metadata)}::jsonb,
           updated_at = now()
     where id = ${plan.id}
       and title = ${plan.before}
  `
  if (res.count > 0) updated++
  else held++
}

console.log(`[clean-title] 写回 ${updated} 条, 因并发变化保持原值 ${held} 条`)
await sql.end()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
