// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * debug 族「挂上且叫得出名」回归(2026-09-27,DEBUG_TOOLS 注册票配套)。
 *
 * 钉两件事,缺一不可:
 *  1. **挂上**:每一枚 DEBUG_TOOLS 都能从 *真实注册路径* `setupAgentTools()` 跑完后的
 *     运行时注册表取到(不是测试自己 registerTools 再自问自答 —— 摘掉
 *     `commands/agent.ts` 里那行 `registerTools(DEBUG_TOOLS)` 本用例必红,已做变异对照)。
 *  2. **叫得出名**:每一枚的名字都能在 `TOOL_DISPLAY_KEYS` 映射到 display key,且该 key 在
 *     五语言 `packages/i18n/messages/shared/<lang>.json` 的 taskStatus 里解析出**非空**值。
 *     这正是守门 55/56 的存在理由 —— 运行时兜底回显会让新工具**静默地**带着英文码名上线,
 *     只有把"注册后的运行时集合"喂给断言才拦得住"注册了但没补名"。
 *
 * 空集合不算通过:DEBUG_TOOLS 枚数必须 == 10 且逐名非空(枚举到 0 = 判据失明,不是通过)。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..', '..')
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

describe('debug 族注册 ↔ 运行时注册表 ↔ 五语言功能名', () => {
  let workspacePath: string

  beforeAll(() => {
    workspacePath = mkdtempSync(join(tmpdir(), 'ihui-debug-reg-'))
  })

  afterAll(() => {
    rmSync(workspacePath, { recursive: true, force: true })
  })

  it('setupAgentTools 之后,DEBUG_TOOLS 每一枚都能从运行时注册表取到(且是同一实例)', async () => {
    const { DEBUG_TOOLS } = await import('../src/tools/debug.js')
    expect(DEBUG_TOOLS.length).toBe(10) // 枚数漂移(有人加/删工具)必须显式改本断言,不许静默
    const { setupAgentTools } = await import('../src/commands/agent.js')
    await setupAgentTools({ workspacePath, silent: true })
    const { getTool } = await import('../src/tools/index.js')
    for (const tool of DEBUG_TOOLS) {
      expect(tool.name, '工具字面量必须有 name').toBeTruthy()
      expect(getTool(tool.name), `debug 族 ${tool.name} 未挂进运行时注册表`).toBe(tool)
    }
  })

  it('DEBUG_TOOLS 每一枚的五语言功能名解析出非空值(且 ≠ 键名回显)', async () => {
    const { DEBUG_TOOLS } = await import('../src/tools/debug.js')
    const { toolDisplayKey } = await import('@ihui/shared/chat')
    const locales = new Map<string, Record<string, unknown>>()
    for (const lang of LANGS) {
      const parsed = JSON.parse(
        readFileSync(join(repoRoot, 'packages', 'i18n', 'messages', 'shared', `${lang}.json`), 'utf8'),
      ) as { taskStatus?: Record<string, unknown> }
      locales.set(lang, parsed.taskStatus ?? {})
    }
    for (const tool of DEBUG_TOOLS) {
      const key = toolDisplayKey(tool.name)
      expect(key, `TOOL_DISPLAY_KEYS 缺 ${tool.name} 的映射`).toBeTruthy()
      for (const lang of LANGS) {
        const value = (locales.get(lang) as Record<string, unknown>)[key as string]
        expect(typeof value === 'string' && value.trim() !== '', `${lang}.${key} 必须是非空字符串`).toBe(true)
        expect(value, `${lang}.${key} 不得回显键名`).not.toBe(key)
      }
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
