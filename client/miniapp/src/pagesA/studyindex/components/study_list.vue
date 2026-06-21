<template>
    <view class="s_l_b">
        <Loading v-if="loading"></Loading>
        <view v-if="fromPage == 'home'" class="f_b m_b18" style="padding-top: 10rpx;">
            <view class="f_n">
                <image class="icon_blink" src="https://file.aizhs.top/sys-mini/xtk/new.png" />
                <text class="blink_text">最新课程</text>
            </view>
            <view class="f_n" @click="showMore" v-if="pageType == 'index'">
                <text class="right_text">查看更多</text>
                <image class="icon_right" mode="widthFix" src="https://file.aizhs.top/sys-mini/xtk/study_icon_right.png" />
            </view>
        </view>
        <Bar v-if="fromPage == 'home'" :barList="barList" @change="changeBar"></Bar>

        <!-- 首页列表高度：尽量撑满至页面底部 -->
        <scroll-view v-if="pageType == 'index'" class="scroll_body" :style="{ maxHeight: '860rpx' }" scroll-y>
            <view class="scroll_height">
                <view class="study_item" v-for="(item, index) in studyList" :key="index" @click="toDetail(item)">
                    <image class="video" :src="item.binding" />
                    <view class="video_info f_b">
                        <view class="title">{{ item.title }}</view>
                        <text class="date">{{ item.createdAt }}</text>
                    </view>
                    <view class="title">{{ item.name }}</view>
                    <view class="f_b">
                        <view class="f_n">
                            <image class="icon_logo"
                                :src="item.avatar ? item.avatar : 'https://file.aizhs.top/sys-mini/default/logo/guanlogo.png'" />
                            <text class="name">{{ item.nickname ? item.nickname : '智汇社区-官方' }}</text>
                        </view>
                        <view class="f_n"></view>
                    </view>
                </view>
            </view>
        </scroll-view>
        <!-- 高度：尽量撑满至页面底部 -->
        <scroll-view v-else class="scroll_body" :style="{ height: 'calc(100vh - 480rpx)' }" scroll-y lower-threshold="50"
            @scrolltolower="scrolltolower">
            <view class="scroll_height" >
                <view class="study_item" v-for="(item, index) in studyList" :key="index" @click="toDetail(item)">
                    <!-- <video class="video" :controls="false" :src="item.url" object-fit="fill" @waiting="waiting" @error="error"
                    @loadedmetadata="loadedmetadata"></video> -->
                    <image class="video" :src="item.binding" mode="aspectFit" />
                    <view class="video_info f_b">
                        <view class="title">{{ item.title }}</view>
                        <text class="date">{{ item.createdAt }}</text>
                    </view>
                    <view class="title">{{ item.name }}</view>
                    <view class="f_b">
                        <view class="f_n">
                            <image class="icon_logo"
                                :src="item.avatar ? item.avatar : 'https://file.aizhs.top/sys-mini/default/logo/guanlogo.png'" />
                            <text class="name">{{ item.nickname ? item.nickname : '智汇社区-官方' }}</text>
                        </view>
                        <view class="f_n">
                            <!-- <view class="xin-title-hot" v-if="item.isHot == 0" style="margin-top: 0;">
                                <image src="https://file.aizhs.top/sys-mini/default/useNum.png"
                                    style="width: 22rpx;height: 19rpx;margin-bottom: 0;" mode="widthFix"></image>
                                <text style="color: #000000;">{{ numResult(item.usageCount) }}</text>
                            </view>
                            <view class="xin-title-hot" v-if="item.isHot == 1">
                                <image src="https://file.aizhs.top/sys-mini/default/hot.png"
                                    style="width: 37rpx;height: 37rpx;" mode="widthFix"></image>
                                <text>{{ numResult(item.usageCount) }}</text>
                            </view>
                            <image class="shoucang" @click.stop="getAgentCollect(item.botId)" v-if="item.isCollect == 0"
                                src="https://file.aizhs.top/sys-mini/default/shoucang.png" mode="widthFix"></image>
                            <image class="choucang_active" @click.stop="getAgentCollect(item.botId)" v-else
                                src="https://file.aizhs.top/sys-mini/default/choucang_active.png" mode="widthFix">
                            </image>
                            <text class="text_collect">{{ numResult(item.collectCount) }}</text> -->
                        </view>
                    </view>
                </view>
            </view>
            <!-- 没有更多了（不再为 tabbar 预留，仅保留适当间距） -->
            <view style="display: flex;justify-content: center;padding-top: 40rpx;"
                v-if="pageType == 'study' && studyList.length > 0">
                <view class="f_c" style="width: 100%;margin-top: 20rpx;">
                    <view class="line"></view>
                    <text class="no-more-text">没有更多了</text>
                    <view class="line"></view>
                </view>
            </view>
            <!-- 官网链接 -->
            <view v-if="pageType == 'study' && studyList.length > 0"
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
import { getVideoList } from '@/service/study.js'
import Loading from "@/components/loading/index.vue";

const props = defineProps({
    pageType: {
        type: String,
        default: 'index'
    },
    types: {
        type: String,
        default: ''
    },
    studyCategroys: {
        type: String,
        default: ''
    },
    studySearch: {
        type: String,
        default: ''
    },
    fromPage: {
        type: String,
        default: 'home'
    },
})

const emit = defineEmits(['videoClick', 'showMore'])

const barList = ref([
    { name: '入门课程', id: 0 },
    { name: '进阶课程', id: 1 },
    { name: '精通课程', id: 2 },
])
const studyList = ref([])
const loading = ref(false)
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const stage = ref(0)
const userInfo = ref({})

function getData() {
    loading.value = true
    let param = {
        pageNum: pageNum.value,
        pageSize: pageSize.value,
        types: props.types,
        categorys: props.studyCategroys,
        title: props.studySearch,
        stage: stage.value,
    }
    if (props.fromPage == 'edit') {
        param.creator = userInfo.value.uuid
    }
    getVideoList(param).then(res => {
        console.log('getVideoList', res)
        studyList.value = studyList.value.concat(res.data)
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
    console.log('scrolltolower', studyList.value, total.value)
    if (studyList.value.length < total.value) {
        pageNum.value++
        getData()
    }
}

function toDetail(item) {
    emit('videoClick', item)
}

function showMore() {
    emit('showMore')
}

watch(() => props.pageType, (n) => {
}, { immediate: true })

watch(() => props.types, () => {
    getData()
})

watch(() => props.studyCategroys, () => {
    getData()
})

watch(() => props.studySearch, () => {
    getData()
})

userInfo.value = uni.getStorageSync('data')

onMounted(() => {
    getData()
})
</script>
<style lang="scss" scoped>
.s_l_b {
    .icon_blink {
        width: 52rpx;
        height: 52rpx;
        margin-right: 12rpx;
    }

    .blink_text {
        font-family: Alimama FangYuanTi VF !important;
        font-size: 36rpx;
        font-weight: bold;
        color: rgba(0, 0, 0, 0.8);
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

.scroll_body {
    width: 100%;
    box-sizing: border-box;
    // padding: 0 8rpx;
}

.scroll_height {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
}

.study_item {
    width: calc(50vw - 32rpx);
    margin: 4rpx;
    box-sizing: border-box;
    position: relative;

    .video {
        width: 100%;
        height: 178rpx;
        border-radius: 15rpx;
        background-color: #000;
    }

    .video_info {
        position: absolute;
        top: 148rpx;
        left: 12rpx;
        width: 322rpx;
        overflow: hidden;

        .title {
            height: 26rpx;
            font-size: 18rpx;
            font-weight: bold;
            color: #FFFFFF;
            flex: 1;
            margin: 0;
        }

        .date {
            font-size: 18rpx;
            font-weight: bold;
            color: #FFFFFF;
            width: 100rpx;
        }
    }

    .title {
        font-family: Alimama FangYuanTi VF !important;
        font-size: 24rpx;
        font-weight: normal;
        color: #3D3D3D;
        margin: 8rpx 0;
    }

    .icon_logo {
        width: 25rpx;
        height: 25rpx;
        border-radius: 8rpx;
        margin-right: 4rpx;
    }

    .name {
        font-family: Alimama FangYuanTi VF !important;
        font-size: 18rpx;
        font-weight: bold;
        color: rgba(0, 0, 0, 0.6);
    }

    .shoucang {
        width: 39rpx;
        height: 39rpx;
        margin-top: 0;
        display: block;
        float: right;
        margin-top: -2rpx;
    }

    .choucang_active {
        width: 39rpx;
        height: 39rpx;
        margin-top: 0;
        display: block;
        float: right;
        margin-top: -2rpx;
    }

    .xin-title-hot {
        float: right;
        font-size: 18rpx;
        font-weight: bold;
        line-height: 33rpx;
        color: #FF5F33;
        margin-top: -8rpx;
        margin-left: 5rpx;
    }

    .xin-title-hot image {
        margin-bottom: -12rpx;
        margin-right: 6rpx;
    }

    .text_collect {
        display: block;
        color: #373737;
        font-weight: bold;
        font-size: 18rpx;
        float: right;
        height: 50rpx;
        line-height: 48rpx;
        padding: 0 10rpx;
        color: #6D81FF;
    }
}

.line {
    flex: 1;
    height: 1rpx;
    background-color: #e0e0e0;
}

.no-more-text {
    margin: 0 20rpx;
    color: #767676;
    font-size: 24rpx;
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
