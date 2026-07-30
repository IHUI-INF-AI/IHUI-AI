import { View } from '@tarojs/components'

/**
 * 72 点彩色旋转加载器(纯装饰)。
 * 对齐原项目 components/colorful_loader.vue:72 个彩色圆点环绕旋转。
 *
 * 简化实现:外层容器用 Tailwind `animate-spin` 旋转,72 点用数组渲染,
 * 每点按 (360/72)*i 度旋转定位、HSL 循环着色。
 */
export interface ColorfulLoaderProps {
  size?: number
  visible?: boolean
  className?: string
}

const DOT_COUNT = 72

export default function ColorfulLoader({
  size = 80,
  visible = true,
  className = '',
}: ColorfulLoaderProps) {
  if (!visible) return null

  const radius = size / 2
  const dotSize = Math.max(4, size / 10)
  const dots = Array.from({ length: DOT_COUNT })

  return (
    <View
      className={`relative animate-spin ${className}`}
      style={{ width: `${size}rpx`, height: `${size}rpx` }}
    >
      {dots.map((_, i) => {
        const angle = (360 / DOT_COUNT) * i
        // TODO: custom color: colorful loader 72 points HSL
        const color = `hsl(${i * 5}, 70%, 60%)`
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
