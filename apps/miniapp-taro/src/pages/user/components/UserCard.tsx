// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import dingdanIcon from '@/assets/remote/images/dingdan.jpg'
import gerenIcon from '@/assets/remote/images/geren-icon.png'
import xianLabelIcon from '@/assets/remote/images/xian_label.png'
import shezhiIcon from '@/assets/remote/images/shezhi.png'
import ThemeRoot from '@/components/ThemeRoot'

export interface UserCardProps {
  onGoPage: (path: string) => void
}

/** UserCard 组件 — 对齐原项目 user_cards.vue（订单/公司/智汇值/钱包卡片） */
export default function UserCard({ onGoPage }: UserCardProps) {
  const tt = useTt()
  const items = [
    {
      key: 'order',
      icon: dingdanIcon,
      title: tt('order.list.title', '我的订单'),
      desc: tt('userUserCard.view1', '查看相关订单'),
      path: '/pages/user_order_list/index',
    },
    {
      key: 'distribution',
      icon: gerenIcon,
      title: tt('distribution.company.title', '我的公司'),
      desc: tt('userUserCard.view2', '查看员工与业绩'),
      path: '/pagesA/distribution/index',
    },
    {
      key: 'token',
      icon: xianLabelIcon,
      title: tt('token.balance.title', '我的智汇值'),
      desc: tt('userUserCard.text3', '智汇消耗信息'),
      path: '/pages/tools/token_value',
    },
    {
      key: 'money',
      icon: shezhiIcon,
      title: tt('wallet.title', '我的钱包'),
      desc: tt('userUserCard.view4', '查看余额与充值'),
      path: '/pagesA/top-up/index',
    },
  ]
  return (
    <View className="flex flex-wrap justify-between w-full mt-[20rpx] mb-[14rpx]">
      {items.map((item, idx) => {
        const isFullWidth = idx === 3 // 钱包占整行
        return (
          <ThemeRoot key={item.key}>
            <View
              key={item.key}
              className={`flex items-center px-[12rpx] py-[10rpx] rounded-lg mb-[14rpx] ${isFullWidth ? 'w-full' : 'w-[calc(50vw-47rpx)]'}`}
              style={{
                background: 'var(--color-card)',
                boxShadow: '4rpx 4rpx 4rpx 0px rgba(0,0,0,0.07)',
              }}
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
            >
              <View className="w-[90rpx] h-[90rpx] mr-[15rpx] flex-shrink-0">
                <Image src={item.icon} className="w-full h-full" mode="aspectFill" />
              </View>
              <View>
                <Text className="text-[32rpx] text-foreground">{item.title}</Text>
                <Text className="text-[26rpx] text-muted-foreground">{item.desc}</Text>
              </View>
            </View>
          </ThemeRoot>
        )
      })}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
