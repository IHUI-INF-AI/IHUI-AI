// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'
import { rpx } from '../utils/rpx'

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
import {
  AlertTriangle,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Info,
  Share2,
  ThumbsDown,
  type LucideIcon,
} from 'lucide-react-native'
import { tokens } from '../theme/active-tokens'
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import type { AiModelData, AiModelUserType } from '@ihui/types'
import { useI18n } from '../i18n'

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
  /** 收藏状态(2026-10-15 接真后端:已收藏时书签图标高亮) */
  favorited?: boolean
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
  glyph: LucideIcon
  label: string
}> = [
  { key: 'warning', glyph: AlertTriangle, label: '警告' },
  { key: 'dislike', glyph: ThumbsDown, label: '踩' },
  { key: 'favorite', glyph: Bookmark, label: '收藏' },
  { key: 'info', glyph: Info, label: '信息' },
  { key: 'share', glyph: Share2, label: '分享' },
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
  favorited,
  onSettingPress,
  userTypeIcons,
}: AiModelCardProps) {
  const { t } = useI18n()
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

      {/* 标签 + 用户类型徽章合并单行(2026-10-15 样式修复:原两行信息重复,合并节省竖向空间) */}
      {hasTags || userTypeIcon || userLabel ? (
        <View style={styles.metaRow}>
          {hasTags
            ? data.tags!.map((tag, idx) => (
                <View key={idx} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))
            : null}
          {userTypeIcon ? (
            <Image
              source={{ uri: userTypeIcon }}
              style={[styles.userTypeIcon, styles.metaBadge]}
              resizeMode="contain"
            />
          ) : userLabel ? (
            <View style={[styles.badge, styles.metaBadge]}>
              <Text style={styles.badgeText}>{userLabel}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* group: 底部操作栏(官方标识 + 5 图标 + 购买详情/购买) */}
      {root === 'group' ? (
        <View style={styles.groupFooter}>
          <View style={styles.groupFooterLeft}>
            <View style={styles.groupLogo}>
              {/* 官方徽标字(品牌字标不翻译,5 语言同值;原硬编码由守门 70 拦截改走语言包) */}
              <Text style={styles.groupLogoText}>{t('modelPlaza.officialBadge')}</Text>
            </View>
            <Text style={styles.groupFooterText} numberOfLines={1}>
              智汇社区-官方
            </Text>
          </View>
          <View style={styles.groupFooterRight}>
            {GROUP_ACTIONS.map((action) => (
              <TouchableOpacity
                key={action.key}
                activeOpacity={0.7}
                style={styles.actionBtn}
                onPress={() => actionCallbacks[action.key]?.(data)}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <action.glyph
                  size={16}
                  color={
                    action.key === 'favorite' && favorited
                      ? tokens.brand.DEFAULT
                      : tokens.text.secondary
                  }
                  fill={action.key === 'favorite' && favorited ? tokens.brand.DEFAULT : 'none'}
                />
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
                {details ? (
                  <ChevronUp size={12} color={tokens.brand.DEFAULT} style={{ marginLeft: 2 }} />
                ) : (
                  <ChevronDown size={12} color={tokens.brand.DEFAULT} style={{ marginLeft: 2 }} />
                )}
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
    backgroundColor: tokens.surface.card,
    borderWidth: 1,
    borderColor: tokens.border.light,
    borderRadius: rnRadius.lg,
    // 2026-10-15 样式修复:padding 走 rpx(12dp=24rpx);marginBottom 删除——
    // 卡片外留白由调用方 wrap 统一控制(HomeScreen aiModelWrap 已有 paddingVertical)
    padding: rpx(24),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: rpx(96),
    height: rpx(96),
    borderRadius: rnRadius.xl,
    // 原为 surface.card(与卡片底同色,头像区视觉消失)→ 改 muted 与卡片区分
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: rpx(24),
    overflow: 'hidden',
  },
  icon: {
    width: rpx(96),
    height: rpx(96),
    resizeMode: 'cover',
  },
  iconFallback: {
    fontSize: rpx(32),
    fontWeight: '600',
    color: tokens.brand.DEFAULT,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: rpx(32),
    fontWeight: '500',
    color: tokens.brand.DEFAULT,
    marginBottom: rpx(8),
  },
  subname: {
    fontSize: rpx(24),
    color: tokens.text.secondary,
  },
  mumber: {
    fontSize: rpx(20),
    color: tokens.text.secondary,
    marginLeft: rpx(16),
  },
  // 标签 + 用户类型徽章合并单行(原两行信息重复)
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: rpx(12),
    marginTop: rpx(20),
  },
  tag: {
    paddingHorizontal: rpx(16),
    paddingVertical: rpx(4),
    backgroundColor: tokens.surface.card,
    borderRadius: rnRadius.md,
  },
  tagText: {
    fontSize: rpx(22),
    color: tokens.brand.DEFAULT,
  },
  badge: {
    paddingHorizontal: rpx(16),
    paddingVertical: rpx(4),
    backgroundColor: tokens.warning.light,
    borderRadius: rnRadius.md,
  },
  badgeText: {
    fontSize: rpx(22),
    color: tokens.warning.DEFAULT,
  },
  // 徽章推到行尾(与 tags 同行时右对齐)
  metaBadge: {
    marginLeft: 'auto',
  },
  userTypeIcon: {
    height: rpx(40),
    width: rpx(160),
  },
  groupFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: rpx(24),
    paddingTop: rpx(20),
    borderTopWidth: 1,
    borderTopColor: tokens.border.light,
  },
  groupFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  // 官方徽标(原为无内容空色块 → 内嵌「智」字标识)
  groupLogo: {
    width: rpx(36),
    height: rpx(36),
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brand.cta,
    marginRight: rpx(12),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  groupLogoText: {
    fontSize: rpx(24),
    fontWeight: '600',
    color: tokens.brand.ctaForeground,
  },
  groupFooterText: {
    fontSize: rpx(24),
    color: tokens.text.secondary,
  },
  groupFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // 操作按钮扩触控区至 ≥32pt(原命中区仅 16×16 图标本体,远低于最低触控标准)
  actionBtn: {
    padding: rpx(8),
  },
  payDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: rpx(24),
  },
  payDetailText: {
    fontSize: rpx(24),
    color: tokens.brand.DEFAULT,
    borderBottomWidth: 1,
    // 下划线取墨档(brand.DEFAULT 亮=纯黑)同样属"纯黑描边"这一型(R8 的 border\w* 就是为
    // 这种非 borderColor 拼法留的口子);链接下划线一律走强调档,文字本身仍是墨色
    borderBottomColor: tokens.brandAccent.deep,
  },
  payDetailArrow: {
    fontSize: rpx(24),
    color: tokens.brand.DEFAULT,
    marginLeft: rpx(4),
  },
  buyBtn: {
    marginLeft: rpx(24),
    paddingHorizontal: rpx(24),
    paddingVertical: rpx(8),
    backgroundColor: tokens.brand.cta,
    borderRadius: rnRadius.sm,
  },
  buyBtnText: {
    fontSize: rpx(24),
    color: tokens.brand.ctaForeground,
    fontWeight: '500',
  },
  modelFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: rpx(24),
    paddingTop: rpx(20),
    borderTopWidth: 1,
    borderTopColor: tokens.border.light,
  },
  settingBtn: {
    paddingHorizontal: rpx(32),
    paddingVertical: rpx(10),
    borderWidth: 1,
    borderColor: tokens.border.medium,
    borderRadius: rnRadius.sm,
  },
  settingBtnText: {
    fontSize: rpx(28),
    color: tokens.brand.DEFAULT,
  },
  detailPanel: {
    marginTop: rpx(24),
    paddingTop: rpx(20),
    borderTopWidth: 1,
    borderTopColor: tokens.border.light,
  },
  detailText: {
    fontSize: rpx(24),
    color: tokens.text.medium,
    marginBottom: rpx(12),
  },
  detailMoneyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: rpx(8),
  },
  detailMoney: {
    fontSize: rpx(32),
    fontWeight: '600',
    color: tokens.brand.DEFAULT,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
