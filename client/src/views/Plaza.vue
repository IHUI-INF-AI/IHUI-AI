<template>
  <div class="plaza-page">
    <!-- 动态数字化背景 -->
    <div class="plaza-background">
      <div class="glow-orb"></div>
    </div>

    <div class="container">
      <header class="page-header ihui-ai-fade-in-top-animation">
        <div class="header-content">
          <h1>{{ showSetPath ? t('plaza.publishNeed') : t('plaza.aiNeedPlaza') }}</h1>
          <p class="subtitle">{{ t('plaza.subtitle') }}</p>
        </div>
        <div class="header-actions">
          <button v-if="!showSetPath" class="btn-primary-tech" style="color: var(--el-bg-color);" @click="toSet">
            <el-icon>
              <Plus />
            </el-icon>
            <span>{{ t('plaza.publish').toUpperCase() }}</span>
          </button>
          <button v-else class="btn-outline-tech" @click="reback">
            <el-icon>
              <ArrowLeft />
            </el-icon>
            <span>{{ t('plaza.back').toUpperCase() }}</span>
          </button>
        </div>
      </header>

      <div v-if="!showSetPath" class="main-content-hub">
        <!-- 筛选与搜索控制台 -->
        <div class="console-section ihui-ai-fade-in-top-animation">
          <div class="filter-group">
            <div class="pill-selector">
              <button v-for="type in types" :key="type.value" :class="{ active: selectedTypes === type.value }"
                @click="selectedTypes = type.value; reGetData()">
                {{ type.label }}
              </button>
            </div>
            <div class="pill-selector status">
              <button v-for="st in statusOptions" :key="st.value" :class="{ active: selectedStatus === st.value }"
                @click="selectedStatus = st.value; reGetData()">
                {{ st.label }}
              </button>
            </div>
          </div>

          <div class="search-wrapper unified-search-bar">
            <el-input v-model="searchKeyword" :placeholder="t('plaza.searchPlaceholder')"
              @input="handleSearch">
              <template #prefix><SearchIcon /></template>
            </el-input>
          </div>
        </div>

        <!-- 瀑布流内容区 -->
        <div v-if="!loading && hasError" class="empty-state">
          <p class="empty-text">{{ t('common.errors.loadFailed') }}</p>
          <button class="empty-action-btn" @click="getData">{{ t('common.retry') }}</button>
        </div>

        <div v-else-if="!loading && dataList.length === 0" class="empty-state">
          <p class="empty-text">{{ t('plaza.noData') }}</p>
          <button class="empty-action-btn" @click="toSet">{{ t('plaza.publishFirst') }}</button>
        </div>

        <div v-else class="plaza-grid">
          <div class="waterfall-layout">
            <div v-for="(col, colIdx) in [leftList, rightList]" :key="colIdx" class="waterfall-col">
              <div v-for="(item, index) in col" :key="item.id" class="demand-node group ihui-ai-card-hover"
                :style="{ animationDelay: `${Number(index) * 0.1}s` }" @click="showDialog(item)">
                <div class="node-header">
                  <div class="user-meta">
                    <img :src="item.avatar || defaultAvatar" :alt="item.username || '用户头像'" class="avatar" loading="lazy" />
                    <span class="name">{{ item.userName || t('plaza.anonymous') }}</span>
                  </div>
                  <span class="status-tag" :class="getStatusType(item.status)">
                    {{ getStatusText(item.status).toUpperCase() }}
                  </span>
                </div>

                <div class="node-body">
                  <h3 class="title">{{ item.title }}</h3>
                  <p class="desc">{{ item.description }}</p>
                  <div class="category-pill" v-if="item.category">
                    {{ item.category.toUpperCase() }}
                  </div>
                </div>

                <div class="node-footer">
                  <div class="stats">
                    <span class="stat"><el-icon>
                        <Eye />
                      </el-icon> {{ item.viewCount }}</span>
                    <span class="stat"><el-icon>
                        <MessageSquare />
                      </el-icon> {{ item.commentCount }}</span>
                  </div>
                  <span class="time">{{ formatTime(item.createTime).toUpperCase() }}</span>
                </div>
                <div class="node-glitch"></div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="loading" class="loading-status">
          <div class="dna-loader"></div>
          <span>{{ t('plaza.loading') }}</span>
        </div>
      </div>

      <!-- 发布表单重塑 -->
      <div v-else class="publish-portal ihui-ai-fade-in-top-animation">
        <section class="form-container card-glass">
          <div class="form-header">
            <el-icon>
              <Plus />
            </el-icon>
            <h2>{{ t('plaza.createNew') }}</h2>
          </div>
          <el-form :model="needForm" label-position="top" class="tech-form">
            <el-form-item :label="t('plaza.needTitle')">
              <el-input v-model="needForm.title" :placeholder="t('plaza.form.titlePlaceholder')" />
            </el-form-item>

            <div class="form-row">
              <el-form-item :label="t('plaza.needType')">
                <el-select v-model="needForm.type" :placeholder="t('plaza.selectType')">
                  <el-option :label="t('plaza.types.development')" value="1" />
                  <el-option :label="t('plaza.types.design')" value="2" />
                  <el-option :label="t('plaza.types.business')" value="3" />
                </el-select>
              </el-form-item>
              <el-form-item :label="t('plaza.needCategory')">
                <el-select v-model="needForm.category" :placeholder="t('plaza.selectCategory')">
                  <el-option v-for="c in categoryList" :key="c.id" :label="c.name" :value="c.id" />
                </el-select>
              </el-form-item>
            </div>

            <el-form-item :label="t('plaza.needDescription')">
              <el-input v-model="needForm.description" type="textarea" :rows="6"
                :placeholder="t('plaza.form.descriptionPlaceholder')" />
            </el-form-item>

            <div class="form-actions">
              <button class="btn-transmit" :disabled="submitting" @click.prevent="submitNeed">
                {{ submitting ? t('plaza.submitting') : t('plaza.submit') }}
              </button>
              <el-button link @click="reback" class="btn-abort">{{ t('plaza.form.cancel') }}</el-button>
            </div>
          </el-form>
        </section>
      </div>
    </div>

    <!-- 弹窗样式完全对齐工业风 -->
    <el-dialog v-model="showDialogVisible" :title="centerInfo.title" width="700px" class="tech-dialog">
      <div class="dialog-node-content">
        <div class="detail-header">
          <div class="detail-user">
            <img :src="centerInfo.avatar || defaultAvatar" :alt="centerInfo.username || '用户头像'" class="detail-avatar" loading="lazy" />
            <span class="detail-username">{{ centerInfo.userName || 'Anonymous' }}</span>
          </div>
          <span class="status-tag" :class="getStatusType(centerInfo.status || 0)">
            {{ getStatusText(centerInfo.status || 0) }}
          </span>
        </div>
        <h3 class="detail-title">{{ centerInfo.title }}</h3>
        <p class="detail-desc">{{ centerInfo.description }}</p>
        <div class="detail-meta">
          <div class="detail-tags">
            <el-tag v-if="centerInfo.category" size="small" type="info">{{ centerInfo.category }}</el-tag>
            <el-tag v-if="centerInfo.type" size="small" type="info">{{ centerInfo.type }}</el-tag>
          </div>
          <div class="detail-stats">
            <span><el-icon><Eye /></el-icon> {{ centerInfo.viewCount || 0 }}</span>
            <span><el-icon><MessageSquare /></el-icon> {{ centerInfo.commentCount || 0 }}</span>
            <span class="detail-time">{{ formatTime(centerInfo.createTime) }}</span>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { logger } from '@/utils/logger'
import {
  ArrowLeft, Plus, Eye, MessageSquare
} from '@/lib/lucide-fallback'
import SearchIcon from '@/components/common/SearchIcon.vue'
import {
  getDemandsList,
  createDemand,
  type PlazaDemand,
} from '@/api/xuqiu'
import { useApiError } from '@/composables/useApiError'
import { useSEO } from '@/composables/useSEO'

useSEO({
  title: '需求广场 - 智汇AI社区',
  description: '智汇AI社区需求广场，发布和浏览AI需求，寻找AI解决方案',
  keywords: '需求广场,AI需求,AI解决方案,智汇AI',
  ogTitle: '需求广场 - 智汇AI社区',
  ogDescription: '智汇AI社区需求广场，发布和浏览AI需求，寻找AI解决方案',
  canonical: 'https://www.zhihui-ai.com/plaza'
})

/** 需求列表项：与后端 PlazaDemand 一致 */
type DemandItem = PlazaDemand

const { t } = useI18n()
const _router = useRouter()
const { loading: _apiLoading, execute: _executeApi } = useApiError({ showMessage: true })
const loading = ref(false)
const hasError = ref(false)

const showSetPath = ref(false)
const selectedTypes = ref('')
const selectedStatus = ref('2')
const searchKeyword = ref('')
const dataList = ref<DemandItem[]>([])
const leftList = ref<DemandItem[]>([])
const rightList = ref<DemandItem[]>([])
const showDialogVisible = ref(false)
const centerInfo = ref<Partial<DemandItem>>({})
const defaultAvatar = 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'

const types = [
  { value: '', label: t('plaza.all') },
  { value: '1', label: t('plaza.type1') },
  { value: '2', label: t('plaza.type2') },
  { value: '3', label: t('plaza.type3') },
]

const statusOptions = [
  { value: '2', label: t('plaza.ongoing') },
  { value: '1', label: t('plaza.completed') },
  { value: '9', label: t('plaza.myNeeds') },
]

const categoryList = computed(() => [
  { id: '1', name: t('plaza.aiChat') },
  { id: '2', name: t('plaza.aiDrawing') },
  { id: '3', name: t('plaza.aiVideo') },
  { id: '4', name: t('plaza.aiWriting') },
  { id: '5', name: t('plaza.aiCoding') },
])

const needForm = ref({ title: '', type: '', category: '', description: '' })
const submitting = ref(false)

const getData = async () => {
  loading.value = true
  hasError.value = false
  try {
    const response = await getDemandsList({
      page: 1,
      pageSize: 20,
      category: selectedTypes.value,
      status: selectedStatus.value === '9' ? undefined : Number(selectedStatus.value),
      keyword: searchKeyword.value || undefined,
    })

    if (response && response.success && response.data) {
      // 支持多种数据格式：直接数组、对象带list属性、分页数据结构
      let rawList: DemandItem[] = []
      const responseData = response.data as { list?: DemandItem[]; records?: DemandItem[] } | DemandItem[]

      if (Array.isArray(responseData)) {
        rawList = responseData
      } else if (responseData.list && Array.isArray(responseData.list)) {
        rawList = responseData.list
      } else if (responseData.records && Array.isArray(responseData.records)) {
        rawList = responseData.records
      }

      const list: DemandItem[] = rawList.map((item) => ({
        ...item,
        id: Number(item.id),
        viewCount: item.viewCount || 0,
        commentCount: item.commentCount || 0,
      }))

      dataList.value = list
      leftList.value = list.filter((_, i) => i % 2 === 0)
      rightList.value = list.filter((_, i) => i % 2 !== 0)

    } else {
      logger.warn('[Plaza] API returned no data or failed:', response?.message)
      dataList.value = []
      leftList.value = []
      rightList.value = []
    }
  } catch (error) {
    logger.error('[Plaza] Failed to fetch demands:', error)
    dataList.value = []
    leftList.value = []
    rightList.value = []
    hasError.value = true
  } finally {
    loading.value = false
  }
}

const reGetData = () => getData()
let searchTimer: ReturnType<typeof setTimeout> | null = null
const handleSearch = () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => getData(), 300)
}
const toSet = () => showSetPath.value = true
const reback = () => { showSetPath.value = false; needForm.value = { title: '', type: '', category: '', description: '' } }

const getStatusType = (s: number) => s === 1 ? 'completed' : 'ongoing'
const getStatusText = (s: number) => s === 1 ? t('plaza.completed') : t('plaza.ongoing')
const formatTime = (t: string | number) => t != null ? new Date(t).toLocaleDateString() : 'N/A'

const showDialog = (item: DemandItem) => { centerInfo.value = item; showDialogVisible.value = true }
const submitNeed = async () => {
  if (!needForm.value.title) return ElMessage.warning(t('msg.plaza.titleRequired'))
  submitting.value = true
  try {
    const res = await createDemand({
      title: needForm.value.title,
      description: needForm.value.description || undefined,
      type: needForm.value.type || undefined,
      category: needForm.value.category || undefined,
    })
    if (res.success) { ElMessage.success(t('msg.plaza.protocolPublished')); reback(); reGetData(); }
  } finally { submitting.value = false }
}

onMounted(() => getData())
</script>

<style scoped lang="scss">
@use '@/styles/_breakpoints.scss' as bp;

.plaza-page {
  min-height: 100vh;
  background-color: var(--el-bg-color-page);
  color: var(--el-text-color-primary);
  position: relative;
  overflow-x: hidden;
}

.plaza-background {
  position: fixed;
  inset: 0;
  z-index: var(--z-0);

  .glow-orb {
    position: absolute;
    top: -10%;
    left: 50%;
    transform: translateX(-50%);
    width: 800px;
    height: 400px;
    background: rgba(var(--el-color-primary-rgb), 0.03);
    filter: blur(60px);
  }
}

.container {
  position: relative;
  z-index: var(--z-base);
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 40px;

  @include bp.tablet-down {
    padding: 0 24px;
  }
}

.hub-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 40px 0;
  font-family: var(--font-family-mono);

  .back-link {
    color: var(--el-text-color-secondary);
    font-size: 11px;
    font-weight: 800;

    &:hover {
      color: var(--el-text-color-primary);
    }
  }

  .plaza-id {
    font-size: 10px;
    color: var(--el-text-color-placeholder);
    font-weight: 800;
    letter-spacing: 2px;
  }
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 40px 0 80px;

  @include bp.tablet-down {
    flex-direction: column;
    align-items: flex-start;
    gap: 32px;
  }

  h1 {
    font-size: 48px;
    font-weight: 900;
    letter-spacing: -2px;
    line-height: 1;
    color: var(--el-text-color-primary);
  }

  .subtitle {
    color: var(--el-text-color-regular);
    font-size: 18px;
    max-width: 600px;
  }

  .btn-primary-tech {
    /* 浅色模式：深色底 + 白字（ 覆盖全局 button 文字色） */
    background: var(--color-dark-bg-4);
    color: var(--el-bg-color);
    border: none;
    padding: 16px 32px;
    border-radius: var(--global-border-radius);
    font-family: var(--font-family-mono);
    font-size: 13px;
    font-weight: 900;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: all 0.3s;

    .el-icon {
      color: inherit;
    }

    &:hover {
      background: var(--el-color-primary);
      color: var(--el-bg-color);
      transform: translateY(-2px);
    }
  }

  .btn-outline-tech {
    background: transparent;
    color: var(--el-text-color-primary);
    border: var(--unified-border);
    padding: 16px 32px;
    border-radius: var(--global-border-radius);
    font-family: var(--font-family-mono);
    font-size: 13px;
    font-weight: 900;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      border-color: var(--el-text-color-primary);
    }
  }
}

/* 深色模式：发布按钮保持深色底 + 白字（ 覆盖全局） */
:where(html.dark) .plaza-page .page-header .btn-primary-tech {
  background: var(--color-dark-bg-4);
  color: var(--el-bg-color);
}
:where(html.dark) .plaza-page .page-header .btn-primary-tech:hover {
  background: var(--el-color-primary);
  color: var(--el-bg-color);
}

.console-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 60px;

  @include bp.tablet-down {
    flex-direction: column;
    align-items: flex-start;
    gap: 24px;
  }

  .filter-group {
    display: flex;
    gap: 24px;
  }

  .pill-selector {
    background: var(--el-fill-color-extra-light);
    padding: 4px;
    border-radius: var(--global-border-radius);
    border: var(--unified-border);

    button {
      background: none;
      border: none;
      color: var(--el-text-color-secondary);
      padding: 8px 20px;
      border-radius: var(--global-border-radius);
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s;

      &.active {
        background: var(--el-text-color-primary);
        color: var(--el-bg-color-page);
      }
    }
  }

  .search-wrapper {
    width: 300px;
  }
}

html.dark .pill-selector button.active {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 40px;
  text-align: center;

  .empty-text {
    font-size: 16px;
    color: var(--el-text-color-secondary);
    margin-bottom: 24px;
  }

  .empty-action-btn {
    background: var(--el-text-color-primary);
    color: var(--el-bg-color-page);
    border: none;
    padding: 14px 28px;
    border-radius: var(--global-border-radius);
    font-family: var(--font-family-mono);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      background: var(--el-color-primary);
      color: var(--el-bg-color-page);
      transform: translateY(-2px);
    }
  }
}

html.dark .empty-action-btn {
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);

  &:hover {
    background: var(--el-color-primary);
    color: var(--el-text-color-primary);
  }
}

.plaza-grid {
  margin-bottom: 120px;
}

.waterfall-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;

  @include bp.tablet-down {
    grid-template-columns: 1fr;
  }
}

.waterfall-col {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

:where(.demand-node) {
  background: var(--el-bg-color);
  border: var(--unified-border);
  padding: 32px;
  border-radius: var(--global-border-radius);
  position: relative;
  overflow: hidden;
  transition: all 0.4s;

  &:hover {
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    background: var(--el-fill-color-extra-light);
    transform: translateY(-4px);
  }

  .node-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    .user-meta {
      display: flex;
      align-items: center;
      gap: 12px;

      .avatar {
        width: 24px;
        height: 24px;
        border-radius: var(--global-border-radius);
        border: var(--unified-border);
      }

      .name {
        font-size: 12px;
        font-weight: 700;
        color: var(--el-text-color-regular);
      }
    }

    .status-tag {
      font-family: var(--font-family-mono);
      font-size: 12px;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: var(--global-border-radius);

      &.ongoing {
        color: var(--el-color-primary);
        border: var(--unified-border);
      }

      &.completed {
        color: var(--el-color-success);
        border: var(--unified-border);
      }
    }
  }

  .node-body {
    .title {
      font-size: 20px;
      font-weight: 800;
      margin-bottom: 12px;
      color: var(--el-text-color-primary);
    }

    .desc {
      font-size: 14px;
      color: var(--el-text-color-secondary);
      line-height: 1.6;
      margin-bottom: 24px;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .category-pill {
      font-family: var(--font-family-mono);
      font-size: 12px;
      color: var(--el-text-color-placeholder);
      border: var(--unified-border);
      padding: 2px 8px;
      border-radius: var(--global-border-radius);
      width: fit-content;
    }
  }

  .node-footer {
    margin-top: 32px;
    padding-top: 20px;
    border-top: var(--unified-border);
    display: flex;
    justify-content: space-between;
    align-items: center;

    .stats {
      display: flex;
      gap: 16px;

      .stat {
        font-size: 12px;
        color: var(--el-text-color-placeholder);
        display: flex;
        align-items: center;
        gap: 6px;
      }
    }

    .time {
      font-family: var(--font-family-mono);
      font-size: 12px;
      color: var(--el-text-color-placeholder);
      font-weight: 800;
    }
  }
}

.publish-portal {
  max-width: 800px;
  margin: 0 auto 120px;

  .form-container {
    background: var(--el-bg-color);
    border: var(--unified-border);
    padding: 60px;
    border-radius: var(--global-border-radius);
  }

  .form-header {
    display: flex;
    align-items: center;
    gap: 16px;
    color: var(--el-color-primary);
    margin-bottom: 48px;

    h2 {
      color: var(--el-text-color-primary);
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 1px;
    }
  }
}

:deep(.tech-form) {
  .el-form-item__label {
    font-family: var(--font-family-mono);
    font-size: 11px;
    font-weight: 800;
    color: var(--el-text-color-placeholder);
    letter-spacing: 1px;
  }

  .el-input__wrapper,
  .el-textarea__inner,
  .el-select__wrapper {
    background: var(--el-fill-color-extra-light);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    box-shadow: none;
  }

  .el-input__inner,
  .el-textarea__inner {
    color: var(--el-text-color-primary);
    font-family: var(--font-family-mono);
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
}

.form-actions {
  display: flex;
  align-items: center;
  gap: 32px;
  margin-top: 60px;

  .btn-transmit {
    background: var(--el-text-color-primary);
    color: var(--el-bg-color-page);
    border: none;
    padding: 18px 48px;
    border-radius: var(--global-border-radius);
    font-family: var(--font-family-mono);
    font-size: 13px;
    font-weight: 900;
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      background: var(--el-color-primary);
      color: var(--el-bg-color-page);
      transform: translateY(-2px);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .btn-abort {
    font-family: var(--font-family-mono);
    font-size: 11px;
    color: var(--el-text-color-placeholder);
    font-weight: 800;
  }
}


// 加载状态样式
.loading-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;

  .dna-loader {
    width: 48px;
    height: 48px;
    border: 3px solid var(--el-border-color-lighter);
    border-top-color: var(--el-color-primary);
    border-radius: var(--global-border-radius);
    animation: spin 1s linear infinite;
    margin-bottom: 24px;
  }

  span {
    font-family: var(--font-family-mono);
    font-size: 12px;
    font-weight: 700;
    color: var(--el-text-color-secondary);
    letter-spacing: 2px;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// 对话框样式
:deep(.tech-dialog) {
  .el-dialog__header {
    border-bottom: var(--unified-border-bottom);
    padding: 20px 24px;

    .el-dialog__title {
      font-weight: 800;
      font-size: 18px;
    }
  }

  .el-dialog__body {
    padding: 24px;
  }
}

// 详情弹窗内容样式
:where(.dialog-node-content) {
  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;

    .detail-user {
      display: flex;
      align-items: center;
      gap: 12px;

      .detail-avatar {
        width: 32px;
        height: 32px;
        border-radius: var(--global-border-radius);
        border: var(--unified-border);
      }

      .detail-username {
        font-size: 14px;
        font-weight: 700;
        color: var(--el-text-color-regular);
      }
    }
  }

  .detail-title {
    font-size: 20px;
    font-weight: 800;
    margin-bottom: 12px;
    color: var(--el-text-color-primary);
  }

  .detail-desc {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    line-height: 1.8;
    margin-bottom: 24px;
  }

  .detail-meta {
    padding-top: 16px;
    border-top: var(--unified-border);

    .detail-tags {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .detail-stats {
      display: flex;
      align-items: center;
      gap: 16px;
      font-size: 12px;
      color: var(--el-text-color-placeholder);

      span {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .detail-time {
        margin-left: auto;
        font-family: var(--font-family-mono);
      }
    }
  }
}
</style>

<style lang="scss">
/* 不 scoped：强制发布按钮及内部文字、图标为白色，覆盖全局 button 颜色 */
:where(.plaza-page) :where(.page-header) .header-actions button.btn-primary-tech,
:where(.plaza-page) :where(.page-header) .header-actions button.btn-primary-tech span,
:where(.plaza-page) :where(.page-header) .header-actions button.btn-primary-tech .el-icon {
  color: var(--el-bg-color);
}
:where(.plaza-page) :where(.page-header) .header-actions button.btn-primary-tech:hover,
:where(.plaza-page) :where(.page-header) .header-actions button.btn-primary-tech:hover span,
:where(.plaza-page) :where(.page-header) .header-actions button.btn-primary-tech:hover .el-icon {
  color: var(--el-bg-color);
}
</style>
