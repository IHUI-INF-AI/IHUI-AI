import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface Notif { id: string; title: string; content: string; type: 'system' | 'order' | 'course' | 'social'; read: boolean; createdAt: string }

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
const PRIMARY = '#10B981'

export function NotificationListScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true)
    setError('')
    const res = await fetchApi<Notif[]>('/api/notifications')
    if (res.success) setNotifs(res.data ?? [])
    else setError(res.error || t('notificationList.loadFailed'))
    setLoading(false); setRefreshing(false)
  }

  useEffect(() => { void load() }, [])

  if (loading) return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>{t('common.loading')}</Text></View>
  if (error && notifs.length === 0) return (
    <View style={styles.center}>
      <Text style={styles.error}>{error}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}><Text style={styles.btnText}>{t('common.back')}</Text></TouchableOpacity>
    </View>
  )
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <Text style={styles.title}>{t('notificationList.title')}</Text>
      <FlatList
        data={notifs}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.muted}>{t('notificationList.empty')}</Text></View>}
        renderItem={({ item }) => (
          <View style={[styles.card, !item.read && styles.unread]}>
            <View style={styles.cardHead}>
              <Text style={[styles.type, item.type === 'system' && styles.typeSystem]}>{t(`notificationList.type.${item.type}`)}</Text>
              {!item.read ? <View style={styles.dot} /> : null}
              <Text style={styles.meta}>{item.createdAt}</Text>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.cardContent} numberOfLines={2}>{item.content}</Text>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 16 },
  muted: { marginTop: 8, fontSize: 13, color: '#6b7280' },
  error: { fontSize: 13, color: '#dc2626', marginBottom: 8, textAlign: 'center' },
  back: { fontSize: 14, color: '#6b7280' },
  title: { marginTop: 8, fontSize: 22, fontWeight: '600', color: '#111827', marginBottom: 12 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  card: { padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
  unread: { borderColor: PRIMARY, backgroundColor: '#ecfdf5' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  type: { fontSize: 10, color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  typeSystem: { color: PRIMARY, backgroundColor: '#ecfdf5' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#dc2626' },
  meta: { marginLeft: 'auto', fontSize: 11, color: '#9ca3af' },
  cardTitle: { marginTop: 6, fontSize: 14, fontWeight: '600', color: '#111827' },
  cardContent: { marginTop: 4, fontSize: 13, color: '#374151' },
  btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  btnText: { color: '#fff', fontSize: 14 },
})
