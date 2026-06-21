<template>
    <view style="width: 100%;box-sizing: border-box;">
        <view class="selecter_body scroll-x" v-if="type == 'scale'">
            <view style="width: 100%;overflow-x: auto;">
                <view class="image_item" :class="{ 'active': value === index, 'disabled': desc && desc.includes('水印') && isVip === 0 }" v-for="(item, index) in options" :key="index" @click="!(desc && desc.includes('水印') && isVip === 0) && select(item, index)">
                    <view :class="item ? getItemIconView(item) : ''" :style="{ borderColor: value === index ? '#0105ff' : '#000000' }"></view>
                    <text class="text" :style="{ color: value === index ? '#0105ff' : '#000000' }">{{ item }}</text>
                </view>
            </view>
        </view>

        <view class="selecter_body scroll-x" v-else-if="type == 'video'">
            <view style="width: 100%;overflow-x: auto;">
                <view class="video_item" :class="{ 'active': value === '480P' }" @click="selectVideo('480P')">
                    <text class="text" :style="{ color: value === '480P' ? '#0105ff' : '#000000' }">标清 480p</text>
                    <text class="small">（640×480）</text>
                </view>
                <view class="video_item" :class="{ 'active': value === '720P' }" @click="selectVideo('720P')">
                    <text class="text" :style="{ color: value === '720P' ? '#0105ff' : '#000000' }">超清 720p</text>
                    <text class="small">（1280×720）</text>
                </view>
                <view class="video_item" :class="{ 'active': value === '1080P' }" @click="selectVideo('1080P')">
                    <text class="text" :style="{ color: value === '1080P' ? '#0105ff' : '#000000' }">高清 1080p</text>
                    <text class="small">（1920×1080）</text>
                </view>
            </view>
        </view>
        <view class="selecter_body scroll-x" v-else-if="type == 'voice'">
            <view style="width: 100%;overflow-x: auto;">
                <view class="s_i_n" :class="{ 'active': value === index }" v-for="(item, index) in options" :key="index" @click="select(item, index)">
                    <text class="text" :style="{ color: value === index ? '#0105ff' : '#000000' }">{{ item.name }}</text>
                </view>
            </view>
        </view>
        <view class="selecter_body scroll-x" v-else-if="type == 'ratio'">
            <view style="width: 100%;overflow-x: auto;">
                <view v-if="!selectedSizeIndex">
                    <view class="s_i_n" :class="{ 'active': selectedSizeIndex === index }" v-for="(item, index) in options" :key="index" @click="selectSize(item, index)">
                        <text class="text" :style="{ color: selectedSizeIndex === index ? '#0105ff' : '#000000' }">{{ Object.keys(item)[0] }}</text>
                    </view>
                </view>
                <view v-else>
                    <view class="back_button" @click="resetRatioSelection">
                        <text class="text">← 返回</text>
                    </view>
                    <view class="size_label">
                        <text class="text">{{ Object.keys(selectedSize)[0] }}</text>
                    </view>
                    <view class="s_i_n" :class="{ 'active': value === index }" v-for="(item, index) in getCurrentRatioOptions()" :key="index" @click="selectRatio(item, index)">
                        <text class="text" :style="{ color: value === index ? '#0105ff' : '#000000' }">{{ Object.keys(item)[0] }} ({{ Object.values(item)[0] }})</text>
                    </view>
                </view>
            </view>
            <view v-if="selectedRatio" class="selected_value">
                <text class="text">已选择: {{ Object.keys(selectedSize)[0] }} - {{ Object.keys(selectedRatio)[0] }} ({{ Object.values(selectedRatio)[0] }})</text>
            </view>
        </view>
        <view class="selecter_body scroll-x" v-else>
            <view style="width: 100%;overflow-x: auto;">
                <view class="s_i_n" :class="{ 'active': value === index }" v-for="(item, index) in options" :key="index" @click="select(item, index)">
                    <text class="text" :style="{ color: value === index ? '#0105ff' : '#000000' }">{{ isObject(item) ? item.desc : item }}</text>
                </view>
            </view>
        </view>
    </view>
</template>
<script setup>
import { ref, watch, onMounted } from 'vue';

const props = defineProps({
    type: String,
    options: Array,
    defaultVal: String,
    isVip: {
        type: Number,
        default: 0
    },
    desc: String
});

const emit = defineEmits(['change']);

const value = ref('');
const selectedSizeIndex = ref(null);
const selectedSize = ref(null);
const selectedRatio = ref(null);

onMounted(() => {
    if (props.type === 'ratio') {
        return;
    }
    
    if (props.options && props.options.length > 0 && value.value === '') {
        value.value = 0;
        emit('change', isObject(props.options[0]) ? props.options[0].value : props.options[0], 0);
    }
});

watch(
    () => props.defaultVal,
    (n) => {
        if (n) {
            if (props.type === 'ratio') {
                return;
            }
            
            for (let i = 0; i < props.options.length; i++) {
                if (props.options[i] == n) {
                    value.value = i;
                    break;
                }
            }
        }
    },
    { immediate: true }
);

watch(
    () => props.options,
    (newOptions) => {
        if (props.type === 'ratio') {
            return;
        }
        
        if (newOptions && newOptions.length > 0 && value.value === '') {
            value.value = 0;
            emit('change', isObject(newOptions[0]) ? newOptions[0].value : newOptions[0], 0);
        }
    },
    { immediate: true, deep: true }
);

function isObject(val) {
    return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function selectSize(item, index) {
    selectedSizeIndex.value = index;
    selectedSize.value = item;
    value.value = '';
    selectedRatio.value = null;
}

function selectRatio(item, index) {
    value.value = index;
    selectedRatio.value = item;
    const sizeKey = Object.keys(selectedSize.value)[0];
    const ratioKey = Object.keys(item)[0];
    const resolution = item[ratioKey];
    
    emit('change', {
        size: sizeKey,
        ratio: ratioKey,
        resolution: resolution,
        fullData: item
    }, index);
}

function getCurrentRatioOptions() {
    if (!selectedSize.value) return [];
    const sizeKey = Object.keys(selectedSize.value)[0];
    return selectedSize.value[sizeKey];
}

function resetRatioSelection() {
    selectedSizeIndex.value = null;
    selectedSize.value = null;
    selectedRatio.value = null;
    value.value = '';
}

function selectVideo(val) {
    try {
        value.value = val;
        emit('change', val);
    } catch (error) {
        emit('change', val);
    }
}

function select(item, index) {
    if (value.value === index) {
        value.value = '';
        emit('change', '', 0);
    } else {
        value.value = index;
        emit('change', isObject(item) ? item.value : item, index);
    }
}

function getItemIconView(str) {
    if (!str) {
        return '';
    }
    if (str == '1:1') {
        return 'aa';
    }
    let arr = str.split(":");
    if (arr[0] < arr[1]) {
        return 'bc';
    }
    if (arr[0] > arr[1]) {
        return 'cb';
    }
}
</script>
<style lang="scss" scoped>
.selecter_body {
    width: 100%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    white-space: nowrap;
    
    &.scroll-x {
        justify-content: space-between;
    }

    > view {
        display: flex;
        align-items: center;
        white-space: nowrap;
    }

    .image_item {
        min-width: auto;
        width: auto;
        padding: 0 14rpx;
        height: 50rpx;
        border-radius: 10rpx;
        background-color: rgba(218, 218, 218, 0.37);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1rpx solid;
        margin-right: 21rpx;
        flex-shrink: 0;

        .aa {
            width: 33rpx;
            height: 33rpx;
            border: 1rpx solid;
            margin-right: 16rpx;
            border-radius: 10rpx;
        }

        .bc {
            width: 26rpx;
            height: 35rpx;
            border: 1rpx solid;
            margin-right: 16rpx;
            border-radius: 10rpx;
        }

        .cb {
            width: 39rpx;
            height: 29rpx;
            border: 1rpx solid;
            margin-right: 16rpx;
            border-radius: 10rpx;
        }

        .ef {
            width: 39rpx;
            height: 26rpx;
            border: 1rpx solid;
            margin-right: 16rpx;
            border-radius: 10rpx;
        }

        .fe {
            width: 18rpx;
            height: 39rpx;
            border: 1rpx solid;
            margin-right: 16rpx;
            border-radius: 10rpx;
        }
    }

    .video_item {
        min-width: auto;
        width: auto;
        padding: 0 21rpx;
        height: 65rpx;
        border-radius: 10rpx;
        background: rgba(218, 218, 218, 0.37);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 21rpx;
        border: 1rpx solid;
        flex-shrink: 0;
    }

    .s_i_n {
        border-radius: 10rpx;
        background-color: rgba(218, 218, 218, 0.37);
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: auto;
        width: auto;
        padding: 0 14rpx;
        height: 50rpx;
        border: 1rpx solid;
        box-sizing: border-box;
        margin-right: 21rpx;
        flex-shrink: 0;
    }

    .text {
        font-family: Source Han Sans !important;
        font-size: 29rpx;
        font-weight: normal;
        color: #000000;
        line-height: 50rpx;
    }

    .small {
        font-family: Source Han Sans !important;
        font-size: 21rpx;
        font-weight: normal;
        color: #C4C4C4 !important;
        margin-top: 3rpx;
        margin-left: 5rpx;
    }
    
    .back_button {
        min-width: auto;
        width: auto;
        padding: 0 21rpx;
        height: 50rpx;
        border-radius: 10rpx;
        background-color: rgba(218, 218, 218, 0.37);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 21rpx;
        border: 1rpx solid #999;
        flex-shrink: 0;
        
        .text {
            font-family: Source Han Sans !important;
            font-size: 29rpx;
            font-weight: normal;
            color: #666;
            line-height: 50rpx;
        }
    }
    
    .size_label {
        min-width: auto;
        width: auto;
        padding: 0 21rpx;
        height: 50rpx;
        border-radius: 10rpx;
        background-color: rgba(81, 141, 253, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 21rpx;
        border: 1rpx solid #518dfd;
        flex-shrink: 0;
        
        .text {
            font-family: Source Han Sans !important;
            font-size: 29rpx;
            font-weight: bold;
            color: #518dfd;
            line-height: 50rpx;
        }
    }
    
    .selected_value {
        width: 100%;
        padding: 13rpx 21rpx;
        margin-top: 21rpx;
        border-radius: 10rpx;
        background-color: rgba(81, 141, 253, 0.1);
        border: 1rpx solid #518dfd;
        box-sizing: border-box;
        
        .text {
            font-family: Source Han Sans !important;
            font-size: 31rpx;
            font-weight: bold;
            color: #518dfd;
            line-height: 1.5;
        }
    }
}

.active {
    backdrop-filter: blur(10rpx);
    border-color: #518dfd !important;
    background-color: #d9e6fd !important;
}

.disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
}
</style>