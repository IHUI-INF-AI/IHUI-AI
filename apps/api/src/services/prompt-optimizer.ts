import type { UnifiedAIOrchestrator } from './unified-ai-orchestrator.js'

export interface PromptTemplate {
  id: string
  name: string
  template: string
  variables: string[]
}

export interface PromptTest {
  id: string
  templateId: string
  variables: Record<string, string>
  expectedOutput?: string
  actualOutput?: string
  score?: number
}

const VAR_PATTERN = /\{\{(\w+)\}\}/g

export class PromptOptimizer {
  extractVariables(template: string): string[] {
    const vars = new Set<string>()
    let match: RegExpExecArray | null
    while ((match = VAR_PATTERN.exec(template)) !== null) {
      vars.add(match[1]!)
    }
    return Array.from(vars)
  }

  compile(template: PromptTemplate, variables: Record<string, string>): string {
    const missing = template.variables.filter((v) => !(v in variables))
    if (missing.length > 0) throw new Error(`缺少变量: ${missing.join(', ')}`)
    return template.template.replace(VAR_PATTERN, (_, key: string) => variables[key] ?? '')
  }

  validate(template: PromptTemplate): { valid: boolean; missingVars?: string[] } {
    const extracted = this.extractVariables(template.template)
    const declared = new Set(template.variables)
    const missing = extracted.filter((v) => !declared.has(v))
    if (missing.length > 0) return { valid: false, missingVars: missing }
    return { valid: true }
  }

  async abTest(
    templateA: PromptTemplate,
    templateB: PromptTemplate,
    variables: Record<string, string>,
    orchestrator: UnifiedAIOrchestrator,
  ): Promise<{ a: string; b: string; recommendation: 'a' | 'b' | 'tie' }> {
    const promptA = this.compile(templateA, variables)
    const promptB = this.compile(templateB, variables)
    const [respA, respB] = await Promise.all([
      orchestrator.chat({ messages: [{ role: 'user', content: promptA }] }),
      orchestrator.chat({ messages: [{ role: 'user', content: promptB }] }),
    ])
    const a = respA.content
    const b = respB.content
    return { a, b, recommendation: this.recommend(a, b) }
  }

  private recommend(a: string, b: string): 'a' | 'b' | 'tie' {
    const lenA = a.trim().length
    const lenB = b.trim().length
    if (lenA === 0 && lenB === 0) return 'tie'
    if (lenA === 0) return 'b'
    if (lenB === 0) return 'a'
    if (Math.abs(lenA - lenB) < 20) return 'tie'
    return lenA > lenB ? 'a' : 'b'
  }
}
