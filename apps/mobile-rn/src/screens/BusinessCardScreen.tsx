import { useEffect, useState } from 'react'
import { Share } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi, getProfile, type AuthUser } from '@ihui/api-client'
import { BusinessCardScreen as SharedBusinessCardScreen, type BusinessCardItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** /api/business-card/list 返回的单条名片(仅取所需字段) */
interface BusinessCardListItem {
  id: string
  name: string
  title: string | null
  company: string | null
  authorId: string
  intro: string | null
}

/** 从 AuthUser 构造默认名片(用户尚未创建名片时的兜底) */
function buildDefaultCard(profile: AuthUser): BusinessCardItem {
  return {
    id: '',
    name: profile.nickname || profile.username || '未命名',
    position: '',
    company: '',
    phone: profile.phone ?? '',
    wechat: '',
    email: profile.email ?? '',
    location: '',
    bio: profile.bio ?? '',
  }
}

/** 电子名片:展示个人信息 / 公司 / 职位 / 联系方式 / 二维码,支持分享与保存。 */
export default function BusinessCardScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [card, setCard] = useState<BusinessCardItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    Promise.all([
      getProfile(),
      fetchApi<{ list: BusinessCardListItem[] }>('/api/business-card/list?page=1&pageSize=100'),
    ])
      .then(([profileRes, listRes]) => {
        if (cancelled) return
        if (!profileRes.success) {
          setError('加载失败')
          return
        }
        const profile = profileRes.data
        const list = listRes.success ? listRes.data.list : []
        const mine = list.find((item) => item.authorId === profile.id)
        if (mine) {
          setCard({
            id: mine.id,
            name: mine.name,
            position: mine.title ?? '',
            company: mine.company ?? '',
            phone: profile.phone ?? '',
            wechat: '',
            email: profile.email ?? '',
            location: '',
            bio: mine.intro ?? '',
          })
        } else {
          setCard(buildDefaultCard(profile))
        }
      })
      .catch(() => {
        if (!cancelled) setError('加载失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const onShare = async () => {
    if (!card) return
    try {
      await Share.share({
        message: `${card.name} · ${card.position}\n${card.company}\n电话:${card.phone}  微信:${card.wechat}`,
      })
    } catch {
      // ignore share errors
    }
  }

  const onSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <SharedBusinessCardScreen
      t={t}
      card={card}
      loading={loading}
      error={error}
      saved={saved}
      onShare={onShare}
      onSave={onSave}
      onEdit={() => navigation.goBack()}
      onBack={() => navigation.goBack()}
    />
  )
}
