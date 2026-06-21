<template>
    <view class="catalog">
        <Loading v-if="loading"></Loading>
        <swiper class="swiper" circular :duration="500" :previous-margin="mainSwiperMargin"
            :next-margin="mainSwiperMargin" @change="mainChange" :current="selectIndex">
            <swiper-item v-for="(item, index) in videoList" :key="index" @click="clickVideo(item, index)">
                <view class="s_item f_c" :class="{ 'selecte_Description': selectIndex == index }">
                    <view v-if="selectIndex == index" class="playing-animation">
                        <view class="bar bar1"></view>
                        <view class="bar bar2"></view>
                        <view class="bar bar3"></view>
                        <view class="bar bar4"></view>
                        <view class="bar bar5"></view>
                    </view>
                    <view class="s_i_t">{{ item.content || item.title || '' }}</view>
                </view>
            </swiper-item>
        </swiper>

        <scroll-view class="video_scroll" :scroll-top="0" scroll-y @scrolltolower="scrolltolower">
            <view class="video_list">
                <view class="f_n videos_body" v-for="(item, index) in videoList" :key="item.id"
                    @click="clickVideo(item, index)">
                    <image class="video" :src="item.binding" />
                    <view class="video_info f_b">
                        <VipBtns v-if="pay" :pay="pay" @showPay="showPay(item)"></VipBtns>
                        <view v-else></view>
                        <text class="date">{{ item.createdAt }}</text>
                    </view>
                    <view style="flex: 1;">
                        <view class="des_title">{{ item.title }}</view>
                        <view class="describe">{{ item.content }}</view>
                        <view class="f_n">
                        </view>
                    </view>
                </view>
            </view>
        </scroll-view>
    </view>
</template>
<script setup>
import { ref, watch } from 'vue'
import VipBtns from './vip_btns.vue'
import Loading from "@/components/loading/index.vue";

const props = defineProps({
    videoList: Array,
    pay: Object
})

const emit = defineEmits(['showPay', 'change', 'pageDown'])

const selectIndex = ref(0)
const loading = ref(false)
const mainSwiperMargin = ref('212rpx')

watch(() => props.videoList, (arr) => {
    clickVideo(arr[0], 0)
})

function showPay(obj) {
    emit('showPay', obj)
}

function mainChange(e) {
    console.log('mainChange', e)
}

function clickVideo(item, index) {
    selectIndex.value = index
    emit('change', item)
}

function scrolltolower() {
    emit('pageDown')
}
</script>
<style lang="scss" scoped>
.catalog {
    margin-top: 15rpx;

    .video_scroll {
        height: calc(100vh - 996rpx);
        padding-top: 14rpx;
    }

    .video_list {
        .videos_body {
            margin-bottom: 14rpx;
            position: relative;
        }

        .video {
            width: 264rpx;
            height: 136rpx;
            border-radius: 15rpx;
            margin-right: 8rpx;
            background-color: #000000;
        }

        .video_info {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 264rpx;

            .date {
                font-size: 18rpx;
                font-weight: bold;
                color: #FFFFFF;
            }
        }
        .des_title {
            font-family: AlimamaFangYuanTi;
            font-size: 30rpx;
            font-weight: bold;
            color: #000000;
            overflow: hidden;
            max-width: 100%;
            height: 30rpx;
        }

        .describe {
            margin: 8rpx 0;
            font-family: AlimamaFangYuanTi;
            max-height: 122rpx;
            display: -webkit-box;
            overflow: hidden;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 3;
            text-overflow: ellipsis;
            font-size: 26rpx;
            font-weight: normal;
            color: rgba(0, 0, 0, 0.6);
        }

        .types_item {
            width: 60rpx;
            height: 30rpx;
            border-radius: 15rpx;
            box-sizing: border-box;
            border: 1rpx solid rgba(0, 0, 0, 0.3);

            .text {
                font-family: Alimama FangYuanTi VF !important;
                font-size: 20rpx;
                font-weight: bold;
                letter-spacing: 0.02em;
                color: rgba(0, 0, 0, 0.6);
                margin-bottom: 1rpx;
            }
        }
    }

}

.swiper {
    width: calc(100vw - 48rpx);
    box-sizing: border-box;
    height: 84rpx;
}

.scroll_view {
    width: calc(100vw - 46rpx);
    box-sizing: border-box;
    height: 84rpx;
    margin-bottom: 14rpx;
    position: relative;
    z-index: 9999;
}

.scroll_by_view {
    width: calc(100vw - 46rpx);
    box-sizing: border-box;
    height: 74rpx;
    margin-bottom: 14rpx;
    overflow-x: auto;
    overflow-y: hidden;
    display: inline-flex;
}

.scroll_body {
    display: inline-flex;
}

.s_item {
    flex: none;
    width: 250rpx;
    height: 67rpx;
    border-radius: 15rpx;
    background: #F4F4F4;
    padding: 8rpx 9rpx;
    margin-right: 16rpx;
    font-family: Alimama FangYuanTi VF !important;
    font-size: 16rpx;
    font-weight: normal;
    color: #000000;
    white-space: normal;
}


.playing {
    width: 62rpx;
    height: 41rpx;
    border-radius: 15rpx;
    margin-right: 8rpx;
}

.playing-animation {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 62rpx;
    height: 41rpx;
    border-radius: 15rpx;
    margin-right: 8rpx;
    padding: 0 4rpx;
}

.bar {
    width: 6rpx;
    background-color: #515AFF;
    margin: 0 2rpx;
    border-radius: 100px;
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
    animation-duration: 1.2s;
    overflow: hidden;
}

.bar1 {
    height: 15rpx;
    animation-name: wave1;
}

.bar2 {
    height: 35rpx;
    animation-name: wave2;
    animation-delay: -0.2s;
}

.bar3 {
    height: 15rpx;
    animation-name: wave3;
    animation-delay: -0.4s;
}

.bar4 {
    height: 35rpx;
    animation-name: wave4;
    animation-delay: -0.6s;
}

.bar5 {
    height: 15rpx;
    animation-name: wave5;
    animation-delay: -0.8s;
}

@keyframes wave1 {

    0%,
    100% {
        height: 15rpx;
    }

    50% {
        height: 35rpx;
    }
}

@keyframes wave2 {

    0%,
    100% {
        height: 35rpx;
    }

    50% {
        height: 15rpx;
    }
}

@keyframes wave3 {

    0%,
    100% {
        height: 15rpx;
    }

    50% {
        height: 35rpx;
    }
}

@keyframes wave4 {

    0%,
    100% {
        height: 35rpx;
    }

    50% {
        height: 15rpx;
    }
}

@keyframes wave5 {

    0%,
    100% {
        height: 15rpx;
    }

    50% {
        height: 35rpx;
    }
}

.s_i_t {
    flex: 1;
    font-size: 20rpx !important;
    max-height: 102rpx;
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    text-overflow: ellipsis;
}

.selecte_Description {
    color: #515AFF !important;
}

.right_end {
    width: 89rpx;
    height: 67rpx;
    position: absolute;
    top: 0;
    right: 0;
    background: linear-gradient(90deg, rgba(244, 244, 244, 0.5) 0%, rgba(244, 244, 244, 0.97) 41%, #F4F4F4 100%);
    display: flex;
    align-items: center;
    flex-direction: column-reverse;
    padding-right: 13.35rpx;
}

.study_icon_right_end {
    width: 30.65rpx;
    height: 30rpx;
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
</style>
