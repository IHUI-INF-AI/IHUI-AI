import { describe, expect, it } from 'vitest'
import {
  PERSONAS_CONTRACTS,
  getPersonaContract,
  listPersonaContractNames,
  type JSONSchema,
  type PersonaContract,
  type PersonaContracts,
} from '../src/personas/index.js'
import {
  PERSONAS,
  type PersonaConfig,
  type SubagentPersona,
} from '../src/tools/subagent.js'

const EXPECTED_PERSONAS = ['researcher', 'coder', 'reviewer', 'architect', 'debugger'] as const

function isJSONSchema(v: unknown): v is JSONSchema {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  if (o.type !== undefined) {
    const t = o.type
    const valid = ['object', 'string', 'number', 'integer', 'boolean', 'array', 'null']
    if (typeof t === 'string' && !valid.includes(t)) return false
    if (Array.isArray(t) && !t.every((x) => typeof x === 'string' && valid.includes(x))) return false
  }
  if (o.properties !== undefined && (typeof o.properties !== 'object' || o.properties === null)) return false
  if (o.required !== undefined && !Array.isArray(o.required)) return false
  if (o.items !== undefined && !isJSONSchema(o.items)) return false
  return true
}

describe('PERSONAS_CONTRACTS — 基础完整性', () => {
  it('包含 5 个 persona(researcher/coder/reviewer/architect/debugger)', () => {
    const keys = Object.keys(PERSONAS_CONTRACTS).sort()
    expect(keys).toEqual([...EXPECTED_PERSONAS].sort())
  })

  it('listPersonaContractNames 返回 5 个名称', () => {
    expect(listPersonaContractNames()).toHaveLength(5)
    expect(listPersonaContractNames().sort()).toEqual([...EXPECTED_PERSONAS].sort())
  })

  it('每个 persona 都有 input_schema 字段', () => {
    for (const p of EXPECTED_PERSONAS) {
      expect(PERSONAS_CONTRACTS[p]).toBeDefined()
      expect(PERSONAS_CONTRACTS[p].input_schema).toBeDefined()
    }
  })

  it('每个 persona 都有 output_schema 字段', () => {
    for (const p of EXPECTED_PERSONAS) {
      expect(PERSONAS_CONTRACTS[p].output_schema).toBeDefined()
    }
  })

  it('每个 persona 的 input_schema 是合法 JSONSchema', () => {
    for (const p of EXPECTED_PERSONAS) {
      expect(isJSONSchema(PERSONAS_CONTRACTS[p].input_schema)).toBe(true)
    }
  })

  it('每个 persona 的 output_schema 是合法 JSONSchema', () => {
    for (const p of EXPECTED_PERSONAS) {
      expect(isJSONSchema(PERSONAS_CONTRACTS[p].output_schema)).toBe(true)
    }
  })
})

describe('PERSONAS_CONTRACTS — required 字段约束', () => {
  it('每个 persona 的 input_schema 含 required 字段(数组)', () => {
    for (const p of EXPECTED_PERSONAS) {
      const schema = PERSONAS_CONTRACTS[p].input_schema
      expect(Array.isArray(schema.required)).toBe(true)
      expect((schema.required as string[]).length).toBeGreaterThan(0)
    }
  })

  it('每个 persona 的 output_schema 含 required 字段(数组)', () => {
    for (const p of EXPECTED_PERSONAS) {
      const schema = PERSONAS_CONTRACTS[p].output_schema
      expect(Array.isArray(schema.required)).toBe(true)
      expect((schema.required as string[]).length).toBeGreaterThan(0)
    }
  })

  it('每个 persona 的 input_schema required 字段都存在于 properties 中', () => {
    for (const p of EXPECTED_PERSONAS) {
      const schema = PERSONAS_CONTRACTS[p].input_schema
      const props = Object.keys(schema.properties ?? {})
      for (const req of schema.required ?? []) {
        expect(props).toContain(req)
      }
    }
  })

  it('每个 persona 的 output_schema required 字段都存在于 properties 中', () => {
    for (const p of EXPECTED_PERSONAS) {
      const schema = PERSONAS_CONTRACTS[p].output_schema
      const props = Object.keys(schema.properties ?? {})
      for (const req of schema.required ?? []) {
        expect(props).toContain(req)
      }
    }
  })
})

describe('PERSONAS_CONTRACTS — 不可变性', () => {
  it('PERSONAS_CONTRACTS 已被 Object.freeze 冻结', () => {
    expect(Object.isFrozen(PERSONAS_CONTRACTS)).toBe(true)
  })

  it('运行时尝试新增 persona 抛错(strict mode)', () => {
    expect(() => {
      ;(PERSONAS_CONTRACTS as PersonaContracts).newpersona = {
        input_schema: { type: 'object' },
        output_schema: { type: 'object' },
      }
    }).toThrow()
  })

  it('getPersonaContract 返回的对象引用稳定(同一 persona 多次查询返回同一对象)', () => {
    const a = getPersonaContract('researcher')
    const b = getPersonaContract('researcher')
    expect(a).toBe(b)
  })
})

describe('getPersonaContract — 查询语义', () => {
  it('已知 persona 返回 PersonaContract 对象', () => {
    const c = getPersonaContract('researcher')
    expect(c).toBeDefined()
    expect(c!.input_schema).toBeDefined()
    expect(c!.output_schema).toBeDefined()
  })

  it('未知 persona 返回 undefined', () => {
    expect(getPersonaContract('nonexistent')).toBeUndefined()
    expect(getPersonaContract('')).toBeUndefined()
    expect(getPersonaContract('planner')).toBeUndefined()
    expect(getPersonaContract('general')).toBeUndefined()
  })

  it('对每个 EXPECTED_PERSONAS 查询都返回非 undefined', () => {
    for (const p of EXPECTED_PERSONAS) {
      expect(getPersonaContract(p)).toBeDefined()
    }
  })
})

describe('PersonaContract 类型 — TypeScript 类型推断', () => {
  it('PersonaContract 类型可正确构造(类型推断正确)', () => {
    const c: PersonaContract = {
      input_schema: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] },
      output_schema: { type: 'object', properties: { y: { type: 'string' } }, required: ['y'] },
    }
    expect(c.input_schema.type).toBe('object')
    expect(c.output_schema.type).toBe('object')
  })

  it('PersonaContracts 是 Record<string, PersonaContract>', () => {
    const map: PersonaContracts = {
      foo: {
        input_schema: { type: 'object' },
        output_schema: { type: 'object' },
      },
    }
    expect(map.foo.input_schema).toBeDefined()
    expect(map.foo.output_schema).toBeDefined()
  })
})

describe('subagent.ts PersonaConfig — 新字段集成', () => {
  it('PersonaConfig 接口含 input_schema?/output_schema? 可选字段', () => {
    const config: PersonaConfig = {
      systemPrompt: 'test',
      input_schema: { type: 'object', properties: {}, required: [] },
      output_schema: { type: 'object', properties: {}, required: [] },
    }
    expect(config.input_schema).toBeDefined()
    expect(config.output_schema).toBeDefined()
    expect(config.input_schema?.type).toBe('object')
    expect(config.output_schema?.type).toBe('object')
  })

  it('PersonaConfig 允许不带 input_schema/output_schema(向后兼容)', () => {
    const config: PersonaConfig = { systemPrompt: 'test' }
    expect(config.input_schema).toBeUndefined()
    expect(config.output_schema).toBeUndefined()
  })

  it('PERSONAS.researcher 已绑定 input_schema/output_schema', () => {
    const r = PERSONAS.researcher
    expect(r.input_schema).toBeDefined()
    expect(r.output_schema).toBeDefined()
    expect(r.input_schema).toBe(PERSONAS_CONTRACTS.researcher.input_schema)
    expect(r.output_schema).toBe(PERSONAS_CONTRACTS.researcher.output_schema)
  })

  it('PERSONAS.coder 已绑定 input_schema/output_schema', () => {
    expect(PERSONAS.coder.input_schema).toBe(PERSONAS_CONTRACTS.coder.input_schema)
    expect(PERSONAS.coder.output_schema).toBe(PERSONAS_CONTRACTS.coder.output_schema)
  })

  it('PERSONAS.reviewer 已绑定 input_schema/output_schema', () => {
    expect(PERSONAS.reviewer.input_schema).toBe(PERSONAS_CONTRACTS.reviewer.input_schema)
    expect(PERSONAS.reviewer.output_schema).toBe(PERSONAS_CONTRACTS.reviewer.output_schema)
  })

  it('PERSONAS.planner/general 未绑定 contracts(契约仅 3 档映射)', () => {
    expect(PERSONAS.planner.input_schema).toBeUndefined()
    expect(PERSONAS.planner.output_schema).toBeUndefined()
    expect(PERSONAS.general.input_schema).toBeUndefined()
    expect(PERSONAS.general.output_schema).toBeUndefined()
  })

  it('PERSONAS 绑定的 input_schema 与 contracts 引用一致(零冗余)', () => {
    const personas: SubagentPersona[] = ['researcher', 'coder', 'reviewer']
    for (const p of personas) {
      const cfg = PERSONAS[p]
      const contract = PERSONAS_CONTRACTS[p]
      if (cfg.input_schema && contract) {
        expect(cfg.input_schema).toBe(contract.input_schema)
        expect(cfg.output_schema).toBe(contract.output_schema)
      }
    }
  })
})

describe('5 个 persona — input/output 字段语义合理性', () => {
  it('researcher 输出 researchSummary + recommendedApproach(不是 code)', () => {
    const out = PERSONAS_CONTRACTS.researcher.output_schema
    const props = Object.keys(out.properties ?? {})
    expect(props).toContain('researchSummary')
    expect(props).toContain('recommendedApproach')
    expect(props).not.toContain('codeChanges')
    expect(props).not.toContain('fix')
  })

  it('researcher 输入含 task(调研任务描述)', () => {
    const inp = PERSONAS_CONTRACTS.researcher.input_schema
    expect(inp.properties).toHaveProperty('task')
    expect(inp.required).toContain('task')
  })

  it('coder 输出 codeChanges + verification(不是 researchSummary)', () => {
    const out = PERSONAS_CONTRACTS.coder.output_schema
    const props = Object.keys(out.properties ?? {})
    expect(props).toContain('codeChanges')
    expect(props).toContain('verification')
    expect(props).not.toContain('researchSummary')
    expect(props).not.toContain('rootCause')
  })

  it('coder 输入含 task + affectedFiles(必填)', () => {
    const inp = PERSONAS_CONTRACTS.coder.input_schema
    expect(inp.properties).toHaveProperty('task')
    expect(inp.properties).toHaveProperty('affectedFiles')
    expect(inp.required).toContain('task')
    expect(inp.required).toContain('affectedFiles')
  })

  it('reviewer 输出含 decision(approve/request_changes)', () => {
    const out = PERSONAS_CONTRACTS.reviewer.output_schema
    expect(out.properties).toHaveProperty('decision')
    const decision = out.properties!.decision
    expect(decision.enum).toContain('approve')
    expect(decision.enum).toContain('request_changes')
  })

  it('reviewer 输入含 codeDiff(必填)', () => {
    const inp = PERSONAS_CONTRACTS.reviewer.input_schema
    expect(inp.properties).toHaveProperty('codeDiff')
    expect(inp.required).toContain('codeDiff')
  })

  it('architect 输出 designDoc + fileStructure(不是 rootCause)', () => {
    const out = PERSONAS_CONTRACTS.architect.output_schema
    const props = Object.keys(out.properties ?? {})
    expect(props).toContain('designDoc')
    expect(props).toContain('fileStructure')
    expect(props).not.toContain('rootCause')
    expect(props).not.toContain('fix')
  })

  it('architect 输入含 requirements(必填)', () => {
    const inp = PERSONAS_CONTRACTS.architect.input_schema
    expect(inp.properties).toHaveProperty('requirements')
    expect(inp.required).toContain('requirements')
  })

  it('debugger 输出 rootCause + fix(不是 designDoc)', () => {
    const out = PERSONAS_CONTRACTS.debugger.output_schema
    const props = Object.keys(out.properties ?? {})
    expect(props).toContain('rootCause')
    expect(props).toContain('fix')
    expect(props).not.toContain('designDoc')
    expect(props).not.toContain('recommendedApproach')
  })

  it('debugger 输入含 errorDescription(必填)', () => {
    const inp = PERSONAS_CONTRACTS.debugger.input_schema
    expect(inp.properties).toHaveProperty('errorDescription')
    expect(inp.required).toContain('errorDescription')
  })
})

describe('5 个 persona — 跨 persona 字段不重叠(语义隔离)', () => {
  it('researcher 输出字段不与 coder 输出字段重叠', () => {
    const r = Object.keys(PERSONAS_CONTRACTS.researcher.output_schema.properties ?? {})
    const c = Object.keys(PERSONAS_CONTRACTS.coder.output_schema.properties ?? {})
    const overlap = r.filter((x) => c.includes(x))
    expect(overlap).toEqual([])
  })

  it('architect 输出字段不与 debugger 输出字段重叠', () => {
    const a = Object.keys(PERSONAS_CONTRACTS.architect.output_schema.properties ?? {})
    const d = Object.keys(PERSONAS_CONTRACTS.debugger.output_schema.properties ?? {})
    const overlap = a.filter((x) => d.includes(x))
    expect(overlap).toEqual([])
  })

  it('每个 persona 的 output_schema type 均为 object', () => {
    for (const p of EXPECTED_PERSONAS) {
      expect(PERSONAS_CONTRACTS[p].output_schema.type).toBe('object')
    }
  })

  it('每个 persona 的 input_schema type 均为 object', () => {
    for (const p of EXPECTED_PERSONAS) {
      expect(PERSONAS_CONTRACTS[p].input_schema.type).toBe('object')
    }
  })
})
