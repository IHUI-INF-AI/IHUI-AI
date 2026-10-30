// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * mcp-config 多源扫描:仓库根向上查找 + 源清单。
 *
 * 钉住的行为:代理运行时把 workspacePath(仓库根)传给 loadMcpConfig,而
 * `ihui mcp list` 在任意子目录以 cwd 执行;只扫 <cwd> 与 home 会让项目级
 * <repo-root>/.ihui/mcp.json 在子目录静默不可见(2026-10-30 冒烟实撞)。
 * 判据:根源优先级 cwd > repo-root(向上找 .git,与 skills 加载器同源) > home,
 * 根源去重,且 listMcpConfigSources 只列实际存在的文件、按优先级排序。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { loadMcpConfig, listMcpConfigSources } from '../src/commands/mcp-config.js'

let tmpRoot: string
let repoRoot: string
let nestedCwd: string
let fakeHome: string
let origUserProfile: string | undefined
let origHome: string | undefined

function writeMcpJson(root: string, dir: string, servers: unknown[]): void {
  const d = path.join(root, dir)
  fs.mkdirSync(d, { recursive: true })
  fs.writeFileSync(path.join(d, 'mcp.json'), JSON.stringify({ servers }), 'utf-8')
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-mcp-reporoot-'))
  repoRoot = path.join(tmpRoot, 'repo')
  nestedCwd = path.join(repoRoot, 'apps', 'cli')
  fakeHome = path.join(tmpRoot, 'home')
  fs.mkdirSync(path.join(repoRoot, '.git'), { recursive: true })
  fs.mkdirSync(nestedCwd, { recursive: true })
  fs.mkdirSync(path.join(fakeHome, '.ihui'), { recursive: true })
  // os.homedir():Windows 读 USERPROFILE,POSIX 读 HOME —— 两个都钉,跨平台同一判据
  origUserProfile = process.env.USERPROFILE
  origHome = process.env.HOME
  process.env.USERPROFILE = fakeHome
  process.env.HOME = fakeHome
})

afterEach(() => {
  if (origUserProfile === undefined) delete process.env.USERPROFILE
  else process.env.USERPROFILE = origUserProfile
  if (origHome === undefined) delete process.env.HOME
  else process.env.HOME = origHome
  fs.rmSync(tmpRoot, { recursive: true, force: true })
})

describe('loadMcpConfig 仓库根向上查找', () => {
  it('子目录执行时可见 <repo-root>/.ihui/mcp.json(rea 的 framing/requestTimeoutMs 原样透传)', () => {
    writeMcpJson(repoRoot, '.ihui', [
      {
        name: 'rea',
        transport: 'stdio',
        command: 'node',
        args: ['scripts/rea-mcp-entry.mjs'],
        framing: 'content-length',
        requestTimeoutMs: 300000,
      },
    ])
    const config = loadMcpConfig(nestedCwd)
    const rea = config.servers.find((s) => s.name === 'rea')
    expect(rea).toBeDefined()
    expect(rea?.framing).toBe('content-length')
    expect(rea?.requestTimeoutMs).toBe(300000)
  })

  it('优先级:cwd 覆盖 repo-root 同名 server', () => {
    writeMcpJson(repoRoot, '.ihui', [{ name: 'srv', command: 'repo-cmd' }])
    writeMcpJson(nestedCwd, '.ihui', [{ name: 'srv', command: 'cwd-cmd' }])
    const config = loadMcpConfig(nestedCwd)
    expect(config.servers).toHaveLength(1)
    expect(config.servers[0]?.command).toBe('cwd-cmd')
  })

  it('优先级:repo-root 覆盖 home 同名 server,home 独有 server 保留', () => {
    writeMcpJson(repoRoot, '.ihui', [{ name: 'srv', command: 'repo-cmd' }])
    writeMcpJson(fakeHome, '.ihui', [{ name: 'srv', command: 'home-cmd' }, { name: 'solo', command: 'x' }])
    const config = loadMcpConfig(nestedCwd)
    expect(config.servers.find((s) => s.name === 'srv')?.command).toBe('repo-cmd')
    expect(config.servers.find((s) => s.name === 'solo')).toBeDefined()
  })

  it('cwd 即仓库根时根源去重:同一文件不重复合并,计数不膨胀', () => {
    writeMcpJson(repoRoot, '.ihui', [{ name: 'rea', command: 'node' }])
    writeMcpJson(fakeHome, '.ihui', [{ name: 'home-only', command: 'x' }])
    const config = loadMcpConfig(repoRoot)
    expect(config.servers).toHaveLength(2)
    expect(config.servers.map((s) => s.name).sort()).toEqual(['home-only', 'rea'])
  })

  it('无 .git 时仓库根回落为 cwd 本身,不引入额外源', () => {
    const plainDir = path.join(tmpRoot, 'plain')
    fs.mkdirSync(plainDir, { recursive: true })
    writeMcpJson(plainDir, '.ihui', [{ name: 'solo', command: 'x' }])
    const config = loadMcpConfig(plainDir)
    expect(config.servers).toHaveLength(1)
    expect(listMcpConfigSources(plainDir)).toEqual([path.join(plainDir, '.ihui', 'mcp.json')])
  })
})

describe('listMcpConfigSources', () => {
  it('只列实际存在的源,顺序为优先级高→低(cwd → repo-root → home)', () => {
    writeMcpJson(repoRoot, '.ihui', [{ name: 'rea', command: 'node' }])
    writeMcpJson(fakeHome, '.ihui', [{ name: 'home-only', command: 'x' }])
    expect(listMcpConfigSources(nestedCwd)).toEqual([
      path.join(repoRoot, '.ihui', 'mcp.json'),
      path.join(fakeHome, '.ihui', 'mcp.json'),
    ])
    writeMcpJson(nestedCwd, '.cursor', [{ name: 'local', command: 'x' }])
    expect(listMcpConfigSources(nestedCwd)).toEqual([
      path.join(nestedCwd, '.cursor', 'mcp.json'),
      path.join(repoRoot, '.ihui', 'mcp.json'),
      path.join(fakeHome, '.ihui', 'mcp.json'),
    ])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
