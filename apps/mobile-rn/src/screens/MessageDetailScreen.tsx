import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { Loading } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import type { MessageItem } from '@ihui/types'

interface Message extends MessageItem {
  fromUser: string // = fromNickname 别名(业务字段,与 fromNickname 并存)
  read: boolean // = isRead 别名(业务字段,与 isRead 并存)
  subject: string
  fromAvatar?: string // 收窄父类型 string | null -> string(保留原声明)
}

type Route = RouteProp<RootStackParamList, 'MessageDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

export function MessageDetailScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [msg, setMsg] = useState<Message | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await fetchApi<Message>(`/api/messages/${encodeURIComponent(id)}`)
      if (cancelled) return
      if (res.success) setMsg(res.data)
      else setError(res.error || t('messageDetail.loadFailed'))
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  if (loading)
    return (
      <View style={styles.center}>
        <Loading />
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    )
  if (error || !msg)
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error || t('messageDetail.loadFailed')}</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}>
          <Text style={styles.btnText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('MessageChat', { peerId: msg.fromUser, name: msg.fromUser })
          }
        >
          <Text style={styles.reply}>{t('messageDetail.reply')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subject}>{msg.subject}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.from}>{msg.fromUser}</Text>
        <Text style={styles.meta}>{msg.createdAt}</Text>
      </View>
      <Text style={styles.content}>{msg.content}</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.surface.bg,
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.surface.bg,
    padding: 16,
  },
  muted: { marginTop: 8, fontSize: 13, color: tokens.text.secondary },
  error: { fontSize: 13, color: tokens.danger.DEFAULT, marginBottom: 8, textAlign: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back: { fontSize: 14, color: tokens.text.secondary },
  reply: { fontSize: 14, color: tokens.success.DEFAULT, fontWeight: '500' },
  subject: { marginTop: 8, fontSize: 22, fontWeight: '600', color: tokens.text.primary },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 12,
  },
  from: { fontSize: 13, color: tokens.success.DEFAULT, fontWeight: '500' },
  meta: { fontSize: 11, color: tokens.text.tertiary },
  content: { fontSize: 14, lineHeight: 22, color: tokens.text.medium },
  btn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: tokens.success.DEFAULT,
  },
  btnText: { color: tokens.surface.light, fontSize: 14 },
})
