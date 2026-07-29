/**
 * AI Skill 变量映射共享模块 — 2026-07-23 新增
 *
 * 详情页 `/ai-skills/[id]` 与 SkillLibrary 弹窗的 AiSkillInvokeDialog 共用,
 * 支持 15 个已知变量,覆盖全部 19 个真集成 skill。
 *
 * 变量 → skill 对应关系:
 * - content/style          → nuwa-skill
 * - requirements           → hugshu-design
 * - topic                  → agent-reach / auto-redbook-skills / obsidian-skills / guizang-ppt-skill
 * - domain                 → horizon
 * - platform               → media-crawler
 * - concept                → generative-media-skills
 * - title/subtitle         → guizang-social-card-skill
 * - content/platforms      → social-auto-upload
 * - usecase                → claude-plugins-official
 * - task                   → superpowers / agent-skills / awesome-agent-skills
 * - text                   → caveman / graphify / taste-skill
 * - language               → agent-skills (与 task 组合)
 * - input                  → awesome-claude-skills
 */

/** 把变量名映射到 i18n key(aiSkillDetail 命名空间) */
export const VARIABLE_LABEL_KEY: Record<string, string> = {
  content: 'inputContent',
  style: 'inputStyle',
  requirements: 'inputRequirements',
  topic: 'inputTopic',
  domain: 'inputDomain',
  platform: 'inputPlatform',
  concept: 'inputConcept',
  title: 'inputTitle',
  subtitle: 'inputSubtitle',
  platforms: 'inputPlatforms',
  usecase: 'inputUsecase',
  task: 'inputTask',
  text: 'inputText',
  language: 'inputLanguage',
  input: 'inputInput',
}

/** 变量 → placeholder i18n key(aiSkillDetail 命名空间) */
export const VARIABLE_PLACEHOLDER_KEY: Record<string, string> = {
  content: 'placeholderContent',
  style: 'placeholderStyle',
  requirements: 'placeholderRequirements',
  topic: 'placeholderTopic',
  domain: 'placeholderDomain',
  platform: 'placeholderPlatform',
  concept: 'placeholderConcept',
  title: 'placeholderTitle',
  subtitle: 'placeholderSubtitle',
  platforms: 'placeholderPlatforms',
  usecase: 'placeholderUsecase',
  task: 'placeholderTask',
  text: 'placeholderText',
  language: 'placeholderLanguage',
  input: 'placeholderInput',
}

/** 变量 → 最大长度(防止超长输入) */
export const VARIABLE_MAX_LEN: Record<string, number> = {
  content: 4000,
  style: 200,
  requirements: 1000,
  topic: 500,
  domain: 200,
  platform: 100,
  concept: 500,
  title: 200,
  subtitle: 200,
  platforms: 500,
  usecase: 500,
  task: 500,
  text: 4000,
  language: 50,
  input: 1000,
}

/** 多行 textarea 变量集合(长文本输入) */
export const LONG_TEXT_VARS = new Set<string>([
  'content',
  'requirements',
  'topic',
  'platforms',
  'text',
  'input',
])

/** 解析 promptTemplate 中的 {key} 变量,去重保序 */
export function parseVariables(template: string): string[] {
  if (!template) return []
  const re = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g
  const seen = new Set<string>()
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(template)) !== null) {
    const k = m[1] ?? ''
    if (k && !seen.has(k)) {
      seen.add(k)
      out.push(k)
    }
  }
  return out
}

/** 获取变量 label 的 i18n key(未知变量回退到 input<Key>) */
export function getLabelKey(key: string): string {
  return VARIABLE_LABEL_KEY[key] ?? `input${key.charAt(0).toUpperCase()}${key.slice(1)}`
}

/** 获取变量 placeholder 的 i18n key(未知变量回退到 placeholder<Key>) */
export function getPlaceholderKey(key: string): string {
  return VARIABLE_PLACEHOLDER_KEY[key] ?? `placeholder${key.charAt(0).toUpperCase()}${key.slice(1)}`
}

/** 获取变量最大长度(未知变量默认 1000) */
export function getMaxLen(key: string): number {
  return VARIABLE_MAX_LEN[key] ?? 1000
}

/** 判断变量是否为多行 textarea */
export function isLongText(key: string): boolean {
  return LONG_TEXT_VARS.has(key)
}
