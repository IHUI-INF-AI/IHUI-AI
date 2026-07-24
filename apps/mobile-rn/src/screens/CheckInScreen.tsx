import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  RefreshControl,
  ScrollView,
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
import { Loading } from '@ihui/ui-native'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface CheckInDay {
  date: string
  signed: boolean
  reward: number
}

interface CheckInInfo {
  todaySigned: boolean
  streak: number
  totalDays: number
  monthlyDays: number
  todayReward: number
  calendar: CheckInDay[]
}

export function CheckInScreen() {
  const { t } = useI18n()
  const { token } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [info, setInfo] = useState<CheckInInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [signing, setSigning] = useState(false)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const resp = await fetch(`${API_BASE_URL}/api/checkin/today`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!resp.ok) {
        setError(t('checkIn.loadFailed'))
        setLoading(false)
        setRefreshing(false)
        return
      }
      const data = (await resp.json()) as { data?: CheckInInfo }
      setInfo(data.data ?? null)
      setLoading(false)
      setRefreshing(false)
    },
    [token, t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const handleSign = async () => {
    if (!info || info.todaySigned) return
    setSigning(true)
    const resp = await fetch(`${API_BASE_URL}/api/checkin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    setSigning(false)
    if (resp.ok) {
      Alert.alert(t('checkIn.signSuccess'), `+${info.todayReward}`)
      void load(true)
    } else {
      Alert.alert(t('checkIn.signFailed'))
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-card p-4">
        <Loading />
        <Text className="mt-2 text-xs text-muted-foreground">{t('common.loading')}</Text>
      </View>
    )
  }

  if (error && !info) {
    return (
      <View className="flex-1 items-center justify-center bg-card p-4">
        <Text className="mt-1 text-center text-xs text-destructive">{error}</Text>
        <TouchableOpacity
          className="mt-3 rounded-md bg-primary px-4 py-2"
          onPress={() => load()}
        >
          <Text className="text-[13px] text-primary-foreground">{t('checkIn.retry')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView
      className="flex-1 bg-card"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      <View className="px-4 pb-2 pt-12">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mb-1">
          <Text className="text-sm text-muted-foreground">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-[22px] font-semibold text-foreground">{t('checkIn.title')}</Text>
        <Text className="mt-1 text-[13px] text-muted-foreground">{t('checkIn.subtitle')}</Text>
      </View>

      {info ? (
        <>
          <View className="mx-4 rounded-md bg-primary/10 p-4">
            <View className="flex-row justify-between">
              <View className="flex-1 items-center">
                <Text className="text-[22px] font-bold text-primary">{info.streak}</Text>
                <Text className="mt-1 text-[11px] text-primary">{t('checkIn.streak')}</Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-[22px] font-bold text-primary">{info.monthlyDays}</Text>
                <Text className="mt-1 text-[11px] text-primary">{t('checkIn.monthlyDays')}</Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-[22px] font-bold text-primary">{info.totalDays}</Text>
                <Text className="mt-1 text-[11px] text-primary">{t('checkIn.totalDays')}</Text>
              </View>
            </View>
            <TouchableOpacity
              className={`mt-3.5 items-center rounded-md py-3 ${info.todaySigned ? 'bg-muted' : 'bg-primary'}`}
              onPress={handleSign}
              disabled={info.todaySigned || signing}
            >
              <Text className={`text-sm font-semibold ${info.todaySigned ? 'text-muted-foreground' : 'text-primary-foreground'}`}>
                {signing
                  ? t('common.loading')
                  : info.todaySigned
                    ? t('checkIn.checkedIn')
                    : `${t('checkIn.checkInBtn')} +${info.todayReward}`}
              </Text>
            </TouchableOpacity>
          </View>

          <Text className="px-4 pb-2 pt-4 text-[15px] font-semibold text-foreground">{t('checkIn.calendar')}</Text>
          <View className="mx-4 flex-row flex-wrap gap-1.5">
            {info.calendar.map((day) => (
              <View
                key={day.date}
                style={{ width: '13%', aspectRatio: 1 }}
                className={`items-center justify-center rounded-md border ${day.signed ? 'border-primary bg-primary' : 'border-border bg-card'}`}
              >
                <Text className={`text-xs ${day.signed ? 'text-primary-foreground' : 'text-foreground/80'}`}>
                  {day.date.slice(-2)}
                </Text>
                {day.signed ? (
                  <Text className="mt-0.5 text-xs text-primary-foreground">✓</Text>
                ) : (
                  <Text className="mt-0.5 text-[10px] text-muted-foreground">+{day.reward}</Text>
                )}
              </View>
            ))}
          </View>

          {error ? <Text className="mt-2 text-center text-xs text-destructive">{error}</Text> : null}
        </>
      ) : (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-xs text-muted-foreground">{t('checkIn.empty')}</Text>
        </View>
      )}
    </ScrollView>
  )
}
