<!--
  TraeWorkSelector - trae work 风格紧凑选择器(模型/智能体)
  ----------------------------------------------------------------
  目的:
    1. 封装 el-dropdown 的 popper-class,避免外部污染(如 ai-chat-popper 引入的蓝色描边)
    2. 统一 trae work 视觉(28px 圆角矩形胶囊 + 紧凑下拉 + i18n 完整)
    3. 杜绝再出现"蓝色粗边框"问题 — popper-class 永远只用 tw-quick-pick-popper

  使用:
    <TraeWorkSelector
      :items="quickPickModels"
      :label="modelQuickLabel"
      :is-active="currentAIMode === 'model'"
      :is-selected="(m) => selectedModel?.modelCode === m.modelCode"
      :get-name="getModelDisplayName"
      icon-mode="model"
      :title-i18n="t('aiChatInput.modelLabel')"
      :empty-i18n="t('aiChatInput.noModels')"
      :placeholder-i18n="t('aiChatInput.selectModel')"
      :tooltip-i18n="t('aiChatInput.selectModel')"
      more-i18n="floatingChat.more"
      @select="onQuickPickModel"
      @more="openCapabilityPicker('model')"
    />
-->
<template>
  <el-dropdown
    trigger="click"
    placement="top"
    :hide-on-click="false"
    :popper-options="popperOptions"
    popper-class="tw-quick-pick-popper"
    class="tw-selector"
    :class="selectorClass"
  >
    <!-- 触发按钮:28px 圆角矩形胶囊 -->
    <button
      type="button"
      class="tw-selector-pill"
      :class="{ 'is-active': isActive }"
      :title="tooltipI18n"
    >
      <span class="tw-selector-icon">
        <AIStarIcon v-if="iconMode === 'model' && isActive" :size="14" />
        <el-icon v-else-if="iconMode === 'model'"><Cpu /></el-icon>
        <el-icon v-else><Bot /></el-icon>
      </span>
      <span class="tw-selector-label">{{ label || placeholderI18n }}</span>
      <el-icon class="tw-selector-caret"><ChevronDown :size="14" /></el-icon>
    </button>

    <!-- 下拉内容 -->
    <template #dropdown>
      <div class="tw-quick-pick">
        <div class="tw-quick-pick-header">
          <span class="tw-quick-pick-title">{{ titleI18n }}</span>
          <button
            v-if="moreI18n"
            class="tw-quick-pick-more"
            type="button"
            @click.stop="$emit('more')"
          >
            {{ moreText }} →
          </button>
        </div>
        <div class="tw-quick-pick-list">
          <button
            v-for="item in items"
            :key="getKey(item)"
            type="button"
            class="tw-quick-pick-item"
            :class="{ 'is-selected': isSelected(item) }"
            @click.stop="$emit('select', item)"
          >
            <span class="tw-quick-pick-name">{{ getName(item) }}</span>
            <el-icon
              v-if="isSelected(item)"
              class="tw-quick-pick-check"
            >
              <CheckCircle :size="14" />
            </el-icon>
          </button>
          <div v-if="items.length === 0" class="tw-quick-pick-empty">
            {{ emptyI18n }}
          </div>
        </div>
      </div>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
/**
 * trae work 风格选择器(模型/智能体共用)
 *
 * 重要:popper-class 永远只能是 'tw-quick-pick-popper',
 *      绝不允许混入 ai-chat-popper(它会用 el-color-primary 引入蓝色调背景导致蓝色粗边框)。
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Cpu, Bot, CheckCircle, ChevronDown } from '@/lib/lucide-fallback'
import AIStarIcon from '@/components/icons/AIStarIcon.vue'

type IconMode = 'model' | 'agent'

const props = withDefaults(
  defineProps<{
    /** 列表项(模型或智能体) */
    items: any[]
    /** 当前显示在胶囊上的文字(已选中的名字) */
    label?: string
    /** 是否处于激活态(蓝色样式) */
    isActive?: boolean
    /** 是否选中某项 */
    isSelected: (item: any) => boolean
    /** 列表项显示名 */
    getName: (item: any) => string
    /** 列表项 key(用于 v-for) */
    getKey: (item: any) => string | number
    /** 图标模式:model=AI星/Cpu, agent=Bot */
    iconMode?: IconMode
    /** 选择器类型 class(可选,用于外部定位) */
    selectorClass?: string
    /** i18n:下拉标题 */
    titleI18n: string
    /** i18n:空状态文案 */
    emptyI18n: string
    /** i18n:占位文案(未选中时) */
    placeholderI18n: string
    /** i18n:tooltip 提示 */
    tooltipI18n: string
    /** i18n:更多按钮 key(可选,传空字符串则不显示) */
    moreI18n?: string
  }>(),
  {
    iconMode: 'model',
    isActive: false,
    moreI18n: '',
  },
)

defineEmits<{
  (e: 'select', item: any): void
  (e: 'more'): void
}>()

const { t } = useI18n()

const popperOptions = {
  strategy: 'fixed',
  modifiers: [{ name: 'offset', options: { offset: [0, 8] } }],
} as const

// 解析 more 按钮的 i18n key
const moreText = computed(() => (props.moreI18n ? t(props.moreI18n) : ''))
</script>

<style scoped>
/* 组件内部不再写 el-dropdown 相关样式,统一由 _input-area.scss 中的
   .tw-selector / .tw-selector-pill / .tw-quick-pick 全局负责
   避免与全局样式产生特异性冲突 */
</style>
