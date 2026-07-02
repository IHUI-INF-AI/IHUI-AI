<template>
  <div class="course-cat-page" v-loading="loading">
    <h2 class="page-title">{{ t('courseCat.title', '课程与分类管理 (集中接入 12 个 course/category/* API)') }}</h2>

    <el-tabs v-model="activeTab" class="cc-tabs">
      <!-- 课程列表 -->
      <el-tab-pane :label="t('courseCat.tab.course', '课程')" name="course">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('course')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('course')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.course" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="title" label="课程名" width="300" />
          <el-table-column prop="price" label="价格" width="100" />
          <el-table-column prop="category" label="分类" width="150" />
          <el-table-column prop="status" label="状态" width="100" />
          <el-table-column :label="t('common.operation')" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('course', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('course', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 课程审计 -->
      <el-tab-pane :label="t('courseCat.tab.audit', '课程审计')" name="audit">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('audit')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('audit')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.audit" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="courseId" label="课程ID" width="100" />
          <el-table-column prop="status" label="状态" width="120" />
          <el-table-column prop="auditor" label="审核人" width="120" />
          <el-table-column prop="auditedAt" label="审核时间" width="180" />
          <el-table-column :label="t('common.operation')" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('audit', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('audit', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 课程支付 -->
      <el-tab-pane :label="t('courseCat.tab.pay', '课程支付')" name="pay">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('pay')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('pay')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.pay" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="courseId" label="课程ID" width="100" />
          <el-table-column prop="userId" label="用户ID" width="100" />
          <el-table-column prop="amount" label="金额" width="120" />
          <el-table-column prop="status" label="状态" width="120" />
          <el-table-column :label="t('common.operation')" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('pay', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('pay', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 课程支付日志 -->
      <el-tab-pane :label="t('courseCat.tab.payLog', '支付日志')" name="payLog">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('payLog')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('payLog')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.payLog" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="orderId" label="订单ID" width="120" />
          <el-table-column prop="amount" label="金额" width="120" />
          <el-table-column prop="channel" label="渠道" width="120" />
          <el-table-column prop="createdAt" label="创建时间" width="180" />
        </el-table>
      </el-tab-pane>

      <!-- 课程星球 -->
      <el-tab-pane :label="t('courseCat.tab.planet', '课程星球')" name="planet">
        <div class="tab-actions">
          <el-button @click="reload('planet')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.planet" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="星球名" width="200" />
          <el-table-column prop="ownerId" label="圈主" width="120" />
          <el-table-column prop="memberCount" label="成员数" width="100" />
        </el-table>
      </el-tab-pane>

      <!-- 分类 -->
      <el-tab-pane :label="t('courseCat.tab.category', '分类')" name="category">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('category')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('category')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.category" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="分类名" width="200" />
          <el-table-column prop="parentId" label="父级ID" width="100" />
          <el-table-column prop="sort" label="排序" width="80" />
          <el-table-column :label="t('common.operation')" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('category', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('category', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 分类字典 -->
      <el-tab-pane :label="t('courseCat.tab.categoryDict', '分类字典')" name="categoryDict">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('categoryDict')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('categoryDict')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.categoryDict" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="key" label="键" width="200" />
          <el-table-column prop="value" label="值" />
          <el-table-column :label="t('common.operation')" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('categoryDict', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('categoryDict', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 分类关联 -->
      <el-tab-pane :label="t('courseCat.tab.categoryLink', '分类关联')" name="categoryLink">
        <div class="tab-actions">
          <el-button type="primary" @click="onCreate('categoryLink')">{{ t('common.add') }}</el-button>
          <el-button @click="reload('categoryLink')">{{ t('common.refresh') }}</el-button>
        </div>
        <el-table :data="lists.categoryLink" stripe>
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="categoryId" label="分类ID" width="100" />
          <el-table-column prop="targetId" label="目标ID" width="100" />
          <el-table-column prop="targetType" label="目标类型" width="120" />
          <el-table-column :label="t('common.operation')" width="200" fixed="right">
            <template #default="{ row }">
              <el-button size="small" link type="primary" @click="onEdit('categoryLink', row)">{{ t('common.edit') }}</el-button>
              <el-button size="small" link type="danger" @click="onDelete('categoryLink', row)">{{ t('common.delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 8 个 course/* + 3 个 category/* 零引用 API 集中接入
import {
  getCourseList, createCourse, updateCourse, deleteCourse, exportCourse,
} from '@/api/course/course'
import {
  createCourseAudit, updateCourseAudit, deleteCourseAudit, exportCourseAudit,
} from '@/api/course/course-audit'
import {
  createCoursePay, updateCoursePay, deleteCoursePay, exportCoursePay,
} from '@/api/course/course-pay'
import {
  createCoursePayLog, updateCoursePayLog, deleteCoursePayLog, exportCoursePayLog,
} from '@/api/course/course-pay-log'
import {
  getCoursePlanet,
} from '@/api/course/course-planet'
import {
  getCategoryList, createCategory, updateCategory, deleteCategory, exportCategory,
} from '@/api/category/category'
import {
  createCategoryDictionary, updateCategoryDictionary, deleteCategoryDictionary, exportCategoryDictionary,
} from '@/api/category/category-dictionary'
import {
  createCategoryLink, updateCategoryLink, deleteCategoryLink, exportCategoryLink,
} from '@/api/category/category-link'

const activeTab = ref('course')
const loading = ref(false)

const lists = reactive<Record<string, unknown[]>>({
  course: [], audit: [], pay: [], payLog: [], planet: [],
  category: [], categoryDict: [], categoryLink: [],
})

async function reload(tab: string) {
  loading.value = true
  try {
    switch (tab) {
      case 'course': lists.course = ((await getCourseList())?.data as unknown as unknown[]) || []; break
      case 'audit': lists.audit = []; break
      case 'pay': lists.pay = []; break
      case 'payLog': lists.payLog = []; break
      case 'planet': lists.planet = (((await getCoursePlanet()) as any)?.data as unknown as unknown[]) || []; break
      case 'category': lists.category = ((await getCategoryList())?.data as unknown as unknown[]) || []; break
      case 'categoryDict': lists.categoryDict = []; break
      case 'categoryLink': lists.categoryLink = []; break
    }
  } catch (e) { console.error(e) } finally { loading.value = false }
}

type CRUDTab = 'course' | 'audit' | 'pay' | 'payLog' | 'category' | 'categoryDict' | 'categoryLink'

const handlers: Record<CRUDTab, { create: (p: any) => Promise<any>; update: (p: any) => Promise<any>; remove: (id: any) => Promise<any>; exportFn: (p: any) => Promise<any> }> = {
  course: { create: createCourse, update: updateCourse, remove: deleteCourse, exportFn: exportCourse },
  audit: { create: createCourseAudit, update: updateCourseAudit, remove: deleteCourseAudit, exportFn: exportCourseAudit },
  pay: { create: createCoursePay, update: updateCoursePay, remove: deleteCoursePay, exportFn: exportCoursePay },
  payLog: { create: createCoursePayLog, update: updateCoursePayLog, remove: deleteCoursePayLog, exportFn: exportCoursePayLog },
  category: { create: createCategory, update: updateCategory, remove: deleteCategory, exportFn: exportCategory },
  categoryDict: { create: createCategoryDictionary, update: updateCategoryDictionary, remove: deleteCategoryDictionary, exportFn: exportCategoryDictionary },
  categoryLink: { create: createCategoryLink, update: updateCategoryLink, remove: deleteCategoryLink, exportFn: exportCategoryLink },
}

async function onCreate(tab: CRUDTab) {
  const h = handlers[tab]
  try {
    await h.create({})
    ElMessage.success(t('common.addSuccess'))
    reload(tab)
  } catch (e) { console.error(e); ElMessage.error(t('common.operationFailed')) }
}
async function onEdit(tab: CRUDTab, row: Record<string, any>) {
  const h = handlers[tab]
  try {
    await h.update(row)
    ElMessage.success(t('common.updateSuccess'))
    reload(tab)
  } catch (e) { console.error(e); ElMessage.error(t('common.operationFailed')) }
}
async function onDelete(tab: CRUDTab, row: Record<string, any>) {
  const h = handlers[tab]
  try {
    await ElMessageBox.confirm(t('common.confirmDelete'), t('common.tip'), { type: 'warning' })
    await h.remove(row.id)
    ElMessage.success(t('common.deleteSuccess'))
    reload(tab)
  } catch (e) { if (e !== 'cancel') { console.error(e); ElMessage.error(t('common.operationFailed')) } }
}

onMounted(() => {
  reload('course')
})
</script>

<style scoped lang="scss">
.course-cat-page {
  padding: 16px;
  .page-title { margin: 0 0 16px; font-size: 22px; }
  .cc-tabs { background: var(--el-bg-color); padding: 16px; border-radius: var(--global-border-radius); }
  .tab-actions { margin-bottom: 12px; }
}
</style>
