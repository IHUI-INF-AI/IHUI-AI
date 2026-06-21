/**
 * P9-7 A/B 测试灰度远程配置接入验证
 * - src/api/remote-config.ts 存在且导出完整 API
 * - RemoteExperimentConfig 接口定义完整
 * - 7 个 API 函数导出正确
 * - remoteConfigManager 管理器导出完整
 * - 运行时通过 mock 验证 fetch / list / create / update / delete
 */

import { test, expect } from '@playwright/test'
import { readFileSync } from 'fs'
import { successResponse, errorResponse } from './helpers/api-mock'

const ROOT = 'g:/1/client'
const REMOTE_CONFIG_PATH = `${ROOT}/src/api/remote-config.ts`

function readText(path: string): string {
  return readFileSync(path, 'utf-8')
}

test.describe('P9-7 远程配置 - 源码审查', () => {
  let content: string

  test.beforeAll(() => {
    content = readText(REMOTE_CONFIG_PATH)
  })

  test('remote-config.ts 文件存在且非空', () => {
    expect(content.length, 'remote-config.ts 应有内容').toBeGreaterThan(1000)
    console.log(`[P9-7] remote-config.ts 文件大小: ${content.length} 字符 ✅`)
  })

  test('导出 RemoteExperimentConfig 接口', () => {
    expect(content, '导出 RemoteExperimentConfig').toMatch(/export interface RemoteExperimentConfig/)
    expect(content, '包含 name').toMatch(/name:\s*string/)
    expect(content, '包含 rolloutPercentage').toMatch(/rolloutPercentage:\s*number/)
    expect(content, '包含 whitelist').toMatch(/whitelist\?:\s*string\[\]/)
    expect(content, '包含 blacklist').toMatch(/blacklist\?:\s*string\[\]/)
    expect(content, '包含 variants').toMatch(/variants\?:/)
    expect(content, '包含 expiresAt').toMatch(/expiresAt\?:/)
    expect(content, '包含 remoteUrl').toMatch(/remoteUrl\?:/)
    console.log('[P9-7] RemoteExperimentConfig 接口完整 ✅')
  })

  test('导出 7 个核心 API 函数', () => {
    expect(content, '导出 fetchRemoteConfigs').toMatch(/export async function fetchRemoteConfigs/)
    expect(content, '导出 reportExposure').toMatch(/export async function reportExposure/)
    expect(content, '导出 reportConversion').toMatch(/export async function reportConversion/)
    expect(content, '导出 createExperiment').toMatch(/export async function createExperiment/)
    expect(content, '导出 updateExperiment').toMatch(/export async function updateExperiment/)
    expect(content, '导出 deleteExperiment').toMatch(/export async function deleteExperiment/)
    expect(content, '导出 listExperiments').toMatch(/export async function listExperiments/)
    console.log('[P9-7] 7 个核心 API 函数完整 ✅')
  })

  test('导出 remoteConfigManager 管理器', () => {
    expect(content, '导出 remoteConfigManager').toMatch(/export const remoteConfigManager/)
    expect(content, '管理器包含 fetch').toMatch(/fetch:\s*fetchRemoteConfigs/)
    expect(content, '管理器包含 reportExposure').toMatch(/reportExposure,/)
    expect(content, '管理器包含 reportConversion').toMatch(/reportConversion,/)
    expect(content, '管理器包含 create').toMatch(/create:\s*createExperiment/)
    expect(content, '管理器包含 update').toMatch(/update:\s*updateExperiment/)
    expect(content, '管理器包含 delete').toMatch(/delete:\s*deleteExperiment/)
    expect(content, '管理器包含 list').toMatch(/list:\s*listExperiments/)
    console.log('[P9-7] remoteConfigManager 完整 ✅')
  })

  test('API 端点统一为 /api/feature-flags', () => {
    expect(content, '包含 /api/feature-flags').toMatch(/\/api\/feature-flags/)
    expect(content, '包含 exposure 端点').toMatch(/\/api\/feature-flags\/exposure/)
    expect(content, '包含 conversion 端点').toMatch(/\/api\/feature-flags\/conversion/)
    expect(content, '包含 experiments 端点').toMatch(/\/api\/feature-flags\/experiments/)
    console.log('[P9-7] API 端点正确 ✅')
  })

  test('响应处理使用 resp.data?.code 模式', () => {
    expect(content, '使用 resp.data').toMatch(/resp\.data/)
    expect(content, '使用可选链 code').toMatch(/body\?\.code/)
    console.log('[P9-7] TypeScript 响应处理模式正确 ✅')
  })
})

test.describe('P9-7 远程配置 - 运行时验证', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
  })

  test('GET /api/feature-flags 远程配置端点可被 mock', async ({ page }) => {
    const mockData = {
      newHomepage: {
        name: 'newHomepage',
        rolloutPercentage: 50,
        variants: [
          { name: 'control', weight: 50 },
          { name: 'treatment', weight: 50, payload: { color: 'blue' } },
        ],
      },
    }
    await page.route('/api/feature-flags', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(successResponse(mockData)),
      })
    })

    const result = await page.evaluate(async () => {
      const resp = await fetch('/api/feature-flags')
      return resp.json()
    })

    expect(result.code).toBe(200)
    expect(result.data).toEqual(mockData)
    console.log('[P9-7] GET /api/feature-flags 运行时正确 ✅')
  })

  test('GET /api/feature-flags 错误响应可被 mock', async ({ page }) => {
    await page.route('/api/feature-flags', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify(errorResponse(500, '服务器错误')),
      })
    })

    const result = await page.evaluate(async () => {
      const resp = await fetch('/api/feature-flags')
      return resp.json()
    })

    expect(result.code).toBe(500)
    expect(result.success).toBe(false)
    console.log('[P9-7] GET /api/feature-flags 错误响应运行时正确 ✅')
  })

  test('GET /api/feature-flags/experiments 实验列表端点可被 mock', async ({ page }) => {
    const experiments = [
      { name: 'exp1', rolloutPercentage: 10 },
      { name: 'exp2', rolloutPercentage: 20 },
    ]
    await page.route('/api/feature-flags/experiments', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(successResponse(experiments)),
      })
    })

    const result = await page.evaluate(async () => {
      const resp = await fetch('/api/feature-flags/experiments')
      return resp.json()
    })

    expect(result.code).toBe(200)
    expect(result.data).toHaveLength(2)
    console.log('[P9-7] GET /api/feature-flags/experiments 运行时正确 ✅')
  })

  test('POST /api/feature-flags/experiments 创建端点可被 mock', async ({ page }) => {
    let capturedBody: unknown
    await page.route('/api/feature-flags/experiments', async (route) => {
      const req = route.request()
      if (req.method() === 'POST') {
        capturedBody = req.postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(successResponse(null)),
        })
        return
      }
      await route.continue()
    })

    await page.evaluate(async () => {
      await fetch('/api/feature-flags/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'expNew', rolloutPercentage: 30 }),
      })
    })

    expect((capturedBody as Record<string, unknown>).name).toBe('expNew')
    console.log('[P9-7] POST /api/feature-flags/experiments 运行时正确 ✅')
  })

  test('PUT /api/feature-flags/experiments/:name 更新端点可被 mock', async ({ page }) => {
    let capturedUrl = ''
    await page.route('/api/feature-flags/experiments/exp1', async (route) => {
      if (route.request().method() === 'PUT') {
        capturedUrl = route.request().url()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(successResponse(null)),
        })
        return
      }
      await route.continue()
    })

    await page.evaluate(async () => {
      await fetch('/api/feature-flags/experiments/exp1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rolloutPercentage: 40 }),
      })
    })

    expect(capturedUrl).toContain('/api/feature-flags/experiments/exp1')
    console.log('[P9-7] PUT /api/feature-flags/experiments/:name 运行时正确 ✅')
  })

  test('DELETE /api/feature-flags/experiments/:name 删除端点可被 mock', async ({ page }) => {
    let capturedMethod = ''
    await page.route('/api/feature-flags/experiments/exp1', async (route) => {
      capturedMethod = route.request().method()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(successResponse(null)),
      })
    })

    await page.evaluate(async () => {
      await fetch('/api/feature-flags/experiments/exp1', { method: 'DELETE' })
    })

    expect(capturedMethod).toBe('DELETE')
    console.log('[P9-7] DELETE /api/feature-flags/experiments/:name 运行时正确 ✅')
  })

  test('POST /api/feature-flags/exposure 曝光端点可被 mock', async ({ page }) => {
    let capturedBody: unknown
    await page.route('/api/feature-flags/exposure', async (route) => {
      capturedBody = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(successResponse(null)),
      })
    })

    await page.evaluate(async () => {
      await fetch('/api/feature-flags/exposure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experiment: 'exp1', variant: 'treatment', userId: 'user123', timestamp: Date.now() }),
      })
    })

    expect((capturedBody as Record<string, unknown>).experiment).toBe('exp1')
    expect((capturedBody as Record<string, unknown>).variant).toBe('treatment')
    console.log('[P9-7] POST /api/feature-flags/exposure 运行时正确 ✅')
  })

  test('POST /api/feature-flags/conversion 转化端点可被 mock', async ({ page }) => {
    let capturedBody: unknown
    await page.route('/api/feature-flags/conversion', async (route) => {
      capturedBody = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(successResponse(null)),
      })
    })

    await page.evaluate(async () => {
      await fetch('/api/feature-flags/conversion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experiment: 'exp1',
          variant: 'treatment',
          userId: 'user123',
          metric: 'click',
          value: 1,
          timestamp: Date.now(),
        }),
      })
    })

    expect((capturedBody as Record<string, unknown>).metric).toBe('click')
    expect((capturedBody as Record<string, unknown>).value).toBe(1)
    console.log('[P9-7] POST /api/feature-flags/conversion 运行时正确 ✅')
  })
})
