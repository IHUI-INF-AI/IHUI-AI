// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { CSSProperties } from 'react'
import { useTt, t } from '@/i18n'
import { View, Text, type ITouchEvent } from '@tarojs/components'
import { FocusInput } from '@/components/FocusField'
import { cn, rnRadius, TARO_RPX_PER_PX, taroSpacing } from '@ihui/design-tokens'
import {
  BOTTOM_ACTION_BAR_CHIP_FONT_PX,
  BOTTOM_ACTION_BAR_MODEL_BAR_FONT_PX,
  BOTTOM_ACTION_BAR_TEXT_FONT_PX,
  // 票⑤(2026-09-26):模型提示条图章的墨迹档(位图退役后取数一律经这一枚)
  BOTTOM_ACTION_BAR_MODEL_BADGE_PX,
  // 票⑥(2026-09-26):默认变体的附件/发送键 —— 方块与墨迹的唯一档源(与 RN 端同读这两个常量)
  BOTTOM_ACTION_BAR_CONTROL_BOX_PX,
  BOTTOM_ACTION_BAR_CONTROL_GLYPH_PX,
  BOTTOM_ACTION_BAR_SEND_GLYPH_PX,
} from '@ihui/shared/ui/bottom-action-bar-spec'
// O02 票④(2026-10-25):条的**结构**与**行/卡/控件的几何**收进平台无关核心,本文件只留
// className 适配 + 平台原语(照 BackChevron 的形态:一份源 + 两端注入 adapter)。
import {
  BottomActionBarControl,
  BottomActionBarIconCardRow,
  BottomActionBarInlineRow,
  type BottomActionBarIconCardItem,
  type BottomActionBarPlatform,
} from '@ihui/shared/ui'
import LineIcon, { type IconName } from '@/components/LineIcon'
import InputArea, { type InputAreaProps } from './InputArea'
// O81 票⑤(2026-09-26):这 5 个槽位此前指向 aizhs.top 的 CDN 位图。位图不能随主题反色、
// 不跟字号缩放、描边粗细与 RN 端不一致,且违反 AGENTS §4「UI 图标一律用矢量图标库」,
// 故按"矢量优先"换成 `<LineIcon name="…">`(CSS mask 渲染 ⇒ 随 token 换色),
// 字形名与 RN 端 `BottomActionBar.tsx` 的 ICON_GROUP_ITEMS / 模型条所用 lucide 图标同名。
import { rpx } from '@/utils/rpx'

/**
 * BottomActionBar 底部操作栏
 *
 * 两种 variant:
 * - 'default'(默认,兼容旧调用):单行布局,attach + input + send
 * - 'ai-home'(首页专用):对齐原项目 BottomActionBar.vue:
 *   - ToggleButtonGroup(功能切换组,4 个按钮:深度思考 / 联网 / 知识库 / 永久记忆)
 *   - InputArea(ai-home 模式)
 *   - icon-button-group(4 个图标按钮:相机/相册/本地文件/微信文件)
 *
 * 其他页面只传 value/placeholder/onSend 等,默认行为不变。
 */

export interface ToggleButtonItem {
  key: string
  label: string
  active?: boolean
  onToggle?: () => void
}

export interface IconButtonItem {
  key: string
  label: string
  /** 矢量字形名(LineIcon 登记表键 = lucide 原名);类型收窄到 IconName 是"两端同一字形"的编译期保证 */
  icon: IconName
  onClick?: () => void
}

/** 对齐 RN 端同名类型:图标按钮组点击来源(相机/相册/文件/微信文件)。
 *  小程序端 icon-button-group 的 key 与 RN 的 ICON_GROUP_ITEMS.type 同一套值(同一 lucide 族),
 *  故类型契约直接对齐,避免两端各写一份字符串联合。 */
export type BottomActionBarIconType = 'camera' | 'album' | 'file' | 'wxfile'

export interface BottomActionBarProps {
  // ===== 默认模式 props(兼容旧调用)=====
  value?: string
  placeholder?: string
  disabled?: boolean
  showAttach?: boolean
  showSend?: boolean
  onInput?: (value: string) => void
  onSend?: () => void
  onAttach?: () => void
  /** 发送中(RN 端同名 isLoading 的落点):默认变体禁用发送键,ai-home 变体透传 InputArea 的发送禁用通道 */
  isLoading?: boolean

  /** 样式变体:'default'(旧)/ 'ai-home'(首页专用) */
  variant?: 'default' | 'ai-home'

  // ===== ai-home 模式 props =====
  /** 当前模型名(显示在 button-group-box) */
  modelName?: string
  /** 显示 4 个图标按钮(相机/相册/文件/微信文件)*/
  showIconButtons?: boolean
  /** ToggleButtonGroup 列表 */
  toggleButtons?: ToggleButtonItem[]
  /** InputArea 透传 props(ai-home 模式) */
  inputAreaProps?: Partial<InputAreaProps>
  /** 图标按钮列表(默认 4 个:相机/相册/本地文件/微信文件) */
  iconButtons?: IconButtonItem[]
  /** 图标按钮点击回调 */
  onIconButtonClick?: (item: IconButtonItem) => void
  /** ToggleButton 切换回调 */
  onToggle?: (item: ToggleButtonItem) => void
  /** 语音输入模式 */
  isVoiceInput?: boolean
  /** 语音输入切换回调 */
  onVoiceInputToggle?: () => void
  /** 手动压缩上下文:加载态(与 RN 端同名同义) */
  compactContextLoading?: boolean
  /** 手动压缩上下文回调(与 RN 端同名同义) */
  onCompactContext?: () => void

  // ===== 门285 存量收敛:B1 块对齐 RN 端 BottomActionBar 的属性(全部可选,与 RN 一致)=====
  // 注:以下仅补齐 props 接口/类型,RN 同名同义且小程序已存在的
  // compactContextLoading / onCompactContext / isLoading 不再重复;
  // 与小程序既有属性异名同义的 prompt→value、onPromptChange→onInput、
  // onToggleVoiceInput→onVoiceInputToggle 见 .ihui-agent/tmp/xend-props/equiv-B1.json,不在此重复加。
  /** 图片预览列表(绑定 onRemoveImage);RN 端同名 */
  images?: readonly string[]
  /** 显示图标按钮组(相机/相册/文件);RN 端同名 */
  isShowIcon?: boolean
  // 2026-11-04 审计返工:knowledgeBaseEnabled / mcpEnabled 两端 0 调用方,删声明(死腿不当平台档)
  /** 添加附件回调;RN 端同名 */
  onAddFile?: () => void
  /** 长按结束(语音按钮 onPressOut);RN 端同名 */
  onEndLongPress?: () => void
  /** 放大回调(辅助按钮行 ⛶);RN 端同名 */
  onFangda?: () => void
  /** 功能处理回调(辅助按钮行 ƒ);RN 端同名 */
  onFunctionHandle?: () => void
  /** 图标按钮组点击回调(type: 相机/相册/文件/微信文件);RN 端同名 */
  onIconClick?: (type: BottomActionBarIconType) => void
  /** 输入框失焦;RN 端同名 */
  onInputBlur?: () => void
  /** 输入框点击;RN 端同名 */
  onInputClick?: () => void
  /** 输入框聚焦;RN 端同名 */
  onInputFocus?: () => void
  // 2026-11-04 审计返工:onKeyboardHide / onKeyboardShow 两端 0 调用方,删声明
  /** 模型配置变更(AGENTS §3:用 unknown);RN 端同名 */
  onModelConfigChange?: (config: unknown) => void
  /** 「+」按钮回调;RN 端同名 */
  onPlusToggle?: () => void
  /** 移除图片(index);RN 端同名 */
  onRemoveImage?: (index: number) => void
  /** 显示模型配置;RN 端同名 */
  onShowModelConfig?: () => void
  /** 显示模型列表;RN 端同名 */
  onShowModelList?: () => void
  /** 「我的创作」入口回调;RN 端同名 */
  onShowMyCreation?: () => void
  // 2026-11-04 审计返工:onSourceHandle 小程序端无来源面板实现(仅声明无渲染=空 prop),删声明;
  // RN 侧该能力真实存在,登记为平台档(功能缺口待接,审计值 implement/功能待办)
  /** 长按开始(语音按钮 onLongPress);RN 端同名 */
  onStartLongPress?: () => void
  // 2026-11-04 审计返工:onStartVoiceAnimation / onStopVoiceAnimation / onTextareaHeightChange 两端 0 调用方,删声明
  // 2026-11-04 审计返工:onToggleKnowledgeBase / onToggleMcp / onTogglePermanentMemory /
  // onToggleSuperAgent / onToggleSuperAgentfu / permanentMemoryEnabled 两端 0 调用方,删声明
  /** 「+」按钮激活态;RN 端同名 */
  plusActive?: boolean
  /** 录音中;RN 端同名 */
  recording?: boolean
  /** 录音时长(秒);RN 端同名 */
  recordingDuration?: number
  // 2026-11-04 审计返工:showToggleChips / superAgentEnabled 两端 0 调用方,删声明
  /** 语音输入能力开关态;RN 端同名(注意与小程序既有 isVoiceInput 模式标志区分) */
  voiceInputEnabled?: boolean
}

/**
 * 与 RN 端同含义的几何档不在本文件取数 —— 单一源是
 * `packages/shared/src/ui/bottom-action-bar-spec`(模式同 IntelligentAssistant / BackChevron);
 * 这里只做单位换算(逻辑 px → rpx)。圆角走 `rnRadius.*` 档(守门 77 的单一源)。
 * 端内保留的数字都在 spec 头注里逐条给了理由(图标卡组、模型行徽标等:RN 端无同一元素)。
 */
const toUnit = (px: number) => rpx(px * TARO_RPX_PER_PX)

/**
 * 注入给共享核心的平台原语(小程序这一端的适配器)。
 * 这里**只**做"平台件怎么摆":盒子用 Taro View + className/CSS 长度串、可按压用 onClick +
 * 静态 hoverClass、字形走 CSS mask 的 LineIcon。结构与几何一律由 core 供出,本文件不再各写一份。
 * 无障碍名称这一端无通道(收编前本组件也没有该词条)⇒ 原语不落 aria 属性,不凭空造文案。
 */
const miniPlatform: BottomActionBarPlatform<string, CSSProperties, ITouchEvent> = {
  toUnit,
  // 字形墨迹:LineIcon 的数字 size 即 rpx(与收编前 `size={toUnit(...)}` 同值),H5 由组件内换算。
  glyphUnit: (px) => px * TARO_RPX_PER_PX,
  View: ({ className, style, boxStyle, children }) => (
    <View className={className} style={{ ...boxStyle, ...style }}>
      {children}
    </View>
  ),
  Text: ({ className, style, fontSize, color, children }) => (
    <Text className={className} style={{ fontSize, color, ...style }}>
      {children}
    </Text>
  ),
  Pressable: ({
    onActivate,
    disabled,
    active,
    className,
    boxStyle,
    style,
    activeStyle,
    disabledStyle,
    children,
  }) => (
    <View
      className={className}
      style={{
        ...boxStyle,
        ...style,
        ...(active === true ? activeStyle : null),
        ...(disabled === true ? disabledStyle : null),
      }}
      onClick={(event) => {
        if (disabled === true) return
        onActivate?.(event)
      }}
      hoverClass={disabled === true ? 'none' : 'opacity-60'}
    >
      {children}
    </View>
  ),
  Glyph: ({ name, size, color }) => <LineIcon name={name as IconName} size={size} color={color} />,
}

const DEFAULT_TOGGLE_BUTTONS: ToggleButtonItem[] = [
  { key: 'superAgent', label: t('index.feature.superAgent') },
  { key: 'mcp', label: t('index.feature.mcp') },
  { key: 'knowledgeBase', label: t('index.feature.knowledgeBase') },
  { key: 'permanentMemory', label: t('index.feature.permanentMemory') },
]

// 4 个图标按钮对齐原项目 BottomActionBar.vue line 65-80:
// 相机 / 相册 / 本地文件 / 微信文件。字形名逐条取自 RN 端 `ICON_GROUP_ITEMS`
// (Camera / Image / Folder / MessageCircle)—— 同一 key、同一含义、同一字形。
const DEFAULT_ICON_BUTTONS: IconButtonItem[] = [
  { key: 'camera', label: t('BottomActionBar.d1'), icon: 'camera' },
  { key: 'album', label: t('BottomActionBar.d2'), icon: 'image' },
  { key: 'file', label: t('BottomActionBar.d3'), icon: 'folder' },
  { key: 'wxfile', label: t('BottomActionBar.d4'), icon: 'message-circle' },
]

export default function BottomActionBar(props: BottomActionBarProps) {
  const tt = useTt()
  const {
    variant = 'default',
    modelName,
    showIconButtons = false,
    toggleButtons = DEFAULT_TOGGLE_BUTTONS,
    inputAreaProps,
    iconButtons = DEFAULT_ICON_BUTTONS,
    onIconButtonClick,
    onToggle,
    isVoiceInput = false,
    onVoiceInputToggle,
    compactContextLoading = false,
    onCompactContext,
    // 默认模式 props(解构)
    value = '',
    placeholder = tt('message.inputPlaceholder', '输入消息...'),
    disabled = false,
    showAttach = true,
    showSend = true,
    onInput,
    onSend,
    onAttach,
    isLoading = false,
  } = props

  if (variant === 'ai-home') {
    // ===== ai-home 模式:对齐原项目 BottomActionBar.vue(ToggleButtonGroup + InputArea + icon-button-group)=====
    return (
      <View className="bg-card">
        {/* ToggleButtonGroup:4 个功能切换按钮(对齐原项目 .toggle-button)
            行衬与行间距由 core 的 `bottomActionBarInlineRowBoxStyle` 供出(三行同一份) */}
        {toggleButtons.length > 0 ? (
          <BottomActionBarInlineRow platform={miniPlatform} className="flex">
            {toggleButtons.map((btn) => {
              const active = btn.active
              return (
                <View
                  key={btn.key}
                  className="flex items-center justify-center"
                  style={{
                    // 修复 (2026-08-12):box-sizing: border-box 让 border 算入 width,
                    // 避免 4rpx 边框导致 4 个按钮总宽 > 100% 出现左裁切
                    boxSizing: 'border-box',
                    width: 'calc(25% - 12rpx)',
                    border: '4rpx solid var(--color-card)',
                    borderRadius: rnRadius.md,
                    fontSize: toUnit(BOTTOM_ACTION_BAR_CHIP_FONT_PX),
                    padding: `${rpx(taroSpacing['xs-loose'])} 0`,
                    background: active ? 'var(--color-brand)' : 'var(--color-muted)',
                    color: active ? 'var(--color-primary-foreground)' : 'var(--color-foreground)',
                  }}
                  onClick={() => {
                    btn.onToggle?.()
                    onToggle?.(btn)
                  }}
                  hoverClass="opacity-60"
                >
                  <Text>{btn.label}</Text>
                </View>
              )
            })}
          </BottomActionBarInlineRow>
        ) : null}

        {/* InputArea:ai-home 模式(padding 20rpx + bg #E6F3FA 圆角 30rpx + send 100rpx 圆角 30rpx) */}
        <InputArea
          variant="ai-home"
          {...inputAreaProps}
          value={inputAreaProps?.value ?? ''}
          disabled={isLoading || inputAreaProps?.disabled}
        />

        {/* 手动压缩上下文入口(与 RN 端同名 props):加载中禁用并换文案,不弹新弹窗 */}
        {onCompactContext !== undefined ? (
          <BottomActionBarInlineRow platform={miniPlatform} className="flex justify-end">
            <View
              className="flex items-center justify-center"
              style={{
                boxSizing: 'border-box',
                border: '4rpx solid var(--color-card)',
                borderRadius: rnRadius.md,
                fontSize: toUnit(BOTTOM_ACTION_BAR_CHIP_FONT_PX),
                padding: `${rpx(taroSpacing['xs-loose'])} ${rpx(taroSpacing['sm-loose'])}`,
                background: 'var(--color-muted)',
                color: 'var(--color-foreground)',
                opacity: compactContextLoading ? 0.6 : 1,
              }}
              hoverClass={compactContextLoading ? 'none' : 'opacity-60'}
              onClick={() => {
                if (compactContextLoading) return
                onCompactContext()
              }}
            >
              <LineIcon
                name="scissors"
                size={toUnit(BOTTOM_ACTION_BAR_MODEL_BADGE_PX)}
                style={{ marginRight: rpx(8) }}
              />
              <Text>
                {compactContextLoading
                  ? tt('BottomActionBar.compacting', '压缩中...')
                  : tt('BottomActionBar.compact', '压缩上下文')}
              </Text>
            </View>
          </BottomActionBarInlineRow>
        ) : null}

        {/* icon-button-group:4 个图标按钮 + 语音输入按钮(对齐原项目 .icon-button-group)。
            卡盒 / 墨迹 / 标文字号 / 图文距与行衬一律由 core 的 icon-card 一支供出;
            这一组的「与 RN 的 AddPanel 面板同不同元素」问题仍挂在 spec 的【B 单端档】上,
            等 AddPanel 那一票裁 —— 收编改的是"谁持有数字",不是把单端档粉饰成两端同档 */}
        {showIconButtons ? (
          <BottomActionBarIconCardRow
            platform={miniPlatform}
            className="flex"
            cardClassName="flex flex-col items-center justify-center"
            cardStyle={{
              background: 'var(--color-muted)',
              borderRadius: rnRadius.lg,
              border: '6rpx solid var(--color-card)',
            }}
            activeCardStyle={{ background: 'var(--color-brand)' }}
            glyphColor="var(--color-muted-foreground)"
            activeGlyphColor="var(--color-primary-foreground)"
            labelColor="var(--color-foreground)"
            activeLabelColor="var(--color-primary-foreground)"
            items={[
              ...iconButtons.map((btn): BottomActionBarIconCardItem => ({
                key: btn.key,
                label: btn.label,
                glyph: btn.icon,
              })),
              // 语音输入按钮(对齐原项目 toggle-voice-input):同一卡盒、选中态换 brand 底色
              {
                key: 'voice',
                label: isVoiceInput
                  ? tt('BottomActionBar.p1', '语音输入中')
                  : tt('BottomActionBar.p2', '语音输入'),
                glyph: 'mic',
                active: isVoiceInput,
              },
            ]}
            onActivate={(item) => {
              if (item.key === 'voice') {
                onVoiceInputToggle?.()
                return
              }
              const hit = iconButtons.find((btn) => btn.key === item.key)
              if (hit) onIconButtonClick?.(hit)
            }}
          />
        ) : null}

        {/* button-group-box:已选模型提示(对齐原项目 .button-group-box)。
            文字字号取共享源(与 RN modelBar 同档);行内间距与行衬由 core 的行模型供出;
            本行自己的元素只有前导图章(BOTTOM_ACTION_BAR_MODEL_BADGE_PX)与它的右衬,
            RN 侧无对照(那端是 28 高的条 + 16 配置按钮),不经共享档 */}
        {modelName ? (
          <BottomActionBarInlineRow
            platform={miniPlatform}
            className="flex justify-between items-center"
            style={{ width: 'calc(100% - 100rpx)' }}
          >
            <View
              className="flex items-center"
              style={{
                color: 'var(--color-foreground)',
                fontSize: toUnit(BOTTOM_ACTION_BAR_MODEL_BAR_FONT_PX),
              }}
            >
              {/* 提示条前导图章(原 selected_model.png = 选中态标记)。
                  RN 的模型条在这一格**没有对应字形**:它那两枚 lucide 各自落在
                  「模型名按钮 + ChevronDown」与「配置钮 Settings」上,本行的"已默认自动切换"
                  提示在 RN 端整条不存在 ⇒ 无同名可引,按 §4 矢量优先取同一 lucide 家族的
                  选中态字形 Check,并把它登记为小程序单端档(BOTTOM_ACTION_BAR_MODEL_BADGE_PX)。
                  这一格是本票唯一没能"与 RN 同名"的槽位,已写进交付报告请主会话追认。 */}
              <LineIcon
                name="check"
                size={toUnit(BOTTOM_ACTION_BAR_MODEL_BADGE_PX)}
                style={{ marginRight: rpx(8) }}
              />
              <Text>{tt('BottomActionBar.text1', '已默认自动切换深度思考')}</Text>
            </View>
            <View
              style={{
                color: 'var(--color-link)',
                fontSize: toUnit(BOTTOM_ACTION_BAR_MODEL_BAR_FONT_PX),
              }}
            >
              <Text>{tt('tail.11', '已选模型: {m}', { m: modelName })}</Text>
            </View>
          </BottomActionBarInlineRow>
        ) : null}
      </View>
    )
  }

  // ===== 默认模式:兼容旧调用 =====
  return (
    <View className={cn('flex items-center px-3 py-2 bg-card mt-2')}>
      {/* 附件入口:载体是 lucide `plus`(与 RN 端同名同形)。此前是把 `+` 这个字符当图标(Text 字形),
          与 RN 端的 lucide `Plus` 同名不同载体 —— 这正是"两端图标不一样"的直接成因
          (AGENTS §4:UI 图标一律用矢量图标库)。方块与墨迹与 RN 端同读
          BOTTOM_ACTION_BAR_CONTROL_BOX_PX / _GLYPH_PX(web `Plus h-3.5` = 14)。 */}
      {showAttach && (
        <BottomActionBarControl
          platform={miniPlatform}
          boxPx={BOTTOM_ACTION_BAR_CONTROL_BOX_PX}
          glyphPx={BOTTOM_ACTION_BAR_CONTROL_GLYPH_PX}
          glyph="plus"
          className="flex items-center justify-center mr-2 rounded-sm bg-muted"
          onActivate={onAttach}
        />
      )}
      <FocusInput
        className="flex-1 px-3 py-2 leading-5 bg-muted rounded-sm"
        // 正文字号走跨端单一源(与 RN 端同读 BOTTOM_ACTION_BAR_TEXT_FONT_PX = 14);
        // 字号档 `text-sm` 编译出来是 `--text-sm: 28rpx`(rem2rpx),与本档同值,故换出处后零视觉差。
        // 行高仍留 Tailwind:`text-sm` 的 1.42857 × 28rpx = 40rpx,`leading-5`(= --spacing 8rpx × 5)同值。
        style={{ fontSize: toUnit(BOTTOM_ACTION_BAR_TEXT_FONT_PX) }}
        placeholder={placeholder}
        value={value}
        disabled={disabled || isLoading}
        onInput={(e) => onInput?.(e.detail.value)}
        onConfirm={() => onSend?.()}
      />
      {/* 发送键(2026-10-15 再裁决):与 web 发送簇 ArrowUp 同形(RN 同票),墨迹取
          BOTTOM_ACTION_BAR_SEND_GLYPH_PX(= web `h-4 w-4` = 16,落 glyphSm 箭头档)。
          历史形态:字符 `↑` → lucide `send` 纸飞机 → ArrowUp(三端同形)。
          方块 32 / 居中字形 / 按压与禁用通道由 core 的 control 一支供出,本端只给 className 与配色。 */}
      {showSend && (
        <BottomActionBarControl
          platform={miniPlatform}
          boxPx={BOTTOM_ACTION_BAR_CONTROL_BOX_PX}
          glyphPx={BOTTOM_ACTION_BAR_SEND_GLYPH_PX}
          glyph="arrow-up"
          glyphColor={
            value && !isLoading ? 'var(--color-cta-foreground)' : 'var(--color-muted-foreground)'
          }
          className={cn(
            'flex items-center justify-center ml-2 rounded-sm',
            value && !isLoading ? 'bg-cta text-cta-foreground' : 'bg-muted',
          )}
          disabled={isLoading}
          onActivate={() => {
            if (value && !isLoading) onSend?.()
          }}
        />
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
