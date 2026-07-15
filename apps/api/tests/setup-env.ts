import { config as dotenvConfig } from 'dotenv'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'

// 测试环境启动时加载 .env.test,与生产/开发的 .env 完全隔离
// dotenv 默认不覆盖已有 env(vitest 会注入 NODE_ENV=test),只补缺失项
// 兼容两种 cwd:cd apps/api 或仓库根目录
const envTestPath = existsSync(resolve(process.cwd(), '.env.test'))
  ? resolve(process.cwd(), '.env.test')
  : resolve(process.cwd(), 'apps/api/.env.test')
dotenvConfig({ path: envTestPath })

// 测试专用 DB URL 兜底:防止 .env.test 加载失败时连接到开发库
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/ihui_test'
process.env.JWT_SECRET ??= 'test-jwt-secret-at-least-32-characters-long!!'
process.env.REDIS_URL ??= 'redis://localhost:6379/1'
process.env.NODE_ENV = 'test'
