// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AgentMyApps — 「我的AI APP」横向滚动段 + 我的AI员工入口(跨端共享)
 *
 * 单源化来源:小程序 pages/community 的 MyAgents 与 mobile-rn components/MyAgents。
 * 两端各写一遍的标题 + 入口 + 头像卡 + 空态在此收口;导航/登录/付费拦截仍由各端 onItemClick 负责。
 */

import { useMemo } from 'react'
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { AgentMyAppsProps } from '@ihui/types'

import { getTokens, type AppThemeMode } from '../../theme/tokens'
import { SectionHeader } from '../../components/SectionHeader'

export type { AgentHomeItem, AgentMyAppsProps } from '@ihui/types'

export function AgentMyApps({
  items,
  title,
  moreText,
  onItemClick,
  onMore,
  showMore,
  colorScheme,
  defaultAvatar,
  emptyText,
}: AgentMyAppsProps) {
  const styles = useMemo(() => createStyles(colorScheme), [colorScheme])
  const list = items && items.length > 0 ? items : null
  if (!list && emptyText === null) return null

  return (
    <View style={styles.container}>
      <SectionHeader
        title={title}
        moreText={moreText}
        onMore={onMore}
        showMore={showMore}
        colorScheme={colorScheme}
        style={styles.header}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, list ? null : styles.scrollEmpty]}
      >
        {list ? (
          list.map((item, index) => {
            const name = item.agentName || item.name || ''
            const avatar = item.agentAvatar || item.avatar || defaultAvatar || undefined
            const key = item.agentId || item.name || `${index}-${name}`
            return (
              <TouchableOpacity
                key={key}
                style={styles.item}
                onPress={() => onItemClick(item, index)}
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

function createStyles(colorScheme: AppThemeMode) {
  const tokens = getTokens(colorScheme)
  return StyleSheet.create({
    container: {
      paddingHorizontal: rnSpacing.none,
      marginBottom: rnSpacing.none,
    },
    header: {
      paddingHorizontal: rnSpacing['sm-loose'],
    },
    scroll: {
      flexDirection: 'row',
      paddingHorizontal: 5,
      paddingTop: rnSpacing['xs-loose'],
      paddingBottom: rnSpacing['2xs'],
    },
    scrollEmpty: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    item: {
      alignItems: 'center',
      minWidth: 60,
      marginHorizontal: 5,
      paddingVertical: rnSpacing['sm-loose'],
      paddingHorizontal: 5,
      borderRadius: rnRadius.xl,
      backgroundColor: tokens.surface.muted,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: rnRadius.lg,
      marginBottom: rnSpacing['xs-loose'],
      backgroundColor: tokens.surface.card,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: rnType.body.size,
      fontWeight: '600',
      color: tokens.text.primary,
    },
    name: {
      fontSize: rnType.label.size,
      color: tokens.text.secondary,
      textAlign: 'center',
      maxWidth: 80,
    },
    emptyItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: rnSpacing['5xl'],
      paddingHorizontal: rnSpacing['sm-loose'],
    },
    emptyText: {
      fontSize: rnType.body.size,
      color: tokens.text.tertiary,
      textAlign: 'center',
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
