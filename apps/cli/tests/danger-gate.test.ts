// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * createDangerGate 工厂本体回归:三条路(flag/approved/denied)各至少一正例,
 * 外加两条 fail-closed 边(prompt 空答复/抛错 ⇒ denied)与一条优先级边
 * (flag 与 prompt 同时存在时记录的路由必须是 flag,不是 approved)。
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  createDangerGate,
  type DangerGateDecision,
  type DangerGatePrompt,
} from '../src/tools/danger-gate.js'
import type { Tool } from '../src/tools/index.js'

const tool: Tool = {
  name: 'run_command',
  description: 'dangerous probe tool',
  parameters: {},
  required: [],
  execute: async () => ({ success: true, output: 'ok' }),
}

const args = { command: 'rm -rf /tmp/definitely-not-executed' }

function recorder(): { decisions: DangerGateDecision[]; onDecision: (d: DangerGateDecision) => void } {
  const decisions: DangerGateDecision[] = []
  return { decisions, onDecision: (d) => decisions.push(d) }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('三条路各一正例', () => {
  it('flag:--allow-dangerous 自动放行,且绝不打扰 prompt', async () => {
    const prompt = vi.fn(async () => true)
    const rec = recorder()
    const allowed = await createDangerGate({
      allowDangerous: true,
      silent: true,
      prompt,
      onDecision: rec.onDecision,
    })(tool, args)
    expect(allowed).toBe(true)
    expect(prompt).not.toHaveBeenCalled()
    expect(rec.decisions).toHaveLength(1)
    expect(rec.decisions[0]?.route).toBe('flag')
    expect(rec.decisions[0]?.cause).toBeUndefined()
  })

  it('approved:prompt 返回 true ⇒ 放行,路由 approved', async () => {
    const rec = recorder()
    const allowed = await createDangerGate({
      silent: true,
      prompt: async () => true,
      onDecision: rec.onDecision,
    })(tool, args)
    expect(allowed).toBe(true)
    expect(rec.decisions).toHaveLength(1)
    expect(rec.decisions[0]?.route).toBe('approved')
  })

  it('denied:prompt 返回 false ⇒ 拒绝,路由 denied + cause prompt-declined', async () => {
    const rec = recorder()
    const allowed = await createDangerGate({
      silent: true,
      prompt: async () => false,
      onDecision: rec.onDecision,
    })(tool, args)
    expect(allowed).toBe(false)
    expect(rec.decisions[0]?.route).toBe('denied')
    expect(rec.decisions[0]?.cause).toBe('prompt-declined')
  })
})

describe('fail-closed 边:没人应答绝不等于放行', () => {
  it('没有 prompt 且 flag 未开 ⇒ denied(cause no-prompt)', async () => {
    const rec = recorder()
    const allowed = await createDangerGate({ allowDangerous: false, silent: true, onDecision: rec.onDecision })(tool, args)
    expect(allowed).toBe(false)
    expect(rec.decisions[0]?.route).toBe('denied')
    expect(rec.decisions[0]?.cause).toBe('no-prompt')
  })

  it('allowDangerous 缺省(undefined)同样不构成放行依据', async () => {
    expect(await createDangerGate({ silent: true })(tool, args)).toBe(false)
  })

  it('prompt 返回 undefined / null ⇒ denied(cause prompt-empty)', async () => {
    const recU = recorder()
    expect(await createDangerGate({ silent: true, prompt: async () => undefined, onDecision: recU.onDecision })(tool, args)).toBe(false)
    expect(recU.decisions[0]?.cause).toBe('prompt-empty')
    const recN = recorder()
    expect(await createDangerGate({ silent: true, prompt: async () => null, onDecision: recN.onDecision })(tool, args)).toBe(false)
    expect(recN.decisions[0]?.cause).toBe('prompt-empty')
  })

  it('prompt 抛错 ⇒ denied(cause prompt-error),异常不外溢', async () => {
    const rec = recorder()
    const bomb: DangerGatePrompt = async () => {
      throw new Error('editor disconnected')
    }
    await expect(createDangerGate({ silent: true, prompt: bomb, onDecision: rec.onDecision })(tool, args)).resolves.toBe(false)
    expect(rec.decisions[0]?.route).toBe('denied')
    expect(rec.decisions[0]?.cause).toBe('prompt-error')
  })

  it('非 true 的 truthy 答复不算肯定(只认 === true)', async () => {
    const rec = recorder()
    const sneaky = (async () => 'yes') as unknown as DangerGatePrompt
    expect(await createDangerGate({ silent: true, prompt: sneaky, onDecision: rec.onDecision })(tool, args)).toBe(false)
    expect(rec.decisions[0]?.cause).toBe('prompt-declined')
  })
})

describe('flag 与 prompt 并存时的优先级', () => {
  it('flag 赢,且记录的路由是 flag 而不是 approved', async () => {
    const prompt = vi.fn(async () => true)
    const rec = recorder()
    const allowed = await createDangerGate({
      allowDangerous: true,
      silent: true,
      prompt,
      onDecision: rec.onDecision,
    })(tool, args)
    expect(allowed).toBe(true)
    expect(prompt).not.toHaveBeenCalled()
    expect(rec.decisions.map((d) => d.route)).toEqual(['flag'])
  })
})

describe('提示面:silent 与默认 fail-loud 是两个档案', () => {
  it('silent:true ⇒ 闸门自身零 console 输出(现有已迁移调用方的逐路径等价前提)', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await createDangerGate({ allowDangerous: true, silent: true })(tool, args)
    await createDangerGate({ silent: true })(tool, args)
    expect(info).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('非 silent 的新调用方:flag 自动放行要喊、denied 也要喊(fail-loud,杜绝静默放/静默拒)', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await createDangerGate({ allowDangerous: true })(tool, args)
    expect(info).toHaveBeenCalledTimes(1)
    expect(String(info.mock.calls[0]?.[0])).toContain(tool.name)
    await createDangerGate({})(tool, args)
    expect(error).toHaveBeenCalledTimes(1)
    expect(String(error.mock.calls[0]?.[0])).toContain('no-prompt')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
