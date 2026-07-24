import { useState } from 'react'
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
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

const MOCK_CARD: BusinessCard = {
  name: '李智汇',
  position: '创始人 · CEO',
  company: 'AI智汇社',
  phone: '138-0000-0000',
  wechat: 'ai-zhs-li',
  email: 'li@ai-zhs.com',
  location: '上海 · 浦东新区',
  bio: '专注 AI 智能体研发与社区运营,致力于打造开放共享的 AI 创新生态。',
}

const PRIMARY = '#10B981'

function initials(name: string): string {
  return name ? name.slice(0, 1).toUpperCase() : '?'
}

/** 电子名片:展示个人信息 / 公司 / 职位 / 联系方式 / 二维码,支持分享与保存。 */
export default function BusinessCardScreen() {
  const navigation = useNavigation<NavigationProp>()
  const [card] = useState<BusinessCard>(MOCK_CARD)
  const [saved, setSaved] = useState(false)

  const onShare = async () => {
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

  const contacts = [
    { label: '电话', value: card.phone },
    { label: '微信', value: card.wechat },
    { label: '邮箱', value: card.email },
    { label: '地区', value: card.location },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>电子名片</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.avatarBox}>
            <Text style={styles.avatarText}>{initials(card.name)}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.name}>{card.name}</Text>
            <Text style={styles.position}>{card.position}</Text>
            <Text style={styles.company}>{card.company}</Text>
          </View>
        </View>
        <Text style={styles.bio}>{card.bio}</Text>

        <View style={styles.contactBox}>
          {contacts.map((c) => (
            <View key={c.label} style={styles.contactRow}>
              <Text style={styles.contactLabel}>{c.label}</Text>
              <Text style={styles.contactValue}>{c.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.qrBox}>
          <View style={styles.qrArea}>
            <Text style={styles.qrPlaceholder}>QR</Text>
          </View>
          <Text style={styles.qrTip}>扫码添加名片</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onShare}>
          <Text style={styles.actionText}>发送好友</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onSave}>
          <Text style={styles.actionText}>{saved ? '已保存' : '保存相册'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionPrimary} onPress={onSave}>
          <Text style={styles.actionPrimaryText}>编辑名片</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 12, gap: 12 },
  backBtn: { paddingVertical: 4 },
  backText: { fontSize: 14, color: '#6B7280' },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  card: { marginHorizontal: 16, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  avatarBox: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '700', color: PRIMARY },
  cardInfo: { flex: 1, marginLeft: 12 },
  name: { fontSize: 18, fontWeight: '600', color: '#111827' },
  position: { marginTop: 2, fontSize: 12, color: PRIMARY },
  company: { marginTop: 2, fontSize: 12, color: '#6B7280' },
  bio: { marginTop: 12, fontSize: 13, color: '#374151', lineHeight: 20 },
  contactBox: { marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: '#F9FAFB' },
  contactRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  contactLabel: { width: 40, fontSize: 11, color: '#9CA3AF' },
  contactValue: { flex: 1, fontSize: 13, color: '#111827' },
  qrBox: { marginTop: 16, alignItems: 'center' },
  qrArea: { width: 140, height: 140, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  qrPlaceholder: { fontSize: 24, fontWeight: '700', color: '#9CA3AF', letterSpacing: 2 },
  qrTip: { marginTop: 8, fontSize: 11, color: '#9CA3AF' },
  actions: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 16, gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center' },
  actionText: { fontSize: 13, color: '#374151' },
  actionPrimary: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center' },
  actionPrimaryText: { fontSize: 13, color: '#FFFFFF', fontWeight: '600' },
})
