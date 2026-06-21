<template>
  <div>
    <el-loading v-if="loading" />
    <div v-if="formInfo.binding" class="group-image">
      <div class="image-view">
        <span>{ t('studyGroup.cover') }</span>
        <img class="cover-img" :src="formInfo.binding" :alt="formInfo.title || '封面图片'" loading="lazy" />
      </div>
    </div>
    <div class="add-image">
      <img class="add-icon" src="https://file.aizhs.top/sys-mini/xtk/study_icon_add_grad.png" alt="上传图片" loading="lazy" @click="uploadImage" />
    </div>

    <div class="video-form">
      <div class="title">{ t('studyGroup.groupTitle') }</div>
      <el-input v-model="formInfo.title" placeholder="请输入合集标题" class="mb12" />
      <div class="title">{ t('studyGroup.groupDesc') }</div>
      <el-input v-model="formInfo.content" type="textarea" :rows="4" placeholder="请输入合集描述" class="mb12" />

      <div class="sub-title">{{ t('study.selectTrack') }}</div>
      <div class="title">{{ t('study.mainTrackPrefix') }}</div>
      <el-select v-model="msId" placeholder="请选择" @change="changeMain">
        <el-option v-for="item in mainSaidao" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>

      <div v-if="subSaidao.length > 0" class="title">#{{ t('studyGroup.subTrack') }}</div>
      <el-select v-if="subSaidao.length > 0" v-model="formInfo.categorys" :placeholder="t('studyGroup.pleaseSelect')" @change="changeSub">
        <el-option v-for="item in subSaidao" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>

      <div class="sub-title">{{ t('study.selectPhase') }}</div>
      <el-select v-model="formInfo.stage" placeholder="请选择" @change="changeStage">
        <el-option v-for="item in stageList" :key="item.id" :label="item.name" :value="item.id" />
      </el-select>
    </div>

    <div v-if="showEditVideo" class="title" style="margin-left: 12px;">{{ t('studyGroup.uploadVideo') }}</div>
    <div v-if="showEditVideo" class="to-video-btn" @click="toUploadVideoPage">
      <span class="btn-text">{{ t('study.uploadVideoCourse') }}</span>
    </div>

    <div v-if="status === 'add'" class="submit-area">
      <el-button type="primary" class="publish-btn" @click="submitGroup('add')">{{ t('studyGroup.publish') }}</el-button>
    </div>
    <div v-if="status === 'edit'" class="submit-area flex-around">
      <el-button v-if="canEdit" type="primary" @click="submitGroup('edit')">{{ t('studyGroup.edit') }}</el-button>
      <el-button v-if="canEdit" type="danger" @click="handleDelete">{{ t('common.delete') }}</el-button>
      <el-button v-if="formInfo.auditStatus === 4" type="warning" @click="xiajia">{{ t('studyGroup.delist') }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">

import { useI18n } from 'vue-i18n'

const { t } = useI18n()
import { ref, reactive, watch, nextTick, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { addGroup, courseDelete, coursePut, delist } from '@/services/study'
import type { ApiResponse } from '@/types'

defineOptions({ name: 'Group' })

// 赛道项类型
interface SaidaoItem {
  id: string
  name: string
  children?: SaidaoItem[]
}

const props = withDefaults(defineProps<{
  fromParent?: string
  courseId?: string
  tabList?: unknown[]
  mainSaidao?: SaidaoItem[]
}>(), {
  fromParent: 'add',
  tabList: () => [],
  mainSaidao: () => []
})

const emit = defineEmits<{
  (e: 'goBack'): void
  (e: 'getGroupId', data: { id: string, title: string }): void
  (e: 'toUploadVideoPage'): void
  (e: 'getGroupImage', url: string): void
}>()

const status = ref('add')
const formInfo = reactive({
  binding: '',
  title: '',
  content: '',
  categorys: '',
  stage: 0,
  auditStatus: 0
})
const subSaidao = ref<SaidaoItem[]>([])
const msId = ref('')
const stageList = ref([
  { name: '入门', id: 0 },
  { name: '进阶', id: 1 },
  { name: '精通', id: 2 }
])
const loading = ref(false)

const canEdit = computed(() => [0, 2, 3, 4].includes(formInfo.auditStatus))
const showEditVideo = computed(() => status.value === 'edit' && canEdit.value)

watch(() => props.fromParent, (n) => { if (n) status.value = n }, { immediate: true })
watch(() => props.mainSaidao, (n) => {
  if (n && n.length > 0) nextTick(() => { msId.value = n[0].id })
}, { immediate: true })

function changeMain(obj: string) {
  const item = props.mainSaidao?.find((i: SaidaoItem) => i.id === obj)
  if (item?.children) {
    subSaidao.value = item.children
    formInfo.categorys = subSaidao.value[0]?.id || ''
  } else {
    subSaidao.value = []
    formInfo.categorys = ''
  }
}

function changeSub(obj: string) {
  formInfo.categorys = obj
}

function changeStage(obj: number) {
  formInfo.stage = obj
}

function handleDelete() {
  loading.value = true
  courseDelete([props.courseId]).then(() => { emit('goBack') }).catch(() => { ElMessage.error('操作失败') }).finally(() => { loading.value = false })
}

function xiajia() {
  loading.value = true
  delist(props.courseId).then(() => { emit('goBack') }).catch(() => { ElMessage.error('操作失败') }).finally(() => { loading.value = false })
}

function submitGroup(type: string) {
  if (!enoughInfo()) return
  loading.value = true
  const param: Record<string, unknown> = {
    binding: formInfo.binding,
    title: formInfo.title,
    content: formInfo.content,
    categorys: formInfo.categorys,
    stage: formInfo.stage,
    auditStatus: formInfo.auditStatus
  }

  if (type === 'add') {
    addGroup(param as unknown as { name: string; description?: string }).then((res: ApiResponse<unknown>) => {
      emit('getGroupId', { id: res.data as string, title: formInfo.title })
      ElMessage.success(t('study.publishSuccessContinue'))
    }).catch(() => { ElMessage.error('操作失败') }).finally(() => { loading.value = false })
  } else {
    param.id = props.courseId
    coursePut(param as unknown as { id: string; [key: string]: unknown }).then(() => {
      emit('getGroupId', { id: props.courseId!, title: formInfo.title })
      ElMessage.success(t('study.editSuccessReview'))
    }).catch(() => { loading.value = false })
  }
}

function enoughInfo() {
  if (!formInfo.binding) { ElMessage.error(t('studyGroup.uploadCover')); return false }
  if (!formInfo.title) { ElMessage.error(t('studyGroup.enterGroupTitle')); return false }
  if (!formInfo.content) { ElMessage.error(t('studyGroup.enterGroupDesc')); return false }
  if (!formInfo.categorys) { ElMessage.error(t('studyGroup.selectTrack')); return false }
  return true
}

function toUploadVideoPage() {
  emit('toUploadVideoPage')
}

function uploadImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    loading.value = true
    const reader = new FileReader()
    reader.onload = () => {
      formInfo.binding = reader.result as string
      emit('getGroupImage', formInfo.binding)
      loading.value = false
      ElMessage.success(t('study.uploadSuccess'))
    }
    reader.onerror = () => { loading.value = false; ElMessage.error(t('study.uploadFailed')) }
    reader.readAsDataURL(file)
  }
  input.click()
}
</script>

<style scoped>
.group-image {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.image-view {
  text-align: center;
}

.cover-img {
  width: 220px;
  height: 125px;
  border-radius: var(--global-border-radius);
}

.add-image {
  display: flex;
  justify-content: center;
  margin-bottom: 12px;
}

.add-icon {
  width: 100px;
  height: 100px;
  cursor: pointer;
}

.video-form {
  padding: 0 12px;
}
.mb12 { margin-bottom: 12px; }

.title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-dark-bg-3);
  margin: 8px 0;
}

.sub-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--color-black);
  margin: 12px 0;
  display: block;
}

.to-video-btn {
  width: 100%;
  margin: 4px auto;
  height: 40px;
  background: var(--color-gradient-group);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.btn-text {
  font-size: 18px;
  font-weight: bold;
  color: var(--color--b0a6ff);
}

.submit-area {
  padding: 20px 0;
}

.flex-around {
  display: flex;
  justify-content: space-around;
  align-items: center;
}

.publish-btn {
  background: var(--color-black);
  color: var(--color-white);
}
</style>
