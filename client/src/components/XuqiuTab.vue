<template>
  <div class="category-menu-container">
    <div class="category-menu-wrapper fenlei_btn_list">
      <!-- 分类标签 -->
      <div class="category-label">
        <span class="category-label-text">{{ t('xuqiuTab.categoryLabel') }}</span>
      </div>

      <div v-if="showAll || tabList.length > 0" class="menu-divider"></div>

      <div
        v-if="showAll"
        class="category-menu-item fenlei_btn"
        :class="{ 'selected active': all }"
        @click="selectAllTab"
      >
        <div class="menu-item-indicator"></div>
        <div class="menu-item-icon-wrapper">
          <img
            class="icon fenlei_icon"
            :src="
              all
                ? 'https://file.aizhs.top/sys-backs/2025/08/16/szdy_20250816161421A290.png'
                : 'https://file.aizhs.top/sys-backs/2025/08/16/qzdy_20250816161419A289.png'
            "
            :alt="t('xuqiuTab.all')"
            loading="lazy"
          />
        </div>
        <span class="menu-item-text">{{ t('xuqiuTab.all') }}</span>
      </div>

      <div
        class="category-menu-item fenlei_btn"
        v-for="item in tabList"
        :key="item.id"
        :class="{ 'selected active': tabValue.includes(item) }"
        @click="select(item)"
      >
        <div class="menu-item-indicator"></div>
        <div class="menu-item-icon-wrapper">
          <img
            class="icon fenlei_icon"
            :src="tabValue.includes(item) ? item.butUrl : item.field1"
            :alt="item.name"
            loading="lazy"
          />
        </div>
        <span class="menu-item-text">{{ item.name }}</span>
      </div>
      <div v-if="customize && tabList.length > 0" class="menu-divider"></div>

      <div v-if="loadError" class="category-error">
        <span class="category-error-text">{{ t('common.errors.fetchFailed') }}</span>
        <button class="category-error-retry" @click="getCategoryData()">{{ t('common.retry') }}</button>
      </div>

      <div
        v-if="customize"
        class="category-menu-item fenlei_btn"
        :class="{ 'selected active': addType }"
        @click="
          () => {
            addType = true
          }
        "
      >
        <div class="menu-item-indicator"></div>
        <div class="menu-item-icon-wrapper">
          <img
            class="icon fenlei_icon"
            src="https://file.aizhs.top/sys-backs/2025/08/16/szdy_20250816161421A290.png"
            :alt="t('xuqiuTab.custom')"
            loading="lazy"
          />
        </div>
        <span class="menu-item-text">{{ t('xuqiuTab.custom') }}</span>
      </div>
    </div>
    <div
      class="mask"
      v-if="addType"
      @click="
        () => {
          addType = false
        }
      "
    ></div>
    <div class="add_type" v-if="addType">
      <div class="title">{{ t('xuqiuTab.customTitle') }}</div>
      <input
        class="input"
        v-model="value"
        link
        maxlength="4"
        :placeholder="t('xuqiuTab.customPlaceholder')"
      />
      <div class="btn selected" @click="add">
        <span>{{ t('common.ok') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { logger } from '../utils/logger'
import { useI18n } from 'vue-i18n'
import { category } from '@/services/api'
import { useCleanup } from '@/composables/useCleanup'

interface TabItem {
  id: string
  name: string
  field1: string
  butUrl: string
  type?: string
}

const props = defineProps({
  showAll: {
    type: Boolean,
    default: false,
  },
  paddingLeft: {
    type: String,
    default: '0',
  },
  customize: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:activeCategory', 'change'])

const { t } = useI18n()

const tabList = ref<TabItem[]>([])
const tabValue = ref<TabItem[]>([])
const all = ref(true)
const addType = ref(false)
const value = ref('')

// 监听分类选择变化
watch(
  () => tabValue.value,
  (newVal: TabItem[]) => {
    if (newVal.length > 0) {
      const activeCategory = newVal[0].id
      emit('update:activeCategory', activeCategory)
    } else {
      emit('update:activeCategory', '')
    }
  }
)

watch(
  () => tabValue.value.length,
  (n: number) => {
    if (n > 0 && props.showAll) {
      all.value = false
    }
    if (n === 0) {
      all.value = true
    }
    emit('change', tabValue.value)
  }
)

const add = () => {
  if (value.value) {
    const item = {
      id: value.value,
      name: value.value,
      type: 'type',
      field1: 'https://file.aizhs.top/sys-backs/2025/08/16/qzdy_20250816161419A289.png',
      butUrl: 'https://file.aizhs.top/sys-backs/2025/08/16/szdy_20250816161421A290.png',
    }
    tabList.value.unshift(item)
    select(item)
  }
  addType.value = false
}

const select = (item: TabItem) => {
  const index = tabValue.value.indexOf(item)

  if (index >= 0) {
    tabValue.value.splice(index, 1)
  } else {
    tabValue.value = [item]
  }
}

const selectAllTab = () => {
  all.value = !all.value
  if (all.value) {
    tabValue.value = []
  }
}

// 获取分类数据（带重试与降级）
const loadError = ref(false)
const cleanup = useCleanup()
// 重试定时器，组件卸载时清理
let retryTimer: ReturnType<typeof setTimeout> | null = null
const getCategoryData = async (retryCount = 2) => {
  try {
    const res = (await category('0')) as { data?: TabItem[] }
    tabList.value = res?.data || []
    loadError.value = false
    logger.info('[XuqiuTab] Category data loaded successfully:', tabList.value.length)
  } catch (error) {
    logger.error(t('common.errors.fetchFailed'), error)
    if (retryCount > 0) {
      retryTimer = setTimeout(() => getCategoryData(retryCount - 1), 800)
      return
    }
    tabList.value = []
    loadError.value = true
  }
}

onMounted(() => {
  try {
    logger.info('[XuqiuTab] Component mounted, starting to load category data')
    getCategoryData()
  } catch (error) {
    logger.error('[XuqiuTab] Error mounting component:', error)
    tabList.value = []
  }
})

// 组件卸载时清理重试定时器
cleanup.add(() => {
  if (retryTimer !== null) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
})
</script>

<style lang="scss" scoped>
// CSS 变量定义
.category-menu-container {
  // 组件级 CSS 变量
  --xuqiu-tab-font-family: var(--font-family-chinese);
  --xuqiu-tab-input-width: 321rpx;
  --xuqiu-tab-input-height: 49rpx;
}

// 分类菜单容器
.category-menu-container {
  width: 100%;
  margin-bottom: 0; // 移除下边距，让父容器控制间距
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.category-menu-wrapper {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 6px 8px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: var(--global-border-radius);
  border: none;
  background: var(--el-fill-color-light);
  box-shadow: none;
  box-sizing: border-box;
  overflow: auto visible;
  scrollbar-width: none;
  -ms-overflow-style: none;
  min-height: fit-content;
  height: auto;

  &::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Opera */
  }
}

// 分类标签
.category-label {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  margin-right: 8px;
  flex-shrink: 0;
  user-select: none;
  cursor: default;
  position: relative;

  .category-label-text {
    font-family: var(--xuqiu-tab-font-family);
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    letter-spacing: 0.3px;
    white-space: nowrap;
  }
}

// 菜单分隔线
.menu-divider {
  width: 1px;
  height: 24px;
  background: var(--color-black-8);
  margin: 0 4px;
  flex-shrink: 0;
}

// 分类加载错误提示
.category-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  margin: 0 2px;
  border-radius: var(--global-border-radius);
  background: var(--el-fill-color-light);
  flex-shrink: 0;
}

.category-error-text {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.category-error-retry {
  padding: 8px 16px;
  min-height: 32px;
  border: none;
  border-radius: var(--global-border-radius);
  background: var(--el-color-primary);
  color: var(--el-bg-color);
  font-size: 12px;
  cursor: pointer;
}

// 菜单项
:where(.category-menu-item) {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  margin: 0 2px;
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  flex-shrink: 0;
  min-height: 40px;
  box-sizing: border-box;

  // 左侧指示器
  .menu-item-indicator {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 0;
    background: var(--el-color-primary);
    border-radius: var(--global-border-radius);
    transition:
      height 0.25s cubic-bezier(0.4, 0, 0.2, 1),
      opacity 0.25s ease;
    opacity: 0;
  }

  // 图标容器
  .menu-item-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--global-border-radius);
    background: var(--el-bg-color);
    transition: all 0.2s ease;
    flex-shrink: 0;

    .icon {
      width: 18px;
      height: 18px;
      object-fit: contain;
      opacity: 0.6;
      transition: opacity 0.2s ease;
    }
  }

  // 文字
  .menu-item-text {
    font-family: var(--xuqiu-tab-font-family);
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-secondary);
    transition: all 0.2s ease;
    line-height: 1.4;
  }

  // 悬停状态
  &:hover {
    background: var(--el-bg-color-hover);

    .menu-item-icon-wrapper {
      background: var(--el-bg-color-hover);

      .icon {
        opacity: 0.8;
      }
    }

    .menu-item-text {
      color: var(--el-text-color-primary);
    }
  }

  // 选中状态
  &.active {
    background: var(--el-fill-color-extra-light);

    .menu-item-indicator {
      height: 24px;
      opacity: 1;
    }

    .menu-item-icon-wrapper {
      background: var(--el-fill-color-light);

      .icon {
        opacity: 1;
      }
    }

    .menu-item-text {
      color: var(--el-text-color-primary);
      font-weight: 600;
    }
  }
}

.mask {
  position: fixed;
  inset: 100px 0 0; /* Header高度(70px) + top(10px) + 间距(20px) = 100px，避免遮挡Header */
  z-index: var(--z-sticky); /* 低于Header的z-index */
  background-color: var(--el-overlay-color-light);
}

.add_type {
  position: fixed;
  inset: 100px 0 0; /* Header高度(70px) + top(10px) + 间距(20px) = 100px，避免遮挡Header */
  margin: auto;
  z-index: var(--z-sticky); /* 低于Header的z-index */
  width: 427rpx;
  height: 303rpx;
  border-radius: 20rpx;
  background: var(--el-bg-color-page);
  box-sizing: border-box;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  .title {
    font-family: var(--xuqiu-tab-font-family);
    font-size: 24rpx;
    font-weight: 700;
    color: var(--el-text-color-primary);
    margin-bottom: 50rpx;
  }

  .input {
    width: var(--xuqiu-tab-input-width);
    height: var(--xuqiu-tab-input-height);
    border: none;
    border-radius: 6rpx;
    margin-bottom: 50rpx;
    background-color: var(--el-bg-color-page);
    font-family: var(--xuqiu-tab-font-family);
    font-size: 20rpx;
    font-weight: normal;
    color: var(--el-text-color-placeholder);
    padding: 0 12rpx;
  }

  .btn {
    width: 100rpx;
    height: 48rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--xuqiu-tab-font-family);
    font-size: 24rpx;
    font-weight: 700;
    color: var(--el-text-color-primary);
    cursor: pointer;
  }
}

.flex_center {
  display: flex;
  align-items: center;
  justify-content: center;
}

// 兼容旧样式类名
.selected {
  // 样式已在 .category-menu-item.active 中定义
}

// 兼容旧样式类名
.fenlei_btn_list {
  // 样式已在 .category-menu-wrapper 中定义
}

.fenlei_btn {
  // 样式已在 .category-menu-item 中定义
}
</style>
