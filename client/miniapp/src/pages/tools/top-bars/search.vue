<template>
    <view class="outer">
        <view class="no_search" :style="{ height: 0 }" v-if="!searching">
            <view class="show_config flex_center" @click="handleConfigClick" v-if="leftbtn">
                <image src="/static/images/config_btn.png" />
            </view>
            <view class="content">
                <tabbar v-if="hasbar" :dataList="tabbarList" :line="line" class="tabbar" @handleTabClick="handleTabClick" @dateChange="dateChange"></tabbar>
            </view>
            <!-- <view class="search_part" @click.stop="() => { searching = true; modelname = ''; }">
                <view class="text" v-if="type == 'change'">
                    请搜索
                </view>
                <image class="bar_search" src="/static/images/search.svg" alt="搜索" />
            </view> -->
        </view>

        <view class="searching" :style="{ height: height }" v-if="searching">
            <view class="input_outer">
                <input class="search_input" type="text" v-model="modelname" :key="modelname" placeholder="请输入查找的AI员工"
                    maxlength="60" @input="onInput" />
            </view>
            <view class="cancel flex_center" @click.stop="() => { searching = false; modelname = ''; }">
                <view>取消</view>
            </view>
        </view>
    </view>
</template>
<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import tabbar from './tabbar.vue'

const props = defineProps({
    // search: {
    //     type: Boolean,
    //     default: false
    // },
    type: {
        type: String,
        default: 'nomal',
        validator: (val) => {
            return ['nomal', 'change'].includes(val)
        }
    },
    leftbtn: {  // 左侧
        type: Boolean,
        default: false
    },
    hasbar: {
        type: Boolean,
        default: false
    },
    tabbarList: {
        type: Array,
        default: () => {
            return []
        }
    },
    line: {
        type: Boolean,
        default: false
    },
    height: {
        type: String,
        default: '92rpx'
    }
})

const emit = defineEmits(['filterSearch', 'searchingChange', 'handleConfigClick', 'searchTabClick', 'dateChange'])

const searching = ref(false)
const modelname = ref('')
const timer = ref(null)

onBeforeUnmount(() => {
    clearTimeout(timer.value)
})

watch(
    modelname,
    (n) => {
        if (n) {
            timer.value = setTimeout(() => {
                emit('filterSearch', n)
            }, 500)
        }
    }
)

watch(
    searching,
    (newVal) => {
        emit('searchingChange', newVal)
    },
    { immediate: true }
)

function onclick() {
    searching.value = !searching.value
}

function onInput(e) {
    let val = e.detail.value
    modelname.value = val
}

// 侧边栏按钮
function handleConfigClick() {
    emit('handleConfigClick')
}

// tabbar 点击
function handleTabClick(item) {
    emit('searchTabClick', item)
}

// tabbar 中日期点击
function dateChange(val) {
    emit('dateChange', val)
}
</script>
<style lang="scss" scoped>
.no_search {
    flex: 1;
    padding: 12rpx;
    display: flex;
    align-items: center;
    // justify-content: center;

    .show_config {
        width: 48rpx;
        height: 48rpx;
        background-color: #EBEEF5;
        border-radius: 50%;

        image {
            width: 25rpx;
            height: 22rpx;
        }
    }

    .content {
        flex: 1;
        display: flex;
        align-items: center;

        .tabbar {
            margin-left: 20rpx;
            margin-right: 20rpx;
            width: 100%;
            height: 100%;
        }
    }

    .search_part {
        display: flex;
        align-items: center;
        color: #666666;
    }

    .bar_search {
        width: 48rpx;
        height: 48rpx;
        margin-left: 10rpx;
        margin-bottom: 6rpx;
    }
}

.searching {
    flex: 1;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: "AlimamaFangYuanTi" !important;

    .input_outer {
        flex: 1;
        display: flex;
        align-items: center;
        border-radius: 30rpx;
        box-shadow: 0px 0 6px 0px rgba(0, 0, 0, 0.3);
        // border: 2px solid rgba(0, 195, 255, 0);
        background-color: rgba(0, 195, 255, 0);
        overflow: hidden;
        padding: 2rpx;
        height: 74rpx;

        .search_input {
            // outline: none;
            font-size: 32rpx;
            // font-family: "VT323", monospace;
            color: #5a5a5a;
            letter-spacing: 2rpx;
            font-weight: bold;
            padding: 12rpx 28rpx;
            background-color: #fff;
            font-family: "AlimamaFangYuanTi" !important;
        }
    }

    .cancel {
        width: 106rpx;
        color: #000;
        font-size: 40rpx;
        font-weight: bold;
        text-transform: uppercase;
        text-align: right;
    }
}

.flex_center {
    display: flex;
    align-items: center;
    justify-content: center;
}

.outer {
    box-sizing: border-box;
    font-family: "AlimamaFangYuanTi" !important;
    font-variation-settings: "BEVL" 100, "opsz" auto;
    font-feature-settings: "kern" on;
    display: flex;
}
</style>
