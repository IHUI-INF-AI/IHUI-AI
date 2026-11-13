// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-402 回归锁:swarms 无属主模型,任意用户拿到 swarm id 即可查询/推进/终止他人 swarm。
 *
 * 缺陷(见 docs/tickets/2026-11/findings-api.md#F-402):
 *   SwarmManager 只按 swarmId 存取,SwarmPlan 无属主字段;五个端点(create/list/get/
 *   execute/cancel)虽 requireAuth 拿到 userId,却都不传给管理器做属主校验 ⇒
 *   跨用户任务劫持与资源滥用。
 *
 * 修复:SwarmPlan 增 ownerId;create 记属主,list 过滤属主,get/execute/cancel 一律按
 *   (swarmId, ownerId) 定位 —— 非属主视为不存在(get 返回 null / cancel 返回 false /
 *   execute 抛同文案错误),由路由统一转 404,与「不存在」同形防枚举。
 *   本锁钉住:实体带属主字段、且读/推进/终止三条路径都做属主谓词、路由把 userId 传下去。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(here, '..', '..', '..')
const svc = resolve(REPO_ROOT, 'apps/api/src/services/workspace-ai-service.ts')
const route = resolve(REPO_ROOT, 'apps/api/src/routes/workspace-ai.ts')

describe('F-402:SwarmPlan 必须建模属主(ownerId)', () => {
  it('实体锁:SwarmPlan 接口含 ownerId 且注释锚定 F-402', () => {
    const src = readFileSync(svc, 'utf8')
    // interface SwarmPlan { ... ownerId: string ... }
    expect(src).toMatch(/interface SwarmPlan\s*\{[\s\S]*?ownerId:\s*string[\s\S]*?\}/)
    expect(src).toContain('F-402')
  })

  it('创建锁:create 必须接收 ownerId 并写进 plan', () => {
    const src = readFileSync(svc, 'utf8')
    // create(params: { ownerId: string; task: string; ... })
    expect(src).toMatch(/create\(params:\s*\{\s*ownerId:\s*string/)
    // plan 对象字面量带 ownerId: params.ownerId
    expect(src).toMatch(/ownerId:\s*params\.ownerId/)
  })
})

describe('F-402:读/推进/终止三条路径都必须按 (swarmId, ownerId) 定位', () => {
  it('列表锁:list 按 ownerId 过滤(不再返回全局并集)', () => {
    const src = readFileSync(svc, 'utf8')
    expect(src).toMatch(/list\(ownerId:\s*string\): SwarmPlan\[\]\s*\{[\s\S]*?\.filter\(\(p\)\s*=>\s*p\.ownerId\s*===\s*ownerId\)/)
  })

  it('读取锁:get 按 (swarmId, ownerId) 谓词,非属主返回 null', () => {
    const src = readFileSync(svc, 'utf8')
    expect(src).toMatch(/get\(swarmId:\s*string,\s*ownerId:\s*string\): SwarmPlan \| null\s*\{/)
    expect(src).toMatch(/plan\.ownerId !== ownerId/) // 属主谓词
    expect(src).toMatch(/if \(!plan \|\| plan\.ownerId !== ownerId\) return null/)
  })

  it('推进锁:execute 走 get(swarmId, ownerId),非属主走「不存在」分支', () => {
    const src = readFileSync(svc, 'utf8')
    expect(src).toMatch(/async execute\(swarmId:\s*string,\s*ownerId:\s*string\): Promise<SwarmPlan>\s*\{[\s\S]*?this\.get\(swarmId,\s*ownerId\)/)
  })

  it('终止锁:cancel 按 (swarmId, ownerId),非属主返回 false', () => {
    const src = readFileSync(svc, 'utf8')
    expect(src).toMatch(/cancel\(swarmId:\s*string,\s*ownerId:\s*string\): boolean\s*\{[\s\S]*?this\.get\(swarmId,\s*ownerId\)/)
  })
})

describe('F-402:路由必须把已鉴权 userId 传给管理器', () => {
  it('创建端点:create({ ownerId: request.userId, ...body })', () => {
    const src = readFileSync(route, 'utf8')
    expect(src).toMatch(/swarmManager\.create\(\{\s*ownerId:\s*request\.userId,\s*\.\.\.parsed\.data\s*\}\)/)
  })

  it('列表端点:list(request.userId)', () => {
    const src = readFileSync(route, 'utf8')
    expect(src).toMatch(/swarmManager\.list\(request\.userId\)/)
  })

  it('读取端点:get(swarmId, request.userId),非属主 404(与不存在同形防枚举)', () => {
    const src = readFileSync(route, 'utf8')
    expect(src).toMatch(/swarmManager\.get\(swarmId,\s*request\.userId\)/)
  })

  it('推进/终止端点:execute / cancel 均传 request.userId', () => {
    const src = readFileSync(route, 'utf8')
    expect(src).toMatch(/swarmManager\.execute\(swarmId,\s*request\.userId\)/)
    expect(src).toMatch(/swarmManager\.cancel\(swarmId,\s*request\.userId\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
