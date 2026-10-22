import postgres from 'postgres'
const url = process.env.API_DB ?? 'postgresql://ihui:postgres@localhost:5432/ihui'
let sqlc = postgres(url, { max: 1, prepare: false })
try {
  const [l] = await sqlc`select count(*)::int as n, count(*) filter (where is_published)::int as pub from lessons`
  const [s] = await sqlc`select count(*)::int as n from lesson_chapter_sections where video_url like 'https://test-for-dp%'`
  console.log('API_DB lessons=', JSON.stringify(l), 'legacy_sections_with_url=', JSON.stringify(s))
} catch (e) {
  console.log('ihui/ihui failed:', (e as Error).message.slice(0, 80))
  sqlc = postgres('postgres://postgres:postgres@localhost:5432/ihui', { max: 1, prepare: false })
  const [l] = await sqlc`select count(*)::int as n, count(*) filter (where is_published)::int as pub from lessons`
  const [s] = await sqlc`select count(*)::int as n from lesson_chapter_sections where video_url like 'https://test-for-dp%'`
  console.log('postgres/ihui lessons=', JSON.stringify(l), 'legacy_sections_with_url=', JSON.stringify(s))
}
process.exit(0)
