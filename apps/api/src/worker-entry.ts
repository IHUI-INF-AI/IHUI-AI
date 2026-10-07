// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import 'dotenv/config'
import http from 'node:http'
import type { Worker } from 'bullmq'
import { buildServer } from './server.js'
import { startWorkers } from './workers/index.js'
import { startSchedulerWorker } from './workers/scheduler-worker.js'
import { initOtel } from './plugins/otel.js'
import { ensurePaymentMockGateway, isPaymentMockEnabled } from './services/payment-mock-gateway.js'

/**
 * Worker 独立进程入口。
 *
 * 使用场景:
 * - docker-compose worker service 独立部署
 * - 多实例部署时,API 进程仅生产(ENABLE_WORKER=false),Worker 进程独立消费
 * - 避免单进程内 HTTP 请求与异步任务互相阻塞
 *
 * 与 src/index.ts 的区别:
 * - 不监听业务 HTTP 端口(8801)
 * - 不触发生产环境微信支付配置检查(纯消费者无需支付配置)
 * - 仅启动 BullMQ Worker + Scheduler Worker
 * - 暴露最小 /health 端点(端口 8804)供 docker healthcheck / k8s liveness probe 探活
 *
 * 启动命令:node dist/worker-entry.js
 */
async function startWorkerProcess(): Promise<void> {
  initOtel()

  const server = await buildServer()

  const workers: Worker[] = startWorkers(server)
  const schedulerWorker: Worker = startSchedulerWorker(server)

  // 票 G-998162:本地真 HTTP mock 支付网关(联调验证档)。仅 IHUI_PAY_MOCK=1 时启动,
  // 不设环境变量时零影响。provider baseURL 注入走 WX_API_BASE(??= origin,显式配置优先);
  // 生产代码路径与联调完全一致,联调时删掉 IHUI_PAY_MOCK 开关即可。
  if (isPaymentMockEnabled()) {
    const gateway = await ensurePaymentMockGateway()
    if (gateway) {
      server.log.info(
        { origin: gateway.origin, external: gateway.external },
        'IHUI_PAY_MOCK payment mock gateway ready',
      )
    }
  }

  // 最小 HTTP /health 端点(端口 8804)供 docker healthcheck 探活
  // 不引入 fastify,用 node:http 极简实现,避免增加 worker 进程负担
  const healthPort = Number(process.env.WORKER_HEALTH_PORT ?? 8804)
  let workersRunning = true
  const healthServer = http.createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      const allRunning =
        workersRunning && workers.every((w) => !w.closing) && !schedulerWorker.closing
      res.writeHead(allRunning ? 200 : 503, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          status: allRunning ? 'ok' : 'shutting-down',
          workers: workers.length + 1,
        }),
      )
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'not found' }))
    }
  })
  healthServer.listen(healthPort, '0.0.0.0', () => {
    server.log.info({ port: healthPort }, 'Worker health endpoint listening')
  })

  server.log.info(
    {
      workers: workers.length + 1,
      mode: 'worker-only',
      healthPort,
    },
    '🚀 Worker process started',
  )

  const shutdown = async (signal: string) => {
    workersRunning = false
    server.log.info({ signal }, 'Worker process shutting down...')
    await Promise.allSettled([...workers.map((w) => w.close()), schedulerWorker.close()])
    healthServer.close()
    await server.close()
    process.exit(0)
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

startWorkerProcess().catch((err) => {
  console.error('Worker process failed to start:', err)
  process.exit(1)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
