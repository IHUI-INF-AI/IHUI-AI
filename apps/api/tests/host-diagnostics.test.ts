// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 主机诊断判据与端点 —— 测试(2026-11-17)。
 *
 * 钉住的是"三态纪律"本身,不是某台机器的现状:
 *   D1 hypervisor:有 hypervisor 标志 ⇒ true;标志面可读但无 ⇒ false;读不到 ⇒ null(未判定)。
 *   D2 container:/.dockerenv 优先;否则 cgroup 标记;两路都取不到 ⇒ null。
 *   D3 wsl:/proc/version 含 microsoft ⇒ true;不含 ⇒ false;读不到 ⇒ null。
 *   D4 采集面:未设 QODER_CLI_PATH ⇒ null + 进 undetermined,绝不写成 false。
 *   D5 端点:200 + 结构齐全,且未判定维度在响应里显式出现。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

// 端点形状测试只钉路由与响应结构;鉴权档由 requireAdmin 自身负责(另有其测试面),
// 这里用透传替身,避免把"未登录 401"混进结构断言。
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async () => undefined,
}))

import { classifyVirtualization, collectHostDiagnostics } from '../src/services/host-diagnostics.js'
import { relayDiagnosticsRoutes } from '../src/routes/admin/relay-diagnostics.js'

describe('classifyVirtualization 三态', () => {
  it('D1 有 hypervisor 标志 ⇒ true;可读但无 ⇒ false;读不到 ⇒ null', () => {
    const flagged = classifyVirtualization({
      cpuInfo: 'processor\t: 0\nflags\t\t: fpu vme de hypervisor\n',
      procVersion: 'Linux version 6.1.0',
      cgroup: '0::/init.scope',
      dockerEnvFile: false,
    })
    expect(flagged.hypervisor).toBe(true)
    expect(flagged.evidence).toContain('cpuinfo:hypervisor-flag')

    const bare = classifyVirtualization({
      cpuInfo: 'processor\t: 0\nflags\t\t: fpu vme de pse\n',
      procVersion: 'Linux version 6.1.0',
      cgroup: '0::/init.scope',
      dockerEnvFile: false,
    })
    expect(bare.hypervisor).toBe(false)
    expect(bare.evidence).toContain('cpuinfo:no-hypervisor-flag')

    const unknown = classifyVirtualization({
      cpuInfo: null,
      procVersion: null,
      cgroup: null,
      dockerEnvFile: false,
    })
    expect(unknown.hypervisor).toBeNull()
    expect(unknown.undetermined).toContain('hypervisor')
  })

  it('D2 /.dockerenv 优先;cgroup 标记次之;两路皆无输入 ⇒ null', () => {
    const byFile = classifyVirtualization({
      cpuInfo: '',
      procVersion: '',
      cgroup: null,
      dockerEnvFile: true,
    })
    expect(byFile.container).toBe(true)
    expect(byFile.evidence).toContain('fs:/.dockerenv')

    const byCgroup = classifyVirtualization({
      cpuInfo: '',
      procVersion: '',
      cgroup: '12:pids:/kubepods/besteffort/pod123',
      dockerEnvFile: false,
    })
    expect(byCgroup.container).toBe(true)
    expect(byCgroup.evidence).toContain('cgroup:kubepods')

    const undetermined = classifyVirtualization({
      cpuInfo: '',
      procVersion: '',
      cgroup: null,
      dockerEnvFile: false,
    })
    expect(undetermined.container).toBeNull()
    expect(undetermined.undetermined).toContain('container')
  })

  it('D3 /proc/version 含 microsoft ⇒ WSL;不含 ⇒ false;读不到 ⇒ null', () => {
    const wsl = classifyVirtualization({
      cpuInfo: '',
      procVersion: 'Linux version 5.15.90.1-microsoft-standard-WSL2',
      cgroup: '',
      dockerEnvFile: false,
    })
    expect(wsl.wsl).toBe(true)

    const native = classifyVirtualization({
      cpuInfo: '',
      procVersion: 'Linux version 6.1.0-28-amd64',
      cgroup: '',
      dockerEnvFile: false,
    })
    expect(native.wsl).toBe(false)

    const unknown = classifyVirtualization({
      cpuInfo: '',
      procVersion: null,
      cgroup: '',
      dockerEnvFile: false,
    })
    expect(unknown.wsl).toBeNull()
    expect(unknown.undetermined).toContain('wsl')
  })

  it('D4 未设 QODER_CLI_PATH ⇒ qoderBridge=null 且进 undetermined(不写成 false)', () => {
    const diag = collectHostDiagnostics({})
    expect(diag.runtime.qoderBridge).toBeNull()
    expect(diag.undetermined).toContain('runtime.qoderBridge')
  })

  it('D4b 设了指向不存在的路径 ⇒ 明确 false(装了没装是两种结论)', () => {
    const diag = collectHostDiagnostics({ QODER_CLI_PATH: 'Z:\\definitely\\not\\here\\qoder.exe' })
    expect(diag.runtime.qoderBridge).toBe(false)
    expect(diag.undetermined).not.toContain('runtime.qoderBridge')
  })
})

describe('GET /api/admin/relay/diagnostics/host', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    // requireAdmin 已在模块级 mock 成透传;这里只注册插件本身,钉住路由形状。
    await app.register(relayDiagnosticsRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('D5 返回 200 + 结构齐全,未判定维度显式出现', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/relay/diagnostics/host' })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      code: number
      data: {
        os: { platform: string }
        cpu: { cores: number }
        memory: { totalMb: number }
        virtualization: {
          hypervisor: boolean | null
          container: boolean | null
          wsl: boolean | null
        }
        runtime: { nodeVersion: string; qoderBridge: boolean | null }
        undetermined: string[]
      }
    }
    expect(body.data.os.platform).toBeTruthy()
    expect(body.data.cpu.cores).toBeGreaterThan(0)
    expect(body.data.memory.totalMb).toBeGreaterThan(0)
    // 三态字段必须存在(哪怕值是 null) —— "未判定"要能被读出来,不能整键消失。
    expect('hypervisor' in body.data.virtualization).toBe(true)
    expect('container' in body.data.virtualization).toBe(true)
    expect('wsl' in body.data.virtualization).toBe(true)
    expect(Array.isArray(body.data.undetermined)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
