<template>
    <view>
        <navigationBars viscosity="true" :title="pageTitle" :image="'https://file.aizhs.top/sys-mini/default/back.svg'"
            @pack="goBack" :showBack="false" />
        <Group v-if="!showAddVideo" ref="group" :courseId="courseId" :fromParent="groupStatus"
            @toUploadVideoPage="toUploadVideoPage" @getGroupId="getGroupId" :tabList="tabList"
            :mainSaidao="mainSaidao" />
        <AddVideo v-if="showAddVideo" ref="study" :courseId="courseId" :groupTitle="groupTitle" :tabList="tabList"
            :mainSaidao="mainSaidao" />
    </view>
</template>
<script setup>
import { ref, onMounted, nextTick } from 'vue'
import NavigationBars from "@/components/navigation-bars/index.vue"
import Group from './components/group.vue'
import AddVideo from './components/add_video.vue'
import { category, categoryDictionary } from '@/service/aiModels.js'

const group = ref(null)
const study = ref(null)

const groupStatus = ref('add')
const showAddVideo = ref(false)
const groupTitle = ref('')
const courseId = ref('')
const pageTitle = ref('发布课程合集')
const tabList = ref([])
const mainSaidao = ref([])

function getGroupId(data) {
    courseId.value = data.id
    groupTitle.value = data.title
    groupStatus.value = 'edit'
}

function toUploadVideoPage() {
    if (groupStatus.value == 'edit') {
        showAddVideo.value = true
        study.value.getEdit(courseId.value)
    } else {
        uni.showToast({
            title: '请先发布合集',
            icon: 'none'
        })
    }
}

function goBack() {
    if (showAddVideo.value) {
        showAddVideo.value = false
        nextTick(() => {
            group.value.getEdit()
        })
    } else {
        uni.switchTab({
            url: '/pagesA/studyindex/index'
        })
    }
}

onMounted(() => {
    category(0).then(res => {
        tabList.value = res.data
    })
    categoryDictionary().then(res => {
        console.log('categoryDictionary', res)
        mainSaidao.value = res.data
    })
})
</script>
<style lang="scss" scoped>
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

.m_b {
    margin-bottom: 18rpx;
}
</style>
