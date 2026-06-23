<template>
  <div class="add-video-body">
    <el-loading v-if="loading" />
    <div class="video-image">
      <div class="flex-row" @click="changeImage">
        <span class="field-label">{{ t('studyAdd.cover') }}</span>
        <img v-if="formInfo.binding" class="cover-image" :src="formInfo.binding" :alt="formInfo.title || '视频封面'" loading="lazy" />
        <img v-else class="add-icon-large" src="https://file.aizhs.top/sys-mini/xtk/study_icon_add_grad.png" alt="添加图片" loading="lazy" @click="changeImage" />
      </div>
      <div v-if="localUrl" class="flex-row">
        <span class="field-label">{{ t('studyAddVideo.video') }}</span>
        <video class="video-preview" :controls="false" :src="localUrl" autoplay preload="none" />
      </div>
    </div>
    <el-progress v-if="chunkUploading" :percentage="uploadProgress" :stroke-width="12" />
    <div v-if="status === 'all' || status === 'edit'" class="video-list flex-wrap">
      <img v-for="(item, index) in videoList" :key="index" class="video-thumb" :src="item.binding" :alt="item.title || '视频缩略图'" loading="lazy" @click="changeVideo(index)" />
      <img class="add-icon" src="https://file.aizhs.top/sys-mini/xtk/study_icon_add_grad.png" alt="上传视频" loading="lazy" @click="uploadVideo" />
    </div>
    <div v-if="status === 'add'" class="video-list flex-row">
      <span class="field-label bold">{{ t('studyAddVideo.video') }}</span>
      <img class="add-icon-large" src="https://file.aizhs.top/sys-mini/xtk/study_icon_add_grad.png" alt="上传视频" loading="lazy" @click="uploadVideo" />
    </div>

    <div v-if="status === 'all'" class="sub-title">{{ t('studyAddVideo.collectionTitle') }}</div>
    <el-input v-if="status === 'all'" :model-value="groupTitle" disabled class="mb18" />

    <div class="sub-title">{{ t('studyAdd.title') }}</div>
    <el-input v-model="formInfo.title" :placeholder="t('studyAddVideo.titlePlaceholder')" :disabled="status === 'all'" class="mb18" />

    <div class="sub-title">{{ t('studyAdd.desc') }}</div>
    <el-input v-model="formInfo.content" type="textarea" :rows="4" :placeholder="t('studyAddVideo.descPlaceholder')" :disabled="status === 'all'" class="mb18" />

    <div class="net-ai">{{ t('study.relatedApp') }}</div>
    <el-input v-model="agentName" :placeholder="t('studyAddVideo.searchAgent')" :disabled="status === 'all'" class="mb18"
      @focus="focusAiSearch" @blur="blurAiSearch" />

    <div v-show="showAiList" class="ai-dropdown">
      <div v-for="item in aiOptions" :key="item.agentId" class="ai-option" @click="selectAi(item)">
        {{ item.agentName }}
      </div>
    </div>

    <div v-if="formInfo.aiList.length" class="ai-tags">
      <el-tag v-for="item in formInfo.aiList" :key="item.id" type="primary" class="ai-tag">
        {{ item.name }}
      </el-tag>
    </div>

    <div class="sub-title">{{ t('study.topComment') }}</div>
    <el-input v-model="formInfo.remark" type="textarea" :rows="3" :placeholder="t('studyAddVideo.remarkPlaceholder')" :disabled="status === 'all'" class="mb18" />
    <el-button type="primary" link @click="showRemarkUrl = true">{{ t('studyAddVideo.addLink') }}</el-button>

    <el-dialog v-model="showRemarkUrl" :title="t('studyAddVideo.addResourceLink')" width="400px">
      <el-input v-model="remarkText" type="textarea" :rows="3" :placeholder="t('studyAddVideo.linkPlaceholder')" />
      <template #footer>
        <el-button type="primary" @click="pushRemark">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>

    <div class="sub-title">{{ t('study.selectTags') }}</div>
    <div class="tag-list">
      <el-check-tag v-for="item in tabList" :key="item.id" :checked="typeList.includes(item)"
        @change="changeTypes($event, item)">
        {{ item.name }}
      </el-check-tag>
    </div>

    <div v-if="status === 'add'" class="submit-area">
      <el-button type="primary" class="publish-btn" @click="submit('add')">{{ t('studyAddVideo.publish') }}</el-button>
    </div>
    <div v-if="status === 'edit'" class="submit-area flex-between">
      <el-button @click="cancel">{{ t('common.cancel') }}</el-button>
      <el-button v-if="canEdit" type="primary" @click="submit('edit')">{{ t('studyAddVideo.edit') }}</el-button>
      <el-button v-if="canEdit" type="danger" @click="handleDelete">{{ t('common.delete') }}</el-button>
      <el-button v-if="formInfo.auditStatus === 0" type="success" @click="shangjia">{{ t('studyAddVideo.shelf') }}</el-button>
      <el-button type="primary" link @click="toNext">{{ t('studyAddVideo.uploadNext') }}</el-button>
    </div>
    <div v-if="status === 'all'" class="submit-area flex-between">
      <el-button @click="goback">{{ t('studyAddVideo.done') }}</el-button>
      <el-button type="primary" link @click="toNext">{{ t('studyAddVideo.uploadNext') }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">

import { useI18n } from 'vue-i18n'

const { t } = useI18n()
import { ref, reactive, watch, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { addVideo, getAgentsAlllist, uploadChunkedFile, uploadChunkedFileJoint, getVideoList, videoDelete, videoPut, issue } from '@/services/study'

defineOptions({ name: 'AddVideo' })

const props = withDefaults(defineProps<{
  courseId?: string
  groupTitle?: string
  fromParent?: string
  tabList?: unknown[]
  mainSaidao?: unknown[]
}>(), {
  fromParent: 'add',
  tabList: () => [],
  mainSaidao: () => []
})

const status = ref('add')
const loading = ref(false)
const agentName = ref('')
const showAiList = ref(false)
const aiOptions = ref<unknown[]>([])
const userInfo = ref<Record<string, unknown>>({})
const videoList = ref<unknown[]>([])
const formInfo = reactive({
  id: '',
  binding: '',
  videoPath: '',
  title: '',
  content: '',
  remark: '',
  aiList: [] as Array<{ id: string; name: string }>,
  auditStatus: 0
})
const protoInfo = ref<Record<string, unknown>>({})
const types = ref<Array<{ id: string; name?: string }>>([])
const typeList = ref<unknown[]>([])
const localUrl = ref('')
const chunkSize = ref(5 * 1024 * 1024)
const md5id = ref('')
const chunkCount = ref(0)
const size = ref(0)
const overSize = ref(0)
const vIndex = ref(0)
const fileName = ref('')
const chunkRes = ref<Record<string, unknown>>({})
const chunkUploading = ref(false)
const showRemarkUrl = ref(false)
const remarkText = ref('')

const uploadProgress = computed(() => {
  return totalSize.value > 0 ? Math.floor((overSize.value * 100) / totalSize.value) : 0
})
const totalSize = computed(() => size.value)

const canEdit = computed(() => {
  return [0, 2, 3, 4].includes(formInfo.auditStatus)
})

watch(agentName, () => {
  togetAgentsAlllist()
})

watch(() => props.fromParent, (n) => {
  if (n) status.value = n
}, { immediate: true })

watch(formInfo, (n) => {
  if (n && n.id) protoInfo.value = { ...n }
}, { immediate: true })

onMounted(() => {
  try {
    userInfo.value = JSON.parse(localStorage.getItem('data') || '{}')
  } catch {
    userInfo.value = {}
  }
  togetAgentsAlllist()
})

function pushRemark() {
  formInfo.remark = remarkText.value + '\n' + formInfo.remark
  showRemarkUrl.value = false
}

function uploadVideo() {
  if (status.value === 'all') {
    toNext()
    return
  }
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'video/mp4'
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    chunkUploading.value = true
    localUrl.value = URL.createObjectURL(file)
    fileName.value = file.name
    size.value = file.size
    chunkCount.value = Math.ceil(size.value / chunkSize.value)
    md5id.value = Date.now().toString()
    uploadChunks(file)
  }
  input.click()
}

async function uploadChunks(file: File) {
  for (let i = 0; i < chunkCount.value; i++) {
    const start = i * chunkSize.value
    const end = Math.min((i + 1) * chunkSize.value, file.size)
    const chunk = file.slice(start, end)
    vIndex.value = i
    overSize.value = start
    try {
      const res = await (uploadChunkedFile as unknown as (params: Record<string, unknown>, size: number) => Promise<{ data: Record<string, unknown> }>)({
        file: chunk,
        fileName: fileName.value,
        fileMD5: md5id.value,
        chunkNumber: i,
        totalChunks: chunkCount.value,
        fileType: 'video/mp4'
      }, end - start)
      chunkRes.value = res.data
    } catch {
      ElMessage.error(t('study.chunkUploadFailed'))
      chunkUploading.value = false
      return
    }
  }
  formInfo.videoPath = (chunkRes.value.presetPath as string) || ''
  vIndex.value = 0
  chunkUploading.value = false
  getVideoUrl()
  ElMessage.success(t('study.videoUploadSuccess'))
}

function getVideoUrl() {
  uploadChunkedFileJoint({
    path: chunkRes.value.currentPath as string,
    fileName: fileName.value
  }).then((res: { data?: { url?: string } }) => {
    formInfo.videoPath = res.data?.url ?? ''
  }).catch(() => { ElMessage.error(t('common.errors.getVideoUrlFailed')) })
}

function submit(type: string) {
  if (!enoughInfo()) return
  loading.value = true
  const typesStr = types.value.map((item: { id: string }) => item.id).join(',')
  const agentMap: Record<string, string> = {}
  formInfo.aiList.forEach((item: { id: string; name: string }) => { agentMap[item.id] = item.name })

  const param: Record<string, unknown> = {
    courseId: props.courseId,
    binding: formInfo.binding,
    videoPath: formInfo.videoPath,
    title: formInfo.title,
    content: formInfo.content,
    remark: formInfo.remark,
    types: typesStr,
    agentMap,
    auditStatus: formInfo.auditStatus
  }

  if (type === 'add') {
    addVideo(param as { title: string; url: string; cover?: string; description?: string }).then(() => {
      videoList.value.push({ ...formInfo })
      ok(videoList.value.length)
    }).catch(() => { ElMessage.error(t('common.errors.operationFailed')) }).finally(() => { loading.value = false })
  } else if (type === 'edit') {
    param.id = formInfo.id
    videoPut(param as { id: string; title?: string; url?: string; cover?: string; description?: string }).then(() => {
      ElMessage.success(t('study.editSuccessReview'))
      getEdit()
    }).catch(() => { ElMessage.error(t('common.errors.operationFailed')) }).finally(() => { loading.value = false })
  }
}

function ok(index: number) {
  status.value = 'all'
  Object.assign(formInfo, videoList.value[index - 1] || videoList.value[0])
}

function toNext() {
  status.value = 'add'
  Object.assign(formInfo, { id: '', binding: '', videoPath: '', title: '', content: '', remark: '', aiList: [], auditStatus: 0 })
  types.value = []
  typeList.value = []
  localUrl.value = ''
}

function changeVideo(index: number) {
  Object.assign(formInfo, videoList.value[index])
  status.value = formInfo.id ? 'edit' : 'all'
}

function cancel() {
  Object.assign(formInfo, protoInfo.value)
  protoInfo.value = {}
  status.value = formInfo.id ? 'edit' : 'all'
}

function handleDelete() {
  loading.value = true
  videoDelete([formInfo.id]).then(() => {
    ElMessage.success(t('study.deleteSuccessReview'))
    getEdit()
  }).catch(() => { ElMessage.error(t('common.errors.operationFailed')) }).finally(() => { loading.value = false })
}

function shangjia() {
  loading.value = true
  issue({ id: formInfo.id }).then(() => { getEdit(); loading.value = false }).catch(() => { loading.value = false })
}

function getEdit() {
  loading.value = true
  getVideoList({ courseId: props.courseId, pageSize: 100, pageNum: 1, creator: userInfo.value.uuid as string }).then((res) => {
    const arr = (res.data as unknown as Array<Record<string, unknown>>) || []
    videoList.value = arr
    if (arr.length === 0) {
      status.value = 'add'
    } else {
      status.value = 'edit'
      const datas = arr[0]
      const aiList = datas.agentMap ? Object.entries(datas.agentMap as Record<string, string>).map(([id, name]) => ({ id, name })) : []
      typeList.value = (datas.typeList as unknown[]) || []
      Object.assign(formInfo, { id: datas.id, binding: datas.binding, videoPath: datas.videoPath, title: datas.title, content: datas.content, remark: datas.remark, aiList, auditStatus: datas.auditStatus })
      localUrl.value = datas.videoPath as string
    }
  }).catch((e) => { console.error(e) }).finally(() => { loading.value = false })
}

function changeTypes(checked: boolean, item: { id: string; name?: string }) {
  if (checked) {
    types.value.push(item)
  } else {
    types.value = types.value.filter((t: { id: string }) => t.id !== item.id)
  }
  typeList.value = [...types.value]
}

function changeImage() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      formInfo.binding = reader.result as string
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

function enoughInfo() {
  if (!props.courseId) { ElMessage.error(t('studyAdd.publishFirst')); return false }
  if (chunkUploading.value) { ElMessage.error(t('studyAdd.videoSynth')); return false }
  if (!formInfo.binding) { ElMessage.error(t('studyAdd.uploadCover')); return false }
  if (!formInfo.videoPath) { ElMessage.error(t('studyAdd.uploadVideo')); return false }
  if (!formInfo.title) { ElMessage.error(t('studyAdd.enterTitle')); return false }
  if (!formInfo.content) { ElMessage.error(t('studyAdd.enterDesc')); return false }
  return true
}

function togetAgentsAlllist() {
  getAgentsAlllist({ uuid: userInfo.value.uuid as string, agentName: agentName.value }).then((res) => {
    aiOptions.value = (res.data as { agents?: unknown[] })?.agents || []
  }).catch((e) => { console.error(e) })
}

function focusAiSearch() { showAiList.value = true }
function blurAiSearch() { }
function selectAi(obj: { agentId: string; agentName: string }) {
  const idx = formInfo.aiList.findIndex((i: { id: string }) => i.id === obj.agentId)
  if (idx >= 0) {
    formInfo.aiList.splice(idx, 1)
  } else {
    formInfo.aiList.push({ name: obj.agentName, id: obj.agentId })
  }
  showAiList.value = false
}

function goback() { window.history.back() }
</script>

<style scoped>
.add-video-body {
  padding: 0 12px;
}

.video-image {
  width: 100%;
  margin-bottom: 12px;
}

.flex-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.flex-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.field-label {
  font-size: 14px;
  font-weight: bold;
  color: var(--color-black-60);
  margin-right: 8px;
  white-space: nowrap;
}

.field-label.bold {
  font-weight: bold;
}

.cover-image {
  width: 220px;
  height: 125px;
  border-radius: var(--global-border-radius);
}

.video-preview {
  width: 220px;
  height: 125px;
  border-radius: var(--global-border-radius);
}

.add-icon {
  width: 40px;
  height: 40px;
  cursor: pointer;
}

.add-icon-large {
  width: 100px;
  height: 100px;
  cursor: pointer;
}

.video-list {
  margin-bottom: 12px;
}

.video-thumb {
  width: 70px;
  height: 40px;
  border-radius: var(--global-border-radius);
  border: 2px solid var(--color--6c52ff);
  cursor: pointer;
}

.mb18 {
  margin-bottom: 18px;
}

.sub-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--color-black);
  margin: 12px 0;
}

.net-ai {
  font-size: 14px;
  font-weight: bold;
  color: var(--color-blue-768dff);
  margin: 10px 0;
}

.ai-dropdown {
  width: 100%;
  max-height: 150px;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  overflow-y: auto;
  margin-bottom: 12px;
}

.ai-option {
  padding: 8px 12px;
  cursor: pointer;
}

.ai-option:hover {
  background-color: var(--color-blue-d9e6fd);
}

.ai-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}

.ai-tag {
  color: var(--color-blue-768dff);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.submit-area {
  padding: 20px 0;
}

.publish-btn {
  background: var(--color-black);
  color: var(--color-white);
}
</style>
