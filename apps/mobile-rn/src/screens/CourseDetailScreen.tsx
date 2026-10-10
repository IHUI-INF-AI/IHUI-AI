// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { rnRadius } from '@ihui/design-tokens'

import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  enrollCourse,
  getCourseById,
  getProgress,
  type Course,
  type LessonProgress,
} from '@ihui/api-client'
import {
  CourseDetailScreen as SharedCourseDetailScreen,
  type CourseDetailItem,
  type CourseDetailLesson,
} from '@ihui/rn-app'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { NavChrome } from '../components/NavChrome'

type Route = RouteProp<RootStackParamList, 'CourseDetail'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CourseDetail'>

export function CourseDetailScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params
  const [course, setCourse] = useState<Course | null>(null)
  const [lessons, setLessons] = useState<LessonProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [enrolling, setEnrolling] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const [courseRes, progressRes] = await Promise.all([getCourseById(id), getProgress(id)])
      if (cancelled) return
      if (courseRes.success) {
        setCourse(courseRes.data)
      } else {
        setError(courseRes.error || t('course.loadFailed'))
      }
      if (progressRes.success) {
        setLessons(progressRes.data.lessons ?? [])
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, t])

  const onEnroll = async () => {
    if (!course) return
    setEnrolling(true)
    const res = await enrollCourse(course.id)
    setEnrolling(false)
    if (res.success) {
      setCourse({ ...course, isEnrolled: true })
    } else {
      setError(res.error || t('common.failed'))
    }
  }

  const onPlay = (lessonId: string) => {
    if (!course) return
    navigation.navigate('VideoPlayer', { courseId: course.id, lessonId, title: course.title })
  }

  const detailItem: CourseDetailItem | null = course
    ? {
        id: course.id,
        title: course.title,
        description: course.description,
        categoryName: course.categoryName,
        level: course.level,
        instructor: course.instructor,
        studentCount: course.studentCount,
        rating: course.rating,
        price: course.price,
        isFree: course.isFree,
        isEnrolled: course.isEnrolled,
      }
    : null

  const detailLessons: CourseDetailLesson[] = lessons.map((l) => ({
    lessonId: l.lessonId,
    title: l.title,
    isCompleted: l.isCompleted,
  }))

  return (
    <View style={{ flex: 1 }}>
      <NavChrome>
        <NavBar title={course?.title ?? t('course.title')} onBack={() => navigation.goBack()} />
      </NavChrome>
      <SharedCourseDetailScreen
        t={t}
        colorScheme={resolvedTheme}
        item={detailItem}
        lessons={detailLessons}
        loading={loading}
        error={error}
        enrolling={enrolling}
        onEnroll={onEnroll}
        onPlayLesson={onPlay}
        onBack={() => navigation.goBack()}
      />
      {/* 目录/评论/讲师入口(孤儿路由修复:CourseCatalog/CourseComment 注册无入口,课程详情补挂;P0 讲师列表接线) */}
      <View style={styles.entryRow}>
        {/* 动态按压态不得写成函数形态的 style:Pressable 被 cssInterop 注册过,函数声明会被展开成
            空对象而整份内联样式静默消失(守门 131 立项那一型)。外层只留纯布局档 flex 承接三个按钮
            的等分宽度,盒子的底色/圆角/内距下移到子 View 的数组形态上 —— 可见位置与尺寸一字不变。 */}
        <Pressable
          style={styles.entryBtnHit}
          onPress={() => navigation.navigate('CourseCatalog', { courseId: id })}
          accessibilityRole="button"
          accessibilityLabel="课程目录"
        >
          {({ pressed }) => (
            <View style={[styles.entryBtn, pressed ? styles.entryBtnPressed : null]}>
              <Text style={styles.entryBtnText}>课程目录</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={styles.entryBtnHit}
          onPress={() => navigation.navigate('CourseComment', { courseId: id })}
          accessibilityRole="button"
          accessibilityLabel="课程评论"
        >
          {({ pressed }) => (
            <View style={[styles.entryBtn, pressed ? styles.entryBtnPressed : null]}>
              <Text style={styles.entryBtnText}>课程评论</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={styles.entryBtnHit}
          onPress={() => navigation.navigate('TeacherList')}
          accessibilityRole="button"
          accessibilityLabel="讲师"
        >
          {({ pressed }) => (
            <View style={[styles.entryBtn, pressed ? styles.entryBtnPressed : null]}>
              <Text style={styles.entryBtnText}>讲师</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  entryRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  // 外层裸 Pressable 的命中层:只承接行内等分这一条纯布局档,不画任何底色/描边。
  entryBtnHit: {
    flex: 1,
  },
  entryBtn: {
    // 不得在这里写 flex: —— 等分宽度由外层 entryBtnHit 承担。
    // 整份样式原先挂在横向行里的 Pressable 上(flex 指宽度),搬到子 View 后同一份 flex 落在
    // 列方向上会把内容高度压成 0 ⇒ 按钮盒在、文字被裁掉(真机 VC53 实拍)。
    paddingVertical: 12,
    borderRadius: rnRadius.sm,
    backgroundColor: tokens.brandAccent.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryBtnPressed: {
    opacity: 0.8,
  },
  entryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.brandAccent.foreground,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
