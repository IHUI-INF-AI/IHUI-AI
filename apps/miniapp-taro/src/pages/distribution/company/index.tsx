import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getDistributionInfo, getDistributionTeam } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

interface CompanyInfo {
  level: number
  totalCommission: number
  available: number
  withdrawn: number
  teamCount: number
}

interface Member {
  id: string
  nickname: string
  avatar?: string
  joinTime: string
  level: number
}

const DEFAULT_INFO: CompanyInfo = {
  level: 0,
  totalCommission: 0,
  available: 0,
  withdrawn: 0,
  teamCount: 0,
}

export default function CompanyPage() {
  const { t } = useI18n()
  const [info, setInfo] = useState<CompanyInfo>(DEFAULT_INFO)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [infoRes, teamRes] = await Promise.all([
        getDistributionInfo(),
        getDistributionTeam({ page: 1, pageSize: 20 }),
      ])
      setInfo(infoRes)
      const mapped: Member[] = (teamRes?.list || []).map((u) => ({
        id: u.id,
        nickname: u.nickname || u.username,
        avatar: u.avatar ?? undefined,
        joinTime: u.createdAt,
        level: 1,
      }))
      setMembers(mapped)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(load)

  const navigateTo = (url: string) => Taro.navigateTo({ url })

  return (
    <View className="cp-page">
      <View className="cp-header">
        <Text className="cp-header-title">{t('distribution.company.title')}</Text>
        <Text className="cp-header-level">
          {t('distribution.company.level', { n: info.level })}
        </Text>
        <View className="cp-stats">
          <View className="cp-stat">
            <Text className="cp-stat-num">¥{info.totalCommission}</Text>
            <Text className="cp-stat-label">{t('distribution.company.totalEarnings')}</Text>
          </View>
          <View className="cp-stat">
            <Text className="cp-stat-num">¥{info.available}</Text>
            <Text className="cp-stat-label">{t('distribution.company.available')}</Text>
          </View>
          <View className="cp-stat">
            <Text className="cp-stat-num">{info.teamCount}</Text>
            <Text className="cp-stat-label">{t('distribution.company.teamMembers')}</Text>
          </View>
        </View>
      </View>

      <View className="cp-team-card">
        <View className="cp-team-header">
          <Text className="cp-team-title">{t('distribution.company.teamMembers')}</Text>
          <Text className="cp-team-count">
            {t('distribution.company.memberCount', { n: members.length })}
          </Text>
        </View>
        {loading ? (
          <View>
            {Array.from({ length: 3 }).map((_, i) => (
              <View key={i} className="cp-loading-row">
                <View className="cp-loading-avatar" />
                <View className="cp-loading-bar" />
              </View>
            ))}
          </View>
        ) : members.length === 0 ? (
          <View className="cp-empty">
            <Text>{t('distribution.company.empty')}</Text>
          </View>
        ) : (
          members.map((m) => (
            <View
              key={m.id}
              className="cp-member"
              onClick={() => navigateTo(`/pages/distribution/member-detail/index?id=${m.id}`)}
            >
              {m.avatar ? (
                <Image className="cp-member-avatar" src={m.avatar} mode="aspectFill" />
              ) : (
                <View className="cp-member-avatar">
                  <Text>{m.nickname.charAt(0)}</Text>
                </View>
              )}
              <View className="cp-member-info">
                <Text className="cp-member-name">{m.nickname}</Text>
                <Text className="cp-member-time">
                  {t('distribution.company.joinTime', { time: m.joinTime })}
                </Text>
              </View>
              <Text className="cp-member-level">V{m.level}</Text>
            </View>
          ))
        )}
      </View>

      <View className="cp-menu-card">
        <View className="cp-menu-grid">
          <View className="cp-menu-item" onClick={() => navigateTo('/pages/distribution/team')}>
            <Text className="cp-menu-icon">👥</Text>
            <Text className="cp-menu-label">{t('distribution.company.menuTeam')}</Text>
          </View>
          <View
            className="cp-menu-item"
            onClick={() => navigateTo('/pages/distribution/commission')}
          >
            <Text className="cp-menu-icon">💰</Text>
            <Text className="cp-menu-label">{t('distribution.company.menuCommission')}</Text>
          </View>
          <View className="cp-menu-item" onClick={() => navigateTo('/pages/distribution/withdraw')}>
            <Text className="cp-menu-icon">💸</Text>
            <Text className="cp-menu-label">{t('distribution.company.menuWithdraw')}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
