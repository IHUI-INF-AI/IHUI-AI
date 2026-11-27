// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/course-tab/CourseTabScreen.tsx(经 RN 壳 CourseScreenView 承载)
import { useRouter, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import AuthReadyGate from '@/components/AuthReadyGate'
import ThemeRoot from '@/components/ThemeRoot'
import { CourseScreenView } from '@rn-shells/CourseScreen'
import { t } from '@/i18n'

/**
 * 端内不写布局、不写数据:整屏 = RN `CourseScreenView`,与 RN 课程 Tab 同一份源码
 * (学习进度/学习路径/课程分类/热门课程/全部课程五区一次到位)。
 * - `?keyword=` 深链(教师主页/Banner)作为初始搜索词注入,保留原入口语义;
 * - `showTabBar={false}`:课程在小程序不是 tab 页,不渲染 RN 悬浮 TabBar。
 */
export default function CourseList() {
  const router = useRouter()
  const initialKeyword = router.params.keyword || ''

  useShareAppMessage(() => ({
    title: t('share.appTitle'),
    path: '/pkg-learn/course/list',
    imageUrl: '/static/share.png',
  }))
  useShareTimeline(() => ({
    title: t('share.timelineTitle'),
    query: '',
  }))

  return (
    <ThemeRoot className="min-h-screen bg-background flex flex-col">
      <AuthReadyGate>
        <CourseScreenView initialKeyword={initialKeyword} showTabBar={false} />
      </AuthReadyGate>
    </ThemeRoot>
  )
}
