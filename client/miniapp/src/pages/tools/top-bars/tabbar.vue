<template>
    <view class="tabbar">
        <view class="tabbar_item" v-for="(item, index) in dataList" :key="index" @click="handleTabClick(item, index)">
            <view v-if="item.name == 'day7'" class="day7">
                <picker mode="date" header-text="" :value="closeingTime" @change="datechange" indchange="datechange">
                    <image class="date7" src="/static/images/date7.png" alt="day7" />
                </picker>
            </view>
            <view v-else class="bar-text" :class="selectedIndex == index ? 'select_color-text' : 'nomal_color-text'">
                {{ item.name }}
            </view>

            <view v-if="line" class="bar-border"
                :class="selectedIndex == index ? 'select_color-border' : 'nomal_color-border'">
            </view>
        </view>
    </view>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import { nowDate } from '@/utils/time.js'

const props = defineProps({
    dataList: {
        type: Array,
        default: () => []
    },
    line: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['dateChange', 'handleTabClick'])

const selectedIndex = ref(0)
const closeingTime = ref('2025-8-21')

onMounted(() => {
    closeingTime.value = nowDate()
})

function datechange(e) {
    closeingTime.value = e.detail.value
    emit('dateChange', closeingTime.value)
}

function handleTabClick(item, index) {
    selectedIndex.value = index
    emit('handleTabClick', item)
}
</script>
<style
    lang="scss"
    scoped
>
.tabbar {
    display: flex;
    align-items: center;
    justify-content: space-around;
    width: 100%;
    height: 100%;

    .tabbar_item {
        display: flex;
        align-items: center;
        flex-direction: column;

        .bar-text {
            color: #000;
        }

        .bar-border {
            width: 100%;
            height: 4rpx;
        }
    }
}

.select_color-text {
    color: #847CFF !important;
}

.nomal_color-text {
    color: #000 !important;
}

.select_color-border {
    background-color: #847CFF !important;
}

.nomal_color-border {
    background-color: none !important;
}

.day7 {
    width: 41rpx;
    height: 36rpx;
    overflow: hidden;

    .date7 {
        width: 41rpx;
        height: 36rpx;

    }
}
</style>
