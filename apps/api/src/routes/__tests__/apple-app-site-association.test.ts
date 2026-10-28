// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-100:api 侧 AASA(GET /.well-known/apple-app-site-association)接线锁。
 *
 * 三例:
 *  1. 200 + Content-Type + appIDs 具体值(线上团队号 TKF3V7GG6T)+ components 两条路径;
 *  2. 响应体与共享源 buildAppleAppSiteAssociationBody 逐字节一致(单一真相源,禁止 api 另抄 JSON);
 *  3. 未配置 Team ID 时回退占位符 TEAMID(与 web 侧既有行为一致,防抽源改变边缘语义)。
 *
 * 本件与 packages/shared/src/constants/apple-app-site-association.ts、
 * apps/api/src/routes/apple-app-site-association.ts 是同一交付的三块:枚 4cd8e130cd 的合并曾把本件吞掉
 * (远端留下引用方与路由、缺判据锁),所以任何收敛都不得把本件当作"可丢的一侧"。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import {
  APPLE_AASA_CACHE_CONTROL,
  APPLE_AASA_CONTENT_TYPE,
  buildAppleAppSiteAssociationBody,
  readAppleAppIdOptions,
} from '@ihui/shared/constants/apple-app-site-association'
import { appleAppSiteAssociationRoutes } from '../apple-app-site-association.js'

const ENV_KEYS = [
  'APPLE_TEAM_ID',
  'NEXT_PUBLIC_APPLE_TEAM_ID',
  'NEXT_PUBLIC_APPLE_APP_BUNDLE_ID',
] as const
const ORIGINAL_ENV: Record<string, string | undefined> = {}

let app: FastifyInstance

async function buildApp(): Promise<FastifyInstance> {
  const instance = Fastify()
  await instance.register(appleAppSiteAssociationRoutes)
  await instance.ready()
  return instance
}

beforeEach(async () => {
  for (const key of ENV_KEYS) ORIGINAL_ENV[key] = process.env[key]
  app = await buildApp()
})

afterEach(async () => {
  await app.close()
  for (const key of ENV_KEYS) {
    if (ORIGINAL_ENV[key] === undefined) delete process.env[key]
    else process.env[key] = ORIGINAL_ENV[key]
  }
})

describe('GET /.well-known/apple-app-site-association', () => {
  it('返回 200 + application/json,appIDs/components 为线上值', async () => {
    process.env.APPLE_TEAM_ID = 'TKF3V7GG6T'
    delete process.env.NEXT_PUBLIC_APPLE_APP_BUNDLE_ID

    const res = await app.inject({
      method: 'GET',
      url: '/.well-known/apple-app-site-association',
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe(APPLE_AASA_CONTENT_TYPE)
    expect(res.headers['cache-control']).toBe(APPLE_AASA_CACHE_CONTROL)

    const body = res.json() as {
      applinks: { details: Array<{ appIDs: string[]; components: Array<{ '/': string }> }> }
    }
    expect(body.applinks.details).toHaveLength(1)
    expect(body.applinks.details[0]?.appIDs).toEqual(['TKF3V7GG6T.ai.ihui.mobile'])
    expect(body.applinks.details[0]?.components).toEqual([{ '/': '/wechat/*' }, { '/': '/*' }])
  })

  it('响应体与共享源逐字节一致(单一真相源)', async () => {
    process.env.APPLE_TEAM_ID = 'TKF3V7GG6T'

    const res = await app.inject({
      method: 'GET',
      url: '/.well-known/apple-app-site-association',
    })

    const expected = buildAppleAppSiteAssociationBody(readAppleAppIdOptions(process.env))
    expect(res.body).toBe(expected)
  })

  it('未配置 Team ID 时回退占位符 TEAMID(与 web 既有行为一致)', async () => {
    delete process.env.APPLE_TEAM_ID
    delete process.env.NEXT_PUBLIC_APPLE_TEAM_ID
    delete process.env.NEXT_PUBLIC_APPLE_APP_BUNDLE_ID

    const res = await app.inject({
      method: 'GET',
      url: '/.well-known/apple-app-site-association',
    })

    const body = res.json() as { applinks: { details: Array<{ appIDs: string[] }> } }
    expect(res.statusCode).toBe(200)
    expect(body.applinks.details[0]?.appIDs).toEqual(['TEAMID.ai.ihui.mobile'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
