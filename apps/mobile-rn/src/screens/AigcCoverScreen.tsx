// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AIGC 全屏沉浸媒体浏览器(对齐历史 Uniapp pages/tools/aigc/cover.vue)
 *
 * 历史交互对齐:
 * - vertical swiper 上下滑动切换 → FlatList vertical + pagingEnabled
 * - fileType 0=image(全屏宽) / 1=video(高度 100%-240rpx,marginTop 150rpx,圆角 15rpx)
 * - footer 浮层: title / subtitle / "提示词：context"
 *   - 图片类型背景 rgba(240,240,240,0.4) / 视频类型背景 #000
 * - 进入自动 play 当前视频,切换时 pause 旧视频 / play 新视频(active 驱动)
 * - close 按钮: top 100rpx / right 40rpx / 80rpx / 圆角 15rpx,浅灰玻璃质感 → goBack
 * - 全屏黑背景 #000 + padding 20rpx
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import Video from 'react-native-video'
import { X } from 'lucide-react-native'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { rpx } from '../utils/rpx'

/** 覆盖层媒体项(由列表页以快照形式通过路由参数传入) */
export interface AigcCoverWorkItem {
  id: string
  title: string
  subtitle?: string
  prompt?: string
  fileUrl?: string
  /** 0=image 1=video 3=audio 4=text(历史 swiper 对 3/4 只渲染 footer) */
  fileType: number
}

export interface AigcCoverParams {
  id: string
  title?: string
  /** 当前作品列表快照(含 image/video/audio/text) */
  works?: AigcCoverWorkItem[]
  /** 初始定位索引(对齐历史 current) */
  index?: number
}

type CoverRoute = RouteProp<{ AigcCover: AigcCoverParams }, 'AigcCover'>

interface CoverItemProps {
  item: AigcCoverWorkItem
  itemHeight: number
  /** 是否为当前可见页(决定视频 play/pause,对齐历史 oVideo.pause()/nVideo.play()) */
  active: boolean
}

function CoverItem({ item, itemHeight, active }: CoverItemProps) {
  const isVideo = item.fileType === 1
  const isImage = item.fileType === 0
  const isVideoBg = isVideo // 历史仅 fileType==1 用 footer-video 黑底

  return (
    <View style={[styles.slide, { height: itemHeight }]}>
      {isImage && item.fileUrl ? (
        <Image
          source={{ uri: item.fileUrl }}
          style={styles.image}
          resizeMode="contain"
        />
      ) : null}
      {isVideo && item.fileUrl ? (
        <Video
          source={{ uri: item.fileUrl }}
          paused={!active}
          resizeMode="contain"
          controls
          style={[styles.video, { height: itemHeight - rpx(240) }]}
        />
      ) : null}
      {/* footer 浮层: title / subtitle / 提示词 */}
      <View
        style={[styles.footer, isVideoBg ? styles.footerVideo : styles.footerImage]}
      >
        <Text style={[styles.footerTitle, isVideoBg && styles.footerTitleVideo]}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text style={[styles.footerContent, isVideoBg && styles.footerContentVideo]}>
            {item.subtitle}
          </Text>
        ) : null}
        {item.prompt ? (
          <Text style={[styles.footerContent, isVideoBg && styles.footerContentVideo]}>
            提示词：{item.prompt}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

export default function AigcCoverScreen() {
  const navigation = useNavigation<{ goBack: () => void }>()
  const route = useRoute<CoverRoute>()
  const { height: windowHeight } = useWindowDimensions()
  const works = route.params?.works ?? []
  const initialIndex = route.params?.index ?? 0

  const [current, setCurrent] = useState(initialIndex)
  const listRef = useRef<FlatList<AigcCoverWorkItem>>(null)
  const didInitialScroll = useRef(false)
  // itemHeight: 全屏高度(减去容器 padding 20rpx × 2),对齐历史 cont_body 100%
  const itemHeight = windowHeight - rpx(40)

  // 初始定位到点击的作品(对齐历史 :current="current")
  useEffect(() => {
    if (didInitialScroll.current || works.length === 0) return
    if (initialIndex > 0 && initialIndex < works.length) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({
          offset: initialIndex * itemHeight,
          animated: false,
        })
      })
    }
    didInitialScroll.current = true
  }, [works.length, initialIndex, itemHeight])

  // onViewableItemsChanged: 切换页时更新 current(active 变化驱动 视频 pause/play)
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const idx = viewableItems[0]?.index ?? -1
      if (idx >= 0) setCurrent(idx)
    },
    [],
  )

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.y / itemHeight)
      if (idx >= 0 && idx < works.length) setCurrent(idx)
    },
    [itemHeight, works.length],
  )

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current

  if (works.length === 0) {
    // 兜底: 无快照时直接返回(对齐历史 showFullScreen 仅在有数据时打开)
    return <View style={styles.container} />
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={works}
        keyExtractor={(it) => it.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: itemHeight,
          offset: itemHeight * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item, index }) => (
          <CoverItem item={item} itemHeight={itemHeight} active={index === current} />
        )}
      />
      {/* close 浮层按钮(对齐历史 close_chat.png + goBack) */}
      <Pressable
        style={styles.close}
        onPress={() => navigation.goBack()}
        accessibilityLabel="关闭"
        hitSlop={8}
      >
        <X size={rpx(48)} color={tokens.text.primary} strokeWidth={2.2} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.brand.DEFAULT,
    padding: rpx(20),
  },
  slide: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    flex: 1,
  },
  video: {
    width: '100%',
    marginTop: rpx(150),
    borderRadius: rpx(15),
    backgroundColor: tokens.brand.DEFAULT,
  },
  footer: {
    position: 'absolute',
    left: rpx(22),
    right: rpx(22),
    bottom: rpx(28),
    minHeight: rpx(88),
    paddingVertical: rpx(10),
    paddingHorizontal: rpx(40),
    borderRadius: rpx(20),
  },
  footerImage: {
    backgroundColor: 'rgba(240, 240, 240, 0.4)',
  },
  footerVideo: {
    backgroundColor: tokens.brand.DEFAULT,
  },
  footerTitle: {
    fontSize: rpx(28),
    color: tokens.brand.DEFAULT,
    fontWeight: 'bold',
  },
  footerTitleVideo: {
    color: tokens.surface.light,
  },
  footerContent: {
    marginTop: rpx(10),
    fontSize: rpx(22),
    color: tokens.text.secondary,
  },
  footerContentVideo: {
    color: tokens.surface.muted,
  },
  close: {
    position: 'absolute',
    top: rpx(100),
    right: rpx(40),
    width: rpx(80),
    height: rpx(80),
    borderRadius: rpx(15),
    backgroundColor: 'rgba(245, 245, 245, 0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
