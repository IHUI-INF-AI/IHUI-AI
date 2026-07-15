// API 端到端烟测:health / auth login / users me / admin stats
import http from 'node:http'
const HOST = '127.0.0.1'
const PORT = 3001

const req = (method, path, body, token) => new Promise((resolve, reject) => {
  const data = body ? JSON.stringify(body) : null
  const r = http.request({
    host: HOST, port: PORT, path, method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
    },
  }, (res) => {
    let d = ''
    res.on('data', c => d += c)
    res.on('end', () => {
      try { resolve({ status: res.statusCode, body: JSON.parse(d) }) }
      catch { resolve({ status: res.statusCode, body: d }) }
    })
  })
  r.on('error', reject)
  if (data) r.write(data)
  r.end()
})

const log = (label, r) => {
  const ok = r.status >= 200 && r.status < 400 ? '✅' : '❌'
  console.log(`${ok} ${label}: HTTP ${r.status}`)
  if (r.body && typeof r.body === 'object') {
    if (r.body.code !== undefined) console.log(`     code=${r.body.code} message=${r.body.message}`)
    if (r.body.data && typeof r.body.data === 'object') {
      const keys = Object.keys(r.body.data).slice(0, 8)
      console.log(`     data: { ${keys.join(', ')}${keys.length >= 8 ? ', ...' : ''} }`)
    }
  }
}

console.log('═'.repeat(60))
console.log(' API 端到端烟测')
console.log('═'.repeat(60))

try {
  const h = await req('GET', '/api/health')
  log('GET /api/health', h)

  const login = await req('POST', '/api/auth/login', { account: 'admin', password: 'admin123' })
  log('POST /api/auth/login (admin)', login)
  if (login.status !== 200) {
    console.log('登录失败,终止')
    process.exit(1)
  }
  const token = login.body.data?.accessToken ?? login.body.data?.token
  console.log(`     token 长度: ${token?.length ?? 0}`)

  const me = await req('GET', '/api/users/me', null, token)
  log('GET /api/users/me', me)
  if (me.body.data) {
    console.log(`     用户: id=${me.body.data.id} username=${me.body.data.username} isSystemAdmin=${me.body.data.isSystemAdmin}`)
  }

  const adminMe = await req('GET', '/api/admin/me', null, token)
  log('GET /api/admin/me', adminMe)

  const stats = await req('GET', '/api/admin/statistics/dashboard', null, token)
  log('GET /api/admin/statistics/dashboard', stats)

  const users = await req('GET', '/api/admin/users?page=1&pageSize=5', null, token)
  log('GET /api/admin/users (page 1, 5 items)', users)
  if (users.body.data?.list) {
    console.log(`     共 ${users.body.data.total} 个用户, 前 5:`)
    for (const u of users.body.data.list) {
      console.log(`       - id=${u.id} username=${u.username} status=${u.status} isSystemAdmin=${u.isSystemAdmin}`)
    }
  }

  console.log('═'.repeat(60))
  console.log('✅ 烟测完成')
} catch (e) {
  console.error('❌ 测试异常:', e)
  process.exit(1)
}
