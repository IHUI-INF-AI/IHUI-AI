// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { config as dotenvConfig } from 'dotenv'
import { randomBytes } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 测试环境启动时加载 .env.test,与生产/开发的 .env 完全隔离
// dotenv 默认不覆盖已有 env(vitest 会注入 NODE_ENV=test),只补缺失项
// 落点由本文件自身位置推导(本文件恒在 apps/api/tests/),不信 cwd(§15):
// 旧版按 `cwd + 'apps/api/.env.test'` 兜底,当 cwd 已是 apps/api 时拼成
// apps/api/apps/api/.env.test(双拼,结构上永远命中不了)。
const envTestPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env.test')
const dotenvResult = dotenvConfig({ path: envTestPath })

// G-1105298(2026-10-09 诊断票)补的失败可见性 —— **不改任何取值、不放宽任何校验**。
// 现读事实(当轮量到):本机 `apps/api/.env.test` 不存在(该文件受 .gitignore,只在个别机器上),
// dotenv 因此返回 `{ parsed: undefined, error: ENOENT }` 并注入 0 条,而旧代码把返回值整个丢掉。
// 后果不是"这次跑不过",而是"下一次跑不过时无人知道值从哪来":此时全套件吃的都是下面几行的
// 兜底值,任一兜底值不合法 ⇒ `apps/api/src/config/index.ts` 的 envSchema 在**每个用例文件的
// import 链里** logger.error + process.exit(1),而 vitest 报出来的只有一帧用例文件顶层行。
// 已实测的对照:真正抛在 setup-env.ts 里的错,vitest 会如实打成 `tests/setup-env.ts:<行>:<列>`
// (探针 `undefined.config` → `❯ tests/setup-env.ts:13:18`)⇒ 反过来,"帧落在用例文件"
// 本身就是"抛错发生在 import 链而不在本文件"的证据。这一行把缺的是哪一份 env、由此谁兜底,
// 一次(每个 worker 进程一条)喊出来,下次同类事故不再需要靠猜。
if ((dotenvResult.error || !dotenvResult.parsed) && !process.env.IHUI_SETUP_ENV_WARNED) {
  process.env.IHUI_SETUP_ENV_WARNED = '1'
  console.error(
    `[setup-env] .env.test 未生效:${String(dotenvResult.error ?? 'dotenv 未返回 parsed')}` +
      ` (cwd=${process.cwd()} , 落点=${envTestPath})⇒ DATABASE_URL / JWT_SECRET / CREDENTIALS_ENCRYPTION_KEY / REDIS_URL ` +
      '取的是本文件兜底值;若收集期出现 config 相关 TypeError 或 "Invalid environment variables",' +
      ' 先核对这些兜底值能否过 apps/api/src/config/index.ts 的 envSchema。',
  )
}

// 测试专用 DB 兜底(2026-11-03 安全修复,与 Redis 同一条纪律):兜底必须是**确认无人监听**的哨兵。
// 旧值 postgresql://postgres:postgres@localhost:8810/ihui_test 里的 8810 是生产 PostgreSQL 的
// 宿主映射端口(docker-compose.yml:301 `127.0.0.1:${DB_PORT:-8810}:5432`;
// docs/PRODUCTION_INFRASTRUCTURE.md:154),而 AGENTS.md §5 明令「测试一律禁止连生产库
// (PG 8810/Redis 8811)」。.env.test 受 .gitignore 不入库(本机与 CI 都没有)⇒ 旧兜底会让
// 默认面测试在产线机/带 8810 隧道的开发机上对生产库真建池;*.real.test.ts 更会直接
// SELECT 1 + TRUNCATE。db mock 只挡得住"用例自己查库",挡不住 import 期建池。
// 为什么不像 Redis 那样"缺失即抛错":本文件是默认测试面唯一的 DATABASE_URL 来源,
// CI 只注入 5432 的 DATABASE_URL;抛错会让所有 import src/config 的用例在收集期整体
// exit —— 那是让测试面不可用,不是安全。哨兵保证 config 解析得过,但真连接立即
// ECONNREFUSED。5399:紧邻默认 5432、本机(Get-NetTCPConnection)与 CI service 均无监听,
// 且不在 scripts/dev-port-registry.json 的认领段内。需要真库的用例必须显式给测试实例
// (CI 走 5432 的 ihui_test,本地走 .env.test)。
const TEST_DATABASE_FALLBACK_URL = 'postgresql://postgres:postgres@127.0.0.1:5399/ihui_test'
process.env.DATABASE_URL ??= TEST_DATABASE_FALLBACK_URL
// 密钥兜底必须是强随机值:config 的弱密钥加固(2026-07-21)拒绝 'test-' 前缀/全同字符/已知占位符,
// 弱兜底会让导入真 config 的零连接测试在干净检出上 import 即崩(config 进程 exit(1))。
// 每次进程内随机生成,不落盘 —— 零连接测试不依赖具体值。
process.env.JWT_SECRET ??= randomBytes(32).toString('hex')
process.env.CREDENTIALS_ENCRYPTION_KEY ??= randomBytes(32).toString('hex')
// 测试专用 Redis 兜底(2026-11-03 安全修复):兜底必须是**确认无人监听**的哨兵地址。
// 旧值 redis://localhost:8811/1 是生产 Redis 的宿主映射端口(docker-compose.yml:339
// `127.0.0.1:${REDIS_PORT:-8811}:6379`;docs/PRODUCTION_INFRASTRUCTURE.md:155),
// 测试若跑在产线机或带 8811 隧道的开发机上,auth 吊销名单/按用户限流就会对生产 db1
// 真写 EXISTS/INCR。
// 为什么选"不可用哨兵"而不是"缺失即抛错":本文件是默认测试面唯一的 REDIS_URL 来源,
// 仓库内 .env.test 受 .gitignore 不入库、CI 也不注入 REDIS_URL;直接抛错会让默认面
// 1123 个用例中所有 import src/config 的文件在收集期整体 exit —— 那是让测试面不可用,
// 不是安全。为什么不自建测试实例:仓库既无 TEST_REDIS_URL 也无 docker-compose.test.yml
// 约定,唯一 Redis 服务就是生产 compose 的 ihui-redis,自造实例会给 CI 添新依赖。
// 6399:紧邻 6379 但本机与 CI 均无监听,任何真实连接立即 ECONNREFUSED,静默写生产
// 的路径被结构性切断。需要真实 Redis 行为的用例必须显式配置专用测试实例的 REDIS_URL,
// 或照 tests/helpers/fake-redis.ts vi.mock('ioredis')。
const TEST_REDIS_FALLBACK_URL = 'redis://127.0.0.1:6399/1'
process.env.REDIS_URL ??= TEST_REDIS_FALLBACK_URL

// 生产落点硬闸(不区分 CI/本地):即使 REDIS_URL 由 shell 或 .env.test 显式给出,
// 测试档也拒绝 8811。8811 是生产 Redis 的宿主映射端口(同上证据行),按端口而非主机判定,
// 是为了把 127.0.0.1 / localhost / SSH 隧道域名等所有等价入口一起拦住。
// 抛错发生在本文件 ⇒ vitest 会如实打成 `tests/setup-env.ts:<行>`,不会被各业务的
// Redis fail-open 逻辑吞成"测试静默通过"。不使用 if (CI) 之类的条件,本地与 CI 同一条闸。
const redisUrlRaw = process.env.REDIS_URL ?? ''
const parsedRedisUrl = (() => {
  try {
    return new URL(redisUrlRaw)
  } catch {
    // 空串/非法 URL 不允许静默落到任何默认值:直接点名停手。
    throw new Error(
      `[setup-env] REDIS_URL 不是合法 URL(${JSON.stringify(redisUrlRaw)});测试档拒绝继续。` +
        '请 unset REDIS_URL(默认走不可用哨兵 127.0.0.1:6399),或显式指向专用测试实例。',
    )
  }
})()
if (Number(parsedRedisUrl.port || 6379) === 8811) {
  throw new Error(
    `[setup-env] 拒绝在测试中连接生产 Redis(${redisUrlRaw})。` +
      '8811 是生产 Redis 的宿主映射端口(docker-compose.yml:339 / docs/PRODUCTION_INFRASTRUCTURE.md:155),' +
      'AGENTS.md §5 明令测试禁止连生产库。请 unset REDIS_URL(默认走不可用哨兵 127.0.0.1:6399),' +
      '或显式指向专用测试实例;需要 Redis 行为的用例请照 tests/helpers/fake-redis.ts mock ioredis。',
  )
}
if (
  process.env.REDIS_URL === TEST_REDIS_FALLBACK_URL &&
  !process.env.IHUI_TEST_REDIS_FALLBACK_WARNED
) {
  process.env.IHUI_TEST_REDIS_FALLBACK_WARNED = '1'
  console.warn(
    '[setup-env] REDIS_URL 未配置,已使用不可用哨兵 127.0.0.1:6399(生产 8811 不再作为兜底)。' +
      '任何真实 Redis 连接都会 ECONNREFUSED;需要 Redis 行为的用例请显式配置测试实例或 vi.mock("ioredis")。',
  )
}
// 生产 DB 落点硬闸(不区分 CI/本地,与 Redis 同一条纪律):即使 DATABASE_URL 由 shell 或
// .env.test 显式给出,测试档也拒绝 8810。按端口判定(缺省按 PostgreSQL 默认 5432 补位),
// 127.0.0.1 / localhost / SSH 隧道域名等所有等价入口一网打尽。抛错发生在本文件 ⇒ vitest
// 会如实打成 `tests/setup-env.ts:<行>`,不会被 db 层的连接重试吞成"测试静默通过"。
const databaseUrlRaw = process.env.DATABASE_URL ?? ''
const parsedDatabaseUrl = (() => {
  try {
    return new URL(databaseUrlRaw)
  } catch {
    // 空串/非法 URL 不允许静默落到任何默认值:直接点名停手。
    throw new Error(
      `[setup-env] DATABASE_URL 不是合法 URL(${JSON.stringify(databaseUrlRaw)});测试档拒绝继续。` +
        '请 unset DATABASE_URL(默认走不可用哨兵 127.0.0.1:5399),或显式指向专用测试实例。',
    )
  }
})()
if (Number(parsedDatabaseUrl.port || 5432) === 8810) {
  throw new Error(
    `[setup-env] 拒绝在测试中连接生产 PostgreSQL(${databaseUrlRaw})。` +
      '8810 是生产 PostgreSQL 的宿主映射端口(docker-compose.yml:301 / docs/PRODUCTION_INFRASTRUCTURE.md:154),' +
      'AGENTS.md §5 明令测试禁止连生产库。请 unset DATABASE_URL(默认走不可用哨兵 127.0.0.1:5399),' +
      '或显式指向专用测试实例;默认面用例请 mock src/db,真实库用例走 test:real + .env.test。',
  )
}
if (
  process.env.DATABASE_URL === TEST_DATABASE_FALLBACK_URL &&
  !process.env.IHUI_TEST_DATABASE_FALLBACK_WARNED
) {
  process.env.IHUI_TEST_DATABASE_FALLBACK_WARNED = '1'
  console.warn(
    '[setup-env] DATABASE_URL 未配置,已使用不可用哨兵 127.0.0.1:5399(生产 8810 不再作为兜底)。' +
      '任何真实 DB 连接都会 ECONNREFUSED;需要真库的用例请显式配置测试实例(test:real + .env.test)。',
  )
}
// 测试档必须显式钉死:ZCODE_RUNTIME_ENV 优先级高于 NODE_ENV(config 唯一出口的解析顺序),
// 宿主 shell 若导出了 production(真机现测存在),真 config 的"生产守卫"会在测试里误开
// (如 agents.ts 的 COZE_WEBHOOK_SECRET 拒绝启动)。与下面 NODE_ENV 同性质:强制,非补缺。
process.env.ZCODE_RUNTIME_ENV = 'test'
process.env.NODE_ENV = 'test'
// 2026-10-28:管理员 TOTP 闸在测试档默认关掉。
// 理由不是"懒得测",而是既有 admin 路由测试大量使用**顺序队列式**的 DB mock
// (第 N 次 select 返回第 N 个夹具),TOTP 闸会多插一次 select ⇒ 整个队列错位、
// 与业务断言无关的 16 例一起红。档位语义本身的覆盖在 tests/admin-totp-gate.test.ts
// 里用 vi.mock(config) 显式跑 off/warn/enforce 三档,不依赖这个全局值。
// 需要在这条链上测 TOTP 行为的新用例,请照那个文件的做法 mock config,不要改这里。
process.env.ADMIN_TOTP_MODE = 'off'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
