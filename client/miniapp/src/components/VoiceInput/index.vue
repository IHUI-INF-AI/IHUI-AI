<template>
	<view class="voice-input-container">
		<!-- 录音时的全屏覆盖层 -->
		<!-- <view v-if="isRecording" class="recording-overlay">
			<view class="recording-indicator">
				<image class="recording-icon" src="/static/images/Vectors.png" mode="aspectFit" />
			</view>
		</view> -->

		<!-- 新增：交互遮罩层，用来分离点击和长按行为 -->
		<view 
			class="input-mask"
			@tap="handleMaskTap"
			@touchstart="handleMaskTouchStart"
			@touchend="handleMaskTouchEnd"
			@touchcancel="handleMaskTouchEnd"
			v-if="!showKeyboard || isAuthorizingVoice"
		></view>

		<view class="input-area">
			<view class="search-box" :class="{ 'recording': isRecording }">
        <view class="clearIcon" v-if="clearShow" @click.stop="clearSearch" style="padding: 10rpx 0 10rpx 10rpx;"><image src="/static/images/default/home/clear_icon.svg"></image></view>
				<image @click="toggleInput" class="search-icon" :src="!toggleInputBoll ? '/static/images/jianpan.png':'/static/images/search-hua.png'" mode="aspectFit" />
				<input ref="searchInput" class="search-input"
					style="width: calc(100vw - 200rpx);height: 80rpx ;padding: 0 0rpx;background: transparent;flex: none;" type="text"
					v-model="prompt" @input="write" :disabled="loading" :focus="showKeyboard && !isAuthorizingVoice" placeholder="请输入你想要的智能体" :placeholder-style="placeholderStyle"
					@confirm="handleSendMessage" @blur="handleInputBlur" v-if="!toggleInputBoll" />
				
				<view class="voice-bar-animation" v-show="toggleInputBoll || !showKeyboard && isAuthorizingVoice"
						@mousedown="handleMaskTouchStart" 
						@mouseup="handleMaskTouchEnd" 
						@mouseleave="handleMaskTouchEnd"
						@touchstart="handleMaskTouchStart"
						@touchend="handleMaskTouchEnd"
						@touchcancel="handleMaskTouchEnd">
						<view class="line" :class="toggleInputBoll ? 'line' + (n + 1) : '' " v-for="n in 50" :key="n"></view>
					</view>
				<view class="search-right" v-if="false">
					<view @click="toggleImagePopup" class="search-box2">
						<image
							class="search-box2-img" 
							:src="isShow 
								? '/static/images/chacha.png' 
								: '/static/images/search-add.png'"
							mode="aspectFit"
						/>
					</view>
					<view class="search-box3">
						<image class="search-box3-img" src="/static/images/search-shang.png"
							mode=""></image>
					</view>
				</view>
			</view>
		</view>

		<!-- 重新定位的图像弹出层 -->
		<view class="right-side-popup" v-if="showImagePopup">
			<view class="image-popup-content">
				<view class="popup-item" @click="handleIconClick('camera')">
					<image class="popup-image" src="/static/images/xiangji.png"></image>
				</view>
				<view class="popup-item" @click="handleIconClick('album')">
					<image class="popup-image" src="/static/images/xiangce.png"></image>
				</view>
				<view class="popup-item" @click="handleIconClick('file')">
					<image class="popup-image" src="/static/images/wenjian.png"></image>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { fetchAudioText } from '@/service/login.js';

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['sendMessage', 'imageSelected']);

const prompt = ref('');
const recordManager = ref(null);
const pluginReady = ref(false);
const pluginPreloaded = ref(false);
const longPressTimer = ref(null);
const longPressDelay = ref(500);
const placeholderStyle = ref("color:#999999;font-size:28rpx;");
const showImagePopup = ref(false);
const popupStyle = ref({});
const isShow = ref(false);
const isAuthorizingVoice = ref(false);
const isInputVisible = ref(true);
const isVoiceAnimationActive = ref(false);
const isVoiceAnimationActiveStart = ref(false);
const modelName = ref('混元大模型');
const HomePagedata = ref({});
const isShowIcon = ref(false);
const timeout = ref(null);
const isLongPress = ref(false);
const isRecording = ref(false);
const newRecorder = ref(null);
const showKeyboard = ref(false);
const clearShow = ref(false);
const toggleInputBoll = ref(false);

function write() {
  console.log(prompt.value);
  clearShow.value = prompt.value.length > 0;
}

function clearSearch() {
  console.log(prompt.value);
  prompt.value = '';
  clearShow.value = false;
  emit('sendMessage', prompt.value);
}

function handleMaskTap(e) {
  if (!isAuthorizingVoice.value && !isRecording.value) {
    showKeyboard.value = true;
  }
}

function handleMaskTouchStart(e) {
  if (isRecording.value || isAuthorizingVoice.value) {
    return;
  }
  
  longPressTimer.value = setTimeout(() => {
    longPressTimer.value = null;
    startVoiceRecognition();
  }, longPressDelay.value);
}

function handleMaskTouchEnd(e) {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
    longPressTimer.value = null;
  } else if (isRecording.value) {
    stopVoiceRecognition();
  }
}

function handleInputBlur() {
  showKeyboard.value = false;
}

function toggleImagePopup() {
  if (showImagePopup.value) {
    showImagePopup.value = false;
    isShow.value = false;
    return;
  }
  isShow.value = true;
  showImagePopup.value = true;
}

function handleSendMessage() {
  console.log('handleSendMessage');
  emit('sendMessage', prompt.value);
  showKeyboard.value = false;
}

async function preloadVoicePlugin() {
  // #ifdef MP-WEIXIN
  if (pluginPreloaded.value) {
    if (recordManager.value) setupRecordCallbacks();
    return true;
  }
  try {
    const plugin = requirePlugin("WechatSI");
    if (!plugin || typeof plugin.getRecordRecognitionManager !== 'function') {
      pluginReady.value = false;
      return false;
    }
    recordManager.value = plugin.getRecordRecognitionManager();
    setupRecordCallbacks();
    pluginPreloaded.value = true;
    pluginReady.value = true;
    return true;
  } catch (error) {
    pluginReady.value = false;
    return false;
  }
  // #endif
  // #ifndef MP-WEIXIN
  return false;
  // #endif
}

function setupRecordCallbacks() {
  if (!recordManager.value) return;
  recordManager.value.onStop = (res) => {
    isRecording.value = false;
    showKeyboard.value = false;
    if (res.result && res.result.trim()) {
      prompt.value = res.result;
      write();
      handleSendMessage();
    }
  };
  recordManager.value.onStart = (res) => {
    isRecording.value = true;
  };
  recordManager.value.onError = (res) => {
    isRecording.value = false;
    showKeyboard.value = false;
  };
}

function startActualRecord() {
  showKeyboard.value = false;
  toggleInputBoll.value = true;
  const dir = '_doc/audio/';
  const filename = dir + Date.now() + '.mp3';
  startRecordingNew(filename);
}

function startRecordingNew(filename) {
  // #ifdef APP-PLUS
  if (typeof plus === 'undefined' || !plus.audio) return;
  newRecorder.value = plus.audio.getRecorder();
  const options = { filename, format: 'mp3', samplerate: 8000, bitrate: 12200, channels: 1 };
  newRecorder.value.record(options, (path) => {
    uni.uploadFile({
      url: 'https://bsm.aizhs.top/prod-api/file/upload',
      filePath: path,
      name: 'file',
      success: async (res) => {
        try {
          const data = JSON.parse(res.data || '{}');
          const url = data?.data?.url;
          if (!url || (data.code !== 200 && data.code !== '200')) {
            uni.showToast({ title: '上传失败', icon: 'none' });
            resetVoiceState();
            return;
          }
          const audioRes = await fetchAudioText(url);
          const result = audioRes?.data?.data?.result || '';
          if (result) {
            prompt.value = result;
            write();
            handleSendMessage();
            uni.showToast({ title: '识别成功', icon: 'success' });
          } else {
            uni.showToast({ title: '请重说', icon: 'none' });
          }
        } catch (e) {
          uni.showToast({ title: '识别失败', icon: 'none' });
        }
        resetVoiceState();
      },
      fail: () => {
        uni.showToast({ title: '上传失败', icon: 'none' });
        resetVoiceState();
      }
    });
  }, (err) => {
    uni.showToast({ title: '录音失败', icon: 'none' });
    resetVoiceState();
  });
  // #endif
}

function resetVoiceState() {
  toggleInputBoll.value = false;
  isRecording.value = false;
  isLongPress.value = false;
  showKeyboard.value = false;
}

async function startVoiceRecognition() {
  if (isRecording.value) return;
  showKeyboard.value = false;
  toggleInputBoll.value = true;
  // #ifdef APP-PLUS
  startActualRecord();
  return;
  // #endif
  // #ifdef MP-WEIXIN
  try {
    const ok = await preloadVoicePlugin();
    if (!ok) {
      uni.showToast({ title: '语音识别暂时不可用', icon: 'none' });
      toggleInputBoll.value = false;
      return;
    }
    const authStatus = await getRecordAuthStatus();
    if (authStatus === 'authorized') {
      await startRecordingFunc();
    } else if (authStatus === 'denied') {
      isAuthorizingVoice.value = true;
      showGoToSettingsTip();
      isAuthorizingVoice.value = false;
    } else {
      isAuthorizingVoice.value = true;
      const granted = await requestRecordPermission();
      isAuthorizingVoice.value = false;
      if (granted) {
        uni.showToast({ title: '授权成功，请再次长按使用语音', icon: 'none' });
      }
    }
  } catch (error) {
    isAuthorizingVoice.value = false;
  }
  // #endif
  // #ifndef MP-WEIXIN
  uni.showToast({ title: '请在微信小程序内使用语音', icon: 'none' });
  toggleInputBoll.value = false;
  // #endif
}

function getRecordAuthStatus() {
  return new Promise((resolve) => {
    uni.getSetting({
      success: (res) => {
        if (res.authSetting['scope.record'] === true) {
          resolve('authorized');
        } else if (res.authSetting['scope.record'] === false) {
          resolve('denied');
        } else {
          resolve('notDetermined');
        }
      },
      fail: () => resolve('unknown')
    });
  });
}

function requestRecordPermission() {
  return new Promise((resolve) => {
    uni.authorize({
      scope: 'scope.record',
      success: () => {
        resolve(true);
      },
      fail: () => {
        resolve(false);
      }
    });
  });
}

function showGoToSettingsTip() {
  uni.showModal({
    title: '需要录音权限',
    content: '语音识别功能需要录音权限，请前往设置页面开启',
    confirmText: '去设置',
    cancelText: '取消',
    success: (modalRes) => {
      if (modalRes.confirm) {
        uni.openSetting({
          success: (settingRes) => {
            if (settingRes.authSetting['scope.record']) {
              uni.showToast({
                title: '授权成功，请重新长按',
                icon: 'none'
              });
            }
          }
        });
      }
    }
  });
}

function stopVoiceRecognition() {
  toggleInputBoll.value = false;
  // #ifdef APP-PLUS
  if (newRecorder.value) {
    try { newRecorder.value.stop(); } catch (e) {}
    newRecorder.value = null;
  }
  resetVoiceState();
  return;
  // #endif
  // #ifdef MP-WEIXIN
  try {
    if (recordManager.value && isRecording.value) {
      recordManager.value.stop();
    }
  } catch (e) {}
  isRecording.value = false;
  showKeyboard.value = false;
  // #endif
}

async function startRecordingFunc() {
  try {
    isRecording.value = true;
    if (recordManager.value) {
      recordManager.value.start({
        duration: 60000,
        lang: "zh_CN"
      });
    } else {
      isRecording.value = false;
      throw new Error('录音管理器未初始化');
    }
  } catch (error) {
    isRecording.value = false;
    uni.showToast({
      title: error.message || '语音识别暂时不可用',
      icon: 'none',
      duration: 2000
    });
    throw error;
  }
}

function handleIconClick(icon) {
  showImagePopup.value = false;
  isShow.value = false;
  switch(icon) {
    case 'camera':
      uni.chooseImage({
        count: 1,
        sourceType: ['camera'],
        success: (res) => {
          console.log('相机选择的图片:', res.tempFilePaths);
          emit('imageSelected', {
            type: 'camera',
            path: res.tempFilePaths[0]
          });
        }
      });
      break;
    case 'album':
      uni.chooseImage({
        count: 1,
        sourceType: ['album'],
        success: (res) => {
          console.log('相册选择的图片:', res.tempFilePaths);
          emit('imageSelected', {
            type: 'album',
            path: res.tempFilePaths[0]
          });
        }
      });
      break;
    case 'file':
      uni.showToast({
        title: '文件功能开发中',
        icon: 'none'
      });
      break;
  }
}

function toggleInput() {
  toggleInputBoll.value = !toggleInputBoll.value;
}

onMounted(() => {
  nextTick(() => {
    preloadVoicePlugin();
  });
});

onBeforeUnmount(() => {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value);
  }
});
</script>

<style lang="scss">
	.voice-input-container {
		width: 100%;
		box-sizing: border-box;
		position: relative;
	}

	/* 新增：遮罩层样式 */
	.input-mask {
		position: absolute;
		inset: 0 100rpx 0 70rpx;
		z-index: 10;
		background-color: transparent;
	}

	.recording-overlay {
		position: fixed;
		inset: 0;
		background-color: rgb(0 0 0 / 0.5);
		z-index: 9999;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.recording-indicator {
		display: flex;
		justify-content: center;
		align-items: center;
		animation: recordingPulse 1.5s ease-in-out infinite;
	}

	.recording-icon {
		width: 80vw;
		height: 80vw;
		max-width: 600rpx;
		max-height: 600rpx;
	}

	@keyframes recordingPulse {
		0% {
			transform: scale(1);
			opacity: 0.8;
		}

		50% {
			transform: scale(1.1);
			opacity: 1;
		}

		100% {
			transform: scale(1);
			opacity: 0.8;
		}
	}

	.input-area {
		// padding: 20rpx;
    width: 105%;
    margin-left: -20rpx;
		display: flex;
		align-items: center;
		gap: 20rpx;

		/* box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05); */
	}

	.search-box {
    position: relative;
		display: flex;
		align-items: center;
		width: 100%;
		background-image: url('/static/images/inputBg.png');
		background-size: 100% 100%;
		background-repeat: no-repeat;
		border-radius: 16px;
		padding: 0 0 0 40rpx;
		height: 110rpx;
		box-sizing: border-box;
		transition: all 0.3s ease;

    .clearIcon {
      position: absolute;
      right: 40rpx;
      z-index: 100;
      width: 35rpx;
      height: 40rpx;

      // background: #ccc;
      border-radius: 50%;
      display: flex;
      flex-direction: row;
      place-content: center center;

      img {
        width: 100%;
        height: 100%;
      }
    }

		&.recording {
			background-color: rgb(255 0 0 / 0.1);
			transform: scale(1.02);
			box-shadow: 0 0 20rpx rgb(255 0 0 / 0.3);
		}
	}

	.search-boxa {
		display: flex;
		align-items: center;
		width: 100%;
		background-image: url('/static/images/InputBack.png');
		background-size: 100% 100%;
		background-repeat: no-repeat;
		border-radius: 16px;
		padding: 0 0 0 40rpx;
		height: 110rpx;
		box-sizing: border-box;
		transition: all 0.3s ease;

		&.recording {
			background-color: rgb(255 0 0 / 0.1);
			transform: scale(1.02);
			box-shadow: 0 0 20rpx rgb(255 0 0 / 0.3);
		}
	}

	.search-icon {
		width: 40rpx;
		height: 40rpx;
		margin-right: 16rpx;
	}

	.search-input {
		flex: 1;
		border: none;
		background: transparent;
		font-size: 30rpx;
		color: rgb(0 0 0 / 0.6) !important;
		font-weight: 900;
		font-family: SimHei, "黑体", "Microsoft YaHei", "微软雅黑", sans-serif;
		outline: none;
	}

	.search-right {
		width: 119rpx;
		height: 60rpx;
		margin-right: 24rpx;
		border-radius: 0 26px 26px 0;
		background: linear-gradient(111deg, rgb(205 208 255 / 0.3) 3%, rgb(253 255 225 / 0.3) 104%);
		box-sizing: border-box;
		border: 2px solid rgb(255 255 255 / 0.2);
		backdrop-filter: blur(15px);
		box-shadow: 0 0 6px 0 rgb(0 0 0 / 0.3);
		display: flex;
		justify-content: space-around;
		align-items: center;
	}

	.search-box2 {
		width: 35rpx;
		height: 35rpx;
	}

	.search-box2-img {
		width: 35rpx;
		height: 35rpx;
	}

	.search-box3 {
		width: 35rpx;
		height: 19.83rpx;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.search-box3-img {
		width: 35rpx;
		height: 19.83rpx;
	}

	.right-side-popup {
		position: absolute;
		z-index: 1001;
		background-color: white;
		border-radius: 30rpx;
		padding: 35rpx;
		box-sizing: border-box;
		box-shadow: 0 0 20rpx rgb(0 0 0 / 0.18);
		animation: fadeIn 0.2s ease-out;
		top: 120rpx;
		right: 30rpx;
		width: 520rpx;
	}

	@keyframes fadeIn {
		from { opacity: 0; transform: scale(0.95); }
		to { opacity: 1; transform: scale(1); }
	}

	.image-popup-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.popup-item {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.popup-image {
		width: 150rpx;
		height: 150rpx;
	}
	
	.popup-text {
		font-size: 26rpx;
		color: #333;
		margin-top: 8rpx;
	}




	.voice-bar-animation {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  width: 100%;
  height: 68rpx;
  flex: 1;
}

.bar {
  width: 2rpx;
  height: 2rpx; /* 不同的高度 */
  background-color: #007AFF;
}

.bar_ani {
  animation: bounce 1s infinite ease-in-out;
  animation-delay: calc(0.1s * var(--i));
}

@keyframes bounce {
  0%, 100% {
    height: 2rpx;
  }

  50% {
    height: calc(20px + 20px * var(--i) / 15);
  }
}



.input-area-back{
	background: linear-gradient(239deg, #D19EFF 6%, rgb(255 242 0 / 0.3) 32%, rgb(146 146 146 / 0.3) 52%, rgb(255 242 0 / 0.3) 73%, #CD96FF 93%);
	padding: 2rpx;
	border-radius: 30rpx;
	overflow: hidden;
	width: 100%;
}



.hold {
  width: 400px;
  height: 75px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.line {
  height: 6rpx;
  width: 6rpx;
  background-color: #000;
  border-radius: 5px;
  transition: all 1s;
}

.line1 {
  left: 8px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 0.25s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line2 {
  left: 16px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 0.5s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line3 {
  left: 24px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 0.75s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line4 {
  left: 32px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 1s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line5 {
  left: 40px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 1.25s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line6 {
  left: 48px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 1.5s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line7 {
  left: 56px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 1.75s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line8 {
  left: 64px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 2s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line9 {
  left: 72px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 2.25s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line10 {
  left: 80px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 2.5s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line11 {
  left: 88px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 2.75s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line12 {
  left: 96px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 3s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line13 {
  left: 104px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 3.25s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line14 {
  left: 112px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 3.5s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line15 {
  left: 120px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 3.75s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line16 {
  left: 128px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 4s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line17 {
  left: 136px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 4.25s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line18 {
  left: 144px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 4.5s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line19 {
  left: 152px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 4.75s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line20 {
  left: 160px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 5s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line21 {
  left: 168px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 5.25s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line22 {
  left: 176px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 5.5s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line23 {
  left: 184px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 5.75s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line24 {
  left: 192px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 6s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line25 {
  left: 200px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 6.25s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line26 {
  left: 208px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 6.5s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line27 {
  left: 216px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 6.75s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line28 {
  left: 224px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 7s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line29 {
  left: 232px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 7.25s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line30 {
  left: 240px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 7.5s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line31 {
  left: 248px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 7.75s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line32 {
  left: 256px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 8s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line33 {
  left: 264px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 8.25s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line34 {
  left: 272px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 8.5s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line35 {
  left: 280px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 8.75s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line36 {
  left: 288px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 9s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line37 {
  left: 296px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 9.25s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line38 {
  left: 304px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 9.5s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line39 {
  left: 312px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 9.75s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line40 {
  left: 320px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 10s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line41 {
  left: 328px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 10.25s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line42 {
  left: 336px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 10.5s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line43 {
  left: 344px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 10.75s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line44 {
  left: 352px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 11s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line45 {
  left: 360px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 11.25s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line46 {
  left: 368px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 11.5s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line47 {
  left: 376px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 11.75s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line48 {
  left: 384px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 12s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line49 {
  left: 392px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 12.25s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.line50 {
  left: 400px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 12.5s;
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

@keyframes move {
  0% {
    top: 0;
    height: 65rpx;
  }

  100% {
    top: 15rpx;
    height: 25rpx;
  }
}

.page_agent_can{
	flex: none;
	width: 100%;
	border-top: 1px solid #D8D8D8;
}

.page_agent_list{
	display: flex;
	padding: 5rpx 0;
	justify-content: space-between;
}

.page_can_tit{
	color: #000;
	min-width: 5em;
	line-height: 40rpx;
	margin-right: 10rpx;
	font-family: AlimamaFangYuanTi !important;
	font-size: 20rpx;
}

.page_can_con{
	
}

.page_can_con input.page_can_input{
	background-color: rgb(218 218 218 / 0.37);
	height: 40rpx;
	border-radius: 8rpx;
	font-size: 22rpx;
	width: 50vw;
	font-family: AlimamaFangYuanTi !important;
}

textarea.search-input {
  -webkit-appearance: none; /* 清除iOS默认样式 */
  border-radius: 0; /* 清除圆角 */
  background-color: transparent; /* 背景透明 */
  border: none; /* 去掉边框 */
  outline: none; /* 去掉聚焦时的外边框 */
  resize: none; /* 禁止调整大小 */
  padding: 0; /* 去掉内边距 */
  margin: 0; /* 去掉外边距 */
  box-shadow: none; /* 去掉阴影 */
  -webkit-box-shadow: none; /* 去掉iOS阴影 */
}

</style> 