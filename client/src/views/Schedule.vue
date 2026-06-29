<template>
  <div class="schedule-page">
    <div class="container">
      <!-- 头部 -->
      <header class="hub-header ihui-ai-fade-in-top-animation">
        <h1>{{ t('schedule.title') }}</h1>
        <p class="subtitle">{{ t('schedule.subtitle') }}</p>
      </header>

      <main class="schedule-main ihui-ai-fade-in-top-animation">
        <!-- 筛选区 -->
        <section class="panel-section">
          <div class="console-header">
            <div class="id-block">SCHEDULE_FILTER</div>
            <div class="status-block"><span class="status-dot"></span> {{ t('schedule.filterType') }}</div>
          </div>
          <div class="filter-grid">
            <div class="filter-field">
              <label>{{ t('schedule.fields.type') }}</label>
              <el-select
                v-model="filterType"
                clearable
                :placeholder="t('schedule.allTypes')"
                style="width: 100%"
                @change="handleFilterChange"
              >
                <el-option v-for="opt in typeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </div>
            <div class="filter-field">
              <label>{{ t('schedule.fields.startTime') }}</label>
              <el-date-picker
                v-model="dateRange"
                type="daterange"
                range-separator="-"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="YYYY-MM-DD"
                style="width: 100%"
                @change="handleFilterChange"
              />
            </div>
            <div class="filter-field filter-actions">
              <el-button @click="resetFilter">重置</el-button>
            </div>
          </div>
        </section>

        <!-- 列表区 -->
        <section class="panel-section">
          <div class="console-header">
            <div class="id-block">SCHEDULE_LOG</div>
            <div class="status-block"><span class="status-dot"></span> {{ t('schedule.total', { n: total }) }}</div>
          </div>

          <div class="action-bar">
            <button class="btn-create" @click="openCreateDialog">{{ t('schedule.create') }}</button>
          </div>

          <!-- 空状态 -->
          <div v-if="scheduleList.length === 0 && !listLoading" class="empty-list">
            <el-empty :description="t('schedule.empty')" />
          </div>

          <!-- 日程列表 -->
          <div v-else class="schedule-list">
            <div
              v-for="item in scheduleList"
              :key="item.id"
              class="schedule-item"
              :class="{ 'is-cancelled': item.status === 0, 'is-completed': item.status === 2 }"
            >
              <div class="color-bar" :class="`type-${item.type}`" :style="item.color ? { background: item.color } : {}"></div>
              <div class="item-body">
                <div class="item-header">
                  <span class="item-title">{{ item.title }}</span>
                  <span class="item-status" :class="`status-${item.status}`">{{ statusText(item.status) }}</span>
                </div>
                <div class="item-meta">
                  <span class="meta-type">{{ typeText(item.type) }}</span>
                  <span class="meta-time">
                    {{ formatTime(item.start_time) }}<template v-if="item.end_time"> ~ {{ formatTime(item.end_time) }}</template>
                  </span>
                  <span v-if="item.all_day" class="meta-allday">{{ t('schedule.fields.allDay') }}</span>
                  <span v-if="item.remind_before > 0" class="meta-remind">{{ remindText(item.remind_before) }}</span>
                </div>
                <div v-if="item.location" class="item-location">{{ item.location }}</div>
                <div v-if="item.description" class="item-desc">{{ item.description }}</div>
                <div class="item-actions">
                  <button v-if="item.status === 1" class="btn-action" @click="changeStatus(item, 2)">
                    {{ t('schedule.actions.complete') }}
                  </button>
                  <button v-if="item.status === 1" class="btn-action" @click="changeStatus(item, 0)">
                    {{ t('schedule.actions.cancel') }}
                  </button>
                  <button v-if="item.status !== 1" class="btn-action" @click="changeStatus(item, 1)">
                    {{ t('schedule.actions.restore') }}
                  </button>
                  <button class="btn-action" @click="openEditDialog(item)">编辑</button>
                  <button class="btn-action btn-danger" @click="handleDelete(item)">
                    {{ t('schedule.actions.delete') }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 加载中 -->
          <div v-if="listLoading" class="list-loading">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>{{ t('schedule.loading') }}</span>
          </div>

          <!-- 分页 -->
          <div v-if="total > 0" class="pagination-wrap">
            <el-pagination
              v-model:current-page="page"
              v-model:page-size="limit"
              :total="total"
              :page-sizes="[10, 20, 50]"
              layout="prev, pager, next, sizes, total"
              @current-change="loadSchedules"
              @size-change="handleSizeChange"
            />
          </div>
        </section>
      </main>

      <!-- 新建/编辑弹窗 -->
      <el-dialog
        v-model="dialogVisible"
        :title="dialogMode === 'create' ? t('schedule.create') : '编辑日程'"
        width="600px"
        :close-on-click-modal="false"
      >
        <el-form ref="formRef" :model="form" :rules="formRules" label-position="top" class="schedule-form">
          <el-form-item prop="title" :label="t('schedule.fields.title')">
            <el-input v-model="form.title" :placeholder="t('schedule.fields.title')" />
          </el-form-item>
          <div class="form-row">
            <el-form-item :label="t('schedule.fields.type')">
              <el-select v-model="form.type" :disabled="dialogMode === 'edit'" style="width: 100%">
                <el-option v-for="opt in typeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
              </el-select>
            </el-form-item>
            <el-form-item :label="t('schedule.fields.color')">
              <el-select v-model="form.color" clearable placeholder="选择颜色" style="width: 100%">
                <el-option v-for="c in colorOptions" :key="c.value" :label="c.label" :value="c.value" />
              </el-select>
            </el-form-item>
          </div>
          <div class="form-row">
            <el-form-item prop="start_time" :label="t('schedule.fields.startTime')">
              <el-date-picker
                v-model="form.start_time"
                type="datetime"
                placeholder="选择开始时间"
                value-format="YYYY-MM-DDTHH:mm:ss"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item :label="t('schedule.fields.endTime')">
              <el-date-picker
                v-model="form.end_time"
                type="datetime"
                placeholder="选择结束时间"
                value-format="YYYY-MM-DDTHH:mm:ss"
                :disabled="form.all_day"
                style="width: 100%"
              />
            </el-form-item>
          </div>
          <div v-if="dialogMode === 'create'" class="form-row">
            <el-form-item :label="t('schedule.fields.allDay')">
              <el-switch v-model="form.all_day" />
            </el-form-item>
            <el-form-item :label="t('schedule.fields.remindBefore')">
              <el-select v-model="form.remind_before" style="width: 100%">
                <el-option v-for="r in remindOptions" :key="r.value" :label="r.label" :value="r.value" />
              </el-select>
            </el-form-item>
          </div>
          <el-form-item v-if="dialogMode === 'create'" :label="t('schedule.fields.location')">
            <el-input v-model="form.location" :placeholder="t('schedule.fields.location')" />
          </el-form-item>
          <el-form-item :label="t('schedule.fields.description')">
            <el-input v-model="form.description" type="textarea" :rows="3" :placeholder="t('schedule.fields.description')" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="submitForm">
            {{ dialogMode === 'create' ? t('schedule.actions.submit') : '保存' }}
          </el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading } from '@/lib/lucide-fallback'
import {
  getScheduleList,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  type ScheduleItem,
  type ScheduleType,
  type ScheduleStatus,
} from '@/api/schedule'
import { logger } from '@/utils/logger'

const { t } = useI18n()

// 列表状态
const scheduleList = ref<ScheduleItem[]>([])
const listLoading = ref(false)
const page = ref(1)
const limit = ref(20)
const total = ref(0)

// 筛选状态
const filterType = ref<ScheduleType | ''>('')
const dateRange = ref<[string, string] | null>(null)

// 弹窗状态
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingId = ref<number | null>(null)
const submitting = ref(false)
const formRef = ref<InstanceType<typeof import('element-plus')['ElForm']> | null>(null)

// 表单数据
const form = reactive({
  title: '',
  description: '',
  type: 'personal' as ScheduleType,
  start_time: '',
  end_time: '',
  all_day: false,
  color: '',
  remind_before: 0,
  location: '',
})

// 类型选项
const typeOptions = [
  { value: 'personal', label: t('schedule.types.personal') },
  { value: 'work', label: t('schedule.types.work') },
  { value: 'course', label: t('schedule.types.course') },
  { value: 'meeting', label: t('schedule.types.meeting') },
]

// 颜色选项
const colorOptions = [
  { value: '#409EFF', label: '蓝色' },
  { value: '#67C23A', label: '绿色' },
  { value: '#E6A23C', label: '橙色' },
  { value: '#F56C6C', label: '红色' },
  { value: '#8B5CF6', label: '紫色' },
  { value: '#909399', label: '灰色' },
]

// 提醒选项
const remindOptions = [
  { value: 0, label: t('schedule.remindOptions.none') },
  { value: 5, label: t('schedule.remindOptions.m5') },
  { value: 15, label: t('schedule.remindOptions.m15') },
  { value: 30, label: t('schedule.remindOptions.m30') },
  { value: 60, label: t('schedule.remindOptions.m60') },
  { value: 120, label: t('schedule.remindOptions.m120') },
  { value: 1440, label: t('schedule.remindOptions.d1') },
]

// 表单校验规则
const formRules = {
  title: [{ required: true, message: t('schedule.messages.titleRequired'), trigger: 'blur' }],
  start_time: [{ required: true, message: t('schedule.messages.startTimeRequired'), trigger: 'change' }],
}

// 格式化时间
const formatTime = (time: string | null): string => {
  if (!time) return ''
  const d = new Date(time)
  if (isNaN(d.getTime())) return time
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 状态文本
const statusText = (status: ScheduleStatus): string => {
  if (status === 0) return t('schedule.status.cancelled')
  if (status === 2) return t('schedule.status.completed')
  return t('schedule.status.normal')
}

// 类型文本
const typeText = (type: ScheduleType): string => {
  const opt = typeOptions.find(o => o.value === type)
  return opt ? opt.label : type
}

// 提醒文本
const remindText = (minutes: number): string => {
  const opt = remindOptions.find(o => o.value === minutes)
  return opt ? opt.label : `${minutes}min`
}

// 加载日程列表
const loadSchedules = async () => {
  listLoading.value = true
  try {
    const res = await getScheduleList({
      page: page.value,
      limit: limit.value,
      type: filterType.value || undefined,
      start_date: dateRange.value?.[0] || undefined,
      end_date: dateRange.value?.[1] || undefined,
    })
    if (res && res.success && res.data) {
      scheduleList.value = res.data.list || []
      total.value = res.data.total || 0
    } else if (res) {
      ElMessage.error(res.message || '加载失败')
    }
  } catch (error) {
    logger.error('Failed to load schedules:', error)
    ElMessage.error(t('common.errors.loadScheduleFailed'))
  } finally {
    listLoading.value = false
  }
}

// 筛选变化
const handleFilterChange = () => {
  page.value = 1
  loadSchedules()
}

// 重置筛选
const resetFilter = () => {
  filterType.value = ''
  dateRange.value = null
  page.value = 1
  loadSchedules()
}

// 分页大小变化
const handleSizeChange = () => {
  page.value = 1
  loadSchedules()
}

// 重置表单
const resetForm = () => {
  form.title = ''
  form.description = ''
  form.type = 'personal'
  form.start_time = ''
  form.end_time = ''
  form.all_day = false
  form.color = ''
  form.remind_before = 0
  form.location = ''
}

// 打开新建弹窗
const openCreateDialog = () => {
  dialogMode.value = 'create'
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

// 打开编辑弹窗
const openEditDialog = (item: ScheduleItem) => {
  dialogMode.value = 'edit'
  editingId.value = item.id
  form.title = item.title
  form.description = item.description || ''
  form.type = item.type
  form.start_time = item.start_time || ''
  form.end_time = item.end_time || ''
  form.all_day = item.all_day
  form.color = item.color || ''
  form.remind_before = item.remind_before
  form.location = item.location || ''
  dialogVisible.value = true
}

// 提交表单
const submitForm = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return
    submitting.value = true
    try {
      if (dialogMode.value === 'create') {
        const res = await createSchedule({
          title: form.title,
          description: form.description || undefined,
          start_time: form.start_time,
          end_time: form.end_time || undefined,
          all_day: form.all_day,
          type: form.type,
          color: form.color || undefined,
          remind_before: form.remind_before,
          location: form.location || undefined,
        })
        if (res && res.success) {
          ElMessage.success(t('schedule.messages.createSuccess'))
          dialogVisible.value = false
          loadSchedules()
        } else if (res) {
          ElMessage.error(res.message || '创建失败')
        }
      } else if (editingId.value !== null) {
        // 编辑模式：后端仅支持 title/description/start_time/end_time/status/color
        const res = await updateSchedule(editingId.value, {
          title: form.title,
          description: form.description || undefined,
          start_time: form.start_time || undefined,
          end_time: form.end_time || undefined,
          color: form.color || undefined,
        })
        if (res && res.success) {
          ElMessage.success(t('schedule.messages.updateSuccess'))
          dialogVisible.value = false
          loadSchedules()
        } else if (res) {
          ElMessage.error(res.message || '更新失败')
        }
      }
    } catch (error) {
      logger.error('Submit schedule failed:', error)
      ElMessage.error(t('common.errors.operationFailed'))
    } finally {
      submitting.value = false
    }
  })
}

// 切换状态
const changeStatus = async (item: ScheduleItem, status: ScheduleStatus) => {
  try {
    const res = await updateSchedule(item.id, { status })
    if (res && res.success) {
      ElMessage.success(t('schedule.messages.updateSuccess'))
      loadSchedules()
    } else if (res) {
      ElMessage.error(res.message || '更新失败')
    }
  } catch (error) {
    logger.error('Change status failed:', error)
    ElMessage.error(t('common.errors.updateFailed'))
  }
}

// 删除日程
const handleDelete = (item: ScheduleItem) => {
  ElMessageBox.confirm(t('schedule.messages.confirmDelete'), '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(async () => {
      try {
        const res = await deleteSchedule(item.id)
        if (res && res.success) {
          ElMessage.success(t('schedule.messages.deleteSuccess'))
          loadSchedules()
        } else if (res) {
          ElMessage.error(res.message || '删除失败')
        }
      } catch (error) {
        logger.error('Delete schedule failed:', error)
        ElMessage.error(t('common.errors.deleteFailed'))
      }
    })
    .catch(() => {
      // 用户取消
    })
}

onMounted(() => {
  loadSchedules()
})
</script>

<style scoped lang="scss">
@use '@/styles/_breakpoints.scss' as bp;

.schedule-page {
  min-height: 100vh;
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  position: relative;
  overflow-x: hidden;
}

.container {
  position: relative;
  z-index: var(--z-base);
  max-width: 900px;
  margin: 0 auto;
  padding: 0 40px;

  @include bp.tablet-down {
    padding: 0 24px;
  }
}

.hub-header {
  padding: 40px 0;
  text-align: center;
}

.hub-header h1 {
  font-size: clamp(32px, 5vw, 48px);
  font-weight: 900;
  letter-spacing: -2px;
  color: var(--el-text-color-primary);
}

.hub-header .subtitle {
  color: var(--el-text-color-secondary);
  font-size: 16px;
  margin-top: 12px;
}

.schedule-main {
  margin-bottom: 120px;
}

.panel-section {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 32px;
  margin-bottom: 24px;

  @include bp.tablet-down {
    padding: 20px;
  }
}

.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  font-family: var(--font-family-mono);
  font-size: 12px;
  font-weight: 800;
}

.id-block {
  color: var(--el-text-color-secondary);
}

.status-block {
  color: var(--el-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--global-border-radius);
  background: var(--el-color-primary);
}

.filter-grid {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 16px;
  align-items: end;

  @include bp.tablet-down {
    grid-template-columns: 1fr;
  }
}

.filter-field label {
  display: block;
  font-family: var(--font-family-mono);
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-weight: 800;
  margin-bottom: 8px;
  letter-spacing: 1px;
}

.filter-actions {
  display: flex;
  align-items: flex-end;
}

.action-bar {
  margin-bottom: 20px;
}

.btn-create {
  background: var(--el-text-color-primary);
  color: var(--el-bg-color-page);
  border: none;
  padding: 12px 28px;
  border-radius: var(--global-border-radius);
  font-family: var(--font-family-mono);
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
  transition: background 0.3s, color 0.3s;
}

.btn-create:hover {
  background: var(--el-color-primary);
  color: var(--el-bg-color-page);
}

.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.schedule-item {
  display: flex;
  background: var(--el-bg-color-page);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  transition: border-color 0.3s;
}

.schedule-item:hover {
  border-color: var(--el-color-primary);
}

.color-bar {
  width: 4px;
  flex-shrink: 0;
}

.color-bar.type-personal {
  background: var(--el-color-primary);
}

.color-bar.type-work {
  background: var(--el-color-success);
}

.color-bar.type-course {
  background: var(--el-color-warning);
}

.color-bar.type-meeting {
  background: var(--el-color-danger);
}

.item-body {
  flex: 1;
  padding: 16px 20px;
  min-width: 0;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 12px;
}

.item-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schedule-item.is-cancelled .item-title,
.schedule-item.is-completed .item-title {
  text-decoration: line-through;
  color: var(--el-text-color-secondary);
}

.item-status {
  font-family: var(--font-family-mono);
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: var(--global-border-radius);
  border: var(--unified-border);
  flex-shrink: 0;
}

.item-status.status-1 {
  color: var(--el-color-primary);
}

.item-status.status-0 {
  color: var(--el-text-color-secondary);
}

.item-status.status-2 {
  color: var(--el-color-success);
}

.item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  font-family: var(--font-family-mono);
  color: var(--el-text-color-secondary);
  margin-bottom: 4px;
}

.meta-type {
  padding: 1px 6px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
}

.meta-allday {
  color: var(--el-color-warning);
}

.item-location {
  font-size: 12px;
  color: var(--el-text-color-regular);
  margin-top: 6px;
}

.item-desc {
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
  margin-top: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.btn-action {
  background: var(--el-bg-color);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  padding: 4px 12px;
  font-size: 12px;
  font-family: var(--font-family-mono);
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.btn-action:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.btn-action.btn-danger:hover {
  border-color: var(--el-color-danger);
  color: var(--el-color-danger);
}

.empty-list {
  padding: 60px 0;
}

.list-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.pagination-wrap {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;

  @include bp.tablet-down {
    grid-template-columns: 1fr;
  }
}

:where(html.dark) .schedule-page {
  background: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
}
</style>
