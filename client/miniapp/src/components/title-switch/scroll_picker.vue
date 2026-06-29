<template>
    <view class="picker_bg">
        <view class="mask_body">
            <view class="s_top" @click="scrolltoupper"></view>
            <scroll-view class="scroll_body" :scroll-x="false" :scroll-y="true" @scroll="scrolling"
                @scrolltoupper="scrolltoupper" @scrolltolower="scrolltolower">
                <view class="scroll_content"></view>
            </scroll-view>
            <view class="s_bottom" @click="scrolltolower"></view>
        </view>

        <!-- <view class="s_top" @click.capture="prev"></view>
        <view class="s_bottom" @click.capture="prov"></view> -->

        <picker-view :value="itemIndex" @change="bindchange" class="picker_view" indicator-class="indicator"
            :immediate-change="true">
            <!-- style="width: 750rpx;height: 600rpx;margin-top: 20rpx;" -->
            <picker-view-column style="position: relative;padding-left: 4rpx;">
                <view class="item" :class="{
                    'active_item': itemIndex[0] == index,
                    'active_before': itemIndex[0] == (index + 1),
                    'active_after': itemIndex[0] == (index - 1),
                    'active_before2': itemIndex[0] == (index + 2),
                    'active_after2': itemIndex[0] == (index - 2),
                }" v-for="(item, index) in mainList" :key="index">
                    <!-- style="line-height: 100rpx;text-align: center;color: #000;font-size: 24rpx;" -->
                    <text>{{ item.name }}</text>
                </view>
            </picker-view-column>
        </picker-view>
    </view>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
    mainList: {
        type: Array,
        default: () => [
            { name: '赛道一' },
            { name: '赛道二' },
            { name: '赛道三' },
            { name: '赛道四' },
            { name: '赛道五' },
            { name: '赛道六' },
            { name: '赛道7' },
            { name: '赛道8' },
            { name: '赛道9' },
            { name: '赛道10' },
            { name: '赛道11' },
            { name: '赛道12' },
        ]
    },
})

const itemIndex = ref([0])

function scrolling(e) {
}

function scrolltoupper() {
    if (itemIndex.value[0] > 0) {
        itemIndex.value[0]--
        itemIndex.value = [...itemIndex.value]
    }
}

function scrolltolower() {
    if (itemIndex.value[0] < props.mainList.length - 1) {
        itemIndex.value[0]++
        itemIndex.value = [...itemIndex.value]
    }
}

function bindchange(e) {
    // const index = e.detail.value[0]
    // itemIndex.value[0] = index
    // emit('change', index)
    // itemIndex.value = [...itemIndex.value]
}
</script>

<style lang="scss" scoped>
.picker_bg {
    position: relative;
}

.mask_body {
    height: 140rpx;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 9995;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;

    .s_top {
        width: 100%;
        height: 20rpx;
    }

    .s_bottom {
        width: 100%;
        height: 20rpx;
    }

    .scroll_body {
        width: 300rpx;
        height: 100rpx;
    }

    .scroll_content {
        width: 300rpx;

        // height: 960rpx;
        height: 200rpx;
    }
}



::v-deep .picker_view {
    width: 210rpx;
    height: 140rpx;
    padding: 0 auto;
}

::v-deep .item {
    width: 200rpx;
    height: 80rpx;
    text-align: center;
    color: #666;
    border-radius: 15rpx;

    /* 基础样式 */
    background: rgb(255 255 255 / 0.3);
    box-sizing: border-box;

    // border: 1rpx solid;
    // border-image: radial-gradient(25% 50% at 50% 100%, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%) 1;
    // backdrop-filter: blur(20rpx);
    box-shadow: 1rpx 0rpx 9rpx 1rpx rgb(0 0 0 / 0.5);

    /* 过渡动画 */
    transition: all 0.5s ease;

    /* 缩放效果 - 非选中项缩小 */
    transform: scale(0.6);
    font-family: AlimamaFangYuanTi !important;
    font-size: 30rpx;
    font-weight: bold;
    letter-spacing: 0.08em;
    opacity: 0.3;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 4rpx;
}

::v-deep .active_before {
    /* transform: translateY(16rpx) scale(1) rotateX(-45deg); */
    transform: translateY(40rpx) scale(0.8);
    opacity: 0.8;
    z-index: -1;
}

::v-deep .active_after {
    /* transform: translateY(-14rpx) scale(1) rotateX(45deg); */
    transform: translateY(-38rpx) scale(0.8);
    opacity: 0.8;
    z-index: -10;
    position: relative;
}

::v-deep .active_before2 {
    transform: translateY(90rpx) scale(0.6);
    opacity: 0.8;
    z-index: -1;
}

::v-deep .active_after2 {
    transform: translateY(-90rpx) scale(0.6);
    opacity: 0.8;
    z-index: -100;
    position: relative;
}

::v-deep .active_item {
    color: rgb(0 0 0 / 1);
    font-weight: 600;
    background-color: rgb(255 255 255 / 0.9);

    // box-shadow: 0rpx 0rpx 0rpx 10rpx rgba(0, 0, 0, 0.3) !important;

    /* 选中项放大并置于顶层 */
    transform: scale(1);
    opacity: 1;
    z-index: 10;

    // border: 1rpx solid;
    // border-image: radial-gradient(25% 50% at 50% 100%, #666 0%, rgba(255, 255, 255, 0) 100%) 1;
}

.indicator {
    /* height: 24rpx;
    border-top: 1rpx solid rgba(255, 255, 255, 0.5);
    border-bottom: 1rpx solid rgba(255, 255, 255, 0.5);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.6) 100%);
    border-radius: 20rpx; */
}

::v-deep .indicator::after {
    border-bottom: 2rpx solid #FFF;
}

::v-deep .indicator::before {
    border-top: 2rpx solid #FFF;
}
</style>
