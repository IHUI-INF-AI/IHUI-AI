/**
 * 跨端同名组件共享 props 类型(re-export)
 *
 * 主源在 @ihui/types/ui-native-components,本文件提供 @ihui/ui-native 入口
 * 供 mobile-rn 等依赖 @ihui/ui-native 的端直接 import。
 *
 * miniapp-taro 不依赖 @ihui/ui-native(RN 专用),请从 @ihui/types import。
 *
 * 提取的组件(共 12 个,跳过单端 + 设计完全不同的):
 * - Carousel(CarouselItem)
 * - Menu(MenuItem)
 * - AgentRuntimePanel(Props + Status + PermissionEvent)
 * - ModelConfigDialog(ModelConfigType)
 * - TitleSwitchOverlap / ScrollPicker / ScrollTitle / TypeBar(Item + Props)
 */
export type {
  CarouselItem,
  MenuItem,
  AgentRuntimeStatus,
  AgentRuntimePermissionEvent,
  AgentRuntimePanelProps,
  ModelConfigType,
  TitleSwitchOverlapItem,
  TitleSwitchOverlapProps,
  TitleSwitchScrollPickerItem,
  TitleSwitchScrollPickerProps,
  TitleSwitchScrollTitleItem,
  TitleSwitchScrollTitleProps,
  TitleSwitchTypeBarItem,
  TitleSwitchTypeBarProps,
} from '@ihui/types'
