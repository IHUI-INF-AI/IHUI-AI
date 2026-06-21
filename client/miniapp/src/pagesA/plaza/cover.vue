<template>
    <view class="cover_popup">
        <view class="cover_mask" @click="goBack"></view>
        <view class="cover_content">
            <Loading v-if="loading"></Loading>
            <view class="cover_header">
                <view class="title_body m_b16">
                    <image class="Welcome" src="https://file.aizhs.top/sys-mini/xtk/Welcome.png" mode="widthFix"
                        lazy-load="false"></image>
                    <image class="iHuiInfAI" src="https://file.aizhs.top/sys-mini/xtk/iHuiInfAI.png" mode="widthFix"
                        lazy-load="false"></image>
                </view>
                <image class="close_btn" @click="goBack" src="https://file.aizhs.top/sys-mini/default/back.svg" mode="widthFix" />
            </view>
            <image class="header_card-logo m_b8"
                :src="userInfo.avatar ? userInfo.avatar : 'https://file.aizhs.top/sys-mini/xtk/devlogo.png'"
                mode="aspectFill" />
            <view class="user_name m_b8"> | {{ userInfo.nickname }}</view>
            <view class="logo_text m_b8">请选择所需要的服务</view>
            <view class="advert_body-case">
                <view class="dev_pay_btn" :class="{ 'selected': devPayType == 'month' }"
                    @click="() => { devPayType = 'month' }">
                    <view class="dev_pay_text">开发者包月</view>
                    <view class="dev_pay_footer">
                        <image class="dev_pay_icon" src="https://file.aizhs.top/sys-mini/xtk/my_model.png"
                            mode="widthFix" />
                        <view class="dev_pay_count">{{ price.month || 100 }} / 月</view>
                    </view>
                </view>
                <view class="dev_pay_btn" :class="{ 'selected': devPayType == 'year' }"
                    @click="() => { devPayType = 'year' }">
                    <view class="dev_pay_text">开发者包年</view>
                    <view class="dev_pay_footer">
                        <image class="dev_pay_icon" src="https://file.aizhs.top/sys-mini/xtk/my_model.png"
                            mode="widthFix" />
                        <view class="dev_pay_count">{{ price.year || 1000 }} / 年</view>
                    </view>
                </view>
            </view>
            <view class="advert_body-footer">
                <view class="btn" @click.stop="toPath">
                    <text>一键开通</text>
                </view>
            </view>
            <view class="bottom_text">开发者须知</view>
        </view>
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
.cover_popup {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 9999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}

.cover_mask {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 1;
}

.cover_content {
    position: relative;
    z-index: 2;
    width: 100%;
    max-height: 80vh;
    border-radius: 69rpx 69rpx 0px 0px;
    background: rgba(255, 255, 250, 0.95);
    box-sizing: border-box;
    padding: 24rpx 24rpx 30rpx 24rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-y: auto;
    animation: slideUp 0.3s ease-out;

    .cover_header {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16rpx;

        .title_body {
            display: flex;
            align-items: flex-end;
            box-sizing: border-box;
            padding-top: 24rpx;
        }

        .Welcome {
            width: 410rpx;
            height: 67rpx;
            margin-right: 15rpx;
        }

        .iHuiInfAI {
            width: 281rpx;
            height: 40rpx;
        }

        .close_btn {
            width: 32rpx;
            height: 23rpx;
            margin-top: 24rpx;
        }
    }

    .header_card-logo {
        width: 150rpx;
        height: 150rpx;
        margin-bottom: 16rpx;
        border-radius: 100%;
        flex: none;
    }

    .user_name {
        font-family: "AlimamaFangYuanTi" !important;
        font-size: 30rpx;
        font-weight: bold;
        color: #000000;
    }

    .logo_text {
        font-family: "AlimamaFangYuanTi" !important;
        font-size: 30rpx;
        font-weight: bold;
        letter-spacing: 0.29em;
        color: #8F81FF;
        text-align: center;
    }

    .advert_body-case {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        padding: 0 0rpx;
        margin-bottom: 18rpx;
        box-sizing: border-box;

        .dev_pay_btn {
            width: calc(50vw - 76rpx);
            height: 144rpx;
            box-sizing: border-box;
            border-radius: 15rpx;
            border: 2rpx solid #000000;
            background: #FFFFFF;
            padding: 12rpx;
            display: flex;
            flex-direction: column;
            justify-content: space-between;

            .dev_pay_text {
                font-family: "AlimamaFangYuanTi" !important;
                font-size: 30rpx;
                font-weight: 600;
                color: #000000;
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
                    color: #000000;
                }
            }
        }
    }

    .advert_body-footer {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20rpx;
        width: 100%;

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
            display: flex;
            align-items: center;
            justify-content: center;
        }
    }

    .bottom_text {
        font-family: Silkscreen;
        font-size: 20rpx;
        font-weight: normal;
        color: rgba(0, 0, 0, 0.4);
    }
}

@keyframes slideUp {
    from {
        transform: translateY(100%);
    }
    to {
        transform: translateY(0);
    }
}

.selected {
    border: 2rpx solid #8D83FF !important;
    background: #FFFFFF !important;
    
    .dev_pay_text {
        color: #000000 !important;
    }
    
    .dev_pay_count {
        color: #000000 !important;
    }
}

.m_b16 {
    margin-bottom: 16rpx;
}

.m_b8 {
    margin-bottom: 8rpx;
}
</style>