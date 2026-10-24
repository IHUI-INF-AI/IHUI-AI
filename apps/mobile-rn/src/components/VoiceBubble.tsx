// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * VoiceBubble 语音消息气泡(mobile-rn)— 聊天消息内的录音回听单元。
 *
 * 2026-10-16 录音消息上线:长按录音 → uploadFileMultipart 上传 → 消息 content 落
 * `[语音] <url> <秒>` 标记,message-parse 切出 audio 段,由本组件渲染。
 * 播放走 expo-audio useAudioPlayer(与 ProfileScreen 音频项、ChatScreen TTS 同族)。
 *
 * 样式(用户定档 2026-10-16):简约黑白 —— 用户消息(黑底气泡)用白条白钮,
 * AI 消息(白底气泡)用黑条黑钮;已播放进度按比例点亮,无渐变无彩色。
 * AGENTS §4:半径取 design-tokens 单一源头,禁本地 px 圆角常量。
 */
import { useCallback } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Pause, Play } from 'lucide-react-native'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { rnRadiusFor } from '@ihui/design-tokens'
import { formatShortDuration } from '@ihui/shared/utils'
import { tokens } from '../theme/active-tokens'
import { useI18n } from '../i18n'

/** 波形指示条数(静态装饰条,点亮数 = 播放进度) */
const VOICE_BUBBLE_BAR_COUNT = 16
/** 指示条宽度(细于 16px 的指示条,守门 11 只开队列不判) */
const VOICE_BUBBLE_BAR_W = 3

export interface VoiceBubbleProps {
  /** 音频 URL(上传后的公开地址) */
  url: string
  /** 录音时长(秒;标记里带的实测值,播放器元数据未就绪时兜底) */
  durationSec: number
  /** 用户消息(黑底气泡)→ 白条白钮;AI 消息(白底气泡)→ 黑条黑钮 */
  isUser?: boolean
}

export function VoiceBubble({
  url,
  durationSec,
  isUser = false,
}: VoiceBubbleProps): React.JSX.Element {
  const { t } = useI18n()
  const player = useAudioPlayer(url)
  const status = useAudioPlayerStatus(player)

  const onToggle = useCallback(() => {
    if (status.playing) {
      player.pause()
    } else {
      void player.play()
    }
  }, [player, status.playing])

  // 总时长优先取录音实测值;播放器元数据就绪后可纠正(标记缺秒数的旧消息)
  const total = durationSec > 0 ? durationSec : Math.round(status.duration)
  const played = status.currentTime > 0 ? Math.min(status.currentTime, total) : 0
  const litCount = total > 0 ? Math.round((played / total) * VOICE_BUBBLE_BAR_COUNT) : 0

  // 黑白双态:用户消息在黑底上(cta 底),AI 消息在白卡上
  const fg = isUser ? tokens.brand.ctaForeground : tokens.brand.cta
  const btnBg = isUser ? tokens.brand.ctaForeground : tokens.brand.cta
  const btnFg = isUser ? tokens.brand.cta : tokens.brand.ctaForeground

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.playBtn, { backgroundColor: btnBg }]}
        onPress={onToggle}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? t('chat.voicePause') : t('chat.voicePlay')}
      >
        {status.playing ? (
          <Pause size={13} color={btnFg} fill={btnFg} />
        ) : (
          <Play size={13} color={btnFg} fill={btnFg} />
        )}
      </Pressable>
      <View style={styles.bars}>
        {Array.from({ length: VOICE_BUBBLE_BAR_COUNT }, (_, i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { height: 4 + ((i * 7) % 5) * 3 },
              { backgroundColor: fg },
              i < litCount ? null : styles.barUnlit,
            ]}
          />
        ))}
      </View>
      <Text style={[styles.duration, { color: fg }]}>{formatShortDuration(total)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 148,
  },
  playBtn: {
    width: 28,
    height: 28,
    borderRadius: rnRadiusFor.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 16,
  },
  bar: {
    width: VOICE_BUBBLE_BAR_W,
    borderRadius: rnRadiusFor.tiny,
  },
  // 未播放部分:同色降透明度(不引第二色,保持黑白纯净)
  barUnlit: {
    opacity: 0.28,
  },
  duration: {
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
})

export default VoiceBubble
