/**
 * 响应式预览设备预设(2026-07-24 立,Design 模式 P2-b 缺口)。
 *
 * 6 个预设:mobile-portrait/mobile-landscape/tablet-portrait/tablet-landscape/desktop/custom。
 * 遵循 AGENTS.md §4:圆角按尺寸梯度(8/16/24px),非 9999px 纯圆形。
 */
export type ResponsiveDeviceIcon = 'phone' | 'tablet' | 'desktop' | 'custom'
export type ResponsiveDeviceCategory = 'mobile' | 'tablet' | 'desktop' | 'custom'

export interface ResponsiveDevice {
  id: string
  nameKey: string
  width: number
  height: number
  icon: ResponsiveDeviceIcon
  category: ResponsiveDeviceCategory
}

export const RESPONSIVE_DEVICES: ResponsiveDevice[] = [
  { id: 'mobile-portrait', nameKey: 'design.responsive.deviceMobilePortrait', width: 375, height: 667, icon: 'phone', category: 'mobile' },
  { id: 'mobile-landscape', nameKey: 'design.responsive.deviceMobileLandscape', width: 667, height: 375, icon: 'phone', category: 'mobile' },
  { id: 'tablet-portrait', nameKey: 'design.responsive.deviceTabletPortrait', width: 768, height: 1024, icon: 'tablet', category: 'tablet' },
  { id: 'tablet-landscape', nameKey: 'design.responsive.deviceTabletLandscape', width: 1024, height: 768, icon: 'tablet', category: 'tablet' },
  { id: 'desktop', nameKey: 'design.responsive.deviceDesktop', width: 1440, height: 900, icon: 'desktop', category: 'desktop' },
  { id: 'custom', nameKey: 'design.responsive.deviceCustom', width: 0, height: 0, icon: 'custom', category: 'custom' },
]

export const DEFAULT_DEVICE_ID = 'desktop'
export const DEFAULT_CUSTOM_WIDTH = 1024

/** 按设备类别返回外框圆角(mobile 24px / tablet 16px / desktop 8px / custom 8px)。 */
export function getDeviceRadius(category: ResponsiveDeviceCategory): number {
  switch (category) {
    case 'mobile': return 24
    case 'tablet': return 16
    case 'desktop': return 8
    case 'custom': return 8
  }
}
