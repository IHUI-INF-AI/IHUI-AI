<template>
    <view>
        <navigationBars viscosity="true" :title="pageTitle" :image="'https://file.aizhs.top/sys-mini/default/back.svg'"
            @pack="goBack" :showBack="false" />
        <Loading v-if="loading"></Loading>
        <view v-if="pageType == 'index'" class="my_study_index">
            <Bar :barList="barList" @change="changeBar"></Bar>
            <text class="sub_title">课程赛道</text>
            <Single :options="mainSaidao" @change="changeMain"></Single>

            <text class="sub_title">细分赛道</text>
            <Single :options="subSaidao" @change="changeSub"></Single>

            <text class="sub_title">课程标签</text>
            <Tab customize :options="tabList" @change="changeTypes"></Tab>

            <view class="m_title">合集</view>
            <view class="model_search">
                <input class="v_title_f m_b18" v-model="modelSearch" type="text" placeholder="请输入合集标题查询"
                    placeholder-class="placeholder_color">
            </view>
            <ModelList ref="ModelList" pageType="index" fromPage="edit" :modelSearch="modelSearch"
                @modelClick="modelClick" maxHeight="236rpx" />

            <view class="s_title">课程</view>
            <StudyList ref="StudyList" pageType="index" fromPage="edit" :studyCategroys="categorys" :types="types"
                @videoClick="videoClick" />
        </view>

        <Group v-if="pageType == 'model'" ref="group" fromParent="edit" :courseId="courseId" :hasPublish="false"
            @goBack="() => { pageType = 'index'; refresh() }" @toUploadVideoPage="toUploadVideoPage" :tabList="tabList" :mainSaidao="mainSaidao"></Group>
        <AddVideo v-if="pageType == 'study'" ref="addvideo" fromParent="edit" :courseId="courseId"
            :groupTitle="groupTitle" :tabList="tabList" :mainSaidao="mainSaidao"></AddVideo>
    </view>
</template>
<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import NavigationBars from "@/components/navigation-bars/index.vue"
import Group from './components/group.vue'
import AddVideo from './components/add_video.vue'
import Bar from '@/components/study/bar.vue'
import Tab from '@/components/type-bar/tab.vue'
import Single from '@/components/type-bar/single.vue'
import Loading from "@/components/loading/index.vue"
import { category, categoryDictionary } from '@/service/aiModels.js'
import ModelList from '@/pagesA/studyindex/components/model_list.vue'
import StudyList from '@/pagesA/studyindex/components/study_list.vue'

const ModelList = ref(null)
const StudyList = ref(null)
const group = ref(null)
const addvideo = ref(null)

const pageType = ref('index')
const barList = ref([
    { name: '入门课程', id: 0 },
    { name: '进阶课程', id: 1 },
    { name: '精通课程', id: 2 },
])
const stage = ref(0)
const courseId = ref('')
const groupTitle = ref('')
const videoList = ref([])
const pageSize = ref(10)
const pageNum = ref(1)
const total = ref(0)
const loading = ref(false)
const tabList = ref([])
const mainSaidao = ref([])
const subSaidao = ref([])
const categorys = ref('')
const types = ref([])
const modelSearch = ref('')

const pageTitle = computed(() => {
    return pageType.value == 'model' ? '修改合集' : pageType.value == 'study' ? '修改课程' : '我的课程'
})

watch(pageType, (n) => {
    if (n == 'index') {
        refresh()
    }
}, { immediate: true })

function refresh() {
    nextTick(() => {
        ModelList.value.getData()
        StudyList.value.getData()
    })
}

function modelClick(obj) {
    courseId.value = obj.id
    groupTitle.value = obj.title
    pageType.value = 'model'
    nextTick(() => {
        group.value.getEdit()
    })
}

function videoClick(obj) {
    courseId.value = obj.courseId
    groupTitle.value = obj.title
    pageType.value = 'study'
    nextTick(() => {
        addvideo.value.getEdit(obj.id)
    })
}

function toUploadVideoPage() {
    pageType.value = 'study'
    nextTick(() => {
        addvideo.value.getEdit()
    })
}

function changeMain(obj) {
    if (obj.children) {
        subSaidao.value = obj.children
    }
}

function changeBar(item) {
    stage.value = item.id
    refresh()
}

function changeSub(obj) {
    categorys.value = obj.id
}

function changeTypes(val) {
    const arr = val.map(item => {
        return item.id
    })
    types.value = arr
}

function changeStage(obj) {
    stage.value = obj.id
}

function goBack() {
    if (pageType.value == 'index') {
        uni.switchTab({
            url: '/pagesA/studyindex/index'
        })
    } else {
        pageType.value = 'index'
    }
}

onShow(() => {
    nextTick(() => {
        ModelList.value.getData()
    })
})

onMounted(() => {
    category(0).then(res => {
        tabList.value = res.data
    })
    categoryDictionary().then(res => {
        mainSaidao.value = res.data
    })
})
</script>
<style lang="scss" scoped>
.my_study_index {
    width: 100%;
    box-sizing: border-box;
    padding: 0 18rpx;

    .m_title {
        font-family: Alimama FangYuanTi VF !important;
        font-size: 36rpx;
        font-weight: bold;
        color: #FF5656;
        width: 100%;
        box-sizing: border-box;
        height: 80rpx;
        text-align: center;
    }

    .s_title {
        font-family: Alimama FangYuanTi VF !important;
        font-size: 36rpx;
        font-weight: bold;
        color: rgba(0, 0, 0, 0.8);
        width: 100%;
        box-sizing: border-box;
        height: 80rpx;
        text-align: center;
    }
}

.sub_title {
    font-size: 32rpx;
    font-weight: bold;
    color: #000000;
    margin: 18rpx 0;
    box-sizing: border-box;
    display: block;
}

.model_search {
    .v_title_f {
        font-family: Alimama FangYuanTi VF !important;
        font-size: 32rpx;
        font-weight: bold;
        color: #999999;

        width: 100%;
        box-sizing: border-box;
        border: 1rpx solid #D8D8D8;
        border-radius: 8rpx;
        padding: 12rpx 15rpx;
        min-height: 72rpx;
    }

    .placeholder_color {
        color: #999999;
        font-weight: normal !important;
    }
}

.f_n {
    display: flex;
    align-items: center;
}

.f_c {
    display: flex;
    align-items: center;
    justify-content: center;
}

.f_b {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.f_a {
    display: flex;
    align-items: center;
    justify-content: space-around;
}

.m_b18 {
    margin-bottom: 18rpx;
}
</style>
