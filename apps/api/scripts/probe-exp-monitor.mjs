import postgres from 'postgres'

const url = 'postgres://postgres:postgres@localhost:5432/ihui'
const sql = postgres(url, { max: 2, prepare: false })

try {
  const r = await sql`SELECT current_user, count(*)::int as n FROM zhs_agent_buy`
  console.log('OK:', r)
  const r2 = await sql`SELECT current_user, count(*)::int as n FROM agent_settlements`
  console.log('OK2:', r2)
} catch (e) {
  console.log('ERR:', e.message, '|', e.code, '|', e.severity)
} finally {
  await sql.end()
}
