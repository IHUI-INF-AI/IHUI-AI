import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface Member { id: string; nickname: string; avatar?: string; role: 'owner' | 'admin' | 'member'; joinedAt: string }

type Route = RouteProp<RootStackParamList, 'CircleMember'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>
const PRIMARY = '#10B981'

export function CircleMemberScreen() {
  const { t } = useI18n()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { circleId } = route.params
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true); setError('')
      const res = await fetchApi<Member[]>(`/api/circles/${encodeURIComponent(circleId)}/members`)
      if (cancelled) return
      if (res.success) setMembers(res.data ?? [])
      else setError(res.error || t('circleMember.loadFailed'))
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [circleId, t])

  if (loading) return <View style={styles.center}><ActivityIndicator /><Text style={styles.muted}>{t('common.loading')}</Text></View>
  if (error) return (
    <View style={styles.center}>
      <Text style={styles.error}>{error}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => navigation.goBack()}><Text style={styles.btnText}>{t('common.back')}</Text></TouchableOpacity>
    </View>
  )
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.back}>{t('common.back')}</Text></TouchableOpacity>
      <Text style={styles.title}>{t('circleMember.title')}</Text>
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<View style={styles.empty}><Text style={styles.muted}>{t('circleMember.empty')}</Text></View>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{item.nickname.charAt(0).toUpperCase()}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{item.nickname}</Text>
              <Text style={styles.meta}>{item.joinedAt}</Text>
            </View>
            <Text style={[styles.role, item.role === 'owner' && styles.roleOwner]}>{t(`circleMember.${item.role}`)}</Text>
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
  card: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  name: { fontSize: 14, fontWeight: '500', color: '#111827' },
  meta: { marginTop: 2, fontSize: 11, color: '#9ca3af' },
  role: { fontSize: 11, color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  roleOwner: { color: PRIMARY, backgroundColor: '#ecfdf5' },
  btn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: PRIMARY },
  btnText: { color: '#fff', fontSize: 14 },
})
