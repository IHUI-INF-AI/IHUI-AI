<template>
  <div class="p19-page">
    <h2 class="p19-title">{{ t('p19CoursesList.title') }}</h2>
    <el-row :gutter="16" v-loading="loading">
      <el-col v-for="c in courses" :key="c.id" :span="8">
        <el-card shadow="hover" class="p19-course">
          <div class="p19-course-title">{{ c.title }}</div>
          <div class="p19-course-meta">{{ c.instructor }} · {{ c.level }} · {{ c.duration_minutes }} {{ t('p19CoursesList.minutes') }}</div>
          <div class="p19-course-desc">{{ c.description }}</div>
          <div class="p19-course-footer">
            <span class="p19-price">¥{{ c.price }}</span>
            <el-button type="primary" size="small" @click="enroll(c.id)">{{ t('p19CoursesList.enroll') }}</el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ElMessage } from 'element-plus'
import { v2Courses } from '@/api/v2-business'

const loading = ref(false)
const courses_ = ref<any[]>([])

async function load() {
  loading.value = true
  try {
    const r = await v2Courses.list({ page: 1, size: 20 })
    courses_.value = (r as any)?.data?.items || (r as any)?.data?.records || []
  } catch (e: any) {
    ElMessage.error('加载课程失败: ' + (e?.message || e))
  } finally {
    loading.value = false
  }
}

async function enroll(courseId: string) {
  try {
    await v2Courses.enroll(courseId)
    ElMessage.success('报名成功')
  } catch (e: any) {
    ElMessage.error('报名异常: ' + (e?.message || e))
  }
}

onMounted(load)
</script>

<style scoped>
.p19-page {
  padding: 24px;
}

.p19-title {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 600;
}

.p19-course {
  margin-bottom: 16px;
}

.p19-course-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.p19-course-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}

.p19-course-desc {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-bottom: 12px;
  min-height: 40px;
}

.p19-course-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.p19-price {
  font-size: 20px;
  font-weight: 700;
  color: var(--el-color-danger);
}
</style>
