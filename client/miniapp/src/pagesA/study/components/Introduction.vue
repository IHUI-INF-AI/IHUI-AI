<template>
    <view class="Introduction">
        <view class="text">{{ content }}</view>
        <view class="ai_list">
            <view class="ai_item" v-for="(item) in aiList" :key="item.id" @click="toAiList(item)">
                <text class="ai_text">{{ item.name }}</text>
            </view>
        </view>
    </view>
</template>
<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
    videoList: Array,
    content: String,
    agentMap: Object,
})

const aiList = ref([])

watch(() => props.agentMap, (n) => {
    console.log('agentMap', n)
    let list = []
    if (n) {
        for (let key in n) {
            list.push({
                id: key,
                name: n[key]
            })
        }
    }
    aiList.value = list
}, { immediate: true })

function toAiList(obj) {
    uni.switchTab({
        url: `/pages/table/tools/index`,
        success: (success) => {
            uni.$emit('courseToAiList', obj.id)
        },
    })
}
</script>
<style lang="scss" scoped>
.ai_list {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-wrap: wrap;

    .ai_item {
        height: 30rpx;
        border-radius: 15rpx;
        box-sizing: border-box;
        border: 1rpx solid rgb(0 0 0 / 0.3);
        padding: 4rpx 12rpx;
        margin-right: auto;
        margin-bottom: 8rpx;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .ai_text {
        font-size: 24rpx;
        font-weight: normal;
        color: #768DFF;
    }
}

.Introduction {
    width: 100%;
    box-sizing: border-box;
    margin-top: 18rpx;
    padding-top: 30rpx;
    border-top: 1px solid rgb(0 0 0 / 0.1);

    .text {
        font-family: "Alimama FangYuanTi VF" !important;
        font-size: 30rpx;
        font-weight: normal;
        color: #757575;
        margin-bottom: 16rpx;
    }

    .images {
        display: grid;
        grid-template-columns: auto auto auto auto;
        gap: 8rpx;
    }

    .image {
        width: 168rpx;
        height: 225rpx;
        border-radius: 10rpx;
    }
}
</style>
