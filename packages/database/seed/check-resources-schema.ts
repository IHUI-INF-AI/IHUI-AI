import postgres from 'postgres'

const url = 'postgres://postgres:postgres@localhost:5432/ihui'
const sql = postgres(url, { max: 1 })

// resources 表列
const cols = await sql`
  SELECT column_name, data_type, character_maximum_length
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'resources'
  ORDER BY ordinal_position
`
console.log(`resources columns: ${cols.length}`)
for (const c of cols) {
  console.log(
    `  ${c.column_name} | ${c.data_type}${c.character_maximum_length ? `(${c.character_maximum_length})` : ''}`,
  )
}

const expected = [
  'id',
  'title',
  'cover_image',
  'intro',
  'category_id',
  'file_url',
  'file_type',
  'file_size',
  'is_published',
  'view_count',
  'download_count',
  'sort',
  'status',
  'type',
  'product_id',
  'tag_id_list',
  'image',
  'introduction',
  'cid_list',
  'created_at',
  'updated_at',
]
const current = new Set(cols.map((c) => c.column_name))
const missing = expected.filter((f) => !current.has(f))
console.log(`\nMissing fields: ${missing.length ? missing.join(', ') : 'NONE'}`)

// 同样检查 circles, lessons, live_channels, news_articles
for (const t of ['circles', 'lessons', 'live_channels', 'news_articles']) {
  const c = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${t}
  `
  console.log(`\n${t}: ${c.length} columns`)
  // 是否有 cover_image / cover
  const has = (n: string) => c.some((x) => x.column_name === n)
  console.log(`  cover_image: ${has('cover_image')}, cover: ${has('cover')}`)
}

await sql.end()
