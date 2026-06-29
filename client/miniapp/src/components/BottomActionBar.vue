<template>
  <view>
    <view v-if="showModel" class="button-group-box" :style="{ bottom: isShowIcon ? '432rpx' : '262rpx' }">
      <view class="button-group-box-inner" style="width: 50%;">已默认自动切换深度思考</view>
      <view v-if="!isIndex" class="button-group-box-inner" style="color: #5a85ff;font-weight: bold;" @click="handleModelClick"><text style="display: inline-block;float: left;">已选模型:</text><text style="display: block;overflow: hidden;white-space: nowrap;text-overflow: ellipsis;">{{ modelName }}</text></view>
      <view v-else class="button-group-box-inner" style="color: #5a85ff;font-weight: bold;" @click="handleModelClick"><text style="display: inline-block;float: left;">已选模型:</text><text style="display: block;overflow: hidden;white-space: nowrap;text-overflow: ellipsis;">Agent模式</text></view>
    </view>
    <ToggleButtonGroup
      :isShowIcon="isShowIcon"
      :imgsList="imgsList"
      @toggle-super-agent="toggleSuperAgent"
      @toggle-super-agentfu="toggleSuperAgentfu"
      @toggle-mcp="toggleMCP"
      @toggle-knowledge-base="toggleKnowledgeBase"
      @toggle-permanent-memory="togglePermanentMemory"
      ref="toggleBut"
      :pageAgentVariables="pageAgentVariables"
    />
    <InputArea
      ref="inputArea"
      :modelName="modelName"
      :modelNameEN="modelNameEN"
      :isShowIcon="isShowIcon"
      :isVoiceAnimationActive="isVoiceAnimationActive"
      :isVoiceInput="isVoiceInput"
      :isIOS="isIOS"
      :isLoading="isLoading"
      :prompt="localPrompt"
      :placeholderStyle="placeholderStyle"
      :imgsList="imgsList"
      :imgsListVersion="imgsListVersion"
      :inputFocused="inputFocused"
      :isVoiceAnimationActiveStart="isVoiceAnimationActiveStart"
      :showModelSelect="showModelSelect"
      :pageAgentVariables="pageAgentVariables"
      :modelInfo="modelInfo"
      :sourceIs="sourceIs"
      :inputBottom="inputBottom"
      :statusBarHeight="statusBarHeight"
      :titleBarHeight="titleBarHeight"
      :textarea_int="textarea_int"
      @toggle-voice-input="toggleVoiceInput"
      @remove-image="removeImage"
      @send-message="handleSendMessageabc"
      @start-long-press="startLongPress"
      @end-long-press="endLongPress"
      @input-focus="handleInputFocus"
      @input-blur="handleInputBlur"
      @input-click="handleInputClick"
      @start-voice-animation="startVoiceAnimation"
      @stop-voice-animation="stopVoiceAnimation"
      @function-handle="functionHandle"
      @source-handle="sourceHandle"
      @update:prompt="updatePrompt"
      @update:pageAgentVariables="updatepageAgentVariables"
      @showModelConfig="showModelConfig"
      @textareaHeightChange="textareaHeightChange"
      @modelConfigChange="modelConfigChange"
      @keyboard-show="handleKeyboardShow"
      @keyboard-hide="handleKeyboardHide"
      :modelConfigChangeData="modelConfigChangeData"
    />
    <view class="icon-button-group" v-if="isShowIcon">
      <view class="icon-button" @click="handleIconClick('camera')">
        <image src="/static/images/cammer_input.png" mode="widthFix"
               style="width: 74rpx;" class="icon-imagea"/>
        <text class="icon-text">相机</text>
      </view>
      <view class="icon-button" @click="handleIconClick('album')">
        <image src="/static/images/picter_input.png" mode="widthFix"
               class="icon-imagea"/>
        <text class="icon-text">相册</text>
      </view>
      <view class="icon-button" @click="handleIconClick('file')">
        <image src="/static/images/floder_input.png" mode="widthFix"
               class="icon-imagea"/>
        <text class="icon-text">本地文件</text>
      </view>
      <view class="icon-button" @click="handleIconClick('wxfile')">
        <image src="/static/images/floder_input.png" mode="widthFix"
               class="icon-imagea"/>
        <text class="icon-text">微信文件</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch } from 'vue';
import ToggleButtonGroup from '@/components/ToggleButtonGroup.vue';
import InputArea from '@/components/InputArea.vue';

const props = defineProps({
  isShowIcon: Boolean,
  imgsList: Array,
  imgsListVersion: { type: Number, default: 0 },
  modelName: String,
  modelNameEN: String,
  isVoiceAnimationActive: Boolean,
  isVoiceInput: Boolean,
  isIOS: Boolean,
  isLoading: { type: Boolean, default: false },
  prompt: String,
  placeholderStyle: String,
  inputFocused: Boolean,
  isVoiceAnimationActiveStart: Boolean,
  pageAgentVariables: Array,
  modelConfigChangeData: Object,
  showModel: {
    type: Boolean,
    default: true
  },
  showModelSelect: {
    type: Boolean,
    default: true
  },
  modelInfo: Object,
  inputBottom: {
    type: Number,
    default: 0
  },
  sourceIs: {
    type: Boolean,
    default: false
  },
  textarea_int: {
    type: Boolean,
    default: true
  },
  statusBarHeight: {
    type: String,
    default: '0'
  },
  titleBarHeight: {
    type: String,
    default: '0'
  },
  isIndex: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'modelConfigChange', 'textareaHeightChange', 'toggle-super-agent',
  'toggle-super-agentfu', 'toggle-mcp', 'toggle-knowledge-base',
  'toggle-permanent-memory', 'toggle-voice-input', 'remove-image',
  'send-message', 'start-long-press', 'end-long-press', 'input-focus',
  'input-blur', 'input-click', 'start-voice-animation', 'stop-voice-animation',
  'function-handle', 'source-handle', 'update:prompt', 'update:pageAgentVariables',
  'showModelConfig', 'keyboard-show', 'keyboard-hide', 'show-model-list',
  'icon-click'
]);

const localPrompt = ref(props.prompt);

watch(
  () => props.inputBottom,
  (val) => {},
  { immediate: true }
);

watch(
  () => props.prompt,
  (newVal) => {
    localPrompt.value = newVal;
  }
);

watch(
  () => props.pageAgentVariables,
  (newVal) => {}
);

function modelConfigChange(obj) {
  emit('modelConfigChange', obj);
}

function textareaHeightChange(val) {
  emit('textareaHeightChange', val);
}

function toggleSuperAgent() {
  emit('toggle-super-agent');
}

function toggleSuperAgentfu() {
  emit('toggle-super-agentfu');
}

function toggleMCP() {
  emit('toggle-mcp');
}

function toggleKnowledgeBase() {
  emit('toggle-knowledge-base');
}

function togglePermanentMemory() {
  emit('toggle-permanent-memory');
}

function toggleVoiceInput() {
  emit('toggle-voice-input');
}

function removeImage(index) {
  emit('remove-image', index);
}

function handleSendMessageabc(prompt) {
  emit('send-message', prompt);
}

function startLongPress() {
  emit('start-long-press');
}

function endLongPress() {
  emit('end-long-press');
}

function handleInputFocus() {
  emit('input-focus');
}

function handleInputBlur() {
  emit('input-blur');
}

function handleInputClick() {
  emit('input-click');
}

function startVoiceAnimation() {
  emit('start-voice-animation');
}

function stopVoiceAnimation() {
  emit('stop-voice-animation');
}

function functionHandle() {
  emit('function-handle');
}

function sourceHandle() {
  emit('source-handle');
}

function handleIconClick(type) {
  emit('icon-click', type);
}

function handleKeyboardShow(e) {
  emit('keyboard-show', e);
}

function handleKeyboardHide() {
  emit('keyboard-hide');
}

function updatePrompt(newValue) {
  localPrompt.value = newValue;
  emit('update:prompt', newValue);
}

function updatepageAgentVariables(newValue, inx, index) {
  emit('update:pageAgentVariables', newValue, inx, index);
}

function showModelConfig(val) {
  emit('showModelConfig', val);
}

function handleModelClick() {
  emit('show-model-list');
}
</script>

<style lang="scss" scoped>
/* 将原有的样式复制到这里 */
.container {
  min-height: 100vh;
  position: fixed;
  inset: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;

  .chat-container {
    flex: 1;
    padding: 20rpx 0;
    margin-bottom: 120rpx;
    box-sizing: border-box;
    height: calc(100vh - 240rpx);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  .input-area {
			bottom: 0;
			left: 0;
			right: 0;
			padding: 20rpx;
			padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
			padding-bottom: calc(20rpx + constant(safe-area-inset-bottom));
			display: flex;
			align-items: center;
			gap: 20rpx;
			z-index: 2;

			input {
				flex: 1;
				height: 80rpx;
				padding: 0 30rpx;
				background-color: #E6F3FA;
				border-radius: 30rpx;
				font-size: 30rpx;
				color: #333;
			}

			.placeholder-style {
				color: #999;
				font-size: 28rpx;
				font-family: AlimamaFangYuanTi;
			}

			.send-btn {
				width: 100rpx;
				height: 100rpx;
				padding: 0;
				margin: 0;
				display: flex;
				align-items: center;
				justify-content: center;
				background-color: transparent;
				border-radius: 30rpx;
				border: none;

				&::after {
					border: none;
				}

				.send-icon {
					width: 200rpx;
					height: 200rpx;
				}

				&:disabled {
					opacity: 0.6;
				}
			}
		}

}

.chu-box {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: fixed;
  color: rgb(0 0 0 / 0.4);
  bottom: 237rpx;
  font-family: AlimamaFangYuanTi;
  z-index: 1001;
}

.guanwang-box {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  position: fixed;
  color: rgb(0 0 0 / 0.4);
  bottom: 87px;
  font-family: AlimamaFangYuanTi;
  z-index: -1;

  .guanwangline {
    font-weight: normal;
    color: rgb(89 97 255 / 0.55);
    font-size: 30rpx;
    line-height: 55rpx;
  }

  .guanwangline1 {
    font-size: 20rpx;
    line-height: 20rpx;
  }

}

.conceal {
  width: 100%;
  height: 0rpx;
  display: flex;
  justify-content: center;

  .conceal-img {
    height: 15rpx;
    width: 40rpx;
    position: fixed;
    z-index: 1000;
    margin-top: 10rpx;
  }
}

.search-box {
  display: flex;
    align-items: flex-start;
    width: 100%;
    background-color: #fff;
    background-size: 100% 100%;
    background-repeat: no-repeat;
    border-radius: 30rpx;
    padding: 0 15rpx 0 25rpx;
    height: auto;
    box-sizing: border-box;
	flex-wrap: wrap;
	position: relative;
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
    font-family: AlimamaFangYuanTi;
    outline: none;
  }


  .search-right{
  	width: 119rpx;
  	  height: 68rpx;
  	  margin-right:0;
  	  border-radius: 0 30px 30px 0;
  	box-sizing: border-box;
  	display: flex;
  	justify-content: space-around;
  	align-items: center;
	position: absolute;
	right: 0;
	bottom: 0;
  }

  .search-box1{
  	width: 50rpx;height: 40rpx;margin-top: 16rpx;
  }

  .search-box1-img{
  	width: 30rpx;height: 40rpx;
  }

  .search-box2{
  	width: 35rpx;height: 35rpx;
  }

  .search-box2-img{
  	width: 35rpx;height: 35rpx;
  }

  .search-box3{
  	width: auto;
      display: flex;
      justify-content: center;
      align-items: center;
  }

  .search-box3-img{
  	width: 35rpx;height: 19.83rpx;
  }

  .toodown-box{
	  width: 100%;
	  display: flex;
	  flex-direction: column;
	  justify-content: center;
	  align-items: center;
	  position: fixed;
	  color: rgb(0 0 0 / 0.4);
	  bottom: 230rpx;
	  font-family: AlimamaFangYuanTi;
	  z-index: -1;
  }

  .toodown{
  	width: 100%;
  	height: 28.81rpx;
  	display: flex;
  	justify-content: center;
  	margin-top: 15rpx;

  	.toodownimg{
  		width: 40rpx;
  		height: 28.81rpx;
  	}
  }

  .no-more-container {
  	display: flex;
  	align-items: center;
  	justify-content: center;
  	margin: 16rpx 0;
	width: 90%;
  }

  .line {
  	flex: 1;
  	height: 1rpx;
  	background-color: #e0e0e0;
  }

  .no-more-text {
  	margin: 0 9rpx;
  	color: #767676;
  	font-family: AlimamaFangYuanTi;
  	font-size: 24rpx;
  	font-weight: normal;
  	line-height: 20rpx;
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
  height: 2rpx;
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


.header {
  padding-top: 10rpx;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}

.welcome {
  color: #000;
  margin-bottom: 10rpx;
  font-family: AlimamaFangYuanTi;
  font-size: 80rpx;
  font-weight: normal;
  line-height: 67rpx;
  letter-spacing: 0;
}

.brand {
  margin-bottom: 20rpx;
  align-self: flex-end;
  font-family: AlimamaFangYuanTi;
  font-size: 30rpx;
  font-weight: bold;
  text-align: center;
  letter-spacing: 0;
  font-variation-settings: "BEVL" 100, "opsz" auto;
  color: #8D83FF;

}

.logobox {
  padding-top: 20rpx;
  display: flex;
  justify-content: center;
  align-items: center;
}

.logo {
  width: 210rpx;
  height: 260rpx;
}

.input-wbox {
  width: 100%;
  display: flex;
  justify-content: center;
}


.titlebox {
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: center;
}

.titlebox-image {
  margin-top: 0;
  width: 210rpx;
  height: 37rpx;
}

.titlebox-image1 {
  margin-top: 18rpx;
  width: 212rpx;
  height: 66rpx;
}

.top_box {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding-top: 30%;
}

.button-group {
  display: flex;
  justify-content: space-between;
  margin: 10rpx auto 8rpx;
  width: calc(100% - 100rpx);
  gap: 16rpx;
  position: fixed;
  bottom: 110rpx;
  left: 0;
  right: 0;
  z-index: 1;
}

.button-group-box {
  display: flex;
  justify-content: space-between;
  margin: 5rpx auto 0;
  width: calc(100% - 72rpx);
  gap: 16rpx;
  position: static;
  bottom: 170rpx;
  left: 10rpx;
  right: 0;
  z-index: 1;
}

.toggle-button {
  width: calc(25% - 12rpx);
  border: 4rpx solid #fff;
  border-width: 4rpx 4rpx 0;
  padding: 0;
  margin: 0 8rpx 0 0;
  border-radius: 15rpx;
  font-size: 28rpx;
  transition: background-color 0.3s;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(106deg, rgb(205 208 255 / 0.3) 0%, rgb(253 255 225 / 0.3) 100%);
  box-shadow: 0 0 6px 0 rgb(0 0 0 / 0.3);
  padding-left: 10rpx;
  -webkit-tap-highlight-color: transparent;
  tap-highlight-color: transparent;
  outline: none;
}

.toggle-button:last-child {
  margin-right: 0;
}

.button-group-box-inner {
  color: #000;
  font-size: 26rpx;
  font-family: AlimamaFangYuanTi;
}

.custom-carousel-wrapper {
  border: 1px solid rgb(156 156 156 / 0.3);
  box-shadow: 0 0 6rpx 0 rgb(86 71 250 / 0.3);
  box-sizing: border-box;
  border-radius: 30rpx;
  overflow: hidden;
}

.carousel-img {
  width: 100%;
  height: 100%;
  border-radius: 30rpx;
  display: block;
}

.gradient-border {
  position: relative;
  border-radius: 30rpx;
  padding: 4rpx;
  background: linear-gradient(235deg, #D19EFF 6%, rgb(255 242 0 / 0.3) 31%, rgb(146 146 146 / 0.3) 52%, rgb(255 242 0 / 0.3) 73%, #CD96FF 93%);
  box-shadow: 0 0 16rpx rgb(0 0 0 / 0.08);
}

.carousel-inner {
  border-radius: 30rpx;
  overflow: hidden;
  background: #fff;
}

.search-input {
  font-family: AlimamaFangYuanTi;
}

.icon-button-group {
  display: flex;
  justify-content: flex-start;
  margin: 0 auto;
  width: calc(100% - 60rpx);
  padding: 5rpx 20rpx 25rpx;
  position: relative;
  z-index: 1000;
  gap: 16rpx;
  overflow-x: scroll;
  box-sizing: border-box;
  background-color: #fff;
}

.icon-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 150rpx;
  height: 150rpx;
  background: linear-gradient(135deg, rgb(205 208 255 / 0.3) 3%, rgb(253 255 225 / 0.3) 103%);
  border-radius: 30rpx;
  padding: 20rpx 10rpx 0;
  transition: background-color 0.3s;
  box-shadow: 0 0 4rpx 0 rgb(0 0 0 / 0.3);
  box-sizing: border-box;
  border: 6rpx solid #fff;
  border-width: 6rpx 6rpx 0;
}

.icon-imagea {
  width: 70rpx;
  height: 70rpx;
  margin-bottom: 12rpx;
}

.icon-text {
  font-size: 20rpx;
  line-height: 40rpx;
  color: rgb(0 0 0 / 0.9);
  font-family: AlimamaFangYuanTi;
}

.search-box2-img {
  transition: transform 0.5s ease;
}

.rotate-icon {
  transform: rotate(45deg);
}

.scrollable-button-group {
  display: flex;
  overflow-x: auto;
  white-space: nowrap;
  padding: 25rpx 15rpx;
  margin: 0 auto;
}

.toggle-button {
  display: flex;
  width: 130rpx;
  margin-right: 8rpx;
  flex: none;
}

.chu-text {
  color: #333;
}

.agent-content {
  height: auto;
  z-index: 999;
  width: calc(100% - 48rpx);
  box-sizing: border-box;
  margin-left: 32rpx;
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  font-family: AlimamaFangYuanTi;

}

.agent-content1 {
  position: fixed;
  height: 50vh !important;
  z-index: 1000;
  top: calc((100vh - 50vh) / 2);
  box-shadow: 0 0 10rpx 0 rgb(0 0 0 / 0.3);
  border-radius: 20rpx;
  overflow: hidden;
  backdrop-filter: blur(50rpx);
  background: linear-gradient(101deg, rgb(205 208 255 / 0.3) 4%, rgb(253 255 225 / 0.3) 104%);
  width: calc(100% - 80rpx);
}

.agent_content_box {
  position: relative;
  height: 100%;
  width: 100%;
  opacity: 0.4;
}

@keyframes rotate {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.agent_back {
  background: linear-gradient(to right, #D19EFF 20%, #F68B09 50%, #3EFFBE 80%);
  position: absolute;
  inset: -300rpx;
  animation: rotate 5s linear infinite;
}

.agent_content {
  position: absolute;
  inset: 4rpx;
  background-color: rgb(226 226 226);
  border-radius: 20rpx;
  overflow-y: auto;
  z-index: 9;
  width: calc(100% - 8rpx) !important;
  height: calc(100% - 8rpx) !important;
  box-sizing: border-box;
  margin: 0 !important;
  opacity: 1;
  padding: 20rpx !important;
}

.agent_content_title_top_img {
  width: 30rpx;
  height: 30rpx;
  margin-right: 10rpx;
}

.agent_content_title {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
}

.agent_content_title_top {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}

.agent_content_con {
  width: 100%;
  overflow: hidden;
  white-space: initial;
  color: transparent;
  background-image: linear-gradient(to bottom, transparent 50%, rgb(0 0 0 / 0.5) 50%);
  -webkit-background-clip: text;
  background-clip: text;
}

.imgs_list_item{
	position: relative;
	width: auto;
	flex: none;

	.imgs_list_close{
		position: absolute;
		top: 0;
		right: 0;
		width: 30rpx;
		height: 30rpx;
		z-index: 1000;
		background-color: #fff;
		border-radius: 100px;
	}

	.imgs_list_item_img{
		width: 100%;
		height: 90rpx;
		display: block;
	}
}

.imgs_list{
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: flex-start;
	gap: 10rpx;
	left: 0;
	right: 0;
	z-index: 1;
	width: 100%;
	padding: 20rpx 0;
	box-sizing: border-box;
	overflow-x: auto;
	flex:none;
	border-bottom: 1px solid #D8D8D8;
  margin-bottom: 20rpx;
}

.agent-content-item {
  white-space: pre-wrap;
  word-wrap: break-word;
  word-break: break-all;
  background-color: #fff;
  border-radius: 30rpx;
  opacity: 1;
  background: #F6F6F6;
  box-sizing: border-box;
  border: 1px solid #EEE;
  width: 100%;
  float: left;
  margin-top: 20rpx;
  padding: 20rpx;
  font-size: 22rpx;
  font-weight: normal;
  line-height: 28rpx;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: #333;
}

.agent-content-item-question {
  background: #9A99F3;
  box-sizing: border-box;
  border: 2rpx solid;
  border-image: linear-gradient(275deg, rgb(252 255 77 / 0.5) -32%, rgb(76 32 116 / 0) 5%, rgb(54 16 88 / 0) 98%, rgb(54 16 88 / 0.5) 129%) 2;
  box-shadow: 0 0 6px 0 rgb(0 0 0 / 0.3);
  border-radius: 15rpx;
  float: right;
  padding: 20rpx;
  font-size: 22rpx;
  font-weight: normal;
  line-height: 28rpx;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  font-variation-settings: "BEVL" 100, "opsz" auto;
  color: #FFF;
}

.compan {
  overflow: hidden;
  margin: 0;
  width: 100%;
  box-sizing: border-box;
}

.compan .icon-button-group {
  overflow-x: hidden !important;
  justify-content: flex-start !important;
  margin: 0 40rpx 0 30rpx;
  padding: 12rpx 10rpx;
  position: initial;
  width: calc(100% - 90rpx);
  gap: 18rpx;
}

@keyframes slideLeft {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(-3330%);
  }
}

.compan .icon-button {
  flex: none;
  position: relative;
  animation: slideLeft 30s infinite linear;
}

.lianjie_con {
  position: fixed;
  bottom: 450rpx;
  left: 0;
  right: 0;
  z-index: 1;
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  padding: 0 20rpx;
  box-sizing: border-box;
  overflow-x: auto;
}

.lianjie_list {
  display: block;
  flex: none;
  text-align: center;
}

.lianjie_icon {
  display: block;
  margin: 0 auto 10rpx;
  height: 160rpx;
}

.lianjie_text {
  color: #979797;
  font-family: AlimamaFangYuanTi;
  font-size: 36rpx;
  text-align: center;
}

.icon-imageb {
  position: absolute;
  bottom: 14rpx;
  right: 4rpx;
  width: 22rpx;
  height: 22rpx;
}

.z_index_1000 {
  z-index: 1000;
}

.btn_join{
  background: url('/static/images/shequ_back.png') no-repeat center center;
  background-size: 100% 100%;
  font-family: AlimamaFangYuanTi;
  font-size: 30rpx;
  color: #3D3D3D;
  width: 219rpx;
  height: 70rpx;
  text-align: center;
  line-height: 70rpx;
  margin: 0 auto;
  margin-top: 20rpx;
  font-weight: bold;
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

.line3 {
  left: 24px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 0.75s;
}

.line4 {
  left: 32px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 1s;
}

.line5 {
  left: 40px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 1.25s;
}

.line6 {
  left: 48px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 1.5s;
}

.line7 {
  left: 56px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 1.75s;
}

.line8 {
  left: 64px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 2s;
}

.line9 {
  left: 72px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 2.25s;
}

.line10 {
  left: 80px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 2.5s;
}

.line11 {
  left: 88px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 2.75s;
}

.line12 {
  left: 96px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 3s;
}

.line13 {
  left: 104px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 3.25s;
}

.line14 {
  left: 112px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 3.5s;
}

.line15 {
  left: 120px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 3.75s;
}

.line16 {
  left: 128px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 4s;
}

.line17 {
  left: 136px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 4.25s;
}

.line18 {
  left: 144px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 4.5s;
}

.line19 {
  left: 152px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 4.75s;
}

.line20 {
  left: 160px;
  animation: move 0.75s linear infinite alternate;
  animation-delay: 5s;
}
</style>