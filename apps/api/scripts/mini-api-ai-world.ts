/**
 * 临时 mini api 入口:仅挂载 ai-world routes,绕过 clawdbot 模块加载问题。
 * 用于 browser_use 4 状态验证。验证完成后可删除。
 */
import 'dotenv/config'
import Fastify from 'fastify'
import { aiWorldRoutes } from '../src/routes/ai-world.js'
import { success } from '../src/utils/response.js'

const PORT = 3001
const HOST = '0.0.0.0'

async function main() {
  const app = Fastify({ logger: true })

  // CORS(允许 web 端 3000 访问)
  await app.register(import('@fastify/cors'), {
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  })

  // 健康检查
  app.get('/health', async (_req, reply) => reply.send(success({ status: 'ok' })))

  // ai-world routes
  await app.register(aiWorldRoutes)

  await app.listen({ port: PORT, host: HOST })
  app.log.info(`mini-api listening on http://${HOST}:${PORT}`)
}

main().catch((e) => {
  console.error('mini-api failed:', e)
  process.exit(1)
})
