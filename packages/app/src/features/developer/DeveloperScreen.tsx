import { useMemo } from 'react'
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import type { TFunction } from '@ihui/types'
import {
  DEVELOPER_DEFAULT_LOGO_URL,
  DEVELOPER_SPACE_ENTRIES,
  DEVELOPER_SPACE_PROBLEMS,
} from '@ihui/shared/constants/developer-space'
import { getTokens } from '../../theme/tokens'
import type { DeveloperScreenProps, DeveloperSpaceInfo } from '../../types'
import { createDeveloperStyles } from './developer-styles'

/**
 * DeveloperScreen 开发者空间页 —— 平台无关共享屏(RN 端与小程序端的唯一真相源)
 *
 * 对齐历史项目 pagesA/plaza/developer.vue(标题「开发者详情」),四段构成:
 * ① 头部用户卡(头像 + 昵称 + 「成为开发者 / 续费」CTA)
 * ② 开发者信息卡(申请信息 / 账号 / API 密钥 / 网址 / 到期时间 + 续费)—— 行的构成与顺序
 *    就是下面 `buildInfoRows()` 那张表;端侧只供原料,不得再各写一份版式
 * ③ 四个功能入口(构成/顺序/i18n 键在 `@ihui/shared/constants/developer-space`)
 * ④ 问题解答卡 + 咨询客服入口
 *
 * 纯 UI:不取数、不自绘导航栏、不用平台 API。取数与路由由端侧薄壳注入
 * (RN 壳:`apps/mobile-rn/src/screens/DeveloperScreen.tsx`;小程序端渲染层须逐元素同形本屏)。
 * 样式表住在 `./developer-styles.ts`(同 `features/about/about-styles.ts` 的分工)。
 */

/** 无值占位:排字符号而非文案,不占 i18n 键 */
const EMPTY_PLACEHOLDER = '—'

interface InfoAction {
  label: string
  onPress: () => void
}

interface InfoRowSpec {
  label: string
  value: string
  lines?: number
  danger?: boolean
  action?: InfoAction | null
}

function applicationStatusLabel(t: TFunction, status: number): string {
  if (status === 1) return t('developerInfo.statusApproved')
  if (status === 2) return t('developerInfo.statusRejected')
  return t('developerInfo.statusPending')
}

/** 信息卡行的单一来源:无申请记录 ⇒ 三行申请信息整块缺席;无可复制密钥 ⇒ 不出复制动作 */
function buildInfoRows(
  t: TFunction,
  info: DeveloperSpaceInfo,
  onCopyApiKey: (key: string) => void,
  onRenew: () => void,
): InfoRowSpec[] {
  const rows: InfoRowSpec[] = []
  if (info.application) {
    const { name, description, status } = info.application
    rows.push({ label: t('developerInfo.nameLabel'), value: name || EMPTY_PLACEHOLDER })
    if (description) {
      rows.push({ label: t('developerInfo.descLabel'), value: description, lines: 2 })
    }
    rows.push({ label: t('developerInfo.statusLabel'), value: applicationStatusLabel(t, status) })
  }
  const copyableKey = info.copyableApiKey
  rows.push(
    { label: t('developerInfo.accountLabel'), value: info.account || EMPTY_PLACEHOLDER },
    {
      label: t('developerInfo.apiKeyLabel'),
      value:
        info.apiKeyCount > 0
          ? t('developerInfo.apiKeyCount', { count: info.apiKeyCount })
          : t('developerInfo.apiKeyNone'),
      action: copyableKey
        ? { label: t('devSpace.copy'), onPress: () => onCopyApiKey(copyableKey) }
        : null,
    },
    { label: t('developerInfo.urlLabel'), value: info.website || EMPTY_PLACEHOLDER },
    {
      label: t('developerInfo.expiryLabel'),
      value: info.expiry || EMPTY_PLACEHOLDER,
      danger: true,
      action: { label: t('devSpace.renew'), onPress: onRenew },
    },
  )
  return rows
}

export function DeveloperScreen({
  t,
  avatarUrl,
  displayName,
  subscribed,
  info,
  onBecomeDeveloper,
  onRenew,
  onCopyApiKey,
  onEntryPress,
  onProblemPress,
  onContactService,
  colorScheme = 'light',
}: DeveloperScreenProps) {
  const tk = getTokens(colorScheme)
  const styles = useMemo(() => createDeveloperStyles(tk), [tk])
  const rows = info ? buildInfoRows(t, info, onCopyApiKey, onRenew) : null

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ① 头部用户卡 */}
      <View style={styles.headerCard}>
        <Image
          source={{ uri: avatarUrl || DEVELOPER_DEFAULT_LOGO_URL }}
          style={styles.avatar}
          resizeMode="cover"
        />
        <Text style={styles.userName} numberOfLines={1}>
          {displayName}
        </Text>
        <TouchableOpacity style={styles.ctaBtn} onPress={onBecomeDeveloper} activeOpacity={0.8}>
          <Text style={styles.ctaBtnText}>
            {t(subscribed ? 'devSpace.renew' : 'developer.becomeDeveloper')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ② 开发者信息卡(行表驱动) */}
      {rows ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{t('developerInfo.title')}</Text>
          {rows.map((row) => (
            <InfoRow key={row.label} styles={styles} {...row} />
          ))}
        </View>
      ) : null}

      {/* ③ 四个功能入口(顺序即跨端表顺序) */}
      <View style={styles.entryRow}>
        {DEVELOPER_SPACE_ENTRIES.map((entry) => (
          <TouchableOpacity
            key={entry.id}
            style={styles.entryItem}
            onPress={() => onEntryPress(entry.id)}
            activeOpacity={0.7}
          >
            <View style={styles.iconWell}>
              <Image
                source={{ uri: entry.iconUrl }}
                style={styles.entryIcon}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.entryText}>{t(entry.labelKey)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ④ 问题解答卡 + 咨询客服 */}
      <View style={styles.faqSection}>
        <Text style={styles.faqHeading}>{t('devSpace.faqHeading')}</Text>
        {DEVELOPER_SPACE_PROBLEMS.map((problem) => (
          <TouchableOpacity
            key={problem.id}
            style={styles.problemCard}
            onPress={() => onProblemPress(problem.url)}
            activeOpacity={0.8}
          >
            <Text style={styles.problemTitle}>{t(problem.titleKey)}</Text>
            <Text style={styles.problemDesc}>{t(problem.descKey)}</Text>
            <View style={styles.problemBtn}>
              <Text style={styles.problemBtnText}>{t(problem.btnKey)}</Text>
            </View>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.contactCard}
          onPress={onContactService}
          activeOpacity={0.85}
        >
          <Text style={styles.contactTitle}>{t('devSpace.contactHeading')}</Text>
          <Text style={styles.contactDesc}>{t('devSpace.contactDesc')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

interface InfoRowProps extends InfoRowSpec {
  styles: ReturnType<typeof createDeveloperStyles>
}

function InfoRow({ styles, label, value, lines = 1, danger = false, action = null }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, danger && styles.dangerText]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.infoValue, danger && styles.dangerText]} numberOfLines={lines}>
        {value}
      </Text>
      {action ? (
        <TouchableOpacity onPress={action.onPress} hitSlop={8}>
          <Text style={[styles.infoAction, danger && styles.dangerText]}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}
