// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { t } from '@/i18n'
import { View, Text, Input, type InputProps } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import { useUiField } from '@/lib/ui-field-registry'
// 聚焦态描边走本端唯一实现(墨档 var(--color-primary),只换色不换宽 ⇒ 零布局跳动)
import { useFieldFocus } from '@/hooks/use-field-focus'

type ConfirmType = NonNullable<InputProps['confirmType']>

export interface SearchBarProps {
  value?: string
  placeholder?: string
  onInput?: (value: string) => void
  onSearch?: () => void
  onClear?: () => void
  /** 键盘确认键类型,默认 'search' */
  confirmType?: ConfirmType
  /**
   * 外层容器附加类。圆角输入井本体(bg-muted rounded-sm border + 聚焦变色)始终保留;
   * 提供本属性时不再追加默认外边距 mx-3 my-2,用于嵌入 flex 行(如 flex-1 / mx-0)。
   */
  className?: string
}

/** 圆角输入井本体样式(不含外边距与边框色,边框色由聚焦态决定) */
// 角色档 control(=sm,4px):输入框与 web 的 searchInputWellClassName 同档,ui-control 是身份声明。
const searchBarWellClassName =
  'ui-control flex items-center gap-2 px-3 py-2 bg-muted rounded-sm border transition-colors'

export default function SearchBar({
  value = '',
  placeholder = t('course.list.search'),
  onInput,
  onSearch,
  onClear,
  confirmType = 'search',
  className,
}: SearchBarProps) {
  const ff = useFieldFocus()
  // AI 操控通道:只有父组件真的给了 onInput 才登记写通道 —— 没有 onInput 时"填进去"
  // 改变不了任何状态,登记了就是假成功。onConfirm(键盘搜索键)作为 onPress 一并交出。
  useUiField(
    onInput
      ? {
          kind: 'input',
          label: placeholder,
          placeholder,
          readValue: () => value,
          setValue: (next) => onInput(next),
          ...(onSearch ? { onPress: () => onSearch() } : {}),
        }
      : null,
  )
  return (
    <View
      className={`${searchBarWellClassName} border-border ${className ?? 'mx-3 my-2'}`}
      style={ff.focusStyle}
    >
      <LineIcon name="search" size={24} color="var(--color-muted-foreground)" />
      <Input
        className="flex-1 text-sm"
        {...ff.spread}
        placeholder={placeholder}
        value={value}
        confirmType={confirmType}
        onInput={(e) => onInput?.(e.detail.value)}
        onConfirm={() => onSearch?.()}
      />
      {value && (
        <Text className="text-sm text-muted-foreground" onClick={onClear}>
          ×
        </Text>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
