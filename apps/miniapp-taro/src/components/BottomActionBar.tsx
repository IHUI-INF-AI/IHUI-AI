import { View, Text, Input, Image } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'
import InputArea, { type InputAreaProps } from './InputArea'
// 4 个图标按钮 + 选中勾 PNG:对齐原项目 BottomActionBar.vue line 65-80,统一从 @/assets/remote/ 引入
// 原项目"微信文件"按钮也用 floder_input.png(非 wechat_file.png),保持一致
import cammerInputPng from '@/assets/remote/images/cammer_input.png'
import picterInputPng from '@/assets/remote/images/picter_input.png'
import floderInputPng from '@/assets/remote/images/floder_input.png'
import selectedModelPng from '@/assets/remote/images/selected_model.png'
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
  icon: string
  onClick?: () => void
}

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
}

const DEFAULT_TOGGLE_BUTTONS: ToggleButtonItem[] = [
  { key: 'superAgent', label: '深度思考' },
  { key: 'mcp', label: '联网' },
  { key: 'knowledgeBase', label: '知识库' },
  { key: 'permanentMemory', label: '永久记忆' },
]

// 4 个图标按钮对齐原项目 BottomActionBar.vue line 65-80:
// 相机 / 相册 / 本地文件 / 微信文件(原项目微信文件也用 floder_input.png)
const DEFAULT_ICON_BUTTONS: IconButtonItem[] = [
  { key: 'camera', label: '相机', icon: cammerInputPng },
  { key: 'album', label: '相册', icon: picterInputPng },
  { key: 'file', label: '本地文件', icon: floderInputPng },
  { key: 'wxfile', label: '微信文件', icon: floderInputPng },
]

export default function BottomActionBar(props: BottomActionBarProps) {
  const {
    variant = 'default',
    modelName,
    showIconButtons = false,
    toggleButtons = DEFAULT_TOGGLE_BUTTONS,
    inputAreaProps,
    iconButtons = DEFAULT_ICON_BUTTONS,
    onIconButtonClick,
    onToggle,
    // 默认模式 props(解构)
    value = '',
    placeholder = '输入消息...',
    disabled = false,
    showAttach = true,
    showSend = true,
    onInput,
    onSend,
    onAttach,
  } = props

  if (variant === 'ai-home') {
    // ===== ai-home 模式:对齐原项目 BottomActionBar.vue(ToggleButtonGroup + InputArea + icon-button-group)=====
    return (
      <View className="bg-card">
        {/* ToggleButtonGroup:4 个功能切换按钮(对齐原项目 .toggle-button)*/}
        {toggleButtons.length > 0 ? (
          <View
            className="flex"
            style={{
              padding: '0 20rpx 10rpx',
              gap: rpx(16),
            }}
          >
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
                    borderRadius: rpx(15),
                    fontSize: rpx(28),
                    padding: '12rpx 0',
                    background: active
                      ? 'var(--color-brand-cyan, #93d2f3)'
                      : 'rgba(205, 208, 255, 0.3)',
                    color: 'var(--color-foreground)',
                  }}
                  onClick={() => {
                    btn.onToggle?.()
                    onToggle?.(btn)
                  }}
                >
                  <Text>{btn.label}</Text>
                </View>
              )
            })}
          </View>
        ) : null}

        {/* InputArea:ai-home 模式(padding 20rpx + bg #E6F3FA 圆角 30rpx + send 100rpx 圆角 30rpx)*/}
        <InputArea variant="ai-home" {...inputAreaProps} value={inputAreaProps?.value ?? ''} />

        {/* icon-button-group:4 个图标按钮(对齐原项目 .icon-button-group)*/}
        {showIconButtons ? (
          <View
            className="flex"
            style={{
              justifyContent: 'flex-start',
              gap: rpx(16),
              padding: '0 20rpx 10rpx',
            }}
          >
            {iconButtons.map((btn) => (
              <View
                key={btn.key}
                className="flex flex-col items-center justify-center"
                style={{
                  width: rpx(160),
                  height: rpx(150),
                  background:
                    'linear-gradient(135deg, rgba(205, 208, 255, 0.3), rgba(253, 255, 225, 0.3))',
                  borderRadius: rpx(30),
                  border: '6rpx solid var(--color-card)',
                }}
                onClick={() => onIconButtonClick?.(btn)}
              >
                <Image
                  src={btn.icon}
                  style={{ width: rpx(70), height: rpx(70), marginBottom: rpx(12) }}
                  mode="aspectFit"
                />
                <Text
                  style={{
                    fontSize: rpx(20),
                    color: 'var(--color-text-icon-label, rgba(0,0,0,0.9))',
                  }}
                >
                  {btn.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* button-group-box:已选模型提示(对齐原项目 .button-group-box)*/}
        {modelName ? (
          <View
            className="flex justify-between items-center"
            style={{
              width: 'calc(100% - 100rpx)',
              gap: rpx(16),
              padding: '0 20rpx 10rpx',
            }}
          >
            <View
              className="flex items-center"
              style={{ color: 'var(--color-foreground)', fontSize: rpx(20) }}
            >
              <Image
                src={selectedModelPng}
                style={{ width: rpx(24), height: rpx(24), marginRight: rpx(8) }}
                mode="aspectFit"
              />
              <Text>已默认自动切换深度思考</Text>
            </View>
            <View style={{ color: 'var(--color-accent-blue, #5a85ff)', fontSize: rpx(20) }}>
              <Text>已选模型: {modelName}</Text>
            </View>
          </View>
        ) : null}
      </View>
    )
  }

  // ===== 默认模式:兼容旧调用 =====
  return (
    <View className={cn('flex items-center px-3 py-2 bg-card mt-2')}>
      {showAttach && (
        <View
          className="flex items-center justify-center w-8 h-8 mr-2 rounded-lg bg-muted"
          onClick={onAttach}
        >
          <Text className="text-lg text-muted-foreground">+</Text>
        </View>
      )}
      <Input
        className="flex-1 px-3 py-2 text-sm bg-muted rounded-md"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onInput={(e) => onInput?.(e.detail.value)}
        onConfirm={() => onSend?.()}
      />
      {showSend && (
        <View
          className={cn(
            'flex items-center justify-center w-8 h-8 ml-2 rounded-lg',
            value ? 'bg-primary' : 'bg-muted',
          )}
          onClick={() => value && onSend?.()}
        >
          <Text className="text-sm text-white">↑</Text>
        </View>
      )}
    </View>
  )
}
