<template>
    <scroll-view class="select_row" scroll-x scroll-y="false">
        <view class="scroll_body f_n" v-if="type == 'arr'">
            <view class="s_item f_c" :class="{ 'selected': selectList.includes(item) }" v-for="(item, index) in tabList"
                :key="index" @click="changeIndex(item, index)">
                <text>{{ item.name || '' }}</text>
            </view>
        </view>
        <view class="scroll_body f_n" v-if="type == 'str'">
            <view class="s_item f_c" :class="{ 'selected': selectIndex == index }" v-for="(item, index) in tabList"
                :key="index" @click="changeIndex(item, index)">
                <text>{{ item.name || '' }}</text>
            </view>
        </view>
    </scroll-view>
</template>
<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
    tabList: {
        type: Array,
        default: () => {
            return []
        }
    },
    type: {
        type: String,
        default: 'arr'
    }
})

const emit = defineEmits(['change'])

const selectList = ref([])
const selectIndex = ref(0)

watch(() => props.tabList, (n) => {
    if (n && n.length > 0) {
        changeIndex(n[0], 0)
    }
})

function changeIndex(item, index) {
    if (props.type == 'str') {
        selectIndex.value = index
        emit('change', item)
    } else {
        const res = selectList.value.find(val => {
            return val == item
        })
        if (res) {
            for (let i = 0, len = selectList.value.length; i < len; i++) {
                if (selectList.value[i] == item) {
                    selectList.value.splice(i, 1)
                    break;
                }
            }
        } else {
            selectList.value.push(item)
        }
        emit('change', selectList.value)
    }
}
</script>
<style lang="scss" scoped>
.select_row {
    width: 100%;
    height: 46rpx;

    .scroll_body {
        box-sizing: border-box;
    }

    .s_item {
        height: 44rpx;
        border-radius: 8rpx;
        background: rgb(0 0 0 / 0.05);
        font-size: 26rpx;
        font-weight: normal;
        color: rgb(0 0 0 / 0.3);
        margin-right: 18rpx;
        white-space: nowrap;
        padding: 4rpx 12rpx;
    }
}

.selected {
    background: linear-gradient(112deg, rgb(205 208 255 / 0.6) 3%, rgb(253 255 225 / 0.6) 104%) !important;
    box-shadow: 0rpx 0rpx 2rpx 0rpx rgb(0 0 0 / 0.3);
    font-weight: bold !important;
    color: #564DFF !important;
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
