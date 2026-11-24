// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/*
G-815927 的**行为验证器**:在一次性临时库里把这枚迁移真的跑一遍,断言七件事。

为什么要有它(而不是只写 drizzle schema + 手写 .sql 就交付):
 · 离线判据(守门 49 B1–B5)只核 journal ↔ .sql 的**结构**,核不出 `RAISE EXCEPTION 'a' || 'b'`
   这种 PL/pgSQL 语法错 —— 实测第一版就是这么写的,任何库上都会 `syntax error at or near "||"`,
   而离线档一路 rc=0。**一枚从没被真的执行过的迁移文件,和一枚能用的迁移文件,在账面上长得一模一样。**
 · 键的选择同样只有真跑才答得出:`(platform, platform_message_id)` 这种"看起来对"的简化会把
   同一条消息的出站回执与入站镜像判成重复(平台 id 空间共用),也会把两个用户各自绑定同一租户时
   推来的同一条消息判成重复 ⇒ 表现为"webhook 收得到但库里落不下"。所以正反对照里必须各有一格
   "不同 direction / 不同 user 必须**允许**"。

隔离纪律(§5 测试隔离铁律):
 · 只用 DSN 的 host/port/凭据,库名一律换成 `ihui_g815927_probe` 这种带 probe 前缀的一次性库;
   库名不是 `ihui`(开发库)时**直接判未判定**,不猜它是不是生产;
 · 全程不碰 8810/8811(生产 PG/Redis 约定端口),`finally` 里必须 DROP,失败也要报残留;
 · 没有可连的 PG ⇒ 打印 `UNDetermined:` 并 **exit 2**,绝不把"没跑到"记成"跑过了"。

用法:`node packages/database/scripts/im-messages-unique-index-probe.mjs`
*/
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PKG_DIR = resolve(HERE, '..')
const REPO_ROOT = resolve(PKG_DIR, '..', '..')
const MIGRATION = join(PKG_DIR, 'drizzle', '20261002033500_im_messages_platform_msg_unique.sql')
const TMPDB = 'ihui_g815927_probe'
const DEV_DB_NAME = 'ihui'

/** 依赖解析:本文件不在 apps/api 的依赖图里,按绝对路径取那份 postgres 真身。 */
async function loadDriver() {
  const candidate = join(REPO_ROOT, 'apps', 'api', 'node_modules', 'postgres', 'src', 'index.js')
  let mod
  try {
    mod = await import(pathToFileURL(candidate).href)
  } catch (e) {
    return { ok: false, reason: '取不到 postgres 驱动(' + candidate + '):' + String(e.message).split('\n')[0] }
  }
  return { ok: true, postgres: mod.default }
}

/** 只读地取 DSN;库名必须是开发库 ihui,否则不敢借它的连接面。envText 省略时读 apps/api/.env。 */
function readDsn(envText = null) {
  const envPath = join(REPO_ROOT, 'apps', 'api', '.env')
  let env = envText
  if (env === null) {
    try {
      env = readFileSync(envPath, 'utf8')
    } catch (e) {
      return { ok: false, reason: '取不到 apps/api/.env:' + String(e.message).split('\n')[0] }
    }
  }
  const raw = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim().replace(/^"|"$/g, '')
  if (!raw) return { ok: false, reason: 'apps/api/.env 里没有 DATABASE_URL' }
  let url
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: 'DATABASE_URL 不是可解析的 URL' }
  }
  if (url.pathname.replace(/^\//, '') !== DEV_DB_NAME) {
    return { ok: false, reason: `DSN 的库名是 ${url.pathname.replace(/^\//, '')},不是预期的 ${DEV_DB_NAME} ⇒ 判未判定,不拿它当临时库底座` }
  }
  return { ok: true, url, withDb: (db) => { const u = new URL(raw); u.pathname = '/' + db; return u.toString() } }
}

async function main() {
  const drv = await loadDriver()
  if (!drv.ok) return { verdict: 'undetermined', reason: drv.reason }
  const dsn = readDsn()
  if (!dsn.ok) return { verdict: 'undetermined', reason: dsn.reason }
  const postgres = drv.postgres

  let migrationText
  try {
    migrationText = readFileSync(MIGRATION, 'utf8')
  } catch (e) {
    return { verdict: 'undetermined', reason: '取不到迁移文件:' + String(e.message).split('\n')[0] }
  }

  const checks = []
  const admin = postgres(dsn.withDb('postgres'), { max: 1 })
  let sql = null
  try {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${TMPDB}`)
    await admin.unsafe(`CREATE DATABASE ${TMPDB}`)
    sql = postgres(dsn.withDb(TMPDB), { max: 1 })
  } catch (e) {
    await admin.end({ timeout: 5 })
    if (sql) await sql.end({ timeout: 5 })
    return { verdict: 'undetermined', reason: '本机 PG 不可达或无权建库:' + String(e.message).split('\n')[0] }
  }

  const U1 = '11111111-1111-1111-1111-111111111111'
  const U2 = '22222222-2222-2222-2222-222222222222'
  const ins = (u, dir, pid) =>
    sql`insert into im_messages (user_id, platform, direction, platform_message_id)
              values (${u}, 'feishu', ${dir}, ${pid})`
  try {
    await sql.unsafe(`CREATE TABLE im_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        platform varchar(32) NOT NULL,
        direction varchar(16) NOT NULL,
        chat_id varchar(255),
        platform_message_id varchar(255),
        content text,
        raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        delivery_status varchar(16) DEFAULT 'sent',
        error_message text,
        created_at timestamptz NOT NULL DEFAULT now())`)

    await ins(U1, 'inbound', 'om_same')
    await ins(U1, 'outbound', 'om_same') // 反例:同 pid 不同方向 ⇒ 必须允许
    await ins(U2, 'inbound', 'om_same') // 反例:同 pid 不同用户 ⇒ 必须允许
    await ins(U1, 'inbound', null)
    await ins(U1, 'inbound', null) // 两行 NULL ⇒ PG 默认 NULL 互不相等,必须允许

    const applied = await sql.unsafe(migrationText).then(() => true, (e) => 'FAIL:' + String(e.message).split('\n')[0])
    checks.push(['① 无重复时迁移整体应用', applied === true])
    const idx = await sql`select 1 from pg_indexes where tablename='im_messages' and indexname='im_messages_user_platform_direction_msg_key'`
    checks.push(['② 唯一索引已建', idx.length === 1])

    const dup = await ins(U1, 'inbound', 'om_same').then(() => 'ACCEPTED', (e) => (String(e.code) === '23505' ? 'REJECTED-23505' : 'REJECTED-' + e.code))
    checks.push(['③ 同键二次插入被约束拒绝', dup === 'REJECTED-23505'])
    const cnt = await sql`select count(*)::int n from im_messages`
    checks.push(['④ 被拒后行数不变(未落脏行)', cnt[0].n === 5])
    const again = await sql.unsafe(migrationText).then(() => true, () => false)
    checks.push(['⑤ 同一迁移重放第二次仍幂等', again === true])

    // 反向对照:先摘索引才能造出真重复(索引在位时根本插不进重复行,顺序不能反)
    await sql.unsafe('DROP INDEX im_messages_user_platform_direction_msg_key')
    await ins(U1, 'inbound', 'om_dup')
    await ins(U1, 'inbound', 'om_dup')
    const dirty = await sql`select count(*)::int n from im_messages where user_id=${U1} and direction='inbound' and platform_message_id='om_dup'`
    checks.push(['⑥a 反向对照前置:确有 2 行同键', dirty[0].n === 2])
    const guarded = await sql.unsafe(migrationText).then(
      () => 'NOT-RAISED',
      (e) => (/G-815927 前置体检未通过/.test(String(e.message)) ? 'RAISED' : 'WRONG-TEXT'),
    )
    checks.push(['⑥ 存在重复时按设计抛体检异常', guarded === 'RAISED'])
    const afterFail = await sql`select count(*)::int n from pg_indexes where indexname='im_messages_user_platform_direction_msg_key'`
    checks.push(['⑦ 体检失败后索引未被创建(失败即不落地)', afterFail[0].n === 0])
  } catch (e) {
    checks.push(['致命错误', ''])
    console.log('  致命:' + String(e.message).split('\n')[0])
  } finally {
    await sql.end({ timeout: 5 })
    try {
      await admin.unsafe(`DROP DATABASE IF EXISTS ${TMPDB}`)
      console.log('临时库已回收: DROP ' + TMPDB)
    } catch (e) {
      console.log('⚠️ 临时库回收失败 ⇒ 需人工确认残留 ' + TMPDB + ':' + String(e.message).split('\n')[0])
    }
    await admin.end({ timeout: 5 })
  }

  for (const [name, pass] of checks) console.log(`${name} = ${pass === true ? 'PASS' : 'FAIL(' + pass + ')'}`)
  const failed = checks.filter((c) => c[1] !== true)
  const ranAll = checks.length >= 8 && !checks.some((c) => c[0] === '致命错误')
  if (!ranAll) return { verdict: 'undetermined', reason: '七条判据没全部跑到(只跑了 ' + checks.length + ' 条)' }
  return { verdict: failed.length === 0 ? 'pass' : 'fail', failed: failed.map((f) => f[0]) }
}

// §22d 双形态入口:被测试 import 时**绝不**跑真库,直接执行时才跑。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const out = await main()
  if (out.verdict === 'undetermined') {
    console.log('UNDetermined: ' + out.reason)
    process.exit(2)
  }
  if (out.verdict === 'fail') {
    console.log('判定:未通过 —— ' + out.failed.join(' / '))
    process.exit(1)
  }
  console.log('判定:通过(七条全绿,含两条反向对照)')
}

// §22c:判据只有一份 —— 测试 import 这些出口,不得在测试里复制 readDsn 的规则。
export const __test__ = { readDsn, loadDriver, main, MIGRATION, TMPDB, DEV_DB_NAME, isDirectRun }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
