/**
 * AiModelCard AI 模型卡片 (mobile-rn 端)
 * 展示 AI 模型信息:名称/描述/图标/标签/用户类型/购买详情/操作栏
 * 迁移自旧项目 Vue 组件 (Ai-WXMiniVue/src/components/AiModelCard/index.vue)
 *
 * 2026-07-28 重构:硬编码颜色改用 @ihui/rn-app 的 tokens.* 统一管理。
 * 2026-08-16 复刻补齐(对齐原版 index.vue):
 *   - group 底部操作栏(官方标识 + 5 图标:警告/踩/收藏/信息/分享)
 *   - 购买详情展开面板(订单号/购买时间/到期时间/金额)
 *   - model 模式「设置」按钮
 *   - 用户类型图片徽章(可选 userTypeIcons,缺省回退文字徽章)
 *
 * 共享类型 AiModelData / AiModelUserType 已下沉到 @ihui/types。
 * 本地 Props 用 `data: AiModelData` 对象结构,与 miniapp-taro 扁平 props 结构不同,
 * 不 extends AiModelCardMinimalProps(该 Minimal 仅作语义参考)。
 */
import { useState } from 'react'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { AiModelData, AiModelUserType } from '@ihui/types'

// 共享类型已下沉到 @ihui/types,本地 re-export 保持调用方兼容
// (ModelUserType 重命名为 AiModelUserType 以避免与 legacy-migration ModelType 冲突,
//  本地保留 ModelUserType 别名维持向后兼容)
export type { AiModelData }
export type ModelUserType = AiModelUserType
export type { AiModelUserType }

export interface AiModelCardProps {
  data: AiModelData
  type?: 'view' | 'buy'
  /** 根模式:group(社区卡片,含底部操作栏)/model(模型卡片,含设置按钮),缺省 group(对齐原版 root 默认值) */
  root?: 'group' | 'model'
  onPress?: (data: AiModelData) => void
  onBuyPress?: (data: AiModelData) => void
  /** 购买详情展开/收起(预留:可接后端订单详情拉取,组件内保留本地展开状态) */
  onDetailPress?: (data: AiModelData, expanded: boolean) => void
  /** group 操作栏:警告 */
  onWarningPress?: (data: AiModelData) => void
  /** group 操作栏:踩/取消赞 */
  onDislikePress?: (data: AiModelData) => void
  /** group 操作栏:收藏/取消收藏 */
  onFavoritePress?: (data: AiModelData) => void
  /** group 操作栏:信息 */
  onInfoPress?: (data: AiModelData) => void
  /** group 操作栏:分享 */
  onSharePress?: (data: AiModelData) => void
  /** model 模式:设置按钮 */
  onSettingPress?: (data: AiModelData) => void
  /** 用户类型图片徽章(key: AiModelUserType,value: 图片 URI;缺省回退文字徽章) */
  userTypeIcons?: Partial<Record<AiModelUserType, string>>
}

const USER_TYPE_LABEL: Record<AiModelUserType, string> = {
  freevip: '会员免费',
  freeuse: '免费使用',
  freetime: '限时免费',
  hasbuy: '已购买',
  buymonth: '包月',
  none: '',
}

// group 底部操作栏 5 图标(对齐原版 warning/unlike/unstore/uninfo/unshare)
const GROUP_ACTIONS: Array<{
  key: 'warning' | 'dislike' | 'favorite' | 'info' | 'share'
  glyph: string
  label: string
}> = [
  { key: 'warning', glyph: '⚠️', label: '警告' },
  { key: 'dislike', glyph: '👎', label: '踩' },
  { key: 'favorite', glyph: '🔖', label: '收藏' },
  { key: 'info', glyph: 'ℹ️', label: '信息' },
  { key: 'share', glyph: '📤', label: '分享' },
]

export default function AiModelCard({
  data,
  type = 'view',
  root = 'group',
  onPress,
  onBuyPress,
  onDetailPress,
  onWarningPress,
  onDislikePress,
  onFavoritePress,
  onInfoPress,
  onSharePress,
  onSettingPress,
  userTypeIcons,
}: AiModelCardProps) {
  const [details, setDetails] = useState(false)
  const userType = data.userType ?? 'none'
  const userLabel = USER_TYPE_LABEL[userType]
  const hasTags = data.tags && data.tags.length > 0

  // 购买详情字段(legacy 动态字段,通过 AiModelData 索引签名读取)
  const payid = data.payid as string | number | undefined
  const startTime = data.startTime as string | undefined
  const endTime = data.endTime as string | undefined
  const money = data.money as string | number | undefined
  const hasDetail = Boolean(payid || startTime || endTime || money)

  const toggleDetail = () => {
    const next = !details
    setDetails(next)
    onDetailPress?.(data, next)
  }

  const actionCallbacks: Record<string, ((d: AiModelData) => void) | undefined> = {
    warning: onWarningPress,
    dislike: onDislikePress,
    favorite: onFavoritePress,
    info: onInfoPress,
    share: onSharePress,
  }

  const userTypeIcon = userTypeIcons?.[userType]

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={() => onPress?.(data)}>
      {/* 顶部:图标 + 名称/描述/人数 */}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          {data.icon ? (
            <Image source={{ uri: data.icon }} style={styles.icon} />
          ) : (
            <Text style={styles.iconFallback}>{(data.name || 'A').slice(0, 1)}</Text>
          )}
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {data.name}
          </Text>
          {data.subname ? (
            <Text style={styles.subname} numberOfLines={1}>
              {data.subname}
            </Text>
          ) : null}
        </View>
        {data.mumber !== undefined ? <Text style={styles.mumber}>{data.mumber}</Text> : null}
      </View>

      {/* 标签(用 gap-* 分隔) */}
      {hasTags ? (
        <View style={styles.tagsWrap}>
          {data.tags!.map((tag, idx) => (
            <View key={idx} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* 用户类型徽章(图片优先,缺省回退文字) */}
      {userTypeIcon ? (
        <View style={styles.badgeRow}>
          <Image source={{ uri: userTypeIcon }} style={styles.userTypeIcon} resizeMode="contain" />
        </View>
      ) : userLabel ? (
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{userLabel}</Text>
          </View>
        </View>
      ) : null}

      {/* group: 底部操作栏(官方标识 + 5 图标 + 购买详情/购买) */}
      {root === 'group' ? (
        <View style={styles.groupFooter}>
          <View style={styles.groupFooterLeft}>
            <View style={styles.groupLogo} />
            <Text style={styles.groupFooterText} numberOfLines={1}>
              智汇社区-官方
            </Text>
          </View>
          <View style={styles.groupFooterRight}>
            {GROUP_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.key}
                activeOpacity={0.7}
                onPress={() => actionCallbacks[action.key]?.(data)}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <Text style={styles.groupActionIcon} allowFontScaling={false}>
                  {action.glyph}
                </Text>
              </TouchableOpacity>
            ))}
            {type === 'buy' ? (
              <TouchableOpacity
                style={styles.buyBtn}
                activeOpacity={0.7}
                onPress={() => onBuyPress?.(data)}
              >
                <Text style={styles.buyBtnText}>购买</Text>
              </TouchableOpacity>
            ) : hasDetail ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={toggleDetail}
                style={styles.payDetailRow}
              >
                <Text style={styles.payDetailText}>购买详情</Text>
                <Text style={styles.payDetailArrow}>{details ? '▴' : '▾'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* model: 设置按钮 */}
      {root === 'model' ? (
        <View style={styles.modelFooter}>
          <TouchableOpacity
            style={styles.settingBtn}
            activeOpacity={0.7}
            onPress={() => onSettingPress?.(data)}
          >
            <Text style={styles.settingBtnText}>设置</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* 购买详情展开面板(订单号/时间/金额) */}
      {details && hasDetail ? (
        <View style={styles.detailPanel}>
          {payid !== undefined ? <Text style={styles.detailText}>关联订单号：{payid}</Text> : null}
          {startTime || endTime ? (
            <Text style={styles.detailText}>
              购买时间：{startTime ?? '-'}
              {endTime ? `　到期时间：${endTime}` : ''}
            </Text>
          ) : null}
          {money !== undefined ? (
            <View style={styles.detailMoneyRow}>
              <Text style={styles.detailText}>购买金额</Text>
              <Text style={styles.detailMoney}>￥{money}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.surface.light,
    borderWidth: 1,
    borderColor: tokens.border.light,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  icon: {
    width: 48,
    height: 48,
    resizeMode: 'cover',
  },
  iconFallback: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.brand.DEFAULT,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: tokens.brand.DEFAULT,
    marginBottom: 4,
  },
  subname: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  mumber: {
    fontSize: 10,
    color: tokens.text.secondary,
    marginLeft: 8,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: tokens.surface.card,
    borderRadius: 2,
  },
  tagText: {
    fontSize: 11,
    color: tokens.brand.DEFAULT,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: tokens.warning.light,
    borderRadius: 2,
  },
  badgeText: {
    fontSize: 11,
    color: tokens.warning.DEFAULT,
  },
  userTypeIcon: {
    height: 20,
    width: 80,
  },
  groupFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: tokens.border.light,
  },
  groupFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  groupLogo: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: tokens.brand.DEFAULT,
    marginRight: 6,
  },
  groupFooterText: {
    fontSize: 12,
    color: tokens.text.secondary,
  },
  groupFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupActionIcon: {
    fontSize: 16,
    marginLeft: 12,
  },
  payDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  payDetailText: {
    fontSize: 12,
    color: tokens.brand.DEFAULT,
    borderBottomWidth: 1,
    borderBottomColor: tokens.brand.DEFAULT,
  },
  payDetailArrow: {
    fontSize: 12,
    color: tokens.brand.DEFAULT,
    marginLeft: 2,
  },
  buyBtn: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: tokens.brand.DEFAULT,
    borderRadius: 6,
  },
  buyBtnText: {
    fontSize: 12,
    color: tokens.surface.light,
    fontWeight: '500',
  },
  modelFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: tokens.border.light,
  },
  settingBtn: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: tokens.border.medium,
    borderRadius: 6,
  },
  settingBtnText: {
    fontSize: 14,
    color: tokens.brand.DEFAULT,
  },
  detailPanel: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: tokens.border.light,
  },
  detailText: {
    fontSize: 12,
    color: tokens.text.medium,
    marginBottom: 6,
  },
  detailMoneyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  detailMoney: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.brand.DEFAULT,
  },
})
