/**
 * Subagent 优先级链测试 — P1-2 Subagent precedence。
 *
 * 覆盖四层优先级短路链 + fail-closed / soft degradation / enum 容错 / trim / 相对路径等特殊语义。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import {
  resolveEffectiveOverrides,
  parseCapabilityMode,
  parseIsolationMode,
  parseReasoningEffort,
} from '../src/subagents/precedence.js'
import type {
  SubagentRuntimeOverrides,
  SubagentRole,
  SubagentPersona,
  PersonaMap,
} from '../src/subagents/types.js'

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
