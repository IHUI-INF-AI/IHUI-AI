import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Share, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Avatar, Card } from '@ihui/ui-native'
import { fetchApi, getProfile, type AuthUser } from '@ihui/api-client'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

interface BusinessCard {
  name: string
  position: string
  company: string
  phone: string
  wechat: string
  email: string
  location: string
  bio: string
}

interface BusinessCardListItem {
  id: string
  name: string
  title: string | null
  company: string | null
  intro: string | null
  authorId: string
}

interface BusinessCardListResp {
  list: BusinessCardListItem[]
  total: number
  page: number
  pageSize: number
}

interface BusinessCardCreateBody {
  name: string
  intro?: string
  phone?: string
  email?: string
}

interface BusinessCardUpsertCard {
  id: string
  name: string
  title: string | null
  company: string | null
  intro: string | null
}

interface BusinessCardUpsertResp {
  card: BusinessCardUpsertCard
  created: boolean
}

const PLACEHOLDER = '未填写'

/** 电子名片:展示个人信息 / 公司 / 职位 / 联系方式 / 二维码,支持分享与保存。 */
export default function BusinessCardScreen() {
  const navigation = useNavigation<NavigationProp>()
  const [profile, setProfile] = useState<AuthUser | null>(null)
  const [card, setCard] = useState<BusinessCardListItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const profileRes = await getProfile()
      if (cancelled) return
      if (!profileRes.success) {
        setError(profileRes.error)
        setLoading(false)
        return
      }
      setProfile(profileRes.data)
      const listRes = await fetchApi<BusinessCardListResp>(
        '/api/business-card/list?page=1&pageSize=100',
      )
      if (cancelled) return
      if (listRes.success) {
        const mine =
          listRes.data.list.find((c) => c.authorId === profileRes.data.id) ?? null
        setCard(mine)
      } else {
        setError(listRes.error)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const onShare = async () => {
    const display = buildDisplayCard(profile, card)
    try {
      await Share.share({
        message: `${display.name} · ${display.position}\n${display.company}\n电话:${display.phone}  微信:${display.wechat}`,
      })
    } catch {
      // ignore share errors
    }
  }

  const onSaveToAlbum = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const onEdit = () => {
    Alert.alert('提示', '编辑功能待接入')
  }

  const onCreate = async () => {
    if (!profile || saving) return
    setSaving(true)
    const body: BusinessCardCreateBody = {
      name: profile.nickname || profile.username || '我的名片',
    }
    if (profile.bio) body.intro = profile.bio
    if (profile.phone) body.phone = profile.phone
    if (profile.email) body.email = profile.email
    const res = await fetchApi<BusinessCardUpsertResp>('/api/business-card/me', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (res.success) {
      setCard({
        id: res.data.card.id,
        name: res.data.card.name,
        title: res.data.card.title,
        company: res.data.card.company,
        intro: res.data.card.intro,
        authorId: profile.id,
      })
    } else {
      Alert.alert('创建失败', res.error)
    }
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-card">
        <ActivityIndicator />
      </View>
    )
  }

  const display = buildDisplayCard(profile, card)
  const hasCard = card !== null

  const contacts = [
    { label: '电话', value: display.phone },
    { label: '微信', value: display.wechat },
    { label: '邮箱', value: display.email },
    { label: '地区', value: display.location },
  ]

  return (
    <View className="flex-1 bg-card">
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-12">
        <TouchableOpacity onPress={() => navigation.goBack()} className="py-1">
          <Text className="text-sm text-muted-foreground">返回</Text>
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-foreground">电子名片</Text>
      </View>

      {error ? (
        <View className="mx-4 mb-2 rounded-md bg-destructive/10 p-3">
          <Text className="text-xs text-destructive">{error}</Text>
        </View>
      ) : null}

      {!hasCard ? (
        <View className="mx-4 items-center rounded-md border border-border p-6">
          <Text className="text-sm text-muted-foreground">您还没有名片,点击创建</Text>
          <TouchableOpacity
            onPress={onCreate}
            disabled={saving}
            className="mt-3 rounded-md bg-primary px-4 py-2"
          >
            <Text className="text-[13px] font-semibold text-primary-foreground">
              {saving ? '创建中...' : '创建名片'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Card className="mx-4 p-4">
            <View className="flex-row items-center">
              <Avatar name={display.name} size="lg" shape="rounded" className="bg-primary/10" />
              <View className="ml-3 flex-1">
                <Text className="text-lg font-semibold text-foreground">{display.name}</Text>
                <Text className="mt-0.5 text-xs text-primary">{display.position}</Text>
                <Text className="mt-0.5 text-xs text-muted-foreground">{display.company}</Text>
              </View>
            </View>
            <Text className="mt-3 text-[13px] leading-5 text-foreground/80">{display.bio}</Text>

            <View className="mt-3 rounded-md bg-muted p-3">
              {contacts.map((c) => (
                <View key={c.label} className="flex-row items-center py-1">
                  <Text className="w-10 text-[11px] text-muted-foreground">{c.label}</Text>
                  <Text className="flex-1 text-[13px] text-foreground">{c.value}</Text>
                </View>
              ))}
            </View>

            <View className="mt-4 items-center">
              <View className="h-[140px] w-[140px] items-center justify-center rounded-md bg-muted">
                <Text className="text-2xl font-bold tracking-widest text-muted-foreground">QR</Text>
              </View>
              <Text className="mt-2 text-[11px] text-muted-foreground">扫码添加名片</Text>
            </View>
          </Card>

          <View className="flex-row gap-2 px-4 py-4">
            <TouchableOpacity
              onPress={onShare}
              className="flex-1 items-center rounded-md border border-border py-2.5"
            >
              <Text className="text-[13px] text-foreground/80">发送好友</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onSaveToAlbum}
              className="flex-1 items-center rounded-md border border-border py-2.5"
            >
              <Text className="text-[13px] text-foreground/80">{saved ? '已保存' : '保存相册'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onEdit}
              className="flex-1 items-center rounded-md bg-primary py-2.5"
            >
              <Text className="text-[13px] font-semibold text-primary-foreground">编辑名片</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  )
}

function buildDisplayCard(
  profile: AuthUser | null,
  card: BusinessCardListItem | null,
): BusinessCard {
  return {
    name: card?.name || profile?.nickname || profile?.username || PLACEHOLDER,
    position: card?.title ?? PLACEHOLDER,
    company: card?.company ?? PLACEHOLDER,
    phone: profile?.phone ?? PLACEHOLDER,
    wechat: PLACEHOLDER,
    email: profile?.email ?? PLACEHOLDER,
    location: PLACEHOLDER,
    bio: card?.intro || profile?.bio || '',
  }
}
