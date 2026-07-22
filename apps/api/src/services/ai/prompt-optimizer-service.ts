/**
 * Prompt 优化器服务。
 *
 * 将用户原始 prompt 优化为更高质量、更结构化的版本：
 * - 补全角色设定（你是...）
 * - 明确输出格式（JSON / markdown / 列表）
 * - 加入约束条件（长度/语言/语气）
 * - 提供示例（few-shot，可选）
 *
 * 优化策略：
 * 1. LLM 驱动：传入原 prompt + 类型模板作为 system prompt,由 LLM 生成优化版本
 * 2. 规则降级：LLM 不可用时回退到模板拼接
 */

import { callRealLlm, type LlmMessage } from '../crew-llm-adapter.js'

export type PromptType = 'text' | 'image' | 'code' | 'summary' | 'translation' | 'default'

export interface OptimizeOptions {
  type?: PromptType
  language?: 'zh' | 'en' | 'ja' | 'ko'
  maxLength?: number
  outputFormat?: 'json' | 'markdown' | 'list' | 'plain'
  role?: string
}

export interface OptimizeResult {
  original: string
  optimized: string
  improvements: string[]
  type: PromptType
}

const TYPE_TEMPLATES: Record<PromptType, string> = {
  text: '请以专业写作者的角度，按照清晰的结构组织内容，段落间要有逻辑过渡。',
  image: '请详细描述画面元素：主体、构图、光影、色彩、风格、镜头视角、艺术参考。',
  code: '请提供完整可运行的代码，包含类型注解、必要注释，并说明使用方法。',
  summary: '请按"核心结论 + 关键论据 + 适用场景"三段式输出摘要。',
  translation: '请遵循"信达雅"原则，保持专业术语一致，必要时在括号内附原文。',
  default: '请明确目标、约束与期望输出格式。',
}

const VAGUE_TERMS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /好一点/g, replacement: '更具体、更有深度' },
  { pattern: /简单说/g, replacement: '用 3-5 个要点说明' },
  { pattern: /详细点/g, replacement: '展开到 500 字以上，含示例' },
  { pattern: /专业点/g, replacement: '使用领域专业术语并解释' },
  { pattern: /interesting/g, replacement: '具有新颖性与启发性' },
]

/** 自动识别 prompt 类型。 */
function detectType(prompt: string): PromptType {
  const lower = prompt.toLowerCase()
  if (/画|图|image|picture|draw|render/.test(lower)) return 'image'
  if (/代码|function|code|实现|implement/.test(lower)) return 'code'
  if (/总结|摘要|summary|abstract/.test(lower)) return 'summary'
  if (/翻译|translate|翻译成/.test(lower)) return 'translation'
  if (/写文章|write|essay|博客/.test(lower)) return 'text'
  return 'default'
}

/** 替换模糊词。 */
function replaceVagueTerms(prompt: string): { text: string; replaced: number } {
  let result = prompt
  let replaced = 0
  for (const { pattern, replacement } of VAGUE_TERMS) {
    if (pattern.test(result)) {
      result = result.replace(pattern, replacement)
      replaced++
    }
  }
  return { text: result, replaced }
}

function defaultRoleForType(type: PromptType): string {
  switch (type) {
    case 'image':
      return '你是一位资深视觉设计师与艺术指导'
    case 'code':
      return '你是一位资深软件工程师，精通代码质量与可维护性'
    case 'summary':
      return '你是一位信息提炼专家，擅长从复杂内容中抽取关键信息'
    case 'translation':
      return '你是一位专业译员，精通术语一致性'
    case 'text':
      return '你是一位专业写作者'
    default:
      return '你是一位专业助手'
  }
}

function buildFormatConstraint(options: OptimizeOptions): string {
  const format = options.outputFormat
  if (!format || format === 'plain') return ''
  if (format === 'json') return '# 输出格式\n请输出合法 JSON，不要包含额外说明文字。'
  if (format === 'markdown') return '# 输出格式\n请使用 markdown 格式，含标题层级与代码块。'
  if (format === 'list') return '# 输出格式\n请使用有序/无序列表呈现要点。'
  return ''
}

function langName(lang: 'zh' | 'en' | 'ja' | 'ko'): string {
  return { zh: '中文', en: '英文', ja: '日文', ko: '韩文' }[lang]
}

/** 规则版优化(LLM 降级用)。 */
function optimizeRuleBased(prompt: string, options: OptimizeOptions, type: PromptType): OptimizeResult {
  const improvements: string[] = []

  const { text: clarifiedText, replaced } = replaceVagueTerms(prompt)
  if (replaced > 0) improvements.push(`替换 ${replaced} 处模糊表述`)

  const template = TYPE_TEMPLATES[type]
  improvements.push(`应用 ${type} 类型模板`)

  const role = options.role ?? defaultRoleForType(type)
  improvements.push(`设定角色：${role}`)

  const formatConstraint = buildFormatConstraint(options)
  if (formatConstraint) improvements.push(`约束输出格式：${options.outputFormat ?? 'markdown'}`)

  const lengthConstraint = options.maxLength ? `请将输出控制在 ${options.maxLength} 字以内。` : ''
  const langConstraint = options.language ? `请使用${langName(options.language)}输出。` : ''

  const parts = [
    `# 角色设定\n${role}`,
    `# 任务\n${clarifiedText}`,
    `# 要求\n${template}`,
    formatConstraint,
    lengthConstraint,
    langConstraint,
  ].filter(Boolean)

  return {
    original: prompt,
    optimized: parts.join('\n\n'),
    improvements,
    type,
  }
}

/** 优化 prompt(LLM 驱动,规则降级)。 */
export async function optimize(
  prompt: string,
  options: OptimizeOptions = {},
): Promise<OptimizeResult> {
  const type = options.type ?? detectType(prompt)
  const role = options.role ?? defaultRoleForType(type)
  const template = TYPE_TEMPLATES[type]

  // 构建 system prompt:规则模板作为 LLM 的参考指令
  const constraints: string[] = [template]
  if (options.outputFormat && options.outputFormat !== 'plain') {
    constraints.push(buildFormatConstraint(options))
  }
  if (options.maxLength) constraints.push(`输出控制在 ${options.maxLength} 字以内`)
  if (options.language) constraints.push(`使用${langName(options.language)}输出`)

  try {
    const messages: LlmMessage[] = [
      {
        role: 'system',
        content: `${role}。你是 Prompt 优化专家。将用户给定的原始 prompt 优化为更高质量、更结构化的版本。优化要求:${constraints.join('; ')}。直接返回优化后的 prompt 全文,不要解释。`,
      },
      { role: 'user', content: prompt },
    ]
    const result = await callRealLlm({ messages, temperature: 0.3, maxTokens: 800 })
    const optimized = result.content.trim()
    if (optimized && optimized !== prompt) {
      return {
        original: prompt,
        optimized,
        improvements: ['LLM 优化', `应用 ${type} 类型模板`, `设定角色：${role}`],
        type,
      }
    }
  } catch {
    // LLM 不可用,降级到规则优化
  }

  return optimizeRuleBased(prompt, options, type)
}

/** 批量优化多个 prompt。 */
export async function optimizeBatch(
  prompts: string[],
  options?: OptimizeOptions,
): Promise<OptimizeResult[]> {
  return Promise.all(prompts.map((p) => optimize(p, options)))
}
