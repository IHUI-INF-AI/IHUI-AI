// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 一句话出稿页的纯函数：请求体组装 + 业务失败文案。
 *
 * 不把 470/490/16/5 这些口径写死在组件里，服务端默认值才是单一事实源；
 * 这里只做“用户输入 → 请求体”的搬运，方便单测锁住字段名。
 */

export interface PrepareDraftPayload {
  brief: string
  platforms: string[]
  tone: string
  profile: string
  format: 'md' | 'html'
  min_chars: number
  max_chars: number
  title_chars: number
  hashtag_count: number
  require_ai_disclosure: boolean
}

export interface PrepareDraftCheck {
  code?: string
  level?: 'block' | 'warn' | string
  message?: string
  detail?: string
}

export interface PrepareDraftResult {
  ok: boolean
  errorCode?: string
  message?: string
  title?: string
  content?: string
  hashtags?: string[]
  charCount?: number
  withinRange?: boolean
  titleLength?: number
  titleWithinRange?: boolean
  hashtagCount?: number
  targets?: Array<{ platform?: string; account_name?: string | null }>
  contentCheck?: {
    blocking?: number
    warnings?: number
    score?: number
    checks?: PrepareDraftCheck[]
  }
  taskId?: string
  status?: string
  missingPlatforms?: string[]
  availablePlatforms?: string[]
  nextAction?: string
}

export function buildPrepareDraftPayload(input: {
  brief: string
  platforms: Iterable<string>
  tone?: string
}): PrepareDraftPayload {
  const platforms = Array.from(new Set(Array.from(input.platforms).filter(Boolean)))
  return {
    brief: input.brief.trim(),
    platforms,
    tone: input.tone?.trim() || '口语化、自然聊天',
    profile: 'ihui_koubo',
    format: 'md',
    min_chars: 470,
    max_chars: 490,
    title_chars: 16,
    hashtag_count: 5,
    require_ai_disclosure: false,
  }
}

/**
 * 把工具返回的 checks 压成“能直接展示给人看”的阻断项。
 * contentCheck.blocking 是数量；真正的逐条原因在 checks[] 里。
 */
export function collectBlockingChecks(result: PrepareDraftResult | null): PrepareDraftCheck[] {
  const checks = result?.contentCheck?.checks
  if (!Array.isArray(checks)) return []
  return checks.filter((item) => item.level === 'block')
}

/**
 * 业务失败的标题。工具已经给了中文 message，这里只处理“没给”的兜底。
 */
export function failureTitle(result: PrepareDraftResult | null): string {
  switch (result?.errorCode) {
    case 'NO_ACCOUNT':
      return '目标平台还没有可用账号'
    case 'PREFLIGHT_BLOCKED':
      return '合规自检没通过，草稿没有落库'
    case 'GENERATION_FAILED':
      return '这次没生成出来'
    case 'MISSING_BRIEF':
      return '先写一句话需求'
    default:
      return result?.message || '这次没有完成'
  }
}
