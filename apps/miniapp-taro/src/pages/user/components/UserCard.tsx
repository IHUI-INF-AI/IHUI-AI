import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import dingdanIcon from '@/assets/remote/images/dingdan.jpg'
import gerenIcon from '@/assets/remote/images/geren-icon.png'
import xianLabelIcon from '@/assets/remote/images/xian_label.png'
import shezhiIcon from '@/assets/remote/images/shezhi.png'

export interface UserCardProps {
  onGoPage: (path: string) => void
}

/** UserCard 组件 — 对齐原项目 user_cards.vue（订单/公司/智汇值/钱包卡片） */
export default function UserCard({ onGoPage }: UserCardProps) {
  const items = [
    {
      key: 'order',
      icon: dingdanIcon,
      title: '我的订单',
      desc: '查看相关订单',
      path: '/pages/user_order_list/index',
    },
    {
      key: 'distribution',
      icon: gerenIcon,
      title: '我的公司',
      desc: '查看员工与业绩',
      path: '/pagesA/distribution/index',
    },
    {
      key: 'token',
      icon: xianLabelIcon,
      title: '我的智汇值',
      desc: '智汇消耗信息',
      path: '/pages/tools/token_value',
    },
    {
      key: 'money',
      icon: shezhiIcon,
      title: '我的钱包',
      desc: '查看余额与充值',
      path: '/pagesA/top-up/index',
    },
  ]
  return (
    <View className="flex flex-wrap justify-between w-full mt-[20rpx] mb-[14rpx]">
      {items.map((item, idx) => {
        const isFullWidth = idx === 3 // 钱包占整行
        return (
          <View
            key={item.key}
            className={`flex items-center px-[12rpx] py-[10rpx] rounded-lg mb-[14rpx] ${isFullWidth ? 'w-full' : 'w-[calc(50vw-47rpx)]'}`}
            style={{
              background: 'rgba(0,4,255,0.03)',
              boxShadow: '4rpx 4rpx 4rpx 0px rgba(0,0,0,0.07)',
            }}
            onClick={() => {
              const userInfodata = Taro.getStorageSync('data')
              if (!userInfodata) {
                Taro.showToast({ title: '请先登录', icon: 'none' })
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
        )
      })}
    </View>
  )
}
