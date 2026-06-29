<template>
    <scroll-view class="scroll_body" scroll-x scroll-y="false" lower-threshold="50">
        <view class="plaza_tab fenlei_btn_list">
            <view class="tab_item flex_center fenlei_btn" v-for="(item) in options" :key="item.id"
                :class="{ 'active': selectId == item.id }" @click="select(item)">
                <image class="icon fenlei_icon" :src="item.butUrl" v-if="selectId == item.id && item.butUrl" />
                <image class="icon fenlei_icon" :src="item.field1" v-if="selectId != item.id && item.field1" />
                <text>{{ item.name }}</text>
            </view>
        </view>
    </scroll-view>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
    options: {
        type: Array,
        required: true
    },
    value: String
})

const emit = defineEmits(['change'])

const selectVal = ref({})
const selectId = ref('')

watch(selectVal, (n) => {
    if (n.id) {
        selectId.value = n.id
    }
}, { immediate: true })

watch(() => props.value, (n) => {
    if (n) {
        selectId.value = n
        selectVal.value = props.options.find(item => {
            return item.id == n
        })
        emit('change', selectVal.value)
    }
}, { immediate: true })

function select(item) {
    selectVal.value = item
    emit('change', selectVal.value)
}
</script>

<style lang="scss" scoped>
.scroll_body {
    width: 100%;
}

.plaza_tab {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    width: 100%;
    padding: 18rpx 0 18rpx 10rpx;

    .tab_item {
        height: 44rpx;
        padding: 12rpx 6rpx;
        border-radius: 8rpx;
        font-family: AlimamaFangYuanTi !important;

        // font-size: 26rpx;
        font-weight: bold;
        color: rgb(0 0 0 / 0.3);
        box-sizing: border-box;
        margin-right: 16rpx;
        white-space: nowrap;
    }

    .icon {
        width: 46rpx;
        height: 46rpx;
        margin-right: 4rpx;
    }
}

.flex_center {
    display: flex;
    align-items: center;
    justify-content: center;
}

.selected {
    border-radius: 8rpx;
    background: linear-gradient(112deg, rgb(205 208 255 / 0.6) 3%, rgb(253 255 225 / 0.6) 104%);
    box-shadow: 0rpx 0rpx 2rpx 0rpx rgb(0 0 0 / 0.3);
    color: rgb(0 0 0 / 1) !important;
}

.fenlei_btn_list {
    display: flex;
    flex-wrap: nowrap;
    width: calc(100% - 20rpx);
    padding: 10rpx 20rpx;
    padding-top: 0;
    margin: 0 20rpx 0 0;
    overflow-x: auto;
    box-sizing: border-box;

    .fenlei_btn {
        flex: none;
        color: rgb(0 0 0 / 0.6);
        margin-right: 6rpx;
        height: 44rpx;
        padding: 0 8rpx;
        line-height: 44rpx;
        border-radius: 8rpx;
        border: 1px solid #fff;

        &.active {
            color: #000;
            backdrop-filter: blur(10px);
            font-weight: bold;
            background: rgb(248 249 252 / 0.65) !important;
            border: 1px solid #e0e8ff !important;
            box-shadow: 0 1px 3px rgb(0 0 0 / 0.06) !important;
        }

        &:last-child {
            margin-right: 0;
        }

        .fenlei_icon {
            display: block;
            float: left;
            width: 44rpx;
            height: 44rpx;
            margin-right: 10rpx;
        }
    }
}
</style>
