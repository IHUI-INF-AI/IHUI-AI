<template>
    <view class="advert_body">
        <Loading v-if="loading"></Loading>
        <image class="go_back" @click="goBack" src="https://file.aizhs.top/sys-mini/default/back.svg" mode="widthFix" />
        <view class="advert_body-footer">
            <view class="btn" @click.stop="toPath">
                <!-- <text v-if="!developer">一键开通</text>
                <text v-else>{{ time }}秒后自动跳转</text> -->
                <text>一键开通</text>
            </view>
        </view>
        <view class="advert_body-case">
            <view class="dev_pay_btn" :class="{ 'selected': devPayType == 'month' }"
                @click="() => { devPayType = 'month' }">
                <view class="dev_pay_text">开发者包月</view>
                <view class="dev_pay_footer">
                    <image class="dev_pay_icon" src="https://file.aizhs.top/sys-mini/xtk/dev_pay_icon.png"
                        mode="widthFix" />
                    <view class="dev_pay_count">{{ price.month || 100 }} / 月</view>
                </view>
            </view>
            <view class="dev_pay_btn" :class="{ 'selected': devPayType == 'year' }"
                @click="() => { devPayType = 'year' }">
                <view class="dev_pay_text">开发者包年</view>
                <view class="dev_pay_footer">
                    <image class="dev_pay_icon" src="https://file.aizhs.top/sys-mini/xtk/dev_pay_icon.png"
                        mode="widthFix" />
                    <view class="dev_pay_count">{{ price.year || 1000 }} / 年</view>
                </view>
            </view>
        </view>
        <view class="advert_body-text">请选择所需要的服务</view>
    </view>
</template>
<script setup>
import { ref, onMounted } from 'vue'
import { pay } from "@/utils/pay/index.js"
import Loading from "@/components/loading/index.vue"
import { getDevInfo } from '@/service/aiModels.js'

const props = defineProps({
    userInfo: {
        type: Object
    }
})

const emit = defineEmits(['go'])

const timer = ref(null)
const time = ref(5)
const devPayType = ref('year')
const free = ref(true)
const loading = ref(false)
const developer = ref(false)
const price = ref({
    month: '',
    year: '',
})
const real_price = ref({
    month: 0,
    year: 0
})
const ids = ref({
    month: '',
    year: ''
})

onMounted(() => {
    getDevInfo().then(res => {
        res.data.forEach(item => {
            if (item.remark == '月费开发者') {
                price.value.month = (item.amount / 100).toFixed(0)
                real_price.value.month = item.amount
                ids.value.month = item.id
            }
            if (item.remark == '年费开发者') {
                price.value.year = (item.amount / 100).toFixed(0)
                real_price.value.year = item.amount
                ids.value.year = item.id
            }
        })
    })
})

const repath = () => {
    timer.value = setInterval(() => {
        if (time.value > 0) {
            time.value -= 1
        } else {
            toPath()
        }
    }, 1000)
}

const toPath = () => {
    if (devPayType.value == 'month') {
        pay("", real_price.value.month, ids.value.month, 1, 3).then(res => {
            if (res) {
                emit('go')
            }
        })
    } else {
        pay("", real_price.value.year, ids.value.year, 1, 3).then(res => {
            if (res) {
                emit('go')
            }
        })
    }
}

const goBack = () => {
    emit('go')
}
</script>
<style lang="scss" scoped>
.advert_body {
    width: 100vw;
    height: 100vh;
    background-image: url('https://file.aizhs.top/sys-mini/xtk/enter_page.png');
    background-size: 100% 100%;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column-reverse;
    background-color: #FFFFFF;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;

    .advert_body-text {
        font-family: "AlimamaFangYuanTi" !important;
        font-size: 30rpx;
        font-weight: bold;
        letter-spacing: 0.14em;
        text-align: center;
        color: #7B61FF;
        position: absolute;
        left: 46rpx;
        bottom: 279rpx;
        text-align: start;
        // padding-left: 46rpx;
        // margin-bottom: -28rpx;
    }

    .advert_body-case {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 54rpx;
        margin-bottom: 18rpx;

        .dev_pay_btn {
            width: calc(50vw - 78rpx);
            height: calc(25vw - 39rpx);
            box-sizing: border-box;
            border-radius: 15rpx;
            // background: rgba(255, 255, 255, 0);
            // border: 2px solid;
            // border-image: linear-gradient(45deg, #B878F1 0%, rgba(44, 118, 208, 0.6507) 53%, #F012DA 99%) 2;
            background-image: url('https://file.aizhs.top/sys-mini/xtk/dev_pay_border_image.png');
            background-size: 100% 100%;
            box-shadow: 0px 0px 0px 0px #FFFFFF;
            padding: 12rpx;
            display: flex;
            flex-direction: column;
            justify-content: space-between;

            .dev_pay_text {
                font-family: "AlimamaFangYuanTi" !important;
                font-size: 30rpx;
                font-weight: 600;
                color: #FFFFFF;
            }

            .dev_pay_footer {
                display: flex;
                justify-content: space-between;
                align-items: flex-end;

                .dev_pay_icon {
                    width: 62rpx;
                    height: 62rpx;
                }

                .dev_pay_count {
                    font-family: "AlimamaFangYuanTi" !important;
                    font-size: 36rpx;
                    font-weight: bold;
                    color: #FFFFFF;
                }
            }
        }
    }

    .advert_body-image1 {
        width: 300rpx;
        height: 144rpx;
        position: absolute;
        left: 55rpx;
        bottom: 128rpx;
    }

    .advert_body-image2 {
        width: 363rpx;
        height: 144rpx;
        position: absolute;
        right: 25rpx;
        bottom: 98rpx;
    }

    .advert_body-footer {
        // height: 120rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20rpx;

        .btn {
            width: 280rpx;
            height: 80rpx;
            border-radius: 15rpx;
            background: #FFFFFF;
            font-family: "AlimamaFangYuanTi" !important;
            font-size: 46rpx;
            font-weight: 500;
            letter-spacing: 0.28em;
            color: #000000;
            padding: 0 18rpx;
        }
    }

    .go_back {
        position: absolute;
        top: 50rpx;
        left: 36rpx;
        width: 32rpx;
        height: 23rpx;
    }
}

.selected {
    background-image: linear-gradient(180deg, #B772F4 0%, rgba(111, 83, 253, 0) 100%) !important;
    border: 2rpx solid;
    border-radius: 15rpx;
    // border-image: linear-gradient(65deg, #B878F1 0%, rgba(44, 118, 208, 0.6507) 57%, #F012DA 99%) 2 !important;
    box-shadow: 0rpx 0rpx 20rpx 0rpx #8D83FF !important;
}
</style>