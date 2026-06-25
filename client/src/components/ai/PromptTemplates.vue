<template>
  <div class="prompt-templates-container">
    <div class="templates-header">
      <div class="header-title-group">
        <el-icon class="title-icon"><Sparkles /></el-icon>
        <h4>{{ t('promptTemplates.title') }}</h4>
      </div>
      <el-button link class="add-btn" @click="handleAddCustom">
        <el-icon><Plus /></el-icon>
        {{ t('promptTemplates.addCustom') }}
      </el-button>
    </div>
    
    <div class="templates-list custom-scrollbar">
      <div
        v-for="template in templates"
        :key="template.id"
        class="template-card"
        @click="handleSelect(template)"
      >
        <div class="card-header">
          <span class="card-title">{{ template.title }}</span>
          <span class="card-tag" :class="template.category">{{ getCategoryName(template.category) }}</span>
        </div>
        <div class="card-body">{{ template.content }}</div>
        <div v-if="template.isCustom" class="card-actions">
          <el-button link size="small" type="danger" @click.stop="handleTrash2(template)" class="delete-btn">
            <el-icon><Trash2 /></el-icon>
          </el-button>
        </div>
      </div>
      <!-- 底部留白，防止内容被遮挡 -->
      <div class="list-footer-spacer"></div>
    </div>

    <!-- 添加自定义模板对话框 -->
    <el-dialog 
      v-model="showAddDialog" 
      :title="t('hardcoded.prompt_templates.添加自定义模板2')" 
      width="460px" 
      append-to-body
      class="custom-template-dialog"
    >
      <el-form :model="customTemplateForm" label-position="top">
        <el-form-item :label="t('hardcoded.prompt_templates.模板名称3')">
          <el-input v-model="customTemplateForm.title" :placeholder="t('hardcoded.prompt_templates.输入模板名称如周')" />
        </el-form-item>
        <el-form-item :label="t('hardcoded.prompt_templates.模板内容4')">
          <el-input
            v-model="customTemplateForm.content"
            type="textarea"
            :rows="5"
            :placeholder="t('hardcoded.prompt_templates.输入具体的提示词1')"
          />
        </el-form-item>
        <el-form-item :label="t('hardcoded.prompt_templates.分类5')">
          <el-select v-model="customTemplateForm.category" style="width: 100%">
            <el-option v-for="cat in categories" :key="cat.value" :label="cat.label" :value="cat.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showAddDialog = false">{{ t('promptTemplates.cancel') }}</el-button>
          <el-button type="primary" @click="confirmAdd" class="confirm-btn">{{ t('promptTemplates.confirm') }}</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { logger } from '../../utils/logger'
import { safeParseJson } from '@/utils/storage'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { Plus, Trash2, Sparkles } from '@/lib/lucide-fallback'

export interface PromptTemplate {
  id: string
  title: string
  content: string
  category?: string
  isCustom?: boolean
}

const { t } = useI18n()
const { showSuccess, showWarning } = useOperationFeedback()

const emit = defineEmits<{
  select: [template: PromptTemplate]
}>()

const showAddDialog = ref(false)
const customTemplateForm = ref({
  title: '',
  content: '',
  category: 'general',
})

// 精选的高质量中文提示词模版
const defaultTemplates: PromptTemplate[] = [
  // ===== 通用类 =====
  {
    id: 'summarize',
    title: t('title.prompt_templates.内容精炼'),
    content: t('content.prompt_templates.请将以下内容进行10'),
    category: 'general',
  },
  // ===== 语言类 =====
  {
    id: 'translate_pro',
    title: t('title.prompt_templates.专业翻译1'),
    content: t('content.prompt_templates.你是一位精通中英11'),
    category: 'language',
  },
  // ===== 代码类 =====
  {
    id: 'code_expert',
    title: t('title.prompt_templates.代码审查2'),
    content: t('content.prompt_templates.请详细分析以下代12'),
    category: 'code',
  },
  // ===== 写作类 =====
  {
    id: 'weekly_report',
    title: t('title.prompt_templates.周报助手3'),
    content: t('content.prompt_templates.请根据我提供的本13'),
    category: 'writing',
  },
  {
    id: 'article_generator',
    title: t('title.prompt_templates.文章撰写4'),
    content: t('content.prompt_templates.请根据以下主题和14'),
    category: 'writing',
  },
  {
    id: 'copywriting_batch',
    title: t('title.prompt_templates.批量文案生成5'),
    content: t('content.prompt_templates.请根据以下产品服15'),
    category: 'writing',
  },
  {
    id: 'social_media',
    title: t('title.prompt_templates.社交媒体文案6'),
    content: t('content.prompt_templates.请为以下内容生成16'),
    category: 'writing',
  },
  {
    id: 'title_generator',
    title: t('title.prompt_templates.爆款标题生成7'),
    content: t('content.prompt_templates.请为以下内容生成17'),
    category: 'writing',
  },
  // ===== 创意类 =====
  {
    id: 'creative_idea',
    title: t('title.prompt_templates.头脑风暴8'),
    content: t('content.prompt_templates.请围绕以下主题提18'),
    category: 'creative',
  },
  // ===== 分析类 =====
  {
    id: 'logical_analysis',
    title: t('title.prompt_templates.深度逻辑分析9'),
    content: t('content.prompt_templates.请对以下观点或事19'),
    category: 'analysis',
  },
]

// 逻辑处理保持不变...
const loadCustomTemplates = (): PromptTemplate[] => {
  try {
    const stored = localStorage.getItem('prompt_templates')
    if (stored) return safeParseJson<PromptTemplate[]>(stored, [], { forbidFunction: true })
  } catch (error) {
    logger.error('Failed to load template', error)
  }
  return []
}

const saveCustomTemplates = (templates: PromptTemplate[]) => {
  try {
    localStorage.setItem('prompt_templates', JSON.stringify(templates))
  } catch (error) {
    logger.error('Failed to save template', error)
  }
}

const customTemplates = ref<PromptTemplate[]>(loadCustomTemplates())
const templates = computed(() => [...defaultTemplates, ...customTemplates.value])

const categories = [
  { label: t('data.prompt_templates.通用'), value: 'general' },
  { label: t('data.prompt_templates.语言1'), value: 'language' },
  { label: t('data.prompt_templates.代码2'), value: 'code' },
  { label: t('data.prompt_templates.写作3'), value: 'writing' },
  { label: t('data.prompt_templates.创意4'), value: 'creative' },
  { label: t('data.prompt_templates.分析5'), value: 'analysis' },
]

const getCategoryName = (category: string): string => {
  return categories.find(c => c.value === category)?.label || t('promptTemplates.other')
}

const handleSelect = (template: PromptTemplate) => {
  emit('select', template)
}

const handleAddCustom = () => {
  customTemplateForm.value = { title: '', content: '', category: 'general' }
  showAddDialog.value = true
}

const confirmAdd = () => {
  if (!customTemplateForm.value.title.trim() || !customTemplateForm.value.content.trim()) {
    showWarning(t('cmpPromptTemplates.fillAllFields'))
    return
  }
  const newTemplate: PromptTemplate = {
    id: `custom_${Date.now()}`,
    title: customTemplateForm.value.title,
    content: customTemplateForm.value.content,
    category: customTemplateForm.value.category,
    isCustom: true,
  }
  customTemplates.value.push(newTemplate)
  saveCustomTemplates(customTemplates.value)
  showAddDialog.value = false
  showSuccess(t('cmpPromptTemplates.templateAdded'))
}

const handleTrash2 = (template: PromptTemplate) => {
  customTemplates.value = customTemplates.value.filter(t => t.id !== template.id)
  saveCustomTemplates(customTemplates.value)
  showSuccess(t('cmpPromptTemplates.templateDeleted'))
}
</script>

<style scoped lang="scss">
.prompt-templates-container {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  max-height: 520px;
  display: flex;
  flex-direction: column;
  background: transparent;
  box-sizing: border-box;
  padding-left: 0;
  padding-right: 0;
}

.templates-header {
  width: 100%;
  min-width: 0; /* 随 .prompt-templates-container 宽度自动匹配 */
  max-width: 100%;
  box-sizing: border-box;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px;
  flex-shrink: 0;

  .header-title-group {
    display: flex;
    align-items: center;
    gap: 10px;
    
    .title-icon {
      color: var(--el-color-primary);
      font-size: 20px;
    }

    h4 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      letter-spacing: 0.02em;
    }
  }

  .add-btn {
    font-size: 13px;
    font-weight: 500;
    color: var(--el-color-primary);

    &:hover {
      opacity: 0.8;
    }
  }
}

.templates-list {
  width: 100%;
  min-width: 0; /* 随 .prompt-templates-container 宽度自动匹配 */
  max-width: 100%;
  box-sizing: border-box;
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: transparent;
}

.template-card {
  padding: 18px;
  background: var(--el-fill-color-light);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease;
  position: relative;
  overflow: visible;
  box-sizing: border-box;

  &:hover {
    background-color: var(--el-fill-color);
    border-color: var(--el-border-color-hover);
    transform: translateY(-2px);

    .delete-btn {
      opacity: 1;
    }
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    background: transparent;
    border: none;
    border-radius: 0;

    .card-title {
      font-weight: 600;
      font-size: 15px;
      color: var(--el-text-color-primary);
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-right: 8px;
      background: none;
      background-color: transparent;
      border: none;
      border-radius: 0;
    }

    .card-tag {
      font-size: 12px;
      padding: 0 8px;
      border-radius: var(--global-border-radius); // 遵循项目规范：标签/小按钮使用 6px 圆角
      background: var(--el-fill-color-light);
      color: var(--el-text-color-secondary);
      font-weight: 500;
      white-space: nowrap;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 20px;
      
      &.code { background: var(--color-blue-007bff-10); color: var(--color-blue-007bff); }
      &.writing { background: var(--color-orange-ff9900-10); color: var(--color-orange-ff9900); }
      &.creative { background: var(--color-green-52c41a-10); color: var(--color-green-52c41a); }
      &.analysis { background: var(--color-red-transparent-10-alt); color: var(--color-red-f5222d); }
      &.language { background: var(--ai-language-tag-bg); color: var(--ai-language-tag); }
    }
  }

  .card-body {
    font-size: 13px;
    color: var(--el-text-color-regular);
    line-height: 1.6;
    word-break: break-word; // 允许长单词换行，防止截断
    opacity: 0.9;
    background: transparent;
    border: none;
    border-radius: 0;
  }
}

.list-footer-spacer {
  height: 12px;
  flex-shrink: 0;
}

.delete-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  opacity: 0;
  transition: all 0.2s ease;
  
  &:hover {
    transform: scale(1.1);
  }
}

.custom-scrollbar {
  &::-webkit-scrollbar { width: 6px; }

  &::-webkit-scrollbar-thumb {
    background: var(--el-border-color-lighter);
    border-radius: var(--global-border-radius);
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 10px;

  .confirm-btn {
    padding: 8px 24px;
    border-radius: var(--global-border-radius);
  }
}
</style>

<!-- 在提示词模板 popper 内与父级左对齐，禁止负 margin 导致左溢出 -->
<style lang="scss">
body .el-popper.ai-chat-prompt-templates-popper .prompt-templates-container {
  margin-left: 0;
  margin-right: 0;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

body .el-popper.ai-chat-prompt-templates-popper .prompt-templates-container .templates-header,
body .el-popper.ai-chat-prompt-templates-popper .prompt-templates-container .templates-list {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  margin-left: 0;
  margin-right: 0;
}
</style>
