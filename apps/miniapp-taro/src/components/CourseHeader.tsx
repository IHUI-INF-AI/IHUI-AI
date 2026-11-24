// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'
import LineIcon from '@/components/LineIcon'
import { bspappUrl } from '@/constants/icon-urls'

export interface CourseHeaderData {
  title: string
  cover?: string
  teacher?: string
  teacherAvatar?: string
  lessonCount?: number
  studentCount?: number
  rating?: number
  price?: number
  originalPrice?: number
  tags?: string[]
}

export interface CourseHeaderProps {
  data?: CourseHeaderData
  onTeacherClick?: () => void
}

export default function CourseHeader({ data = { title: '' }, onTeacherClick }: CourseHeaderProps) {
  const tt = useTt()
  return (
    <View className="bg-card">
      {data.cover && (
        <Image className="w-full" style={{ height: '180px' }} src={data.cover} mode="aspectFill" />
      )}
      <View className="px-lg py-md">
        <Text className="block text-title font-medium text-foreground">{data.title}</Text>

        {data.tags && data.tags.length > 0 && (
          <View className="flex flex-wrap mt-sm">
            {data.tags.map((tag, i) => (
              <Text
                key={i}
                className="text-caption px-sm py-[4rpx] mr-[12rpx] mb-xs rounded bg-primary/10 text-primary"
              >
                {tag}
              </Text>
            ))}
          </View>
        )}

        <View className="flex items-center justify-between mt-md">
          <View className="flex items-center" hoverClass="opacity-60" onClick={onTeacherClick}>
            {data.teacherAvatar && (
              <Image
                className="w-7 h-7 mr-sm rounded-md bg-muted"
                src={data.teacherAvatar}
                mode="aspectFill"
              />
            )}
            {data.teacher && <Text className="text-label text-foreground mr-md">{data.teacher}</Text>}
          </View>
          <View className="flex items-center">
            {data.lessonCount !== undefined && (
              <Text className="text-label text-muted-foreground mr-sm">
                {data.lessonCount} {tt('course.lessonUnit', '节')}
              </Text>
            )}
            {data.studentCount !== undefined && (
              <Text className="text-label text-muted-foreground mr-sm">
                {data.studentCount} {tt('course.studentUnit', '人学')}
              </Text>
            )}
            {data.rating !== undefined && (
              <>
                <LineIcon name="star" size="14px" color="var(--color-warning)" className="mr-xs" />
                <Text className="text-label text-warning">{data.rating.toFixed(1)}</Text>
              </>
            )}
          </View>
        </View>

        {data.price !== undefined && (
          <View className="mt-sm flex flex-col gap-xs">
            {data.price > 0 && (
              <View className="inline-flex items-center self-start h-[36rpx] px-[10rpx] rounded-lg bg-muted">
                <Image
                  src={bspappUrl('tabbar/course/fufei.png')}
                  mode="aspectFill"
                  className="w-[38rpx] h-[34rpx] mr-[10rpx]"
                  lazyLoad
                />
                <Text className="text-badge text-destructive">
                  {tt('CourseHeader.text1', '付费项目')}
                </Text>
              </View>
            )}
            <View className="flex items-baseline">
              <Text className="text-label text-destructive mr-xs">¥</Text>
              <Text className="text-heading font-bold text-destructive">{data.price}</Text>
              {data.originalPrice && (
                <Text className="text-label text-muted-foreground line-through ml-sm">
                  ¥{data.originalPrice}
                </Text>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
