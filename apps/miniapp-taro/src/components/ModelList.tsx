// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useState, useMemo } from 'react'
import { useI18n, useTt, type TtFn } from '@/i18n'
import { View, Text } from '@tarojs/components'
import { cn, rnRadius, TARO_RPX_PER_PX } from '@ihui/design-tokens'
import {
  MODEL_LIST_AGENT_GLYPH_PX,
  MODEL_LIST_BADGE_FONT_PX,
  MODEL_LIST_BADGE_MARGIN_LEFT_PX,
  MODEL_LIST_BADGE_PADDING_X_PX,
  MODEL_LIST_BADGE_PADDING_Y_PX,
  MODEL_LIST_CHECK_GLYPH_PX,
  MODEL_LIST_CONTENT_BOTTOM_PADDING_PX,
  MODEL_LIST_EMPTY_FONT_PX,
  MODEL_LIST_EMPTY_PADDING_Y_PX,
  MODEL_LIST_NAME_FONT_PX,
  MODEL_LIST_PRICE_BADGE_FONT_PX,
  MODEL_LIST_PRICE_BADGE_PADDING_X_PX,
  MODEL_LIST_PRICE_BADGE_PADDING_Y_PX,
  MODEL_LIST_SECTION_HEADER_FONT_PX,
} from '@ihui/shared/ui/model-list-spec'
// 行尾「免费 / 付费」徽章的唯一判据(子路径导入,不挂 barrel)。
// 本端此前**没有判据** —— 徽章恒真渲染"免费",对付费模型也在说免费,那是假陈述;
// RN 侧则有两条互不相等的判据各住一个屏幕,现全部收进这一份实现。
import { modelIsFree } from '@ihui/shared/ui/model-badge-facts'
import type { ModelUsageCategory } from '@ihui/shared/constants'
import type { LlmModel } from '@/api'
import type { ModelType } from './ModelTypeButton'
// O81 票⑤续(2026-09-26):本组件 3 处 CDN 位图槽里,"选中态徽标"(selected_model.png)与
// "Agent 行 logo"(mian_label.png 首位用法)是功能图标,已按矢量优先换成与 RN 端
// `ModelList.tsx` 同一 lucide 字形(Agent 行 = `Bot`,选中圆点 = `Check`,守门 128 IC 实测
// RN 字形集 bot/check)。
// 收口票 2026-09-27:余下"排名第一"(rankone.png)与"免"(mian_label.png 行尾用法)两枚此前以
// "无字形可照抄"为由留位图 + 就地豁免 —— 这一理由被"择优=矢量优先"(用户已两次打回"一端 CDN
// 位图当图标")打回并取代:两槽都是**状态徽章**(AGENTS §4:徽章/状态指示属 UI 图标位,禁以位图
// 充当),而 RN 同一位本就是 TOP1/免费**文字徽章** ⇒ 三处位图槽全部换成与 RN 同形的文字徽章,
// 几何一律经 @ihui/shared/ui/model-list-spec(MODEL_LIST_BADGE_* / MODEL_LIST_PRICE_BADGE_*),
// 配色走 tokens 派生链(守门 93),圆角走档位表(守门 77)。本文件 icon-bitmap-exempt 随之退役。
import LineIcon from '@/components/LineIcon'
import { rpx } from '@/utils/rpx'
import {
  categoryLabel as categoryLabelOf,
  categoryOf,
  collapseLabel,
  expandLabel,
  historyLabel,
  splitModelCatalog,
} from '@/utils/model-catalog'

export type ModelItem = LlmModel

/**
 * 会显形的字号与留白不在本文件取数 —— 单一源是
 * `packages/shared/src/ui/model-list-spec`(模式同 IntelligentAssistant / BackChevron);
 * 这里只做单位换算(逻辑 px → rpx)。用函数形态而非 `'40rpx'` 字符串字面量:
 * SWC 会剥离 inline 的 rpx 字符串字面量(见 `@/utils/rpx` 头注),函数调用才保得住。
 */
const toUnit = (px: number) => rpx(px * TARO_RPX_PER_PX)

/**
 * ModelList 模型列表
 *
 * 两种 variant:
 * - 'list'(默认,兼容旧调用):普通列表,显示 name + provider + 头像首字母
 * - 'popup'(首页专用):对齐原项目 ModelList.vue,分类弹出列表:
 *   - 6 类(talk/image/video/audio/videoa/other)按 ModelType 分组
 *   - Agent 模式选项(pitch === -1)
 *   - slideUp 入场动画(opacity + translateY 60rpx)
 *   - 选中态:border #000 + box-shadow + 加粗文字
 *   - 模型行:80rpx 高 + 15rpx 圆角 + 4rpx 边框 + 左侧 logo + 中间名称 + 右侧选中圆点
 */
export interface ModelListProps {
  models: ModelItem[]
  selectedId?: string | number
  onSelect?: (model: ModelItem) => void
  loading?: boolean
  /** 列表模式:'list' 普通 / 'popup' 弹出分类(首页专用)*/
  variant?: 'list' | 'popup'
  /** popup 模式:当前模型类型(用于决定渲染哪一类模型)*/
  currentType?: ModelType | ''
  /** popup 模式:Agent 模式是否选中 */
  agentActive?: boolean
  /** popup 模式:Agent 模式点击回调 */
  onAgentSelect?: () => void
}

const TYPE_LABELS = (tt: TtFn): Record<string, string> => ({
  talk: tt('ModelList.d1', '对话'),
  image: tt('modelPlaza.tabImage', '图像'),
  video: tt('aigc.list.catVideo', '视频'),
  audio: tt('aigc.list.catAudio', '音频'),
  videoa: tt('ai.chatMessageItem.digitalHuman', '数字人'),
  other: tt('ModelList.d2', '全能'),
})

export default function ModelList({
  models,
  selectedId,
  onSelect,
  loading = false,
  variant = 'list',
  currentType = '',
  agentActive = false,
  onAgentSelect,
}: ModelListProps) {
  const tt = useTt()
  const { locale } = useI18n()
  const [historyExpanded, setHistoryExpanded] = useState(false)

  // 默认列表只保留"最新 + 对话类",其余全部收进历史模型折叠区(判定在后端,
  // 分组在 packages/shared,此处只做装配 — 见 utils/model-catalog.ts)
  const split = useMemo(() => splitModelCatalog(models), [models])
  // 当前选中项落在折叠区时自动展开,避免用户看不到自己选中的模型
  const selectedInArchived = useMemo(
    () => split.archived.some((g) => g.items.some((m) => m.id === selectedId)),
    [split.archived, selectedId],
  )
  const showArchived = historyExpanded || selectedInArchived

  const categoryLabel = (category: ModelUsageCategory): string => categoryLabelOf(category, locale)

  if (variant === 'popup') {
    // ===== popup 模式:对齐原项目 ModelList.vue(分类弹出列表 + slideUp 动画)=====
    if (loading) {
      return (
        <View style={{ padding: '10rpx 0 0' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <View
              key={i}
              className="flex items-center"
              style={{
                height: rpx(80),
                margin: '5rpx 0',
                padding: '0 15rpx',
                background: 'var(--color-muted)',
                borderRadius: rnRadius.lg,
              }}
            >
              <View
                style={{
                  width: rpx(40),
                  height: rpx(40),
                  borderRadius: rnRadius.lg,
                  background: 'var(--color-border)',
                }}
              />
              <View
                className="ml-[10rpx]"
                style={{
                  width: rpx(160),
                  height: rpx(16),
                  background: 'var(--color-border)',
                  borderRadius: rnRadius.xs,
                }}
              />
            </View>
          ))}
        </View>
      )
    }

    if (!models.length) {
      return (
        <View
          className="flex items-center justify-center"
          style={{
            paddingTop: toUnit(MODEL_LIST_EMPTY_PADDING_Y_PX),
            paddingBottom: toUnit(MODEL_LIST_EMPTY_PADDING_Y_PX),
          }}
        >
          {/* 空态字号与纵向留白取共享源(与 RN emptyText / empty 容器同档) */}
          <Text
            className="text-muted-foreground"
            style={{ fontSize: toUnit(MODEL_LIST_EMPTY_FONT_PX) }}
          >
            {tt('model.empty', '暂无模型')}
          </Text>
        </View>
      )
    }

    return (
      <View
        className="flex flex-col"
        style={{
          background: 'transparent',
          borderRadius: rnRadius.lg,
          // 顶部 10rpx 是端内既有档(与上方骨架屏容器同值,不属本票收口的跨端档),按原样保留;
          // 底部留白取共享源 —— RN `listBody.paddingBottom` 此前是端内独有一档,
          // 规则 3「一端有档另一端无 ⇒ 取较大者并让缺失端补同档」→ 本端补 24。
          paddingTop: '10rpx',
          paddingBottom: toUnit(MODEL_LIST_CONTENT_BOTTOM_PADDING_PX),
        }}
      >
        {/* 分类标题(对齐原项目 .title,display:none 在原项目但保留为视觉锚点)*/}
        {currentType && TYPE_LABELS(tt)[currentType] ? (
          <View style={{ padding: '0 15rpx', height: rpx(40), display: 'none' }}>
            <Text style={{ fontSize: toUnit(MODEL_LIST_SECTION_HEADER_FONT_PX), fontWeight: 600 }}>
              {TYPE_LABELS(tt)[currentType]}
            </Text>
          </View>
        ) : null}

        {/* Agent 模式选项(对齐原项目 chu-row pitch === -1)*/}
        {onAgentSelect ? (
          <View
            className={cn('ai-chu-row ai-slide-up', agentActive && 'ai-chu-row-active')}
            onClick={onAgentSelect}
            hoverClass="opacity-60"
          >
            <View className="flex items-center">
              {/* 票⑤续:本槽位原为 CDN 位图 mian_label.png,已矢量化为 RN AgentModeRow 同槽的
                  `<Bot size={20}>` 同字形(墨迹档 MODEL_LIST_AGENT_GLYPH_PX,色 = RN text.secondary) */}
              <LineIcon
                name="bot"
                size={MODEL_LIST_AGENT_GLYPH_PX * TARO_RPX_PER_PX}
                color="var(--color-muted-foreground)"
              />
              <Text
                className="ml-[10rpx]"
                style={{
                  fontSize: toUnit(MODEL_LIST_NAME_FONT_PX),
                  color: 'var(--color-foreground)',
                  fontWeight: agentActive ? 'bold' : 'normal',
                }}
              >
                {tt('ModelList.text1', 'Agent模式')}
              </Text>
              {/* "免"位图槽(mian_label.png)已换与 RN freeBadge 同形的文字徽章:
                  只换载体不重排,几何经 spec、配色走 tokens 链。
                  ⚠️ 这一枚**不**接 modelIsFree,是有意为之而非漏改:本行是「Agent 模式」
                  的模式行(RN 同一处 `AgentModeRow` 根本不渲染价格徽章),`ModelListProps`
                  在这条分支里没有 model 对象可投影 —— 硬套判据就得凭空造一个 id 或一个
                  `inputPrice: 0`,那等于给一条无数据源的分支发合格证(同 NEW 徽章不予复制的
                  处置)。该行"免费"属**模式级**声明,其价格事实在 LlmModel 契约之外,
                  要判红得先给模式定价,另计一票。圆角仍与价格徽章族同档取 md。 */}
              <View
                className="flex items-center justify-center"
                style={{
                  marginLeft: toUnit(MODEL_LIST_BADGE_MARGIN_LEFT_PX),
                  // Taro 的 style 是标准 CSSProperties,不认 RN 的 padding*Horizontal/Vertical 简写
                  // —— 拆四边同档同值(守门 128 读 padding* 键,拆法不改变量纲读数)
                  paddingLeft: toUnit(MODEL_LIST_PRICE_BADGE_PADDING_X_PX),
                  paddingRight: toUnit(MODEL_LIST_PRICE_BADGE_PADDING_X_PX),
                  paddingTop: toUnit(MODEL_LIST_PRICE_BADGE_PADDING_Y_PX),
                  paddingBottom: toUnit(MODEL_LIST_PRICE_BADGE_PADDING_Y_PX),
                  borderRadius: rnRadius.md,
                  background: 'var(--color-success-lighter)',
                }}
              >
                <Text
                  style={{
                    fontSize: toUnit(MODEL_LIST_PRICE_BADGE_FONT_PX),
                    color: 'var(--color-success)',
                  }}
                >
                  {tt('course.free', '免费')}
                </Text>
              </View>
            </View>
            {agentActive ? (
              <View
                className="flex items-center justify-center"
                style={{
                  width: rpx(32),
                  height: rpx(32),
                  borderRadius: rnRadius.lg,
                  // 票⑤续:底色与字形改为 §4 品牌实底成对档,与 RN `styles.check`
                  // (brand.cta 底 + ctaForeground 勾)同形;此前位图压在 --color-foreground 上
                  background: 'var(--color-cta)',
                }}
              >
                {/* RN 同槽 = Check() 组件 `<CheckIcon size={12}>`(票⑤续:selected_model.png 退役) */}
                <LineIcon
                  name="check"
                  size={MODEL_LIST_CHECK_GLYPH_PX * TARO_RPX_PER_PX}
                  color="var(--color-cta-foreground)"
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {/* 默认模型列表项:只展示"最新 + 对话类" */}
        {split.primary.map((model, index) => {
          const selected = model.id === selectedId
          return (
            <View
              key={model.id}
              className={cn('ai-chu-row ai-slide-up', selected && 'ai-chu-row-active')}
              style={{ animationDelay: `${index * 0.08}s` }}
              onClick={() => onSelect?.(model)}
              hoverClass="opacity-60"
            >
              <View className="flex items-center">
                {/* 模型 logo:对齐原项目 image_logo + chu-icon 40rpx 圆角 8rpx
                    原项目用 :src="item.img"(动态),LlmModel 无 img 字段,保留首字母占位 */}
                <View
                  className="flex items-center justify-center"
                  style={{
                    width: rpx(40),
                    height: rpx(40),
                    borderRadius: rnRadius.lg,
                    background: 'var(--color-muted)',
                  }}
                >
                  <Text style={{ fontSize: rpx(20), color: 'var(--color-muted-foreground)' }}>
                    {model.name.charAt(0)}
                  </Text>
                </View>
                {/* 模型名:对齐原项目 .chu-text 28rpx color #333 */}
                <Text
                  className="ml-[10rpx]"
                  style={{
                    fontSize: toUnit(MODEL_LIST_NAME_FONT_PX),
                    color: 'var(--color-foreground)',
                    fontWeight: selected ? 'bold' : 'normal',
                  }}
                >
                  {model.name}
                </Text>
                {/* 排名第一(rankone.png)已换与 RN rankBadge 同形的 TOP1 文字徽章:
                    实底金/琥珀 + 近白字走 --color-warning 链(RN 同语义 = #F5B301 复刻档),
                    几何经 spec 档,圆角取 rnRadius.md —— RN `styles.rankBadge` 本就是 md(6px)。
                    (此处原写"rnRadius.xs(与 RN rankBadge 同档)",那句注释是错的:xs=2px 而
                    RN rankBadge=md=6px,两端差两档而账面一路报绿;2026-09-27 随手改对,不留给
                    下一个人按它执行。) */}
                {index === 0 ? (
                  <View
                    className="flex items-center justify-center"
                    style={{
                      marginLeft: toUnit(MODEL_LIST_BADGE_MARGIN_LEFT_PX),
                      paddingLeft: toUnit(MODEL_LIST_BADGE_PADDING_X_PX),
                      paddingRight: toUnit(MODEL_LIST_BADGE_PADDING_X_PX),
                      paddingTop: toUnit(MODEL_LIST_BADGE_PADDING_Y_PX),
                      paddingBottom: toUnit(MODEL_LIST_BADGE_PADDING_Y_PX),
                      borderRadius: rnRadius.md,
                      background: 'var(--color-warning)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: toUnit(MODEL_LIST_BADGE_FONT_PX),
                        fontWeight: '700',
                        color: 'var(--color-warning-foreground)',
                      }}
                    >
                      TOP1
                    </Text>
                  </View>
                ) : null}
                {/* 行尾「免费 / 付费」二分支徽章(2026-09-27 把 RN 的价格徽章族铺到本端)。
                    原注释写的是"显示条件一字未动" —— 那句是事实,而没动的那个条件**恒真**:
                    付费模型在本端也被渲染成"免费",这是假陈述而不是"少一个徽章"。
                    现判据走唯一源 modelIsFree(价格字段在场以价格为准,两档皆缺才回落自由网关
                    id 前缀);分支形状与 RN `ModelList.tsx` 的 freeBadge/paidBadge 同形,
                    几何经 spec 的 MODEL_LIST_PRICE_BADGE_* 档,圆角取 rnRadius.md(RN 同元素同档)。
                    配色走 tokens 派生链、不自拼十六进制:RN warning.amberLight/amberText 的
                    同源 CSS 档 = --color-warning-amber-light / --color-warning-amber-text
                    (packages/design-tokens/src/styles/tokens.css 亮 243-244、暗 617-618)。
                    ⚠️ 已补(2026-09-27 本票收尾):course.paid 五语言包在位
                    (取值逐字取自本包已有的 devEnter.modelEdit.saleTypePaid —— 同一语义、已审过的档,
                    不另翻一份),离线语言包已 gen:i18n 重生成。第二个参数保留为**防御性回退**
                    (取不到键时端上不能空白),不是待补标记。 */}
                {modelIsFree({ id: model.id, inputPrice: model.input_price }) ? (
                  <View
                    className="flex items-center justify-center"
                    style={{
                      marginLeft: toUnit(MODEL_LIST_BADGE_MARGIN_LEFT_PX),
                      paddingLeft: toUnit(MODEL_LIST_PRICE_BADGE_PADDING_X_PX),
                      paddingRight: toUnit(MODEL_LIST_PRICE_BADGE_PADDING_X_PX),
                      paddingTop: toUnit(MODEL_LIST_PRICE_BADGE_PADDING_Y_PX),
                      paddingBottom: toUnit(MODEL_LIST_PRICE_BADGE_PADDING_Y_PX),
                      borderRadius: rnRadius.md,
                      background: 'var(--color-success-lighter)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: toUnit(MODEL_LIST_PRICE_BADGE_FONT_PX),
                        color: 'var(--color-success)',
                      }}
                    >
                      {tt('course.free', '免费')}
                    </Text>
                  </View>
                ) : (
                  <View
                    className="flex items-center justify-center"
                    style={{
                      marginLeft: toUnit(MODEL_LIST_BADGE_MARGIN_LEFT_PX),
                      paddingLeft: toUnit(MODEL_LIST_PRICE_BADGE_PADDING_X_PX),
                      paddingRight: toUnit(MODEL_LIST_PRICE_BADGE_PADDING_X_PX),
                      paddingTop: toUnit(MODEL_LIST_PRICE_BADGE_PADDING_Y_PX),
                      paddingBottom: toUnit(MODEL_LIST_PRICE_BADGE_PADDING_Y_PX),
                      borderRadius: rnRadius.md,
                      background: 'var(--color-warning-amber-light)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: toUnit(MODEL_LIST_PRICE_BADGE_FONT_PX),
                        color: 'var(--color-warning-amber-text)',
                      }}
                    >
                      {tt('course.paid', '付费')}
                    </Text>
                  </View>
                )}
              </View>
              {/* 用途分类标注 + 选中态(对齐原项目 .selected-icon 32rpx + selected_model.png) */}
              <View className="flex items-center">
                <Text
                  style={{
                    fontSize: rpx(20),
                    color: 'var(--color-muted-foreground)',
                    marginRight: rpx(12),
                  }}
                >
                  {categoryLabel(categoryOf(model))}
                </Text>
                {selected ? (
                  <View
                    className="flex items-center justify-center"
                    style={{
                      width: rpx(32),
                      height: rpx(32),
                      borderRadius: rnRadius.lg,
                      // 票⑤续:§4 品牌实底成对档,与 RN styles.check 同形(见 Agent 行同注释)
                      background: 'var(--color-cta)',
                    }}
                  >
                    <LineIcon
                      name="check"
                      size={MODEL_LIST_CHECK_GLYPH_PX * TARO_RPX_PER_PX}
                      color="var(--color-cta-foreground)"
                    />
                  </View>
                ) : null}
              </View>
            </View>
          )
        })}

        {/* ===== 历史模型折叠区(默认收起,点按钮才展开) ===== */}
        {split.archivedCount > 0 ? (
          <View
            className="ai-chu-row"
            style={{ background: 'var(--color-muted)', marginTop: rpx(10) }}
            onClick={() => setHistoryExpanded((v) => !v)}
            hoverClass="opacity-60"
          >
            <Text
              style={{
                fontSize: toUnit(MODEL_LIST_SECTION_HEADER_FONT_PX),
                color: 'var(--color-foreground)',
              }}
            >
              {`${historyLabel(locale)} (${split.archivedCount})`}
            </Text>
            <Text
              style={{
                fontSize: toUnit(MODEL_LIST_SECTION_HEADER_FONT_PX),
                color: 'var(--color-muted-foreground)',
              }}
            >
              {showArchived ? collapseLabel(locale) : expandLabel(locale)}
            </Text>
          </View>
        ) : null}

        {showArchived
          ? split.archived.map((group) => (
              <View key={`archived-${group.category}`}>
                {/* 分组标题:用途分类 + 数量(用间距分隔,不用 border 分割线)*/}
                <View style={{ padding: '16rpx 24rpx 4rpx' }}>
                  <Text
                    style={{
                      fontSize: toUnit(MODEL_LIST_SECTION_HEADER_FONT_PX),
                      color: 'var(--color-muted-foreground)',
                    }}
                  >
                    {`${categoryLabel(group.category)} · ${group.items.length}`}
                  </Text>
                </View>
                {group.items.map((model) => {
                  const selected = model.id === selectedId
                  return (
                    <View
                      key={model.id}
                      className={cn('ai-chu-row', selected && 'ai-chu-row-active')}
                      onClick={() => onSelect?.(model)}
                      hoverClass="opacity-60"
                    >
                      <View className="flex items-center">
                        <View
                          className="flex items-center justify-center"
                          style={{
                            width: rpx(40),
                            height: rpx(40),
                            borderRadius: rnRadius.lg,
                            background: 'var(--color-muted)',
                          }}
                        >
                          <Text
                            style={{ fontSize: rpx(20), color: 'var(--color-muted-foreground)' }}
                          >
                            {model.name.charAt(0)}
                          </Text>
                        </View>
                        <Text
                          className="ml-[10rpx]"
                          style={{
                            fontSize: toUnit(MODEL_LIST_NAME_FONT_PX),
                            color: 'var(--color-foreground)',
                            fontWeight: selected ? 'bold' : 'normal',
                          }}
                        >
                          {model.name}
                        </Text>
                      </View>
                      <View className="flex items-center">
                        <Text
                          style={{
                            fontSize: rpx(20),
                            color: 'var(--color-muted-foreground)',
                            marginRight: rpx(12),
                          }}
                        >
                          {categoryLabel(group.category)}
                        </Text>
                        {selected ? (
                          <View
                            className="flex items-center justify-center"
                            style={{
                              width: rpx(32),
                              height: rpx(32),
                              borderRadius: rnRadius.lg,
                              // 票⑤续:§4 品牌实底成对档,与 RN styles.check 同形(见 Agent 行同注释)
                              background: 'var(--color-cta)',
                            }}
                          >
                            <LineIcon
                              name="check"
                              size={MODEL_LIST_CHECK_GLYPH_PX * TARO_RPX_PER_PX}
                              color="var(--color-cta-foreground)"
                            />
                          </View>
                        ) : null}
                      </View>
                    </View>
                  )
                })}
              </View>
            ))
          : null}
      </View>
    )
  }

  // ===== 默认 'list' 模式:兼容 ChatDrawers 等旧调用 =====
  if (loading) {
    return (
      <View className="px-3 py-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={i} className="flex items-center py-3 animate-pulse">
            <View className="w-10 h-10 mr-3 rounded-lg bg-muted" />
            <View className="flex-1 space-y-2">
              <View className="h-3 w-1/3 rounded bg-muted" />
              <View className="h-[20rpx] w-2/3 rounded bg-muted" />
            </View>
          </View>
        ))}
      </View>
    )
  }

  if (!models.length) {
    return (
      // 空态纵向留白与 popup 变体、RN 端同取 spec 档 —— 此前这一支写 `py-12`(=48),而 popup 变体
      // 与 RN `empty.paddingVertical` 都是 MODEL_LIST_EMPTY_PADDING_Y_PX(=20):同一组件的两枚空态
      // 不该有两种留白(与 MODEL_LIST_EMPTY_FONT_PX 那条"两枚空态不该有两种字号"是同一条裁决;
      // 该档取值依据 = 规则 2 取紧凑档,空态盒上下无贴边/裁切风险)。
      // 形态沿用 popup 变体:className 只留布局,留白走 inline 函数形态(不用 '40rpx' 字符串字面量)。
      <View
        className="flex items-center justify-center"
        style={{
          paddingTop: toUnit(MODEL_LIST_EMPTY_PADDING_Y_PX),
          paddingBottom: toUnit(MODEL_LIST_EMPTY_PADDING_Y_PX),
        }}
      >
        {/* 空态字号与 popup 变体、RN 端同档 —— 同一组件的两枚空态不该有两种字号 */}
        <Text
          className="text-muted-foreground"
          style={{ fontSize: toUnit(MODEL_LIST_EMPTY_FONT_PX) }}
        >
          {tt('model.empty', '暂无模型')}
        </Text>
      </View>
    )
  }

  return (
    <View className="px-3 py-1">
      {/* 默认列表:只展示"最新 + 对话类" */}
      {split.primary.map((model) => {
        const selected = model.id === selectedId
        return (
          <View
            key={model.id}
            className={`flex items-center py-[20rpx] px-3 mb-2 rounded-lg transition-colors ${
              selected ? 'bg-muted' : 'bg-card'
            }`}
            onClick={() => onSelect?.(model)}
            hoverClass="opacity-60"
          >
            <View className="flex items-center justify-center w-10 h-10 mr-3 rounded-lg bg-muted">
              <Text className="text-sm font-medium text-muted-foreground">
                {model.name.charAt(0)}
              </Text>
            </View>
            <View className="flex-1 min-w-0">
              <View className="flex items-center">
                <Text className="text-sm font-medium text-foreground truncate">{model.name}</Text>
                {/* 选中态:U+2713 勾字符改矢量;size 走本族勾字号单一源
                    MODEL_LIST_CHECK_GLYPH_PX(=12px,与原 text-xs 同档)× TARO_RPX_PER_PX,
                    端内不另立数字;color = 原类名的 text-primary */}
                {selected && (
                  <LineIcon
                    name="check"
                    size={MODEL_LIST_CHECK_GLYPH_PX * TARO_RPX_PER_PX}
                    color="var(--color-primary)"
                    className="ml-2"
                  />
                )}
              </View>
              <Text className="text-xs text-muted-foreground truncate">{model.provider}</Text>
            </View>
            <Text className="ml-2 text-xs text-muted-foreground shrink-0">
              {categoryLabel(categoryOf(model))}
            </Text>
          </View>
        )
      })}

      {/* ===== 历史模型折叠区(默认收起) ===== */}
      {split.archivedCount > 0 ? (
        <View
          className="flex items-center justify-between px-3 py-[20rpx] mb-2 rounded-lg bg-muted"
          onClick={() => setHistoryExpanded((v) => !v)}
          hoverClass="opacity-60"
        >
          <Text className="text-sm text-foreground">
            {`${historyLabel(locale)} (${split.archivedCount})`}
          </Text>
          {/* 开合指示用文字而非图标字形:项目守门(11h)禁止在 UI 图标位使用
              emoji / 符号字符做图标,小程序端也没有 lucide 可用,故用中文状态词 */}
          <Text className="text-sm text-muted-foreground">
            {showArchived ? collapseLabel(locale) : expandLabel(locale)}
          </Text>
        </View>
      ) : null}

      {showArchived
        ? split.archived.map((group) => (
            <View key={`archived-${group.category}`} className="mb-2">
              {/* O81 逐档复核(2026-09-27):分组头行底衬 4→8 —— 与 RN 同一元素 sectionHeader 的
                  paddingVertical 8、及本行自己的 pt-2 同档(同元素两端不同档 ⇒ 收敛,间距取较大)。
                  守门 128 读数「仅小程序档 4」的另一半是 list 变体外层容器 py-1,该层内衬已由
                  model-list-spec 头注登记为「另计一票」布局裁决项,本票不动,故 4 仍会在读数出现。 */}
              <View className="px-3 pt-2 pb-2">
                <Text className="text-xs text-muted-foreground">
                  {`${categoryLabel(group.category)} · ${group.items.length}`}
                </Text>
              </View>
              {group.items.map((model) => {
                const selected = model.id === selectedId
                return (
                  <View
                    key={model.id}
                    className={`flex items-center py-[20rpx] px-3 mb-2 rounded-lg transition-colors ${
                      selected ? 'bg-muted' : 'bg-card'
                    }`}
                    onClick={() => onSelect?.(model)}
                    hoverClass="opacity-60"
                  >
                    <View className="flex items-center justify-center w-10 h-10 mr-3 rounded-lg bg-muted">
                      <Text className="text-sm font-medium text-muted-foreground">
                        {model.name.charAt(0)}
                      </Text>
                    </View>
                    <View className="flex-1 min-w-0">
                      <View className="flex items-center">
                        <Text className="text-sm font-medium text-foreground truncate">
                          {model.name}
                        </Text>
                        {/* 选中态:U+2713 勾字符改矢量;取值同上默认列表那一处 */}
                        {selected && (
                          <LineIcon
                            name="check"
                            size={MODEL_LIST_CHECK_GLYPH_PX * TARO_RPX_PER_PX}
                            color="var(--color-primary)"
                            className="ml-2"
                          />
                        )}
                      </View>
                      <Text className="text-xs text-muted-foreground truncate">
                        {model.provider}
                      </Text>
                    </View>
                    <Text className="ml-2 text-xs text-muted-foreground shrink-0">
                      {categoryLabel(group.category)}
                    </Text>
                  </View>
                )
              })}
            </View>
          ))
        : null}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
