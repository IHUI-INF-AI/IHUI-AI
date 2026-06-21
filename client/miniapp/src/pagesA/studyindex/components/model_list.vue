<template>
    <view class="m_l_b">
        <Loading v-if="loading"></Loading>
        <view v-if="fromPage == 'home'" class="f_b m_b18">
            <view class="f_n">
                <image class="icon_blink" src="https://file.aizhs.top/sys-mini/xtk/study_icon_blink.png" />
                <text class="blink_text">推荐课程合集</text>
            </view>
            <view class="f_n" @click="showMore" v-if="pageType == 'index'">
                <text class="right_text">查看更多</text>
                <image class="icon_right" mode="widthFix" src="https://file.aizhs.top/sys-mini/xtk/study_icon_right.png" />
            </view>
        </view>
        <Bar v-if="fromPage == 'home'" :barList="barList" @change="changeBar"></Bar>
        <!-- 遮罩层 -->
        <view v-if="showTip" class="mask" @click="() => { showTip = false }"></view>
        <!-- 弹窗内容 -->
        <view v-if="showTip" class="dialog">
            <text>{{ textInfo == "" ? "此功能暂无说明" : textInfo }}</text>
            <view style="margin-top: 40rpx;">
                <button @click="() => { showTip = false }">关闭</button>
            </view>
        </view>

        <scroll-view class="scroll_body" :scroll-top="0" scroll-y lower-threshold="50" @scrolltolower="scrolltolower">
            <!-- 首页列表高度：尽量撑满至页面底部 -->
            <view class="scroll_height"
                :style="{ maxHeight: maxHeight ? maxHeight : pageType == 'model' ? 'auto' : '900rpx' }">
                <ModelItem v-for="(item, index) in agentList" :key="item.id" :item="item" :idx="index"
                    @intelliShow="intelliShow" @getAgentLike="getAgentLike" @getAgentCollect="getAgentCollect"
                    @toDetail="toDetail(item)">
                </ModelItem>
            </view>
            <!-- 没有更多了（不再为 tabbar 预留，仅保留适当间距） -->
            <view style="display: flex;justify-content: center;padding-top: 40rpx;"
                v-if="pageType == 'model' && agentList.length > 0">
                <view class="f_c" style="width: 100%;margin-top: 20rpx;">
                    <view class="line"></view>
                    <text class="no-more-text">没有更多了</text>
                    <view class="line"></view>
                </view>
            </view>
            <!-- 官网链接 -->
            <view v-if="pageType == 'model' && agentList.length > 0"
                style="width: 100%;padding-bottom: 10rpx; text-align: center;text-align: center;display: flex;justify-content: center;align-items: flex-end;">
                <image style="text-align: center;width:348rpx;" src="https://file.aizhs.top/sys-mini/yejiao.png"
                    mode="widthFix" />
            </view>
        </scroll-view>
    </view>
</template>
<script setup>
import { ref, watch, onMounted } from 'vue'
import Bar from '@/components/study/bar.vue'
import { getGroupList } from '@/service/study.js'
import Loading from "@/components/loading/index.vue";
import ModelItem from './model_item.vue'

const props = defineProps({
    pageType: {
        type: String,
        default: 'index'
    },
    types: {
        type: String,
        default: ''
    },
    modelCategroys: {
        type: String,
        default: ''
    },
    modelSearch: {
        type: String,
        default: ''
    },
    fromPage: {
        type: String,
        default: 'home'
    },
    maxHeight: String
})

const emit = defineEmits(['modelClick', 'showMore'])

const barList = ref([
    { name: '入门课程', id: 0 },
    { name: '进阶课程', id: 1 },
    { name: '精通课程', id: 2 },
])
const agentList = ref([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)
const stage = ref(0)
const textInfo = ref('')
const showTip = ref(false)
const userInfo = ref({})

function getData() {
    loading.value = true
    let param = {
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        types: props.types,
        categorys: props.modelCategroys,
        title: props.modelSearch,
        stage: stage.value,
    }
    if (props.fromPage == 'edit') {
        param.creator = userInfo.value.uuid
    }
    getGroupList(param).then(res => {
        console.log('getGroupList', res)
        agentList.value = res.data
        total.value = res.total
    }).finally(() => {
        loading.value = false
    })
}

function changeBar(item) {
    stage.value = item.id
    getData()
}

function scrolltolower() {
    if (agentList.value.length < total.value) {
        pageNum.value++
        getData()
    }
}

function toDetail(item) {
    emit('modelClick', item)
}

function showMore() {
    emit('showMore')
}

function intelliShow(val) {
    textInfo.value = val
    showTip.value = true
}

watch(() => props.types, () => {
    pageNum.value = 1
    getData()
})

watch(() => props.modelCategroys, () => {
    pageNum.value = 1
    getData()
})

watch(() => props.modelSearch, () => {
    pageNum.value = 1
    getData()
})

userInfo.value = uni.getStorageSync('data')
console.log('userInfo', userInfo.value)

onMounted(() => {
    getData()
})
</script>
<style lang="scss" scoped>
.scroll_body {
    width: 100%;
    box-sizing: border-box;

    .scroll_height {
        width: 100%;
        box-sizing: border-box;
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        overflow: hidden;
    }
}

.mask {
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 10001;
}

.dialog {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    background: #fff;
    border-radius: 16rpx;
    padding: 40rpx 30rpx;
    z-index: 1001;
    min-width: 600rpx;
    text-align: center;
    box-shadow: 0 0 32rpx rgba(0, 0, 0, 0.18);
    z-index: 10002;
    color: #000;
}

.m_l_b {
    width: 100%;
    box-sizing: border-box;

    .icon_blink {
        width: 48rpx;
        height: 48rpx;
        margin-right: 12rpx;
    }

    .blink_text {
        font-family: Alimama FangYuanTi VF !important;
        font-size: 36rpx;
        font-weight: bold;
        color: #FF5656;
    }

    .icon_right {
        width: 21rpx;
        height: 33rpx;
        margin-left: 8rpx;
    }

    .right_text {
        font-family: Alimama FangYuanTi VF !important;
        font-size: 28rpx;
        font-weight: normal;
        color: #3D3D3D;
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

.m_b18 {
    margin-bottom: 18rpx;
}
</style>
