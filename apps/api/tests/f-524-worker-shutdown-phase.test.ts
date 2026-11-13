// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-524 回归锁:worker 侧必须能执行 auto-rollback 的关停相位。
 *
 * 缺陷(见 docs/tickets/2026-11/findings-api.md#F-524):
 *   startAutoRollbackMonitor() 在 buildServer() 内启动,但 stop 只在 API 进程入口
 *   index.ts 的关停相位调用;worker 只走 server.close() 的 onClose,没有 stop。
 *   而 auto-rollback 的 setInterval 非 unref ⇒ 若 onClose 挂起、process.exit 到不了,
 *   ref 定时器会钉住事件循环,worker 无法自然退出,只能等 SIGKILL。
 *   同类问题:registerPoolTrackerCleanup 只在 index.ts 注册(worker 无清理),
 *   worker-entry.ts 的 mock 支付网关句柄未保存(gateway 无 close 路径),
 *   server.close() 无超时(关停可无限挂起)。
 *
 * 修复:stopAutoRollbackMonitor 与 registerPoolTrackerCleanup(server) 移入 buildServer()
 *   的 onClose(worker 与 API 共用);setInterval 返回值 unref 兜底;worker-entry.ts 保存
 *   gateway 句柄并在 shutdown 关闭;server.close() 用 Promise.race + 超时常量兜底。
 *
 * 本锁为源码接线锁(与仓库 f-162/f-368 同型)。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(here, '..', '..', '..')
const serverSrc = readFileSync(resolve(REPO_ROOT, 'apps/api/src/server.ts'), 'utf8')
const arSrc = readFileSync(resolve(REPO_ROOT, 'apps/api/src/services/auto-rollback.ts'), 'utf8')
const workerSrc = readFileSync(resolve(REPO_ROOT, 'apps/api/src/worker-entry.ts'), 'utf8')
const indexSrc = readFileSync(resolve(REPO_ROOT, 'apps/api/src/index.ts'), 'utf8')

describe('F-524:worker 侧必须能执行 auto-rollback 关停相位', () => {
  it('接线锁:server.ts 同时 import start 与 stop', () => {
    expect(serverSrc).toMatch(
      /stopAutoRollbackMonitor,[\s\S]*?from '\.\/services\/auto-rollback\.js'/,
    )
  })

  it('缺陷锁:buildServer() 的 onClose 注册了 stopAutoRollbackMonitor', () => {
    const start = serverSrc.indexOf('startAutoRollbackMonitor()')
    expect(start).toBeGreaterThan(-1)
    const seg = serverSrc.slice(start, start + 600)
    expect(seg).toMatch(/server\.addHook\('onClose'/)
    expect(seg).toMatch(/stopAutoRollbackMonitor\(\)/)
  })

  it('缺陷锁:auto-rollback 的 setInterval 返回值必须 unref,不得钉住事件循环', () => {
    expect(arSrc).toMatch(/const handle = setInterval\(async \(\) => \{/)
    expect(arSrc).toMatch(/handle\.unref\(\)/)
    expect(arSrc).toMatch(/checkInterval = handle/)
    // unref 必须在赋值之前/同批,不能只对另一个定时器生效
    expect(arSrc.indexOf('handle.unref()')).toBeLessThan(arSrc.indexOf('checkInterval = handle'))
  })

  it('缺陷锁:buildServer() 内注册 registerPoolTrackerCleanup(server)', () => {
    const callIdx = serverSrc.indexOf('registerPoolTrackerCleanup(server)')
    expect(callIdx).toBeGreaterThan(-1)
    // 必须落在 buildServer() 内、return server 之前(worker 只走 buildServer)
    const returnIdx = serverSrc.indexOf('return server', callIdx)
    expect(returnIdx).toBeGreaterThan(callIdx)
  })

  it('缺陷锁:index.ts 不再重复注册 poolTracker 清理与 auto-rollback 停止相位', () => {
    expect(indexSrc).not.toMatch(/registerPoolTrackerCleanup/)
    expect(indexSrc).not.toMatch(/stopAutoRollbackMonitor/)
  })

  it('缺陷锁:worker-entry.ts 保存 gateway 句柄并在 shutdown 调 close()', () => {
    expect(workerSrc).toMatch(/let gatewayHandle: PaymentMockGatewayHandle \| null = null/)
    expect(workerSrc).toMatch(/gatewayHandle = await ensurePaymentMockGateway\(\)/)
    const shutdownIdx = workerSrc.indexOf('const shutdown = async')
    expect(shutdownIdx).toBeGreaterThan(-1)
    const seg = workerSrc.slice(shutdownIdx, shutdownIdx + 1200)
    expect(seg).toMatch(/gatewayHandle\?\.close\(\)/)
  })

  it('缺陷锁:worker-entry.ts 的 server.close() 有 Promise.race + 超时常量兜底', () => {
    expect(workerSrc).toMatch(/const SERVER_CLOSE_TIMEOUT_MS = 10_000/)
    const raceIdx = workerSrc.indexOf('Promise.race([')
    expect(raceIdx).toBeGreaterThan(-1)
    const seg = workerSrc.slice(raceIdx, raceIdx + 300)
    expect(seg).toMatch(/server\.close\(\)/)
    expect(seg).toMatch(/SERVER_CLOSE_TIMEOUT_MS/)
    // 超时定时器必须 unref,否则超时兜底本身会钉住事件循环
    const timerIdx = workerSrc.indexOf('closeTimer')
    expect(timerIdx).toBeGreaterThan(-1)
    expect(workerSrc.slice(timerIdx, timerIdx + 400)).toMatch(/closeTimer\.unref\(\)/)
  })

  it('对照锁:start 仍在 buildServer() 内(worker 经 buildServer 启动)', () => {
    expect(serverSrc).toMatch(/startAutoRollbackMonitor\(\)/)
  })
})
