<template>
  <div class="character-manager">
    <!-- 工具栏 -->
    <div class="toolbar">
      <el-button size="small" type="primary" @click="showAddDialog = true">
        <el-icon><Plus /></el-icon>
        {{ t('dramaScript.addCharacter') }}
      </el-button>
      <el-input
        v-model="searchKeyword"
        size="small"
        :placeholder="t('common.search')"
        clearable
        style="width: 200px;"
      >
        <template #prefix>
          <SearchIcon />
        </template>
      </el-input>
    </div>

    <!-- 角色列表 -->
    <div class="character-list">
      <div
        v-for="character in filteredCharacters"
        :key="character.id"
        class="character-item"
        :class="{ 'is-selected': selectedCharacterId === character.id }"
        @click="selectCharacter(character)"
      >
        <div class="character-header">
          <h3 class="character-name">{{ character.name }}</h3>
          <div class="character-actions">
            <el-button link size="small" @click.stop="editCharacter(character)">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button link size="small" type="danger" @click.stop="deleteCharacter(character.id)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>

        <div class="character-content">
          <!-- 人物形象 -->
          <div class="character-section">
            <div class="section-title">
              <el-icon><User /></el-icon>
              {{ t('dramaScript.appearance') }}
            </div>
            <div class="section-content">
              <el-image
                v-if="character.appearance.imageUrl"
                :src="character.appearance.imageUrl"
                :preview-src-list="[character.appearance.imageUrl]"
                fit="cover"
                class="appearance-image"
              />
              <el-input
                v-model="character.appearance.description"
                type="textarea"
                :rows="2"
                size="small"
                :placeholder="t('dramaScript.appearancePlaceholder')"
                @blur="onCharacterChange(character)"
              />
              <el-upload
                :action="uploadAction"
                :headers="uploadHeaders"
                :show-file-list="false"
                :on-success="(response: UploadResponse) => handleAppearanceUpload(response, character)"
                :before-upload="beforeUpload"
                accept="image/*"
              >
                <el-button size="small" link>
                  <el-icon><Upload /></el-icon>
                  {{ t('dramaScript.uploadAppearance') }}
                </el-button>
              </el-upload>
            </div>
          </div>

          <!-- 声音 -->
          <div class="character-section">
            <div class="section-title">
              <el-icon><Microphone /></el-icon>
              {{ t('dramaScript.voice') }}
            </div>
            <div class="section-content">
              <el-input
                v-model="character.voice.description"
                type="textarea"
                :rows="2"
                size="small"
                :placeholder="t('dramaScript.voicePlaceholder')"
                @blur="onCharacterChange(character)"
              />
              <el-input
                v-model="character.voice.voiceId"
                size="small"
                :placeholder="t('dramaScript.voiceIdPlaceholder')"
                @blur="onCharacterChange(character)"
              />
            </div>
          </div>
        </div>

        <div class="character-meta">
          <span class="meta-item">
            {{ t('dramaScript.createdAt') }}: {{ formatTime(character.createdAt) }}
          </span>
          <span class="meta-item" v-if="character.updatedAt !== character.createdAt">
            {{ t('dramaScript.updatedAt') }}: {{ formatTime(character.updatedAt) }}
          </span>
        </div>
      </div>

      <el-empty
        v-if="filteredCharacters.length === 0"
        :description="searchKeyword ? t('dramaScript.noCharacterFound') : t('dramaScript.noCharacters')"
      />
    </div>

    <!-- 新增/编辑角色对话框 -->
    <el-dialog
      v-model="showAddDialog"
      :title="editingCharacter ? t('dramaScript.editCharacter') : t('dramaScript.addCharacter')"
      width="600px"
    >
      <el-form :model="characterForm" label-width="100px">
        <el-form-item :label="t('dramaScript.characterName')" required>
          <el-input
            v-model="characterForm.name"
            :placeholder="t('dramaScript.characterNamePlaceholder')"
          />
        </el-form-item>
        <el-form-item :label="t('dramaScript.appearance')">
          <el-image
            v-if="characterForm.appearance.imageUrl"
            :src="characterForm.appearance.imageUrl"
            :preview-src-list="[characterForm.appearance.imageUrl]"
            fit="cover"
            class="form-appearance-image"
          />
          <el-upload
            :action="uploadAction"
            :headers="uploadHeaders"
            :show-file-list="false"
            :on-success="(response: UploadResponse) => handleFormAppearanceUpload(response)"
            :before-upload="beforeUpload"
            accept="image/*"
          >
            <el-button>
              <el-icon><Upload /></el-icon>
              {{ characterForm.appearance.imageUrl ? t('dramaScript.changeImage') : t('dramaScript.uploadImage') }}
            </el-button>
          </el-upload>
          <el-input
            v-model="characterForm.appearance.description"
            type="textarea"
            :rows="3"
            :placeholder="t('dramaScript.appearancePlaceholder')"
            style="margin-top: 8px;"
          />
        </el-form-item>
        <el-form-item :label="t('dramaScript.voice')">
          <el-input
            v-model="characterForm.voice.description"
            type="textarea"
            :rows="2"
            :placeholder="t('dramaScript.voicePlaceholder')"
          />
          <el-input
            v-model="characterForm.voice.voiceId"
            :placeholder="t('dramaScript.voiceIdPlaceholder')"
            style="margin-top: 8px;"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveCharacter">{{ t('common.confirm') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Edit,
  Delete,
  User,
  Microphone,
  Upload,
} from '@element-plus/icons-vue'
import SearchIcon from '@/components/common/SearchIcon.vue'
import { formatTime } from '@/utils/format'
import { getToken } from '@/utils/auth'

interface UploadResponse {
  success: boolean
  message?: string
  data?: {
    url?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

const { t } = useI18n()

// Props
const props = defineProps<{
  characters: Array<{
    id: string
    name: string
    appearance: {
      imageUrl?: string
      description: string
    }
    voice: {
      voiceId?: string
      description: string
    }
    createdAt: string
    updatedAt: string
  }>
}>()

// Emits
const emit = defineEmits<{
  (e: 'update:characters', characters: typeof props.characters): void
  (e: 'select', character: typeof props.characters[0]): void
}>()

// 状态
const searchKeyword = ref('')
const showAddDialog = ref(false)
const editingCharacter = ref<typeof props.characters[0] | null>(null)
const selectedCharacterId = ref<string | null>(null)

// 表单
const characterForm = ref({
  name: '',
  appearance: {
    imageUrl: '',
    description: '',
  },
  voice: {
    voiceId: '',
    description: '',
  },
})

// 计算属性
const filteredCharacters = computed(() => {
  if (!searchKeyword.value) return props.characters

  const keyword = searchKeyword.value.toLowerCase()
  return props.characters.filter((c: typeof props.characters[0]) =>
    c.name.toLowerCase().includes(keyword) ||
    c.appearance.description.toLowerCase().includes(keyword) ||
    c.voice.description.toLowerCase().includes(keyword)
  )
})

// 上传配置
const uploadAction = computed(() => {
  const baseUrl = import.meta.env.VITE_BASE_API || import.meta.env.VUE_APP_BASE_API || '/dev-api'
  return `${baseUrl}/file/upload`
})

const uploadHeaders = computed(() => ({
  Authorization: `Bearer ${getToken()}`,
}))

// 方法
const selectCharacter = (character: typeof props.characters[0]) => {
  selectedCharacterId.value = character.id
  emit('select', character)
}

const editCharacter = (character: typeof props.characters[0]) => {
  editingCharacter.value = character
  characterForm.value = {
    name: character.name,
    appearance: {
      imageUrl: character.appearance.imageUrl || '',
      description: character.appearance.description,
    },
    voice: {
      voiceId: character.voice.voiceId || '',
      description: character.voice.description,
    },
  }
  showAddDialog.value = true
}

const deleteCharacter = async (id: string) => {
  try {
    await ElMessageBox.confirm(
      t('dramaScript.confirmDeleteCharacter'),
      t('common.confirm'),
      {
        type: 'warning',
      }
    )

    const updated = props.characters.filter((c: typeof props.characters[0]) => c.id !== id)
    emit('update:characters', updated)
    ElMessage.success(t('dramaScript.characterDeleted'))
  } catch {
    // 用户取消
  }
}

const saveCharacter = () => {
  if (!characterForm.value.name.trim()) {
    ElMessage.warning(t('dramaScript.characterNameRequired'))
    return
  }

  const now = new Date().toISOString()

  if (editingCharacter.value) {
    // 更新角色
    const updated = props.characters.map((c: typeof props.characters[0]) =>
      c.id === editingCharacter.value!.id
        ? {
            ...c,
            name: characterForm.value.name,
            appearance: characterForm.value.appearance,
            voice: characterForm.value.voice,
            updatedAt: now,
          }
        : c
    )
    emit('update:characters', updated)
    ElMessage.success(t('dramaScript.characterUpdated'))
  } else {
    // 新增角色
    const newCharacter = {
      id: `character-${Date.now()}`,
      name: characterForm.value.name,
      appearance: characterForm.value.appearance,
      voice: characterForm.value.voice,
      createdAt: now,
      updatedAt: now,
    }
    emit('update:characters', [...props.characters, newCharacter])
    ElMessage.success(t('dramaScript.characterCreated'))
  }

  // 重置表单
  characterForm.value = {
    name: '',
    appearance: {
      imageUrl: '',
      description: '',
    },
    voice: {
      voiceId: '',
      description: '',
    },
  }
  editingCharacter.value = null
  showAddDialog.value = false
}

const onCharacterChange = (character: typeof props.characters[0]) => {
  character.updatedAt = new Date().toISOString()
  emit('update:characters', [...props.characters])
}

const beforeUpload = (file: File) => {
  const isImage = file.type.startsWith('image/')
  const isLt5M = file.size / 1024 / 1024 < 5

  if (!isImage) {
    ElMessage.error(t('dramaScript.imageOnly'))
    return false
  }
  if (!isLt5M) {
    ElMessage.error(t('dramaScript.imageSizeLimit'))
    return false
  }
  return true
}

const handleAppearanceUpload = (response: UploadResponse, character: typeof props.characters[0]) => {
  if (response.success && response.data?.url) {
    character.appearance.imageUrl = response.data.url
    onCharacterChange(character)
    ElMessage.success(t('dramaScript.imageUploaded'))
  } else {
    ElMessage.error(response.message || t('dramaScript.imageUploadFailed'))
  }
}

const handleFormAppearanceUpload = (response: UploadResponse) => {
  if (response.success && response.data?.url) {
    characterForm.value.appearance.imageUrl = response.data.url
    ElMessage.success(t('dramaScript.imageUploaded'))
  } else {
    ElMessage.error(response.message || t('dramaScript.imageUploadFailed'))
  }
}
</script>

<style scoped lang="scss">
.character-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: var(--unified-border-bottom);
  gap: 12px;
}

.character-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.character-item {
  padding: 16px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
  transition: all 0.2s;
  cursor: pointer;

  &:hover {
    border-color: var(--el-color-primary-light-5);
    box-shadow: var(--global-box-shadow);
  }

  &.is-selected {
    border: var(--el-border-width-primary) solid var(--el-color-primary);
    background: var(--el-color-primary-light-9);
  }
}

.character-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;

  .character-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    margin: 0;
  }

  .character-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  &:hover .character-actions {
    opacity: 1;
  }
}

.character-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.character-section {
  .section-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 500;
    color: var(--el-text-color-regular);
    margin-bottom: 8px;
  }

  .section-content {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .appearance-image {
      width: 100%;
      height: 120px;
      border-radius: var(--global-border-radius);
      object-fit: cover;
    }
  }
}

.character-meta {
  display: flex;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: var(--unified-border);
  font-size: 12px;
  color: var(--el-text-color-secondary);

  .meta-item {
    flex: 1;
  }
}

.form-appearance-image {
  width: 200px;
  height: 200px;
  border-radius: var(--global-border-radius);
  object-fit: cover;
  margin-bottom: 8px;
}
</style>
