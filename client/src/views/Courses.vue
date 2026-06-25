<template>
  <div class="courses-container page-container" :class="{ 'mouse-active': isMouseInViewport }">
    <!-- 滚动进度指示器 -->
    <div class="scroll-progress-bar" :style="{ transform: `scaleX(${scrollProgress})` }"></div>

    <!-- 深度背景系统 -->
    <div class="courses-bg-system">
      <div class="bg-glow-orb orb-1"></div>
      <div class="bg-glow-orb orb-2"></div>
      <div class="mouse-glow-effect"></div>
    </div>

    <!-- 页面头部 -->
    <div class="courses-header scroll-reveal" data-animation="fadeInUp">
      <div class="header-content">
        <div class="header-badge">
          <span class="status-dot"></span>
          <span class="badge-text font-edix">Learning</span>
        </div>
        <h1 class="page-title">{{ t('courses.title') }}</h1>
        <p class="page-subtitle">{{ t('courses.subtitle') }}</p>
      </div>
    </div>

    <!-- 搜索和筛选 -->
    <div class="courses-filters glass scroll-reveal" data-animation="fadeInUp" data-delay="100">
      <el-input
        v-model="searchKeyword"
        :placeholder="t('courses.searchPlaceholder')"
        clearable
        class="unified-search-input-wrap"
        @clear="loadCourses"
        @keyup.enter="loadCourses"
      >
        <template #prefix>
          <SearchIcon />
        </template>
        <template #append>
          <el-button type="primary" @click="loadCourses">
            {{ t('common.search') }}
          </el-button>
        </template>
      </el-input>

      <el-select
        v-model="selectedCategory"
        :placeholder="t('courses.categoryFilter')"
        clearable
        class="category-select"
        @change="handleCategoryChange"
      >
        <el-option
          v-for="category in categories"
          :key="category.id"
          :label="category.name"
          :value="category.id"
        />
      </el-select>

      <el-select
        v-model="selectedLevel"
        :placeholder="t('courses.levelFilter')"
        clearable
        class="level-select"
        @change="loadCourses"
      >
        <el-option :label="t('courses.levelAll')" value="" />
        <el-option :label="t('courses.levelBeginner')" value="beginner" />
        <el-option :label="t('courses.levelIntermediate')" value="intermediate" />
        <el-option :label="t('courses.levelAdvanced')" value="advanced" />
      </el-select>

      <el-select
        v-model="sortBy"
        :placeholder="t('courses.sortBy')"
        class="sort-select"
        @change="loadCourses"
      >
        <el-option :label="t('courses.sortByTime')" value="createTime" />
        <el-option :label="t('courses.sortByRating')" value="rating" />
        <el-option :label="t('courses.sortByStudents')" value="studentCount" />
      </el-select>
    </div>

    <!-- 标签页切换 -->
    <el-tabs v-model="activeTab" class="courses-tabs" @tab-change="handleTabChange">
      <el-tab-pane :label="t('courses.title')" name="all">
        <!-- 课程列表 -->
        <div class="courses-content">
          <div v-if="loading" class="loading-container">
            <SkeletonLoader type="list" :rows="6" :show-avatar="true" animated />
          </div>

          <div v-else-if="coursesLoadError" class="error-state glass">
            <div class="error-icon">⚠</div>
            <h3>{{ t('courses.loadErrorTitle') }}</h3>
            <p>{{ coursesLoadError }}</p>
            <button
              class="retry-btn ripple-btn"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); retryLoadCourses() }"
            >
              {{ t('courses.retry') }}
            </button>
          </div>

          <div v-else-if="courses.length === 0" class="empty-state glass">
            <el-empty :description="t('courses.noCourses')" />
          </div>

          <div v-else class="courses-grid">
            <div
              v-for="(course, idx) in courses"
              :key="course.id"
              class="course-card glass scroll-reveal"
              :data-delay="Number(idx) * 80"
              data-animation="fadeInUp"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); handleCourseClick(course) }"
            >
              <div class="course-cover">
                <el-image
                  :src="course.cover"
                  :alt="course.title"
                  :lazy="true"
                  fit="cover"
                  class="cover-image"
                  loading="lazy"
                >
                  <template #error>
                    <div class="image-slot">
                      <el-icon><Picture /></el-icon>
                    </div>
                  </template>
                </el-image>
                <div class="course-badge">
                  <el-tag v-if="course.isFree" size="small" class="free-tag">
                    {{ t('courses.free') }}
                  </el-tag>
                  <el-tag v-else size="small" class="price-tag">¥{{ (course.price ?? 0).toFixed(2) }}</el-tag>
                </div>
                <div v-if="course.progress !== undefined" class="progress-bar">
                  <el-progress :percentage="course.progress" :show-text="false" stroke-width="4" />
                </div>
                <div class="cover-overlay"></div>
              </div>

              <div class="course-content">
                <h3 class="course-title">{{ course.title }}</h3>
                <p class="course-description">
                  {{ course.description || t('courses.noDescription') }}
                </p>

                <div class="course-meta">
                  <div class="meta-item">
                    <el-icon><User /></el-icon>
                    <span>{{ course.instructor?.name ?? t('courses.unknownInstructor') }}</span>
                  </div>
                  <div class="meta-item">
                    <el-icon><VideoPlay /></el-icon>
                    <span>{{ t('courses.lessons', { count: course.lessonCount }) }}</span>
                  </div>
                  <div class="meta-item">
                    <el-icon><Clock /></el-icon>
                    <span>{{ t('courses.duration', { duration: course.duration }) }}</span>
                  </div>
                </div>

                <div class="course-footer">
                  <div class="course-stats">
                    <span class="stat-item">
                      <el-icon><Star /></el-icon>
                      <span>{{ course.rating.toFixed(1) }}</span>
                    </span>
                    <span class="stat-item">
                      <el-icon><UserFilled /></el-icon>
                      <span>{{ t('courses.students', { count: course.studentCount }) }}</span>
                    </span>
                  </div>
                  <button
                    v-if="!course.isEnrolled"
                    class="enroll-btn ripple-btn"
                    @click.stop="(e) => { createRipple(e, e.currentTarget as HTMLElement); handleEnroll(course) }"
                  >
                    {{ t('courses.enroll') }}
                  </button>
                  <button
                    v-else
                    class="continue-btn ripple-btn"
                    @click.stop="(e) => { createRipple(e, e.currentTarget as HTMLElement); handleCourseClick(course) }"
                  >
                    {{ t('courses.enrolled') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 分页 -->
        <div v-if="pagination.total > 0" class="pagination-container scroll-reveal" data-animation="fadeInUp">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="pagination.total"
            :page-sizes="[12, 24, 48]"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handlePageSizeChange"
            @current-change="handlePageChange"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane :label="t('courses.myCourses')" name="my">
        <div class="my-courses-content">
          <div v-if="myCoursesLoading" class="loading-container">
            <el-skeleton :rows="5" animated />
          </div>
          <div v-else-if="myCourses.length === 0" class="empty-state glass">
            <el-empty :description="t('courses.noMyCourses')" />
          </div>
          <div v-else class="my-courses-list">
            <div
              v-for="(course, idx) in myCourses"
              :key="course.id"
              class="my-course-item glass scroll-reveal"
              :data-delay="Number(idx) * 100"
              data-animation="fadeInUp"
              @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); handleCourseClick(course) }"
            >
              <div class="my-course-content">
                <el-image
                  :src="course.cover"
                  :alt="course.title"
                  :lazy="true"
                  class="my-course-cover"
                  fit="cover"
                >
                  <template #error>
                    <div class="image-slot">
                      <el-icon><Picture /></el-icon>
                    </div>
                  </template>
                </el-image>
                <div class="my-course-info">
                  <h3>{{ course.title }}</h3>
                  <p>{{ course.description }}</p>
                  <div class="my-course-progress">
                    <el-progress
                      :percentage="course.progress || 0"
                      :format="(percentage: number) => `${percentage}%`"
                    />
                  </div>
                </div>
                <button
                  class="continue-btn ripple-btn"
                  @click.stop="(e) => { createRipple(e, e.currentTarget as HTMLElement); handleCourseClick(course) }"
                >
                  {{ t('courses.continue') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 课程详情对话框 -->
    <el-dialog
      v-model="showCourseDialog"
      :title="selectedCourse?.title"
      width="1000px"
      :close-on-click-modal="false"
      class="course-dialog"
    >
      <div v-if="selectedCourse" class="course-detail">
        <div class="detail-header">
          <el-image
            :src="selectedCourse.cover"
            :alt="selectedCourse.title"
            :lazy="true"
            class="detail-cover"
            fit="cover"
          >
            <template #error>
              <div class="image-slot">
                <el-icon><Picture /></el-icon>
              </div>
            </template>
          </el-image>
          <div class="detail-info">
            <h3>{{ selectedCourse.title }}</h3>
            <p>{{ selectedCourse.description }}</p>
            <div class="detail-meta">
              <el-descriptions :column="2" border>
                <el-descriptions-item :label="t('courses.instructor')">
                  {{ selectedCourse.instructor?.name ?? t('courses.unknownInstructor') }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('courses.lessons')">
                  {{ t('courses.lessons', { count: selectedCourse.lessonCount }) }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('courses.duration')">
                  {{ t('courses.duration', { duration: selectedCourse.duration }) }}
                </el-descriptions-item>
                <el-descriptions-item :label="t('courses.students')">
                  {{
                    t('courses.students', {
                      count: selectedCourse.studentCount,
                    })
                  }}
                </el-descriptions-item>
              </el-descriptions>
            </div>
          </div>
        </div>

        <el-tabs v-model="detailTab">
          <el-tab-pane :label="t('courses.description')" name="description">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div class="detail-content" v-html="safeDescription"></div>
          </el-tab-pane>

          <el-tab-pane
            v-if="courseLessons.length > 0"
            :label="t('courses.lessonsList')"
            name="lessons"
          >
            <div class="lessons-list">
              <div
                v-for="lesson in courseLessons"
                :key="lesson.id"
                class="lesson-item glass"
                :class="{ completed: lesson.isCompleted }"
              >
                <div class="lesson-info">
                  <el-icon>
                    <component :is="lesson.isCompleted ? 'CircleCheck' : 'Circle'" />
                  </el-icon>
                  <span class="lesson-order">{{ lesson.order }}.</span>
                  <span class="lesson-title">{{ lesson.title }}</span>
                  <el-tag v-if="lesson.isFree" size="small" type="success">
                    {{ t('courses.free') }}
                  </el-tag>
                </div>
                <div class="lesson-duration">
                  {{ formatDuration(lesson.duration) }}
                </div>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>

        <div class="detail-actions">
          <button
            v-if="!selectedCourse.isEnrolled"
            class="action-btn primary ripple-btn"
            @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); handleEnroll(selectedCourse) }"
          >
            {{ selectedCourse.isFree ? t('courses.enrollFree') : t('courses.enroll') }}
          </button>
          <button
            v-else
            class="action-btn primary ripple-btn"
            @click="(e) => { createRipple(e, e.currentTarget as HTMLElement); handleStartLearning() }"
          >
            {{ t('courses.startLearning') }}
          </button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
 
import { ref, reactive, onMounted, computed, nextTick } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useApiError } from '@/composables/useApiError'
import { useMouseGlow } from '@/composables/useMouseGlow'
import { useDebounceSearch } from '@/composables/useDebounceSearch'
import {
  User,
  VideoPlay,
  Clock,
  Star,
  UserFilled,
  Picture,
} from '@/lib/lucide-fallback'
import {
  getCoursesList,
  getCourseDetail,
  getCourseCategories,
  enrollCourse,
  getMyCourses,
  type Course,
  type CourseLesson,
  type CourseCategory,
} from '@/api/courses'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { sanitizeHtml } from '@/utils/htmlSanitizer'
// P13: v2 业务封装层 (走 v2Sdk 自动生成的 v2 端点)
import { v2Courses } from '@/api'
import { useSEO } from '@/composables/useSEO'

useSEO({
  title: 'AI课程 - 智汇AI社区',
  description: '智汇AI社区AI课程平台，提供专业的AI技术课程和实战培训',
  keywords: 'AI课程,AI培训,人工智能课程,智汇AI',
  ogTitle: 'AI课程 - 智汇AI社区',
  ogDescription: '智汇AI社区AI课程平台，提供专业的AI技术课程和实战培训',
  canonical: 'https://www.zhihui-ai.com/courses'
})

// v2 可用性缓存: v2 失败后 60s 内不再尝试,避免重复无效请求
let v2CoursesAvailable: boolean | null = null
let v2CoursesFailTime = 0
const V2_FAIL_COOLDOWN = 60000

const { t } = useI18n()
const router = useRouter()
const { handleResult } = useOperationFeedback()
const { loading: apiLoading, execute } = useApiError()

// 统一清理：组件卸载时自动执行所有注册的清理函数
const cleanup = useCleanup()

// ============ 高级动效系统 ============
let scrollObserver: IntersectionObserver | null = null
const observedElements = ref<Set<Element>>(new Set())
const { isMouseInViewport } = useMouseGlow()
const scrollProgress = ref(0)

// 初始化滚动动画观察器
const initScrollAnimations = () => {
  scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement
          const delay = el.dataset.delay || '0'
          const animation = el.dataset.animation || 'fadeInUp'

          setTimeout(() => {
            el.classList.add('scroll-animated', `animate-${animation}`)
          }, parseInt(delay))

          observedElements.value.add(el)
        }
      })
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    }
  )

  nextTick(() => {
    document.querySelectorAll('.scroll-reveal').forEach((el) => {
      if (!observedElements.value.has(el)) {
        scrollObserver?.observe(el)
      }
    })
  })
}

// 滚动进度计算
let scrollRafId: number | null = null
const handleScroll = () => {
  if (scrollRafId !== null) return
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null
    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    scrollProgress.value = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0
    document.documentElement.style.setProperty('--scroll-progress', `${scrollProgress.value}`)
  })
}

// 涟漪点击效果
const createRipple = (e: MouseEvent, el: HTMLElement) => {
  const rect = el.getBoundingClientRect()
  const ripple = document.createElement('span')
  const size = Math.max(rect.width, rect.height)

  ripple.style.width = ripple.style.height = `${size}px`
  ripple.style.left = `${e.clientX - rect.left - size / 2}px`
  ripple.style.top = `${e.clientY - rect.top - size / 2}px`
  ripple.classList.add('ripple-effect')

  el.appendChild(ripple)
  setTimeout(() => ripple.remove(), 600)
}

// 状态管理
const courses = ref<Course[]>([])
const myCourses = ref<Course[]>([])
const categories = ref<CourseCategory[]>([{ id: 'all', name: t('courses.all') }])
const loading = computed(() => apiLoading.value)
const myCoursesLoading = ref(false)
const coursesLoadError = ref<string | null>(null)
const selectedCategory = ref<string>('all')
const selectedLevel = ref<string>('')
const sortBy = ref<string>('createTime')
const activeTab = ref('all')
const showCourseDialog = ref(false)
const selectedCourse = ref<Course | null>(null)
const courseLessons = ref<CourseLesson[]>([])
const detailTab = ref('description')

const retryLoadCourses = () => {
  coursesLoadError.value = null
  // 重试时重置 v2 可用性,允许重新尝试 v2
  v2CoursesAvailable = null
  v2CoursesFailTime = 0
  loadCourses()
}

// 分页
const pagination = reactive({
  page: 1,
  pageSize: 12,
  total: 0,
})

// 搜索防抖
const { searchKeyword } = useDebounceSearch(
  (_keyword: string) => {
    if (pagination.page !== 1) {
      pagination.page = 1
    }
    loadCourses()
  },
  { delay: 300 }
)

// 加载课程列表
const loadCourses = async () => {
  coursesLoadError.value = null
  // P13: v2 优先 (走 v2Sdk 自动生成的 v2 端点); 失败/数据空则 fallback 到 v1
  // 优化: v2 失败后 60s 冷却期内直接走 v1,避免重复无效请求
  const now = Date.now()
  const skipV2 = v2CoursesAvailable === false && (now - v2CoursesFailTime) < V2_FAIL_COOLDOWN
  let v2Result: { code?: string | number; data?: { records?: unknown[]; total?: number } } | null = null
  if (!skipV2) {
    try {
      v2Result = (await v2Courses.list({
        page: pagination.page,
        size: pagination.pageSize,
        keyword: searchKeyword.value || undefined,
      })) as unknown as typeof v2Result
      v2CoursesAvailable = true
    } catch (e) {
      v2CoursesAvailable = false
      v2CoursesFailTime = Date.now()
      ;(window as any)?.console?.warn?.('[P13] v2 courses.list failed, fallback to v1:', e)
    }
  }
  const v2Records = ((v2Result as any)?.data?.records as Array<Record<string, unknown>>) || []
  if (v2Result && ((v2Result as any).code === 200 || (v2Result as any).code === '200') && v2Records.length > 0) {
    const list = v2Records as unknown as Course[]
    mergeLocalProgress(list)
    courses.value = list
    pagination.total = (v2Result as any)?.data?.total || list.length
    saveCoursesToCache(list)
    nextTick(() => {
      document.querySelectorAll('.course-card.scroll-reveal').forEach((el) => {
        if (!observedElements.value.has(el)) {
          scrollObserver?.observe(el)
        }
      })
    })
    return
  }
  // Fallback: v1 (含详细课程数据)
  const result = await execute(
    () =>
      getCoursesList({
        page: pagination.page,
        pageSize: pagination.pageSize,
        category: selectedCategory.value === 'all' ? undefined : selectedCategory.value,
        keyword: searchKeyword.value || undefined,
        level: selectedLevel.value || undefined,
        sortBy: sortBy.value,
        sortOrder: 'desc',
      }),
    {
      showMessage: false,
    }
  )

  if (result) {
    const resultAny = result as any
    const list = resultAny.list ?? resultAny.rows ?? []
    const paginationInfo = resultAny.pagination ?? resultAny.page ?? {}
    const fetched = Array.isArray(list) ? list : []
    mergeLocalProgress(fetched)
    courses.value = fetched
    pagination.total = paginationInfo?.total ?? pagination.total ?? 0
    saveCoursesToCache(fetched)

    // 重新初始化滚动动画
    nextTick(() => {
      document.querySelectorAll('.course-card.scroll-reveal').forEach((el) => {
        if (!observedElements.value.has(el)) {
          scrollObserver?.observe(el)
        }
      })
    })
  } else {
    const cached = loadCoursesFromCache()
    if (cached.length > 0) {
      courses.value = cached
    }
    coursesLoadError.value = t('courses.loadError')
  }
}

// ============ 本地进度缓存 ============
const COURSES_CACHE_KEY = 'courses_cache_v1'
const PROGRESS_CACHE_KEY = 'course_progress_v1'

const saveCoursesToCache = (list: Course[]) => {
  try {
    const slim = list.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      cover: c.cover,
      price: c.price,
      isFree: c.isFree,
      isEnrolled: c.isEnrolled,
      progress: c.progress,
      lessonCount: c.lessonCount,
      duration: c.duration,
      rating: c.rating,
      studentCount: c.studentCount,
      instructor: c.instructor,
    }))
    localStorage.setItem(COURSES_CACHE_KEY, JSON.stringify({
      ts: Date.now(),
      list: slim,
    }))
  } catch (_e) {
    // 忽略存储失败
  }
}

const loadCoursesFromCache = (): Course[] => {
  try {
    const raw = localStorage.getItem(COURSES_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.list)) return []
    if (Date.now() - (parsed.ts || 0) > 24 * 3600 * 1000) return []
    return parsed.list
  } catch (_e) {
    return []
  }
}

const saveProgressToCache = (courseId: string, progress: number) => {
  try {
    const raw = localStorage.getItem(PROGRESS_CACHE_KEY) || '{}'
    const map = JSON.parse(raw)
    map[courseId] = { progress, ts: Date.now() }
    localStorage.setItem(PROGRESS_CACHE_KEY, JSON.stringify(map))
  } catch (_e) {
    // 忽略
  }
}

const loadProgressFromCache = (courseId: string): number | null => {
  try {
    const raw = localStorage.getItem(PROGRESS_CACHE_KEY) || '{}'
    const map = JSON.parse(raw)
    const entry = map[courseId]
    if (!entry) return null
    if (Date.now() - (entry.ts || 0) > 7 * 24 * 3600 * 1000) return null
    return typeof entry.progress === 'number' ? entry.progress : null
  } catch (_e) {
    return null
  }
}

const mergeLocalProgress = (list: Course[]) => {
  for (const c of list) {
    if (c.isEnrolled) {
      const cached = loadProgressFromCache(c.id)
      if (cached !== null) {
        c.progress = cached
      }
    }
  }
}

// 加载我的课程
const loadMyCourses = async () => {
  myCoursesLoading.value = true
  try {
    const result = await execute(() => getMyCourses(), {
      showMessage: false,
    })
    if (result && 'list' in result) {
      myCourses.value = result.list || []

      nextTick(() => {
        document.querySelectorAll('.my-course-item.scroll-reveal').forEach((el) => {
          if (!observedElements.value.has(el)) {
            scrollObserver?.observe(el)
          }
        })
      })
    }
  } finally {
    myCoursesLoading.value = false
  }
}

// 加载分类列表
const loadCategories = async () => {
  try {
    const response = await getCourseCategories()
    if (response.code === 200 || response.success) {
      const data = (response.data as CourseCategory[] | undefined) || []
      const normalized = data.filter((item): item is CourseCategory => !!item && !!item.name)
      categories.value = [{ id: 'all', name: t('courses.all') }, ...normalized]
    }
  } catch (_error) {
    // 静默失败
  }
}

// 加载课程详情
const loadCourseDetail = async (courseId: string) => {
  const result = await execute(() => getCourseDetail(courseId), {
    showMessage: false,
  })
  if (result) {
    selectedCourse.value = result
    courseLessons.value = result.lessons ?? []
  } else {
    selectedCourse.value = null
    courseLessons.value = []
  }
}

// 分类切换
const handleCategoryChange = () => {
  pagination.page = 1
  loadCourses()
}

// 标签页切换
const handleTabChange = (tab: string) => {
  if (tab === 'my') {
    loadMyCourses()
  } else {
    loadCourses()
  }
}

// 分页
const handlePageChange = (page: number) => {
  pagination.page = page
  loadCourses()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const handlePageSizeChange = (size: number) => {
  pagination.pageSize = size
  pagination.page = 1
  loadCourses()
}

// 点击课程
const handleCourseClick = (course: Course) => {
  selectedCourse.value = course
  showCourseDialog.value = true
  detailTab.value = 'description'
  loadCourseDetail(course.id)
}

// 报名课程
const enrollRetryCount = ref(0)
const MAX_ENROLL_RETRY = 2

const handleEnroll = async (course: Course) => {
  await handleResult(enrollCourse(course.id), {
    successMessage: t('courses.enrollSuccess'),
    errorMessage: t('courses.enrollFailed'),
    onSuccess: () => {
      course.isEnrolled = true
      course.progress = course.progress || 0
      saveProgressToCache(course.id, course.progress)
      enrollRetryCount.value = 0
      if (activeTab.value === 'my') {
        loadMyCourses()
      }
    },
    onError: () => {
      if (enrollRetryCount.value < MAX_ENROLL_RETRY) {
        enrollRetryCount.value += 1
        setTimeout(() => handleEnroll(course), 1200)
      } else {
        enrollRetryCount.value = 0
      }
    },
  })
}

// 开始学习
const handleStartLearning = () => {
  if (selectedCourse.value && courseLessons.value.length > 0) {
    router.push({
      path: `/courses/${selectedCourse.value.id}`,
    })
  }
}

// 格式化时长
const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}分钟`
}

// 安全描述 - 使用 sanitizeHtml 防止 XSS 攻击
const safeDescription = computed(() => {
  const description = selectedCourse.value?.description || ''
  return sanitizeHtml(description)
})

// 初始化
onMounted(async () => {
  // 初始化动效系统
  initScrollAnimations()

  // 添加事件监听
  window.addEventListener('scroll', handleScroll, { passive: true })

  handleScroll()

  try { await Promise.all([loadCategories(), loadCourses()]) } catch (e) { console.error(e) }
})

cleanup.add(() => {
  // 清理动效系统
  if (scrollObserver) {
    scrollObserver.disconnect()
    scrollObserver = null
  }

  // 移除事件监听
  window.removeEventListener('scroll', handleScroll)
  if (scrollRafId !== null) {
    cancelAnimationFrame(scrollRafId)
    scrollRafId = null
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/breakpoints' as bp;

$bg-page: var(--el-bg-color-page);
$text-main: var(--el-text-color-primary);
$text-sec: var(--el-text-color-secondary);
$border-light: var(--el-border-color-lighter);
$brand-primary: var(--el-text-color-primary);
$brand-secondary: var(--color-gray-333);

.courses-container {
  width: 100%;
  min-height: 100vh;
  padding: 20px;
  position: relative;
  overflow-x: hidden;

  &.mouse-active .mouse-glow-effect {
    opacity: 0;
  }
}

// ============ 深度背景系统 ============
.courses-bg-system {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);
  pointer-events: none;

  .mouse-glow-effect {
    position: absolute;
    left: 0;
    top: 0;
    width: 600px;
    height: 600px;
    border-radius: var(--global-border-radius);
    background: color-mix(in srgb, var(--el-color-primary) 12%, transparent);
    opacity: 0;
    pointer-events: none;
  }

  .bg-glow-orb {
    position: absolute;
    border-radius: var(--global-border-radius);
    filter: blur(80px);
    opacity: 0.12;
    animation: floatOrb 15s ease-in-out infinite;

    &.orb-1 {
      width: 400px;
      height: 400px;
      top: 10%;
      right: 10%;
      background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
    }

    &.orb-2 {
      width: 350px;
      height: 350px;
      bottom: 20%;
      left: 5%;
      background: color-mix(in srgb, var(--el-color-primary) 10%, transparent);
      animation-delay: -7s;
    }
  }

}

// ============ 滚动触发动画系统 ============
.scroll-reveal {
  opacity: 0;
  transform: translateY(40px);
  transition: none;

  &.scroll-animated {
    transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  }

  &.animate-fadeInUp {
    opacity: 1;
    transform: translateY(0);
  }
}

// ============ 涟漪效果 ============
.ripple-btn {
  position: relative;
  overflow: hidden;
}

// ============ 玻璃态 ============
.glass {
  background: rgb(var(--el-fill-color-light-rgb), 0.4);
  backdrop-filter: blur(24px);
  border: var(--unified-border);
}

// ============ 关键帧动画 ============
@keyframes gridMove {
  0% { transform: translate(0, 0); }
  100% { transform: translate(60px, 60px); }
}

@keyframes floatOrb {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(30px, -20px) scale(1.05); }
  50% { transform: translate(-20px, 30px) scale(0.95); }
  75% { transform: translate(-30px, -10px) scale(1.02); }
}

@keyframes rippleExpand {
  0% {
    transform: scale(0);
    opacity: 0.6;
  }

  100% {
    transform: scale(4);
    opacity: 0;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.1); }
}

// ============ 页面头部 ============
.courses-header {
  margin-bottom: 32px;
  position: relative;
  z-index: var(--z-base);

  .header-content {
    .header-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 20px;
      border: var(--unified-border);
      border-radius: var(--global-border-radius);
      font-size: 11px;
      font-weight: 900;
      margin-bottom: 16px;
      background: rgb(var(--el-fill-color-light-rgb), 0.3);
      backdrop-filter: blur(12px);

      .status-dot {
        width: 6px;
        height: 6px;
        background: $brand-primary;
        border-radius: var(--global-border-radius);
        animation: pulse 2s infinite;
      }
    }

    .page-title {
      font-size: clamp(32px, 5vw, 48px);
      font-weight: 800;
      font-family: var(--font-family-chinese);
      color: $text-main;
      margin: 0 0 12px;
      letter-spacing: -0.02em;
    }

    .page-subtitle {
      font-size: 18px;
      color: $text-sec;
      margin: 0;
      line-height: 1.6;
    }
  }
}

// ============ 筛选区域 ============
.courses-filters {
  display: flex;
  gap: 16px;
  margin-bottom: 32px;
  flex-wrap: wrap;
  padding: 24px 28px;
  border-radius: var(--global-border-radius);
  position: relative;
  z-index: var(--z-base);

  .unified-search-input-wrap {
    flex: 1;
    min-width: 220px;

    :deep(.el-input__wrapper) {
      border-radius: var(--global-border-radius);
      background: rgb(var(--el-fill-color-rgb), 0.5);
      box-shadow: none;
      border: var(--unified-border);
      transition: all 0.3s;

      &:hover, &.is-focus {
        border-color: $brand-primary;
        box-shadow: var(--global-box-shadow);
      }
    }

    :deep(.el-input__append) {
      align-items: center;
      height: 100%;
    }
  }

  .category-select,
  .level-select,
  .sort-select {
    width: 160px;

    :deep(.el-select__wrapper) {
      border-radius: var(--global-border-radius);
      background: rgb(var(--el-fill-color-rgb), 0.5);
      box-shadow: none;
      border: var(--unified-border);
      transition: all 0.3s;

      &:hover, &.is-focus {
        border-color: $brand-primary;
      }
    }
  }

}

// ============ 标签页 ============
.courses-tabs {
  position: relative;
  z-index: var(--z-base);

  :deep(.el-tabs__header) {
    margin-bottom: 24px;
  }

  :deep(.el-tabs__nav-wrap::after) {
    height: 1px;
    background: $border-light;
  }

  :deep(.el-tabs__active-bar) {
    background: $brand-primary;
    height: 3px;
    border-radius: var(--global-border-radius);
  }

  :deep(.el-tabs__item) {
    font-weight: 700;
    font-size: 15px;

    &.is-active {
      color: $brand-primary;
    }
  }
}

// ============ 课程内容 ============
.courses-content {
  flex: 1;
  min-height: 400px;
  position: relative;
  z-index: var(--z-base);

  .loading-container {
    padding: 60px 0;
  }

  .empty-state {
    padding: 100px 0;
    text-align: center;
    border-radius: var(--global-border-radius);
  }

  .error-state {
    padding: 60px 32px;
    text-align: center;
    border-radius: var(--global-border-radius);

    .error-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }

    h3 {
      font-size: 20px;
      font-weight: 800;
      color: $text-main;
      margin: 0 0 8px;
    }

    p {
      font-size: 14px;
      color: $text-sec;
      margin: 0 0 24px;
    }

    .retry-btn {
      padding: 10px 28px;
      border-radius: var(--global-border-radius);
      background: $brand-primary;
      color: var(--el-bg-color);
      font-weight: 800;
      font-size: 14px;
      border: none;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        background: $brand-secondary;
        transform: translateY(-2px);
      }
    }
  }
}

// ============ 课程网格 ============
.courses-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 24px;
}

// ============ 课程卡片 ============
.course-card {
  cursor: pointer;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  position: relative;

  .course-cover {
    position: relative;
    width: 100%;
    height: 200px;
    overflow: hidden;

    .cover-image {
      width: 100%;
      height: 100%;
      transition: transform 0.5s;
    }

    .cover-overlay {
      position: absolute;
      inset: 0;
      background: var(--color-black-5);
      opacity: 0;
      transition: opacity 0.3s;
    }

    .course-badge {
      position: absolute;
      top: 16px;
      right: 16px;
      z-index: calc(var(--z-base) + 1);

      .free-tag {
        background: var(--color-emerald-500);
        border: none;
        color: var(--el-bg-color);
        font-weight: 800;
      }

      .price-tag {
        background: $brand-primary;
        border: none;
        color: var(--el-bg-color);
        font-weight: 800;
      }
    }

    .progress-bar {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 8px 16px;
      background: var(--color-black-50);

      :deep(.el-progress__outer) {
        background: var(--el-fill-color-light, color-mix(in srgb, var(--el-color-primary) 30%, transparent));
      }

      :deep(.el-progress__inner) {
        background: $brand-primary;
      }
    }
  }

  &:hover {
    .cover-image {
      transform: scale(1.08);
    }

    .cover-overlay {
      opacity: 1;
    }
  }

  .course-content {
    padding: 24px;
    position: relative;
    z-index: var(--z-base);

    .course-title {
      font-size: 20px;
      font-weight: 900;
      color: $text-main;
      margin: 0 0 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .course-description {
      font-size: 14px;
      color: $text-sec;
      margin: 0 0 20px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 42px;
      line-height: 1.6;
    }

    .course-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 20px;
      font-size: 13px;
      color: $text-sec;

      .meta-item {
        display: flex;
        align-items: center;
        gap: 6px;

        .el-icon {
          font-size: 16px;
          color: $brand-primary;
        }
      }
    }

    .course-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 16px;
      border-top: var(--unified-border);

      .course-stats {
        display: flex;
        gap: 20px;
        font-size: 14px;
        color: $text-sec;

        .stat-item {
          display: flex;
          align-items: center;
          gap: 6px;

          .el-icon {
            color: var(--color-amber-fbbf24);
          }
        }
      }

      .enroll-btn,
      .continue-btn {
        padding: 10px 20px;
        border-radius: var(--global-border-radius);
        font-weight: 800;
        font-size: 13px;
        border: none;
        cursor: pointer;
        transition: all 0.3s;
      }

      .enroll-btn {
        background: $brand-primary;
        color: var(--el-bg-color);

        &:hover {
          background: $brand-secondary;
          transform: translateY(-2px);
        }
      }

      .continue-btn {
        background: color-mix(in srgb, var(--el-text-color-primary) 10%, transparent);
        color: $brand-primary;

        &:hover {
          background: $brand-primary;
          color: var(--el-bg-color);
        }
      }
    }
  }
}

// ============ 我的课程 ============
.my-courses-content {
  position: relative;
  z-index: var(--z-base);

  .my-courses-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .my-course-item {
    padding: 24px;
    border-radius: var(--global-border-radius);
    cursor: pointer;
    position: relative;

    .my-course-content {
      display: flex;
      align-items: center;
      gap: 24px;
      position: relative;
      z-index: var(--z-base);

      .my-course-cover {
        width: 220px;
        height: 140px;
        border-radius: var(--global-border-radius);
        flex-shrink: 0;
        overflow: hidden;
      }

      .my-course-info {
        flex: 1;
        min-width: 0;

        h3 {
          font-size: 22px;
          font-weight: 900;
          color: $text-main;
          margin: 0 0 10px;
        }

        p {
          font-size: 14px;
          color: $text-sec;
          margin: 0 0 16px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.6;
        }

        .my-course-progress {
          width: 100%;
          max-width: 300px;
        }
      }

      .continue-btn {
        padding: 14px 28px;
        border-radius: var(--global-border-radius);
        background: $brand-primary;
        color: var(--el-bg-color);
        font-weight: 800;
        font-size: 14px;
        border: none;
        cursor: pointer;
        transition: all 0.3s;
        flex-shrink: 0;

        &:hover {
          background: $brand-secondary;
          transform: translateY(-2px);
          box-shadow: var(--global-box-shadow);
        }
      }
    }
  }
}

// ============ 分页 ============
:where(.pagination-container) {
  margin-top: 48px;
  display: flex;
  justify-content: center;
  position: relative;
  z-index: var(--z-base);

  :deep(.el-pagination) {
    .el-pagination__total,
    .el-pagination__sizes,
    .el-pagination__jump {
      font-weight: 600;
    }

    .el-pager li {
      font-weight: 700;
      border-radius: var(--global-border-radius);

      &.is-active {
        background: $brand-primary;
      }
    }

    .btn-prev,
    .btn-next {
      border-radius: var(--global-border-radius);
    }
  }
}

// ============ 课程详情对话框 ============
.course-dialog {
  :deep(.el-dialog) {
    border-radius: var(--global-border-radius);
    overflow: hidden;
  }

  :deep(.el-dialog__header) {
    padding: 24px 28px;
    border-bottom: var(--unified-border-bottom);

    .el-dialog__title {
      font-size: 22px;
      font-weight: 900;
    }
  }

  :deep(.el-dialog__body) {
    padding: 0;
  }
}

.course-detail {
  .detail-header {
    display: flex;
    gap: 28px;
    padding: 28px;
    background: rgb(var(--el-fill-color-light-rgb), 0.3);

    .detail-cover {
      width: 320px;
      height: 200px;
      border-radius: var(--global-border-radius);
      flex-shrink: 0;
      overflow: hidden;
    }

    .detail-info {
      flex: 1;

      h3 {
        font-size: 26px;
        font-weight: 900;
        color: $text-main;
        margin: 0 0 12px;
      }

      p {
        font-size: 15px;
        color: $text-sec;
        margin: 0 0 20px;
        line-height: 1.7;
      }
    }
  }

  .detail-content {
    padding: 24px 28px;
    min-height: 200px;
    line-height: 1.8;
  }

  .lessons-list {
    padding: 16px 28px;

    .lesson-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 20px;
      margin-bottom: 12px;
      border-radius: var(--global-border-radius);
      cursor: pointer;
      transition: all 0.3s ease;

      &:hover {
        transform: translateX(4px);
      }

      &.completed {
        .el-icon {
          color: var(--color-emerald-500);
        }
      }

      .lesson-info {
        display: flex;
        align-items: center;
        gap: 14px;
        flex: 1;

        .lesson-order {
          font-weight: 800;
          color: $text-sec;
        }

        .lesson-title {
          font-size: 15px;
          font-weight: 700;
          color: $text-main;
        }
      }

      .lesson-duration {
        font-size: 13px;
        color: $text-sec;
        font-weight: 600;
      }
    }
  }

  .detail-actions {
    display: flex;
    justify-content: center;
    gap: 16px;
    padding: 28px;
    border-top: var(--unified-border);

    .action-btn {
      height: 56px;
      padding: 0 48px;
      border-radius: var(--global-border-radius);
      font-weight: 900;
      font-size: 16px;
      border: none;
      cursor: pointer;
      transition: all 0.3s;

      &.primary {
        background: $brand-primary;
        color: var(--el-bg-color);

        &:hover {
          background: $brand-secondary;
          transform: translateY(-3px);
          box-shadow: var(--global-box-shadow);
        }
      }
    }
  }
}

// ============ 图片占位 ============
.image-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: rgb(var(--el-fill-color-rgb), 0.5);
  color: $text-sec;
  font-size: 32px;
}

// ============ 响应式 ============
@include bp.mobile-only {
  .courses-container {
    padding: 16px;
  }

  .courses-filters {
    padding: 20px;
    border-radius: var(--global-border-radius);

    .search-input {
      width: 100%;
      min-width: unset;
    }

    .category-select,
    .level-select,
    .sort-select {
      width: 100%;
    }
  }

  .courses-grid {
    grid-template-columns: 1fr;
  }

  .course-detail {
    .detail-header {
      flex-direction: column;
      padding: 20px;

      .detail-cover {
        width: 100%;
      }
    }
  }

  .my-course-item {
    .my-course-content {
      flex-direction: column;
      align-items: stretch;

      .my-course-cover {
        width: 100%;
        height: 180px;
      }

      .continue-btn {
        margin-top: 16px;
      }
    }
  }
}

@include bp.tablet-only {
  .courses-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
