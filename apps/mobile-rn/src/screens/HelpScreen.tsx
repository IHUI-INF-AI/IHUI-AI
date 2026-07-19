import { useCallback, useEffect, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Card } from '@ihui/ui-native'
import { useI18n } from '../i18n'
import { API_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface HelpItem {
  id: string
  question: string
  answer: string
}

export function HelpScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<HelpItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const resp = await fetch(`${API_BASE_URL}/api/help/faq`)
      if (!resp.ok) throw new Error('http')
      const data = (await resp.json()) as { data?: HelpItem[] }
      setItems(data.data ?? [])
    } catch {
      setError(t('help.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

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
        <Text style={styles.title}>{t('help.title')}</Text>
      </View>
      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.muted}>{t('common.loading')}</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.muted}>{t('help.empty')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <TouchableOpacity
              style={styles.question}
              onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            >
              <Text style={styles.questionText} numberOfLines={2}>{item.question}</Text>
              <Text style={styles.toggle}>{expandedId === item.id ? '−' : '+'}</Text>
            </TouchableOpacity>
            {expandedId === item.id ? <Text style={styles.answerText}>{item.answer}</Text> : null}
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
  card: { padding: 12, borderRadius: 8 },
  question: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  questionText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111827' },
  toggle: { fontSize: 18, color: '#10B981', marginLeft: 8 },
  answerText: { marginTop: 8, fontSize: 12, color: '#374151', lineHeight: 18 },
  emptyWrap: { alignItems: 'center', paddingVertical: 48 },
  muted: { fontSize: 12, color: '#6B7280' },
})
