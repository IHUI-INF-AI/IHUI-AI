// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型类型识别(2026-11-26 立)。
 *
 * 为什么需要:模型同步腿把上游 /v1/models 的整份清单写进 ai_model_config_models,
 * 但其中混着 embedding / rerank / ASR / TTS / 图像 / 视频 / 翻译 / 内容审核等
 * 非聊天模型。LLM 计费面按 token 成本 fail-closed,这些模型永远补不出 token 成本,
 * 于是长期挂在「缺成本」清单里;更糟的是个别被 is_relay_public=true 放到了中转站,
 * 用户点开就是 503。
 *
 * 本模块只做「按名字 + 已知别名」的保守分类,不替代上游 metadata.modality。
 * 判不准的一律回 chat,宁可让它进补价队列,也不误杀真实聊天模型。
 */

export type ModelKind =
  | 'chat'
  | 'embedding'
  | 'rerank'
  | 'image'
  | 'video'
  | 'audio'
  | 'translation'
  | 'moderation'
  | 'free'
  | 'partner_alias'
  | 'opaque'
  | 'test_alias'

const TEST_ALIAS_IDS = new Set([
  'auto',
  'default',
  'fast',
  'speed',
  'mock-ask',
  'balanced-model',
  'deep-model',
  'fast-model',
  'dmodel',
  'dfmodel',
  'gfmodel',
  'gmodel',
  'gmodel_latest',
  'jmodel',
  'kmodel',
  'kmodel_latest',
  'mmodel',
  'qfmodel',
  'qmodel_latest',
  'qmodel_38max',
])

const FREE_SUFFIX = /(?:^|[-_/])free(?:$|[-_/])/i
const PARTNER_PREFIX = /^(?:sn-|person-|partner-|internal-)/i
const OPAQUE_ID = /^\d+$/

const EMBEDDING_HINTS = [
  'embed',
  'embedding',
  'bge-',
  '/bge',
  'rerank',
  'reranker',
  'retriev',
  'nvclip',
  '/clip',
  'clip-',
  'gliner',
  'plamo-embedding',
  'embedqa',
  'arctic-embed',
  'distilbert',
]

const IMAGE_HINTS = [
  'image',
  'flux',
  'leonardo',
  'z-image',
  'midjourney',
  'stable-diffusion',
  'sdxl',
  'resnet',
  'lucid-origin',
  'phoenix-1.0',
]

const VIDEO_HINTS = ['video', 'kling', 'sora', 'veo-', 'runway', 'seedance']

const AUDIO_HINTS = [
  'whisper',
  'asr',
  'tts',
  'audio',
  'cosyvoice',
  'orpheus',
  'smart-turn',
  'deepgram',
  'aura-',
  'nova-3',
  'moss-ttsd',
  'riva-',
  'mimo-v2.5-asr',
]

const TRANSLATION_HINTS = ['translate', 'translation', 'm2m100', 'indictrans', 'eurollm']

const MODERATION_HINTS = [
  'guard',
  'safety',
  'topic-control',
  'pii',
  'sst-2',
  'synthetic-video-detector',
]

function includesAny(id: string, hints: string[]): boolean {
  return hints.some((hint) => id.includes(hint))
}

/**
 * 按模型 ID 归类。顺序很重要:free / partner / 测试别名优先于内容类型,
 * 因为同一个上游聊天模型也可能带 -free 后缀或 sn- 前缀。
 */
export function classifyModelKind(modelId: string): ModelKind {
  const id = modelId.trim().toLowerCase()
  if (!id) return 'chat'
  if (FREE_SUFFIX.test(id) || id.endsWith('-free') || id.endsWith('_free')) return 'free'
  if (PARTNER_PREFIX.test(id)) return 'partner_alias'
  if (TEST_ALIAS_IDS.has(id)) return 'test_alias'
  if (OPAQUE_ID.test(id)) return 'opaque'
  if (includesAny(id, EMBEDDING_HINTS)) {
    return id.includes('rerank') ? 'rerank' : 'embedding'
  }
  // 音频优先于图像:Deepgram Flux 是语音模型,名字里的 flux 不是图像 Flux。
  if (includesAny(id, AUDIO_HINTS)) return 'audio'
  if (includesAny(id, IMAGE_HINTS)) return 'image'
  if (includesAny(id, VIDEO_HINTS)) return 'video'
  if (includesAny(id, TRANSLATION_HINTS)) return 'translation'
  if (includesAny(id, MODERATION_HINTS)) return 'moderation'
  return 'chat'
}

/** 是否属于不该出现在 LLM 售卖面的非聊天类型。 */
export function isNonChatKind(kind: ModelKind): boolean {
  return (
    kind === 'embedding' ||
    kind === 'rerank' ||
    kind === 'image' ||
    kind === 'video' ||
    kind === 'audio' ||
    kind === 'translation' ||
    kind === 'moderation'
  )
}

/** 缺成本清理时是否直接下架(而不是仅不公开)。 */
export function shouldDisableOnMissingCost(kind: ModelKind): boolean {
  return kind === 'free' || isNonChatKind(kind)
}

/** 是否属于「仅内部路由、不对外」的别名。 */
export function isInternalAliasKind(kind: ModelKind): boolean {
  return kind === 'partner_alias' || kind === 'opaque' || kind === 'test_alias'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
