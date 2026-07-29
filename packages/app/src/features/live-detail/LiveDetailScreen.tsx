import { useEffect, useMemo, useRef } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { getTokens, type AppThemeTokens } from '../../theme/tokens'
import type {
  LiveDetailChatStatus,
  LiveDetailChatMessage,
  LiveDetailItem,
  LiveDetailScreenProps,
} from '../../types'

/** 直播详情共享屏 — props 注入式跨端组件(纯 UI,不依赖平台 API) */
export type { LiveDetailItem, LiveDetailChatMessage, LiveDetailChatStatus, LiveDetailScreenProps }

/** 状态标签 i18n key 映射:connecting=连接中 / open=已连接 / reconnecting=重连中 / error=错误 / closed/idle=已断开 */
function chatStatusLabelKey(status: LiveDetailChatStatus): string {
  switch (status) {
    case 'connecting':
      return 'liveDetail.chatConnecting'
    case 'open':
      return 'liveDetail.chatConnected'
    case 'reconnecting':
      return 'liveDetail.chatReconnecting'
    case 'error':
      return 'liveDetail.chatError'
    default:
      return 'liveDetail.chatDisconnected'
  }
}

/** 状态点颜色:open=绿 / connecting/reconnecting=黄 / error=红 / 其余=灰 */
function chatStatusDotColor(status: LiveDetailChatStatus, tk: AppThemeTokens): string {
  switch (status) {
    case 'open':
      return tk.success.DEFAULT
    case 'connecting':
    case 'reconnecting':
      return tk.warning.amber
    case 'error':
      return tk.danger.DEFAULT
    default:
      return tk.border.medium
  }
}

export function LiveDetailScreen({
  t,
  live,
  loading,
  error,
  subscribed,
  subscribing,
  messages,
  input,
  chatStatus,
  chatError,
  onInputChange,
  onSend,
  onSubscribe,
  onBack,
  colorScheme = 'light',
}: LiveDetailScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createStyles(tk), [tk])
  const listRef = useRef<FlatList<LiveDetailChatMessage> | null>(null)

  // 新消息到达后自动滚到底部(避免键盘弹起抢焦点)
  useEffect(() => {
    if (messages.length === 0) return
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80)
  }, [messages.length])

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  }
  if (error || !live) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || t('liveDetail.empty')}</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={onBack}>
          <Text style={styles.btnPrimaryText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const dotColor = chatStatusDotColor(chatStatus, tk)
  const chatEnabled = chatStatus === 'open'

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={2}>
          {live.title}
        </Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, live.isLive ? styles.badgeLive : styles.badgeUpcoming]}>
            <Text style={styles.badgeText}>
              {live.isLive ? t('liveDetail.ongoing') : t('liveDetail.upcoming')}
            </Text>
          </View>
          {live.lecturerName ? (
            <View style={styles.badgeMuted}>
              <Text style={styles.badgeMutedText}>
                {t('liveDetail.lecturer')}:{live.lecturerName}
              </Text>
            </View>
          ) : null}
          <View style={styles.badgeMuted}>
            <Text style={styles.badgeMutedText}>
              {t('liveDetail.viewerCount', { count: live.viewCount })}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.videoArea}>
        <Text style={styles.videoIcon}>▶</Text>
        <Text style={styles.videoHint}>{t('liveDetail.title')}</Text>
        {live.playUrl ? (
          <Text style={styles.videoUrl} numberOfLines={1}>
            {live.playUrl}
          </Text>
        ) : null}
      </View>

      <View style={styles.subscribeSection}>
        {subscribed ? (
          <View style={styles.subscribedBox}>
            <Text style={styles.subscribedText}>✓ {t('liveDetail.subscribed')}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.btnPrimary, subscribing && styles.btnDisabled]}
            onPress={onSubscribe}
            disabled={subscribing}
          >
            <Text style={styles.btnPrimaryText}>
              {subscribing ? t('liveDetail.subscribing') : t('liveDetail.subscribe')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.introSection}>
        <Text style={styles.sectionTitle}>{t('liveDetail.intro')}</Text>
        <Text style={styles.introText}>{live.intro ?? '—'}</Text>
      </View>

      <View style={styles.chatSection}>
        <View style={styles.chatStatusRow}>
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
          <Text style={styles.chatStatusText}>{t(chatStatusLabelKey(chatStatus))}</Text>
        </View>
        <Text style={styles.sectionTitle}>{t('liveDetail.chat')}</Text>
        <View style={styles.chatListWrap}>
          <FlatList<LiveDetailChatMessage>
            ref={(r) => {
              listRef.current = r
            }}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.chatListBody}
            ListEmptyComponent={
              <View style={styles.chatEmpty}>
                <Text style={styles.muted}>{t('liveDetail.chatEmpty')}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.chatItem}>
                <View style={styles.chatItemHeader}>
                  <Text style={styles.chatNickname} numberOfLines={1}>
                    {item.nickname}
                  </Text>
                  <Text style={styles.chatTime}>{item.createdAt}</Text>
                </View>
                <Text style={styles.chatContent}>{item.content}</Text>
              </View>
            )}
          />
        </View>
        {chatError ? <Text style={styles.chatErrorText}>{chatError}</Text> : null}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={onInputChange}
          placeholder={t('liveDetail.chatPlaceholder')}
          placeholderTextColor={tk.text.tertiary}
          editable={chatEnabled}
          returnKeyType="send"
          onSubmitEditing={onSend}
        />
        <TouchableOpacity
          style={[styles.btnPrimary, styles.sendBtn, (!input.trim() || !chatEnabled) && styles.btnDisabled]}
          onPress={onSend}
          disabled={!input.trim() || !chatEnabled}
        >
          <Text style={styles.btnPrimaryText}>{t('liveDetail.chatSend')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

function createStyles(tk: AppThemeTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: tk.surface.bg },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: tk.surface.bg,
      padding: 16,
    },
    muted: { marginTop: 8, fontSize: 13, color: tk.text.secondary },
    errorText: { fontSize: 13, color: tk.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
    btnPrimary: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: tk.brand.DEFAULT,
      alignItems: 'center',
    },
    btnPrimaryText: { color: tk.surface.light, fontSize: 14, fontWeight: '600' },
    btnDisabled: { opacity: 0.5 },
    back: { fontSize: 14, color: tk.text.secondary },
    header: { paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
    title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tk.text.primary },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    badgeLive: { backgroundColor: tk.danger.DEFAULT },
    badgeUpcoming: { backgroundColor: tk.warning.amber },
    badgeText: { fontSize: 11, color: tk.surface.light },
    badgeMuted: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: tk.surface.card,
    },
    badgeMutedText: { fontSize: 11, color: tk.text.secondary },
    videoArea: {
      aspectRatio: 16 / 9,
      backgroundColor: tk.gray.black,
      alignItems: 'center',
      justifyContent: 'center',
    },
    videoIcon: { fontSize: 24, color: tk.surface.light },
    videoHint: { marginTop: 4, fontSize: 12, color: tk.text.tertiary },
    videoUrl: { marginTop: 2, fontSize: 10, color: tk.text.secondary, paddingHorizontal: 16 },
    subscribeSection: { paddingHorizontal: 16, paddingVertical: 12 },
    subscribedBox: {
      padding: 12,
      borderRadius: 8,
      backgroundColor: tk.success.lighter,
    },
    subscribedText: { fontSize: 13, color: tk.success.deepText },
    introSection: { paddingHorizontal: 16, paddingBottom: 8 },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: tk.text.primary, marginBottom: 4 },
    introText: { fontSize: 13, color: tk.text.secondary, lineHeight: 20 },
    chatSection: { flex: 1, paddingHorizontal: 16, marginTop: 8 },
    chatStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    statusDot: { width: 8, height: 8, borderRadius: 2 },
    chatStatusText: { fontSize: 11, color: tk.text.tertiary },
    chatListWrap: {
      flex: 1,
      padding: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: tk.border.light,
      backgroundColor: tk.surface.muted,
    },
    chatListBody: { padding: 4 },
    chatEmpty: { alignItems: 'center', paddingVertical: 24 },
    chatItem: {
      marginBottom: 4,
      padding: 8,
      borderRadius: 6,
      backgroundColor: tk.surface.card,
    },
    chatItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    chatNickname: {
      flex: 1,
      fontSize: 11,
      fontWeight: '500',
      color: tk.text.medium,
      marginRight: 8,
    },
    chatTime: { fontSize: 10, color: tk.text.tertiary },
    chatContent: { marginTop: 2, fontSize: 13, color: tk.text.primary },
    chatErrorText: { marginTop: 4, fontSize: 10, color: tk.danger.DEFAULT },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: tk.border.light,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: tk.text.primary,
      backgroundColor: tk.surface.light,
    },
    sendBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  })
}
