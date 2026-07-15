import postgres from 'postgres'

const url = 'postgresql://postgres:postgres@localhost:5432/ihui_test'
const s = postgres(url, { max: 1 })

try {
  const rows = await s`
    SELECT phone, email, role_id, is_system_admin
    FROM users
    WHERE phone LIKE '5%' OR email LIKE '5%@%'
    ORDER BY phone
  `
  console.log(`Users in ihui_test with phone/email starting with 5: ${rows.length}`)
  for (const r of rows) {
    console.log(`  phone=${r.phone} email=${r.email} role_id=${r.role_id} sysadmin=${r.is_system_admin}`)
  }

  // Check who owns the phone '5999' etc
  const dup = await s`
    SELECT phone, count(*)
    FROM users
    WHERE phone LIKE '5%'
    GROUP BY phone
    HAVING count(*) > 1
  `
  console.log(`Duplicates: ${dup.length}`)
  for (const d of dup) console.log(`  ${d.phone}: ${d.count}`)
} catch (e) {
  console.error('ERR:', e.message)
  process.exit(1)
} finally {
  await s.end({ timeout: 5 })
}
