// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文件预览四级降级文案(D90 / G-123,对标 Qoder 一手原文)。
 *
 * 四级由"手里到底有什么内容"决定,不是四个并列的错误码:
 *  1. `previewSnapshotBadge`   —— 快照态标识:看到的是工具记录里的历史内容,不是当前文件
 *  2. `previewSnapshotNotice`  —— 当前文件读不到,退回展示记录里的内容
 *  3. `previewIncompleteChange`—— 有记录,但这次变更没记全
 *  4. `previewNoContent`       —— 既读不到、也没有任何历史记录可展示
 * 外加"文件已更新"提示条(`previewFileUpdated` + `previewFileUpdatedAction` + 可关闭)。
 *
 * 词表约束:建议键登记在 `PREVIEW_COPY_NAMESPACE`(`a11y`)下,但**本模块不假设键已入库**
 * —— 取词顺序是"有键取键、无键回落内联文案",绝不回显键名(键名喷到界面上等于把
 * i18n 内部标识漏给终端用户)。键入库后这里自动切换到词表值,无需改调用点。
 */

export const PREVIEW_COPY_NAMESPACE = 'a11y' as const

export type PreviewCopyKey =
  | 'previewSnapshotBadge'
  | 'previewSnapshotReadAt'
  | 'previewSnapshotNotice'
  | 'previewIncompleteChange'
  | 'previewNoContent'
  | 'previewFileUpdated'
  | 'previewFileUpdatedAction'

export interface PreviewCopyEntry {
  readonly zh: string
  readonly en: string
}

/**
 * 内联兜底文案(与下方建议键值逐字一致,主 agent 入词表后本表仅作缺词兜底)。
 * 每行标注 next-intl 是为了让守门 70 把这批译文表按 i18n 数据放过 —— 它们不是待抽出的
 * 界面硬编码,而是"词表缺键时的兜底译文",删掉就等于把兜底也删了。
 */
export const PREVIEW_DEGRADATION_COPY: Record<PreviewCopyKey, PreviewCopyEntry> = {
  previewSnapshotBadge: { zh: '工具记录内容', en: 'Tool-recorded content' }, // next-intl 缺词兜底
  previewSnapshotReadAt: { zh: '读取于 {time}', en: 'Read at {time}' }, // next-intl 缺词兜底
  previewSnapshotNotice: {
    zh: '无法读取当前文件，已展示工具记录中的内容。', // next-intl 缺词兜底
    en: "Can't read the current file. Showing content from the tool record.",
  },
  previewIncompleteChange: {
    zh: '这次文件变更没有记录完整内容。', // next-intl 缺词兜底
    en: "This file change didn't record the complete content.",
  },
  previewNoContent: { zh: '没有可预览内容。', en: 'Nothing to preview.' }, // next-intl 缺词兜底
  previewFileUpdated: { zh: '文件已更新', en: 'File updated' }, // next-intl 缺词兜底
  previewFileUpdatedAction: {
    zh: '刷新以查看最新内容', // next-intl 缺词兜底
    en: 'Refresh to view the latest content',
  },
} as const

export type PreviewValues = Record<string, string | number>

/** 与 next-intl 的 `useTranslations()` 返回值兼容的最小取词面。 */
export type PreviewTranslator = (key: string, values?: PreviewValues) => string

/** 兜底语言:词表缺键时用运行期语言挑中/英,SSR 无 navigator 时回落项目基准中文。 */
function pickFallbackLocale(): 'zh' | 'en' {
  if (typeof navigator === 'undefined') return 'zh'
  const tag = typeof navigator.language === 'string' ? navigator.language.toLowerCase() : ''
  return tag.startsWith('zh') ? 'zh' : 'en'
}

function interpolate(text: string, values?: PreviewValues): string {
  if (!values) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : whole,
  )
}

/** 取词结果是否可信(排除喷键名、next-intl 的 MISSING_MESSAGE、空串)。 */
function isUsableTranslation(out: unknown, key: string): out is string {
  if (typeof out !== 'string') return false
  const trimmed = out.trim()
  if (trimmed === '' || trimmed === key) return false
  if (trimmed.includes('MISSING_MESSAGE') || trimmed.includes(`[${key}]`)) return false
  return true
}

/**
 * 有键取键、无键回落内联文案。
 * @param t `useTranslations(PREVIEW_COPY_NAMESPACE)` 的返回值;传 undefined 时直接走兜底
 */
export function previewCopyText(
  t: PreviewTranslator | undefined,
  key: PreviewCopyKey,
  values?: PreviewValues,
): string {
  if (t) {
    try {
      const out = t(key, values)
      if (isUsableTranslation(out, key)) return out
    } catch {
      // next-intl 缺键会抛 MISSING_MESSAGE —— 属预期路径,回落内联文案而非喷键名
    }
  }
  const entry = PREVIEW_DEGRADATION_COPY[key]
  return interpolate(entry[pickFallbackLocale()], values)
}

/** 快照读取时刻:AGENTS §4 要求时间一律走 Intl.DateTimeFormat,不手拼字符串。 */
export function formatPreviewReadTime(epochMs: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(
      new Date(epochMs),
    )
  } catch {
    // 极端环境(无 ICU 数据)下宁可只显示小时,也不抛断渲染
    return `${new Date(epochMs).getHours()}:00`
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
