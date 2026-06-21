<template>
    <view class="outContainer">
        <navigation-bars color="black" :viscosity="true" :title="title" @pack="backPage" :showBack="false"
            style="width: 100%;" :image="'https://file.aizhs.top/sys-mini/default/back.svg'" />
        <Loading v-if="loading"></Loading>
        <cashDetail v-if="title == '提现明细'" :userInfo="userInfo"></cashDetail>
        <view class="card-bg" v-if="title == '智能体收入'">
            <view class="card-body">

                <view class="flex_nomal" style="margin-bottom: 13rpx;">
                    <view class="font_nomal" style="flex: 1;">
                        累积收入<text class="font_title" style="color: #7B61FF;">{{ buyInfo.AccumulatedIncome }}</text>元
                    </view>
                    <image class="card_top-image" src="https://file.aizhs.top/sys-mini/xtk/model_income_btn_bg.png"
                        mode="widthFix" />
                    <view class="income_text font_title" @click="showIncome">提现</view>
                </view>
                <view class="line"></view>
                <view class="flex_nomal" style="margin-top: 18rpx;">
                    <view style="margin-right: 18rpx;">
                        <view class="font_nomal">可提现金额（元）</view>
                        <view class="font_title">{{ buyInfo.WithdrawableAmount }}</view>
                    </view>
                    <view style="flex: 1;">
                        <view class="font_nomal">已提现金额（元）</view>
                        <view class="font_title">{{ buyInfo.WithdrawnAmount }}</view>
                    </view>
                    <view @click="pathtocashdetail">
                        <image class="card_center-image"
                            src="https://file.aizhs.top/sys-mini/xtk/model_income_right.png" mode="widthFix" />
                        <view class="income_detail font_nomal">提现明细</view>
                    </view>
                </view>
                <view class="flex_nomal card_bottom font_nomal">
                    <view style="margin-right: 36rpx;">
                        <view>今日收入</view>
                        <view>{{ buyInfo.todayAccount }}</view>
                    </view>
                    <view>
                        <view>待结算金额</view>
                        <view>{{ buyInfo.PendingSettlement }}</view>
                    </view>
                </view>
            </view>
        </view>
        <view class="text_line" v-if="title == '智能体收入'">
            <image class="model_income_icon_form" src="https://file.aizhs.top/sys-mini/xtk/model_income_icon_form.png"
                mode="widthFix" />
            <text>平台限时不收取任何服务费</text>
        </view>
        
        <view class="models_bar" v-if="title == '智能体收入'">
            <view class="models_bar-item flex_center" :class="settlement == item.name ? 'models_bar-text' : ''"
                v-for="(item, index) in headTypes" :key="index" @click="changeFb(item)">
                <text>{{ item.name }}</text>
            </view>
            <!-- <image class="bar_search" src="https://file.aizhs.top/sys-mini/xtk/search.svg" alt="搜索" /> -->
        </view>
        <scroll-view class="scroll_body" scroll-y scroll-x="false" lower-threshold="50" @scrolltolower="scrolltolower">
            <payCard :datas="item" v-for="(item, index) in dataList" :key="index" />
        </scroll-view>
        <!-- 底部弹窗 -->
        <view class="popup_mask" v-if="income" @click="() => { income = false }"></view>
        <view class="popup_body" v-if="income">
            <view class="head">
                <image class="wallet" src="https://file.aizhs.top/sys-mini/xtk/wx_wallet.png" />
                <view class="font_hold" style="flex: 1;">请选择提现方式</view>
                <view class="sub_info">更多提现方式可使用官方APP</view>
            </view>
            <view class="content">
                <view style="display: flex;align-items: center;">
                    <image class="wx_icon" src="https://file.aizhs.top/sys-mini/xtk/wx_icon.png" />
                    <text class="font_hold">微信</text>
                </view>
                <image class="wx_btn" v-if="incomeType == 'wx'"
                    src="https://file.aizhs.top/sys-mini/xtk/wx_btn_yes.png" />
                <image class="wx_btn" v-else src="https://file.aizhs.top/sys-mini/xtk/wx_btn_no.png" />
            </view>
            <view class="footer flex_center">
                <view class="sub_btn flex_center">
                    <text class="font_hold">提现</text>
                </view>
            </view>
        </view>
    </view>
</template>
<script setup>
import { ref, watch, onMounted } from 'vue'
import NavigationBars from "@/components/navigation-bars/index.vue";
import Loading from "@/components/loading/index.vue";
import cashDetail from './components/cash_detail.vue'
import payCard from './components/pay_card.vue'
import { getBuyInfo, getBuyList } from '@/service/aiModels.js'

const title = ref('智能体收入')
const headTypes = ref([
    { id: '', name: '全部' },
    { id: '1', name: '待结算' },
    { id: '2', name: '已结算' }
])
const settlement = ref('全部')
const income = ref(false)
const incomeType = ref('wx')
const dataList = ref([])
const page = ref({ page: 1, page_size: 10 })
const loading = ref(false)
const userInfo = ref({})
const buyInfo = ref({})

watch(settlement, (n) => {
    if (n) {
        fetchBuyList()
    }
})

onMounted(() => {
    userInfo.value = uni.getStorageSync("data");
    getBuyInfo({ uuid: userInfo.value.uuid }).then(res => {
        buyInfo.value = res.data
    })
    fetchBuyList()
})

function fetchBuyList() {
    loading.value = true
    let settlementType = ''
    if (settlement.value == '待结算') {
        settlementType = '1'
    } else if (settlement.value == '已结算') {
        settlementType = '2'
    } else {
        settlementType = ''
    }
    let params = {
        page: page.value.page,
        page_size: 10,
        settlement: settlementType,
        uuid: userInfo.value.uuid
    }
    getBuyList(params).then(res => {
        if (res.success) {
            dataList.value = res.data
        }
    }).finally(() => {
        loading.value = false
    })
}

function pathtocashdetail() {
    title.value = '提现明细'
}

function changeFb(item) {
    settlement.value = item.name
}

function scrolltolower() {
    page.value.page += 1
    fetchBuyList()
}

function showIncome() {
    income.value = true
}

function backPage() {
    if (title.value == '提现明细') {
        title.value = '智能体收入'
        return
    }
    const pages = getCurrentPages();
    if (pages.length > 1) {
        uni.navigateBack({ delta: 1 });
    } else {
        uni.switchTab({ url: '/pages/table/tools/index' });
    }
}
</script>
<style lang="scss" scoped>
.outContainer {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: hidden;
}

.models_bar {
    width: calc(100% - 40rpx);
    margin: 0 20rpx;
    padding: 8rpx;
    box-sizing: border-box;
    background: #EBEEF5;
    border: 1px solid rgba(255, 255, 255, 0);
    border-radius: 15rpx;
    display: flex;
    align-items: center;
    justify-content: space-around;

    .models_bar-item {
        box-sizing: border-box;
        width: 150rpx;
        height: 56rpx;
        border-radius: 15rpx;
        color: #3D3D3D;
        font-weight: normal;
        font-size: 30rpx;
        font-family: AlibabaPuHuiTi;
        font-variation-settings: "BEVL" 100, "opsz" auto;
        font-feature-settings: "kern" on;
        padding: auto;
    }

    .models_bar-text {
        background-color: #FFFFFF !important;
        border-color: 1rpx solid rgba(0, 0, 0, 0.1);
        color: #3D3D3D !important;
        font-weight: bold !important;
    }

    .bar_search {
        width: 48rpx;
        height: 48rpx;
        margin-left: 10rpx;
        margin-bottom: 6rpx;
    }
}

.text_line {
    margin: 10rpx 0;
    display: flex;
    align-items: center;
    width: 100%;
    margin-left: 60rpx;
    box-sizing: border-box;
    font-family: "AlimamaFangYuanTi" !important;
    font-size: 20rpx;
    color: #3D3D3D;
}

.card-bg {
    width: calc(100vw - 36rpx);
    background-image: linear-gradient(307deg,
            rgba(209, 158, 255, 0.7) -2%,
            rgba(209, 158, 255, 0.7) -2%,
            rgba(209, 158, 255, 0.7) -2%,
            rgba(211, 161, 223, 0.6389) 32%,
            rgba(206, 151, 251, 0.6925) 41%,
            rgba(255, 242, 0, 0.21) 88%);
    border-width: 0 !important;
    height: 307rpx;
    border-radius: 20rpx;
    box-sizing: border-box;
    padding: 1rpx;
    overflow: hidden;

    .card-body {
        width: 100%;
        height: 100%;
        margin: none;
        border-radius: 20rpx;
        border-width: 0;
        box-sizing: border-box;
        padding: 24rpx 18rpx;
        background-color: #fff;
        position: relative;
        display: flex;
        align-items: center;
        flex-direction: column;

        .line {
            height: 1rpx;
            width: calc(100vw - 76rpx);
            background-color: #D8D8D8;
        }

        .card_top-image {
            width: 96rpx;
            height: 45rpx;
        }

        .income_text {
            position: absolute;
            top: 32rpx;
            right: 40rpx;
            font-size: 27rpx;
            font-weight: 500;
        }

        .card_center-image {
            width: 19rpx;
            height: 32rpx;
            margin-left: 48rpx;
        }

        .income_detail {
            color: #979797 !important;
            border-bottom: 2rpx solid #979797;
            ;
        }

        .card_bottom {
            box-sizing: border-box;
            margin-top: 22rpx;
            border-radius: 8rpx;
            background: rgba(235, 238, 245, 0.59);
            width: 100%;
            height: 100rpx;
            padding: 8rpx 21rpx;
        }
    }
}

.model_income_icon_form {
    width: 35rpx;
    height: 31rpx;
    margin-right: 6rpx;
}

.scroll_body {
    height: calc(100vh - 620rpx);
    padding: 0 18rpx;
    width: calc(100vw - 36rpx);
}

.popup_mask {
    position: fixed;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
}

.popup_body {
    box-sizing: border-box;
    border: 1rpx solid #DADADA;
    position: fixed;
    bottom: 0;
    left: 0;
    box-sizing: border-box;
    width: 100%;
    border-radius: 30rpx 30rpx 0 0;
    padding: 30rpx;
    background-color: #FFFFFF;

    .head {
        display: flex;
        border-bottom: 1rpx solid rgba(77, 77, 77, 0.26);

        .wallet {
            width: 44rpx;
            height: 39rpx;
            margin-right: 24rpx;
        }

        .sub_info {
            font-family: "AlimamaFangYuanTi" !important;
            font-size: 20rpx;
            font-weight: normal;
            color: rgba(0, 0, 0, 0.4);
        }
    }

    .content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-top: 20rpx;

        .wx_icon {
            width: 60rpx;
            height: 60rpx;
            margin-right: 17rpx;
        }

        .wx_btn {
            width: 50rpx;
            height: 50rpx;
        }
    }

    .footer {
        padding: 12rpx 0;
        box-sizing: border-box;

        .sub_btn {
            width: 129rpx;
            height: 60rpx;
            border-radius: 8rpx;
            background: #E4E7ED;
            box-sizing: border-box;
        }
    }

}

.flex_center {
    display: flex;
    align-items: center;
    justify-content: center;
}

.flex_nomal {
    display: flex;
    align-items: center;
    width: 100%;
}

.font_nomal {
    font-family: "AlimamaFangYuanTi" !important;
    font-size: 24rpx;
    font-weight: normal;
    color: #3D3D3D;
}

.font_title {
    font-family: "AlimamaFangYuanTi" !important;
    font-size: 36rpx;
    font-weight: bold;
    color: #000000;
}

.font_hold {
    font-family: "AlimamaFangYuanTi" !important;
    font-size: 30rpx;
    font-weight: 500;
    color: #333400;
}

.margin_bottom {
    margin-bottom: 18rpx;
}
</style>