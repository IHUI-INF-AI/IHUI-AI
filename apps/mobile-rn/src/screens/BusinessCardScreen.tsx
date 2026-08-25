import { useEffect, useState } from 'react'
import { Alert, Share } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  fetchApi,
  getProfile,
  resolveFileUrl,
  uploadBusinessCard,
  uploadFileMultipart,
  type AuthUser,
} from '@ihui/api-client'
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

  /** 拼接名片分享文案(微信/朋友圈共用,对齐原项目 business-card-sharing 分享内容) */
  const buildShareMessage = (): string =>
    card
      ? `${card.name} · ${card.position}\n${card.company}\n电话:${card.phone}  微信:${card.wechat}`
      : ''

  const onShare = async () => {
    if (!card) return
    try {
      await Share.share({
        message: buildShareMessage(),
      })
    } catch {
      // ignore share errors
    }
  }

  // 微信好友 / 朋友圈:RN 端统一走系统 Share 面板(无原生直达能力),按钮文案区分
  const onShareWechat = async () => {
    if (!card) return
    try {
      await Share.share({
        title: '微信好友',
        message: buildShareMessage(),
      })
    } catch {
      // ignore share errors
    }
  }

  const onShareMoments = async () => {
    if (!card) return
    try {
      await Share.share({
        title: '朋友圈',
        message: buildShareMessage(),
      })
    } catch {
      // ignore share errors
    }
  }

  // 定制名片(对齐原项目 business-card 页 onUploadClick:选图上传 → 提交名片 → 刷新列表)
  const onCustomize = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!perm.granted) {
        Alert.alert('提示', '需要相册权限才能选择名片图片')
        return
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        base64: true,
      })
      if (result.canceled || result.assets.length === 0) return
      const asset = result.assets[0]!
      const fileName = `card-${Date.now()}.jpg`
      // 1. 上传图片拿 URL(uploadFileMultipart 通用上传)
      const up = await uploadFileMultipart({
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: fileName,
      })
      if (!up.success || !up.data?.path) {
        Alert.alert('提示', '名片图片上传失败')
        return
      }
      // 2. 提交名片(对齐原 uploadBusinessCard → /remote/business-card/upload)
      const cardRes = await uploadBusinessCard({
        imageUrl: resolveFileUrl(up.data.path),
        name: card?.name ?? '',
        company: card?.company ?? '',
        title: card?.position ?? '',
        phone: card?.phone ?? '',
        email: card?.email ?? '',
      })
      if (cardRes.success) {
        Alert.alert('成功', '名片已更新')
        // 3. 刷新列表
        const listRes = await fetchApi<{ list: BusinessCardListItem[] }>(
          '/api/business-card/list?page=1&pageSize=100',
        )
        if (listRes.success) {
          const profile = await getProfile()
          if (profile.success) {
            const mine = listRes.data.list.find((item) => item.authorId === profile.data.id)
            if (mine) {
              setCard({
                id: mine.id,
                name: mine.name,
                position: mine.title ?? '',
                company: mine.company ?? '',
                phone: profile.data.phone ?? '',
                wechat: '',
                email: profile.data.email ?? '',
                location: '',
                bio: mine.intro ?? '',
              })
            }
          }
        }
      } else {
        Alert.alert('提示', '名片提交失败')
      }
    } catch {
      Alert.alert('提示', '名片定制失败,请重试')
    } finally {
      // 定制完成(同步提示已由 Alert 呈现)
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
      onCustomize={onCustomize}
      onShareWechat={onShareWechat}
      onShareMoments={onShareMoments}
    />
  )
}
