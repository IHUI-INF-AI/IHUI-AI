import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { fetchApi } from '@ihui/api-client'
import type { RootStackParamList } from '../navigation/RootNavigator'

import { Loading } from '@ihui/ui-native'
type Nav = NativeStackNavigationProp<RootStackParamList>
type Route = RouteProp<RootStackParamList, 'LivePreview'>
interface Detail {
  id: string
  title: string
  lecturer: string
  startAt: string
  intro: string
  subscribed: boolean
}

export function LivePreviewScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<Nav>()
  const route = useRoute<Route>()
  const id = route.params.id
  const [item, setItem] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscribing, setSubscribing] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<Detail>(`/live/${id}`)
      if (!res.success) throw new Error()
      setItem(res.data ?? null)
    } catch {
      setError(t('livePreview.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  const subscribe = async () => {
    if (!item) return
    setSubscribing(true)
    try {
      const res = await fetchApi(`/live/preview/${id}/subscribe`, { method: 'POST' })
      if (!res.success) throw new Error()
      setItem({ ...item, subscribed: true })
    } catch {
      setError(t('livePreview.loadFailed'))
    } finally {
      setSubscribing(false)
    }
  }

  if (loading) {
    return (
      <View style={s.center}>
        <Loading />
        <Text style={s.muted}>{t('common.loading')}</Text>
      </View>
    )
  }
  if (error || !item) {
    return (
      <View style={s.center}>
        <Text style={s.error}>{error || t('livePreview.empty')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.back}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={s.back}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={s.title}>{t('livePreview.title')}</Text>
      </View>
      <View style={s.body}>
        <Text style={s.liveTitle}>{item.title}</Text>
        <Text style={s.meta}>
          {t('livePreview.lecturer')}: {item.lecturer}
        </Text>
        <Text style={s.meta}>
          {t('livePreview.startAt')}: {item.startAt}
        </Text>
        <Text style={s.intro}>{item.intro}</Text>
        <TouchableOpacity
          style={[s.btn, (item.subscribed || subscribing) && s.btnDisabled]}
          onPress={subscribe}
          disabled={item.subscribed || subscribing}
        >
          <Text style={s.btnText}>
            {item.subscribed ? t('livePreview.subscribed') : t('livePreview.subscribe')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  body: { padding: 16 },
  back: { fontSize: 14, color: tokens.text.medium },
  title: { fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  liveTitle: { fontSize: 18, fontWeight: '600', color: tokens.text.primary },
  meta: { marginTop: 6, fontSize: 13, color: tokens.text.secondary },
  intro: { marginTop: 12, fontSize: 14, color: tokens.text.medium, lineHeight: 22 },
  btn: {
    marginTop: 20,
    backgroundColor: tokens.success.DEFAULT,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: tokens.surface.light, fontSize: 14, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  muted: { fontSize: 12, color: tokens.text.secondary, marginTop: 8 },
  error: { fontSize: 13, color: tokens.danger.DEFAULT, textAlign: 'center' },
  backBtn: { marginTop: 12 },
})
