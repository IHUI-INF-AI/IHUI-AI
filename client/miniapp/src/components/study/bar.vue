<template>
    <view class="head_bar">
        <view class="color_bg">
            <view class="color_cont">
                <view class="bar_item f_c" v-for="(item, index) in barList" :key="index" @click="selectBar(item, index)"
                    :class="{ 'select': selectIndex == index }">
                    <text>{{ item.name }}</text>
                </view>
            </view>
        </view>
    </view>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
    barList: {
        type: Array,
        default: () => {
            return []
        }
    }
})

const emit = defineEmits(['change'])

const selectIndex = ref(0)

function selectBar(item, index) {
    selectIndex.value = index
    emit('change', item)
}
</script>

<style lang="scss" scoped>
.head_bar {
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 18rpx;
}

.color_bg {
    background: none !important;
    padding: 2rpx;
    border-radius: 15rpx;
    overflow: hidden;
    width: 100%;

    .color_cont {
        width: 100%;
        background-color: #eee;
        background-size: 100% 100%;
        background-repeat: no-repeat;
        border-radius: 16rpx;
        height: auto;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4rpx 0;
        border: 1px solid #eaeaea;
    }
}

.bar_item {
    // width: calc(33% - 8rpx);
    flex: 1;
    margin: 0 6rpx;
    height: 52rpx;
    border-radius: 15rpx;
    color: #d8d8d8;
    font-family: AlimamaFangYuanTi !important;
    font-size: 36rpx;
    font-weight: normal;
}

.select {
    color: #3D3D3D !important;
    background: #FFF;
    font-weight: bold !important;
}

.f_c {
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
