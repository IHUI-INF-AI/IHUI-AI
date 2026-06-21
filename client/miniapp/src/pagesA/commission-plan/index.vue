<template>
    <view class="settings-page">
        <SettingsPageLayout title="分佣计划">
            <view class="content-inner">
                <view class="card-wrap">
                    <view class="card-title">分佣规则说明</view>
                    <view class="card-paragraph">本计划旨在鼓励用户通过分享邀请好友加入平台，获得相应的佣金奖励。用户分享专属邀请链接或二维码，被邀请人成功注册并完成首次有效消费后，邀请人即可获得相应比例的佣金。</view>
                </view>

                <view class="card-wrap">
                    <view class="card-title">佣金比例</view>
                    <view class="card-paragraph">一级邀请（直接邀请）：被邀请人首次消费金额的 10% 作为佣金奖励。</view>
                    <view class="card-paragraph">二级邀请（间接邀请）：被邀请人再邀请的好友首次消费金额的 5% 作为佣金奖励。</view>
                    <view class="card-paragraph">佣金比例可能根据平台运营策略调整，调整后将提前 7 天通过 APP 内通知告知用户。</view>
                </view>

                <view class="card-wrap">
                    <view class="card-title">结算方式</view>
                    <view class="card-paragraph">佣金实时计算，累计至用户账户余额中。</view>
                    <view class="card-paragraph">用户可在「我的 - 钱包」中查看佣金明细和余额。</view>
                    <view class="card-paragraph">余额满 10 元即可申请提现，提现将按原支付路径返还，预计 1-3 个工作日到账。</view>
                    <view class="card-paragraph">若发现刷单、虚假交易等违规行为，平台有权追回佣金并冻结相关账号。</view>
                </view>
            </view>
        </SettingsPageLayout>
    </view>
</template>

<script setup>
import SettingsPageLayout from '@/pagesA/settings/common/SettingsPageLayout.vue'
</script>

<style lang="scss" scoped>
.settings-page {
    min-height: 100vh;
    background-color: #f5f5f5;
}

.content-inner {
    padding: 24rpx 24rpx 48rpx;
}

.card-wrap {
    background: #fff;
    border-radius: 16rpx;
    overflow: hidden;
    padding: 32rpx 24rpx;
    box-sizing: border-box;
    margin-bottom: 24rpx;
}

.card-title {
    font-size: 30rpx;
    font-weight: 600;
    color: #333;
    margin-bottom: 16rpx;
}

.card-paragraph {
    font-size: 26rpx;
    color: #666;
    line-height: 1.75;
    text-align: justify;
    margin-bottom: 12rpx;

    &:last-child {
        margin-bottom: 0;
    }
}
</style>
