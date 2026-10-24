// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D99 富文本动作锚点:内联语法白名单 + 识别器 + 原生芯片渲染(全 RN 原生组件,零 HTML)。

import { type ReactNode } from 'react'
import { StyleSheet, Text, TouchableOpacity, type StyleProp, type TextStyle } from 'react-native'
import { MousePointerClick } from 'lucide-react-native'
import { tokens } from '../../theme/active-tokens'
import { rnRadius } from '@ihui/design-tokens'
import { rpx } from '../../utils/rpx'
import { useI18n } from '../../i18n'

/**
 * D99 动作锚点 —— 模型在**正文**里下发的「可点击动作」。
 *
 * 定位:这是**识别 + 展示**层,不是执行层。识别器只负责把文本切成
 * 「原文片段 / 锚点」两类中性单元,点击后把整枚锚点**原样**交给宿主回调;
 * 本文件不解析 payload、不发起请求、不跳转、不 eval —— 越权即漏洞。
 */
export interface ActionAnchor {
  /**
   * 动作类型 —— 已折叠为**小写**(形状白名单:`[A-Za-z][A-Za-z0-9_-]`,≤24 字符)。
   * 大小写不敏感 ⇒ 宿主的语义白名单只需对一份小写名单比对,不出现 `openUrl/openurl` 双拼。
   */
  type: string
  /** 芯片上显示的文案(取自模型输出,已做长度与字符集收敛) */
  label: string
  /** 动作参数(不透明字符串:URL 只放行 http/https,其余按窄字符集 token 放行) */
  payload?: string
}

/** extractActionAnchors 的返回单元:text = 原文片段,anchor = 校验通过的动作锚点 */
export type ActionAnchorPart =
  { kind: 'text'; text: string } | { kind: 'anchor'; anchor: ActionAnchor }

/**
 * 内联语法(RN 端白名单,**唯一**形态):
 *   [[action:<type>:<label>]]             无参动作
 *   [[action:<type>:<label>|<payload>]]   带参动作
 *
 * 为什么是双中括号 `[[ ]]`:
 *   - 单中括号在本端已被占用:`[语音] <url> <秒>`(../../utils/message-parse)与 Markdown
 *     链接 `[文案](url)` 都是单括号形态,沿用单括号 = 与既有识别器互吃;
 *   - `[[...]]` 在自然语言与代码里几乎不出现,误伤率最低。且锚点只在 **text 段** 内识别
 *     (``` 代码块已被 parseMessageContent 先切走),不会污染代码展示;
 *   - 固定 `action:` 前缀,保证「形似锚点但语义不明的标记」一律不被消费。
 *
 * type 段:字母开头、仅字母数字与 `_ -`、≤24 字符,**大小写不敏感**(识别后统一折叠为小写,
 * 宿主的语义白名单只需对一份小写名单比对)。形状白名单就写在正则字符集里,不留第二张名单。
 *
 * 为什么三段而不是两段(`[[action:label|payload]]`):ActionAnchor 契约里有 `type`,
 * 两段语法下 type 只能恒为 'action',等于把这个字段废掉 —— 宿主拿不到分发依据。
 *
 * 与 web 的对齐口径(2026-10-19 立):截至本文件落地,仓内尚无 web 侧同名实现
 * (全仓 grep `ActionAnchor` / `[[action` 零命中),故 RN 端先立此白名单并作为**本端唯一真相源**;
 * web 后续若采用别的定界符,需在**两边各自**加注释互指,**不要共用一份正则** ——
 * 一端收紧/放宽会带着另一端漂,这是本仓跨端漂移的老病因。
 */
// type 段放开大小写(调用侧统一折叠),label 段禁 `|[]` 与换行(这两个字符是定界符),
// payload 段禁 `[]` 与换行(`|` 允许,因为 payload 一直吃到 `]]` 为止)。
const ACTION_ANCHOR_RE =
  /\[\[action:([A-Za-z][A-Za-z0-9_-]{0,23}):([^\][|\r\n]{1,40})(?:\|([^\][\r\n]{0,2048}))?\]\]/g

/** URL 放行闸:整串匹配 http(s):// —— 不给 javascript:/data:/file:/vbscript: 留缝 */
const HTTP_URL_RE = /^https?:\/\/\S+$/i
/** 带 scheme 形态的探测(用于决定走 URL 闸还是 token 闸) */
const HAS_SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.\-]*:/
/** 无 scheme 时的窄字符集不透明 token(空格允许,其余空白/控制字符/引号/尖括号一律拒) */
const OPAQUE_PAYLOAD_RE = /^[A-Za-z0-9][A-Za-z0-9_\-./:@?=&%+~ ]{0,2047}$/

/**
 * payload 放行闸(唯一一道)。
 *
 * @returns 通过时返回**去空白后**的 payload;不通过返回 undefined。
 *
 * 判据:
 *   ① 形如 `scheme:...` 的一律当 URL 判,只放行 http/https(javascript:/data:/file: 等全拒);
 *   ② 其余按窄字符集不透明 token 判;空串视为未提供。
 *
 * 注意**不通过 = 整枚锚点不识别**(原文留在 text 段照常显示),而不是"剥掉参数留一个
 * 还能点的芯片":少参的动作点下去是**错的**动作,宁可露出原始标记,也不猜语义。
 * 全程不做 URL 解析 / 解码 / 拼接:payload 只作为不透明字符串透传给宿主。
 */
function allowPayload(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined
  const payload = raw.trim()
  if (payload === '') return undefined
  if (HAS_SCHEME_RE.test(payload)) return HTTP_URL_RE.test(payload) ? payload : undefined
  return OPAQUE_PAYLOAD_RE.test(payload) ? payload : undefined
}

/**
 * 把**文本段**切成「原文片段 + 动作锚点」序列(纯函数)。
 *
 * 契约(下游与单测按此对账):
 *   - 空串 / 空白 ⇒ `[]`(不产 text 节点);无锚点 ⇒ 恰好一个 `{kind:'text'}` 携带**原串**;
 *   - 不变量:所有 text 片段按序拼接 + 被消费的锚点原文 == 输入(未通过校验的标记留在 text 里,
 *     所以「整段还原」永远成立,不会静默改写模型输出);
 *   - 不抛异常、不依赖外部状态;模块级 `g` 正则在入口归零 lastIndex(与 message-parse
 *     同款纪律:跨消息残留 lastIndex 会吃掉下一个锚点);
 *   - 匹配最小长度 > 0(`[[action:` 前缀 + 必填 label + `]]`),故 exec 循环不可能零长命中死循环。
 */
export function extractActionAnchors(text: string): ActionAnchorPart[] {
  if (!text) return []
  const parts: ActionAnchorPart[] = []
  let cursor = 0
  ACTION_ANCHOR_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ACTION_ANCHOR_RE.exec(text)) !== null) {
    const type = (m[1] ?? '').toLowerCase()
    const label = (m[2] ?? '').trim()
    const payload = allowPayload(m[3])
    // label 空白 / payload 被拒 ⇒ 不当锚点消费,原文留在 text 段(保守白名单:只认完全合格的)
    if (label === '' || (m[3] !== undefined && payload === undefined)) continue
    if (m.index > cursor) parts.push({ kind: 'text', text: text.slice(cursor, m.index) })
    parts.push({
      kind: 'anchor',
      anchor: payload === undefined ? { type, label } : { type, label, payload },
    })
    cursor = m.index + (m[0]?.length ?? 0)
  }
  if (cursor < text.length) parts.push({ kind: 'text', text: text.slice(cursor) })
  return parts
}

const styles = StyleSheet.create({
  // ── D99 动作锚点:文本段内「原文 + 芯片」的行内流容器 ──
  // 用 row + wrap 而不是 <Text> 内嵌 <View>:RN 里把 TouchableOpacity 塞进 <Text>
  // 属"能跑但各端不一致"的写法(iOS/Android 行内视图命中区域与基线对齐都有差异),
  // 这里要的是**可预测的点击区域**,故让文字片段与芯片同为行内块、随行换行。
  anchorParagraph: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  anchorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rpx(4),
    marginVertical: rpx(2),
    paddingHorizontal: rpx(12),
    paddingVertical: rpx(2),
    borderRadius: rnRadius.md,
    borderWidth: 1,
    borderColor: tokens.brandAccent.DEFAULT,
    backgroundColor: tokens.brandAccent.light,
  },
  // 用户气泡(brand.cta 实底)上的芯片:cta/ctaForeground 是**成对**的明暗翻面档,
  // 与 msgBubbleUser / msgTextUser 同一口径,不另取一档色。
  anchorChipUser: {
    borderColor: tokens.brandAccent.deep,
    backgroundColor: tokens.brand.ctaForeground,
  },
  anchorChipLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: tokens.brandAccent.deep,
  },
  anchorChipLabelUser: {
    color: tokens.brand.cta,
  },
  // 降级态:不挂语义,只是加粗正文(取色沿用调用方传入的正文样式,字号不另起一档)
  anchorFallbackText: {
    fontWeight: '600',
  },
})

interface ActionAnchorChipProps {
  /** 已通过 extractActionAnchors 校验的锚点 */
  anchor: ActionAnchor
  /** true = 用户气泡(实底),取色走 cta/ctaForeground;缺省 false = AI 气泡卡片底 */
  isUser?: boolean
  /** 正文样式(由调用方透传,保证降级态与周围文字同字号同取色,不另起一档) */
  textStyle?: StyleProp<TextStyle>
  /** 动作出口;**不传 ⇒ 降级为普通加粗 <Text>**(不挂点击语义、不坏渲染、不崩) */
  onActionAnchor?: (anchor: ActionAnchor) => void
}

/**
 * D99 动作芯片:一枚 TouchableOpacity,内容只有「图标 + label」。
 *
 * 安全口径:label / payload 全都经 RN 原生 <Text> 渲染 —— 无 HTML、无 WebView、
 * 无 dangerouslySetInnerHTML,payload **不渲染**(只随回调透传),避免把长 URL 铺进正文。
 */
export function ActionAnchorChip({
  anchor,
  isUser = false,
  textStyle,
  onActionAnchor,
}: ActionAnchorChipProps): ReactNode {
  const { t } = useI18n()
  if (!onActionAnchor) {
    return <Text style={[textStyle, styles.anchorFallbackText]}>{anchor.label}</Text>
  }
  const ink = isUser ? tokens.brand.cta : tokens.brandAccent.deep
  return (
    <TouchableOpacity
      style={[styles.anchorChip, isUser ? styles.anchorChipUser : null]}
      hitSlop={6}
      onPress={() => {
        onActionAnchor(anchor)
      }}
      accessibilityRole="button"
      accessibilityLabel={t('chat.actionRunA11y', { label: anchor.label })}
    >
      <MousePointerClick size={13} color={ink} />
      <Text style={[textStyle, styles.anchorChipLabel, isUser ? styles.anchorChipLabelUser : null]}>
        {anchor.label}
      </Text>
    </TouchableOpacity>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
