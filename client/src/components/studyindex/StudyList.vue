<template>
  <div class="study-list-block">
    <div v-if="loading" class="loading-wrapper">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>{{ t('studyIndexStudyList.loading') }}</span>
    </div>

    <div v-if="fromPage === 'home'" class="header-bar" style="padding-top: 5px">
      <div class="header-left">
        <img class="icon-blink" src="https://file.aizhs.top/sys-mini/xtk/new.png" alt="" loading="lazy" />
        <span class="blink-text">{{ t('studyIndexStudyList.latestCourses') }}</span>
      </div>
      <div v-if="pageType === 'index'" class="header-right" @click="showMore">
        <span class="right-text">{{ t('studyIndexStudyList.viewMore') }}</span>
        <img class="icon-right" src="https://file.aizhs.top/sys-mini/xtk/study_icon_right.png" alt="" loading="lazy" />
      </div>
    </div>

    <div v-if="fromPage === 'home'" class="bar-wrapper">
      <el-radio-group v-model="stage" size="small" @change="handleStageChange">
        <el-radio-button v-for="item in barList" :key="item.id" :label="item.id">
          {{ item.name }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <!-- Index page: fixed height scroll -->
    <div
      v-if="pageType === 'index'"
      class="scroll-body"
      style="max-height: 430px"
    >
      <div class="scroll-height">
        <div v-for="(item, index) in studyList" :key="index" class="study-item" @click="toDetail(item)">
          <img class="video" :src="item.binding" :alt="item.title || '视频封面'" loading="lazy" />
          <div class="video-info">
            <span class="title">{{ item.title }}</span>
            <span class="date">{{ item.createdAt }}</span>
          </div>
          <div class="item-title">{{ item.name }}</div>
          <div class="item-footer">
            <div class="footer-left">
              <img
                class="icon-logo"
                :src="item.avatar || 'https://file.aizhs.top/sys-mini/default/logo/guanlogo.png'"
                :alt="item.title || '图标'"
                loading="lazy"
              />
              <span class="name">{{ item.nickname || t('studyList.officialName') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Other pages: dynamic height scroll -->
    <div
      v-else
      ref="scrollContainer"
      class="scroll-body"
      style="height: calc(100vh - 480px)"
      @scroll="handleScroll"
    >
      <div class="scroll-height">
        <div v-for="(item, index) in studyList" :key="index" class="study-item" @click="toDetail(item)">
          <img class="video" :src="item.binding" :alt="item.title || '视频封面'" loading="lazy" />
          <div class="video-info">
            <span class="title">{{ item.title }}</span>
            <span class="date">{{ item.createdAt }}</span>
          </div>
          <div class="item-title">{{ item.name }}</div>
          <div class="item-footer">
            <div class="footer-left">
              <img
                class="icon-logo"
                :src="item.avatar || 'https://file.aizhs.top/sys-mini/default/logo/guanlogo.png'"
                :alt="item.title || '图标'"
                loading="lazy"
              />
              <span class="name">{{ item.nickname || t('studyList.officialName') }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="pageType === 'study' && studyList.length > 0" class="no-more">
        <div class="line"></div>
        <span class="no-more-text">{{ t('studyIndexStudyList.noMore') }}</span>
        <div class="line"></div>
      </div>

      <div v-if="pageType === 'study' && studyList.length > 0" class="footer-image">
        <img src="https://file.aizhs.top/sys-mini/yejiao.png" alt="" loading="lazy" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ref, watch, onMounted } from 'vue'
import { Loading } from '@element-plus/icons-vue'

const { t } = useI18n()
const props = withDefaults(
  defineProps<{
    pageType?: string
    types?: string
    studyCategroys?: string
    studySearch?: string
    fromPage?: string
  }>(),
  {
    pageType: 'index',
    types: '',
    studyCategroys: '',
    studySearch: '',
    fromPage: 'home'
  }
)

const emit = defineEmits<{
  videoClick: [item: any]
  showMore: []
}>()

const barList = ref([
  { name: '入门课程', id: 0 },
  { name: '进阶课程', id: 1 },
  { name: '精通课程', id: 2 }
])

const studyList = ref<any[]>([])
const loading = ref(false)
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const stage = ref(0)
const userInfo = ref<any>({})
const scrollContainer = ref<HTMLElement>()

async function getData() {
  loading.value = true
  try {
    const param: Record<string, any> = {
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      types: props.types,
      categorys: props.studyCategroys,
      title: props.studySearch,
      stage: stage.value
    }
    if (props.fromPage === 'edit') {
      param.creator = userInfo.value.uuid
    }
  } finally {
    loading.value = false
  }
}

function handleStageChange() {
  pageNum.value = 1
  getData()
}

function handleScroll() {
  if (!scrollContainer.value) return
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value
  if (scrollTop + clientHeight >= scrollHeight - 50) {
    if (studyList.value.length < total.value) {
      pageNum.value++
      getData()
    }
  }
}

function toDetail(item: any) {
  emit('videoClick', item)
}

function showMore() {
  emit('showMore')
}

watch(
  () => props.types,
  () => {
    pageNum.value = 1
    getData()
  }
)

watch(
  () => props.studyCategroys,
  () => {
    pageNum.value = 1
    getData()
  }
)

watch(
  () => props.studySearch,
  () => {
    pageNum.value = 1
    getData()
  }
)

onMounted(() => {
  getData()
})
</script>

<style scoped>
.study-list-block {
  width: 100%;
}

.loading-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
  color: var(--color-gray-999);
}

.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.header-left {
  display: flex;
  align-items: center;
}

.icon-blink {
  width: 26px;
  height: 26px;
  margin-right: 6px;
}

.blink-text {
  font-family: inherit;
  font-size: 18px;
  font-weight: bold;
  color: var(--color-black-80);
}

.header-right {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.right-text {
  font-family: inherit;
  font-size: 14px;
  color: var(--color-gray-3d);
}

.icon-right {
  width: 10px;
  height: 16px;
  margin-left: 4px;
}

.bar-wrapper {
  margin-bottom: 12px;
}

.scroll-body {
  width: 100%;
  box-sizing: border-box;
  overflow-y: auto;
}

.scroll-height {
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.study-item {
  width: calc(50% - 16px);
  margin: 4px;
  box-sizing: border-box;
  position: relative;
  cursor: pointer;
}

.study-item .video {
  width: 100%;
  height: 178px;
  border-radius: var(--global-border-radius);
  background-color: var(--color-black);
  object-fit: cover;
}

.video-info {
  position: absolute;
  top: 148px;
  left: 6px;
  width: calc(100% - 12px);
  overflow: hidden;
  display: flex;
  justify-content: space-between;
}

.video-info .title {
  height: 13px;
  font-size: 9px;
  font-weight: bold;
  color: var(--color-white);
  flex: 1;
}

.video-info .date {
  font-size: 9px;
  font-weight: bold;
  color: var(--color-white);
  width: 50px;
  text-align: right;
}

.item-title {
  font-family: inherit;
  font-size: 12px;
  color: var(--color-gray-3d);
  margin: 4px 0;
}

.item-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.footer-left {
  display: flex;
  align-items: center;
}

.icon-logo {
  width: 12px;
  height: 12px;
  border-radius: var(--global-border-radius);
  margin-right: 2px;
}

.name {
  font-family: inherit;
  font-size: 9px;
  font-weight: bold;
  color: var(--color-black-60);
}

.no-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 20px;
  width: 100%;
  margin-top: 10px;
}

.no-more .line {
  flex: 1;
  height: 1px;
  background-color: var(--color-gray-e0);
}

.no-more-text {
  margin: 0 10px;
  color: var(--color-gray-767676);
  font-size: 12px;
}

.footer-image {
  width: 100%;
  padding-bottom: 5px;
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: flex-end;
}

.footer-image img {
  width: 174px;
}
</style>
