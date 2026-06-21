<template>
    <view class="ai-card" style="border-radius: 25rpx" @click="toDetail()">
        <view class="card-box" :class="idx < 3 ? 'import_card-border' : 'nomarl_card-border'">
            <view class="xin-card-content" :class="idx < 3 ? 'import_card-bg' : 'nomarl_card-bg'">
                <view class="card_body">
                    <view class="card-zuo">
                        <image v-if="idx == 0" src="https://file.aizhs.top/sys-mini/default/rankone.png" mode="widthFix"
                            class="top_icon" />
                        <image v-if="idx == 1" src="https://file.aizhs.top/sys-mini/default/ranktwo.png" mode="widthFix"
                            class="top_icon" />
                        <image v-if="idx == 2" src="https://file.aizhs.top/sys-mini/default/rankthree.png"
                            mode="widthFix" class="top_icon" />

                        <view style="width: 100%;">
                            <view class="card-you-box1" style="float: left;position: relative;">
                                <!-- <view v-if="item.type == 6" class="vip_label">
                                    <image src="https://file.aizhs.top/sys-mini/default/vip_label.png" mode="heightFix"
                                        class="label_icon" />
                                    <text class="label_title">会员免费</text>
                                </view>
                                <view v-if="item.type == 1" class="vip_label">
                                    <image style="" src="https://file.aizhs.top/sys-mini/default/mian_label.png"
                                        mode="heightFix" class="label_icon" />
                                    <text class="label_title" style="color: #80BEFF;">免费使用</text>
                                </view>
                                <view v-if="item.type == 2" class="vip_label">
                                    <image style="" src="https://file.aizhs.top/sys-mini/default/xian_label.png"
                                        mode="heightFix" class="label_icon" />
                                    <text class="label_title" style="color: #FF8A8A;">限时免费</text>
                                </view>
                                <view v-if="item.type == 3 || item.type == 5" class="vip_label">
                                    <image style="" src="https://file.aizhs.top/sys-mini/default/yue_label.png"
                                        mode="heightFix" class="label_icon" />
                                    <text class="label_title" style="color: #FF1818;overflow: auto;">{{
                                        (item.accountType && item.accountType.account && item.accountType.type) ?
                                            (item.accountType.account / 100).toFixed(2) + '/' + item.accountType.type : ''
                                    }}</text>
                                </view>
                                <view v-if="item.type == 4" class="vip_label" style="background-color: #5E56FF;">
                                    <image src="https://file.aizhs.top/sys-mini/default/yibuy_label.png"
                                        mode="heightFix" class="label_icon" />
                                    <text class="label_title" style="color: #FFFFFF;">已购买</text>
                                </view> -->

                                <image class="robot-img floating-decoration" mode="" :src="item.binding"></image>
                            </view>
                            <view class="xin-left">
                                <view class="xin-title">
                                    <text class="max_title"
                                        :style="{ 'color': idx < 3 ? '#517bff' : '#000', 'maxWidth': idx < 3 ? item.isNew == 1 ? 'calc(100% - 56rpx - 57rpx)' : 'calc(100% - 57rpx)' : item.isNew == 1 ? 'calc(100% - 56rpx)' : '100%' }"
                                        style="float: left;line-height: 50rpx;font-size: 38rpx;">{{ item.title || ''
                                        }}</text>
                                    <text class="xin-title-new" v-if="item.isNew == 1"> </text>
                                </view>
                            </view>
                            <view class="tab_list">
                                <view class="tab_item" v-for="(value, indextab) in item.typeList" :key="indextab">{{
                                    value.name }}</view>
                            </view>
                            <view class="subtitle" style="color: rgba(0, 0, 0, 0.6);">{{ item.content || item.title || '' }}</view>
                        </view>
                    </view>
                    <view
                        style="display: flex; justify-content: space-between; align-items: flex-end;padding-bottom: 5rpx;margin-top: -10rpx;padding-right: 5rpx;">
                        <view class="profile">
                            <image class="xin-avatar"
                                :src="item.avatar ? item.avatar : 'https://file.aizhs.top/sys-mini/default/logo/guanlogo.png'"></image>
                            <span class="xin-name">{{ item.nickname ? item.nickname : '智汇社区-官方' }}</span>
                            <view class="xin-title-hot" v-if="item.isHot == 0" style="margin-top: 0;">
                                <image src="https://file.aizhs.top/sys-mini/default/useNum.png"
                                    style="width: 22rpx;height: 19rpx;margin-bottom: 0;" mode="widthFix" />
                                <text style="color: #000000;">{{ numResult(item.usageCount) }}</text>
                            </view>
                            <view class="xin-title-hot" v-if="item.isHot == 1">
                                <image src="https://file.aizhs.top/sys-mini/default/hot.png"
                                    style="width: 44rpx;height: 44rpx;" mode="widthFix" />
                                <text>{{ numResult(item.usageCount) }}</text>
                            </view>
                        </view>
                        <!-- <view class="" style="margin-bottom: 0;">
                            <view style="float: right;position: relative;margin-top: 4rpx;">
                                <button @click.stop="" open-type="share"
                                    style="opacity: 0;position: absolute;z-index: 1;width: 36rpx;height: 36rpx;">分享</button>
                                <image @click.stop="intelliShow(item.prologue)"
                                    src="https://file.aizhs.top/sys-mini/default/new_share.png"
                                    style="width: 36rpx;height: 36rpx;display: block;" alt="" />
                            </view>
                            <text
                                style="display: block;color: #373737;font-size: 24rpx;float: right;height:44rpx;line-height:44rpx;padding: 0 10rpx;">{{
                                    numResult(item.collectCount) }}</text>
                            <image @click.stop="getAgentCollect(item.botId)" v-if="item.isCollect == 0"
                                src="https://file.aizhs.top/sys-mini/default/shoucang.png"
                                style="width: 44rpx;height: 44rpx;margin-top: 0;display: block;float: right;margin-top: -2rpx;"
                                mode="widthFix"></image>
                            <image @click.stop="getAgentCollect(item.botId)" v-else
                                src="https://file.aizhs.top/sys-mini/default/choucang_active.png"
                                style="width: 44rpx;height: 44rpx;margin-top: 0;display: block;float: right;margin-top: -2rpx;"
                                mode="widthFix"></image>
                            <image v-if="item.isThumbs == 0" @click.stop="getAgentLike(item.botId)"
                                src="https://file.aizhs.top/sys-mini/default/like.png"
                                style="width: 44rpx;height: 44rpx;margin-bottom: -14rpx;" mode="widthFix"></image>
                            <image v-else @click.stop="getAgentLike(item.botId)"
                                src="https://file.aizhs.top/sys-mini/default/like_active.png"
                                style="width: 44rpx;height: 44rpx;margin-bottom: -14rpx;" mode="widthFix"></image>
                            <text style="display: inline-block;color: #373737;font-size: 24rpx;padding: 0 10rpx;">{{
                                numResult(item.likeCount) }}</text>
                        </view> -->
                    </view>
                </view>
            </view>
        </view>
    </view>
</template>
<script setup>
const props = defineProps({
    item: Object,
    idx: Number
})

const emit = defineEmits(['toDetail', 'intelliShow', 'getAgentCollect', 'getAgentLike'])

function toDetail() {
    emit('toDetail')
}

function intelliShow(text) {
    emit('intelliShow', text)
}

function getAgentCollect(id) {
    emit('getAgentCollect', id)
}

function getAgentLike(id) {
    emit('getAgentLike', id)
}

function numResult(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    } else {
        return num;
    }
}
</script>
<style lang="scss" scoped>
.ai-card {
    width: 100%;
    border-radius: 32rpx;
    box-sizing: border-box;
    position: relative;
    display: flex;
    align-items: flex-end;
    transition: box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
        box-shadow: 0 0 8rpx rgba(22, 132, 252, 0.18), 0 0 6rpx rgba(0, 0, 0, 0.16), 0 0 8rpx rgba(0, 0, 0, 0.18);
        transform: translateY(0) scale(1.03);
    }

}

.card-box {
    // width: 100%;
    width: calc(100vw - 40rpx);
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 25rpx;

    .xin-card-content {
        width: 100%;
        // height: 98%;
        margin: 1rpx;
        display: flex;
        justify-content: space-between;
        border-radius: 25rpx;
        padding: 10rpx 11rpx 0 11rpx;
        box-sizing: border-box;
        overflow: hidden;

        .card-zuo {
            margin-left: 0;
            display: flex;
            flex-direction: row;
            margin-bottom: 5rpx;
            position: relative;

            .top_icon {
                position: absolute;
                right: 9rpx;
                top: -5rpx;
                width: 48rpx;
                height: 48rpx;
            }

            .xin-left {
                // margin-bottom: 35rpx;
                margin-top: 0;
                display: flex;
                align-items: center;
                justify-content: inherit;
                padding-left: 4rpx;

                .xin-title {
                    font-size: 30rpx;
                    font-weight: bold;
                    color: #8178EF;
                    display: block;
                    // text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);

                    font-family: 'AlimamaFangYuanTi' !important;
                    font-weight: bold;
                    line-height: 30rpx;
                    letter-spacing: 0rpx;
                    width: 100%;

                }

                .subtitle {
                    width: 95%;
                    font-size: 20rpx;
                    color: #6c6c6c;
                    line-height: 30rpx;
                    margin-top: 6rpx;
                }
            }

            .subtitle {
                width: 100%;
                font-size: 20rpx;
                color: #6c6c6c;
                line-height: 30rpx;
                margin-top: 6rpx;
                padding-left: 4rpx;
            }

            .xincard-img {
                width: 50rpx;
                height: 50rpx;
            }
        }

        .card-you {
            width: 103.56rpx;
            height: 100%;
            margin-right: 3rpx;
            display: flex;
            position: relative;
            margin-right: 18rpx;

            .card-you-img {
                height: 32rpx;
                width: 32rpx;
                position: absolute;
                top: 8rpx;
                left: -25rpx;
            }

            .card-you-box {
                width: 103.56rpx;
                height: auto;
                // width: 100%;
                // height: 90%;
                margin: 0;
                display: flex;
                // background: linear-gradient(218deg, rgba(255, 241, 117, 0.41), rgba(113, 127, 255, 0.2) 103%);
                border-radius: 10rpx;

                .card-you-box1 {
                    width: 102.56rpx;
                    height: 102.56rpx;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    border-radius: 10rpx;
                    background: linear-gradient(45deg, #edebff, #DEDBFF);
                    overflow: hidden;
                    position: relative;
                    margin-right: 10rpx;
                }
            }
        }

        .xincard-title {
            font-size: 26rpx;
            font-weight: bold;
            line-height: 30rpx;
            color: #8178EF;
            font-family: 'AlimamaFangYuanTi' !important;
        }

        .xin-yinying {
            text-shadow: 0px 4px 10px #D3D3D3;
        }
    }
}

.card-you-box1 {
    margin-right: 10rpx;
}

.tab_list {
    display: flex;
    overflow-x: auto;
    flex-wrap: nowrap;

    .tab_item {
        flex: none;
        width: auto;
        padding: 5rpx 10rpx;
        border: none;
        border-radius: 15rpx;
        font-size: 20rpx;
        font-weight: bold;
        line-height: 20rpx;
        margin-right: 8rpx;
        color: rgba(0, 0, 0, 0.6);
    }
}

.max_title {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.xin-title-hot {
    float: right;
    font-size: 26rpx;
    font-weight: bold;
    line-height: 33rpx;
    color: #FF5F33;
    margin-top: -8rpx;
    margin-left: 5rpx;
}

.xin-title-hot image {
    margin-bottom: -12rpx;
    margin-right: 6rpx;
}

.xin-title-new {
    font-size: 20rpx;
    font-weight: bold;
    line-height: 33rpx;
    color: #fff;
    background: url('https://file.aizhs.top/sys-mini/default/new.png') no-repeat;
    background-size: 100% 100%;
    font-size: 10rpx;
    line-height: 18rpx;
    display: inline-block;
    border-radius: 6rpx;
    margin-left: 6rpx;
    position: relative;
    top: 3rpx;
    width: 50rpx;
    height: 50rpx;
    padding: 0 !important;
}

.card_body {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    width: 100%;
    height: 100%;
}

.import_card-bg {
    // background: linear-gradient(240deg, #DEDBFF 0%, rgba(255, 255, 255, 1) 100%);
    background: rgba(0, 4, 255, 0.015);
    border: none;
}

.nomarl_card-bg {
    background: rgba(0, 4, 255, 0.015);
}

.robot-img {
    width: 100%;
    height: 95%;
    border-radius: 15rpx;
    //width: 102rpx;
    //height: 182rpx;
}

.floating-decoration {
    right: 5rpx;
    width: 180rpx;
    height: 180rpx;
    z-index: 10;
    margin-right: 0;
    border-radius: 30rpx;
}

.profile {
    display: flex;
    color: #6c6c6c;
    justify-content: flex-start;
    align-items: center;
    margin-bottom: 4rpx;
    // transform: scale(1.2);

    .xin-avatar {
        width: 32rpx;
        height: 32rpx;
        border-radius: 8rpx;
    }

    .xin-name {
        font-size: 24rpx;
        margin-left: 8rpx;
        font-weight: bold;
        font-family: 'AlimamaFangYuanTi' !important;
    }
}
</style>
