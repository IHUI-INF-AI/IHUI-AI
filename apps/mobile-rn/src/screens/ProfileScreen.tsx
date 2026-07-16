import { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Card } from '@ihui/ui-native'
import { getProfile, type UserProfile } from '@ihui/api-client'

export function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const res = await getProfile()
      if (cancelled) return
      if (res.success) setProfile(res.data)
      else setError(res.error || '加载失败')
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">加载中...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-4">
        <Text className="text-red-600">{error}</Text>
      </View>
    )
  }

  const data = profile
  if (!data) return null

  const rows: Array<[string, string | null]> = [
    ['用户 ID', data.id],
    ['用户名', data.username],
    ['昵称', data.nickname],
    ['邮箱', data.email],
    ['手机号', data.phone],
    ['注册时间', data.createdAt ? new Date(data.createdAt).toLocaleString('zh-CN') : null],
  ]

  return (
    <ScrollView className="flex-1 bg-white dark:bg-black">
      <View className="px-4 pb-2 pt-6">
        <Text className="text-2xl font-semibold text-neutral-900 dark:text-neutral-50">
          {data.nickname || data.username}
        </Text>
        {data.bio ? <Text className="mt-1 text-sm text-neutral-500">{data.bio}</Text> : null}
      </View>
      <View className="px-4 pb-6">
        <Card>
          {rows.map(([label, value], idx) => (
            <View
              key={label}
              className={
                idx === 0
                  ? 'flex-row justify-between border-b border-neutral-100 py-3 dark:border-neutral-800'
                  : 'flex-row justify-between border-b border-neutral-100 py-3 dark:border-neutral-800'
              }
            >
              <Text className="text-sm text-neutral-500">{label}</Text>
              <Text className="text-sm text-neutral-900 dark:text-neutral-50">{value || '—'}</Text>
            </View>
          ))}
        </Card>
      </View>
    </ScrollView>
  )
}
