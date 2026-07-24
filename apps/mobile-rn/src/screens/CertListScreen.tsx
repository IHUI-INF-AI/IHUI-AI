import { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { Card, Loading } from '@ihui/ui-native'

type Nav = NativeStackNavigationProp<RootStackParamList>
interface Item {
  id: string
  name: string
  issuer: string
  issuedAt: string
  score: number
}

export function CertListScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<Nav>()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await fetch(`${API_BASE_URL}/api/certificates`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!r.ok) throw new Error()
      const d = (await r.json()) as { data?: Item[] }
      setItems(d.data ?? [])
    } catch {
      setError(t('certList.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [token, t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <View className="flex-1 bg-card">
      <View className="flex-row items-center gap-3 px-4 py-3">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text className="text-sm text-foreground">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-foreground">{t('certList.title')}</Text>
      </View>
      {error ? <Text className="px-4 text-xs text-destructive">{error}</Text> : null}
      {loading && items.length === 0 ? (
        <View className="items-center py-12">
          <Loading />
          <Text className="mt-2 text-xs text-muted-foreground">{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16 }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                void load()
              }}
            />
          }
          ListEmptyComponent={
            <View className="items-center py-12">
              <Text className="text-xs text-muted-foreground">{t('certList.empty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card className="p-3">
              <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                {item.name}
              </Text>
              <Text className="mt-1 text-[11px] text-muted-foreground">
                {t('certList.issuer')}: {item.issuer}
              </Text>
              <View className="mt-1 flex-row items-center justify-between">
                <Text className="text-[11px] text-muted-foreground">
                  {t('certList.issuedAt')}: {item.issuedAt}
                </Text>
                <Text className="text-sm font-semibold text-primary">{item.score}</Text>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  )
}
