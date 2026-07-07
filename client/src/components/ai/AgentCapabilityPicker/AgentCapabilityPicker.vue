<script setup lang="ts">
/**
 * AgentCapabilityPicker — 统一 AI 能力选择器
 *
 * 将智能体、Skills、脚本插件、浏览器自动化、计算机控制、MCP 工具
 * 整合为统一的分类列表选择器, 嵌入 AI 对话输入框。
 *
 * 特性:
 * - 7 大分类 (智能体/Skills/插件/浏览器/计算机/MCP/自动匹配)
 * - 实时搜索过滤
 * - AI 自动匹配开关
 * - 选中状态高亮
 * - 浅色/暗色模式适配
 */
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Bot, Zap, Terminal, Globe, Monitor, Plug, Sparkles,
  Search, X, Check, ChevronRight,
} from '@/lib/lucide-fallback'
import type { Component } from 'vue'
import { useCapabilities } from '@/composables/useCapabilities'
import type { CapabilityItem, CapabilityCategory } from '@/api/capabilities'
import { logger } from '@/utils/logger'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  modelValue: boolean
  selectedCapabilityId?: string
  autoMatchEnabled?: boolean
}>(), {
  selectedCapabilityId: '',
  autoMatchEnabled: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:selectedCapabilityId', id: string): void
  (e: 'update:autoMatchEnabled', enabled: boolean): void
  (e: 'select', item: CapabilityItem | null): void
}>()

// ── composable ──
const {
  categories,
  allItems,
  loading,
  searchKeyword,
  selectedCapability,
  autoMatchEnabled,
  loadCapabilities,
  selectCapability,
  autoMatch,
} = useCapabilities()

// ── 本地状态 ──
const activeCategoryId = ref<string>('')

// ── 分类图标映射 ──
const categoryIcons: Record<string, Component> = {
  agents: Bot,
  skills: Zap,
  plugins: Terminal,
  browser: Globe,
  computer: Monitor,
  mcp: Plug,
  auto: Sparkles,
}

// ── 计算属性 ──
const filteredCategories = computed<CapabilityCategory[]>(() => {
  if (!searchKeyword.value) {
    return categories.value.filter((c) => c.id === activeCategoryId.value || !activeCategoryId.value)
  }
  // 搜索模式: 返回所有分类, 但 items 过滤
  const kw = searchKeyword.value.toLowerCase()
  return categories.value
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          item.name.toLowerCase().includes(kw) ||
          item.description.toLowerCase().includes(kw) ||
          item.tags.some((tag) => tag.toLowerCase().includes(kw))
      ),
    }))
    .filter((cat) => cat.items.length > 0)
})

const currentItems = computed<CapabilityItem[]>(() => {
  if (searchKeyword.value) {
    return filteredCategories.value.flatMap((c) => c.items)
  }
  const cat = categories.value.find((c) => c.id === activeCategoryId.value)
  return cat?.items || []
})

const totalCount = computed(() => allItems.value.length)

// ── 方法 ──
function selectCategory(catId: string) {
  activeCategoryId.value = catId
  searchKeyword.value = ''
}

function handleSelectItem(item: CapabilityItem) {
  selectCapability(item)
  emit('update:selectedCapabilityId', item.id)
  emit('select', item)
  emit('update:modelValue', false)
}

function handleClose() {
  emit('update:modelValue', false)
}

function toggleAutoMatch() {
  autoMatchEnabled.value = !autoMatchEnabled.value
  emit('update:autoMatchEnabled', autoMatchEnabled.value)
}

function getIconForCategory(catId: string): Component {
  return categoryIcons[catId] || Sparkles
}

function getIconForItem(item: CapabilityItem): Component {
  return categoryIcons[item.category] || Sparkles
}

// ── 生命周期 ──
onMounted(() => {
  if (categories.value.length === 0) {
    loadCapabilities()
  }
  // 默认选中第一个分类
  if (categories.value.length > 0 && !activeCategoryId.value) {
    activeCategoryId.value = categories.value[0].id
  }
})

// 监听分类加载完成
watch(categories, () => {
  if (categories.value.length > 0 && !activeCategoryId.value) {
    activeCategoryId.value = categories.value[0].id
  }
}, { immediate: true })

// 同步外部 selectedCapabilityId
watch(() => props.selectedCapabilityId, (id) => {
  if (id && id !== selectedCapability.value?.id) {
    const item = allItems.value.find((i) => i.id === id)
    if (item) selectCapability(item)
  }
}, { immediate: true })
</script>

<template>
  <div class="agent-capability-picker" :class="{ 'is-loading': loading }">
    <!-- 搜索栏 -->
    <div class="acp-search-bar">
      <el-icon class="acp-search-icon"><Search /></el-icon>
      <input
        v-model="searchKeyword"
        class="acp-search-input"
        :placeholder="t('aiChatInput.searchCapability')"
        type="text"
      />
      <button
        v-if="searchKeyword"
        class="acp-search-clear"
        :aria-label="t('common.clear')"
        @click="searchKeyword = ''"
      >
        <el-icon><X /></el-icon>
      </button>
    </div>

    <!-- 主体: 左侧分类 + 右侧列表 -->
    <div class="acp-body">
      <!-- 左侧分类导航 -->
      <div class="acp-sidebar" v-if="!searchKeyword">
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="acp-cat-btn"
          :class="{ 'is-active': activeCategoryId === cat.id }"
          @click="selectCategory(cat.id)"
        >
          <el-icon class="acp-cat-icon"><component :is="getIconForCategory(cat.id)" /></el-icon>
          <span class="acp-cat-name">{{ cat.name }}</span>
          <span class="acp-cat-count">{{ cat.items.length }}</span>
        </button>
      </div>

      <!-- 右侧能力列表 -->
      <div class="acp-list">
        <div v-if="loading" class="acp-loading">
          <span>{{ t('common.loading') }}</span>
        </div>

        <div v-else-if="currentItems.length === 0" class="acp-empty">
          <span>{{ t('aiChatInput.noCapabilityFound') }}</span>
        </div>

        <template v-else>
          <!-- 搜索结果: 按分类分组显示 -->
          <template v-if="searchKeyword">
            <div
              v-for="cat in filteredCategories"
              :key="cat.id"
              class="acp-group"
            >
              <div class="acp-group-header">
                <el-icon class="acp-group-icon"><component :is="getIconForCategory(cat.id)" /></el-icon>
                <span class="acp-group-name">{{ cat.name }}</span>
                <span class="acp-group-count">{{ cat.items.length }}</span>
              </div>
              <div
                v-for="item in cat.items"
                :key="item.id"
                class="acp-item"
                :class="{ 'is-selected': selectedCapability?.id === item.id }"
                @click="handleSelectItem(item)"
              >
                <div class="acp-item-icon">
                  <el-icon><component :is="getIconForItem(item)" /></el-icon>
                </div>
                <div class="acp-item-content">
                  <div class="acp-item-name">{{ item.name }}</div>
                  <div class="acp-item-desc">{{ item.description }}</div>
                </div>
                <div class="acp-item-tags" v-if="item.tags.length > 0">
                  <span v-for="tag in item.tags.slice(0, 3)" :key="tag" class="acp-tag">{{ tag }}</span>
                </div>
                <el-icon v-if="selectedCapability?.id === item.id" class="acp-item-check"><Check /></el-icon>
              </div>
            </div>
          </template>

          <!-- 非搜索: 平铺列表 -->
          <template v-else>
            <div
              v-for="item in currentItems"
              :key="item.id"
              class="acp-item"
              :class="{ 'is-selected': selectedCapability?.id === item.id }"
              @click="handleSelectItem(item)"
            >
              <div class="acp-item-icon">
                <el-icon><component :is="getIconForItem(item)" /></el-icon>
              </div>
              <div class="acp-item-content">
                <div class="acp-item-name">{{ item.name }}</div>
                <div class="acp-item-desc">{{ item.description }}</div>
              </div>
              <div class="acp-item-tags" v-if="item.tags.length > 0">
                <span v-for="tag in item.tags.slice(0, 3)" :key="tag" class="acp-tag">{{ tag }}</span>
              </div>
              <el-icon v-if="selectedCapability?.id === item.id" class="acp-item-check"><Check /></el-icon>
            </div>
          </template>
        </template>
      </div>
    </div>

    <!-- 底部: 自动匹配开关 + 总计 -->
    <div class="acp-footer">
      <button
        class="acp-auto-toggle"
        :class="{ 'is-on': autoMatchEnabled }"
        @click="toggleAutoMatch"
      >
        <el-icon class="acp-auto-icon"><Sparkles /></el-icon>
        <span class="acp-auto-label">{{ t('aiChatInput.autoMatch') }}</span>
        <span class="acp-auto-switch" :class="{ 'is-on': autoMatchEnabled }">
          <span class="acp-auto-switch-knob"></span>
        </span>
      </button>
      <span class="acp-total">{{ totalCount }} {{ t('aiChatInput.capabilitiesUnit') }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.agent-capability-picker {
  display: flex;
  flex-direction: column;
  width: 420px;
  max-height: 480px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: var(--global-border-radius, 8px);
  overflow: hidden;

  &.is-loading {
    min-height: 200px;
  }
}

// ── 搜索栏 ──
.acp-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.acp-search-icon {
  color: var(--el-text-color-placeholder);
  flex-shrink: 0;
}

.acp-search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--el-text-color-primary);
  font-size: 13px;
  line-height: 1.5;

  &::placeholder {
    color: var(--el-text-color-placeholder);
  }
}

.acp-search-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--el-text-color-secondary);
  padding: 2px;
  border-radius: 4px;

  &:hover {
    color: var(--el-text-color-primary);
    background: var(--el-fill-color-light);
  }
}

// ── 主体 ──
.acp-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

// ── 左侧分类导航 ──
.acp-sidebar {
  display: flex;
  flex-direction: column;
  width: 120px;
  flex-shrink: 0;
  border-right: 1px solid var(--el-border-color-light);
  overflow-y: auto;
  padding: 6px 0;
}

.acp-cat-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--el-text-color-regular);
  font-size: 12px;
  text-align: left;
  transition: background-color 0.2s, color 0.2s;

  &:hover {
    background: var(--el-fill-color-light);
    color: var(--el-text-color-primary);
  }

  &.is-active {
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
  }
}

.acp-cat-icon {
  flex-shrink: 0;
}

.acp-cat-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acp-cat-count {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--el-text-color-placeholder);
  background: var(--el-fill-color);
  padding: 1px 5px;
  border-radius: 4px;
  min-width: 18px;
  text-align: center;
}

// ── 右侧能力列表 ──
.acp-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
}

.acp-loading,
.acp-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
}

// ── 搜索分组 ──
.acp-group {
  margin-bottom: 4px;
}

.acp-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 4px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.acp-group-icon {
  flex-shrink: 0;
}

.acp-group-name {
  flex: 1;
}

.acp-group-count {
  font-size: 10px;
  color: var(--el-text-color-placeholder);
}

// ── 能力项 ──
.acp-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.15s;
  border-left: 2px solid transparent;

  &:hover {
    background: var(--el-fill-color-light);
  }

  &.is-selected {
    background: var(--el-color-primary-light-9);
    border-left-color: var(--el-color-primary);
  }
}

.acp-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 6px;
  background: var(--el-fill-color);
  color: var(--el-text-color-regular);
  font-size: 14px;

  .acp-item.is-selected & {
    background: var(--el-color-primary-light-8);
    color: var(--el-color-primary);
  }
}

.acp-item-content {
  flex: 1;
  min-width: 0;
}

.acp-item-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acp-item-desc {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.acp-item-tags {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.acp-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.acp-item-check {
  flex-shrink: 0;
  color: var(--el-color-primary);
  font-size: 14px;
}

// ── 底部 ──
.acp-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-top: 1px solid var(--el-border-color-light);
}

.acp-auto-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--el-text-color-regular);
  font-size: 12px;
  padding: 2px 4px;

  &:hover {
    color: var(--el-text-color-primary);
  }

  &.is-on {
    color: var(--el-color-primary);
  }
}

.acp-auto-icon {
  font-size: 13px;
}

.acp-auto-label {
  font-weight: 500;
}

.acp-auto-switch {
  display: inline-flex;
  align-items: center;
  width: 28px;
  height: 16px;
  border-radius: 8px;
  background: var(--el-fill-color-dark);
  padding: 2px;
  transition: background-color 0.2s;

  &.is-on {
    background: var(--el-color-primary);
  }
}

.acp-auto-switch-knob {
  display: block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;

  .acp-auto-switch.is-on & {
    transform: translateX(12px);
  }
}

.acp-total {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
}
</style>
