// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * react-native-video 的 web 平台 stub(由 metro.config.cjs resolveRequest 注入,
 * 仅 platform === 'web' 时把 'react-native-video' 重定向到本文件)。
 *
 * 平台特有:react-native-video v6 无 web 实现(requireNativeComponent 在
 * react-native-web 下不存在,import 即抛错),web 平台用占位视图替代。
 *
 * 类型兼容:VideoPlayer.tsx 仅使用默认导出 + type VideoRef/OnLoadData/OnProgressData
 * (类型在编译期擦除,运行时只需默认导出组件)。
 */

import { forwardRef, useImperativeHandle, useRef } from 'react'
import { View, Text, StyleSheet, type ViewStyle, type StyleProp } from 'react-native'
import { rnTokens as tk } from '@ihui/design-tokens'

/** 与 react-native-video 的 VideoRef 方法面保持兼容的子集,web 上全部 no-op */
export interface VideoRef {
  presentFullscreenPlayer: () => void
  dismissFullscreenPlayer: () => void
  seek: (time: number) => void
  pause: () => void
  resume: () => void
}

export type OnLoadData = unknown
export type OnProgressData = unknown

export interface VideoStubProps {
  source?: { uri?: string }
  style?: StyleProp<ViewStyle>
}

const VideoStub = forwardRef<VideoRef, VideoStubProps>(function VideoStub(props, ref) {
  const viewRef = useRef<View | null>(null)

  useImperativeHandle(ref, () => ({
    presentFullscreenPlayer: () => {},
    dismissFullscreenPlayer: () => {},
    seek: () => {},
    pause: () => {},
    resume: () => {},
  }))

  const uri = props.source?.uri ?? ''
  return (
    <View ref={viewRef} style={[styles.container, props.style]}>
      <Text style={styles.text}>视频播放暂不支持浏览器预览</Text>
      {uri ? <Text style={styles.uri}>{uri}</Text> : null}
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    backgroundColor: tk.gray[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: tk.gray[400],
    fontSize: 13,
  },
  uri: {
    color: tk.gray[500],
    fontSize: 10,
    marginTop: 4,
  },
})

export default VideoStub
