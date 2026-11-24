// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 个性预设(V2 #29)— 纯静态数据模块
 *
 * 设计:
 * - 预设 = 预填 systemPrompt 的快捷入口,写入既有 SamplingParams.systemPrompt(per-conversation 覆盖)
 * - 零后端改动:send-message.ts 已把 systemPrompt 透传 extraBody
 * - prompt 文本走 i18n key(`chat.personalityPresets.<id>.prompt`),此处只放 id + 标签 key
 * - 纯数据零运行时依赖(与 slash-command-data.ts 同型)
 */

export const PERSONALITY_PRESET_IDS = [
  'default',
  'concise',
  'developer',
  'translator',
  'tutor',
  'creative',
] as const

export type PersonalityPresetId = (typeof PERSONALITY_PRESET_IDS)[number]

/** 预设元数据(label/description/prompt 均为 i18n key,在 chat 命名空间下) */
export const PERSONALITY_PRESETS: ReadonlyArray<{
  id: PersonalityPresetId
  labelKey: string
  descriptionKey: string
  promptKey: string
}> = [
  {
    id: 'default',
    labelKey: 'chat.personalityPresets.default.label',
    descriptionKey: 'chat.personalityPresets.default.description',
    promptKey: 'chat.personalityPresets.default.prompt',
  },
  {
    id: 'concise',
    labelKey: 'chat.personalityPresets.concise.label',
    descriptionKey: 'chat.personalityPresets.concise.description',
    promptKey: 'chat.personalityPresets.concise.prompt',
  },
  {
    id: 'developer',
    labelKey: 'chat.personalityPresets.developer.label',
    descriptionKey: 'chat.personalityPresets.developer.description',
    promptKey: 'chat.personalityPresets.developer.prompt',
  },
  {
    id: 'translator',
    labelKey: 'chat.personalityPresets.translator.label',
    descriptionKey: 'chat.personalityPresets.translator.description',
    promptKey: 'chat.personalityPresets.translator.prompt',
  },
  {
    id: 'tutor',
    labelKey: 'chat.personalityPresets.tutor.label',
    descriptionKey: 'chat.personalityPresets.tutor.description',
    promptKey: 'chat.personalityPresets.tutor.prompt',
  },
  {
    id: 'creative',
    labelKey: 'chat.personalityPresets.creative.label',
    descriptionKey: 'chat.personalityPresets.creative.description',
    promptKey: 'chat.personalityPresets.creative.prompt',
  },
]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
