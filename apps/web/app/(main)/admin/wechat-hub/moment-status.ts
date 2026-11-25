// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 朋友圈遍历停止原因 → 展示语义映射（纯函数，无 React 依赖，便于单测直连）。
 *
 * 契约：stopReason 取值 page-limit / scroll-stalled / occluded / no-more-data /
 * no-content / error / unsupported / null；limitReached 与 occludedBy 随行。
 * page-limit 与 limitReached 一律归成功态，不允许渲染成失败或部分失败。
 */
import type {
  WechatMomentFieldAvailability,
  WechatMomentStopReason,
  WechatMomentView,
} from '@ihui/types'

/** 与 @/components/feedback 的 Alert variant 对齐的可告警档位。 */
export type MomentStatusTone = 'success' | 'warning' | 'danger'

export interface MomentStatusMeta {
  tone: MomentStatusTone
  title: string
  description: string
}

export interface MomentStatusInput {
  stopReason: WechatMomentStopReason | null
  limitReached: boolean
  occludedBy: string | null
  fetched: number
}

const PAGE_LIMIT_TITLE = '已到页数上限，后续可能还有数据'

function pageLimitMeta(fetched: number, tail: string): MomentStatusMeta {
  return {
    tone: 'success',
    title: PAGE_LIMIT_TITLE,
    description: `本次抓到 ${fetched} 条动态；${tail}`,
  }
}

/**
 * 把遍历结果翻译成卡片上的 Alert 文案。终止原因缺失时按「有数据 / 无数据」兜底，
 * 不再回退到 partial 这类旧字段做一刀切。
 */
export function describeMomentFetchStatus(input: MomentStatusInput): MomentStatusMeta {
  const { stopReason, limitReached, occludedBy, fetched } = input

  switch (stopReason) {
    case 'page-limit':
      return pageLimitMeta(fetched, '达到页数上限，后续可能还有数据，可提高页数继续遍历。')
    case 'occluded': {
      const windowName = occludedBy?.trim() ?? ''
      return {
        tone: 'warning',
        title: '微信窗口被遮挡',
        description: windowName
          ? `被「${windowName}」遮挡，后台滚轮无效；把微信窗口露出后再遍历。`
          : '微信窗口被其它窗口遮挡，后台滚轮无效；把微信窗口露出后再遍历。',
      }
    }
    case 'scroll-stalled':
      return {
        tone: 'warning',
        title: '滚轮没有改变页面',
        description: '可能已到底部，或当前微信版本不响应后台滚轮。',
      }
    case 'no-more-data':
      return {
        tone: 'success',
        title: '已到朋友圈底部，没有更多',
        description: `本次抓到 ${fetched} 条动态。`,
      }
    case 'no-content':
      return {
        tone: 'warning',
        title: '未识别到正文',
        description: '页面抓到了，但没识别到正文，可能是图片动态。',
      }
    case 'error':
      return {
        tone: 'danger',
        title: '遍历出错',
        description: '驱动、截图或脚本执行失败，可把微信窗口露出后重试。',
      }
    case 'unsupported':
      return {
        tone: 'warning',
        title: '当前后端不支持',
        description: '当前后端不支持朋友圈遍历。',
      }
    case null:
      if (limitReached) {
        return pageLimitMeta(fetched, '达到页数上限，后续可能还有数据。')
      }
      if (fetched > 0) {
        return {
          tone: 'success',
          title: `抓到 ${fetched} 条`,
          description: '本次遍历未报告终止原因。',
        }
      }
      return {
        tone: 'warning',
        title: '没有抓到动态',
        description: '未识别到新的动态，可调整页数或窗口位置后重试。',
      }
  }

  return {
    tone: 'warning',
    title: '未识别的终止原因',
    description: '后端返回了前端尚未认识的状态，可刷新后重试。',
  }
}

/**
 * 字段可得性 → 一行展示文案。桥未上报 fields（null/undefined）时返回 null，
 * 由调用方决定是否渲染；不替缺失字段补造「可得」结论。
 */
export function formatMomentFields(
  fields: WechatMomentFieldAvailability | null | undefined,
): string | null {
  if (!fields) return null
  const segments = [
    `图片${fields.media ? '可得' : '不可得'}`,
    `点赞${fields.likes ? '可得' : '不可得'}`,
    `评论${fields.comments ? '可得' : '不可得'}`,
    `作者身份${fields.authorIdentity ? '可得' : '不可得'}`,
  ]
  const tail = fields.reason ? `；${fields.reason}` : ''
  return `字段可得性：${segments.join('、')}${tail}`
}

/** 仅当图片数量为正整数时保留；0、负数、小数、非数字一律不展示。 */
function positiveImageCount(moment: WechatMomentView): number | undefined {
  const value = moment.imageCount
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

/** 仅保留非空评论行；非字符串元素与空串过滤掉。 */
function validCommentTexts(moment: WechatMomentView): string[] {
  if (!Array.isArray(moment.commentTexts)) return []
  return moment.commentTexts.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  )
}

/**
 * 单条动态的摘要行：图片数量 · 相对时间 · 评论条数，按这个顺序用「 · 」拼接。
 * 任一项缺失或为脏值都自动不显示；三项都没有时返回 null，由调用方决定是否渲染。
 */
export function formatMomentExtra(moment: WechatMomentView | null | undefined): string | null {
  if (!moment) return null
  const segments: string[] = []
  const imageCount = positiveImageCount(moment)
  if (imageCount !== undefined) segments.push(`${imageCount} 张图片`)
  const timeText = typeof moment.timeText === 'string' ? moment.timeText.trim() : ''
  if (timeText) segments.push(timeText)
  const comments = validCommentTexts(moment)
  if (comments.length > 0) segments.push(`${comments.length} 条评论`)
  return segments.length > 0 ? segments.join(' · ') : null
}
