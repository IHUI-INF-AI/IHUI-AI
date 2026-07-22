import { logger } from '@/utils/logger'
import { View, Text, Image, Button } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getTeacherDetail, type Teacher } from '@/api'
import { useI18n } from '@/i18n'

export default function TeacherDetail() {
  const { t } = useI18n()
  const router = useRouter()
  const [teacher, setTeacher] = useState<Teacher | null>(null)

  const load = useCallback(async () => {
    const id = router.params.id
    if (!id) return
    try {
      setTeacher(await getTeacherDetail(id))
    } catch (e) {
      logger.error('teacher/detail', '获取讲师详情', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }, [router.params.id, t])

  useDidShow(() => {
    load()
  })

  const onViewCourses = useCallback(() => {
    if (!teacher) return
    Taro.navigateTo({ url: `/pages/course/list?teacherId=${teacher.id}` })
  }, [teacher])

  return (
    <View className="min-h-screen bg-background">
      {teacher && (
        <View className="mx-[12px] my-[12px] bg-card rounded-[8px] p-[16px]">
          <View className="flex items-center">
            <Image
              className="w-[80px] h-[80px] rounded-md bg-muted"
              src={teacher.avatar || '/static/default-avatar.png'}
              mode="aspectFill"
            />
            <View className="ml-[12px] flex-1">
              <Text className="text-[18px] text-foreground font-bold">{teacher.name}</Text>
              {teacher.title && (
                <Text className="block text-[13px] text-primary mt-[4px]">{teacher.title}</Text>
              )}
            </View>
          </View>
          <View className="flex mt-[16px]">
            <View className="flex-1 flex flex-col items-center">
              <Text className="text-[20px] text-foreground font-bold">{teacher.courses || 0}</Text>
              <Text className="text-[12px] text-muted-foreground mt-[4px]">
                {t('teacher.detail.courses')}
              </Text>
            </View>
            <View className="flex-1 flex flex-col items-center">
              <Text className="text-[20px] text-foreground font-bold">{teacher.students || 0}</Text>
              <Text className="text-[12px] text-muted-foreground mt-[4px]">
                {t('teacher.detail.students')}
              </Text>
            </View>
          </View>
        </View>
      )}
      {teacher?.intro && (
        <View className="mx-[12px] mb-[12px] bg-muted rounded-[8px] p-[16px]">
          <Text className="text-[14px] text-foreground font-semibold mb-[8px] block">
            {t('teacher.detail.intro')}
          </Text>
          <Text className="text-[14px] text-muted-foreground leading-[22px]">{teacher.intro}</Text>
        </View>
      )}
      {teacher && (
        <View className="mx-[12px] my-[12px]">
          <Button
            className="w-full bg-primary text-white text-[16px] rounded-[8px] h-[44px] leading-[44px]"
            onClick={onViewCourses}
          >
            {t('teacher.detail.viewCourses')}
          </Button>
        </View>
      )}
    </View>
  )
}
