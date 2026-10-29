// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 2026-10-29 实测立锁:近 4 小时 `POST /api/github-app/webhook` 有 59 条 400,与 GitHub 侧同刻
 * 记到的 400 投递逐条对齐(集中 workflow_run / check_suite)—— 成因是 sqli-guard 把提供方的
 * 自由正文（含引号/分号 ∧ SQL 结构签名）当成语句注入拒了,投递判失败并重试。
 *
 * 本文件钉两件事,缺一不可:
 *  ① webhook 面上守卫确实豁免（无签名请求先撞上签名校验 ⇒ 401,而不是守卫的 400）;
 *  ② 成对对照——同一份正文打到同一把守卫下**未豁免**的路由必须照旧 400。
 *     摘掉路由的 `config.sqliGuard` 时 ① 翻红;把守卫判据放宽时 ② 翻红。豁免不是空档。
 */
import { describe, expect, it } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { createHmac } from 'node:crypto'

import githubAppRoutes, { WEBHOOK_PATH } from '../src/routes/github-app'
import { createDeliveryDeduper } from '../src/services/github-app/events'
import sqliGuard from '../src/plugins/sqli-guard.js'

const SECRET = 'whsec_unit_test'
const BASE = '/api/github-app'
/** 字符门（`'` `"` `;`）∧ SQL 结构签名（堆叠语句 + UNION SELECT）—— 提供方正文里的真实形态 */
const INJECTIONISH = "fix: ; SELECT id FROM posts WHERE author='bot' UNION SELECT 1 --"

async function buildApp(): Promise<FastifyInstance> {
  const server = Fastify({ logger: false })
  await server.register(sqliGuard)
  await server.register(githubAppRoutes, {
    prefix: BASE,
    transport: undefined,
    textModel: null,
    webhookSecret: SECRET,
    deduper: createDeliveryDeduper(),
    store: null,
  })
  // 对照组:同一把守卫下的普通路由,未豁免 ⇒ 必须照旧 400
  server.post('/guarded-control', async (request) => ({
    echo: (request.body as { note?: string }).note,
  }))
  await server.ready()
  return server
}

function signature(body: string): string {
  return `sha256=${createHmac('sha256', SECRET).update(body, 'utf8').digest('hex')}`
}

describe('github-app webhook 对 sqli-guard 的豁免(59 条 400 实测立锁)', () => {
  it('带注入形态正文、无签名头的 webhook 请求得到签名层的 401,而不是守卫的 400', async () => {
    const server = await buildApp()
    const response = await server.inject({
      method: 'POST',
      url: `${BASE}${WEBHOOK_PATH}`,
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'workflow_run',
        'x-github-delivery': 'd-exempt-nosig',
      },
      payload: JSON.stringify({ note: INJECTIONISH }),
    })
    expect(response.statusCode).toBe(401)
  })

  it('成对对照:同一份正文打到未豁免路由仍是 400(证明守卫在本 app 里确实上岗)', async () => {
    const server = await buildApp()
    const response = await server.inject({
      method: 'POST',
      url: '/guarded-control',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ note: INJECTIONISH }),
    })
    expect(response.statusCode).toBe(400)
  })

  it('带合法签名的同形态正文走完准入并按未知事件回 200(豁免没把投递打死)', async () => {
    const server = await buildApp()
    const body = JSON.stringify({ action: 'completed', note: INJECTIONISH })
    const response = await server.inject({
      method: 'POST',
      url: `${BASE}${WEBHOOK_PATH}`,
      headers: {
        'content-type': 'application/json',
        'x-github-event': 'workflow_run',
        'x-github-delivery': 'd-exempt-ok',
        'x-hub-signature-256': signature(body),
      },
      payload: body,
    })
    expect(response.statusCode).toBe(200)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
