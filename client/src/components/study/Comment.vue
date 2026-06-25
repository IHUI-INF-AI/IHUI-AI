<template>
  <div class="comment">
    <el-loading v-if="loading" />
    <div class="scroll-container" @scroll="onScroll">
      <div>
        <span class="comment-title">{{ t('studyComment.hotComments') }}</span>
        <div v-for="item in commentList" :key="item.id || item.createdAt" class="comment-item">
          <div class="header">
            <img class="avatar" :src="item.avatar" :alt="item.username || '用户头像'" />
            <div>
              <span class="name">{{ item.nickname || '' }}</span>
              <span class="date">{{ item.createdAt || '' }}</span>
            </div>
          </div>
          <div class="content">{{ item.content }}</div>
          <div v-if="item.id && item.id !== 0" class="btns">
            <img class="reply-icon" src="https://file.aizhs.top/sys-mini/xtk/study_comment_info.png"
              alt="" loading="lazy" @click="showTalk(item)" />
          </div>
          <div v-if="item.showTalk" class="reply-box">
            <div class="reply-item">
              <span class="reply-name">{{ userInfo.nickname }}：</span>
              <span class="reply-text">{{ childContext }}</span>
            </div>
          </div>
          <div v-if="item.videoComments && item.videoComments.length > 0" class="reply-box">
            <div v-for="(com, ci) in item.videoComments" :key="ci" class="reply-item">
              <span class="reply-name">{{ com.nickname }}：</span>
              <span class="reply-text">{{ com.content }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="input-area">
      <el-input v-model="inputValue" :placeholder="t('studyComment.enterComment')" @keyup.enter="sendComment" />
      <el-button type="primary" @click="sendComment">{{ t('studyComment.send') }}</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, onMounted } from 'vue'
import { getUserVideoCommentList, userVideoComment } from '@/services/study'

defineOptions({ name: 'Comment' })


const { t } = useI18n()
const props = defineProps<{
  videoId?: string
  remark?: string
}>()

const commentList = ref<any[]>([])
const pageNum = ref(1)
const pageSize = 10
const total = ref(0)
const userInfo = ref<any>({})
const childContext = t('studyComment.enterReply')
const parentId = ref('')
const loading = ref(false)
const inputValue = ref('')

onMounted(() => {
  try {
    userInfo.value = JSON.parse(localStorage.getItem('data') || '{}')
  } catch {
    userInfo.value = {}
  }
  getData()
})

function showTalk(item: any) {
  if (parentId.value) {
    parentId.value = ''
    item.showTalk = false
  } else {
    parentId.value = item.id
    item.showTalk = true
  }
}

function sendComment() {
  if (!inputValue.value.trim()) return
  loading.value = true
  userVideoComment({
    videoId: props.videoId,
    userUuid: userInfo.value.uuid,
    content: inputValue.value,
    parentId: parentId.value
  }).then(() => {
    if (parentId.value) parentId.value = ''
    inputValue.value = ''
    getData()
  }).catch(() => { loading.value = false })
}

function getData() {
  loading.value = true
  getUserVideoCommentList({
    pageNum: pageNum.value,
    pageSize,
    videoId: props.videoId
  }).then((res: any) => {
    commentList.value = res.data || []
    total.value = res.total
    if (props.remark) {
      commentList.value.unshift({ id: 0, content: props.remark })
    }
  }).catch((e) => { console.error(e) }).finally(() => { loading.value = false })
}

function onScroll(e: Event) {
  const el = e.target as HTMLDivElement
  if (el.scrollHeight - el.scrollTop <= el.clientHeight + 50) {
    if (commentList.value.length < total.value) {
      pageNum.value++
      getData()
    }
  }
}
</script>

<style scoped>
.comment {
  margin-top: 8px;
  width: 100%;
}

.comment-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-black);
}

.scroll-container {
  height: calc(100vh - 430px);
  overflow-y: auto;
}

.comment-item {
  margin-top: 10px;
  border-bottom: var(--unified-border-bottom);
  padding-bottom: 8px;
}

.header {
  display: flex;
  align-items: center;
}

.avatar {
  width: 30px;
  height: 30px;
  border-radius: var(--global-border-radius);
  margin-right: 4px;
}

.name {
  font-size: 13px;
  color: var(--color-black);
  display: block;
}

.date {
  font-size: 12px;
  color: var(--color-black-60);
}

.content {
  margin-left: 34px;
  white-space: pre-wrap;
  margin-bottom: 4px;
  color: var(--color-gray-757575);
  word-break: break-all;
  width: calc(100% - 50px);
}

.btns {
  display: flex;
  justify-content: flex-end;
}

.reply-icon {
  width: 22px;
  height: 20px;
  cursor: pointer;
}

.reply-box {
  margin-left: 34px;
  padding: 6px 10px;
  border-radius: var(--global-border-radius);
  background: var(--color-gray-f4f4f4);
  margin-top: 6px;
}

.reply-item {
  display: flex;
  margin-bottom: 8px;
}

.reply-name {
  font-size: 12px;
  color: var(--color-purple-8d83ff);
}

.reply-text {
  font-size: 12px;
  color: var(--color-gray-757575);
}

.input-area {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
</style>
