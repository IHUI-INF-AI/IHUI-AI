// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Carousel 轮播组件 (mobile-rn 端)
 * 基于 ScrollView horizontal + pagingEnabled 实现横向轮播
 * 保留自动播放 + 指示器功能
 * 迁移自旧项目 Vue 组件 (Ai-WXMiniVue/src/components/Carousel/index.vue)
 *
 * 共享类型 CarouselItem + 共享 hook useAutoPlay 已下沉到 packages,
 * 消除 mobile-rn / miniapp-taro 两端类型与自动播放逻辑重复。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import { tokens } from '../theme/active-tokens'
import { useAutoPlay } from '@ihui/shared'
import {
  carouselDefaultHeightPx,
  carouselIndicatorWrapStyle,
  carouselDotStyle,
} from '@ihui/shared/ui/carousel-spec'
import type { CarouselItem } from '@ihui/ui-native'

export interface CarouselProps {
  banner: CarouselItem[]
  height?: number
  autoplayInterval?: number
  onItemPress?: (item: CarouselItem, index: number) => void
}

/// 指示点几何/默认高度不在本文件取数 —— 唯一源是 @ihui/shared/ui/carousel-spec(与小程序端同档);
/// RN 单位是 dp,与逻辑 px 1:1,故换算取恒等(同 packages/app 那份共享层写法)。
const toUnit = (px: number) => px

const DEFAULT_HEIGHT = carouselDefaultHeightPx()

/** 失败图源集合的初始值:模块级常量,避免每次 render 造一个新 Set 打穿 useMemo 依赖。 */
const NO_FAILED_SOURCES: ReadonlySet<string> = new Set<string>()

export default function Carousel({
  banner,
  height = DEFAULT_HEIGHT,
  autoplayInterval = 3000,
  onItemPress,
}: CarouselProps) {
  /**
   * 图源加载失败的项**整项不渲染**(内容级降级),而不是在营销位摆一枚故障图形。
   *
   * 成因(真机拍到的「智能体」tab 首屏,像素归因见交付报告):轮播的图来自后端字段
   * (`agents.avatar` / `carousels.imageUrl` / `lessons.coverImage`),这些行里存的是
   * picsum.photos 这类境外随机图服务,国内移动网络可达性不稳 → 取不到图。
   * RN `<Image>` 失败时自身不产出任何占位,所以这一格此前的表现是"营销位空着";
   * 而把它摘掉才是这里要的处置:轮播是营销位,少一张卡远好过露一个错误态。
   * 键取 uri 而非下标 —— 数据换一批后同一 uri 仍应继续被摘除,下标则会错位。
   */
  const [failedSources, setFailedSources] = useState<ReadonlySet<string>>(NO_FAILED_SOURCES)
  const markSourceFailed = useCallback((uri: string) => {
    setFailedSources((prev) => (prev.has(uri) ? prev : new Set<string>(prev).add(uri)))
  }, [])

  const slides = useMemo(
    () => (banner ?? []).filter((item) => !failedSources.has(item.img)),
    [banner, failedSources],
  )

  const { current, setCurrent } = useAutoPlay(slides.length, autoplayInterval, slides.length > 1)
  const scrollRef = useRef<ScrollView>(null)
  const { width } = useWindowDimensions()

  // 有项因失败被摘掉后,current 可能暂时越界(自动播放的下一跳会自己取模收敛),
  // 这里只把这一帧的落点夹回首项,不做任何位移补偿。
  const activeIndex = current < slides.length ? current : 0

  // current 变化时滚动到对应位置(useAutoPlay 内部已驱动 current 自动变化)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ x: activeIndex * width, animated: true })
    }
  }, [activeIndex, width])

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / width)
      if (idx !== current && idx >= 0 && idx < slides.length) {
        setCurrent(idx)
      }
    },
    [current, width, slides.length, setCurrent],
  )

  if (slides.length === 0) {
    // 守门 128:此占位文案(text-xs=12)在小程序侧**没有对照元素** —— 小程序空列表 return null。
    // 它当前与小程序叠加层的 p-3/text-xs 数值巧合相消,不是两端同值;别把这一行读成已收口档
    // (映射与裁决依据见 @ihui/shared/ui/carousel-spec 头注,O81)。
    return (
      // 空态盒与下方主容器共用同一档(hero),否则两端比出来的圆角集合会凭空多出一档。
      // 它是主容器在"无数据"那一帧的同一屏槽位形态,不是另一种元素。
      <View
        className="w-full items-center justify-center rounded-2xl"
        style={{ height, backgroundColor: tokens.surface.muted }}
      >
        <Text className="text-xs" style={{ color: tokens.text.tertiary }}>
          暂无轮播图
        </Text>
      </View>
    )
  }

  return (
    // 圆角改在**组件根容器**这一层声明,与小程序端同名组件同层同档(hero → 2xl)。
    // 此前 RN 端的圆角落在各屏的外层 wrapper 上,于是:同名组件在两端声明在不同层 →
    // 跨端对账门读到的两个集合恒等而屏幕上并不等;而没包 wrapper 的那一屏干脆是方角。
    // 端内各屏的 wrapper 不再需要补圆角(边距仍归各屏)。
    <View className="w-full overflow-hidden rounded-2xl" style={{ height }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onScrollEnd}
        style={StyleSheet.absoluteFill}
      >
        {slides.map((item, index) => (
          <TouchableOpacity
            key={index}
            activeOpacity={0.9}
            onPress={() => onItemPress?.(item, index)}
            style={{ width, height }}
          >
            <Image
              source={{ uri: item.img }}
              onError={() => markSourceFailed(item.img)}
              style={{ width, height, resizeMode: 'cover' }}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 指示器:容器结构与点的宽高一律取 carousel-spec(与小程序端同一份档),
          本文件只留配色与圆角两个端内落点(圆角归守门 77、配色归 tokens 派生链)。 */}
      <View style={carouselIndicatorWrapStyle(toUnit)}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={carouselDotStyle(toUnit, index === activeIndex)}
            className={index === activeIndex ? 'bg-white rounded-md' : 'bg-white/50 rounded-sm'}
          />
        ))}
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
