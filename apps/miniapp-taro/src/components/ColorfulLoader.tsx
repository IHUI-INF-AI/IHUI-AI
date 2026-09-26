// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View } from '@tarojs/components'
import { TARO_RPX_PER_PX } from '@ihui/design-tokens'
import {
  COLORFUL_LOADER_DEFAULT_SIZE_PX,
  COLORFUL_LOADER_DOT_COUNT,
  COLORFUL_LOADER_SPIN_MS,
  colorfuleLoaderDotSizePx,
  colorfuleLoaderDotColor,
  colorfuleLoaderRadiusPx,
} from '@ihui/shared/ui/colorful-loader-spec'

/**
 * 72 点彩色旋转加载器(纯装饰)。
 * 对齐原项目 components/colorful_loader.vue:72 个彩色圆点环绕旋转。
 *
 * 简化实现:外层容器用 Tailwind `animate-spin` 旋转,72 点用数组渲染,
 * 每点按 (360/72)*i 度旋转定位、HSL 循环着色。
 * 数字档在 @ihui/shared/ui/colorful-loader-spec;`size` prop 按端内惯例是 rpx 数值,
 * 内部先折回逻辑 px 再走共享公式(平台通道保留,数值共享)。
 * 旋转周期用行内 animation-duration 对齐 RN 端 Animated 的同一档(通道各留,数值同)。
 */
export interface ColorfulLoaderProps {
  size?: number
  visible?: boolean
  className?: string
}

const DEFAULT_SIZE_RPX = COLORFUL_LOADER_DEFAULT_SIZE_PX * TARO_RPX_PER_PX

export default function ColorfulLoader({
  size = DEFAULT_SIZE_RPX,
  visible = true,
  className = '',
}: ColorfulLoaderProps) {
  if (!visible) return null

  const sizePx = size / TARO_RPX_PER_PX
  const radius = colorfuleLoaderRadiusPx(sizePx) * TARO_RPX_PER_PX
  const dotSize = colorfuleLoaderDotSizePx(sizePx) * TARO_RPX_PER_PX
  const dots = Array.from({ length: COLORFUL_LOADER_DOT_COUNT })

  return (
    <View
      className={`relative animate-spin ${className}`}
      style={{
        width: `${size}rpx`,
        height: `${size}rpx`,
        animationDuration: `${COLORFUL_LOADER_SPIN_MS}ms`,
      }}
    >
      {dots.map((_, i) => {
        const angle = (360 / COLORFUL_LOADER_DOT_COUNT) * i
        // 保留:colorful loader 72 点 HSL 动态着色(按索引循环色相);动态计算色无法 token 化,共享源给公式
        // 豁免 0b: 装饰圆点(72 点 HSL 循环色相,典型 rounded-full 装饰元素)
        const color = colorfuleLoaderDotColor(i)
        return (
          <View
            key={i}
            className="absolute rounded-full"
            style={{
              width: `${dotSize}rpx`,
              height: `${dotSize}rpx`,
              top: '50%',
              left: '50%',
              marginLeft: `-${dotSize / 2}rpx`,
              marginTop: `-${dotSize / 2}rpx`,
              backgroundColor: color,
              transform: `rotate(${angle}deg) translateY(-${radius}rpx)`,
            }}
          />
        )
      })}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
