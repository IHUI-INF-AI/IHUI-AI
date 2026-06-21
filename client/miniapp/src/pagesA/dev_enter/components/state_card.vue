<template>
    <view class="card_body">
        <view class="top" v-if="status == 0 || status == 1 || status == 4 || status == 5">
            <view class="base_datas">
                <view class="head">
                    <image class="head-image" :src="datas.agent_avatar" mode="widthFix" lazy-load="true" />
                </view>
                <view class="content_main margin_bottom what_do_you_want">
                    <view class="title margin_bottom" style="margin-bottom: 8rpx;">{{ datas.agent_name }}</view>
                    <view style="display: flex;flex: 1;justify-content: space-between;">
                        <view class="title-sub">{{ datas.prologue }}</view>

                        <view class="top_footer-model" :class="{ 'has_border': showfooter }"
                            v-if="status == 0 || status == 1">
                            <view class="top_footer-model-image_body" v-if="status == 0"
                                @click.stop="toDevEdit('edit')">
                                <image class="top_footer-model-image"
                                    src="https://file.aizhs.top/sys-mini/xtk/model_card_btn_bg.png" mode="widthFix"
                                    lazy-load="false"></image>
                                <view class="top_footer-model-text_icon">
                                    {{ '设置' }}
                                </view>
                            </view>
                            <view class="text" v-if="status == 1">审核中</view>
                            <view class="top_footer-model-text">
                                <text></text>
                            </view>
                        </view>


                    </view>
                </view>
            </view>
        </view>

        <view class="haspush" v-if="status == 2">
            <view class="base_datas">
                <view class="head">
                    <image class="head-image" :src="datas.agent_avatar" mode="widthFix" lazy-load="true" />
                </view>
                <view class="content_main margin_bottom">
                    <view class="title margin_bottom" style="margin-bottom: 8rpx;">{{ datas.agent_name }}</view>
                    <view class="title-sub">{{ datas.prologue || '' }}</view>
                </view>
                <view class="font_hold" @click="showWindow">下架</view>
            </view>
            <view class="font_nomal margin_bottom">所属类别：{{ getMainType }}</view>
            <view class="font_nomal margin_bottom">{{ getTypes }}</view>
            <view class="font_nomal margin_bottom">售卖方式：{{ payTypes[datas.category_info.type] }}</view>
            <view class="font_nomal margin_bottom">面向群体：{{ datas.group == '1' ? '会员' : '全部用户' }}</view>
            <view class="font_nomal margin_bottom">价格：{{ (datas.category_info.account / 100).toFixed(2) }} 元 / {{
                typeChilds[datas.category_info.type_child] || '月' }}（限时免费后为此价格）</view>
            <view class="font_nomal margin_bottom">折扣：{{ discount[datas.category_info.discount_month] || '无' }}</view>
            <view class="line margin_bottom"></view>
            <view class="footer">
                <view class="">
                    <view class="font_nomal margin_bottom">上架时间：{{ getTime.start }}</view>
                    <view v-if="datas.category_info.type == 2" class="font_nomal">限时免费时间：<text style="color: #979797">{{
                        getTime.start }}-{{ getTime.end }}</text></view>
                </view>
                <!-- <view class="top_footer-model-image_body" @click.stop="toDevEdit('change')">
                    <image class="top_footer-model-image"
                        src="https://file.aizhs.top/sys-mini/xtk/model_card_btn_bg.png" mode="widthFix"
                        lazy-load="false"></image>
                    <view class="top_footer-model-text_icon" style="color: #000;">
                        {{ '修改' }}
                    </view>
                </view> -->
            </view>
        </view>
        <view class="mask flex_center" v-if="prompt">
            <view class="prompt_dialog">
                <view class="prompt_dialog-head flex_center">
                    <image class="prompt_dialog-image" src="https://file.aizhs.top/sys-mini/xtk/my_model_delete.png" />
                </view>
                <view class="prompt_dialog-content">是否确定下架此智能体</view>
                <view class="prompt_dialog-footer flex_center">
                    <view class="prompt_dialog-cancel flex_center" style="margin-right: 42rpx;"
                        @click="() => { prompt = false }">
                        <text class="font_nomal">取消</text>
                    </view>
                    <view class="prompt_dialog-comfirm flex_center" style="margin-left: 42rpx;"
                        @click="deleteZntCharge">
                        <text class="font_nomal" style="color: #fff;">确定</text>
                    </view>
                </view>
            </view>
        </view>
    </view>
</template>
<script setup>
import { ref, computed } from 'vue'
import { getYMD } from '@/utils/time.js'

const props = defineProps({
    datas: {
        type: Object,
        default: () => {
            return {}
        }
    },
    type: {
        type: String,
        default: 'view'
    },
    status: {
        type: String
    },
    modelTypes: {
        type: Array,
        default: () => { return [] }
    }
})

const emit = defineEmits(['toDevEdit', 'deleteZntCharge'])

const showfooter = ref(false)
const prompt = ref(false)
const payTypes = {
    '1': '免费', '2': '限时免费', '3': '收费'
}
const modelFileType = {
    '1': '文字', '2': '图片', '3': '视频'
}
const discount = {
    '1': '6个月后8折', '2': '9个月后7折', '3': '1年后5折'
}
const account = ref(0)
const typeChilds = {
    '1': '月',
    '2': '年',
    '3': '永久'
}

const getMainType = computed(() => {
    if (props.datas.category_info) {
        return props.datas.category_info.agent_main_category.split(',').map(item => {
            return modelFileType[item]
        }).join()
    } else {
        return '无'
    }
})

const getTypes = computed(() => {
    if (props.datas.category_info) {
        return props.datas.category_info.agent_category.split(',').map(item => {
            const res = props.modelTypes.find(val => {
                return val.code == item
            })
            if (res) {
                return res.showName
            } else {
                return ""
            }
        }).join()
    } else {
        return '无'
    }
})

const getAccount = computed(() => {
    if (props.datas.category_info) {
        if (props.datas.category_info.type == '1') {
            return 0
        } else if (props.datas.category_info.type == '2') {

        } else if (props.datas.category_info.type == '3') {

        }
    }
})

const getTime = computed(() => {
    if (props.datas.category_info) {
        let now = props.datas.start_time.slice(0, 10)
        let date = new Date(now)
        date.setMonth(date.getMonth() + props.datas.category_info.limit_free * 1);
        return {
            start: now,
            end: getYMD(date)
        }
    } else {
        return {
            start: '-',
            end: '-'
        }
    }
})

const showWindow = () => {
    prompt.value = true
}

const toDevEdit = (val) => {
    emit('toDevEdit', props.datas, val)
}

const deleteZntCharge = () => {
    emit('deleteZntCharge', props.datas.agent_id)
    prompt.value = false
}
</script>
<style lang="scss" scoped>
.card_body {
    border: 1rpx solid #DADADA;
    width: calc(100vw - 40rpx);
    // border-radius: 30rpx 30rpx 0 30rpx;
    border-radius: 30rpx;
    margin-top: 18rpx;

    .haspush {
        padding: 22rpx;

        .line {
            height: 1rpx;
            background-color: #D8D8D8;
            width: calc(100vw - 112rpx);
        }

        .footer {
            display: flex;
            justify-content: space-between;
        }
    }

    .base_datas {
        display: flex;

        .head {
            margin-right: 18rpx;

            .head-image {
                width: 184rpx;
                height: 184rpx;
                border-radius: 15rpx;
            }
        }

        .content_main {
            flex: 1;

            .title {
                // text-shadow: 0rpx 4rpx 10rpx #D3D3D3;
                color: #517BFF;
                font-size: 32rpx;
                font-weight: normal;
                font-family: "AlimamaFangYuanTi" !important;
            }

            .title-sub {
                font-size: 24rpx;
                color: #414141;
                font-weight: normal;
                font-family: "AlimamaFangYuanTi" !important;
                // ...
                max-height: 182rpx;
                display: -webkit-box;
                overflow: hidden;
                -webkit-box-orient: vertical;
                -webkit-line-clamp: 6;
                text-overflow: ellipsis;
            }
        }
    }

    .top {
        padding: 21rpx 21rpx 0 21rpx;
    }
}

.what_do_you_want {
    display: flex;
    flex-direction: column;

}

.has_border {
    border-width: 1rpx 0 0 0;
    border-style: solid;
    border-color: #DADADA;
}

.top_footer-model {
    display: flex;
    position: relative;
    flex-direction: row-reverse;
    margin-top: auto;

    .text {
        font-family: "AlimamaFangYuanTi" !important;
        font-size: 30rpx;
        font-weight: normal;
        color: #3D3D3D;
        margin: 0 18rpx 18rpx 0;
    }
}

.top_footer-model-image {
    width: 140rpx;
    height: 60rpx;
}

.top_footer-model-text_icon {
    position: absolute;
    bottom: 18rpx;
    right: 40rpx;
}

.top_footer-model-image_body {
    display: flex;
    align-items: center;
    position: relative;
}

.top_footer-model-text {
    flex: 1;
    display: flex;
    align-items: center;
    color: #3D3D3D;
    font-size: 24rpx;
    font-family: "AlimamaFangYuanTi" !important;
    font-weight: 500;
}


.mask {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0);
    // opacity: 0;
    z-index: 998;
}

.prompt_dialog {
    width: 431rpx;
    height: 237rpx;
    border-radius: 20rpx;
    background: #F5F7FA;
    position: relative;

    .prompt_dialog-head {
        position: absolute;
        left: 148rpx;
        top: -62.5rpx;
        width: 125rpx;
        height: 125rpx;
        border-radius: 50%;
        background: #F5F7FA;

        .prompt_dialog-image {
            width: 57rpx;
            height: 56rpx;
            margin-bottom: 28rpx;
        }
    }

    .prompt_dialog-content {
        margin-top: 70rpx;
        font-family: "AlimamaFangYuanTi" !important;
        font-size: 24rpx;
        font-weight: 500;
        color: #B0AEFA;
        text-transform: uppercase;
        letter-spacing: 0.3em;
        text-align: center;
    }

    .prompt_dialog-footer {
        margin-top: 54rpx;

        .prompt_dialog-cancel {
            width: 143rpx;
            height: 54rpx;
            border-radius: 20rpx;
            background: #FFFFFF;
        }

        .prompt_dialog-comfirm {
            width: 143rpx;
            height: 54rpx;
            border-radius: 20rpx;
            background: #CFCEFF;
        }
    }
}

.font_nomal {
    font-family: "AlimamaFangYuanTi" !important;
    font-size: 24rpx;
    font-weight: normal;
    color: #3D3D3D;
}

.font_hold {
    font-family: "AlimamaFangYuanTi" !important;
    font-size: 30rpx;
    font-weight: normal;
    color: #7B61FF;
    border-bottom: 1rpx solid #7B61FF;
    height: 30rpx;
}

.flex_center {
    display: flex;
    align-items: center;
    justify-content: center;
}

.margin_bottom {
    margin-bottom: 18rpx;
}
</style>