// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { parseMinimaxConfigModels, minimaxConfigPath } from '../src/services/upstream-adapters/minimax-models.js'

describe('minimax parseMinimaxConfigModels(纯函数)', () => {
  it('从真实形状 config.yaml 提取 models 键 + whitelist + defaultModel', () => {
    const yaml = `provider:
  minimax:
    name: MiniMax
    models:
      MiniMax-M3:
        name: M3
        limit: { context: 512000 }
      MiniMax-M3.1-Flash:
        name: M3.1-Flash
    model_order:
      - MiniMax-M3.1-Flash
    whitelist:
      - MiniMax-M2.7-highspeed
      - MiniMax-M2.7
    options:
      apiKey: sk-xxx
defaultModel: minimax/MiniMax-M3.1-Flash
`
    const t = parseMinimaxConfigModels(yaml)
    expect(t).not.toBeNull()
    expect(t!.models).toEqual(['MiniMax-M3', 'MiniMax-M3.1-Flash'])
    expect(t!.whitelist).toEqual(['MiniMax-M2.7-highspeed', 'MiniMax-M2.7'])
    expect(t!.defaultModel).toBe('minimax/MiniMax-M3.1-Flash')
  })

  it('models 空但 whitelist 有 → 仍判定(回落取 whitelist)', () => {
    const t = parseMinimaxConfigModels('provider:\n  minimax:\n    whitelist:\n      - MiniMax-M2.7\n')
    expect(t!.models).toEqual([])
    expect(t!.whitelist).toEqual(['MiniMax-M2.7'])
  })

  it('无 provider.minimax / 无模型 / YAML 坏 → null(不冒充空清单)', () => {
    expect(parseMinimaxConfigModels('provider:\n  other:\n    models:\n      X: {}')).toBeNull()
    expect(parseMinimaxConfigModels('provider:\n  minimax:\n    models: {}')).toBeNull()
    expect(parseMinimaxConfigModels('provider: [broken')).toBeNull()
    expect(parseMinimaxConfigModels('')).toBeNull()
  })
})

describe('minimax minimaxConfigPath', () => {
  it('默认 homedir/.minimax/config.yaml,env 可覆盖', () => {
    expect(minimaxConfigPath('/home/u')).toMatch(/\.minimax[\\/]config\.yaml$/)
    const prev = process.env['IHUI_MINIMAX_CONFIG']
    process.env['IHUI_MINIMAX_CONFIG'] = '/tmp/custom.yaml'
    expect(minimaxConfigPath('/home/u')).toBe('/tmp/custom.yaml')
    if (prev === undefined) delete process.env['IHUI_MINIMAX_CONFIG']
    else process.env['IHUI_MINIMAX_CONFIG'] = prev
  })
})
