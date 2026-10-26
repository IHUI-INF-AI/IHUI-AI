// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Subagent 优先级链测试 — P1-2 Subagent precedence。
 *
 * 覆盖四层优先级短路链 + fail-closed / soft degradation / enum 容错 / trim / 相对路径等特殊语义。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import {
  resolveEffectiveOverrides,
  parseCapabilityMode,
  parseIsolationMode,
  parseReasoningEffort,
  PRECEDENCE_LAYERS,
  PRECEDENCE_LAYER_LABELS,
  CONFIG_TRACE_ENV,
  formatConfigSnapshot,
  __test__ as precedenceTest,
} from '../src/subagents/precedence.js'
import type {
  SubagentRuntimeOverrides,
  SubagentRole,
  SubagentPersona,
  PersonaMap,
  ConfigFieldSource,
  EffectiveRuntimeConfig,
  ReasoningEffort,
} from '../src/subagents/types.js'

// 快照留痕默认写 stderr(生产行为);本文件除专门的留痕用例外一律关闭,避免测试输出被刷。
process.env[CONFIG_TRACE_ENV] = '0'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-prec-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

/** 在 tmpDir 下写文件,返回相对 tmpDir 的路径(用于配合 cwd=tmpDir 测试相对路径) */
function writeRel(name: string, content: string): string {
  const p = path.join(tmpDir, name)
  fs.writeFileSync(p, content, 'utf-8')
  return name
}

/** 在 tmpDir 下写文件,返回绝对路径 */
function writeAbs(name: string, content: string): string {
  const p = path.join(tmpDir, name)
  fs.writeFileSync(p, content, 'utf-8')
  return p
}

// ============================================================
// 1. explicit 层覆盖 role / persona
// ============================================================
describe('explicit 层覆盖 role / persona', () => {
  it("explicit model 胜过 role / persona 的 model", () => {
    const role: SubagentRole = { name: 'coder', model: 'sonnet' }
    const persona: SubagentPersona = { name: 'p1', model: 'haiku' }
    const personas: PersonaMap = { p1: persona }
    const overrides: SubagentRuntimeOverrides = { model: 'gpt-4', persona: 'p1' }
    const result = resolveEffectiveOverrides(overrides, role, personas, undefined, 'coder')
    expect(result.model).toBe('gpt-4')
  })

  it("explicit reasoningEffort 胜过 role / persona", () => {
    const role: SubagentRole = { name: 'coder', reasoningEffort: 'low' }
    const persona: SubagentPersona = { name: 'p1', reasoningEffort: 'minimal' }
    const personas: PersonaMap = { p1: persona }
    const overrides: SubagentRuntimeOverrides = { reasoningEffort: 'high', persona: 'p1' }
    const result = resolveEffectiveOverrides(overrides, role, personas)
    expect(result.reasoningEffort).toBe('high')
  })
})

// ============================================================
// 2. role 层覆盖 persona
// ============================================================
describe('role 层覆盖 persona', () => {
  it("无 explicit model 时 role 胜过 persona", () => {
    const role: SubagentRole = { name: 'coder', model: 'sonnet' }
    const persona: SubagentPersona = { name: 'p1', model: 'haiku' }
    const personas: PersonaMap = { p1: persona }
    const overrides: SubagentRuntimeOverrides = { persona: 'p1' }
    const result = resolveEffectiveOverrides(overrides, role, personas)
    expect(result.model).toBe('sonnet')
  })

  it("无 explicit reasoningEffort 时 role 胜过 persona", () => {
    const role: SubagentRole = { name: 'coder', reasoningEffort: 'medium' }
    const persona: SubagentPersona = { name: 'p1', reasoningEffort: 'low' }
    const personas: PersonaMap = { p1: persona }
    const overrides: SubagentRuntimeOverrides = { persona: 'p1' }
    const result = resolveEffectiveOverrides(overrides, role, personas)
    expect(result.reasoningEffort).toBe('medium')
  })
})

// ============================================================
// 3. persona 层兜底
// ============================================================
describe('persona 层兜底', () => {
  it("无 explicit / role 时 persona model 胜", () => {
    const persona: SubagentPersona = { name: 'p1', model: 'haiku' }
    const personas: PersonaMap = { p1: persona }
    const overrides: SubagentRuntimeOverrides = { persona: 'p1' }
    const result = resolveEffectiveOverrides(overrides, undefined, personas)
    expect(result.model).toBe('haiku')
  })

  it("无 explicit / role 时 persona reasoningEffort 胜", () => {
    const persona: SubagentPersona = { name: 'p1', reasoningEffort: 'high' }
    const personas: PersonaMap = { p1: persona }
    const overrides: SubagentRuntimeOverrides = { persona: 'p1' }
    const result = resolveEffectiveOverrides(overrides, undefined, personas)
    expect(result.reasoningEffort).toBe('high')
  })
})

// ============================================================
// 4. 全部缺失
// ============================================================
describe('全部缺失', () => {
  it("三层都无配置 → 字段 undefined(除 isolation='none')", () => {
    const result = resolveEffectiveOverrides({}, undefined, {})
    expect(result.model).toBeUndefined()
    expect(result.reasoningEffort).toBeUndefined()
    expect(result.capabilityMode).toBeUndefined()
    expect(result.persona).toBeUndefined()
    expect(result.personaInstructions).toBeUndefined()
    expect(result.rolePrompt).toBeUndefined()
    expect(result.roleName).toBeUndefined()
    expect(result.isolation).toBe('none')
    expect(result.personaError).toBeUndefined()
    expect(result.rolePromptWarning).toBeUndefined()
  })
})

// ============================================================
// 5. capabilityMode 不从 persona 级联
// ============================================================
describe('capabilityMode 不从 persona 级联', () => {
  it("explicit 缺 + role 缺 → capabilityMode=undefined,即使 persona 有其他字段", () => {
    // SubagentPersona 类型本身不含 capabilityMode 字段,这里证明 persona 层不参与级联
    const persona: SubagentPersona = { name: 'p1', model: 'haiku', defaultIsolation: 'worktree' }
    const personas: PersonaMap = { p1: persona }
    const overrides: SubagentRuntimeOverrides = { persona: 'p1' }
    const result = resolveEffectiveOverrides(overrides, undefined, personas)
    expect(result.capabilityMode).toBeUndefined()
  })

  it("explicit 缺 + role 有 defaultCapabilityMode → role 胜", () => {
    const role: SubagentRole = { name: 'coder', defaultCapabilityMode: 'read-only' }
    const result = resolveEffectiveOverrides({}, role, {})
    expect(result.capabilityMode).toBe('read-only')
  })
})

// ============================================================
// 6. persona 字段只走 explicit
// ============================================================
describe('persona 字段只走 explicit', () => {
  it("overrides.persona 缺失 → persona 字段 undefined(不反向查找 personas map)", () => {
    const personas: PersonaMap = {
      p1: { name: 'p1', model: 'haiku' },
      p2: { name: 'p2', model: 'sonnet' },
    }
    const result = resolveEffectiveOverrides({}, undefined, personas)
    expect(result.persona).toBeUndefined()
    // 同时 persona 配置不会被加载(personaInstructions 为 undefined)
    expect(result.personaInstructions).toBeUndefined()
  })
})

// ============================================================
// 7. persona instructions 加载
// ============================================================
describe('persona instructions 加载', () => {
  it("从 instructionsFile 读取 → personaInstructions 填充", () => {
    const rel = writeRel('persona-inst.md', '你是研究员')
    const persona: SubagentPersona = { name: 'p1', instructionsFile: rel }
    const personas: PersonaMap = { p1: persona }
    const overrides: SubagentRuntimeOverrides = { persona: 'p1' }
    const result = resolveEffectiveOverrides(overrides, undefined, personas, tmpDir)
    expect(result.personaInstructions).toBe('你是研究员')
    expect(result.personaError).toBeUndefined()
  })

  it("内嵌 instructions 优先于 instructionsFile", () => {
    writeRel('persona-inst.md', '文件内容')
    const persona: SubagentPersona = {
      name: 'p1',
      instructions: '内嵌内容',
      instructionsFile: 'persona-inst.md',
    }
    const personas: PersonaMap = { p1: persona }
    const result = resolveEffectiveOverrides({ persona: 'p1' }, undefined, personas, tmpDir)
    expect(result.personaInstructions).toBe('内嵌内容')
  })
})

// ============================================================
// 8. persona instructionsFile 失败(fail-closed)
// ============================================================
describe('persona instructionsFile 失败', () => {
  it("文件不存在 → personaError 记录,其他字段正常解析", () => {
    const persona: SubagentPersona = {
      name: 'p1',
      model: 'haiku',
      instructionsFile: 'not-exist.md',
    }
    const personas: PersonaMap = { p1: persona }
    const overrides: SubagentRuntimeOverrides = { persona: 'p1' }
    const result = resolveEffectiveOverrides(overrides, undefined, personas, tmpDir)
    expect(result.personaError).toBeTruthy()
    expect(result.personaInstructions).toBeUndefined()
    // 其他字段仍从 persona 正常解析
    expect(result.model).toBe('haiku')
    expect(result.isolation).toBe('none')
  })

  it("personaError 不抛异常(吞掉 I/O 错误)", () => {
    const persona: SubagentPersona = { name: 'p1', instructionsFile: '/forbidden/path/x.md' }
    const personas: PersonaMap = { p1: persona }
    expect(() => resolveEffectiveOverrides({ persona: 'p1' }, undefined, personas, tmpDir)).not.toThrow()
  })
})

// ============================================================
// 9. role prompt 加载
// ============================================================
describe('role prompt 加载', () => {
  it("从 promptFile 读取 → rolePrompt 填充", () => {
    const rel = writeRel('role-prompt.md', '你是 coder')
    const role: SubagentRole = { name: 'coder', promptFile: rel }
    const result = resolveEffectiveOverrides({}, role, {}, tmpDir, 'coder')
    expect(result.rolePrompt).toBe('你是 coder')
    expect(result.rolePromptWarning).toBeUndefined()
  })

  it("promptFile 优先于内嵌 prompt", () => {
    writeRel('role-prompt.md', '文件 prompt')
    const role: SubagentRole = {
      name: 'coder',
      prompt: '内嵌 prompt',
      promptFile: 'role-prompt.md',
    }
    const result = resolveEffectiveOverrides({}, role, {}, tmpDir, 'coder')
    expect(result.rolePrompt).toBe('文件 prompt')
  })

  it("无 promptFile 时用内嵌 prompt", () => {
    const role: SubagentRole = { name: 'coder', prompt: '内嵌 prompt' }
    const result = resolveEffectiveOverrides({}, role, {}, tmpDir, 'coder')
    expect(result.rolePrompt).toBe('内嵌 prompt')
  })
})

// ============================================================
// 10. role promptFile 失败(soft degradation)
// ============================================================
describe('role promptFile 失败', () => {
  it("文件不存在 → rolePromptWarning 记录,继续解析其他字段", () => {
    const role: SubagentRole = {
      name: 'coder',
      model: 'sonnet',
      promptFile: 'not-exist.md',
    }
    const result = resolveEffectiveOverrides({}, role, {}, tmpDir, 'coder')
    expect(result.rolePromptWarning).toBeTruthy()
    expect(result.rolePrompt).toBeUndefined()
    // 其他字段仍正常解析
    expect(result.model).toBe('sonnet')
    expect(result.roleName).toBe('coder')
  })

  it("rolePromptWarning 不抛异常", () => {
    const role: SubagentRole = { name: 'coder', promptFile: '/forbidden/path/x.md' }
    expect(() => resolveEffectiveOverrides({}, role, {}, tmpDir, 'coder')).not.toThrow()
  })
})

// ============================================================
// 11. isolation 默认 'none'
// ============================================================
describe('isolation 默认 none', () => {
  it("三层都没指定 → isolation='none'", () => {
    const result = resolveEffectiveOverrides({}, undefined, {})
    expect(result.isolation).toBe('none')
  })

  it("explicit isolation 胜过 role / persona", () => {
    const role: SubagentRole = { name: 'coder', defaultIsolation: 'worktree' }
    const persona: SubagentPersona = { name: 'p1', defaultIsolation: 'subprocess' }
    const personas: PersonaMap = { p1: persona }
    const overrides: SubagentRuntimeOverrides = { isolation: 'none', persona: 'p1' }
    const result = resolveEffectiveOverrides(overrides, role, personas)
    expect(result.isolation).toBe('none')
  })

  it("role defaultIsolation 胜过 persona", () => {
    const role: SubagentRole = { name: 'coder', defaultIsolation: 'worktree' }
    const persona: SubagentPersona = { name: 'p1', defaultIsolation: 'subprocess' }
    const personas: PersonaMap = { p1: persona }
    const overrides: SubagentRuntimeOverrides = { persona: 'p1' }
    const result = resolveEffectiveOverrides(overrides, role, personas)
    expect(result.isolation).toBe('worktree')
  })

  it("persona defaultIsolation 兜底", () => {
    const persona: SubagentPersona = { name: 'p1', defaultIsolation: 'subprocess' }
    const personas: PersonaMap = { p1: persona }
    const result = resolveEffectiveOverrides({ persona: 'p1' }, undefined, personas)
    expect(result.isolation).toBe('subprocess')
  })
})

// ============================================================
// 12. enum 容错:capabilityMode 无效值
// ============================================================
describe('enum 容错 capabilityMode', () => {
  it("explicit capabilityMode='invalid' → undefined(让下层接手)", () => {
    const role: SubagentRole = { name: 'coder', defaultCapabilityMode: 'read-only' }
    // 用 as 绕过编译期类型检查,模拟运行时从 JSON 接收非法值
    const overrides = { capabilityMode: 'invalid' as 'read-only' }
    const result = resolveEffectiveOverrides(overrides, role, {})
    // invalid 被吞,role 的 read-only 胜出
    expect(result.capabilityMode).toBe('read-only')
  })

  it("explicit capabilityMode='invalid' + role 无 → undefined", () => {
    const overrides = { capabilityMode: 'invalid' as 'read-only' }
    const result = resolveEffectiveOverrides(overrides, undefined, {})
    expect(result.capabilityMode).toBeUndefined()
  })
})

// ============================================================
// 13. 字符串 trim
// ============================================================
describe('字符串 trim', () => {
  it("persona instructionsFile 内容首尾空白被 trim", () => {
    const rel = writeRel('inst.md', '\n\n  你是研究员  \n\n')
    const persona: SubagentPersona = { name: 'p1', instructionsFile: rel }
    const personas: PersonaMap = { p1: persona }
    const result = resolveEffectiveOverrides({ persona: 'p1' }, undefined, personas, tmpDir)
    expect(result.personaInstructions).toBe('你是研究员')
  })

  it("role promptFile 内容首尾空白被 trim", () => {
    const rel = writeRel('prompt.md', '\t\n  你是 coder  \n\t')
    const role: SubagentRole = { name: 'coder', promptFile: rel }
    const result = resolveEffectiveOverrides({}, role, {}, tmpDir, 'coder')
    expect(result.rolePrompt).toBe('你是 coder')
  })

  it("内嵌文本不 trim(保留原样)", () => {
    const role: SubagentRole = { name: 'coder', prompt: '  带空格的 prompt  ' }
    const result = resolveEffectiveOverrides({}, role, {}, tmpDir, 'coder')
    expect(result.rolePrompt).toBe('  带空格的 prompt  ')
  })
})

// ============================================================
// 14. 相对路径解析
// ============================================================
describe('相对路径解析', () => {
  it("promptFile 相对 cwd 解析", () => {
    // 写到 tmpDir/sub/role-prompt.md,promptFile 用相对路径 'sub/role-prompt.md'
    fs.mkdirSync(path.join(tmpDir, 'sub'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'sub', 'role-prompt.md'), '子目录内容', 'utf-8')
    const role: SubagentRole = { name: 'coder', promptFile: 'sub/role-prompt.md' }
    const result = resolveEffectiveOverrides({}, role, {}, tmpDir, 'coder')
    expect(result.rolePrompt).toBe('子目录内容')
  })

  it("instructionsFile 相对 cwd 解析", () => {
    fs.mkdirSync(path.join(tmpDir, 'p'), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, 'p', 'inst.md'), '相对 persona', 'utf-8')
    const persona: SubagentPersona = { name: 'p1', instructionsFile: 'p/inst.md' }
    const personas: PersonaMap = { p1: persona }
    const result = resolveEffectiveOverrides({ persona: 'p1' }, undefined, personas, tmpDir)
    expect(result.personaInstructions).toBe('相对 persona')
  })

  it("promptFile 绝对路径也能读取", () => {
    const abs = writeAbs('abs-prompt.md', '绝对路径内容')
    const role: SubagentRole = { name: 'coder', promptFile: abs }
    const result = resolveEffectiveOverrides({}, role, {}, tmpDir, 'coder')
    expect(result.rolePrompt).toBe('绝对路径内容')
  })
})

// ============================================================
// 15. role undefined
// ============================================================
describe('role undefined', () => {
  it("传入 undefined role 不报错,rolePrompt/roleName 为 undefined", () => {
    const result = resolveEffectiveOverrides({}, undefined, {})
    expect(result.rolePrompt).toBeUndefined()
    expect(result.roleName).toBeUndefined()
    expect(result.rolePromptWarning).toBeUndefined()
  })

  it("role undefined + persona 存在 → persona 兜底", () => {
    const persona: SubagentPersona = { name: 'p1', model: 'haiku' }
    const personas: PersonaMap = { p1: persona }
    const result = resolveEffectiveOverrides({ persona: 'p1' }, undefined, personas)
    expect(result.model).toBe('haiku')
  })
})

// ============================================================
// 16. persona 未找到
// ============================================================
describe('persona 未找到', () => {
  it("overrides.persona='unknown' → personaError 记录,其他字段不受影响", () => {
    const role: SubagentRole = { name: 'coder', model: 'sonnet' }
    const overrides: SubagentRuntimeOverrides = { persona: 'unknown' }
    const result = resolveEffectiveOverrides(overrides, role, {})
    expect(result.personaError).toContain('persona not found')
    expect(result.personaError).toContain('unknown')
    // 其他字段仍正常解析(role 兜底)
    expect(result.model).toBe('sonnet')
    expect(result.persona).toBe('unknown')
    expect(result.personaInstructions).toBeUndefined()
  })
})

// ============================================================
// 17. 全 explicit override
// ============================================================
describe('全 explicit override', () => {
  it("所有字段都 explicit → role / persona 完全不影响结果", () => {
    const role: SubagentRole = {
      name: 'coder',
      model: 'role-model',
      reasoningEffort: 'low',
      defaultCapabilityMode: 'read-only',
      defaultIsolation: 'worktree',
      prompt: 'role prompt',
    }
    const persona: SubagentPersona = {
      name: 'p1',
      model: 'persona-model',
      reasoningEffort: 'minimal',
      defaultIsolation: 'subprocess',
    }
    const personas: PersonaMap = { p1: persona }
    const overrides: SubagentRuntimeOverrides = {
      model: 'explicit-model',
      reasoningEffort: 'high',
      capabilityMode: 'all',
      isolation: 'none',
      persona: 'p1',
    }
    const result = resolveEffectiveOverrides(overrides, role, personas, undefined, 'coder')
    expect(result.model).toBe('explicit-model')
    expect(result.reasoningEffort).toBe('high')
    expect(result.capabilityMode).toBe('all')
    expect(result.isolation).toBe('none')
    expect(result.persona).toBe('p1')
  })
})

// ============================================================
// 18. empty overrides
// ============================================================
describe('empty overrides', () => {
  it("{} 传入 → 全部走 role / persona / 默认", () => {
    const role: SubagentRole = {
      name: 'coder',
      model: 'sonnet',
      reasoningEffort: 'medium',
      defaultCapabilityMode: 'read-write',
      defaultIsolation: 'worktree',
    }
    const persona: SubagentPersona = { name: 'p1', model: 'haiku', defaultIsolation: 'subprocess' }
    const personas: PersonaMap = { p1: persona }
    const result = resolveEffectiveOverrides({}, role, personas, undefined, 'coder')
    // role 胜过 persona
    expect(result.model).toBe('sonnet')
    expect(result.reasoningEffort).toBe('medium')
    expect(result.capabilityMode).toBe('read-write')
    expect(result.isolation).toBe('worktree')
    // persona 字段为 undefined(无 explicit)
    expect(result.persona).toBeUndefined()
    expect(result.roleName).toBe('coder')
  })
})

// ============================================================
// 19. parseCapabilityMode
// ============================================================
describe('parseCapabilityMode', () => {
  it("合法值原样返回", () => {
    expect(parseCapabilityMode('read-only')).toBe('read-only')
    expect(parseCapabilityMode('read-write')).toBe('read-write')
    expect(parseCapabilityMode('execute')).toBe('execute')
    expect(parseCapabilityMode('all')).toBe('all')
  })

  it("非法值返回 undefined", () => {
    expect(parseCapabilityMode('invalid')).toBeUndefined()
    expect(parseCapabilityMode('READ-ONLY')).toBeUndefined() // 大小写敏感
    expect(parseCapabilityMode('')).toBeUndefined()
  })

  it("undefined 返回 undefined", () => {
    expect(parseCapabilityMode(undefined)).toBeUndefined()
  })
})

// ============================================================
// 20. parseIsolationMode
// ============================================================
describe('parseIsolationMode', () => {
  it("合法值原样返回", () => {
    expect(parseIsolationMode('none')).toBe('none')
    expect(parseIsolationMode('worktree')).toBe('worktree')
    expect(parseIsolationMode('subprocess')).toBe('subprocess')
  })

  it("非法值返回 undefined", () => {
    expect(parseIsolationMode('invalid')).toBeUndefined()
    expect(parseIsolationMode('chroot')).toBeUndefined()
    expect(parseIsolationMode('')).toBeUndefined()
  })

  it("undefined 返回 undefined", () => {
    expect(parseIsolationMode(undefined)).toBeUndefined()
  })
})

// ============================================================
// 补充:parseReasoningEffort
// ============================================================
describe('parseReasoningEffort', () => {
  it("合法值原样返回", () => {
    expect(parseReasoningEffort('minimal')).toBe('minimal')
    expect(parseReasoningEffort('low')).toBe('low')
    expect(parseReasoningEffort('medium')).toBe('medium')
    expect(parseReasoningEffort('high')).toBe('high')
  })

  it("非法值 / undefined 返回 undefined", () => {
    expect(parseReasoningEffort('invalid')).toBeUndefined()
    expect(parseReasoningEffort('HIGH')).toBeUndefined()
    expect(parseReasoningEffort(undefined)).toBeUndefined()
  })
})

// ============================================================
// 21. G-395 出处标签:四层各命中一次 ⇒ sources 正确
// ============================================================
describe('G-395 sources 出处标签 — 四层各命中一次', () => {
  it('model 四层:explicit 命中 → layer=explicit + 覆盖项出处', () => {
    const role: SubagentRole = { name: 'coder', model: 'sonnet' }
    const persona: SubagentPersona = { name: 'p1', model: 'haiku' }
    const result = resolveEffectiveOverrides(
      { model: 'gpt-4', persona: 'p1' },
      role,
      { p1: persona },
      undefined,
      'coder',
    )
    expect(result.sources.model).toEqual({ layer: 'explicit', origin: 'overrides.model' })
  })

  it('model 四层:role 命中 → layer=role + role[name].model 出处', () => {
    const role: SubagentRole = { name: 'coder', model: 'sonnet' }
    const persona: SubagentPersona = { name: 'p1', model: 'haiku' }
    const result = resolveEffectiveOverrides({ persona: 'p1' }, role, { p1: persona })
    expect(result.sources.model).toEqual({ layer: 'role', origin: 'role[coder].model' })
  })

  it('model 四层:persona 命中 → layer=persona + persona[name].model 出处', () => {
    const persona: SubagentPersona = { name: 'p1', model: 'haiku' }
    const result = resolveEffectiveOverrides({ persona: 'p1' }, undefined, { p1: persona })
    expect(result.sources.model).toEqual({ layer: 'persona', origin: 'persona[p1].model' })
  })

  it('model 四层:parent 兜底 → layer=parent(继承父 session)', () => {
    const result = resolveEffectiveOverrides({}, undefined, {})
    expect(result.sources.model).toEqual({ layer: 'parent', origin: 'parent(inherit)' })
  })

  it('reasoningEffort 四层:explicit / role / persona / parent 各命中一次', () => {
    const persona: SubagentPersona = { name: 'p1', reasoningEffort: 'minimal' }
    const personas: PersonaMap = { p1: persona }
    const role: SubagentRole = { name: 'coder', reasoningEffort: 'low' }

    const byExplicit = resolveEffectiveOverrides({ reasoningEffort: 'high', persona: 'p1' }, role, personas)
    expect(byExplicit.sources.reasoningEffort).toEqual({
      layer: 'explicit',
      origin: 'overrides.reasoningEffort',
    })

    const byRole = resolveEffectiveOverrides({ persona: 'p1' }, role, personas)
    expect(byRole.sources.reasoningEffort).toEqual({ layer: 'role', origin: 'role[coder].reasoningEffort' })

    const byPersona = resolveEffectiveOverrides({ persona: 'p1' }, undefined, personas)
    expect(byPersona.sources.reasoningEffort).toEqual({
      layer: 'persona',
      origin: 'persona[p1].reasoningEffort',
    })

    const byParent = resolveEffectiveOverrides({}, undefined, {})
    expect(byParent.sources.reasoningEffort).toEqual({ layer: 'parent', origin: 'parent(inherit)' })
  })

  it('capabilityMode:explicit 命中;非法 explicit 被容错后出处标签归 role 层', () => {
    const role: SubagentRole = { name: 'coder', defaultCapabilityMode: 'read-only' }
    const byExplicit = resolveEffectiveOverrides({ capabilityMode: 'all' }, role, {})
    expect(byExplicit.sources.capabilityMode).toEqual({
      layer: 'explicit',
      origin: 'overrides.capabilityMode',
    })

    const overrides = { capabilityMode: 'invalid' as 'all' }
    const byRole = resolveEffectiveOverrides(overrides, role, {})
    expect(byRole.capabilityMode).toBe('read-only')
    expect(byRole.sources.capabilityMode).toEqual({
      layer: 'role',
      origin: 'role[coder].defaultCapabilityMode',
    })
  })

  it('isolation 四层:explicit / role / persona 命中,全空时 parent 默认 none', () => {
    const role: SubagentRole = { name: 'coder', defaultIsolation: 'worktree' }
    const persona: SubagentPersona = { name: 'p1', defaultIsolation: 'subprocess' }
    const personas: PersonaMap = { p1: persona }

    const byExplicit = resolveEffectiveOverrides({ isolation: 'none', persona: 'p1' }, role, personas)
    expect(byExplicit.sources.isolation).toEqual({ layer: 'explicit', origin: 'overrides.isolation' })

    const byRole = resolveEffectiveOverrides({ persona: 'p1' }, role, personas)
    expect(byRole.sources.isolation).toEqual({ layer: 'role', origin: 'role[coder].defaultIsolation' })

    const byPersona = resolveEffectiveOverrides({ persona: 'p1' }, undefined, personas)
    expect(byPersona.sources.isolation).toEqual({
      layer: 'persona',
      origin: 'persona[p1].defaultIsolation',
    })

    const byParent = resolveEffectiveOverrides({}, undefined, {})
    expect(byParent.isolation).toBe('none')
    expect(byParent.sources.isolation).toEqual({ layer: 'parent', origin: 'default:none' })
  })

  it('内容出处:instructionsFile / promptFile 带来源文件路径', () => {
    const rel = writeRel('g395-inst.md', '研究员指令')
    const persona: SubagentPersona = { name: 'p1', instructionsFile: rel }
    const promptRel = writeRel('g395-prompt.md', 'coder 提示')
    const role: SubagentRole = { name: 'coder', promptFile: promptRel }
    const result = resolveEffectiveOverrides({ persona: 'p1' }, role, { p1: persona }, tmpDir, 'coder')
    expect(result.sources.personaInstructions?.layer).toBe('persona')
    expect(result.sources.personaInstructions?.origin).toContain('persona[p1].instructionsFile:')
    expect(result.sources.personaInstructions?.origin).toContain('g395-inst.md')
    expect(result.sources.rolePrompt?.layer).toBe('role')
    expect(result.sources.rolePrompt?.origin).toContain('role[coder].promptFile:')
    expect(result.sources.rolePrompt?.origin).toContain('g395-prompt.md')
  })

  it('内容出处:内嵌 instructions / prompt 标内嵌项,无内容时缺省', () => {
    const persona: SubagentPersona = { name: 'p1', instructions: '内嵌' }
    const role: SubagentRole = { name: 'coder', prompt: '内嵌 prompt' }
    const withInline = resolveEffectiveOverrides({ persona: 'p1' }, role, { p1: persona })
    expect(withInline.sources.personaInstructions).toEqual({
      layer: 'persona',
      origin: 'persona[p1].instructions',
    })
    expect(withInline.sources.rolePrompt).toEqual({ layer: 'role', origin: 'role[coder].prompt' })

    const empty = resolveEffectiveOverrides({}, undefined, {})
    expect(empty.sources.personaInstructions).toBeUndefined()
    expect(empty.sources.rolePrompt).toBeUndefined()
  })
})

// ============================================================
// 22. G-395 请求档 vs 实得档:降档发生 ⇒ requested≠effective 可见
// ============================================================
describe('G-395 effortDowngrade 降档留痕', () => {
  it('非法 explicit 请求档被容错丢弃 → 留痕 requested≠effective,双方出处可见', () => {
    const role: SubagentRole = { name: 'coder', reasoningEffort: 'low' }
    // 模拟运行时从 JSON 收到非法档位(as 绕过编译期)
    const overrides = { reasoningEffort: 'ultra' as 'high' }
    const result = resolveEffectiveOverrides(overrides, role, {})
    expect(result.reasoningEffort).toBe('low')
    expect(result.effortDowngrade).toBeDefined()
    expect(result.effortDowngrade!.requested).toBe('ultra')
    expect(result.effortDowngrade!.effective).toBe('low')
    expect(result.effortDowngrade!.requested).not.toBe(result.effortDowngrade!.effective)
    expect(result.effortDowngrade!.reason).toBe('invalid-enum')
    expect(result.effortDowngrade!.requestedSource).toEqual({
      layer: 'explicit',
      origin: 'overrides.reasoningEffort',
    })
    expect(result.effortDowngrade!.effectiveSource).toEqual({
      layer: 'role',
      origin: 'role[coder].reasoningEffort',
    })
  })

  it('非法请求档且四层皆空 → 留痕 effective=undefined(请求彻底落空)', () => {
    const overrides = { reasoningEffort: 'turbo' as 'high' }
    const result = resolveEffectiveOverrides(overrides, undefined, {})
    expect(result.reasoningEffort).toBeUndefined()
    expect(result.effortDowngrade).toBeDefined()
    expect(result.effortDowngrade!.requested).toBe('turbo')
    expect(result.effortDowngrade!.effective).toBeUndefined()
    expect(result.effortDowngrade!.reason).toBe('invalid-enum')
    expect(result.effortDowngrade!.effectiveSource).toEqual({
      layer: 'parent',
      origin: 'parent(inherit)',
    })
  })

  it('role 层非法请求档(persona 合法接手)→ 留痕归因到 role 出处', () => {
    const persona: SubagentPersona = { name: 'p1', reasoningEffort: 'medium' }
    const role = { name: 'coder', reasoningEffort: 'mega' as 'high' }
    const result = resolveEffectiveOverrides({ persona: 'p1' }, role, { p1: persona })
    expect(result.reasoningEffort).toBe('medium')
    expect(result.effortDowngrade).toBeDefined()
    expect(result.effortDowngrade!.requested).toBe('mega')
    expect(result.effortDowngrade!.requestedSource).toEqual({
      layer: 'role',
      origin: 'role[coder].reasoningEffort',
    })
    expect(result.effortDowngrade!.effectiveSource).toEqual({
      layer: 'persona',
      origin: 'persona[p1].reasoningEffort',
    })
  })

  it('合法请求档被原样采纳 → 无留痕(降档未发生)', () => {
    const role: SubagentRole = { name: 'coder', reasoningEffort: 'low' }
    const result = resolveEffectiveOverrides({ reasoningEffort: 'high' }, role, {})
    expect(result.reasoningEffort).toBe('high')
    expect(result.effortDowngrade).toBeUndefined()
  })

  it('未给请求档 → 无留痕(不存在降档)', () => {
    const role: SubagentRole = { name: 'coder', reasoningEffort: 'low' }
    const result = resolveEffectiveOverrides({}, role, {})
    expect(result.reasoningEffort).toBe('low')
    expect(result.effortDowngrade).toBeUndefined()
  })
})

// ============================================================
// 23. G-395 四层优先级回归锁(先钉行为,再加出处标签 / 快照修订号)
//     锁的是"每层胜出者逐字不变":加 source / sourceRevisions 之后本段断言必须原样仍绿。
// ============================================================
describe('G-395 四层优先级回归锁(行为零变化基线)', () => {
  const lockRole: SubagentRole = {
    name: 'coder',
    model: 'sonnet',
    reasoningEffort: 'low',
    defaultCapabilityMode: 'read-only',
    defaultIsolation: 'worktree',
  }
  const lockPersona: SubagentPersona = {
    name: 'p1',
    model: 'haiku',
    reasoningEffort: 'minimal',
    defaultIsolation: 'subprocess',
  }
  const lockPersonas: PersonaMap = { p1: lockPersona }
  const withAll: SubagentRuntimeOverrides = {
    model: 'gpt-4',
    reasoningEffort: 'high',
    persona: 'p1',
    capabilityMode: 'all',
    isolation: 'none',
  }
  /** 同一份 withAll 派生各层场景(防各场景的基准值漂开) */
  const without = (...keys: (keyof SubagentRuntimeOverrides)[]): SubagentRuntimeOverrides => {
    const copy: SubagentRuntimeOverrides = { ...withAll }
    for (const k of keys) delete (copy as Record<string, unknown>)[k]
    return copy
  }

  it('model:explicit → role → persona → parent(undefined)', () => {
    expect(resolveEffectiveOverrides(withAll, lockRole, lockPersonas).model).toBe('gpt-4')
    expect(resolveEffectiveOverrides(without('model'), lockRole, lockPersonas).model).toBe('sonnet')
    expect(resolveEffectiveOverrides(without('model'), undefined, lockPersonas).model).toBe('haiku')
    expect(resolveEffectiveOverrides({}, undefined, {}).model).toBeUndefined()
  })

  it('reasoningEffort:explicit → role → persona → parent(undefined)', () => {
    expect(resolveEffectiveOverrides(withAll, lockRole, lockPersonas).reasoningEffort).toBe('high')
    expect(resolveEffectiveOverrides(without('reasoningEffort'), lockRole, lockPersonas).reasoningEffort).toBe('low')
    expect(
      resolveEffectiveOverrides(without('reasoningEffort'), undefined, lockPersonas).reasoningEffort,
    ).toBe('minimal')
    expect(resolveEffectiveOverrides({}, undefined, {}).reasoningEffort).toBeUndefined()
  })

  it('capabilityMode:explicit → role → parent(undefined;不从 persona 级联)', () => {
    expect(resolveEffectiveOverrides(withAll, lockRole, lockPersonas).capabilityMode).toBe('all')
    expect(
      resolveEffectiveOverrides(without('capabilityMode'), lockRole, lockPersonas).capabilityMode,
    ).toBe('read-only')
    // persona 没有 capabilityMode 档,链直接落到 parent ⇒ undefined
    expect(
      resolveEffectiveOverrides(without('capabilityMode'), undefined, lockPersonas).capabilityMode,
    ).toBeUndefined()
    expect(resolveEffectiveOverrides({}, undefined, {}).capabilityMode).toBeUndefined()
  })

  it('isolation:explicit → role → persona → 默认 none(从不为 undefined)', () => {
    expect(resolveEffectiveOverrides(withAll, lockRole, lockPersonas).isolation).toBe('none')
    expect(resolveEffectiveOverrides(without('isolation'), lockRole, lockPersonas).isolation).toBe(
      'worktree',
    )
    expect(
      resolveEffectiveOverrides(without('isolation'), undefined, lockPersonas).isolation,
    ).toBe('subprocess')
    expect(resolveEffectiveOverrides({}, undefined, {}).isolation).toBe('none')
  })

  it('短路不移位:explicit 命中时 role / persona 的值不得渗入任何字段', () => {
    const r = resolveEffectiveOverrides(withAll, lockRole, lockPersonas)
    expect({ model: r.model, reasoningEffort: r.reasoningEffort, capabilityMode: r.capabilityMode, isolation: r.isolation }).toEqual({
      model: 'gpt-4',
      reasoningEffort: 'high',
      capabilityMode: 'all',
      isolation: 'none',
    })
    expect(r.roleName).toBeUndefined()
  })
})

// ============================================================
// 24. G-395 快照修订号 sourceRevisions + 留痕出口(消费方)
// ============================================================
describe('G-395 sourceRevisions 快照修订号', () => {
  it('取到真实来源文件 ⇒ file=绝对路径 + revision=mtime ISO(不是 0 / 空串)', () => {
    const instRel = writeRel('g395-rev-inst.md', '指令')
    const promptRel = writeRel('g395-rev-prompt.md', '提示')
    const persona: SubagentPersona = { name: 'p1', instructionsFile: instRel }
    const role: SubagentRole = { name: 'coder', promptFile: promptRel }
    const r = resolveEffectiveOverrides({ persona: 'p1' }, role, { p1: persona }, tmpDir, 'coder')

    const instAbs = path.join(tmpDir, instRel)
    const promptAbs = path.join(tmpDir, promptRel)
    expect(r.sourceRevisions.persona).toEqual({
      file: instAbs,
      revision: fs.statSync(instAbs).mtime.toISOString(),
      unavailable: null,
    })
    expect(r.sourceRevisions.role).toEqual({
      file: promptAbs,
      revision: fs.statSync(promptAbs).mtime.toISOString(),
      unavailable: null,
    })
  })

  it('结构上无来源文件的层 ⇒ file/revision 双 null + 原因码 no-file-source(点名不冒充)', () => {
    const r = resolveEffectiveOverrides({}, undefined, {})
    expect(r.sourceRevisions.explicit).toEqual({
      file: null,
      revision: null,
      unavailable: 'no-file-source',
    })
    expect(r.sourceRevisions.parent).toEqual({
      file: null,
      revision: null,
      unavailable: 'no-file-source',
    })
    // 内嵌 instructions / prompt 也不是文件来源 ⇒ 同为 no-file-source
    const inline = resolveEffectiveOverrides(
      { persona: 'p1' },
      { name: 'coder', prompt: '内嵌' },
      { p1: { name: 'p1', instructions: '内嵌' } },
    )
    expect(inline.sourceRevisions.persona.unavailable).toBe('no-file-source')
    expect(inline.sourceRevisions.role.unavailable).toBe('no-file-source')
  })

  it('读了文件但取不到 mtime ⇒ revision=null + 原因码 stat-failed(不回落当前时刻)', () => {
    const instRel = writeRel('g395-rev-gone.md', 'x')
    const persona: SubagentPersona = { name: 'p1', instructionsFile: instRel }
    const r = resolveEffectiveOverrides(
      { persona: 'p1' },
      undefined,
      { p1: persona },
      tmpDir,
      undefined,
      { revisionReader: () => ({ revision: null, reason: 'stat-failed' }) },
    )
    expect(r.sourceRevisions.persona).toEqual({
      file: path.join(tmpDir, instRel),
      revision: null,
      unavailable: 'stat-failed',
    })
  })

  it('修订号是新增字段,不改变任何既有字段(逐字段对拍)', () => {
    const role: SubagentRole = { name: 'coder', model: 'sonnet', defaultIsolation: 'worktree' }
    const persona: SubagentPersona = { name: 'p1', model: 'haiku', reasoningEffort: 'minimal' }
    const r = resolveEffectiveOverrides({ persona: 'p1' }, role, { p1: persona }, undefined, 'coder')
    expect({ ...r, sourceRevisions: undefined }).toMatchObject({
      model: 'sonnet',
      reasoningEffort: 'minimal',
      capabilityMode: undefined,
      isolation: 'worktree',
      roleName: 'coder',
      persona: 'p1',
    })
    expect(r.sourceRevisions).toBeDefined()
  })
})

describe('G-395 快照留痕出口(sourceRevisions 的真实消费者)', () => {
  it('注入 sink ⇒ 只写一行,含获胜层与四层修订号(null 带原因码)', () => {
    const lines: string[] = []
    const r = resolveEffectiveOverrides({ model: 'gpt-4' }, undefined, {}, undefined, undefined, {
      traceSink: (line) => lines.push(line),
    })
    expect(lines).toHaveLength(1)
    expect(lines[0]).toBe(formatConfigSnapshot(r))
    expect(lines[0]).toContain('winners=model:explicit')
    expect(lines[0]).toContain('explicit=null(no-file-source)')
    expect(lines[0]).toContain('parent=null(no-file-source)')
    expect(lines[0]?.endsWith('\n')).toBe(true)
  })

  it('默认出口 = stderr;IHUI_SUBAGENT_CONFIG_TRACE=0 时不写', () => {
    const prev = process.env[CONFIG_TRACE_ENV]
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      delete process.env[CONFIG_TRACE_ENV]
      resolveEffectiveOverrides({}, undefined, {})
      expect(writeSpy).toHaveBeenCalledTimes(1)
      expect(String(writeSpy.mock.calls[0]?.[0])).toContain('config snapshot(G-395)')

      writeSpy.mockClear()
      process.env[CONFIG_TRACE_ENV] = '0'
      resolveEffectiveOverrides({}, undefined, {})
      expect(writeSpy).not.toHaveBeenCalled()
    } finally {
      writeSpy.mockRestore()
      if (prev === undefined) delete process.env[CONFIG_TRACE_ENV]
      else process.env[CONFIG_TRACE_ENV] = prev
    }
  })

  it('sink=null ⇒ 明确不写(逃生出口),且解析结果照常完整', () => {
    const lines: string[] = []
    const r = resolveEffectiveOverrides({}, undefined, {}, undefined, undefined, {
      traceSink: null,
    })
    expect(lines).toHaveLength(0)
    expect(r.sourceRevisions.parent.unavailable).toBe('no-file-source')
  })
})

describe('G-395 层名清单单一真相源', () => {
  it('四层顺序、标签键集与 sourceRevisions 键集三面一致', () => {
    expect(PRECEDENCE_LAYERS).toEqual(['explicit', 'role', 'persona', 'parent'])
    expect(Object.keys(PRECEDENCE_LAYER_LABELS).sort()).toEqual([...PRECEDENCE_LAYERS].sort())
    expect(Object.values(PRECEDENCE_LAYER_LABELS).every((label) => label.length > 0)).toBe(true)
    const r = resolveEffectiveOverrides({}, undefined, {})
    expect(Object.keys(r.sourceRevisions).sort()).toEqual([...PRECEDENCE_LAYERS].sort())
  })

  it('四层全空 ⇒ sources 全部显式落在 parent 默认档(不猜测、不缺字段)', () => {
    const r = resolveEffectiveOverrides({}, undefined, {})
    for (const field of ['model', 'reasoningEffort', 'capabilityMode'] as const) {
      expect(r.sources[field]).toEqual({ layer: 'parent', origin: 'parent(inherit)' })
    }
    expect(r.sources.isolation).toEqual({ layer: 'parent', origin: 'default:none' })
    expect(r.isolation).toBe('none')
    expect(PRECEDENCE_LAYER_LABELS[r.sources.isolation.layer]).toBe('父 session 继承/默认档')
  })
})

// ============================================================
// 25. G-395 降档判据镜像测试(§22c:判据一律 import 源模块 __test__,测试不复制一份)
//     票面「请求档因约束被降/升必须留痕」的三个原因臂逐臂钉住,并反向核验今天哪些臂打不到。
// ============================================================
describe('G-395 降档判据镜像(__test__.buildEffortDowngrade 逐臂)', () => {
  const explicitSrc: ConfigFieldSource = { layer: 'explicit', origin: 'overrides.reasoningEffort' }
  const roleSrc: ConfigFieldSource = { layer: 'role', origin: 'role[coder].reasoningEffort' }

  it('臂 1 invalid-enum:请求档非法枚举 ⇒ 留痕带原始值 + 双方出处,不静默丢弃', () => {
    const trace = precedenceTest.buildEffortDowngrade(
      { raw: 'ultra', source: explicitSrc },
      { value: 'low', source: roleSrc },
    )
    expect(trace).toEqual({
      requested: 'ultra',
      requestedSource: explicitSrc,
      effective: 'low',
      effectiveSource: roleSrc,
      reason: 'invalid-enum',
    })
    // 实得档彻底落空(四层皆空)同样必须留痕,不得静默
    const gone = precedenceTest.buildEffortDowngrade(
      { raw: 'turbo', source: explicitSrc },
      { value: undefined, source: { layer: 'parent', origin: 'parent(inherit)' } },
    )
    expect(gone?.reason).toBe('invalid-enum')
    expect(gone?.effective).toBeUndefined()
  })

  it('臂 2 rank-lower:合法请求档被压到更低档 ⇒ 留痕点名原因与接手层', () => {
    const trace = precedenceTest.buildEffortDowngrade(
      { raw: 'high', source: explicitSrc },
      { value: 'low', source: roleSrc },
    )
    expect(trace?.reason).toBe('rank-lower')
    expect(trace?.requested).toBe('high')
    expect(trace?.effective).toBe('low')
    expect(trace?.effectiveSource).toEqual(roleSrc)
    // 降到最低以下(落空)也是同一臂(eRank=-1 < rRank)
    const fell = precedenceTest.buildEffortDowngrade(
      { raw: 'minimal', source: explicitSrc },
      { value: undefined, source: roleSrc },
    )
    expect(fell?.reason).toBe('rank-lower')
  })

  it('臂 3 rank-higher:合法请求档被抬高 ⇒ 同样留痕("被降/升都不得静默改档"的升档半边)', () => {
    const trace = precedenceTest.buildEffortDowngrade(
      { raw: 'low', source: explicitSrc },
      { value: 'high', source: roleSrc },
    )
    expect(trace?.reason).toBe('rank-higher')
    expect(trace?.requested).toBe('low')
    expect(trace?.effective).toBe('high')
    expect(trace?.requestedSource).toEqual(explicitSrc)
  })

  it('原样采纳 / 无请求档 ⇒ 不产生留痕(留痕不是"每次都写一坨")', () => {
    expect(
      precedenceTest.buildEffortDowngrade(
        { raw: 'medium', source: explicitSrc },
        { value: 'medium', source: explicitSrc },
      ),
    ).toBeUndefined()
    expect(
      precedenceTest.buildEffortDowngrade(undefined, { value: 'low', source: roleSrc }),
    ).toBeUndefined()
  })

  it('档位序 = 档位表下标(单射且严格递增):"同序异值"的坏表前置被钉死', () => {
    const list = precedenceTest.REASONING_EFFORTS
    const ranks = list.map((e) => precedenceTest.effortRank(e))
    expect(ranks).toEqual(list.map((_, i) => i))
    expect(new Set(ranks).size).toBe(ranks.length)
    expect(list.length).toBeGreaterThan(1)
    expect(precedenceTest.effortRank('__not_a_tier__')).toBe(-1)
  })

  it('反向核验:公共入口在"请求档合法"的全排列上永不出留痕 ⇒ 后两臂今天确实打不到', () => {
    const valids: ReasoningEffort[] = [...precedenceTest.REASONING_EFFORTS] as ReasoningEffort[]
    let combos = 0
    for (const requested of valids) {
      for (const other of valids) {
        const r = resolveEffectiveOverrides(
          { reasoningEffort: requested },
          { name: 'coder', reasoningEffort: other },
          {},
          undefined,
          undefined,
          { traceSink: null },
        )
        // 合法请求档必然自己获胜:生效值 == 请求档,且没有任何改档发生
        expect(r.reasoningEffort).toBe(requested)
        expect(r.effortDowngrade).toBeUndefined()
        expect(r.sources.reasoningEffort).toEqual({ layer: 'explicit', origin: 'overrides.reasoningEffort' })
        combos += 1
      }
    }
    expect(combos).toBe(valids.length * valids.length)
  })

  it('留痕开关只静音 stderr 那一行:结构化留痕与生效值一字不变(不构成判定旁路)', () => {
    const role: SubagentRole = { name: 'coder', reasoningEffort: 'low' }
    const overrides = { reasoningEffort: 'ultra' as 'high' }
    const prev = process.env[CONFIG_TRACE_ENV]
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    let muted: EffectiveRuntimeConfig | undefined
    try {
      process.env[CONFIG_TRACE_ENV] = '0'
      muted = resolveEffectiveOverrides(overrides, role, {})
      expect(writeSpy).not.toHaveBeenCalled()
    } finally {
      writeSpy.mockRestore()
      if (prev === undefined) delete process.env[CONFIG_TRACE_ENV]
      else process.env[CONFIG_TRACE_ENV] = prev
    }
    const lines: string[] = []
    const loud = resolveEffectiveOverrides(overrides, role, {}, undefined, undefined, {
      traceSink: (line) => lines.push(line),
    })
    expect(muted).toBeDefined()
    expect(lines).toHaveLength(1)
    // 静音开关动不到判定面:生效值、出处标签、降档留痕、快照修订号四面逐字相同
    expect(muted!.reasoningEffort).toBe(loud.reasoningEffort)
    expect(muted!.effortDowngrade).toEqual(loud.effortDowngrade)
    expect(muted!.effortDowngrade?.reason).toBe('invalid-enum')
    expect(muted!.sources).toEqual(loud.sources)
    expect(muted!.sourceRevisions).toEqual(loud.sourceRevisions)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
