import postgres from 'postgres'

const DEV_URL = 'postgresql://postgres:postgres@localhost:5432/ihui'
const TEST_URL = 'postgresql://postgres:postgres@localhost:5432/ihui_test'

async function checkDb(url, name) {
  const sql = postgres(url, { max: 1, connect_timeout: 5 })
  try {
    const [r] = await sql`SELECT version() as v, current_database() as db`
    console.log(`[OK] ${name}: connected, db=${r.db}`)
    return true
  } catch (e) {
    console.error(`[FAIL] ${name}: ${e.message}`)
    return false
  } finally {
    await sql.end({ timeout: 2 })
  }
}

await checkDb(DEV_URL, 'dev ihui')
await checkDb(TEST_URL, 'test ihui_test')
