<template>
  <div class="model-list-block">
    <div v-if="loading" class="loading-wrapper">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>{{ t('studyIndexModelList.loading') }}</span>
    </div>

    <div v-if="fromPage === 'home'" class="header-bar">
      <div class="header-left">
        <img class="icon-blink" src="https://file.aizhs.top/sys-mini/xtk/study_icon_blink.png" alt="" loading="lazy" />
        <span class="blink-text">{{ t('studyIndexModelList.recommendGroups') }}</span>
      </div>
      <div v-if="pageType === 'index'" class="header-right" @click="showMore">
        <span class="right-text">{{ t('studyIndexModelList.viewMore') }}</span>
        <img class="icon-right" src="https://file.aizhs.top/sys-mini/xtk/study_icon_right.png" alt="" />
      </div>
    </div>

    <div v-if="fromPage === 'home'" class="bar-wrapper">
      <el-radio-group v-model="stage" size="small" @change="handleStageChange">
        <el-radio-button v-for="item in barList" :key="item.id" :label="item.id">
          {{ item.name }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <!-- Tip Dialog -->
    <el-dialog v-model="showTip" :title="t('studyModelList.functionDescription')" width="400px">
      <span>{{ textInfo || t('studyModelList.noDescription') }}</span>
      <template #footer>
        <el-button @click="showTip = false">{{ t('common.close') }}</el-button>
      </template>
    </el-dialog>

    <div
      ref="scrollContainer"
      class="scroll-body"
      :style="{ maxHeight: maxHeight || (pageType === 'model' ? 'none' : '450px') }"
      @scroll="handleScroll"
    >
      <div class="scroll-height">
        <ModelItem
          v-for="(item, index) in agentList"
          :key="item.id"
          :item="item"
          :idx="index"
          @intelli-show="intelliShow"
          @get-agent-like="getAgentLike"
          @get-agent-collect="getAgentCollect"
          @to-detail="toDetail(item)"
        />
      </div>

      <div v-if="pageType === 'model' && agentList.length > 0" class="no-more">
        <div class="line"></div>
        <span class="no-more-text">{{ t('studyIndexModelList.noMore') }}</span>
        <div class="line"></div>
      </div>

      <div v-if="pageType === 'model' && agentList.length > 0" class="footer-image">
        <img src="https://file.aizhs.top/sys-mini/yejiao.png" alt="" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loading } from '@element-plus/icons-vue'
import ModelItem from './ModelItem.vue'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    pageType?: string
    types?: string
    modelCategroys?: string
    modelSearch?: string
    fromPage?: string
    maxHeight?: string
  }>(),
  {
    pageType: 'index',
    types: '',
    modelCategroys: '',
    modelSearch: '',
    fromPage: 'home',
    maxHeight: ''
  }
)

const emit = defineEmits<{
  modelClick: [item: any]
  showMore: []
}>()

const barList = ref([
  { name: '入门课程', id: 0 },
  { name: '进阶课程', id: 1 },
  { name: '精通课程', id: 2 }
])

const agentList = ref<any[]>([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)
const stage = ref(0)
const textInfo = ref('')
const showTip = ref(false)
const userInfo = ref<any>({})
const scrollContainer = ref<HTMLElement>()

async function getData() {
  loading.value = true
  try {
    // Replace with actual API call
    const param: Record<string, any> = {
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      types: props.types,
      categorys: props.modelCategroys,
      title: props.modelSearch,
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
    if (agentList.value.length < total.value) {
      pageNum.value++
      getData()
    }
  }
}

function toDetail(item: any) {
  emit('modelClick', item)
}

function showMore() {
  emit('showMore')
}

function intelliShow(val: string) {
  textInfo.value = val
  showTip.value = true
}

function getAgentLike(_id: any) {
}

function getAgentCollect(_id: any) {
}

watch(
  () => props.types,
  () => {
    pageNum.value = 1
    getData()
  }
)

watch(
  () => props.modelCategroys,
  () => {
    pageNum.value = 1
    getData()
  }
)

watch(
  () => props.modelSearch,
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
.model-list-block {
  width: 100%;
  box-sizing: border-box;
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
  width: 24px;
  height: 24px;
  margin-right: 6px;
}

.blink-text {
  font-family: AlimamaFangYuanTi, sans-serif;
  font-size: 18px;
  font-weight: bold;
  color: var(--color--ff5656);
}

.header-right {
  display: flex;
  align-items: center;
  cursor: pointer;
}

.right-text {
  font-family: AlimamaFangYuanTi, sans-serif;
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
