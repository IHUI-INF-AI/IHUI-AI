// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ============================================================================
// pre-migrate-fresh-db-guard.mjs —— drizzle-kit migrate 之前的"从零库形状守卫"
//
// 2026-10-18 Real DB Integration Tests「Apply migrations to test DB」连续红的根修。
//
// 根因:
//   迁移 20261018160000_agent_state_tables_runtime_reality.sql(已注册进 journal,
//   从零链路必跑)对 agent_meta_lessons / agent_federated_lessons 的 id 做
//   `ALTER COLUMN "id" TYPE bigint USING "id"::text::bigint`。它按**生产库现状**写成
//   no-op(生产上这两表 id 已是 bigint/serial);但 0000 初始迁移在**全新库**建的是
//   uuid(agent_federated_lessons.id 还带 gen_random_uuid() 默认值)→
//   PG 42804 "default for column \"id\" cannot be cast automatically to type bigint",
//   且 drizzle-kit migrate 只 exit 1、**不打任何原因**(与 db-from-zero-migrate.yml
//   头注 42701 先例同型)。dev/生产库永远不踩,CI 从零库必踩。
//
// 修法(迁移文件与 journal 不可变,只动"从零库的初始形状"):
//   工作流用两遍迁移:第一遍 drizzle-kit migrate 把 idx 1..324 逐条落库
//   (每条迁移独立提交;325 失败回滚属预期);本守卫随即把全新库上 uuid 形状的
//   两张 id 收敛成迁移与 TS schema(schema/agent-state.ts: bigserial)共同期望的
//   形状 —— bigint + 独立序列默认值;第二遍 migrate 里 idx 325 的 ALTER TYPE bigint
//   变回真 no-op,链路完整走通。
//
// 幂等/安全:
//   · id 已是 bigint(生产/dev/已迁移库)→ 逐表 no-op,零写入。
//   · id 是 uuid 但表里有非 NULL 行 → 显式 exit 1 拒绝盲转(uuid 值不可能转 bigint),
//     不重演"静默半迁移"。
//   · 全部语句可重复执行(SEQUENCE IF NOT EXISTS / DEFAULT SET 覆盖)。
// ============================================================================

import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('[fresh-db-guard] DATABASE_URL 未设置,拒绝猜测连接目标')
  process.exit(1)
}

// 迁移 20261018160000 与 schema/agent-state.ts 双方都期望 id 为 bigint 的两张表
const TARGETS = [
  { table: 'agent_meta_lessons', seq: 'agent_meta_lessons_id_seq' },
  { table: 'agent_federated_lessons', seq: 'agent_federated_lessons_id_seq' },
]

const sql = postgres(url, { max: 1 })

let acted = 0
try {
  for (const { table, seq } of TARGETS) {
    const col = await sql`
      SELECT data_type, column_default
      FROM information_schema.columns
      WHERE table_name = ${table} AND column_name = 'id'
    `
    if (col.length === 0) {
      console.log(`[fresh-db-guard] ${table}.id 不存在,跳过(由迁移链自行处置)`)
      continue
    }
    const { data_type: dataType, column_default: columnDefault } = col[0]

    // id 已是 bigint:迁移的 ALTER TYPE 即为 no-op,守卫零动作
    if (dataType === 'bigint') {
      console.log(`[fresh-db-guard] ${table}.id 已是 bigint,无需守卫`)
      continue
    }
    // 只处理"0000 初始迁移建出的 uuid 形状"这一种偏离;其余类型交由迁移链报错
    if (dataType !== 'uuid') {
      console.log(`[fresh-db-guard] ${table}.id 是 ${dataType},不在守卫范围,跳过`)
      continue
    }

    // uuid 库里居然有非 NULL 行:值域无法转 bigint,拒绝盲转,给出可读错误
    const nonNull = await sql`SELECT count(*)::int AS n FROM ${sql(table)} WHERE id IS NOT NULL`
    if (nonNull[0].n > 0) {
      console.error(
        `[fresh-db-guard] ${table}.id 是 uuid 且已有 ${nonNull[0].n} 行非 NULL 数据,` +
          `无法收敛为 bigint;请人工核对数据来源后再处置`,
      )
      process.exit(1)
    }

    // ① 先摘默认值:gen_random_uuid()(uuid 型)无法自动 cast 成 bigint,是 42804 的直接来源
    if (columnDefault) {
      await sql.unsafe(`ALTER TABLE "${table}" ALTER COLUMN "id" DROP DEFAULT`)
    }
    // ② 空表上把 uuid 收敛为 bigint(USING 仅对行求值,0 行不求值)
    await sql.unsafe(
      `ALTER TABLE "${table}" ALTER COLUMN "id" TYPE bigint USING NULLIF("id"::text, '')::bigint`,
    )
    // ③ 补上 TS schema(bigserial)期望的序列默认值,避免迁移后"无默认的裸 bigint"
    await sql.unsafe(`CREATE SEQUENCE IF NOT EXISTS "${seq}" AS bigint`)
    await sql.unsafe(
      `ALTER TABLE "${table}" ALTER COLUMN "id" SET DEFAULT nextval('${seq}'::regclass)`,
    )
    await sql.unsafe(`ALTER SEQUENCE "${seq}" OWNED BY "${table}"."id"`)
    acted++
    console.log(`[fresh-db-guard] ${table}.id: uuid → bigserial 收敛完成(0 行,无损)`)
  }

  // ④ dp_noise_added:idx 184 给 agent_federated_lessons 建的是 real,而 idx 325 的
  //   `USING "dp_noise_added"::boolean` 没有 real→boolean cast(42846 "cannot cast
  //   type real to boolean")。收敛为 boolean(空表 USING 不求值;::int::boolean
  //   保证表达式可解析)。agent_meta_lessons 在从零库缺该列,由 325 的
  //   ADD COLUMN IF NOT EXISTS 自行补齐,无需此处处理,但一并纳入守卫以兜底。
  const BOOL_COLS = ['agent_federated_lessons', 'agent_meta_lessons']
  for (const table of BOOL_COLS) {
    const col = await sql`
      SELECT data_type, column_default
      FROM information_schema.columns
      WHERE table_name = ${table} AND column_name = 'dp_noise_added'
    `
    if (col.length === 0 || col[0].data_type === 'boolean') continue
    if (col[0].column_default) {
      await sql.unsafe(`ALTER TABLE "${table}" ALTER COLUMN "dp_noise_added" DROP DEFAULT`)
    }
    await sql.unsafe(
      `ALTER TABLE "${table}" ALTER COLUMN "dp_noise_added" TYPE boolean ` +
        `USING NULLIF("dp_noise_added"::int, 0)::boolean`,
    )
    await sql.unsafe(
      `ALTER TABLE "${table}" ALTER COLUMN "dp_noise_added" SET DEFAULT false`,
    )
    acted++
    console.log(
      `[fresh-db-guard] ${table}.dp_noise_added: ${col[0].data_type} → boolean 收敛完成`,
    )
  }

  // ⑤ source_skills:idx 179 给 agent_meta_lessons 建的是 text[](带 text[] 默认值),
  //   idx 325 的 `ALTER TYPE jsonb USING to_jsonb(...)` 无法把 text[] 默认值自动
  //   cast 成 jsonb(42804,与 id 同型)。收敛为 jsonb + '[]'::jsonb 默认值,
  //   与 TS schema jsonb('source_skills').default([]) 对齐。
  {
    const col = await sql`
      SELECT data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'agent_meta_lessons' AND column_name = 'source_skills'
    `
    if (col.length > 0 && col[0].data_type === 'ARRAY') {
      if (col[0].column_default) {
        await sql.unsafe(
          `ALTER TABLE "agent_meta_lessons" ALTER COLUMN "source_skills" DROP DEFAULT`,
        )
      }
      await sql.unsafe(
        `ALTER TABLE "agent_meta_lessons" ALTER COLUMN "source_skills" TYPE jsonb ` +
          `USING to_jsonb("source_skills")`,
      )
      await sql.unsafe(
        `ALTER TABLE "agent_meta_lessons" ALTER COLUMN "source_skills" SET DEFAULT '[]'::jsonb`,
      )
      acted++
      console.log('[fresh-db-guard] agent_meta_lessons.source_skills: text[] → jsonb 收敛完成')
    }
  }

  console.log(`[fresh-db-guard] 完成,收敛项数=${acted}`)
} finally {
  await sql.end()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
