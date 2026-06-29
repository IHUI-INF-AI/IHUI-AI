<template>
    <view>
        <TopBar color="#EBEEF5;" :dataList="barList"></TopBar>
        <scroll-view class="scroll_body" scroll-y scroll-x="false" lower-threshold="50">
            <view class="cash_item" v-for="(item, index) in dataList" :key="index">
                <view class="content">
                    <image class="cash_image" src="https://file.aizhs.top/sys-mini/xtk/cash.png" mode="widthFix" />
                    <view class="center">
                        <view class="title">提现</view>
                        <view class="time" v-if="item.query_time">提现时间：{{ formatFullTimeFn(item.query_time) }}</view>
                        <view class="time" v-if="item.reviewer_time">处理时间：{{ formatFullTimeFn(item.reviewer_time) }}
                        </view>
                        <view class="time" v-if="item.payment_time">到账时间：{{ formatFullTimeFn(item.payment_time) }}</view>
                    </view>
                    <view style="padding-top: auto;">
                        <view class="status">
                            <text :style="{ color: statusColor[item.status] }">{{ statusVal[item.status] }}</text>
                        </view>
                        <view class="money" v-if="item.amount">
                            <text>+</text>
                            <text>{{ (item.amount / 100).toFixed(2) }}</text>
                        </view>
                    </view>
                </view>
                <view class="line"></view>
            </view>
        </scroll-view>
    </view>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import TopBar from '@/pages/tools/top-bars/index'
import { getMxList } from '@/service/aiModels.js'
import { formatFullTime } from '@/utils/time.js'

const props = defineProps({
    userInfo: {
        type: Object,
        default: () => {
            return {}
        }
    }
})

const barList = ref([
    { text: '7天' },
    { text: '一个月' },
    { text: '近一年' },
    { text: '全部' },
])

const dataList = ref([
    { time: '2025 07-25 08:26', num: '200' },
    { time: '2025 07-25 08:26', num: '200' },
    { time: '2025 07-25 08:26', num: '200' },
    { time: '2025 07-25 08:26', num: '200' },
    { time: '2025 07-25 08:26', num: '200' },
])

const statusVal = {
    '0': '审核中',
    '1': '已处理',
    '2': '已到账',
    '3': '失败',
    '4': '未通过',
}

const statusColor = {
    '0': '#517BFF',
    '1': '#000000',
    '2': '#07C160',
    '3': '#000000',
    '4': '#FF0000',
}

const type = ref(1)
const page = ref({
    page: 1,
    page_size: 10
})

const formatFullTimeFn = (num) => {
    return formatFullTime(num)
}

const fetchMxList = () => {
    let params = {
        type: type.value,
        user_id: props.userInfo.uuid,
        page: page.value.page,
        page_size: 10
    }
    getMxList(params).then(res => {
        dataList.value = res.data
    })
}

onMounted(() => {
    fetchMxList()
})
</script>
<style lang="scss" scoped>
.scroll_body {
    width: calc(100vw - 100rpx);
    height: calc(100vh - 170rpx);
    padding: 34rpx;
}

.cash_item {
    margin-top: 36rpx;
    display: flex;
    flex-direction: column;
    align-items: center;


    .content {
        display: flex;
        width: 100%;

        .cash_image {
            width: 86rpx;
            height: 86rpx;
        }

        .center {
            flex: 1;

            .title {
                font-family: AlimamaFangYuanTi !important;
                font-size: 30rpx;
                font-weight: normal;
                color: #000;
            }

            .time {
                font-family: AlimamaFangYuanTi !important;
                font-size: 20rpx;
                font-weight: normal;
                color: #979797;
            }
        }

        .status {
            font-family: AlimamaFangYuanTi !important;
            font-size: 24rpx;
            font-weight: 500;
        }

        .money {
            display: flex;
            font-family: AlimamaFangYuanTi !important;
            font-size: 30rpx;
            font-weight: 500;
            color: #000;
        }
    }

    .line {
        width: calc(100vw - 102rpx);
    }
}
</style>