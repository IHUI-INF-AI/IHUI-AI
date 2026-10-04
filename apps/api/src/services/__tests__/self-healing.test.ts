// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * self-healing 单测(2026-09-17 立,#45)。
 * 依赖/索引探针用真实临时目录 fixture;端口探针用本地监听;修复走 dryRun 与
 * 真实删除(仅 tmp 工作区内白名单目录)。不连 DB,不依赖外部服务。
 */
import { describe, it, expect, afterAll, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import {
  probeDependency,
  probePort,
  detectWorkspaceIssues,
  repairWorkspaceIssue,
} from '../self-healing'
import {
  judgeKillIdentity,
  killProcessVerified,
  parseProcProbeOutput,
  type KillIdentityExpectation,
  type ProcIdentitySnapshot,
} from '../../utils/kill-verified'

const tmpRoots: string[] = []
function makeWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-self-heal-'))
  tmpRoots.push(dir)
  return dir
}

afterAll(() => {
  for (const dir of tmpRoots) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
})

describe('probeDependency', () => {
  it('无 package.json → null(非 JS 工作区不检)', () => {
    const ws = makeWorkspace()
    expect(probeDependency(ws)).toBeNull()
  })

  it('有 package.json 无 node_modules → error', () => {
    const ws = makeWorkspace()
    writeFileSync(join(ws, 'package.json'), '{}', 'utf-8')
    const issue = probeDependency(ws)
    expect(issue?.kind).toBe('dependency')
    expect(issue?.severity).toBe('error')
    expect(issue?.fixPlan).toContain('pnpm install')
  })

  it('node_modules 比 package.json 新 → null(健康)', () => {
    const ws = makeWorkspace()
    writeFileSync(join(ws, 'package.json'), '{}', 'utf-8')
    mkdirSync(join(ws, 'node_modules'))
    // node_modules mtime 略晚于 package.json
    const newer = new Date(Date.now() + 5000)
    utimesSync(join(ws, 'node_modules'), newer, newer)
    expect(probeDependency(ws)).toBeNull()
  })

  it('package.json 比 node_modules 新 → warn(依赖过期)', () => {
    const ws = makeWorkspace()
    writeFileSync(join(ws, 'package.json'), '{}', 'utf-8')
    mkdirSync(join(ws, 'node_modules'))
    // node_modules mtime 回拨到 10 分钟前
    const older = new Date(Date.now() - 10 * 60 * 1000)
    utimesSync(join(ws, 'node_modules'), older, older)
    const issue = probeDependency(ws)
    expect(issue?.severity).toBe('warn')
    expect(issue?.detail).toContain('过期')
  })
})

describe('probePort', () => {
  it('被监听的端口 → true;空闲端口 → false', async () => {
    const server = createServer()
    await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0
    expect(await probePort(port)).toBe(true)
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()))
    expect(await probePort(port)).toBe(false)
  })
})

describe('detectWorkspaceIssues', () => {
  it('聚合多类问题且探针异常不阻断(端口占用 + 依赖缺失同时报告)', async () => {
    const ws = makeWorkspace()
    writeFileSync(join(ws, 'package.json'), '{}', 'utf-8')
    const server = createServer()
    await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0
    try {
      const result = await detectWorkspaceIssues({ workspacePath: ws, port })
      const kinds = result.issues.map((i) => i.kind)
      expect(kinds).toContain('dependency')
      expect(kinds).toContain('port')
      expect(kinds).toContain('index') // 无索引文件
      expect(result.probeErrors).toEqual([])
    } finally {
      server.close()
    }
  })

  it('健康工作区(无 package.json)→ 仅索引缺失 warn', async () => {
    const ws = makeWorkspace()
    const result = await detectWorkspaceIssues({ workspacePath: ws })
    expect(result.issues.map((i) => i.kind)).toEqual(['index'])
  })
})

describe('repairWorkspaceIssue', () => {
  it('dryRun=true:所有 step 为 planned,不产生任何写入', async () => {
    const ws = makeWorkspace()
    const before = existsSync(join(ws, 'node_modules'))
    const result = await repairWorkspaceIssue({
      workspacePath: ws,
      kind: 'dependency',
      dryRun: true,
    })
    expect(result.dryRun).toBe(true)
    expect(result.steps.every((s) => s.status === 'planned')).toBe(true)
    expect(existsSync(join(ws, 'node_modules'))).toBe(before)
  })

  it('index dryRun → planned;真实执行重建索引(totalFiles>=0)', async () => {
    const ws = makeWorkspace()
    writeFileSync(join(ws, 'a.ts'), 'export const a = 1', 'utf-8')
    const planned = await repairWorkspaceIssue({ workspacePath: ws, kind: 'index', dryRun: true })
    expect(planned.steps[0]?.status).toBe('planned')
    const done = await repairWorkspaceIssue({ workspacePath: ws, kind: 'index', dryRun: false })
    expect(done.ok).toBe(true)
    expect(done.steps[0]?.status).toBe('ok')
    expect(existsSync(join(ws, '.ihui', 'codebase-index.json'))).toBe(true)
  })

  it('disk 真实清理:仅删白名单目录,释放字节入审计', async () => {
    const ws = makeWorkspace()
    const cache = join(ws, 'node_modules', '.cache')
    mkdirSync(cache, { recursive: true })
    writeFileSync(join(cache, 'junk.bin'), 'x'.repeat(1024), 'utf-8')
    writeFileSync(join(ws, 'keep.txt'), 'must survive', 'utf-8')
    const result = await repairWorkspaceIssue({
      workspacePath: ws,
      kind: 'disk',
      dryRun: false,
      minFreeMB: 1,
    })
    expect(result.steps[0]?.status).toBe('ok') // 盘点
    expect(existsSync(cache)).toBe(false)
    expect(existsSync(join(ws, 'keep.txt'))).toBe(true)
  })

  it('disk 无白名单目录 → skipped 且 ok=false', async () => {
    const ws = makeWorkspace()
    const result = await repairWorkspaceIssue({
      workspacePath: ws,
      kind: 'disk',
      dryRun: false,
      minFreeMB: 1,
    })
    expect(result.steps[0]?.status).toBe('skipped')
    expect(result.ok).toBe(false)
  })

  it('port:forceKillPid 缺省 → planned 且 ok=false(不误杀)', async () => {
    const server = createServer()
    await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0
    try {
      const result = await repairWorkspaceIssue({
        workspacePath: makeWorkspace(),
        kind: 'port',
        dryRun: false,
        port,
      })
      expect(result.ok).toBe(false)
      expect(result.steps.some((s) => s.status === 'planned')).toBe(true)
    } finally {
      server.close()
    }
  })
})

// =============================================================================
// G-670:杀进程前复核进程身份(唯一出口 killProcessVerified;全程注入 deps,
// 不派生任何真实 taskkill/kill,不杀任何进程)
// =============================================================================

const expectPort8801 = (): KillIdentityExpectation => ({ commandLineAnyOf: ['8801'] })
const MINE: ProcIdentitySnapshot = {
  executablePath: 'D:\\nodejs\\node.exe',
  commandLine: 'node dist/server.js --port 8801',
}
const STRANGER: ProcIdentitySnapshot = {
  executablePath: 'C:\\Windows\\System32\\svchost.exe',
  commandLine: 'C:\\Windows\\System32\\svchost.exe -k netsvcs',
}

describe('killProcessVerified 身份复核出口(G-670 成对判据)', () => {
  it('①特征不符 ⇒ 拒杀:record 点名 pid/期望/实得,且断言未派生终止命令', async () => {
    const spy = vi.fn(async (_bin: string, _argv: string[]): Promise<string> => 'SHOULD-NOT-RUN')
    const out = await killProcessVerified(4242, expectPort8801(), { inspect: async () => STRANGER, runKill: spy })
    expect(out.killed).toBe(false)
    if (!out.killed) {
      expect(out.reason).toBe('identity-mismatch')
      expect(out.record).toContain('4242')
      expect(out.record).toContain('8801')
      expect(out.record).toContain('svchost')
    }
    expect(spy).not.toHaveBeenCalled()
  })

  it('②特征相符 ⇒ 正常杀:派生恰好一次且命令指向该 pid(正向对照,不改坏功能)', async () => {
    const spy = vi.fn(async (_bin: string, argv: string[]): Promise<string> => `done ${argv.join(' ')}`)
    const out = await killProcessVerified(4242, expectPort8801(), { inspect: async () => MINE, runKill: spy })
    expect(out.killed).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
    const [bin, argv] = spy.mock.calls[0] ?? []
    expect(argv?.join(' ')).toContain('4242')
    expect(['taskkill', 'kill']).toContain(String(bin))
  })

  it('③pid 已不存在/取不到 ⇒ 未判定不杀(与改动前"没东西可杀"行为一致),探针抛错同侧', async () => {
    const spy = vi.fn(async (_bin: string, _argv: string[]): Promise<string> => 'SHOULD-NOT-RUN')
    const gone = await killProcessVerified(999999, expectPort8801(), { inspect: async () => null, runKill: spy })
    expect(gone.killed).toBe(false)
    if (!gone.killed) expect(gone.reason).toBe('undetermined')
    const threw = await killProcessVerified(
      999998,
      expectPort8801(),
      {
        inspect: async () => {
          throw new Error('probe down')
        },
        runKill: spy,
      },
    )
    expect(threw.killed).toBe(false)
    if (!threw.killed) expect(threw.reason).toBe('undetermined')
    expect(spy).not.toHaveBeenCalled()
  })

  it('judgeKillIdentity 纯判据:期望设了而实得缺位⇒不成立;executable 维大小写不敏感', () => {
    expect(judgeKillIdentity({ executablePath: null, commandLine: 'x 8801' }, { executablePathIncludes: 'node.exe' }).ok).toBe(false)
    expect(judgeKillIdentity({ executablePath: 'D:\\NODEJS\\Node.EXE', commandLine: '8801' }, { executablePathIncludes: 'node.exe' }).ok).toBe(true)
    expect(judgeKillIdentity({ executablePath: 'a', commandLine: 'b' }, {}).ok).toBe(true)
  })

  it('parseProcProbeOutput:在场两字段 / NONE⇒null / profile 噪声忽略', () => {
    expect(parseProcProbeOutput('IHUI-EP=D:\\a\\node.exe\nIHUI-CL=node --port 8801')).toEqual({
      executablePath: 'D:\\a\\node.exe',
      commandLine: 'node --port 8801',
      creationUtcUs: null,
    })
    expect(parseProcProbeOutput('IHUI-PROC-NONE')).toBeNull()
    expect(parseProcProbeOutput('欢迎使用噪声行\nIHUI-EP=C:\\x.exe\nIHUI-CL=\n')).toEqual({
      executablePath: 'C:\\x.exe',
      commandLine: null,
      creationUtcUs: null,
    })
  })
})

describe('repairWorkspaceIssue port 修复已走身份复核出口(装车证明,G-670)', () => {
  it('自报 pid 属于他人身份 ⇒ 拒杀并点名,终止命令未派生;ok=false', async () => {
    const server = createServer()
    await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0
    const killSpy = vi.fn(async (_bin: string, _argv: string[]): Promise<string> => 'SHOULD-NOT-RUN')
    try {
      const result = await repairWorkspaceIssue({
        workspacePath: makeWorkspace(),
        kind: 'port',
        dryRun: false,
        port,
        forceKillPid: 424242,
        killDeps: { inspect: async () => STRANGER, runKill: killSpy },
      })
      expect(result.ok).toBe(false)
      const killStep = result.steps.find((s) => s.step === '终止占用进程')
      expect(killStep?.status).toBe('fail')
      expect(killStep?.output).toContain('424242')
      expect(killStep?.output).toContain(String(port))
      expect(killSpy).not.toHaveBeenCalled()
    } finally {
      server.close()
    }
  })

  it('身份相符 ⇒ 终止链走通:派生一次指向该 pid 的命令,端口释放后验证 ok(正向对照)', async () => {
    const server = createServer()
    await new Promise<void>((resolveListen) => server.listen(0, '127.0.0.1', resolveListen))
    const addr = server.address()
    const port = typeof addr === 'object' && addr ? addr.port : 0
    const killSpy = vi.fn(async (_bin: string, argv: string[]): Promise<string> => {
      expect(argv.join(' ')).toContain('777777')
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()))
      return 'SUCCESS: 已终止'
    })
    const result = await repairWorkspaceIssue({
      workspacePath: makeWorkspace(),
      kind: 'port',
      dryRun: false,
      port,
      forceKillPid: 777777,
      killDeps: {
        inspect: async () => ({
          executablePath: 'D:\\nodejs\\node.exe',
          commandLine: `node dist/server.js --port ${port}`,
        }),
        runKill: killSpy,
      },
    })
    expect(killSpy).toHaveBeenCalledTimes(1)
    const killStep = result.steps.find((s) => s.step === '终止占用进程')
    expect(killStep?.status).toBe('ok')
    const verifyStep = result.steps.find((s) => s.step === '验证')
    expect(verifyStep?.status).toBe('ok')
    expect(result.ok).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
