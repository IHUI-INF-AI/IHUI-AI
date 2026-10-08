// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { config as dotenvConfig } from 'dotenv'
import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

// 测试环境启动时加载 .env.test,与生产/开发的 .env 完全隔离
// dotenv 默认不覆盖已有 env(vitest 会注入 NODE_ENV=test),只补缺失项
// 兼容两种 cwd:cd apps/api 或仓库根目录
const envTestPath = existsSync(resolve(process.cwd(), '.env.test'))
  ? resolve(process.cwd(), '.env.test')
  : resolve(process.cwd(), 'apps/api/.env.test')
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
      ` (cwd=${process.cwd()} , 试过的两个落点=${resolve(process.cwd(), '.env.test')} / ${resolve(
        process.cwd(),
        'apps/api/.env.test',
      ) })⇒ DATABASE_URL / JWT_SECRET / CREDENTIALS_ENCRYPTION_KEY / REDIS_URL ` +
      '取的是本文件兜底值;若收集期出现 config 相关 TypeError 或 "Invalid environment variables",' +
      ' 先核对这些兜底值能否过 apps/api/src/config/index.ts 的 envSchema。',
  )
}

// 测试专用 DB URL 兜底:防止 .env.test 加载失败时连接到开发库
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:8810/ihui_test'
// 密钥兜底必须是强随机值:config 的弱密钥加固(2026-07-21)拒绝 'test-' 前缀/全同字符/已知占位符,
// 弱兜底会让导入真 config 的零连接测试在干净检出上 import 即崩(config 进程 exit(1))。
// 每次进程内随机生成,不落盘 —— 零连接测试不依赖具体值。
process.env.JWT_SECRET ??= randomBytes(32).toString('hex')
process.env.CREDENTIALS_ENCRYPTION_KEY ??= randomBytes(32).toString('hex')
process.env.REDIS_URL ??= 'redis://localhost:8811/1'
// 测试档必须显式钉死:ZCODE_RUNTIME_ENV 优先级高于 NODE_ENV(config 唯一出口的解析顺序),
// 宿主 shell 若导出了 production(真机现测存在),真 config 的"生产守卫"会在测试里误开
// (如 agents.ts 的 COZE_WEBHOOK_SECRET 拒绝启动)。与下面 NODE_ENV 同性质:强制,非补缺。
process.env.ZCODE_RUNTIME_ENV = 'test'
process.env.NODE_ENV = 'test'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
