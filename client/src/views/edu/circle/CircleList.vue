<template>
  <!--
    CircleList.vue — 圈子列表页
    路由: EduCircle (/edu/circle)
    功能: 圈子卡片网格 + 搜索/排序 + 加入/已加入 + 创建圈子弹窗
  -->
  <div class="circle-list">
    <!-- ① 页头 -->
    <header class="page-header">
      <div class="header-text">
        <h1 class="page-title">{{ t('edu.circle.title') }}</h1>
        <p class="page-subtitle">{{ t('edu.circle.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="reload">
          {{ t('edu.common.retry') }}
        </el-button>
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          {{ t('edu.circle.createCircle') }}
        </el-button>
      </div>
    </header>

    <!-- ② 错误提示 -->
    <el-alert
      v-if="error"
      type="error"
      :title="t('edu.common.loadFailed')"
      show-icon
      :closable="false"
      class="error-alert"
    />

    <!-- ③ 筛选/搜索 -->
    <div class="filter-bar">
      <el-input
        v-model="keyword"
        :placeholder="t('edu.circle.searchPlaceholder')"
        clearable
        :prefix-icon="Search"
        class="filter-search"
        @keyup.enter="handleSearch"
        @clear="handleSearch"
      />
      <el-radio-group v-model="orderBy" @change="handleSearch">
        <el-radio-button value="latest">{{ t('edu.circle.sortLatest') }}</el-radio-button>
        <el-radio-button value="hot">{{ t('edu.circle.sortHot') }}</el-radio-button>
      </el-radio-group>
    </div>

    <!-- ④ 列表 -->
    <div v-loading="loading" class="list-body">
      <el-empty v-if="!loading && circles.length === 0" :description="t('edu.circle.empty')" />

      <div v-else class="circle-grid">
        <article
          v-for="c in circles"
          :key="c.id"
          class="circle-card"
          @click="goDetail(c.id)"
        >
          <div class="card-cover">
            <el-image v-if="c.cover" :src="c.cover" fit="cover" class="cover-img">
              <template #error>
                <div class="cover-placeholder">
                  <el-icon :size="32"><Picture /></el-icon>
                </div>
              </template>
            </el-image>
            <div v-else class="cover-placeholder">
              <el-icon :size="32"><Picture /></el-icon>
            </div>
          </div>
          <div class="card-body">
            <div class="card-head">
              <h2 class="card-name">{{ c.name }}</h2>
              <el-tag v-if="!c.is_public" size="small" type="info" effect="plain" class="private-tag">
                {{ t('edu.circle.isPublic') }}
              </el-tag>
            </div>
            <p class="card-desc">{{ c.description || c.name }}</p>
            <div class="card-stats">
              <span class="stat-item">
                <el-icon><User /></el-icon>
                {{ c.member_count }} {{ t('edu.circle.members') }}
              </span>
              <span class="stat-item">
                <el-icon><Document /></el-icon>
                {{ c.post_count }} {{ t('edu.circle.posts') }}
              </span>
            </div>
          </div>
          <div class="card-footer" @click.stop>
            <el-button
              :type="joinedMap[c.id] ? 'success' : 'primary'"
              :plain="joinedMap[c.id]"
              size="small"
              :loading="joiningId === c.id"
              @click="handleJoin(c)"
            >
              {{ joinedMap[c.id] ? t('edu.circle.joined') : t('edu.circle.join') }}
            </el-button>
          </div>
        </article>
      </div>
    </div>

    <!-- ⑤ 分页 -->
    <div v-if="total > pageSize" class="pagination-wrap">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="prev, pager, next"
        background
        @current-change="loadList"
      />
    </div>

    <!-- ⑥ 创建圈子弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="t('edu.circle.createCircle')"
      width="520"
      align-center
    >
      <el-form
        ref="formRef"
        :model="createForm"
        :rules="createRules"
        label-position="top"
        @submit.prevent
      >
        <el-form-item :label="t('edu.circle.circleName')" prop="name">
          <el-input
            v-model="createForm.name"
            :placeholder="t('edu.circle.circleNamePlaceholder')"
            maxlength="50"
            show-word-limit
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('edu.circle.circleDesc')" prop="description">
          <el-input
            v-model="createForm.description"
            type="textarea"
            :rows="3"
            :placeholder="t('edu.circle.circleDescPlaceholder')"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
        <el-form-item :label="t('edu.circle.category')" prop="category">
          <el-input
            v-model="createForm.category"
            :placeholder="t('edu.circle.category')"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('edu.circle.isPublic')" prop="is_public">
          <el-switch v-model="createForm.is_public" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('edu.common.cancel') }}</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreate">
          {{ t('edu.common.submit') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Refresh, Plus, Search, Picture, User, Document } from '@element-plus/icons-vue'
import { circleApi, type EduCircle } from '@/api/edu'

const { t } = useI18n()
const router = useRouter()

const circles = ref<EduCircle[]>([])
const loading = ref(false)
const error = ref(false)
const keyword = ref('')
const orderBy = ref<'latest' | 'hot'>('latest')
const page = ref(1)
const pageSize = 12
const total = ref(0)

const joinedMap = ref<Record<number, boolean>>({})
const joiningId = ref<number | null>(null)

const dialogVisible = ref(false)
const creating = ref(false)
const formRef = ref<FormInstance>()

const createForm = reactive({
  name: '',
  description: '',
  category: '',
  is_public: true,
})

const createRules = computed<FormRules>(() => ({
  name: [
    { required: true, message: t('edu.circle.circleNamePlaceholder'), trigger: 'blur' },
    { min: 2, max: 50, message: t('edu.circle.circleNamePlaceholder'), trigger: 'blur' },
  ],
}))

async function loadList() {
  loading.value = true
  error.value = false
  try {
    const res = await circleApi.listCircles({
      page: page.value,
      size: pageSize,
      keyword: keyword.value || undefined,
      order_by: orderBy.value,
    })
    const payload = res.data.data
    if (payload) {
      circles.value = payload.items
      total.value = payload.total
    }
  } catch {
    error.value = true
    ElMessage.error(t('edu.common.loadFailed'))
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  page.value = 1
  loadList()
}

function reload() {
  loadList()
}

async function handleJoin(c: EduCircle) {
  if (joinedMap.value[c.id]) return
  joiningId.value = c.id
  try {
    await circleApi.joinCircle(c.id)
    joinedMap.value[c.id] = true
    c.member_count += 1
    ElMessage.success(t('edu.circle.joinSuccess'))
  } catch {
    ElMessage.error(t('edu.common.loadFailed'))
  } finally {
    joiningId.value = null
  }
}

function openCreateDialog() {
  createForm.name = ''
  createForm.description = ''
  createForm.category = ''
  createForm.is_public = true
  dialogVisible.value = true
}

async function handleCreate() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  creating.value = true
  try {
    await circleApi.createCircle({
      name: createForm.name.trim(),
      description: createForm.description.trim() || undefined,
      category: createForm.category.trim() || undefined,
      is_public: createForm.is_public,
    })
    ElMessage.success(t('edu.circle.joinSuccess'))
    dialogVisible.value = false
    page.value = 1
    await loadList()
  } catch {
    ElMessage.error(t('edu.common.loadFailed'))
  } finally {
    creating.value = false
  }
}

function goDetail(circleId: number) {
  router.push({ name: 'EduCircleDetail', params: { circleId: String(circleId) } })
}

onMounted(loadList)
</script>

<style scoped lang="scss">
.circle-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
  width: 100%;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.error-alert {
  margin: 0;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 16px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.filter-search {
  flex: 1;
  min-width: 240px;
  max-width: 360px;
}

.list-body {
  min-height: 200px;
  width: 100%;
}

.circle-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.circle-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-bg-color);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.circle-card:hover {
  border-color: var(--border-unified-color-hover);
  box-shadow: 0 2px 12px rgb(0 0 0 / 0.06);
}

.card-cover {
  width: 100%;
  height: 120px;
  background: var(--el-fill-color-light);
  overflow: hidden;
}

.cover-img {
  width: 100%;
  height: 100%;
}

.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--el-text-color-secondary);
}

.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
}

.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
}

.card-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.private-tag {
  flex-shrink: 0;
  border-radius: 8px;
}

.card-desc {
  margin: 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 40px;
}

.card-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.stat-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.card-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  display: flex;
  justify-content: flex-end;
}

.pagination-wrap {
  display: flex;
  justify-content: center;
}

@media (width <= 640px) {
  .filter-search {
    max-width: none;
  }
}
</style>
