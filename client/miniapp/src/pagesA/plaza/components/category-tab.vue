<template>
    <scroll-view class="scroll_body" scroll-x scroll-y="false" lower-threshold="50">
        <view class="plaza_tab fenlei_btn_list">
            <view v-if="showAll" class="tab_item flex_center fenlei_btn" :class="{ 'selected active': all }"
                @click="selectAllTab">
                <image class="icon fenlei_icon" v-if="all"
                    src="https://file.aizhs.top/sys-backs/2025/08/16/sqb_20250816161049A277.png" />
                <image class="icon fenlei_icon" v-else
                    src="https://file.aizhs.top/sys-backs/2025/08/16/qqb_20250816161046A276.png" />
                <text>全部</text>
            </view>

            <view class="tab_item flex_center fenlei_btn" v-for="(item, index) in tabList" :key="item.id"
                :class="{ 'selected active': tabValue.includes(item) }" @click="select(item)">
                <image class="icon fenlei_icon" :src="item.butUrl" v-if="tabValue.includes(item)" />
                <image class="icon fenlei_icon" :src="item.field1" v-else />
                <text>{{ item.name }}</text>
            </view>
            <view v-if="customize" class="tab_item flex_center fenlei_btn" :class="{ 'selected active': addType }"
                @click="() => { addType = true }">
                <image class="icon fenlei_icon"
                    src="https://file.aizhs.top/sys-backs/2025/08/16/szdy_20250816161421A290.png" />
                <text>自定义</text>
            </view>
            <view class="mask" v-if="addType" @click="() => { addType = false }"></view>
            <view class="add_type" v-if="addType">
                <view class="title">请设置自定义种类</view>
                <input class="input" v-model="value" type="text" maxlength="4" placeholder="请输入种类">
                <view class="btn selected" @click="add">
                    <text>确定</text>
                </view>
            </view>
        </view>
    </scroll-view>
</template>
<script setup>
import { ref, watch, onMounted } from 'vue'
import { category } from '@/service/aiModels.js'

const props = defineProps({
    showAll: {
        type: Boolean,
        default: false
    },
    paddingLeft: {
        type: String,
        default: '0'
    },
    customize: {
        type: Boolean,
        default: false
    }
})

const emit = defineEmits(['change'])

const tabList = ref([])
const tabValue = ref([])
const all = ref(true)
const addType = ref(false)
const value = ref('')

watch(() => tabValue.value.length, (n) => {
    if (n > 0 && props.showAll) {
        all.value = false
    }
    if (n == 0) {
        all.value = true
    }
    emit('change', tabValue.value)
})

onMounted(() => {
    category('0').then(res => {
        tabList.value = res.data
    })
})

const add = () => {
    if (value.value) {
        const item = {
            id: value.value,
            name: value.value,
            type: 'type',
            field1: 'https://file.aizhs.top/sys-backs/2025/08/16/qzdy_20250816161419A289.png',
            butUrl: 'https://file.aizhs.top/sys-backs/2025/08/16/szdy_20250816161421A290.png'
        }
        tabList.value.unshift(item)
        select(item)
    }
    addType.value = false
}

const select = (item) => {
    const index = tabValue.value.indexOf(item)

    if (index >= 0) {
        tabValue.value.splice(index, 1)
    } else {
        tabValue.value.push(item)
    }
}

const selectAllTab = () => {
    all.value = !all.value
    if (all.value) {
        tabValue.value = []
    }
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

.mask {
    position: fixed;
    inset: 0;
    z-index: 990;
    background-color: rgb(0 0 0 / 0.3);
}

.add_type {
    position: fixed;
    inset: 0;
    margin: auto;
    z-index: 996;
    width: 427rpx;
    height: 303rpx;
    border-radius: 20rpx;
    background: #FFF;
    box-sizing: border-box;
    border: 1rpx solid #DADADA;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .title {
        font-family: AlimamaFangYuanTi !important;
        font-size: 24rpx;
        font-weight: bold;
        color: #3D3D3D;
        margin-bottom: 50rpx;
    }

    .input {
        width: 321rpx !important;
        height: 49rpx !important;
        border: 1rpx solid #979797;
        border-radius: 8rpx;
        margin-bottom: 50rpx;
        font-family: AlimamaFangYuanTi !important;
        font-size: 20rpx;
        font-weight: normal;
        color: #979797;
        padding: 0 12rpx;
    }

    .btn {
        width: 100rpx;
        height: 48rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: AlimamaFangYuanTi !important;
        font-size: 24rpx;
        font-weight: bold;
        color: rgb(0 0 0 / 0.9);
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
        padding: 0 8rpx 0 3rpx;
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