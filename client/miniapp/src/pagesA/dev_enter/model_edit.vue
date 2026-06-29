<template>
    <view class="outContainer">
        <!-- <navigation-bars color="black" viscosity="true" title="设置智能体" @pack="backPage" style="width: 100%;"
            :image="'https://file.aizhs.top/sys-mini/default/back.svg'" /> -->
        <!-- <Cover v-if="entry" @go="() => { entry = false }" :userInfo="userInfo"></Cover> -->
        <Loading v-if="loading"></Loading>
        <scroll-view class="scroll_body" scroll-y scroll-x="false" lower-threshold="50">
            <view class="base_datas">
                <view class="head">
                    <image class="head-image" :src="modelInfo.agent_avatar" mode="widthFix" lazy-load="true" />
                </view>
                <view class="content_main">
                    <view class="title" style="margin-bottom: 8rpx;">{{ modelInfo.agent_name }}</view>
                    <view class="title-sub">{{ modelInfo.prologue }}</view>
                </view>
            </view>
            <view class="line"></view>
            <view class="title_icon">
                <image class="title_icon-image" src="https://file.aizhs.top/sys-mini/backf2.png"
                    mode="widthFix" />
                <view class="title_icon-text">请选择种类（多选）</view>
            </view>
            <!-- 文字，图片，视频 -->
            <TypeBar @change="typeFileClick"></TypeBar>
            <view class="title_icon">
                <image class="title_icon-image" src="https://file.aizhs.top/sys-mini/xtk/bumen2.png"
                    mode="widthFix" />
                <view class="title_icon-text">部门</view>
            </view>
            <view class="select_name_list">
                <view class="name_item haad" @click="() => { showModelTypes = !showModelTypes }">
                    <text>{{ '选择类型' }}</text>
                    <image class="select_icon-head" src="https://file.aizhs.top/sys-mini/xtk/model_edit_down.png"
                        mode="widthFix" />
                </view>
                <scroll-view v-if="showModelTypes" class="scroll_body" style="height: 240rpx;" scroll-y scroll-x="false"
                    lower-threshold="50">
                    <view v-for="(item) in modelTypes" :key="item.id" class="name_item font_nomal"
                        :class="{ 'font_hold': modelTypeSelected.includes(item.id) }" @click="typeClick(item)">
                        <text>{{ item.showName }}</text>
                        <image v-if="modelTypeSelected.includes(item.id)" class="select_icon-item"
                            src="https://file.aizhs.top/sys-mini/xtk/model_edit_yes.png" mode="widthFix" />
                    </view>
                </scroll-view>
            </view>
            <view class="title_icon">
                <image class="title_icon-image" src="https://file.aizhs.top/sys-mini/xtk/model_edit_yuan.png"
                    mode="widthFix" />
                <view class="title_icon-text">请选择售卖方式种类</view>
            </view>
            <view class="select_items margin_bottom">
                <view v-for="(item, index) in saleTypes" :key="index" class="select_item flex_center"
                    :class="{ 'nomal_bg': paySelect == item.name }" @click="selectPay(item)">
                    <text>{{ item.name }}</text>
                </view>
            </view>
            <view class="card_bg margin_bottom" v-if="paySelect != '免费'">
                <view class="card_body">
                    <!-- 按什么收费 -->
                    <view class="pay_select_bg margin_bottom">
                        <view class="pay_select_body">
                            <view class="flex_center item" @click="changePayTime('按月收费')">
                                <view class="text" :class="{ 'bg': payTime == '按月收费' }">按月收费</view>
                            </view>
                            <view class="flex_center item" @click="changePayTime('按年收费')">
                                <view class="text" :class="{ 'bg': payTime == '按年收费' }">按年收费</view>
                            </view>
                            <view class="flex_center item" @click="changePayTime('一次性永久收费')">
                                <view class="text" :class="{ 'bg': payTime == '一次性永久收费' }">一次性永久收费</view>
                            </view>
                        </view>
                    </view>
                    <view class="font_sub_title margin_bottom">价格设定（{{ payTime == '按月收费' ? '月' : '按年收费' ? '年' :
                        '一次性永久收费' ? '永久' : '' }}）
                    </view>
                    <view class="fn margin_bottom">
                        <view class="yuan">￥</view>
                        <input class="input font_nomal" v-model="account" type="text" :placeholder="placeholder">
                    </view>
                    <view class="font_sub_title margin_bottom">选择限时免费时限</view>
                    <view class="fn margin_bottom" v-if="paySelect == '限时免费'">
                        <view class="lit_s_i" v-for="(item, index) in otherTimes" :key="index"
                            :class="{ 'bg': othertime == item }" @click="selectOther(item)">
                            <text>{{ item }}</text>
                        </view>
                    </view>
                    <view class="font_sub_title margin_bottom">选择面向群体</view>
                    <view class="fn margin_bottom">
                        <view class="lit_s_i" v-for="(item, index) in toMembers" :key="index"
                            :class="{ 'bg': tomember == item }" @click="selectMember(item)">
                            <text>{{ item }}</text>
                        </view>
                    </view>
                </view>
            </view>
            <view class="font_sub_title margin_bottom" v-if="paySelect == '免费'">选择面向群体</view>
            <view class="fn margin_bottom" v-if="paySelect == '免费'">
                <view class="lit_s_i" v-for="(item, index) in toMembers" :key="index"
                    :class="{ 'bg': tomember == item }" @click="selectMember(item)">
                    <text>{{ item }}</text>
                </view>
            </view>
            <view class="title_icon margin_bottom" v-if="paySelect != '免费'">
                <image class="title_icon-image" src="https://file.aizhs.top/sys-mini/xtk/model_edit_helf.png"
                    mode="widthFix" />
                <view class="font_sub_title">是否参与折扣</view>
            </view>
            <view class="fn" v-if="paySelect != '免费'">
                <view class="slf_item flex_center" v-for="(item, index) in slfs" :key="index"
                    :class="{ 'nomal_bg': slf == item.id }" @click="selectSale(item)">
                    <text>{{ item.name }}</text>
                </view>
            </view>
            <view class="submit_body flex_center">
                <view class="submit_btn flex_center" @click.stop="submit()">
                    <text>提交审核</text>
                </view>
            </view>
        </scroll-view>
    </view>
</template>
<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import NavigationBars from "@/components/navigation-bars/index.vue";
import Loading from "@/components/loading/index.vue";
import { createZntCharge, putZntCharge } from '@/service/aiModels.js'
import TypeBar from '@/components/type-bar/tab.vue'

const props = defineProps({
    modelInfo: {
        type: Object,
        default: () => ({})
    },
    modelTypes: {
        type: Array,
        default: () => []
    },
    pageType: {
        type: String,
        default: 'edit'
    }
})

const emit = defineEmits(['reback'])

const typeFileClicked = ref([])
const showModelTypes = ref(false)
const modelTypeSelected = ref([])
const saleTypes = ref([
    { name: '免费', select: false, id: '1' },
    { name: '限时免费', select: false, id: '2' },
    { name: '收费', select: false, id: '3' },
])
const paySelect = ref('限时免费')
const payTime = ref('按月收费')
const payTimes = ref({
    '按月收费': '1', '按年收费': '2', '一次性永久收费': '3'
})
const otherTimes = ref(['一个月', '三个月', '六个月', '一年'])
const othertime = ref('一年')
const freeMonth = ref({ '一个月': '1', '三个月': '2', '六个月': '6', '一年': '12' })
const account = ref("")
const placeholder = ref('请输入限时结束后每月/年/永久售卖价格')
const toMembers = ref(['全部用户', '会员'])
const tomember = ref('全部用户')
const slfs = ref([
    { name: '6个月后8折', id: '1' },
    { name: '9个月后7折', id: '2' },
    { name: '1年后5折', id: '3' }
])
const slf = ref('')
const userInfo = ref({})
const loading = ref(false)
const entry = ref(false)

watch(paySelect, (n) => {
    if (n == '限时免费') {
        payTime.value = '按月收费'
        othertime.value = '一年'
    }
    if (n == '收费') {
        payTime.value = '按月收费'
        othertime.value = ''
    }
    if (n == '免费') {
        payTime.value = ''
        othertime.value = ''
    }
    tomember.value = '全部用户'
    slf.value = ''
})

function refreshUserInfo() {
    try {
        const userData = uni.getStorageSync('data');
        if (userData) {
            userInfo.value = userData;
        }
    } catch (e) {
    }
}

onMounted(() => {
    uni.$on('user-info-updated', refreshUserInfo);
    userInfo.value = uni.getStorageSync("data");
    if (props.datas && props.datas.account) {
        account.value = getYuan(props.datas.account)
    }
})

onBeforeUnmount(() => {
    uni.$off('user-info-updated', refreshUserInfo);
})

function submit() {
    loading.value = true
    let params = {
        agent_id: props.pageType == 'change' ? props.modelInfo.id : props.modelInfo.agent_id,
        agent_name: props.modelInfo.agent_name,
        create_uuid: userInfo.value.uuid,
        create_name: userInfo.value.nickname,
        agent_main_category: typeFileClicked.value.join(),
        agent_category: modelTypeSelected.value.join(),
        type: saleTypes.value.find(item => item.name == paySelect.value).id,
        account: (account.value * 100).toFixed(0),
        group: tomember.value == '会员' ? '1' : '2',
        limit_free: freeMonth.value[othertime.value],
        discount_month: slf.value,
        prologue: props.modelInfo.prologue,
        type_child: payTimes.value[payTime.value]
    }

    if (props.pageType == 'change') {
        putZntCharge(params).then(res => {
            uni.showToast({ title: '提交成功', icon: 'none' });
        }).catch(err => {
            uni.showToast({ title: `${err.detail}`, icon: 'none' });
        }).finally(() => {
            emit('reback')
            loading.value = false
        })
    } else {
        createZntCharge(params).then(res => {
            uni.showToast({ title: '提交成功', icon: 'none' });
        }).catch(err => {
            uni.showToast({ title: `${err.detail}`, icon: 'none' });
        }).finally(() => {
            emit('reback')
            loading.value = false
        })
    }
}

function typeFileClick(arr) {
    typeFileClicked.value = arr.map(item => {
        if (item.id) {
            return item.id
        }
        if (typeof item == 'string') {
            return item
        }
    })
}

function typeClick(item) {
    const index = modelTypeSelected.value.indexOf(item.id)
    if (index < 0) {
        modelTypeSelected.value.push(item.id)
    } else {
        modelTypeSelected.value.splice(index, 1)
    }
}

function selectPay(item) {
    if (userInfo.value.developerLink && userInfo.value.developerLink.type == 1) {
        paySelect.value = item.name
    } else {
        if (paySelect.value == '免费') {
            paySelect.value = item.name
        } else {
            entry.value = true
        }
    }
}

function changePayTime(val) {
    payTime.value = val
}

function selectOther(val) {
    othertime.value = val
}

function selectMember(val) {
    tomember.value = val
}

function selectSale(val) {
    slf.value = val.id
}

function getYuan(num) {
    if (num > 99) {
        const start = (num + '').slice(0, -2)
        const end = (num + '').slice(-2)
        return start * 1 + (end * 1 / 100)
    } else {
        return num
    }
}

function backPage() {
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
    height: 100vh;
}

.scroll_body {
    height: 0;
    flex: 1;
    padding: 18rpx;
    box-sizing: border-box;

    .line {
        height: 1rpx;
        width: calc(100vw - 44rpx);
        background-color: #D8D8D8;
    }

    .title_icon {
        display: flex;
        align-items: center;
        margin-top: 18rpx;

        .title_icon-image {
            width: 41rpx;
            height: 41rpx;
            margin-right: 13rpx;
        }

        .title_icon-text {
            font-family: AlimamaFangYuanTi !important;
            font-size: 24rpx;
            font-weight: 500;
            color: #000;
        }
    }
}

.base_datas {
    display: flex;

    .head {
        margin-right: 18rpx;

        .head-image {
            width: 84rpx;
            height: 84rpx;
            border-radius: 15rpx;
        }
    }

    .content_main {
        flex: 1;

        .title {
            // text-shadow: 0rpx 4rpx 10rpx #D3D3D3;
            color: #517BFF;
            font-size: 30rpx;
            font-weight: normal;
            font-family: AlimamaFangYuanTi !important;
        }

        .title-sub {
            font-size: 24rpx;
            color: #414141;
            font-weight: normal;
            font-family: AlimamaFangYuanTi !important;

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

// 请选择种类（多选）
.select_items {
    display: flex;
    align-items: center;
    margin-top: 18rpx;

    .select_item {
        width: 155rpx;
        height: 60rpx;
        border-radius: 20rpx;
        background: #FFF;
        box-sizing: border-box;
        border: 1rpx solid #DADADA;
        box-shadow: 0rpx 0rpx 6rpx 0rpx rgb(21 0 255 / 0);
        font-family: AlimamaFangYuanTi !important;
        font-size: 24rpx;
        font-weight: 500;
        color: #3D3D3D;
        margin-right: 32rpx;
    }
}

.select_name_list {
    width: 330rpx;
    box-sizing: border-box;
    overflow: hidden;
    border: 1rpx solid #DADADA;
    border-radius: 20rpx;
    box-shadow: 0 0 6px 0 rgb(21 0 255 / 0);
    margin-top: 18rpx;

    .haad {
        font-family: AlimamaFangYuanTi !important;
        font-size: 24rpx;
        font-weight: normal;
        color: #979797;
        border-bottom: 1rpx solid #DADADA;
    }

    .name_item {
        height: 60rpx;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 16rpx;
    }

    .select_icon-head {
        width: 34rpx;
        height: 17rpx;
    }

    .select_icon-item {
        width: 24rpx;
        height: 16rpx;
    }
}

.card_bg {
    background-image: linear-gradient(307deg,
            rgb(209 158 255 / 0.7) -2%,
            rgb(209 158 255 / 0.7) -2%,
            rgb(209 158 255 / 0.7) -2%,
            rgb(211 161 223 / 0.6389) 32%,
            rgb(206 151 251 / 0.6925) 41%,
            rgb(255 242 0 / 0.21) 88%);
    width: calc(100vw - 36rpx);

    // height: 415rpx;
    border-radius: 20rpx;
    padding: 2rpx;
    overflow: hidden;
    position: relative;
    box-sizing: border-box;

    .card_body {
        width: 100%;

        // width: calc(100vw - 36rpx);
        height: 100%;
        border-radius: 20rpx;

        // padding: 18rpx;
        background-color: #FFF;
        box-sizing: border-box;
        padding: 10rpx;

        .yuan {
            font-family: AlimamaFangYuanTi !important;
            font-size: 48rpx;
            font-weight: bold;
            color: #8385FF;
            margin-right: 16rpx;
        }

        .input {
            border-width: 0 0 1rpx;
        }
    }
}

.pay_select_bg {
    background-image: linear-gradient(307deg,
            rgb(209 158 255 / 0.7) -2%,
            rgb(209 158 255 / 0.7) -2%,
            rgb(209 158 255 / 0.7) -2%,
            rgb(211 161 223 / 0.6389) 32%,
            rgb(206 151 251 / 0.6925) 41%,
            rgb(255 242 0 / 0.21) 88%);
    width: 100%;
    height: 70rpx;
    box-sizing: border-box;
    padding: 2rpx;
    border-radius: 20rpx;
}

.pay_select_body {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    width: 100%;
    height: 66rpx;
    border-radius: 20rpx;
    overflow: hidden;

    .line_body {
        background-color: #FFF;
        display: flex;
        align-items: center;
        height: 100%;
        box-sizing: border-box;

        .line {
            width: 1rpx;
            height: 50rpx;
            background-color: #CECBF1;
        }
    }

    .text {
        font-family: AlimamaFangYuanTi !important;
        font-size: 30rpx;
        font-weight: normal;
        color: #3D3D3D;
    }

    .item {
        flex: 1;
        height: 66rpx;
        background-color: #eee;
        padding: 5rpx;
        box-sizing: border-box;
        display: flex;
        align-items: center;

        .text {
            flex: 1;
            height: 100%;
            text-align: center;
            display: flex;
            justify-content: center;
            border-radius: 15rpx;
            align-items: center;

            &.bg {
                background: none;
                background-color: #fff !important;
            }
        }
    }
}

.nomal_bg {
    background: #EBEEF5 !important;
}

.bg {
    background-image: linear-gradient(307deg,
            rgb(209 158 255 / 0.7) -2%,
            rgb(209 158 255 / 0.7) -2%,
            rgb(209 158 255 / 0.7) -2%,
            rgb(211 161 223 / 0.6389) 32%,
            rgb(206 151 251 / 0.6925) 41%,
            rgb(255 242 0 / 0.21) 88%) !important;
}

.fn {
    display: flex;
    align-items: center;
}

.lit_s_i {
    border-radius: 30rpx;
    box-sizing: border-box;
    background: #EBEEF5;
    padding: 14rpx 16rpx;
    font-family: AlimamaFangYuanTi !important;
    font-size: 24rpx;
    font-weight: 500;
    color: #3D3D3D;
    margin-right: 18rpx;
}

.slf_item {
    width: 155rpx;
    height: 60rpx;
    border-radius: 20rpx;
    background: #FFF;
    box-sizing: border-box;
    border: 1rpx solid #DADADA;
    font-family: AlimamaFangYuanTi !important;
    font-size: 24rpx;
    font-weight: 500;
    color: #3D3D3D;
    margin-right: 18rpx;
}

.submit_body {
    margin: 36rpx 0;
    width: 100%;
    box-sizing: border-box;

    .submit_btn {
        width: 192rpx;
        height: 82rpx;
        border-radius: 30rpx;
        background: #000;
        box-shadow: inset 0rpx -6rpx 20rpx 0rpx rgb(255 255 255 / 0.1);
        box-sizing: border-box;
        border: none;
        font-family: AlimamaFangYuanTi !important;
        font-size: 30rpx;
        font-weight: bold;
        color: #fff;
    }
}

.flex_center {
    display: flex;
    align-items: center;
    justify-content: center;
}

.font_nomal {
    font-family: AlimamaFangYuanTi !important;
    font-size: 24rpx;
    font-weight: normal;
    color: #000;
}

.font_hold {
    font-family: AlimamaFangYuanTi !important;
    font-size: 24rpx;
    font-weight: bold !important;
    color: #000;
}

.margin_bottom {
    margin-bottom: 18rpx;
    box-sizing: border-box;
}

.font_sub_title {
    font-family: AlimamaFangYuanTi !important;
    font-size: 24rpx;
    font-weight: 500;
    color: #3D3D3D;
}
</style>