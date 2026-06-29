<template>
  <view v-if="sourceIs" class="chu-box model-list-container" style="bottom: 0;">
    <view class="chu-inner">
      <view class="chu-content" @scroll="handleScroll">
        <view class="chu_row_wn" v-if="currentModelType === 'talk'">
          <view class="title" v-if="talkList.length > 0 || showAgentMode">
            <text>对话</text>
          </view>
          <view 
            v-if="showAgentMode"
            class="chu-row" 
            :class="{ 'chu-row_act': pitch === -1 }" 
            :style="{ animationDelay: '0s' }"
            @click="handleAgentModeClick">
            <view class="chu-row-left">
              <view class="image_logo">
                <image
                  src="/static/images/mian_label.png"
                  class="chu-icon"></image>
              </view>
              <view class="chu-text" style="margin-left: 18rpx;">
                Agent模式
              </view>
              <image src="/static/images/mian_label.png" class="chu-power" mode="widthFix">
              </image>
            </view>
            <view class="chu-row-right">
              <view v-if="pitch === -1" class="selected-icon">
                <image src="/static/images/selected_model.png" mode="widthFix" style="width:80rpx;height:80rpx;"></image>
              </view>
            </view>
          </view>
          <view 
            class="chu-row" 
            :class="{ 'chu-row_act': pitch === index }" 
            v-for="(item, index) in talkList" 
            :key="item.id"
            :style="{ animationDelay: `${(talkList.length - 1 - index) * 0.1}s` }"
            @click="pitchHandle(item, index)">
            <view class="chu-row-left">
              <view class="image_logo">
                <image
                  :src="item.img"
                  class="chu-icon"></image>
              </view>
              <view class="chu-text" style="margin-left: 18rpx;">
                {{ item.source }}
              </view>
              <image v-if="0 === index" src="/static/images/rankone.png" class="chu-power" mode="widthFix">
              </image>
              <image src="/static/images/mian_label.png" class="chu-power" mode="widthFix">
              </image>
              <image v-if="item.is_new == 1" src="/static/images/xtk_new.png" class="chu-power" mode="widthFix">
              </image>
            </view>
            <view class="chu-row-right">
              <view v-if="pitch === index" class="selected-icon">
                <image src="/static/images/selected_model.png" mode="widthFix" style="width:80rpx;height:80rpx;"></image>
              </view>
            </view>
          </view>
        </view>
        <view class="chu_row_dh" v-if="currentModelType === 'image'">
          <view class="title" v-if="imageList.length > 0">
            <text>图片</text>
          </view>
          <view 
            class="chu-row" 
            :class="{ 'chu-row_act': pitch === index }" 
            v-for="(item, index) in imageList" 
            :key="item.id"
            :style="{ animationDelay: `${(imageList.length - 1 - index) * 0.1}s` }"
            @click="pitchHandle(item, index)">
            <view class="chu-row-left">
              <view class="image_logo">
                <image
                  :src="item.img"
                  class="chu-icon"></image>
              </view>
              <view class="chu-text" style="margin-left: 18rpx;">
                {{ item.source }}
              </view>
              <image v-if="0 === index" src="/static/images/rankone.png" class="chu-power" mode="widthFix">
              </image>
              <image v-if="item.is_new == 1" src="/static/images/xtk_new.png" class="chu-power" mode="widthFix">
              </image>
            </view>
            <view class="chu-row-right">
              <view v-if="pitch === index" class="selected-icon">
                <image src="/static/images/selected_model.png" mode="widthFix" style="width:80rpx;height:80rpx;"></image>
              </view>
            </view>
          </view>
        </view>
        <view class="chu_row_tp" v-if="currentModelType === 'video'">
          <view class="title" v-if="videoList.length > 0">
            <text>视频</text>
          </view>
          <view 
            class="chu-row" 
            :class="{ 'chu-row_act': pitch === index }" 
            v-for="(item, index) in videoList" 
            :key="item.id"
            :style="{ animationDelay: `${(videoList.length - 1 - index) * 0.1}s` }"
            @click="pitchHandle(item, index)">
            <view class="chu-row-left">
              <view class="image_logo">
                <image
                  :src="item.img"
                  class="chu-icon"></image>
              </view>
              <view class="chu-text" style="margin-left: 18rpx;">
                {{ item.source }}
              </view>
              <image v-if="0 === index" src="/static/images/rankone.png" class="chu-power" mode="widthFix">
              </image>
              <image v-if="item.is_new == 1" src="/static/images/xtk_new.png" class="chu-power" mode="widthFix">
              </image>
            </view>
            <view class="chu-row-right">
              <view v-if="pitch === index" class="selected-icon">
                <image src="/static/images/selected_model.png" mode="widthFix" style="width:80rpx;height:80rpx;"></image>
              </view>
            </view>
          </view>
        </view>
        <view class="chu_row_sp" v-if="currentModelType === 'audio'">
          <view class="title" v-if="audioList.length > 0">
            <text>音频</text>
          </view>
          <view 
            class="chu-row" 
            :class="{ 'chu-row_act': pitch === index }" 
            v-for="(item, index) in audioList" 
            :key="item.id"
            :style="{ animationDelay: `${(audioList.length - 1 - index) * 0.1}s` }"
            @click="pitchHandle(item, index)">
            <view class="chu-row-left">
              <view class="image_logo">
                <image
                  :src="item.img"
                  class="chu-icon"></image>
              </view>
              <view class="chu-text" style="margin-left: 18rpx;">
                {{ item.source }}
              </view>
              <image v-if="0 === index" src="/static/images/rankone.png" class="chu-power" mode="widthFix">
              </image>
              <image v-if="item.is_new == 1" src="/static/images/xtk_new.png" class="chu-power" mode="widthFix">
              </image>
            </view>
            <view class="chu-row-right">
              <view v-if="pitch === index" class="selected-icon">
                <image src="/static/images/selected_model.png" mode="widthFix" style="width:80rpx;height:80rpx;"></image>
              </view>
            </view>
          </view>
        </view>
        <view class="chu_row_yp" v-if="currentModelType === 'videoa'">
          <view class="title" v-if="videoaList.length > 0">
            <text>数字人</text>
          </view>
          <view 
            class="chu-row" 
            :class="{ 'chu-row_act': pitch === index }" 
            v-for="(item, index) in videoaList" 
            :key="item.id"
            :style="{ animationDelay: `${(videoaList.length - 1 - index) * 0.1}s` }"
            @click="pitchHandle(item, index)">
            <view class="chu-row-left">
              <view class="image_logo">
                <image
                  :src="item.img"
                  class="chu-icon"></image>
              </view>
              <view class="chu-text" style="margin-left: 18rpx;">
                {{ item.source }}
              </view>
              <image v-if="0 === index" src="/static/images/rankone.png" class="chu-power" mode="widthFix">
              </image>
              <image v-if="item.is_new == 1" src="/static/images/xtk_new.png" class="chu-power" mode="widthFix">
              </image>
            </view>
            <view class="chu-row-right">
              <view v-if="pitch === index" class="selected-icon">
                <image src="/static/images/selected_model.png" mode="widthFix" style="width:80rpx;height:80rpx;"></image>
              </view>
            </view>
          </view>
        </view>
        <view class="chu_row_other" v-if="currentModelType === 'other'">
          <view class="title" v-if="otherList.length > 0">
            <text>全能</text>
          </view>
          <view 
            class="chu-row" 
            :class="{ 'chu-row_act': pitch === index }" 
            v-for="(item, index) in otherList" 
            :key="item.id"
            :style="{ animationDelay: `${(otherList.length - 1 - index) * 0.1}s` }"
            @click="pitchHandle(item, index)">
            <view class="chu-row-left">
              <view class="image_logo">
                <image
                  :src="item.img"
                  class="chu-icon"></image>
              </view>
              <view class="chu-text" style="margin-left: 18rpx;">
                {{ item.source }}
              </view>
              <image v-if="0 === index" src="/static/images/rankone.png" class="chu-power" mode="widthFix">
              </image>
              <image v-if="item.is_new == 1" src="/static/images/xtk_new.png" class="chu-power" mode="widthFix">
              </image>
            </view>
            <view class="chu-row-right">
              <view v-if="pitch === index" class="selected-icon">
                <image src="/static/images/selected_model.png" mode="widthFix" style="width:80rpx;height:80rpx;"></image>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelList: {
    type: Array,
    required: true,
  },
  pitch: {
    type: Number,
    default: -1,
  },
  sourceIs: {
    type: Boolean,
    default: false,
  },
  showModelConfigVal: Boolean,
  textareaHeight: Number,
  showAgentMode: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['pitch-handle', 'scroll', 'agent-mode-click'])

const bottomVal = ref('0')
const protoList = ref([])
const talkList = ref([])
const imageList = ref([])
const videoList = ref([])
const videoaList = ref([])
const audioList = ref([])
const otherList = ref([])
const imageEditList = ref([])
const currentModelType = ref('all')

const pitchHandle = (item, index) => {
  emit('pitch-handle', item, index);
}

const handleScroll = (event) => {
  emit('scroll', event);
}

const updateModelType = (type) => {
  currentModelType.value = type;
}

const handleAgentModeClick = () => {
  emit('agent-mode-click');
}

watch(() => props.modelList, (arr) => {
  const newProtoList = []
  for (let i = 0; i < arr.length; i++) {
    let item = Object.assign({ pitch: i }, arr[i])
    newProtoList.push(item)
  }
  protoList.value = newProtoList

  let newTalkList = []
  let newImageList = []
  let newVideoList = []
  let newVideoaList = []
  let newAudioList = []
  let newOtherList = []
  newProtoList.forEach(item => {
    if (item.type == 0) {
      newOtherList.push(item)
    }
    if (item.type == 1) {
      newTalkList.push(item)
    }
    if (item.type == 2) {
      newImageList.push(item)
    }
    if (item.type == 3) {
      newVideoList.push(item)
    }
    if (item.type == 4) {
      newAudioList.push(item)
    }
    if (item.type == 5) {
      newVideoaList.push(item)
    }
  })
  
  newTalkList.sort((a, b) => (b.is_top || 0) - (a.is_top || 0))
  newImageList.sort((a, b) => (b.is_top || 0) - (a.is_top || 0))
  newVideoList.sort((a, b) => (b.is_top || 0) - (a.is_top || 0))
  newVideoaList.sort((a, b) => (b.is_top || 0) - (a.is_top || 0))
  newAudioList.sort((a, b) => (b.is_top || 0) - (a.is_top || 0))
  newOtherList.sort((a, b) => (b.is_top || 0) - (a.is_top || 0))
  
  talkList.value = newTalkList
  imageList.value = newImageList
  videoList.value = newVideoList
  videoaList.value = newVideoaList
  audioList.value = newAudioList
  otherList.value = newOtherList
}, { immediate: true })
</script>

<style lang="scss" scoped>
.chu-box {
  width: calc(100% - 40rpx);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: absolute;
  color: rgb(0 0 0 / 0.4);
  font-family: AlimamaFangYuanTi;
  z-index: 1001;
}

.chu-box {
  z-index: 1001;
  align-items: flex-end;

  .chu-inner {
    width: 100%;
    padding: 0;
    border-radius: 15rpx;
    overflow: hidden;

    .chu-content {
      height: auto;
      background-color: transparent;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      border-radius: 15rpx;
      overflow-y: auto;
      padding: 10rpx 0 0;
      margin-bottom: -5rpx;

      .title {
        width: 100%;
        height: 40rpx;
        box-sizing: border-box;
        align-items: center;
        justify-content: center;
        font-size: 24rpx;
        font-weight: 600;
        line-height: normal;
        color: #3D3D3D;
        margin-bottom: 10rpx;
        display: none;
      }

      .chu-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 80rpx;
        border-radius: 15rpx;
        background: #FFF;
        box-sizing: border-box;
        border: 4rpx solid #B9B9B9;
        margin: 5rpx 0;
        padding: 0 15rpx;
        opacity: 0;
        transform: translateY(60rpx);
        animation: slideUp 0.8s ease forwards;

        .chu-row-left {
          display: flex;
          align-items: center;
          flex: 1;

          .chu-icon {
            width: 40rpx;
            height: 40rpx;
          }

          .chu-text {
            font-size: 28rpx;
            margin-left: 10rpx;
          }
        }

        .chu-row-right {
          display: flex;
          justify-content: center;
          align-items: center;

          .chu-power {
            width: 34rpx;
            height: 20rpx;
            margin-right: 10rpx;
            border-radius: 15rpx;
          }

          .selected-icon {
            width: 32rpx;
            height: 32rpx;
            border-radius: 50%;
            background-color: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-left: 10rpx;

            .selected-checkmark {
              width: 16rpx;
              height: 16rpx;
              background-color: #FFF;
              border-radius: 2rpx;
              position: relative;

              &::after {
                content: '';
                position: absolute;
                width: 10rpx;
                height: 6rpx;
                border-left: 2rpx solid #000;
                border-bottom: 2rpx solid #000;
                transform: rotate(-45deg);
                left: 2rpx;
                top: 2rpx;
              }
            }
          }
        }
      }

      .chu-row_act {
        border-color: #000;
        box-shadow: 0 0 10rpx rgb(0 0 0 / 0.1);

        .chu-text {
          font-weight: bold;
        }
      }
    }
  }
}

.chu-power {
  width: 40rpx;
  height: 40rpx;
  display: block;
  margin-left: 10rpx;
}

.image_logo {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-left: 10rpx;
  margin-top: 0;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(60rpx);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
