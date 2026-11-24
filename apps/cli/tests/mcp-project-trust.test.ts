// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 2026-10-31 安全强化第 20 批(CLI Critical)回归:
 * 工作区自带的 mcp.json 里的 stdio server 会以当前用户身份 spawn ⇒
 * clone 恶意仓库再运行 CLI 即 RCE。判据:
 *  - 连接路径默认**不加载**工作区来源(includeProject:false);
 *  - 展示/列举路径仍可见(不把攻击面藏起来,listProjectMcpConfigSources 点名);
 *  - 信任开关本身是安全敏感键,项目层写不进去(仓库不能给自己发信任状);
 *  - 阳性对照:默认 loadMcpConfig 仍合并项目来源(策略没把功能砸了)。
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  loadMcpConfig,
  listProjectMcpConfigSources,
} from '../src/commands/mcp-config.js'
import { filterProjectLayerSettings } from '../src/config/layer-policy.js'

const PROJECT_SERVER = 'evil-project-server'

describe('工作区 mcp.json 默认不参与连接(防 clone 即 RCE)', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-mcp-trust-'))
    fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true })
    fs.writeFileSync(
      path.join(tmpDir, '.claude', 'mcp.json'),
      JSON.stringify({
        mcpServers: {
          [PROJECT_SERVER]: { command: 'node', args: ['-e', 'process.exit(0)'] },
        },
      }),
      'utf-8',
    )
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('includeProject:false 时不返回工作区来源的 server', () => {
    const config = loadMcpConfig(tmpDir, { includeProject: false })
    expect(config.servers.map((s) => s.name)).not.toContain(PROJECT_SERVER)
  })

  it('阳性对照:默认仍合并工作区来源(展示路径不受影响)', () => {
    const config = loadMcpConfig(tmpDir)
    expect(config.servers.map((s) => s.name)).toContain(PROJECT_SERVER)
  })

  it('listProjectMcpConfigSources 点名工作区来源,且不含家目录来源', () => {
    const sources = listProjectMcpConfigSources(tmpDir)
    expect(sources).toContain(path.join(tmpDir, '.claude', 'mcp.json'))
    // 家目录来源不属于"工作区来源",不得混进来(否则信任提示会误报)
    expect(sources.every((p) => p.startsWith(tmpDir))).toBe(true)
  })

  it('信任开关 mcpTrustProjectServers 是安全敏感键:项目层写不进去', () => {
    const { accepted, rejected } = filterProjectLayerSettings({
      mcpTrustProjectServers: true,
    })
    expect(accepted).toEqual({})
    expect(rejected.map((r) => r.key)).toEqual(['mcpTrustProjectServers'])
    expect(rejected[0]?.category).toBe('security-sensitive')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
