// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { aizhsUrl } from '@/constants/icon-urls'
import { useTt } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
const dingdanIcon = aizhsUrl('remote-images/dingdan.jpg')
const gerenIcon = aizhsUrl('remote-images/geren-icon.png')
const xianLabelIcon = aizhsUrl('remote-images/xian_label.png')
const shezhiIcon = aizhsUrl('remote-images/shezhi.png')
import ThemeRoot from '@/components/ThemeRoot'

export interface UserCardProps {
  onGoPage: (path: string) => void
}

/** UserCard 组件 — 对齐原项目 user_cards.vue（订单/公司/智汇值/钱包卡片） */
export default function UserCard({ onGoPage }: UserCardProps) {
  const tt = useTt()
  // 四处 path 原先指向 app.config 里**根本不存在**的页面(/pages/user_order_list/index、
  // /pagesA/distribution/index、/pages/tools/token_value、/pagesA/top-up/index)⇒ 四张卡点了
  // 毫无反应,且父页 goPage 无 fail 分支,连提示都没有。按 app.config 在册路由逐个改正:
  //   pkg-user 分包 user/orders / pages 分包 distribution/index / pkg-shop 的
  //   token/balance 与 wallet/recharge/index。
  const items = [
    {
      key: 'order',
      icon: dingdanIcon,
      title: tt('order.list.title', '我的订单'),
      desc: tt('userUserCard.view1', '查看相关订单'),
      path: '/pkg-user/user/orders',
    },
    {
      key: 'distribution',
      icon: gerenIcon,
      title: tt('distribution.company.title', '我的公司'),
      desc: tt('userUserCard.view2', '查看员工与业绩'),
      path: '/pages/distribution/index',
    },
    {
      key: 'token',
      icon: xianLabelIcon,
      title: tt('token.balance.title', '我的智汇值'),
      desc: tt('userUserCard.text3', '智汇消耗信息'),
      path: '/pkg-shop/token/balance',
    },
    {
      key: 'money',
      icon: shezhiIcon,
      title: tt('wallet.title', '我的钱包'),
      desc: tt('userUserCard.view4', '查看余额与充值'),
      path: '/pkg-shop/wallet/recharge/index',
    },
  ]
  return (
    /* 对齐 RN 端 packages/app/src/features/profile/ProfileScreen.tsx 卡片视觉语言:
       卡片 bg card + 描边 border.light(RN 卡片用描边不用投影,去掉原 boxShadow)/
       圆角 10dp→20rpx / 图标与文字间距 12dp→24rpx /
       标题 16dp→32rpx text.primary→foreground / 描述 14dp→28rpx text.secondary→muted-foreground */
    <View className="flex flex-wrap justify-between w-full mt-[20rpx] mb-[14rpx]">
      {items.map((item, idx) => {
        const isFullWidth = idx === 3 // 钱包占整行
        return (
          <ThemeRoot key={item.key}>
            <View
              key={item.key}
              className={`flex items-center px-[24rpx] py-[20rpx] rounded-lg mb-[14rpx] bg-card border-[length:2rpx] border-border ${isFullWidth ? 'w-full' : 'w-[calc(50vw-47rpx)]'}`}
              onClick={() => {
                const userInfodata = Taro.getStorageSync('data')
                if (!userInfodata) {
                  Taro.showToast({
                    title: tt('ai.aiAssistant.pleaseLogin', '请先登录'),
                    icon: 'none',
                  })
                  return
                }
                onGoPage(item.path)
              }}
              hoverClass="opacity-60"
            >
              <View className="w-[90rpx] h-[90rpx] mr-[24rpx] flex-shrink-0">
                <Image src={item.icon} className="w-full h-full" mode="aspectFill" />
              </View>
              <View>
                <Text className="block text-[length:32rpx] text-foreground">{item.title}</Text>
                <Text className="block text-body text-muted-foreground mt-[4rpx]">
                  {item.desc}
                </Text>
              </View>
            </View>
          </ThemeRoot>
        )
      })}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
