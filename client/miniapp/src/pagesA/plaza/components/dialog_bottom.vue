<template>
    <view class="w_b">
        <view class="title_body m_b16">
            <image class="Welcome" src="https://file.aizhs.top/sys-mini/xtk/Welcome.png" mode="widthFix"
                lazy-load="false"></image>
            <image class="iHuiInfAI" src="https://file.aizhs.top/sys-mini/xtk/iHuiInfAI.png" mode="widthFix"
                lazy-load="false"></image>
        </view>
        <image class="header_card-logo m_b8"
            :src="userInfo.avatar ? userInfo.avatar : 'https://file.aizhs.top/sys-mini/xtk/devlogo.png'"
            mode="aspectFill" />
        <view class="user_name m_b8">{{ userInfo.nickname }}</view>
        <view class="logo_text m_b8">30万AI开发者聚集地,好技术.好项目</view>
        <view class="btn_body m_b8">
            <view class="card_left card_body" @click="toSet">
                <view class="flex_center icon">
                    <image class="left_icon" src="https://file.aizhs.top/sys-mini/xtk/plaza_win_left.png"
                        mode="widthFix" />
                </view>
                <view class="left_text flex_center">
                    <text>找大佬开发</text>
                </view>
            </view>
            <image class="image_or" src="https://file.aizhs.top/sys-mini/xtk/image_or.png" mode="widthFix" />
            <view class="card_right card_body" @click="toDev">
                <view class="flex_center icon">
                    <image class="right_icon" src="https://file.aizhs.top/sys-mini/xtk/plaza_win_right.png"
                        mode="widthFix" />
                </view>
                <view class="right_text flex_center">我是开发者</view>
            </view>
        </view>
        <view class="bottom_text" @click="showDeveloperNotice">开发者须知</view>
        
        <!-- 开发者须知弹窗 -->
        <view v-if="showNoticeModal" class="notice-modal" @click="hideDeveloperNotice">
            <view class="notice-content" @click.stop>
                <view class="notice-header">
                    <text class="notice-title">开发者须知</text>
                    <view class="close-btn" @click="hideDeveloperNotice">×</view>
                </view>
                <view class="notice-body">
                    <view class="notice-section">
                        <text class="section-title">1. 开发者责任</text>
                        <text class="section-content">开发者应当确保所提供的技术服务符合相关法律法规，不得提供违法违规的技术支持。</text>
                    </view>
                    <view class="notice-section">
                        <text class="section-title">2. 知识产权</text>
                        <text class="section-content">开发者应当尊重知识产权，不得侵犯他人的专利权、著作权、商标权等合法权益。</text>
                    </view>
                    <view class="notice-section">
                        <text class="section-title">3. 交易规范</text>
                        <text class="section-content">开发者与需求方的交易应当遵循公平、公正、诚信的原则，确保交易过程的透明化。</text>
                    </view>
                    <view class="notice-section">
                        <text class="section-title">4. 隐私保护</text>
                        <text class="section-content">开发者应当严格保护用户隐私，不得泄露、出售或非法使用用户个人信息。</text>
                    </view>
                    <view class="notice-section">
                        <text class="section-title">5. 技术标准</text>
                        <text class="section-content">开发者应当提供符合行业标准的技术服务，确保技术方案的可行性和可靠性。</text>
                    </view>
                </view>
                <view class="notice-footer">
                    <view class="confirm-btn" @click="hideDeveloperNotice">我已阅读并同意</view>
                </view>
            </view>
        </view>
    </view>
</template>
<script setup>
import { ref, onMounted } from 'vue'

const emit = defineEmits(['toSet', 'toDev'])

const userInfo = ref({})
const showNoticeModal = ref(false)

onMounted(() => {
    userInfo.value = uni.getStorageSync("data")
})

const toSet = () => {
    emit('toSet')
}

const toDev = () => {
    emit('toDev')
}

const showDeveloperNotice = () => {
    showNoticeModal.value = true
}

const hideDeveloperNotice = () => {
    showNoticeModal.value = false
}
</script>
<style lang="scss" scoped>
.w_b {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1003;
    height: 565rpx;
    border-radius: 69rpx 69rpx 0px 0px;
    background: rgba(255, 255, 250, 1);
    // background: rgba($color: #F0F1FA, $alpha: 1.0);
    box-sizing: border-box;
    padding: 10rpx 24rpx 0 24rpx;
    display: flex;
    flex-direction: column;
    align-items: center;

    .title_body {
        display: flex;
        align-items: flex-end;
        box-sizing: border-box;
        padding-top: 24rpx;
    }

    .header_card-logo {
        width: 150rpx;
        height: 150rpx;
        margin-bottom: 16rpx;
        border-radius: 100%;
        flex: none;
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
    }

    .btn_body {
        display: flex;
        box-sizing: border-box;
        width: 100%;
        justify-content: space-between;
        align-items: center;

        .card_body {
            width: 288rpx;
            height: 140rpx;
            border-radius: 15rpx;
            padding-top: 8rpx;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
        }

        .card_left {
            background: linear-gradient(116deg, rgba(217, 219, 255, 0.8) 3%, rgba(253, 255, 220, 0.8) 104%);
            box-shadow: 0rpx 0rpx 6rpx 0rpx rgba(0, 0, 0, 0.3);

            .left_icon {
                width: 66rpx;
                height: 66rpx;
            }

            .left_text {
                font-family: "AlimamaFangYuanTi" !important;
                font-size: 40rpx;
                font-weight: 600;
                letter-spacing: 0.28em;
                color: #000000;
            }
        }

        .image_or {
            width: 92rpx;
            height: 40rpx;
        }

        .card_right {
            background: linear-gradient(116deg, rgba(0, 0, 0, 0.8) 3%, rgba(0, 109, 11, 0.8) 104%);
            box-shadow: 0rpx 0rpx 6rpx 0rpx rgba(0, 0, 0, 0.3);

            .right_icon {
                width: 73rpx;
                height: 64rpx;
            }

            .right_text {
                font-family: "AlimamaFangYuanTi" !important;
                font-size: 40rpx;
                font-weight: 500;
                letter-spacing: 0.28em;
                color: #FFFFFF;
            }
        }

        .icon {
            width: 100%;
        }
    }

    .bottom_text {
        font-family: Silkscreen;
        font-size: 20rpx;
        font-weight: normal;
        color: rgba(0, 0, 0, 0.4);
        cursor: pointer;
    }
    
    // 开发者须知弹窗样式
    .notice-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 1004;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40rpx;
        box-sizing: border-box;
    }

    .notice-content {
        background-color: #fff;
        border-radius: 20rpx;
        width: 100%;
        max-width: 600rpx;
        max-height: 80vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .notice-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 30rpx;
        border-bottom: 1px solid #f0f0f0;
    }

    .notice-title {
        font-size: 32rpx;
        font-weight: bold;
        color: #333;
    }

    .close-btn {
        font-size: 40rpx;
        color: #999;
        width: 60rpx;
        height: 60rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    }

    .notice-body {
        padding: 30rpx;
        flex: 1;
        overflow-y: auto;
    }

    .notice-section {
        margin-bottom: 30rpx;
    }

    .section-title {
        font-size: 28rpx;
        font-weight: bold;
        color: #333;
        display: block;
        margin-bottom: 10rpx;
    }

    .section-content {
        font-size: 26rpx;
        color: #666;
        line-height: 1.6;
        display: block;
    }

    .notice-footer {
        padding: 20rpx 30rpx 30rpx;
        border-top: 1px solid #f0f0f0;
    }

    .confirm-btn {
        background-color: #000;
        color: #fff;
        text-align: center;
        padding: 20rpx;
        border-radius: 10rpx;
        font-size: 28rpx;
        cursor: pointer;
    }
}

.m_b16 {
    margin-bottom: 16rpx;
}

.m_b8 {
    margin-bottom: 8rpx;
}

.flex_center {
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>