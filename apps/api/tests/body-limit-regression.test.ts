// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Fastify from 'fastify'

const SRC = resolve(__dirname, '../src')
const SERVER_TS = resolve(SRC, 'server.ts')

/**
 * DDoS P2 收敛回归:2026-10-28 把全局请求体上限从 10MiB 收到 2MiB,
 * 并为所有上传/大体积路由显式放开 bodyLimit。本测试双保险:
 *   1) 静态断言 server.ts 全局值保持 2MiB、且上传路由都显式放开(防回潮把上传重新卡死);
 *   2) 用极简 Fastify 镜像该机制,证明 JSON >2MiB 被 413、显式放开的路由可收大 body。
 */

const GLOBAL_LIMIT = 2 * 1024 * 1024

describe('DDoS P2 — 全局 bodyLimit 静态守卫', () => {
  const serverSrc = readFileSync(SERVER_TS, 'utf-8')

  it('server.ts 全局 bodyLimit 必须保持 2MiB(不得回潮到 10MiB)', () => {
    expect(serverSrc).toContain('bodyLimit: 2 * 1024 * 1024,')
    expect(serverSrc).not.toContain('bodyLimit: 1048576 * 10,')
  })

  it('各上传/大体积路由必须显式放开 bodyLimit(否则会被全局 2MiB 卡死上传)', () => {
    const files = [
      'routes/files.ts',
      'routes/file-version.ts',
      'routes/cli-import.ts',
      'routes/workspace.ts',
      'routes/v1-knowledge-tools.ts',
      'routes/knowledge-rag.ts',
      'routes/ai-audio.ts',
      'routes/member.ts',
      'routes/conversation-import.ts',
      'routes/engine-voice.ts',
    ]
    for (const f of files) {
      const text = readFileSync(resolve(SRC, f), 'utf-8')
      expect(text, `${f} 应含显式 bodyLimit 放开`).toMatch(/bodyLimit\s*:/)
    }
  })
})

describe('DDoS P2 — bodyLimit 行为', () => {
  it('默认 JSON 路由 >2MiB 被 413,≤2MiB 放行;显式放开的路由可收 10MiB(远超全局但未越其自身上限)', async () => {
    const app = Fastify({ bodyLimit: GLOBAL_LIMIT })
    app.post('/default', async (req) => ({ len: JSON.stringify(req.body).length }))
    // 镜像 conversation-import/parse 的显式放开(20MiB+余量)
    app.post('/big', { bodyLimit: 21 * 1024 * 1024 }, async (req) => ({ len: JSON.stringify(req.body).length }))
    await app.ready()

    // ≤2MiB 放行
    const ok = await app.inject({
      method: 'POST',
      url: '/default',
      payload: { x: 'a'.repeat(1 * 1024 * 1024) },
    })
    expect(ok.statusCode).toBe(200)

    // >2MiB 被 413(PayloadTooLarge)——内存耗尽面被压住
    const tooBig = await app.inject({
      method: 'POST',
      url: '/default',
      payload: { x: 'a'.repeat(3 * 1024 * 1024) },
    })
    expect(tooBig.statusCode).toBe(413)

    // 显式放开的路由可收 10MiB:远超 2MiB 全局,但未越其自身 21MiB 上限(上传不被误伤)
    const bigOk = await app.inject({
      method: 'POST',
      url: '/big',
      payload: { x: 'a'.repeat(10 * 1024 * 1024) },
    })
    expect(bigOk.statusCode).toBe(200)

    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
