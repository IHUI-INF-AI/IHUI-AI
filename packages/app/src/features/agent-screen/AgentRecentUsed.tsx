// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AgentRecentUsed — 「最近使用」智能体横向滚动段(跨端共享)
 *
 * 单源化来源:小程序 pages/community 的 RecentAgents 与 mobile-rn components/RecentAgents。
 * 两端各写一遍的标题 + 头像卡 + 横向滚动在此收口;导航/登录/付费拦截仍由各端 onItemClick 负责。
 */

import { useMemo } from 'react'
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { rnRadius, rnSpacing, rnType } from '@ihui/design-tokens'
import type { AgentRecentUsedProps } from '@ihui/types'

import { getTokens, type AppThemeMode } from '../../theme/tokens'

export type { AgentHomeItem, AgentRecentUsedProps } from '@ihui/types'

export function AgentRecentUsed({
  items,
  title,
  onItemClick,
  colorScheme,
  defaultAvatar,
}: AgentRecentUsedProps) {
  const styles = useMemo(() => createStyles(colorScheme), [colorScheme])
  if (!items || items.length === 0) return null

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {items.map((item, index) => {
          const name = item.agentName || item.name || ''
          const avatar = item.agentAvatar || item.avatar || defaultAvatar || undefined
          const key = item.agentId ?? item.id ?? `${index}-${name}`
          return (
            <TouchableOpacity
              key={key}
              style={styles.item}
              onPress={() => onItemClick(item, index)}
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
        })}
      </ScrollView>
    </View>
  )
}

function createStyles(colorScheme: AppThemeMode) {
  const tokens = getTokens(colorScheme)
  return StyleSheet.create({
    container: {
      paddingHorizontal: rnSpacing.md,
      paddingVertical: rnSpacing.sm,
    },
    title: {
      fontSize: rnType.title.size,
      fontWeight: '700',
      color: tokens.text.primary,
      marginBottom: rnSpacing.sm,
    },
    scroll: {
      gap: rnSpacing['sm-loose'],
    },
    item: {
      alignItems: 'center',
      minWidth: 60,
      paddingVertical: rnSpacing['sm-loose'],
      paddingHorizontal: 5,
      borderRadius: rnRadius.xl,
      backgroundColor: tokens.surface.muted,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: rnRadius.lg,
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
      marginTop: rnSpacing['xs-loose'],
      maxWidth: 80,
      fontSize: rnType.label.size,
      color: tokens.text.secondary,
      textAlign: 'center',
    },
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
