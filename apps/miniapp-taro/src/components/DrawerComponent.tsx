import { View, Text, ScrollView, Image } from '@tarojs/components'
import { cn } from '@ihui/design-tokens'
// 抽屉静态资源(SVG 走 Vite base64 内联,PNG 走 Taro copy.patterns 静态拷贝)
import choutilogoH from '@/static/images/choutilogo_h.png'
import closeDrawerSvg from '@/static/images/close_drawer.svg'
import newchatSvg from '@/static/images/newchat.svg'
import drawerMenu1Png from '@/static/images/drawer_menu1.png'
import drawerMenu2Png from '@/static/images/drawer_menu2.png'
import drawerMenu4Png from '@/static/images/drawer_menu4.png'
import drawerMenu5Png from '@/static/images/drawer_menu5.png'

/**
 * DrawerComponent 抽屉组件
 *
 * 两种模式:
 * - 默认(side='bottom'):底部弹层(原实现,兼容 MaterialPopup / SkillsPopup / ranking 等)
 * - side='left'(首页专用):左侧抽屉,对齐原项目 DrawerComponentall.vue:
 *   - 宽 500rpx,圆角 0 30rpx 30rpx 0
 *   - 头部 logo + 关闭按钮
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
  /** 创建新对话回调 */
  onCreateChat?: () => void
}

const DEFAULT_MENU_ITEMS: DrawerMenuItem[] = [
  { key: 'appStore', label: '应用商店', icon: drawerMenu1Png },
  { key: 'demand', label: '需求广场', icon: drawerMenu2Png },
  { key: 'inspiration', label: '灵感', icon: drawerMenu4Png },
  { key: 'dynamic', label: '动态', icon: drawerMenu5Png },
  { key: 'course', label: '课程', icon: drawerMenu4Png },
]

const DEFAULT_LABEL_ITEMS: DrawerMenuItem[] = [
  { key: 'company', label: '我的一人公司' },
  { key: 'freebie', label: '领取免费资料' },
  { key: 'newChat', label: '创建新对话', icon: newchatSvg },
]

export default function DrawerComponent(props: DrawerComponentProps) {
  const {
    visible,
    onClose,
    height = 'auto',
    maskClosable = true,
    children,
    side = 'bottom',
    statusBarHeight = 20,
    logoUrl,
    menuItems = DEFAULT_MENU_ITEMS,
    labelItems = DEFAULT_LABEL_ITEMS,
    groupedData = [],
    activeChatId,
    userinfo,
    onMenuItemClick,
    onLabelItemClick,
    onChatItemClick,
    onCreateChat,
  } = props

  if (!visible) return null

  const handleMaskClick = () => {
    if (maskClosable) onClose?.()
  }

  const handleStop = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
  }

  if (side === 'left') {
    // ===== 左侧抽屉模式:对齐原项目 DrawerComponentall.vue =====
    return (
      <View className="fixed inset-0 z-[1005]" onClick={handleMaskClick}>
        {/* 遮罩:rgba(0,0,0,0.4) */}
        <View
          className="absolute inset-0"
          style={{ background: 'rgba(0, 0, 0, 0.4)' }}
        />
        {/* 抽屉主体:宽 500rpx + 圆角 0 30rpx 30rpx 0 + 高 100vh */}
        <View
          className={cn(
            'ai-drawer-border absolute top-0 bottom-0 left-0 flex flex-col',
            visible ? 'ai-drawer-border-visible' : 'ai-drawer-border-hidden',
          )}
          style={{
            width: '500rpx',
            background: 'var(--color-card)',
            borderRadius: '0 30rpx 30rpx 0',
            paddingTop: `${statusBarHeight}px`,
            overflow: 'hidden',
          }}
          onClick={handleStop}
        >
          {/* 头部:logo + 关闭按钮 */}
          <View className="flex items-center justify-between" style={{ padding: '15rpx 28rpx 25rpx' }}>
            <View className="flex items-center">
              {logoUrl ? (
                <Image src={logoUrl} style={{ height: '66rpx' }} mode="heightFix" />
              ) : (
                <Image src={choutilogoH} style={{ height: '66rpx' }} mode="heightFix" />
              )}
            </View>
            <Image
              src={closeDrawerSvg}
              style={{ width: '40rpx', height: '40rpx' }}
              mode="aspectFit"
              onClick={onClose}
            />
          </View>

          {/* 5 个菜单项横排(应用商店/需求广场/灵感/动态/课程)*/}
          <View
            className="flex justify-between"
            style={{ padding: '15rpx 28rpx 25rpx' }}
          >
            {menuItems.map((item) => (
              <View
                key={item.key}
                className="flex flex-col items-center justify-center"
                onClick={() => onMenuItemClick?.(item)}
              >
                {item.icon ? (
                  <Image
                    src={item.icon}
                    style={{ width: '60rpx', height: '60rpx' }}
                    mode="aspectFit"
                  />
                ) : (
                  <Text style={{ width: '60rpx', height: '60rpx', fontSize: '36rpx' }}>•</Text>
                )}
                <Text
                  className="mt-[8rpx]"
                  style={{ fontSize: '24rpx', color: 'var(--color-foreground)' }}
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
                  fontSize: '28rpx',
                  lineHeight: '56rpx',
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
              >
                {item.icon ? (
                  <Image
                    src={item.icon}
                    style={{ width: '36rpx', height: '36rpx', marginRight: '12rpx' }}
                    mode="aspectFit"
                  />
                ) : null}
                <Text>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* 历史对话标题 */}
          <View style={{ padding: '20rpx 23rpx 10rpx' }}>
            <Text
              className="font-bold"
              style={{ fontSize: '28rpx', color: 'var(--color-text-drawer, var(--color-foreground))' }}
            >
              历史对话
            </Text>
          </View>

          {/* 历史对话列表:scroll-y,按模型 + 日期分组 */}
          <ScrollView scrollY className="flex-1">
            {groupedData.length === 0 ? (
              <View style={{ padding: '40rpx 23rpx' }} className="text-center">
                <Text style={{ fontSize: '24rpx', color: 'var(--color-muted-foreground)' }}>
                  暂无历史对话
                </Text>
              </View>
            ) : (
              groupedData.map((modelGroup) => (
                <View key={modelGroup.modelName}>
                  {/* 模型标题 */}
                  <View
                    className="inline-flex items-center"
                    style={{ padding: '10rpx 23rpx' }}
                  >
                    {modelGroup.modelLogo ? (
                      <Image
                        src={modelGroup.modelLogo}
                        style={{ width: '40rpx', height: '40rpx' }}
                        mode="aspectFit"
                      />
                    ) : null}
                    <Text
                      className="font-bold ml-[10rpx]"
                      style={{ fontSize: '28rpx', color: 'var(--color-muted-foreground)' }}
                    >
                      {modelGroup.modelName}
                    </Text>
                  </View>
                  {/* 日期分组 */}
                  {modelGroup.dateGroups.map((dateGroup) => (
                    <View key={dateGroup.date}>
                      <View style={{ padding: '10rpx 23rpx' }}>
                        <Text style={{ fontSize: '22rpx', color: 'var(--color-text-date, var(--color-muted-foreground))' }}>
                          {dateGroup.date}
                        </Text>
                      </View>
                      {/* 对话项 */}
                      {dateGroup.chats.map((chat) => {
                        const isActive = chat.id === activeChatId
                        return (
                          <View
                            key={chat.id}
                            className={cn('flex items-center justify-between', isActive && 'ai-menu-item-active')}
                            style={{ padding: '20rpx 23rpx' }}
                            onClick={() => onChatItemClick?.(chat)}
                          >
                            <Text
                              className="truncate"
                              style={{
                                fontSize: '30rpx',
                                color: isActive
                                  ? 'var(--color-text-selected, #0d11fc)'
                                  : 'var(--color-foreground)',
                                fontWeight: isActive ? 'bold' : 'normal',
                              }}
                            >
                              {chat.title}
                            </Text>
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
                borderTop: '1px solid rgba(239, 239, 239, 0.18)',
              }}
            >
              <View className="flex items-center">
                {userinfo.avatar ? (
                  <Image
                    src={userinfo.avatar}
                    style={{ width: '60rpx', height: '60rpx', borderRadius: '8rpx' }}
                    mode="aspectFill"
                  />
                ) : null}
                <Text
                  className="ml-[12rpx]"
                  style={{ fontSize: '28rpx', color: 'var(--color-foreground)' }}
                >
                  {userinfo.nickname || '未登录'}
                </Text>
              </View>
              <View className="flex items-center gap-[16rpx]">
                <Text style={{ fontSize: '32rpx', color: 'var(--color-foreground)' }}>⚙</Text>
                <Text style={{ fontSize: '32rpx', color: 'var(--color-foreground)' }}>✉</Text>
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
      <View className="absolute inset-0 bg-black/40 transition-opacity" onClick={handleMaskClick} />
      <View
        className="relative bg-card rounded-t-xl overflow-hidden transition-transform"
        style={{ maxHeight: '80vh', height }}
        onClick={handleStop}
      >
        <View className="flex justify-center pt-2 pb-1">
          <View className="w-9 h-1 rounded-lg bg-muted" />
        </View>
        {children}
      </View>
    </View>
  )
}
