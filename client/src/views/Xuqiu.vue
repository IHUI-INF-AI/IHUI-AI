<template>
  <div class="xuqiu-container page-grid radius-auto">
    <!-- 分类栏区域 -->
    <div class="category-section radius-auto">
      <XuqiuTab
        :active-category="activeCategory"
        @update:active-category="activeCategory = $event"
      />
    </div>

    <!-- 内容区域 -->
    <div class="content-section radius-auto">
      <div class="demand-list" ref="demandListRef">
        <!-- 加载状态 -->
        <div v-if="loading" class="loading-container">
          <SkeletonLoader type="list" :count="5" :show-avatar="true" animated />
        </div>

        <!-- 数据列表 -->
        <template v-else-if="!loading">
          <el-card
            v-for="item in displayedDemands"
            :key="item.id"
            v-memo="[
              item.id,
              item.status,
              item.title,
              item.viewCount,
              item.commentCount,
              item.likeCount,
            ]"
            class="demand-item radius-auto"
          >
            <div class="demand-header">
              <div class="user-info">
                <div class="avatar-wrapper">
                  <el-avatar :src="item.avatar" :size="40" :alt="item.username" class="demand-avatar" />
                </div>
                <span class="username">{{ item.username }}</span>
              </div>
              <div class="demand-time">{{ formatTime(item.createTime) }}</div>
            </div>

            <div class="demand-content">
              <div class="demand-title">
                <span class="title-text">{{ item.title }}</span>
                <div class="demand-tags" v-if="item.category || item.type">
                  <el-tag v-if="item.category" size="small" type="info">{{ item.category }}</el-tag>
                  <el-tag v-if="item.type" size="small" type="info">{{ item.type }}</el-tag>
                </div>
              </div>
              <p class="demand-description">{{ item.description }}</p>

              <div class="demand-meta">
                <span
                  class="status"
                  :class="{
                    'status-completed': item.status === 1,
                    'status-in-progress': item.status === 2,
                    'status-pending': item.status === 0,
                  }"
                >
                  {{ getStatusText(item.status) }}
                </span>
                <div class="demand-stats">
                  <span>
                    <i class="el-icon-view"></i>
                    {{ item.viewCount }}
                  </span>
                  <span>
                    <i class="el-icon-chat-dot-round"></i>
                    {{ item.commentCount }}
                  </span>
                  <span>
                    <i class="el-icon-star"></i>
                    {{ (item as { likeCount?: number }).likeCount ?? 0 }}
                  </span>
                </div>
                <div class="demand-actions">
                  <el-button @click="viewDetail(item)">
                    {{ t('common.viewDetails') }}
                  </el-button>
                </div>
              </div>
            </div>
          </el-card>

          <div v-if="displayedDemands.length === 0" class="empty-state">
            <el-empty :description="t('xuqiu.noDemands')" />
          </div>
        </template>
      </div>
    </div>

    <!-- 分页器区域 -->
    <div class="pagination-section radius-auto">
      <div class="pagination-container radius-auto">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next"
          :prev-icon="null"
          :next-icon="null"
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <!-- 发布需求弹窗 -->
    <el-dialog v-model="showSetPath" :title="t('xuqiu.publishDemand')" width="500px">
      <el-form :model="demandForm" :rules="demandRules" ref="demandFormRef" label-width="80px">
        <el-form-item :label="t('xuqiu.fieldTitle')" prop="title">
          <el-input v-model="demandForm.title" :placeholder="t('xuqiu.enterTitle')" />
        </el-form-item>

        <el-form-item :label="t('xuqiu.description')" prop="description">
          <el-input
            v-model="demandForm.description"
            type="textarea"
            :rows="4"
            :placeholder="t('xuqiu.enterDescription')"
          />
        </el-form-item>

        <el-form-item :label="t('xuqiu.tags')" prop="tags">
          <el-select
            v-model="demandForm.tags"
            multiple
            :placeholder="t('xuqiu.selectTags')"
            style="width: 100%"
          >
            <el-option
              v-for="tag in tagOptions"
              :key="tag.value"
              :label="tag.label"
              :value="tag.value"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showSetPath = false">{{ t('common.cancel') }}</el-button>
          <el-button type="primary" @click="submitDemand" :loading="submitLoading">
            {{ t('common.submit') }}
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">

import { ref, watch, onMounted, nextTick } from 'vue'
import { useCleanup } from '@/composables/useCleanup'
import SkeletonLoader from '@/components/SkeletonLoader.vue'
import { logger } from '../utils/logger'
import XuqiuTab from '@/components/XuqiuTab.vue'
import useLang from '@/composables/useLang'
import { useXuqiuList } from '@/composables/xuqiu/useXuqiuList'
import { useXuqiuForm } from '@/composables/xuqiu/useXuqiuForm'
import { useXuqiuGrid } from '@/composables/xuqiu/useXuqiuGrid'
import type { DemandItem } from '@/composables/xuqiu/useXuqiuList'
import { useRouter } from 'vue-router'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { useSEO } from '@/composables/useSEO'

useSEO({
  title: '需求发布 - 智汇AI社区',
  description: '智汇AI社区需求发布平台，发布您的AI需求，获取专业解决方案',
  keywords: '需求发布,AI需求,智汇AI',
  ogTitle: '需求发布 - 智汇AI社区',
  ogDescription: '智汇AI社区需求发布平台，发布您的AI需求，获取专业解决方案',
  canonical: 'https://www.zhihui-ai.com/xuqiu'
})

const { t } = useLang

const cleanup = useCleanup()

// 使用 Composables
const demandListRef = ref<HTMLElement | null>(null)

const {
  loading,
  dataList,
  currentPage,
  pageSize,
  total,
  activeCategory,
  displayedDemands,
  formatTime,
  getStatusText,
  getData,
  handlePageChange,
} = useXuqiuList({
  onDataLoaded: () => {
    nextTick(() => {
      const id = requestAnimationFrame(() => {
        rafIds.delete(id)
        gridComposable.calculateGridRows(pageSize, loading, dataList, getData)
      })
      rafIds.add(id)
    })
  },
})

const {
  showSetPath,
  submitLoading,
  demandFormRef,
  demandForm,
  demandRules,
  tagOptions,
  submitDemand: submitDemandForm,
  resetForm: _resetForm,
} = useXuqiuForm({
  onSuccess: () => {
    getData()
  },
})

const gridComposable = useXuqiuGrid({
  demandListRef,
  onPageSizeChange: () => {
    // pageSize 变化已在 useXuqiuList 中处理
  },
})

// 包装 submitDemand 以在成功后重新加载数据
const submitDemand = async (): Promise<void> => {
  await submitDemandForm()
}

const router = useRouter()
const { showSuccess: _showSuccess, showError } = useOperationFeedback()

// 查看详情 - 完整实现
const viewDetail = async (item: DemandItem): Promise<void> => {
  try {
    // 跳转到需求详情页
    router.push(`/xuqiu/${item.id}`)
  } catch (error: unknown) {
    logger.error('Failed to navigate to demand details:', error)
    showError(t('xuqiu.viewDetailFailed'))
  }
}

// 优化分页器显示
const optimizePaginationDisplay = (): void => {
  gridComposable.optimizePaginationDisplay()
}

// 监听total变化，自动优化分页器显示
watch(
  () => total.value,
  () => {
    optimizePaginationDisplay()
  },
  { flush: 'post' }
)

// 组件挂载时获取数据
onMounted(async () => {
  try {
    logger.info(t('xuqiu.logger.componentMounted'))
    await getData()
    optimizePaginationDisplay()

    // 等待DOM更新后立即计算网格行数
    await nextTick()
    if (typeof requestAnimationFrame !== 'undefined') {
      const id1 = requestAnimationFrame(() => {
        rafIds.delete(id1)
        gridComposable.calculateGridRows(pageSize, loading, dataList, getData)
        const id2 = requestAnimationFrame(() => {
          rafIds.delete(id2)
          gridComposable.calculateGridRows(pageSize, loading, dataList, getData)
        })
        rafIds.add(id2)
      })
      rafIds.add(id1)
    } else {
      // 降级方案
      setTimeout(() => {
        gridComposable.calculateGridRows(pageSize, loading, dataList, getData)
      }, 0)
    }

    // 初始化网格观察器
    gridComposable.initGridObserver()
  } catch (error) {
    logger.error(t('xuqiu.logger.mountError'), error)
    loading.value = false
  }
})

// 组件卸载时清理资源
const rafIds = new Set<number>()

cleanup.add(() => {
  gridComposable.cleanup()
  rafIds.forEach(id => cancelAnimationFrame(id))
  rafIds.clear()
})
</script>

<style scoped lang="scss">
@use './Xuqiu.vue.styles';
</style>
