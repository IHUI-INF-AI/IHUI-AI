<template>
    <view class="outer">
        <view class="content">
            <view class="cot_item" :style="{ backgroundColor: index === selectIndex ? color : '#fff' }"
                v-for="(item, index) in dataList" :key="index" @click="change(item, index)">
                <view class="center_line" v-if="index != 0 && index != (selectIndex + 1)"></view>
                <view class="content_item">{{ item.text }}</view>
            </view>
        </view>
        <image v-if="search" class="bar_search" src="/static/images/search.svg" />
    </view>
</template>
<script setup>
import { ref } from 'vue'

const props = defineProps({
    dataList: {
        type: Array,
        default: () => []
    },
    search: {
        type: Boolean,
        default: false
    },
    color: {
        type: String,
        default: '#B0AEFA'
    }
})

const emit = defineEmits(['change'])

const selectIndex = ref(0)

function change(item, index) {
    selectIndex.value = index
    emit('change', item)
}
</script>
<style lang="scss" scoped>
.outer {
    width: 100%;
    height: 160rpx;
    box-sizing: border-box;
    padding: 30rpx;
    display: flex;
    align-items: center;
    justify-content: center;

    .content {
        // margin: 30rpx 60rpx;
        border-radius: 30rpx;
        display: flex;
        width: calc(100vw - 120rpx);
        flex: 1;
        justify-content: space-around;
        align-items: center;
        overflow: hidden;
        box-sizing: border-box;
        border: 1px solid #B0AEFA;

        .cot_item {
            width: 100%;
            height: 75rpx;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-family: AlimamaFangYuanTi;
            font-size: 16px;
            font-weight: hold;
            letter-spacing: 0;
            font-variation-settings: "BEVL" 100, "opsz" auto;
            font-feature-settings: "kern" on;
            color: #3D3D3D;
            background-color: #fff;
            box-sizing: border-box;
        }

        .content_item {
            flex: 1;
            text-align: center;
        }

        .center_line {
            width: 2rpx;
            height: 50rpx;
            background-color: #B0AEFA;
        }

    }

    .bar_search {
        width: 48rpx;
        height: 48rpx;
        margin-left: 10rpx;
        margin-bottom: 6rpx;
    }
}
</style>
