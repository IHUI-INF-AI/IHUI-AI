// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/team/TeamScreen.tsx
import { useTt } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useMemo, useState } from 'react'
import { getTeamMembers, getTeamStats, type TeamMemberItem, type TeamStats } from '@ihui/api-client'
import { formatDateByTemplate } from '@ihui/shared'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import CategoryBar from '@/components/CategoryBar'
import SearchBar from '@/components/SearchBar'
import ThemeRoot from '@/components/ThemeRoot'

import {
  TAB_KEYS,
  TAB_TEXT,
  statusLabel,
  STAT_CELLS,
  MENU,
  CENTER,
  TITLE,
  SUBTITLE,
  SOFT_TEXT,
  DANGER_TEXT,
  STAT_VAL,
  STAT_LABEL,
  CONTRIB_LABEL,
  MEMBER_NAME,
  MEMBER_META,
  AVATAR_IMG,
  AVATAR_BOX,
  badgeCls,
  initials,
  type TeamTab,
} from './company-constants'

export default function CompanyPage() {
  const tt = useTt()
  const gate = useAuthReadyGate()
  const [stats, setStats] = useState<TeamStats | null>(null)
  const [members, setMembers] = useState<TeamMemberItem[]>([])
  const [activeTab, setActiveTab] = useState<TeamTab>('all')
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 取数与 RN 薄壳同一对端点(/distribution/team/stats|members),字段集与共享屏 props 一致
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const membersReq = getTeamMembers({ page: 1, pageSize: 20 })
    const [statsRes, membersRes] = await Promise.all([getTeamStats(), membersReq])
    if (!statsRes.success || !membersRes.success) {
      setError(tt('team.loadFailed', '加载失败'))
      setLoading(false)
      return
    }
    setStats(statsRes.data ?? null)
    setMembers(membersRes.data?.list ?? [])
    setLoading(false)
  }, [tt])

  // G-933 冷启动抢跑门控:两端点同属 distributionRoutes 的统一 authenticate preHandler
  useDidShow(() => {
    gate.waitUntilReady(load)
  })

  const tabItems = useMemo(
    () => TAB_KEYS.map((k) => ({ id: k, label: tt(TAB_TEXT[k][0], TAB_TEXT[k][1]) })),
    [tt],
  )

  // 共享屏同款派生:relation 分档过滤 + 昵称关键词过滤
  const kw = keyword.trim().toLowerCase()
  const filtered = (
    activeTab === 'all' ? members : members.filter((m) => m.relation === activeTab)
  ).filter((m) => !kw || m.nickname.toLowerCase().includes(kw))

  // 共享屏此支用 ActivityIndicator + common.loading;端内无对应转件,只落同一条取词文案
  if (loading) {
    return (
      <ThemeRoot className="min-h-screen bg-background">
        <View className={CENTER}>
          <Text className={SOFT_TEXT}>{tt('common.loading', '加载中...')}</Text>
        </View>
      </ThemeRoot>
    )
  }

  if (error && !stats) {
    return (
      <ThemeRoot className="min-h-screen bg-background">
        <View className={CENTER}>
          <Text className={DANGER_TEXT}>{error}</Text>
          <View
            className="mt-[24rpx] px-[20rpx] h-[88rpx] justify-center rounded-sm bg-cta"
            onClick={() => void load()}
            hoverClass="opacity-70"
          >
            <Text className="text-[length:28rpx] text-cta-foreground">
              {tt('team.retry', '重试')}
            </Text>
          </View>
        </View>
      </ThemeRoot>
    )
  }

  return (
    <ThemeRoot className="min-h-screen bg-background pb-[64rpx]">
      {/* header:共享屏的 BackChevron 端内无对应位——本页返回由原生导航栏承载(分包注册,无
          navigationStyle:custom),页内再画一枚即守门 102 GA6「双返回」⇒ 此处留空,见回报未收口 */}
      <View className="px-[20rpx] pb-[16rpx]">
        <Text className={TITLE}>{tt('team.title', '我的团队')}</Text>
        <Text className={SUBTITLE}>{tt('team.subtitle', '团队人数与业绩一览')}</Text>
      </View>

      {stats ? (
        <View className="mx-[20rpx] p-[28rpx] rounded-lg bg-[var(--color-success-light)]">
          <View className="flex flex-row justify-between">
            {STAT_CELLS.map((cell) => (
              <View key={cell.key} className="flex-1 flex flex-col items-center">
                <Text className={STAT_VAL}>{cell.of(stats)}</Text>
                <Text className={STAT_LABEL}>{tt(cell.key, cell.fb)}</Text>
              </View>
            ))}
          </View>
          <View className="mt-[24rpx] py-[20rpx] rounded-xl bg-background flex flex-col items-center">
            <Text className={CONTRIB_LABEL}>{tt('team.totalContribution', '团队总贡献')}</Text>
            <Text className={`${STAT_VAL} mt-[16rpx]`}>¥{stats.totalContribution}</Text>
          </View>
        </View>
      ) : null}

      <CategoryBar
        items={tabItems}
        value={activeTab}
        onChange={(id) => setActiveTab(id as TeamTab)}
        className="mt-[24rpx]"
      />

      <View className="pb-[16rpx]">
        <SearchBar
          value={keyword}
          placeholder={tt('team.searchPlaceholder', '搜索我的团友')}
          onInput={setKeyword}
        />
      </View>

      {error ? (
        <View className="px-[20rpx] py-[16rpx]">
          <Text className={DANGER_TEXT}>{error}</Text>
        </View>
      ) : null}

      <View className="p-[28rpx] pb-[64rpx]">
        {filtered.length === 0 ? (
          <View className={CENTER}>
            <Text className={SOFT_TEXT}>{tt('team.empty', '暂无团队成员')}</Text>
          </View>
        ) : (
          <View className="flex flex-col gap-[16rpx]">
            {filtered.map((m) => (
              <View
                key={m.id}
                hoverClass="opacity-70"
                className="flex flex-row items-center rounded-lg border border-border bg-background p-[28rpx]"
                onClick={() =>
                  void Taro.navigateTo({
                    url: `/pages/distribution/member-detail/index?id=${m.id}`,
                  })
                }
              >
                <View className={AVATAR_BOX}>
                  {m.avatar ? (
                    <Image className={AVATAR_IMG} src={m.avatar} mode="aspectFill" />
                  ) : (
                    <Text className="text-[length:36rpx] font-semibold text-muted-foreground">
                      {initials(m.nickname)}
                    </Text>
                  )}
                </View>
                <View className="flex-1 ml-[20rpx] mr-[16rpx] min-w-0">
                  <View className="flex flex-row items-center gap-[12rpx]">
                    <Text className={MEMBER_NAME}>{m.nickname}</Text>
                    <Text className={`${badgeCls(m.relation === 'direct')} flex-shrink-0`}>
                      {tt(TAB_TEXT[m.relation][0], TAB_TEXT[m.relation][1])}
                    </Text>
                  </View>
                  <Text className={MEMBER_META}>
                    {`${tt('team.joinDate', '加入时间')}: ${formatDateByTemplate(m.joinDate, 'YYYY-MM-DD')}`}
                  </Text>
                  <Text className={MEMBER_META}>{`${tt('team.level', '等级')}: L${m.level}`}</Text>
                </View>
                <View className="flex flex-col items-end flex-shrink-0">
                  <Text className="text-[length:28rpx] font-semibold text-[var(--color-success)]">
                    +¥{m.contribution}
                  </Text>
                  <Text className={`mt-[16rpx] ${badgeCls(m.status === 'active')}`}>
                    {tt(...statusLabel(m.status))}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <View className="mx-[20rpx] mt-[24rpx] rounded-lg border border-border bg-card p-[28rpx]">
        <View className="flex flex-row gap-[16rpx]">
          {MENU.map((entry) => (
            <View
              key={entry.k}
              className="flex-1 flex flex-col items-center gap-[8rpx] py-[24rpx] rounded-xl bg-[var(--color-muted)]"
              onClick={() => void Taro.navigateTo({ url: entry.url })}
              hoverClass="opacity-60"
            >
              <LineIcon name={entry.icon} size={40} color="var(--color-muted-foreground)" />
              <Text className="text-[length:24rpx] text-foreground">
                {tt(`distribution.company.${entry.k}`, entry.fb)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
