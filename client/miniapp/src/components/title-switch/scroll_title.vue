<template>
    <view class="scroll_title">
        <view class="sub_title">
            <view class="title">主赛道：</view>
            <swiper class="swiper" circular :duration="500" :previous-margin="mainSwiperMargin"
                :next-margin="mainSwiperMargin" @change="mainChange" :current="current">
                <swiper-item v-for="(item, index) in mainList" :key="index" class="sub_item f_c"
                    :class="{ 'sub_selected': current == index }" @click="selectMain(item, index)">
                    <view class="text_block">{{ item.name }}</view>
                </swiper-item>
            </swiper>
        </view>
        <view class="sub_title" v-if="subList && subList.length > 0">
            <view class="title">子赛道：</view>
            <swiper class="swiper" circular :duration="500" :previous-margin="subSwiperMargin" :next-margin="subSwiperMargin"
                @change="subChange" :current="subSelected">
                <swiper-item v-for="(item, index) in subList" :key="index" class="sub_item f_c"
                    :class="{ 'sub_selected': subSelected == index }" @click="selectSub(item, index)">
                    <view class="text_block">{{ item.name }}</view>
                </swiper-item>
            </swiper>

        </view>

    </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const props = defineProps({
    mainList: {
        type: Array,
        default: () => [
            { name: '赛道一' },
            { name: '赛道二' },
            { name: '赛道三' },
            { name: '赛道四' },
            { name: '赛道五' },
            { name: '赛道六' },
        ]
    },
    mainSwiperMargin: {
        type: String,
        default: '240rpx'
    },
    subSwiperMargin: {
        type: String,
        default: '240rpx'
    }
})

const emit = defineEmits(['change'])

const current = ref(0)
const subList = ref([])
const subSelected = ref(null)

onMounted(() => {
    subList.value = props.mainList[0].children
})

function mainChange(e) {
    current.value = e.detail.current
}

function selectMain(item, index) {
    current.value = index
    subList.value = item.children
    subSelected.value = null
}

function btnLeftMain() {
    if (current.value == 0) {
        current.value = props.mainList.length - 1
    } else {
        current.value--
    }
}

function btnRightMain() {
    if (current.value < props.mainList.length - 1) {
        current.value++
    } else {
        current.value = 0
    }
}

function subChange(e) {
    subSelected.value = e.detail.current
}

function selectSub(item, index) {
    subSelected.value = index
    emit('change', item)
}

function btnLeft() {
    if (subSelected.value == 0) {
        subSelected.value = subList.value.length - 1
    } else {
        subSelected.value--
    }
}

function btnRight() {
    if (subSelected.value < subList.value.length - 1) {
        subSelected.value++
    } else {
        subSelected.value = 0
    }
}
</script>

<style lang="scss" scoped>
.scroll_title {
    // display: flex;
    width: 100%;
    border-radius: 0 0 15px 15px;
    box-shadow: 0 4px 2px -4px rgb(0 0 0 / 0.3);
    padding-bottom: 12rpx;

    // flex-direction: column;
    background-color: #fff;
}

.sub_title {
    width: 100%;
    padding: 0 28rpx;
    box-sizing: border-box;

    // flex: 1;
    // display: flex;
    // flex-direction: column;
    // align-items: center;
    margin-bottom: 18rpx;

    .title {
        font-family: AlimamaFangYuanTi !important;
        font-size: 30rpx;
        font-weight: bold;
        letter-spacing: 0.08em;
        color: #000;
    }

    .sub_item {
        // width: 156rpx;
        height: 46rpx;
        margin-right: 30rpx;
        box-sizing: border-box;
        border-radius: 6px;
        white-space: nowrap;
        font-family: AlimamaFangYuanTi !important;
        font-size: 24rpx;
        font-weight: normal;
        color: #000;
        overflow: auto !important;

        .text_block {
            flex: none;
        }
    }

    .btns {
        display: flex;
        align-items: center;
        justify-content: space-around;
        box-sizing: border-box;
        width: 60%;

        .icon_body {
            width: 120rpx;
            height: 120rpx;
        }

        .title_icon {
            width: 80rpx;
            height: 80rpx;
        }
    }
}

.swiper {
    // width: calc(100vw - 290rpx);
    width: calc(100vw - 60rpx);
    box-sizing: border-box;
    height: 60rpx;
}

.sub_selected {
    // background: rgba(255, 255, 255, 0.3);
    // background-image: radial-gradient(25% 50% at 50% 100%, #FFFFFF 0%, rgba(255, 255, 255, 0) 100%) 1;
    backdrop-filter: blur(20rpx);

    // box-shadow: 0px 0px 6px 0px rgba(0, 0, 0, 0.3);
    color: #7361FF !important;
    font-weight: bold !important;
    box-sizing: border-box;

    // border-image:
    //     radial-gradient(40% 50% at 50% 100%, #000000 0%, rgba(255, 255, 255, 0) 100%) 2,
    //     radial-gradient(40% 50% at 50% 5%, #000000 0%, rgba(255, 255, 255, 0) 100%) 2;
    // border-image: radial-gradient(40% 50% at 50% 100%, #000000 0%, rgba(255, 255, 255, 0) 100%) 1.5;
    // border-image: radial-gradient(40% 50% at 50% 5%, #000000 0%, rgba(255, 255, 255, 0) 100%) 1.5;

    /* 1. 基础边框设置：宽度必须足够，样式为transparent */
    // border: 2rpx solid transparent;

    /* 关键：设置透明边框，为背景留出显示空间 */
    border: 7rpx solid transparent;

    /* 多层背景模拟上下边框渐变 */
    background-image:
        /* 底部渐变（对应原border-image第一个渐变） */
        radial-gradient(40% 50% at 50% 100%, #000 0%, transparent 100%),
        /* 顶部渐变（对应原border-image第二个渐变） */
        radial-gradient(40% 50% at 50% 0%, #000 0%, transparent 100%);

    /* 背景绘制到边框区域（核心属性） */
    background-clip: border-box;

    /* 背景从边框区域开始计算位置 */
    background-origin: border-box;

    /* 控制背景位置和尺寸，只在上下边框显示 */
    background-position:
        bottom center,
        /* 底部渐变位置 */
        top center;

    /* 顶部渐变位置 */
    background-size:
        100% 7rpx,
        /* 底部渐变尺寸（宽度100%，高度等于边框宽度） */
        100% 7rpx;

    /* 顶部渐变尺寸 */
    background-repeat: no-repeat;

    /* 禁止背景重复 */
}

.f_c {
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
