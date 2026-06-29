<template>
    <view class="card_content">
        <view class="has_image" v-if="imageList && type == 'item'" @click="showDialog">
            <image class="img1" mode="widthFix" :src="imageList[0]" ></image>
            <view class="has_img2 f_b">
                <view class="f_n">
                    <image class="avatar"
                        :src="info.avatar ? info.avatar : 'https://file.aizhs.top/sys-mini/xtk/devlogo.png'" mode="aspectFill" />
                    <view class="user_info_column">
                        <view class="user_name flex_center">
                            <text>{{ info.createdName || '' }}</text>
                        </view>
                        <view class="right_types_container">
                            <view class="right_types f_c" v-for="item in right_types" :key="item.id">
                                <text>{{ item.name }}</text>
                            </view>
                        </view>
                    </view>
                </view>

            </view>
            <view class="title" style="margin-bottom: 10rpx;margin-left: 16rpx;margin-right: 20rpx;">
                {{ info.title || '' }}
            </view>
            <view class="font_nomal m_b m_l" style="margin-bottom: 14rpx;">
                {{ formatDateRange(info.createdAt, info.closingTime) }}
            </view>
            <view class="f_b m_b m_l" style="padding-right: 10rpx;">
                <view class="cycle">周期时间：{{ info.cycle || '' }}{{ cycleUnits[info.cycleUnit] || '' }}</view>
            </view>
            <view class="has_img1 f_b">
                <view class="money f_c">
                    <text :style="{ color: info.status == 6 ? '#8D8D8D' : '#FF0000' }"><text style="font-size: 24rpx;">￥</text>{{ formatPrice(info.lowestPrice) }}-{{
                        formatPrice(info.peakPrice) }}</text>
                </view>
                <view class="f_n">
                <view class="status">
                    <view class="fabu f_c" v-if="info.status == 2" @click.stop="toKf">
                        <text>聊一聊</text>
                    </view>
                    <view class="ywc" v-if="info.status == 6">项目已完成</view>
                    <view class="kfz" v-if="info.status == 4">开发中...</view>
                </view>
                </view>
            </view>
        </view>

        <view class="no_image" v-else @click="showDialog">
            <view class="m_b f_b">
                <view class="f_n">
                    <image class="avatar"
                        :src="info.avatar ? info.avatar : 'https://file.aizhs.top/sys-mini/xtk/devlogo.png'" mode="aspectFill" />
                    <view class="user_info_column">
                        <view class="user_name flex_center">
                            <text>{{ info.createdName || '' }}</text>
                        </view>
                        <view class="right_types_container">
                            <view class="right_types f_c" v-for="item in right_types" :key="item.id">
                                <text>{{ item.name }}</text>
                            </view>
                        </view>
                    </view>
                </view>
                <image class="icon" @click.stop="close" v-if="type == 'dialog'"
                    src="https://file.aizhs.top/sys-mini/xtk/cancel.png" />
            </view>
            <view class="title" style="margin-right: 16rpx;">
                {{ info.title || '' }}
            </view>
            <view class="context font_nomal m_b">
                {{ info.context || '' }}
            </view>
            <view class="font_nomal m_b">{{ formatDateRange(info.createdAt, info.closingTime) }}</view>
            <view class="cycle m_b">周期时间：{{ info.cycle || '' }}{{ cycleUnits[info.cycleUnit] || '' }}</view>
            <view v-if="type == 'dialog'" class="m_b">
                <text class="font_nomal" style="margin-bottom: 7rpx;">相关图片：</text>
                <view class="f_n">
                    <image class="image_item" v-for="item in imageList" :key="item" :src="item" />
                </view>
            </view>
            <view class="f_b" style="margin-right: 0;">
                <view class="money f_c">
                    <text :style="{ color: info.status == 6 ? '#8D8D8D' : '#FF0000' }"><text style="font-size: 24rpx;">￥</text>{{ formatPrice(info.lowestPrice || 0) }}-{{
                        formatPrice(info.peakPrice || 0) }}</text>
                </view>
                <view class="status">
                    <view class="fabu f_c" v-if="info.status == 2" @click.stop="toKf">
                        <text>聊一聊</text>
                    </view>
                    <view class="ywc" v-if="info.status == 6">项目已完成</view>
                    <view class="kfz" v-if="info.status == 4">开发中...</view>
                </view>
            </view>
        </view>
    </view>
</template>
<script setup>
import { computed } from 'vue'

const props = defineProps({
    info: {
        type: Object,
        default: () => {
            return {}
        }
    },
    type: {
        type: String,
        default: 'item'
    },
    itemUserInfo: {
        type: Object
    },
    categorys: {
        type: Array,
        default: () => {
            return []
        }
    }
})

const emit = defineEmits(['showDialog', 'close'])

const cycleUnits = {
    '0': '日',
    '1': '周',
    '2': '月',
    '3': '年'
}

const imageList = computed(() => {
    if (props.info.imgs) {
        return props.info.imgs.split(",")
    } else {
        return false
    }
})

const right_types = computed(() => {
    if (props.type == 'dialog') {
        let list1 = []
        if (props.info.categoryList && props.info.typeList) {
            list1 = props.info.typeList.concat(props.info.categoryList)
        } else if (props.info.typeList) {
            list1 = props.info.typeList
        } else if (props.info.categoryList) {
            list1 = props.info.categoryList
        }

        if (props.info.type) {
            let list = props.info.type.split(",").map(item => {
                return { name: item }
            })
            return list1.concat(list)
        } else {
            return list1
        }
    } else {
        if (props.info.typeList) {
            return props.info.typeList
        }
    }
})

function formatPrice(price) {
    price = Number(price);
    if (price >= 10000) {
        return (price / 10000).toFixed(0) + '万'
    } else if (price >= 1000) {
        return (price / 1000).toFixed(0) + 'K'
    }
    return price
}

function formatDate(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    const date = dateStr.split(" ")[0];
    return date.replace(/-/g, '.');
}

function formatDateRange(createdAt, closingTime) {
    const startDate = formatDate(createdAt);
    const endDate = formatDate(closingTime);
    return `${startDate}——${endDate}`;
}

function toKf() {
    const roomId = props.info.roomId || props.info.room_id || ''
    const name = props.info.createdName || '开发助手'
    const avatar = props.info.avatar || ''
    const room_name = props.info.title + '的群聊'

    let url = '/pagesA/assistant/index'
    const params = []

    if (name) {
        params.push(`name=${encodeURIComponent(name)}`)
    }

    if (room_name) {
        params.push(`room_name=${encodeURIComponent(room_name)}`)
    }

    if (roomId) {
        params.push(`roomId=${encodeURIComponent(roomId)}`)
    }

    if (avatar) {
        params.push(`avatar=${encodeURIComponent(avatar)}`)
    }

    if (params.length > 0) {
        url += '?' + params.join('&')
    }

    uni.navigateTo({
        url: url
    })
}

function showDialog() {
    if (props.type == 'item') {
        emit('showDialog', props.info)
    }
}

function close() {
    emit('close')
}
</script>
<style lang="scss" scoped>
.card_content {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    position: relative;
    width: 100%;
    height: 100%;

    .image_item {
        width: 100rpx;
        height: 100rpx;
        border-radius: 8rpx;
        margin-right: 15rpx;
    }

    .no_image {
        padding: 15rpx;
    }

    .img1 {
        width: 100%;
        height: 356rpx;
        border-radius: 20rpx 20rpx 0 0;
        margin-bottom: 8rpx;
    }

    .has_img1 {
        box-sizing: border-box;
        margin-left: 18rpx;
        margin-right: 15rpx;
    }

    .has_img2 {
        box-sizing: border-box;
        margin-left: 18rpx;
        margin-right: 14rpx;
        padding-bottom: 14rpx;
        margin-bottom: 12rpx;
    }

    .avatar {
        width: 60rpx;
        height: 60rpx;
        border-radius: 8rpx;
        margin-right: 8rpx;
        background-color: #000;
        flex: none;
    }

    .user_info_column {
        display: flex;
        flex-direction: column;
        margin-left: 12rpx;
    }
    
    .right_types_container {
        display: flex;
        flex-wrap: wrap;
        margin-top: 8rpx;
    }
    
    .right_types_container .right_types {
        margin-bottom: 8rpx;
    }

    .user_name {
        font-family: AlimamaFangYuanTi !important;
        font-size: 32rpx;
        font-weight: bold;
        color: #000;
        margin-left: 12rpx;
    }

    .right_types {
        flex: none;
        width: auto;
        padding: 5rpx 10rpx;
        border: 1px solid rgb(0 0 0 / 0.3);
        border-radius: 15rpx;
        font-size: 20rpx;
        font-weight: bold;
        line-height: 20rpx;
        margin-right: 8rpx;
        color: rgb(0 0 0 / 0.6);
    }


    .title {
        font-family: AlimamaFangYuanTi !important;
        font-size: 32rpx;
        font-weight: bold;
        color: #000;
    }

    .context {
        box-sizing: border-box;
        padding: 9rpx 15rpx 15rpx;
        border-bottom: 1rpx solid #f5f5f5;
        margin: 0 -15rpx;
    }

    .cycle {
        font-family: AlimamaFangYuanTi !important;
        font-size: 24rpx;
        font-weight: normal;
        color: #8D8D8D;
    }

    .icon {
        position: absolute;
        top: 0;
        right: 0;
        width: 43rpx;
        height: 43rpx;
    }

    .money {
        font-family: AlimamaFangYuanTi !important;
        font-size: 36rpx;
        font-weight: bold;
        max-width: 200rpx;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: left;
        justify-content: flex-start;
        align-items: flex-start;
    }
    
    .money text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 100%;
    }

    .status {
        .fabu {
            width: 123rpx;
            height: 46rpx;
            border-radius: 15rpx;
            box-sizing: border-box;
            font-size: 24rpx;
            font-weight: bold;
            color: #000;
            text-transform: uppercase;
            border: 2rpx solid #e0e4ec !important;
            background: #fff !important;
            box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .ywc {
            font-family: AlimamaFangYuanTi !important;
            font-size: 20rpx;
            font-weight: 500;
            color: #8D8D8D;
        }

        .kfz {
            font-family: AlimamaFangYuanTi !important;
            font-size: 20rpx;
            font-weight: 500;
            color: #B0A0FF;
        }
    }
}

.f_n {
    display: flex;
    align-items: center;
}

.f_c {
    display: flex;
    align-items: center;
    justify-content: center;
}

.f_b {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.m_b {
    margin-bottom: 15rpx;
}

.m_l {
    margin-left: 20rpx;
}

.font_nomal {
    font-family: AlimamaFangYuanTi !important;
    font-size: 24rpx;
    font-weight: normal;
    color: #3D3D3D;
}

.font_bold {
    font-family: AlimamaFangYuanTi !important;
    font-size: 24rpx;
    font-weight: bold;
}

@keyframes bouncea {
    0% {
        box-shadow: none;
        transform: translate(3rpx, 3rpx);
    }

    50% {
        box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
        transform: translate(0, 0);
    }

    100% {
        box-shadow: none;
        transform: translate(3rpx, 3rpx);
    }
}

.has_image{
    padding-bottom: 14rpx;
}
</style>
