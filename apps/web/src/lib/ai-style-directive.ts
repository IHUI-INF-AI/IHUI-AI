// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 回复风格指令编译器(2026-11-15 立)。
 *
 * 输入:外观设置里的风格偏好(语气/语言/长度/格式/解释深度/自定义补充)。
 * 输出:一段可读的系统指令;全部为默认值时返回空串(请求体逐字节与接线前一致)。
 *
 * 边界:
 *   - 只生成「风格」约束,不覆盖用户自己的 systemPrompt、不改变工具/权限/模式;
 *   - 与 personality 预设互补:预设写的是人设,这里写的是输出形态;
 *   - 纯函数,便于单测;发送链在快照时刻调用,避免流式途中改设置导致两套口径。
 */

import type { AppearanceConfig } from '@/stores/appearance-settings'

const LANGUAGE_LINES: Record<Exclude<AppearanceConfig['aiLanguage'], 'auto'>, string> = {
  'zh-CN': '始终使用简体中文回答。',
  en: 'Always answer in English.',
  'zh-TW': '始終使用繁體中文回答。',
  ja: '常に日本語で回答してください。',
  ko: '항상 한국어로 답변하세요.',
}

const TONE_LINES: Record<Exclude<AppearanceConfig['tone'], 'default'>, string> = {
  professional: '语气专业、准确、克制,避免口语化与情绪化表达。',
  friendly: '语气友好、自然、有耐心,像一位可靠的同事。',
  humorous: '在保证准确的前提下适度幽默,不要油腔滑调。',
  concise: '语气简洁直接,先给结论,省略客套与重复。',
  academic: '语气严谨、学术化,给出必要的推理依据与适用边界。',
}

const LENGTH_LINES: Record<Exclude<AppearanceConfig['aiLength'], 'medium'>, string> = {
  short: '尽量精简,只保留关键结论与必要步骤。',
  long: '尽可能详尽,补充背景、示例与边界情况。',
}

const FORMAT_LINES: Record<Exclude<AppearanceConfig['aiFormat'], 'auto'>, string> = {
  list: '优先使用列表组织要点,每点一句话说清。',
  table: '涉及比较或结构化信息时优先使用表格。',
  paragraph: '以连贯段落为主,减少列表与多级标题。',
  minimal: '少用 Markdown 装饰,保持纯文本可读性。',
}

const DEPTH_LINES: Record<Exclude<AppearanceConfig['explainDepth'], 'standard'>, string> = {
  beginner: '面向初学者,解释必要术语与背景。',
  expert: '面向专家,省略基础背景,直接给出关键细节与取舍。',
}

const GLOSSARY_MAX_ENTRIES = 30
const BANNED_WORDS_MAX_ENTRIES = 20

const EMOJI_LINES: Record<Exclude<AppearanceConfig['emojiPolicy'], 'auto'>, string> = {
  none: '不要使用 emoji 表情符号。',
  minimal: '尽量少用 emoji,仅在确有必要时使用。',
}

export interface GlossaryEntry {
  source: string
  target: string
}

/**
 * 术语表解析:v2 新增。每行一条「原文=译法」(也接受全角/半角冒号)。
 * 坏行(无分隔符、空侧、超长)直接跳过,不让一条脏数据毁掉整份指令。
 */
export function parseGlossary(raw: string): GlossaryEntry[] {
  const entries: GlossaryEntry[] = []
  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim()
    if (!text) continue
    const match = /^(.{1,40}?)\s*(?:=|:|：)\s*(.{1,40})$/.exec(text)
    if (!match) continue
    const source = match[1]?.trim() ?? ''
    const target = match[2]?.trim() ?? ''
    if (!source || !target) continue
    entries.push({ source, target })
    if (entries.length >= GLOSSARY_MAX_ENTRIES) break
  }
  return entries
}

/** 禁用词解析:换行/逗号/顿号/分号分隔,去重并截断 */
export function parseBannedWords(raw: string): string[] {
  const unique = new Set<string>()
  for (const word of raw.split(/[\n,，、;；]+/)) {
    const text = word.trim()
    if (text) unique.add(text)
    if (unique.size >= BANNED_WORDS_MAX_ENTRIES) break
  }
  return [...unique]
}

/** 编译为系统指令;全默认返回 '' */
export function buildAiStyleDirective(config: AppearanceConfig): string {
  const lines: string[] = []

  if (config.aiLanguage !== 'auto') {
    lines.push(`- 语言:${LANGUAGE_LINES[config.aiLanguage]}`)
  } else if (config.followQuestionLanguage) {
    // 显式语言优先:两者同时设置时只输出上面那条语言行
    lines.push('- 语言:使用与用户提问相同的语言回答。')
  }
  if (config.tone !== 'default') lines.push(`- 语气:${TONE_LINES[config.tone]}`)
  if (config.aiLength !== 'medium') lines.push(`- 篇幅:${LENGTH_LINES[config.aiLength]}`)
  if (config.aiFormat !== 'auto') lines.push(`- 格式:${FORMAT_LINES[config.aiFormat]}`)
  if (config.explainDepth !== 'standard')
    lines.push(`- 解释深度:${DEPTH_LINES[config.explainDepth]}`)
  if (config.chineseSpacing) lines.push('- 排版:中文与英文、数字之间保留一个半角空格。')
  if (config.fullWidthPunctuation) lines.push('- 标点:中文语境使用全角标点。')
  if (config.emojiPolicy !== 'auto') lines.push(`- Emoji:${EMOJI_LINES[config.emojiPolicy]}`)

  for (const entry of parseGlossary(config.glossary)) {
    lines.push(`- 术语:${entry.source} → ${entry.target}`)
  }

  const banned = parseBannedWords(config.bannedWords)
  if (banned.length > 0) lines.push(`- 禁用词:避免使用以下词汇:${banned.join('、')}`)

  const custom = config.customStyle.trim()
  if (custom) lines.push(`- 额外要求:${custom}`)

  if (lines.length === 0) return ''
  return ['【回复风格要求】', ...lines, '以上要求优先级低于用户的直接指令与安全规则。'].join('\n')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
