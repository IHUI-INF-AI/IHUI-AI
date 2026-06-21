<template>
    <view class="outer">
        <!-- <view class="view_body">
            <view class="scroll_content active_before2 f_c"><text>{{ mainList[current].name }}</text></view>
            <view class="scroll_content active_before f_c"><text>{{ mainList[current + 1].name }}</text></view>
            <view class="scroll_content active_item f_c"><text>{{ mainList[current + 2].name }}</text></view>
            <view class="scroll_content active_after f_c"><text>{{ mainList[current + 3].name }}</text></view>
            <view class="scroll_content active_after2 f_c"><text>{{ mainList[current + 4].name }}</text></view> -->

        <scroll-view class="scroll_body" :scroll-x="false" :scroll-y="true" @scroll="scrolling">
            <view class="scroll_outer">
                <view class="top"></view>

                <view class="scroll_item" v-for="(item, index) in viewList" :key="index" :style="{}">
                    <!-- 
                        fixed
                        'top': current === index ? '75rpx' : '0',
                        'left': current === index ? '54rpx' : '0',
                        absolute
                        'top': current === index ? '-28rpx' : '0',
                    -->
                    <!-- 'background-color': current === index ? 'rgba(188, 188, 188, 1)' : 'rgba(0, 0, 0, 0)', -->
                    <!-- <view class="scroll_content" :style="{
                        'position': current === index ? 'fixed' : 'static',
                        'background-image': current === index ?
                            'linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(188, 188, 188, 1))' : 'none',
                        'opacity': current === index ? '1' : '0.5',
                        'z-index': current === index ? '1' : '0',
                        'top': current === index ? '75rpx' : '0',
                        'left': current === index ? '54rpx' : '0',
                        'width': current === index ? '180rpx' : '160rpx',
                        'height': current === index ? '58rpx' : '48rpx',
                    }">
                        <view style="color: #000;">{{ item.name }}</view>
                    </view> -->

                    <view class="scroll_content f_c" :class="{
                        'active_before2': current == index + 2,
                        'active_before': current == index + 1,
                        'active_item': current == index,
                        'active_after': current == index - 1,
                        'active_after2': current == index - 2,

                    }">
                        <view>{{ item.name }}</view>
                    </view>
                </view>
                <view class="bottom"></view>
            </view>
        </scroll-view>
        <!-- </view> -->
        <view class="btns">
            <image class="title_icon" @click="() => { current-- }"
                src="/static/images/saidao_title_left.png" />

            <image class="title_icon" @click="() => { current++ }"
                src="/static/images/saidao_title_right.png" />
        </view>
    </view>
</template>
<script setup>
import { ref, watch, onMounted } from 'vue'

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
            { name: '赛道7' },
            { name: '赛道8' },
            { name: '赛道9' },
            { name: '赛道10' },
            { name: '赛道11' },
        ]
    }
})

const emit = defineEmits(['currentChange'])

const current = ref(0)
const itemHeight = ref(20)
const viewList = ref([
    { name: '赛道一' },
    { name: '赛道二' },
    { name: '赛道三' },
    { name: '赛道四' },
    { name: '赛道五' },
])

onMounted(() => {
    itemHeight.value = parseInt(20 / props.mainList.length)
})

watch(current, (n) => {
    emit('currentChange', n)
}, { immediate: true })

function scrolling(e) {
    const query = uni.createSelectorQuery().in(this)
    query
        .selectAll(".scroll_content")
        .boundingClientRect((data) => {
            for (let i = 0; i < data.length; i++) {
                let num = Math.abs(data[i].top - 120.5)
                if (num < 11.5) {
                    current.value = i
                    break
                }
            }
        })
        .exec()
}
</script>
<style lang="scss" scoped>
.btns {
    display: flex;
    align-items: center;
    justify-content: space-around;
    box-sizing: border-box;
    width: 60%;

    .title_icon {
        width: 80rpx;
        height: 80rpx;
    }
}

.outer {
    width: 100%;
    height: 250rpx;
    box-sizing: border-box;

    .view_body {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
    }

    .scroll_body {
        // position: absolute;
        // top: 0;
        // left: 0;
        height: 382rpx;
    }

    .scroll_outer {
        // height: 800rpx;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;


        .top {
            padding: 56rpx;
        }

        .bottom {
            padding: 140rpx;
        }
    }

    .scroll_item {
        width: 200rpx;
        height: 50rpx;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
    }
}

.scroll_content {
    width: 180rpx;
    height: 48rpx;
    border-radius: 15rpx;
    // background-color: rgba(0, 0, 0, 0.3);
    box-shadow: 0px 0px 6px 0px rgba(0, 0, 0, 0.3);
    // position: absolute;
    position: relative;
    color: #000;
    transition: all 0.3s ease;
}

::v-deep .active_before2 {
    transform: translateY(52rpx) scale(0.6);
    opacity: 0.8;
    z-index: -2;
    position: relative;
}

::v-deep .active_before {
    /* transform: translateY(16rpx) scale(1) rotateX(-45deg); */
    transform: translateY(21rpx) scale(0.8);
    opacity: 0.8;
    z-index: -1;
    position: relative;
}

::v-deep .active_item {
    color: rgba(0, 0, 0, 1);
    font-weight: 600;
    background-color: rgba(255, 255, 255, 0.9);
    /* background-color: rgba(0, 0, 0, 0.3); */
    box-shadow: 0rpx 0rpx 6rpx 0rpx rgba(0, 0, 0, 0.3);
    /* 选中项放大并置于顶层 */
    transform: scale(1);
    opacity: 1;
    z-index: 10;
}

::v-deep .active_after {
    /* transform: translateY(-14rpx) scale(1) rotateX(45deg); */
    transform: translateY(-19rpx) scale(0.8);
    opacity: 0.8;
    z-index: -10;
    position: relative;
}



::v-deep .active_after2 {
    transform: translateY(-50rpx) scale(0.6);
    opacity: 0.8;
    z-index: -100;
    position: relative;
}

.f_c {
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
