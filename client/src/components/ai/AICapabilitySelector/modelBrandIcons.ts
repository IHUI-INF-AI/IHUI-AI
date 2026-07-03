/**
 * 模型品牌图标识别
 * @module components/ai/AICapabilitySelector/modelBrandIcons
 *
 * @description
 * 后端 /ihui-ai-api/llm/models-unify 接口当前 model.img 字段全部为空,
 * 但 model_code 包含了真实厂商的模型标识 (gpt-4.1, gemini-2.5-flash, llama-3.3-70b 等).
 * 本文件基于 model_code 前缀/关键词识别品牌, 返回品牌色 + 首字母,
 * 供 CapabilityItem 在没有 iconUrl/icon 时回退展示, 让用户看到有意义的视觉标识.
 *
 * 优先级 (在调用方使用):
 *   1. 后端 model.img / icon / image / iconUrl / avatar 字段
 *   2. 本文件 getModelBrand() 返回的品牌色 + 首字母 avatar
 *   3. 通用 Cpu / Bot 兜底图标
 */

export interface ModelBrandInfo {
  /** 品牌显示名 */
  name: string
  /** 品牌主色 (背景), 浅色模式 + 暗色模式共用 */
  color: string
  /** 字母 avatar 前景色 (在 color 背景上) */
  fg: string
  /** 用于 avatar 的首字母 (大写, 1-2 字符) */
  initials: string
  /** 浅色模式背景 (可与 color 不同, 用于 dark mode 反相) */
  colorLight: string
  /** 暗色模式背景 */
  colorDark: string
}

/** 颜色工具: 在浅色背景上找适合的前景色 */
function pickFg(hex: string): string {
  // 简单亮度判断, 暗背景配白字, 亮背景配深字
  const m = hex.replace('#', '')
  if (m.length !== 6) return '#ffffff'
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  // YIQ 亮度
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 150 ? '#1a1a1a' : '#ffffff'
}

/** 品牌定义表 — 按 model_code 关键词优先匹配, 越靠前越优先 */
interface BrandRule {
  /** 关键词 (lower-case), 与 model_code 或 name (lower-case) 匹配 */
  keywords: string[]
  info: Omit<ModelBrandInfo, 'fg'>
}

const BRAND_RULES: BrandRule[] = [
  // OpenAI (含 o1/o3/o4 系列)
  {
    keywords: ['gpt-', 'openai', 'o1-', 'o3-', 'o4-', 'gpt-oss'],
    info: { name: 'OpenAI', color: '#10a37f', colorLight: '#10a37f', colorDark: '#10a37f', initials: 'O' },
  },
  // Anthropic Claude
  {
    keywords: ['claude'],
    info: { name: 'Anthropic', color: '#cc785c', colorLight: '#cc785c', colorDark: '#cc785c', initials: 'A' },
  },
  // Google Gemini / Gemma
  {
    keywords: ['gemini'],
    info: { name: 'Google Gemini', color: '#4285f4', colorLight: '#4285f4', colorDark: '#8ab4f8', initials: 'G' },
  },
  {
    keywords: ['gemma'],
    info: { name: 'Google Gemma', color: '#34a853', colorLight: '#34a853', colorDark: '#81c995', initials: 'G' },
  },
  // xAI Grok
  {
    keywords: ['grok'],
    info: { name: 'xAI', color: '#1a1a1a', colorLight: '#1a1a1a', colorDark: '#e8e8e8', initials: 'X' },
  },
  // Meta Llama
  {
    keywords: ['llama'],
    info: { name: 'Meta', color: '#0866ff', colorLight: '#0866ff', colorDark: '#4d8df6', initials: 'L' },
  },
  // DeepSeek
  {
    keywords: ['deepseek'],
    info: { name: 'DeepSeek', color: '#1e88e5', colorLight: '#1e88e5', colorDark: '#64b5f6', initials: 'D' },
  },
  // Alibaba Qwen
  {
    keywords: ['qwen', 'qwq'],
    info: { name: 'Alibaba', color: '#ff6a00', colorLight: '#ff6a00', colorDark: '#ff9d4d', initials: 'Q' },
  },
  // 智谱 GLM / ChatGLM
  {
    keywords: ['glm', 'chatglm'],
    info: { name: 'Zhipu', color: '#3859ff', colorLight: '#3859ff', colorDark: '#7a93ff', initials: 'Z' },
  },
  // Mistral 系 (含 codestral / devstral / magistral / ministral / pixtral)
  {
    keywords: ['mistral', 'codestral', 'devstral', 'magistral', 'ministral', 'pixtral'],
    info: { name: 'Mistral', color: '#ff7000', colorLight: '#ff7000', colorDark: '#ff9d4d', initials: 'M' },
  },
  // Cohere Command / Compound
  {
    keywords: ['command', 'compound'],
    info: { name: 'Cohere', color: '#39594d', colorLight: '#39594d', colorDark: '#7fb3a3', initials: 'C' },
  },
  // Moonshot Kimi
  {
    keywords: ['kimi', 'moonshot'],
    info: { name: 'Moonshot', color: '#1a1a1a', colorLight: '#1a1a1a', colorDark: '#e8e8e8', initials: 'K' },
  },
  // NVIDIA Nemotron
  {
    keywords: ['nemotron'],
    info: { name: 'NVIDIA', color: '#76b900', colorLight: '#76b900', colorDark: '#9bcf3d', initials: 'N' },
  },
  // IBM Granite
  {
    keywords: ['granite'],
    info: { name: 'IBM', color: '#0f62fe', colorLight: '#0f62fe', colorDark: '#4589ff', initials: 'I' },
  },
  // Nous Research Hermes
  {
    keywords: ['hermes'],
    info: { name: 'Nous', color: '#9333ea', colorLight: '#9333ea', colorDark: '#b675f0', initials: 'H' },
  },
  // Liquid AI LFM
  {
    keywords: ['liquid', 'lfm'],
    info: { name: 'Liquid', color: '#0066ff', colorLight: '#0066ff', colorDark: '#4d94ff', initials: 'L' },
  },
  // 阶跃星辰 StepFun
  {
    keywords: ['stepfun', 'step-'],
    info: { name: 'StepFun', color: '#1e90ff', colorLight: '#1e90ff', colorDark: '#6db5ff', initials: 'S' },
  },
  // 小米 MiMo
  {
    keywords: ['mimo'],
    info: { name: 'Xiaomi', color: '#ff6700', colorLight: '#ff6700', colorDark: '#ff9d4d', initials: 'M' },
  },
  // MiniMax
  {
    keywords: ['minimax', 'hailuo'],
    info: { name: 'MiniMax', color: '#1e40af', colorLight: '#1e40af', colorDark: '#6080d8', initials: 'M' },
  },
  // Poolside
  {
    keywords: ['poolside', 'laguna'],
    info: { name: 'Poolside', color: '#0066cc', colorLight: '#0066cc', colorDark: '#4d94d8', initials: 'P' },
  },
]

/** 特殊模型: auto (路由器) / local-mock / big-pickle / dolphin / fusion 等 */
const SPECIAL_RULES: Array<{ test: (code: string, name: string) => boolean; info: Omit<ModelBrandInfo, 'fg'> }> = [
  {
    test: code => code === 'auto' || /router/i.test(code),
    info: { name: 'Auto Router', color: '#7c3aed', colorLight: '#7c3aed', colorDark: '#a78bfa', initials: '✦' },
  },
  {
    test: code => /local-mock|local_/i.test(code),
    info: { name: 'Local', color: '#6b7280', colorLight: '#6b7280', colorDark: '#9ca3af', initials: 'L' },
  },
  {
    test: code => /fusion/i.test(code),
    info: { name: 'Fusion', color: '#0891b2', colorLight: '#0891b2', colorDark: '#5ec4d8', initials: 'F' },
  },
  {
    test: code => /dolphin/i.test(code),
    info: { name: 'Dolphin', color: '#0ea5e9', colorLight: '#0ea5e9', colorDark: '#6dc1eb', initials: 'D' },
  },
  {
    test: code => /big-pickle|pickle/i.test(code),
    info: { name: 'Pickle', color: '#16a34a', colorLight: '#16a34a', colorDark: '#5fbf83', initials: 'B' },
  },
]

/** 兜底: 取首字母 (数字/符号跳过, 找第一个字母) */
function fallbackInitials(code: string, name?: string | null): string {
  const src = (name || code || '').replace(/[_-]+/g, ' ').trim()
  for (const ch of src) {
    if (/[A-Za-z\u4e00-\u9fa5]/.test(ch)) return ch.toUpperCase()
  }
  return 'A'
}

/** 兜底色: 基于 code 哈希, 在一组识别度高的颜色中选 */
const FALLBACK_PALETTE = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c',
  '#ca8a04', '#16a34a', '#0891b2', '#0284c7', '#4f46e5',
  '#9333ea', '#c026d3', '#e11d48', '#f59e0b', '#65a30d',
  '#0d9488', '#0369a1', '#475569',
]

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * 识别模型品牌信息
 * @param code 后端返回的 model_code (如 "gpt-4.1", "deepseek-v4-pro")
 * @param name 后端返回的 name (如 "GPT-4.1"), 可选, 用于辅助匹配
 * @returns ModelBrandInfo 或 null (无匹配, 调用方决定如何兜底)
 */
export function getModelBrand(code?: string | null, name?: string | null): ModelBrandInfo {
  const codeLc = String(code || '').toLowerCase()
  const nameLc = String(name || '').toLowerCase()
  const haystack = `${codeLc} ${nameLc}`.trim()

  if (haystack) {
    // 1. 特殊规则
    for (const rule of SPECIAL_RULES) {
      if (rule.test(codeLc, nameLc)) {
        return { ...rule.info, fg: pickFg(rule.info.color) }
      }
    }
    // 2. 品牌规则 (按 keywords 包含判断)
    for (const rule of BRAND_RULES) {
      for (const kw of rule.keywords) {
        if (haystack.includes(kw)) {
          return { ...rule.info, fg: pickFg(rule.info.color) }
        }
      }
    }
  }

  // 3. 兜底: 基于 code 哈希选色 + 首字母
  const color = FALLBACK_PALETTE[hashStr(codeLc || nameLc || 'default') % FALLBACK_PALETTE.length]
  return {
    name: name || code || 'Model',
    color,
    colorLight: color,
    colorDark: color,
    fg: pickFg(color),
    initials: fallbackInitials(codeLc, name),
  }
}
