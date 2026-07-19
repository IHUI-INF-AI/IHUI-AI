import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Card } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface BankCard {
  id: string
  number: string
  holder: string
  bankName: string
  isDefault: boolean
}

function maskNumber(num: string): string {
  if (!num) return ''
  if (num.length <= 4) return num
  return `**** **** **** ${num.slice(-4)}`
}

export function BankCardScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [cards, setCards] = useState<BankCard[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const resp = await fetch(`${API_BASE_URL}/api/wallet/bank-cards`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!resp.ok) throw new Error('http')
      const data = (await resp.json()) as { data?: BankCard[] }
      setCards(data.data ?? [])
    } catch {
      setError(t('bankCard.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token, t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('bankCard.title')}</Text>
      </View>
      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.muted}>{t('common.loading')}</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.muted}>{t('bankCard.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.bankName}>{item.bankName}</Text>
              {item.isDefault ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{t('bankCard.default')}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.cardNumber}>{maskNumber(item.number)}</Text>
            <Text style={styles.holder}>{t('bankCard.holder')}: {item.holder}</Text>
          </Card>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backText: { fontSize: 14, color: '#374151' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  errorBar: { paddingHorizontal: 16, paddingVertical: 8 },
  errorText: { fontSize: 12, color: '#DC2626' },
  card: { padding: 14, borderRadius: 8, backgroundColor: '#10B981' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bankName: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.25)' },
  badgeText: { fontSize: 10, color: '#FFFFFF' },
  cardNumber: { marginTop: 10, fontSize: 18, fontWeight: '600', color: '#FFFFFF', letterSpacing: 1 },
  holder: { marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  emptyWrap: { alignItems: 'center', paddingVertical: 48 },
  muted: { fontSize: 12, color: '#6B7280' },
})
