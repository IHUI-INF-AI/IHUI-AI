<template>
  <AdminListPage
    :title="t('adminComponents.course.title')"
    :description="t('adminComponents.course.desc')"
    :columns="columns"
    :data="courses"
    :total="total"
    :loading="loading"
    :show-add="true"
    @add="handleAdd"
    @search="handleSearch"
    @refresh="fetchCourses"
    @page-change="handlePageChange"
    @size-change="handleSizeChange"
  >
    <template #filters>
      <el-form-item :label="t('adminCommon.label.category')">
        <el-select v-model="filterCategory" :placeholder="t('adminCommon.placeholder.allCategories')" clearable @change="fetchCourses">
          <el-option :label="t('adminCommon.label.programming')" value="programming" />
          <el-option :label="t('adminCommon.label.ai')" value="ai" />
          <el-option :label="t('adminCommon.label.design')" value="design" />
          <el-option :label="t('adminCommon.label.business')" value="business" />
        </el-select>
      </el-form-item>
      <el-form-item :label="t('adminCommon.label.status')">
        <el-select v-model="filterStatus" :placeholder="t('adminCommon.placeholder.allStatus')" clearable @change="fetchCourses">
          <el-option :label="t('adminCommon.label.published')" value="published" />
          <el-option :label="t('adminCommon.label.draft')" value="draft" />
          <el-option :label="t('adminCommon.label.archived')" value="archived" />
        </el-select>
      </el-form-item>
    </template>

    <template #col-cover="{ row }">
      <el-image :src="row.cover" class="course-cover" fit="cover" />
    </template>

    <template #col-category="{ row }">
      <el-tag size="small">{{ getCategoryText(row.category) }}</el-tag>
    </template>

    <template #col-price="{ row }">
      <span v-if="row.price > 0" class="price">¥{{ row.price }}</span>
      <span v-else class="free">{{ t('adminCommon.label.free') }}</span>
    </template>

    <template #col-status="{ row }">
      <el-tag :type="getStatusStyle(row.status)">
        {{ getStatusText(row.status) }}
      </el-tag>
    </template>

    <template #actions="{ row }">
      <el-button type="primary" link size="small" @click="editCourse(row)">
        {{ t('adminCommon.label.edit') }}
      </el-button>
      <el-button type="primary" link size="small" @click="manageChapters(row)">
        {{ t('adminCommon.label.chapters') }}
      </el-button>
      <el-popconfirm :title="t('adminCommon.title.confirmDelete')" @confirm="deleteCourse(row)">
        <template #reference>
          <el-button type="danger" link size="small">{{ t('common.delete') }}</el-button>
        </template>
      </el-popconfirm>
    </template>
  </AdminListPage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminListPage from '@/components/admin/AdminListPage.vue'
import type { TableColumn } from '@/components/admin/AdminListPage.vue'

interface Course {
  id: string
  title: string
  cover: string
  category: string
  price: number
  chapters: number
  students: number
  status: string
  createdAt: string
}

const { t } = useI18n()

const columns: TableColumn[] = [
  { prop: 'cover', label: t('adminCommon.label.cover'), width: 100, slot: true },
  { prop: 'title', label: t('adminCommon.label.title'), minWidth: 200 },
  { prop: 'category', label: t('adminCommon.label.category'), width: 100, slot: true },
  { prop: 'price', label: t('adminCommon.label.price'), width: 80, slot: true },
  { prop: 'chapters', label: t('adminCommon.label.chapters'), width: 80 },
  { prop: 'students', label: t('adminCommon.label.students'), width: 80 },
  { prop: 'status', label: t('adminCommon.label.status'), width: 80, slot: true },
  { prop: 'createdAt', label: t('adminCommon.label.createdAt'), width: 180, type: 'date' },
]

const courses = ref<Course[]>([])
const total = ref(0)
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const filterCategory = ref('')
const filterStatus = ref('')

const categoryMap: Record<string, string> = {
  programming: t('adminCommon.label.programming'),
  ai: t('adminCommon.label.ai'),
  design: t('adminCommon.label.design'),
  business: t('adminCommon.label.business'),
}

const statusMap: Record<string, { text: string; style: string }> = {
  published: { text: t('adminCommon.label.published'), style: 'success' },
  draft: { text: t('adminCommon.label.draft'), style: 'info' },
  archived: { text: t('adminCommon.label.archived'), style: 'warning' },
}

const getCategoryText = (category: string): string => categoryMap[category] || category
const getStatusText = (status: string): string => statusMap[status]?.text || status
const getStatusStyle = (status: string): string => statusMap[status]?.style || 'info'

const fetchCourses = async () => {
  loading.value = true
  try {
    courses.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

const handleAdd = () => { /* 新增课程 */ }
const handleSearch = (_keyword: string) => { fetchCourses() }
const handlePageChange = (page: number) => { currentPage.value = page; fetchCourses() }
const handleSizeChange = (size: number) => { pageSize.value = size; fetchCourses() }
const editCourse = (_course: Course) => { /* 编辑课程 */ }
const manageChapters = (_course: Course) => { /* 管理章节 */ }
const deleteCourse = (_course: Course) => { /* 删除课程 */ }

onMounted(() => fetchCourses())
</script>

<style scoped>
.course-cover {
  width: 80px;
  height: 45px;
}

.price { font-weight: 600; color: var(--el-color-danger); }
.free { color: var(--el-color-success); }
</style>
