import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getVipPrivilege } from '@/api'
import { useI18n } from '@/i18n'

interface Privilege {
  id: string
  title: string
  desc: string
}

export default function PrivilegePage() {
  const { t } = useI18n()
  const [list, setList] = useState<Privilege[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getVipPrivilege()
      setList(res.list || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useDidShow(() => load())

  const goUpgrade = () => {
    Taro.navigateTo({ url: '/pages/vip/upgrade' })
  }

  return (
    <View className="min-h-screen bg-background">
      <View className="bg-gradient-to-b from-[#2c2c2c] to-[#1a1a1a] px-[24px] py-[40px]">
        <Text className="block text-white text-[40px] font-bold">{t('vip.privilege.title')}</Text>
        <Text className="block text-[#d4af6a] text-[26px] mt-[12px]">{t('vip.privilege.desc')}</Text>
      </View>
      <View className="p-[12px]">
        {list.map(p => (
          <View key={p.id} className="bg-card rounded-[8px] p-[16px] mb-[12px]">
            <View className="flex items-center">
              <Text className="text-[40px] mr-[12px]">★</Text>
              <Text className="text-[30px] text-foreground font-semibold">{p.title}</Text>
            </View>
            <Text className="block text-[26px] text-muted-foreground mt-[12px]">{p.desc}</Text>
          </View>
        ))}
        {!loading && !list.length ? (
          <View className="text-center py-[120px] text-muted-foreground">
            <Text>{t('vip.privilege.empty')}</Text>
          </View>
        ) : null}
      </View>
      <View className="fixed bottom-0 left-0 right-0 p-[24px] bg-card">
        <Button
          className="w-full bg-gradient-to-r from-[#d4af6a] to-[#b8860b] text-white text-[32px] rounded-[8px] py-[20px]"
          onClick={goUpgrade}
        >
          {t('vip.privilege.upgrade')}
        </Button>
      </View>
    </View>
  )
}
