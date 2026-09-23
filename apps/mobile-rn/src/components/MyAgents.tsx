// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

/**
 * MyAgents 我的AI APP (mobile-rn 端)
 *
 * 对齐 Uniapp 项目 pages/table/tools/components/MyAgents.vue:
 * - 标题"我的AI APP" + 右侧"我的AI员工"入口(点击 → 我的AI员工团队页)
 * - 横向 ScrollView 展示 agent 卡片列表(灰底圆角卡 + 头像 + 名称)
 * - 每项:头像(80rpx → 40dp 圆角 10)+ 名称(24rpx → 12pt)
 * - 空态:emptyText(默认"暂无智能体"),全宽居中(paddingVertical 48,对齐全仓空态)
 * - 点击 → onItemClick(item) 回调(登录校验 / type 3|5 付费模型 / source n8n 跳转均由调用方负责,预留)
 *
 * 类型零 any;圆角守门(无 rounded-full);无分割线(gap 间距);复用 design-tokens;禁用 purple/indigo。
 */
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { tokens } from '../theme/active-tokens'

export interface MyAgentItem {
  /** 智能体 ID(对齐原项目 agentId;兼容短字段 id) */
  agentId?: string
  id?: string
  /** 智能体名称(对齐原项目 agentName;缺失回退 name) */
  agentName?: string
  name?: string
  /** 头像(对齐原项目 agentAvatar;缺失回退 avatar) */
  agentAvatar?: string
  avatar?: string
  /** 类型(原项目 type 3|5 为付费模型,点击由调用方拦截) */
  type?: string | number
  /** 来源(原项目 source === 'n8n' 跳 n8n 助手页) */
  source?: string
}

export interface MyAgentsProps {
  items: MyAgentItem[]
  onItemClick: (item: MyAgentItem) => void
  /** "我的AI员工"入口点击(对齐原项目 goToTeam → /pages/tools/ai_group/index) */
  onTeamPress?: () => void
  /** 默认头像(对齐原项目 defaultAvatar) */
  defaultAvatar?: string
  /** 空态文案 */
  emptyText?: string
}

export default function MyAgents({
  items,
  onItemClick,
  onTeamPress,
  defaultAvatar,
  emptyText = '暂无智能体',
}: MyAgentsProps) {
  const list = items && items.length > 0 ? items : null

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{'我的AI APP'}</Text>
        {onTeamPress ? (
          <TouchableOpacity
            style={styles.teamButton}
            onPress={onTeamPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="我的AI员工"
          >
            <Text style={styles.teamButtonText}>{'我的AI员工'}</Text>
            <Text style={styles.teamArrow}>{'›'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, list ? null : styles.scrollEmpty]}
      >
        {list ? (
          list.map((item, index) => {
            const name = item.agentName ?? item.name ?? ''
            const avatar = item.agentAvatar ?? item.avatar ?? defaultAvatar
            const key = item.agentId ?? item.name ?? `${index}-${name}`
            return (
              <TouchableOpacity
                key={key}
                style={styles.item}
                onPress={() => onItemClick(item)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={name}
              >
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarText}>
                      {name.trim().charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                )}
                <Text style={styles.name} numberOfLines={1}>
                  {name}
                </Text>
              </TouchableOpacity>
            )
          })
        ) : (
          <View style={styles.emptyItem}>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
    marginBottom: 0,
  },
  header: {
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.text.primary,
  },
  teamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  teamButtonText: {
    fontSize: 14,
    color: tokens.text.secondary,
    marginRight: 4,
  },
  teamArrow: {
    fontSize: 16,
    color: tokens.text.secondary,
    marginBottom: -2,
  },
  scroll: {
    flexDirection: 'row',
    paddingHorizontal: 5,
    paddingTop: 6,
    paddingBottom: 2,
  },
  scrollEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  item: {
    alignItems: 'center',
    minWidth: 60,
    marginHorizontal: 5,
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderRadius: rnRadius.xl,
    backgroundColor: tokens.surface.muted,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: rnRadius.lg,
    marginBottom: 6,
    backgroundColor: tokens.surface.card,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.text.primary,
  },
  name: {
    fontSize: 12,
    color: tokens.text.secondary,
    textAlign: 'center',
    maxWidth: 80,
  },
  emptyItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 10,
  },
  emptyText: {
    fontSize: 14,
    color: tokens.text.tertiary,
    textAlign: 'center',
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
