// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { aizhsUrl } from '@/constants/icon-urls'
import { useTt, type TtFn } from '@/i18n'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { cn, rnRadius, taroGeometry } from '@ihui/design-tokens'
import type { CSSProperties } from 'react'
import LineIcon from '@/components/LineIcon'
import { ICONS } from '@/components/LineIcon/icons'
// 图片内容(非 UI 图标)只有两枚:头部品牌 logo 与默认头像 —— 其余界面图标一律 LineIcon 矢量
// (O81 票:菜单/标签/设置/模型兜底图标从 CDN 位图收进矢量,与 RN 端 lucide 同一载体类)
const choutilogoH = aizhsUrl('remote-images/choutilogo_h.png')
const daixaodimingPng = aizhsUrl('remote-images/daixaodiming.png')
import { rpx } from '@/utils/rpx'
import { getTopBarMetrics } from '@/utils/system-info'

/**
 * DrawerComponent 抽屉组件
 *
 * 两种模式:
 * - 默认(side='bottom'):底部弹层(原实现,兼容 MaterialPopup / SkillsPopup / ranking 等)
 * - side='left'(首页专用):左侧抽屉,对齐原项目 DrawerComponentall.vue:
 *   - 宽 `taroGeometry.drawerWidth`(单源 250px ⇒ 500rpx),右圆角取 2xl 档
 *   - 头部 logo + 关闭按钮(矢量)
 *   - 5 个菜单项横排(应用商店/需求广场/灵感/动态/课程)
 *   - 3 个标签(我的一人公司/领取免费资料/创建新对话)
 *   - 历史对话列表(按模型 + 日期分组,scroll-y)
 *   - 底部用户信息(头像 + 昵称 + 设置/消息)
 *
 * 左侧抽屉内容通过 props(groupedData / userinfo / menuItems 等)传入,
 * 也支持 children 兜底渲染自定义内容。
 */

export interface DrawerChatItem {
  id: string | number
  title: string
  date: string
}

export interface DrawerDateGroup {
  date: string
  chats: DrawerChatItem[]
}

export interface DrawerModelGroup {
  modelName: string
  modelLogo?: string
  dateGroups: DrawerDateGroup[]
}

export interface DrawerMenuItem {
  key: string
  label: string
  icon?: string
}

export interface DrawerUserInfo {
  avatar?: string
  nickname?: string
}

export interface DrawerComponentProps {
  visible: boolean
  onClose?: () => void
  /** 底部弹层高度(side='bottom' 时生效) */
  height?: string
  /** 底部弹层点击遮罩是否关闭(默认 true) */
  maskClosable?: boolean
  /** 兜底自定义内容(默认走 children) */
  children?: React.ReactNode
  /** 抽屉方向:默认 'bottom'(兼容旧调用),首页传 'left' */
  side?: 'bottom' | 'left'

  // ===== side='left' 专用 props(首页)=====
  /** 状态栏高度(注入抽屉顶部 padding) */
  statusBarHeight?: number
  /** 抽屉 logo 图片 URL */
  logoUrl?: string
  /** 5 个菜单项(应用商店/需求广场/...) */
  menuItems?: DrawerMenuItem[]
  /** 3 个标签项(我的一人公司/领取资料/创建新对话)*/
  labelItems?: DrawerMenuItem[]
  /** 历史对话分组数据(按模型 + 日期) */
  groupedData?: DrawerModelGroup[]
  /** 当前选中对话 ID */
  activeChatId?: string | number
  /** 用户信息(底部显示) */
  userinfo?: DrawerUserInfo
  /** 菜单项点击回调 */
  onMenuItemClick?: (item: DrawerMenuItem) => void
  /** 标签项点击回调 */
  onLabelItemClick?: (item: DrawerMenuItem) => void
  /** 历史对话项点击回调 */
  onChatItemClick?: (chat: DrawerChatItem) => void
  /** 历史对话项删除回调(传入则显示删除按钮) */
  onRemoveChat?: (chat: DrawerChatItem) => void
  /** 创建新对话回调 */
  onCreateChat?: () => void
}

// 5 个菜单项图标走 LineIcon 矢量(O81 票:原 CDN 位图与 RN 端 lucide 载体不同类;
// 词表内无同名素材时取近义矢量 —— 应用商店→shopping-cart、需求广场→users、动态→share-2、课程→graduation-cap):
// shopping-cart(应用商店) / users(需求广场) / lightbulb(灵感) / share-2(动态) / graduation-cap(课程)
const DEFAULT_MENU_ITEMS = (tt: TtFn): DrawerMenuItem[] => [
  { key: 'appStore', label: tt('DrawerComponent.d1', '应用商店'), icon: 'shopping-cart' },
  { key: 'demand', label: tt('DrawerComponent.d2', '需求广场'), icon: 'users' },
  { key: 'inspiration', label: tt('aigcList.title', '灵感'), icon: 'lightbulb' },
  { key: 'dynamic', label: tt('bookmark.type.post', '动态'), icon: 'share-2' },
  { key: 'course', label: tt('coursePlanet.course', '课程'), icon: 'graduation-cap' },
]

// 3 个标签项图标同步矢量收口(一人公司→handshake 近义,领取资料→gift 与 RN Gift 同字,
// 创建新对话→message-square 维持):
const DEFAULT_LABEL_ITEMS = (tt: TtFn): DrawerMenuItem[] => [
  { key: 'company', label: tt('DrawerComponent.d3', '我的一人公司'), icon: 'handshake' },
  { key: 'freebie', label: tt('DrawerComponent.d4', '领取免费资料'), icon: 'gift' },
  { key: 'newChat', label: tt('DrawerComponent.d5', '创建新对话'), icon: 'message-square' },
]

export default function DrawerComponent(props: DrawerComponentProps) {
  const tt = useTt()
  const {
    visible,
    onClose,
    height = 'auto',
    maskClosable = true,
    children,
    side = 'bottom',
    // 兜底值不再自带一份 20 —— 全端状态栏高度只有 utils/system-info.ts 一个出口
    // (实测该 20 ≠ 真机 34dp,取值失败即与系统时钟叠字)
    statusBarHeight = getTopBarMetrics().statusBarHeight,
    logoUrl,
    menuItems = DEFAULT_MENU_ITEMS(tt),
    labelItems = DEFAULT_LABEL_ITEMS(tt),
    groupedData = [],
    activeChatId,
    userinfo,
    onMenuItemClick,
    onLabelItemClick,
    onChatItemClick,
    onRemoveChat,
    onCreateChat,
  } = props

  if (!visible) return null

  const handleMaskClick = () => {
    if (maskClosable) onClose?.()
  }

  const handleStop = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
  }

  // 菜单/标签图标渲染:LineIcon 名 → 主题着色;否则视为图片路径
  const renderIcon = (icon: string, size: number, extraStyle?: CSSProperties) => {
    if ((ICONS as Record<string, unknown>)[icon]) {
      return (
        <LineIcon
          name={icon as never}
          size={size}
          color="var(--color-muted-foreground)"
          style={extraStyle}
        />
      )
    }
    return (
      <Image
        src={icon}
        style={{ width: rpx(size), height: rpx(size), ...extraStyle }}
        mode="aspectFit"
      />
    )
  }

  if (side === 'left') {
    // ===== 左侧抽屉模式:对齐原项目 DrawerComponentall.vue =====
    return (
      <View className="fixed inset-0 z-[1005]" onClick={handleMaskClick}>
        {/* 遮罩:var(--color-black-40) */}
        <View className="absolute inset-0" style={{ background: 'var(--color-black-40)' }} />
        {/* 抽屉主体:宽 500rpx + 圆角 0 30rpx 30rpx 0 + 高 100vh */}
        <View
          className={cn(
            'ai-drawer-border absolute top-0 bottom-0 left-0 flex flex-col',
            visible ? 'ai-drawer-border-visible' : 'ai-drawer-border-hidden',
          )}
          style={{
            width: rpx(taroGeometry.drawerWidth),
            background: 'var(--color-card)',
            borderTopLeftRadius: 0,
            borderTopRightRadius: rnRadius['2xl'],
            borderBottomRightRadius: rnRadius['2xl'],
            borderBottomLeftRadius: 0,
            paddingTop: `${statusBarHeight}px`,
            overflow: 'hidden',
          }}
          onClick={handleStop}
          hoverClass="opacity-60"
        >
          {/* 头部:logo + 关闭按钮 */}
          <View
            className="flex items-center justify-between"
            style={{ padding: '15rpx 28rpx 25rpx' }}
          >
            <View className="flex items-center">
              {logoUrl ? (
                <Image src={logoUrl} style={{ height: rpx(66) }} mode="heightFix" />
              ) : (
                <Image src={choutilogoH} style={{ height: rpx(66) }} mode="heightFix" />
              )}
            </View>
            <LineIcon
              name="x"
              size={taroGeometry.glyphMd}
              color="var(--color-muted-foreground)"
              onClick={onClose}
            />
          </View>

          {/* 5 个菜单项横排(应用商店/需求广场/灵感/动态/课程)*/}
          <View className="flex justify-between" style={{ padding: '15rpx 28rpx 25rpx' }}>
            {menuItems.map((item) => (
              <View
                key={item.key}
                className="flex flex-col items-center justify-center"
                onClick={() => onMenuItemClick?.(item)}
                hoverClass="opacity-60"
              >
                {item.icon ? (
                  renderIcon(item.icon, 60)
                ) : (
                  // 缺图兜底不得用字符「•」冒充图标 —— 同一载体类:矢量 circle
                  <LineIcon name="circle" size={60} color="var(--color-muted-foreground)" />
                )}
                <Text
                  className="mt-[8rpx]"
                  style={{ fontSize: rpx(taroGeometry.textLabel), color: 'var(--color-foreground)' }}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>

          {/* 3 个标签项(我的一人公司/领取资料/创建新对话)*/}
          <View className="flex flex-col">
            {labelItems.map((item) => (
              <View
                key={item.key}
                className="flex items-center"
                style={{
                  fontSize: rpx(taroGeometry.textBody),
                  lineHeight: rpx(56),
                  color: 'var(--color-foreground)',
                  padding: '4rpx 28rpx',
                }}
                onClick={() => {
                  if (item.key === 'newChat') {
                    onCreateChat?.()
                  } else {
                    onLabelItemClick?.(item)
                  }
                }}
                hoverClass="opacity-60"
              >
                {item.icon ? renderIcon(item.icon, 36, { marginRight: rpx(12) }) : null}
                <Text className="flex-1">{item.label}</Text>
                {/* 入口箭头 = 矢量,与 RN 端 ChevronRight 同档(glyphSm),禁止字符 › » 冒充 */}
                <LineIcon
                  name="chevron-right"
                  size={taroGeometry.glyphSm}
                  color="var(--color-muted-foreground)"
                />
              </View>
            ))}
          </View>

          {/* 历史对话标题 */}
          <View style={{ padding: '20rpx 23rpx 10rpx' }}>
            <Text
              className="font-bold"
              style={{
                fontSize: rpx(taroGeometry.textBody),
                color: 'var(--color-foreground)',
              }}
            >
              {tt('share.index.history', '历史对话')}
            </Text>
          </View>

          {/* 历史对话列表:scroll-y,按模型 + 日期分组 */}
          <ScrollView scrollY className="flex-1">
            {groupedData.length === 0 ? (
              <View style={{ padding: '40rpx 23rpx' }} className="text-center">
                <Text
                  style={{ fontSize: rpx(taroGeometry.textLabel), color: 'var(--color-muted-foreground)' }}
                >
                  {tt('DrawerComponent.empty1', '暂无历史对话')}
                </Text>
              </View>
            ) : (
              groupedData.map((modelGroup) => (
                <View key={modelGroup.modelName}>
                  {/* 模型标题:有官方 modelLogo 用图,兜底改矢量 bot(与 RN 端 Bot 同字),不再拿位图冒充图标 */}
                  <View className="inline-flex items-center" style={{ padding: '10rpx 23rpx' }}>
                    {modelGroup.modelLogo ? (
                      <Image
                        src={modelGroup.modelLogo}
                        style={{ width: rpx(taroGeometry.glyphMd), height: rpx(taroGeometry.glyphMd) }}
                        mode="aspectFit"
                      />
                    ) : (
                      <LineIcon
                        name="bot"
                        size={taroGeometry.glyphMd}
                        color="var(--color-muted-foreground)"
                      />
                    )}
                    <Text
                      className="font-bold ml-[10rpx]"
                      style={{
                        fontSize: rpx(taroGeometry.textLabel),
                        color: 'var(--color-muted-foreground)',
                      }}
                    >
                      {modelGroup.modelName}
                    </Text>
                  </View>
                  {/* 日期分组 */}
                  {modelGroup.dateGroups.map((dateGroup) => (
                    <View key={dateGroup.date}>
                      <View style={{ padding: '10rpx 23rpx' }}>
                        <Text
                          style={{
                            fontSize: rpx(taroGeometry.textCaption),
                            color: 'var(--color-muted-foreground)',
                          }}
                        >
                          {dateGroup.date}
                        </Text>
                      </View>
                      {/* 对话项 */}
                      {dateGroup.chats.map((chat) => {
                        const isActive = chat.id === activeChatId
                        return (
                          <View
                            key={chat.id}
                            className={cn(
                              'flex items-center justify-between',
                              isActive && 'ai-menu-item-active',
                            )}
                            style={{ padding: '20rpx 23rpx' }}
                            onClick={() => onChatItemClick?.(chat)}
                            hoverClass="opacity-60"
                          >
                            <Text
                              className="truncate flex-1"
                              style={{
                                fontSize: rpx(taroGeometry.textBody),
                                color: isActive
                                  ? 'var(--color-primary)'
                                  : 'var(--color-foreground)',
                                fontWeight: isActive ? 'bold' : 'normal',
                              }}
                            >
                              {chat.title}
                            </Text>
                            {onRemoveChat ? (
                              // 删除键载体 = 矢量(RN 端左滑删除同为矢量),文字 × 冒充图标已收口
                              <LineIcon
                                name="x"
                                size={taroGeometry.controlGlyph}
                                color="var(--color-muted-foreground)"
                                className="flex-shrink-0 ml-[12rpx]"
                                style={{ padding: '0 8rpx' }}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onRemoveChat(chat)
                                }}
                              />
                            ) : null}
                          </View>
                        )
                      })}
                    </View>
                  ))}
                </View>
              ))
            )}
          </ScrollView>

          {/* 底部用户信息 */}
          {userinfo ? (
            <View
              className="flex items-center justify-between"
              style={{
                padding: '12rpx 13rpx',
                background: 'var(--color-card)',
              }}
            >
              <View className="flex items-center">
                {/* 头像 = 真圆族:与 RN 端 rounded-full 同形;正方盒(60×60)+ 50% 由守门 77 量形放行 */}
                <Image
                  src={userinfo.avatar || daixaodimingPng}
                  style={{ width: rpx(60), height: rpx(60), borderRadius: '50%' }}
                  mode="aspectFill"
                />
                <Text
                  className="ml-[12rpx]"
                  style={{ fontSize: rpx(taroGeometry.textStrong), color: 'var(--color-foreground)' }}
                >
                  {userinfo.nickname || tt('profileEdit.notLoggedIn', '未登录')}
                </Text>
              </View>
              <View className="flex items-center gap-[16rpx]">
                <LineIcon
                  name="settings"
                  size={taroGeometry.glyphMd}
                  color="var(--color-muted-foreground)"
                />
                <LineIcon
                  name="message-circle"
                  size={taroGeometry.glyphMd}
                  color="var(--color-muted-foreground)"
                />
              </View>
            </View>
          ) : null}
        </View>
      </View>
    )
  }

  // ===== 默认模式:底部弹层(兼容 MaterialPopup / SkillsPopup / ranking)=====
  return (
    <View className="fixed inset-0 z-[90] flex flex-col justify-end">
      <View
        className="absolute inset-0 bg-[var(--color-black-40)] transition-opacity"
        onClick={handleMaskClick}
      />
      <View
        className="relative bg-card ui-card rounded-t-lg overflow-hidden transition-transform"
        style={{ maxHeight: '80vh', height }}
        onClick={handleStop}
        hoverClass="opacity-60"
      >
        <View className="flex justify-center pt-2 pb-1">
          <View className="w-9 h-1 rounded-lg bg-muted" />
        </View>
        {children}
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
