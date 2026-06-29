<template>
  <view class="input-area"
    :class="{ 'input_area_active': isFangdaActive, 'textarea_input_isShowIcon': isShowIcon && isFangdaActive }"
    :style="{ bottom: computedInputBottom + 'rpx', padding: showBackground ? '10rpx 20rpx 20rpx' : '0', top: isFangdaActive ? 'calc(' + statusBarHeight + ' + ' + titleBarHeight + ' + ' + '12rpx)' + ' !important' : 'auto' }">
    <view :class="{ 'input-area-back': showBackground, 'input_area_back': isFangdaActive }" style="width: 100%;">
      <view class="search-box search_box_bor" :class="{ 'search_box': isFangdaActive }"
        :style="{ backgroundColor: isVoiceAnimationActive ? '#ECEDFC' : '#fff', padding: !isIOS ? '18rpx 30rpx' : '' }">
        <view class="imgs_list" v-if="imgsList && imgsList.length > 0" :key="'imgs-' + imgsList.length + '-' + imgsListVersion">
          <view class="imgs_list_item" v-for="(item, index) in imgsList" :key="'img-' + index + '-' + (item.imgUrl || index)">
            <image @click="removeImage(index)" src="/static/images/close_input.png"
              mode="widthFix" class="imgs_list_close"></image>
            <view style="position: absolute;left: 0;bottom: 0;right: 0;z-index: 1;color: #000;overflow: hidden;height: 32rpx;display: flex;align-items: center;" v-if="item.fileType && item.fileType == 'document'">
              <view class="scroll-container">
                <view class="scroll-content">
                  <text>{{ item.filename }}</text>
                  <text class="scroll-separator"> </text>
                  <text>{{ item.filename }}</text>
                </view>
              </view>
            </view>
            <view v-if="item.isVideo || (item.fileType && item.fileType == 'video')" style="position: relative;width: 213rpx;height: 120rpx;">
              <video :src="item.video_url" 
                :poster="item.imgUrl" 
                :show-center-play-btn="false" 
                :show-play-btn="false" 
                :enable-progress-gesture="false" 
                :controls="false" 
                :autoplay="false" 
                :show-fullscreen-btn="false" 
                object-fit="contain" 
                style="width: 213rpx;height: 120rpx;" 
                @click.stop></video>
            </view>
            <image v-else :src="item.fileType && item.fileType == 'document' ? '/static/images/file.png' : item.imgUrl" mode="heightFix" class="imgs_list_item_img"></image>
          </view>
        </view>
        <view class="search-box search-boxa" :class="{ 'search_boxa': isFangdaActive }" style="position: relative;display: flex;padding: 0;background: none;">
          <view class="search-box1" :style="{ marginRight: !isVoiceAnimationActive ? '20rpx' : '0' }"
            @click="toggleVoiceInput" :class="{ active: isVoiceInput }">
            <image v-if="isVoiceAnimationActive" class="search-box1-img" style="width: 50rpx;height: 30rpx;"
              src="/static/images/input_qie.png" mode="widthFix"></image>
            <image v-else class="search-box1-img" src="/static/images/search-hua.png"
              mode="widthFix">
            </image>
          </view>
          <!-- <image v-if="showForm" class="textarea_open" src="https://file.aizhs.top/sys-mini/xtk/textareaOpen.png"
            @click.stop="showConfigDialog" /> -->
          <!-- #ifdef MP-WEIXIN -->
          <textarea
            ref="textarea"
            :class="{ 'textarea_input': isFangdaActive, 'textarea_int': textarea_int }"
            :style="{ position: !isVoiceAnimationActive ? 'relative' : 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: !isVoiceAnimationActive ? '1' : '-1', maxHeight: !isFangdaActive ? '500rpx' : 'none' }"
            auto-height
            class="search-input"
            :rows="4"
            v-model="localPrompt"
            placeholder="请输入内容......"
            confirm-type="send"
            :placeholderStyle="placeholderStyle"
            @confirm="handleSendMessageabc"
            @focus="handleInputFocus"
            @blur="handleInputBlur"
            @keyboardheightchange="handleKeyboardHeightChange"
            @tap.stop="handleInputClick"
            @input="updatePrompt"
            :disabled="isVoiceAnimationActive"
            maxlength="50000"
            :adjust-position="false"
            cursor-spacing="44px"
          />
          <!-- #endif -->
          <!-- #ifndef MP-WEIXIN -->
          <textarea
            ref="textarea"
            :class="{ 'textarea_input': isFangdaActive, 'textarea_int': textarea_int }"
            :style="{ position: !isVoiceAnimationActive ? 'relative' : 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: !isVoiceAnimationActive ? '1' : '-1', maxHeight: !isFangdaActive ? '500rpx' : 'none' }"
            auto-height
            class="search-input"
            :rows="4"
            v-model="localPrompt"
            placeholder="请输入内容......"
            confirm-type="send"
            :placeholderStyle="placeholderStyle"
            @confirm="handleSendMessageabc"
            @focus="handleInputFocus"
            @blur="handleInputBlur"
            @keyboardheightchange="handleKeyboardHeightChange"
            @tap.stop="handleInputClick"
            @input="updatePrompt"
            :disabled="isVoiceAnimationActive"
            maxlength="50000"
            cursor-spacing="44px"
          />
          <!-- #endif -->
          <!-- 添加了@input.native事件监听，确保能捕获到原生输入事件 -->
          <!-- 增加备用的input事件处理，确保兼容性 -->
          <view style="flex: 1;display: flex;align-items: center;" v-if="isVoiceAnimationActive"
            @mousedown.prevent="startVoiceAnimation" @mouseup.prevent="stopVoiceAnimation" @mouseleave.prevent="stopVoiceAnimation"
            @touchstart.prevent.stop="startVoiceAnimation" @touchend.prevent.stop="stopVoiceAnimation" @touchcancel.prevent.stop="stopVoiceAnimation">
            <view class="voice-bar-animation">
              <view class="line" :class="isVoiceAnimationActiveStart ? 'line' + (n + 1) : ''" v-for="n in 30" :key="n">
              </view>
            </view>
          </view>
          <view v-if="isamplify && !isVoiceAnimationActive && !isFangdaActive" class="search-right"
            style="position: absolute;justify-content: flex-end;right: 0;top: 12rpx;width: 40rpx;height: 40rpx;z-index: 2;">
            <view class="search-box3">
              <image @click.stop="handleFangda" class="search-box3-img" style="width: 48rpx;height: 48rpx;"
                src="/static/images/fangda.png" mode="widthFix"></image>
            </view>
          </view>
          <view v-if="isFangdaActive" class="search-right search_suo"
            style="position: absolute;justify-content: flex-end;right: 0;top: 12rpx;width: 40rpx;height: 40rpx;z-index: 2;">
            <view class="search-box3">
              <image @click.stop="handleFangdas" class="search-box3-img" style="width: 48rpx;height: 48rpx;"
                src="/static/images/suoxiao.png" mode="widthFix"></image>
            </view>
          </view>
          <view class="search-right" style="position: relative;opacity: 0;">
            <view class="search-box2" v-if="!isClear && showAddImageBtn" :style="{ opacity: showFile ? '1' : 0 }"
              @click="functionHandle">
              <image class="search-box2-img" :class="{ 'rotate-icon': isShowIcon }"
                src="/static/images/search-add.png" mode="" />
            </view>

            <view class="search-box3">
              <image @click.stop="clearInput" v-if="localPrompt && localPrompt.length > 0 && isClear" class="search-box3-img"
                src="/static/images/close_chat.png"
                style="width: 50rpx;height: 50rpx;margin-right: 10rpx;" mode=""></image>
              <view class="module_box" v-if="false" @click.stop="sourceHandle">
                <!-- <view class="module_content"> -->
                <!-- <view style="display: flex;flex-direction: column;align-items: center;">
                    <text style="display: block;color: #ff0000;font-size: 22rpx;">最 强</text>
                    <text style="display: block;">大模型</text>
                  </view> -->
                <!-- <image class="search-box3-img" src="https://file.aizhs.top/sys-mini/search-shang.png" mode="">
                  </image> -->
                <!-- </view> -->
                <!-- <image
                  :src="modelSelected ? 'https://file.aizhs.top/sys-mini/default/model.png' : 'https://file.aizhs.top/sys-mini/default/model_active.png'"
                  mode="widthFix" style="width: 56rpx;height: 56rpx;"></image> -->
              </view>
              <!-- <image @click.stop="sourceHandle" v-if="!inputFocused && showModelSelect" class="search-box3-img" src="https://file.aizhs.top/sys-mini/search-shang.png" mode=""></image> -->
              <image @click.stop="handleSendMessageabc"
                class="search-box3-img" style="width: 50rpx;height: 50rpx;margin-left: 18rpx;"
                src="/static/images/sand_msg.png" mode="widthFix"></image>
              <!-- <image @click.stop="handleSendMessageabc" v-else class="search-box3-img" style="width: 50rpx;height: 50rpx;" src="https://file.aizhs.top/sys-mini/default/home/send.png" mode="widthFix"></image> -->
            </view>
          </view>
          <view class="search-right">
            <view class="search-box2" v-if="!isClear && showAddImageBtn" :style="{ opacity: showFile ? '1' : 0 }"
              @click="functionHandle">
              <image class="search-box2-img" :class="{ 'rotate-icon': isShowIcon }"
                src="/static/images/search-add.png" mode="" />
            </view>

            <view class="search-box3">
              <image @click.stop="clearInput" v-if="localPrompt && localPrompt.length > 0 && isClear" class="search-box3-img"
                src="/static/images/close_chat.png"
                style="width: 50rpx;height: 50rpx;margin-right: 10rpx;" mode=""></image>
              <view class="module_box" v-if="false" @click.stop="sourceHandle">
                <!-- <view class="module_content"> -->
                <!-- <view style="display: flex;flex-direction: column;align-items: center;">
                    <text style="display: block;color: #ff0000;font-size: 22rpx;">最 强</text>
                    <text style="display: block;">大模型</text>
                  </view> -->
                <!-- <image class="search-box3-img" src="https://file.aizhs.top/sys-mini/search-shang.png" mode="">
                  </image> -->
                <!-- </view> -->
                <!-- <image
                  :src="modelSelected ? 'https://file.aizhs.top/sys-mini/default/model.png' : 'https://file.aizhs.top/sys-mini/default/model_active.png'"
                  mode="widthFix" style="width: 56rpx;height: 56rpx;"></image> -->
              </view>
              <!-- <image @click.stop="sourceHandle" v-if="!inputFocused && showModelSelect" class="search-box3-img" src="https://file.aizhs.top/sys-mini/search-shang.png" mode=""></image> -->
              <image @click.stop="handleSendMessageabc"
                class="search-box3-img" style="width: 50rpx;height: 50rpx;margin-left: 18rpx;"
                src="/static/images/sand_msg.png" mode="widthFix"></image>
              <!-- <image @click.stop="handleSendMessageabc" v-else class="search-box3-img" style="width: 50rpx;height: 50rpx;" src="https://file.aizhs.top/sys-mini/default/home/send.png" mode="widthFix"></image> -->
            </view>
          </view>
        </view>
        <view class="page_agent_variables_container" v-if="pageAgentVariables && pageAgentVariables.length > 0" @tap.stop @click.stop @touchend.stop>
          <scroll-view class="page_agent_variables_scroll" scroll-y @tap.stop @click.stop>
            <view class="page_agent_can" v-for="(item, index) in pageAgentVariables" :key="index" @tap.stop @click.stop>
              <view class="page_agent_list" v-for="(itema, inx) in item.components" :key="inx" @tap.stop @click.stop>
                <view class="page_can_tit">{{ itema.name == '' ? item.description : itema.name }}</view>
                <view class="page_can_con" @tap.stop @click.stop>
                  <input v-if="itema.type == 'text'" @input="updatepageAgentVariables($event, inx, index)"
                    @focus="handleParamInputFocus" @blur="handleParamInputBlur"
                    @tap="handleParamInputTap" @click.stop
                    :placeholder="itema.description" v-model="itema.default_value" class="page_can_input"></input>
                  <view v-else-if="itema.type == 'image'" class="">
                    <image @click="functionHandlea(index, inx)" class="search-box2-img"
                      :class="{ 'rotate-icon': isShowIcon }" src="/static/images/search-add.png">
                    </image>
                  </view>
                </view>
              </view>
            </view>
          </scroll-view>
        </view>
        <!-- <ModelConfigDialog v-if="showModelaConfig" ref="modelConfigDialog" :modelConfigChangeData="modelConfigChangeData" :modelName="modelName" :modelNameEN="modelNameEN" :modelInfo="modelInfo" :imgsList="imgsList" @change="modelConfigChange"
          style="width: 100%;" :fromPath="fromPath"></ModelConfigDialog> -->
        <!-- v-if="showModelConfig" -->
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, getCurrentInstance, nextTick } from 'vue'
import ModelConfigDialog from './ModelConfigDialog/index.vue'

const props = defineProps({
  isShowIcon: Boolean,
  isVoiceAnimationActive: Boolean,
  isVoiceInput: Boolean,
  isIOS: Boolean,
  isLoading: {
    type: Boolean,
    default: false,
  },
  prompt: String,
  placeholderStyle: String,
  imgsList: Array,
  imgsListVersion: { type: Number, default: 0 },
  inputFocused: Boolean,
  isVoiceAnimationActiveStart: Boolean,
  showModelSelect: Boolean,
  pageAgentVariables: Array,
  modelConfigChangeData: Object,
  showFile: {
    type: Boolean,
    default: true,
  },
  isClear: {
    type: Boolean,
    default: false,
  },
  needBottom: {
    type: Boolean,
    default: true
  },
  inputHeight: {
    type: String,
    default: '88rpx'
  },
  showBackground: {
    type: Boolean,
    default: true
  },
  modelInfo: Object,
  modelName: String,
  modelNameEN: String,
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
  showSend: {
    type: Boolean,
    default: false
  },
  fromPath: {
    type: String,
    default: 'index'
  }
})

const emit = defineEmits([
  'textareaHeightChange',
  'update:prompt',
  'update:isClear',
  'send-message',
  'input-focus',
  'input-blur',
  'input-click',
  'keyboard-show',
  'keyboard-hide',
  'toggle-voice-input',
  'remove-image',
  'fangda',
  'function-handle',
  'source-handle',
  'start-voice-animation',
  'stop-voice-animation',
  'showModelConfig',
  'modelConfigChange',
  'update:pageAgentVariables'
])

const instance = getCurrentInstance()

const localPrompt = ref(props.prompt)
const textareaHeight = ref(37)
const textareaPadding = ref('20rpx 38rpx 20rpx 64rpx')
const showForm = ref(false)
const showModelConfig = ref(false)
const showModelaConfig = ref(false)
const hasConfig = reactive(['qwen-image', 'qwen-image-Edit', 'doubao-seedream-4.0'])
const needImage = reactive(['qwen-image-Edit'])
const unImage = reactive(['qwen-image', 'qwen-plus', 'Doubao-1.6', 'GLM-4.5', 'deepseek3.1'])
const showAddImageBtn = ref(true)
const modelSelected = ref(false)
const textareaRows = ref(1)
const isamplify = ref(false)
const isFangdaActive = ref(false)
const isKeyboardActive = ref(false)
const showAgentVariables = ref(true)
const paramInputFocused = ref(false)
const paramInputTimer = ref(null)
const isUpdatingParam = ref(false)
const localInputBottom = ref(0)

const textarea = ref(null)

const nomalBottom = computed(() => {
  return props.needBottom ? props.isShowIcon ? 212 : 42 : 0
})

const computedInputBottom = computed(() => {
  // #ifdef APP-PLUS
  const result = props.inputBottom || 0
  if (result > 0) {
    console.log('📐 InputArea computedInputBottom:', result, 'rpx (inputBottom prop:', props.inputBottom, ')')
  }
  return result
  // #endif
  // #ifndef APP-PLUS
  return localInputBottom.value || props.inputBottom || 0
  // #endif
})

watch(() => props.isVoiceAnimationActive, (newVal) => {
})

watch(() => props.inputBottom, (val) => {
}, { immediate: true })

watch(() => props.sourceIs, (newVal) => {
  modelSelected.value = newVal
})

watch(() => props.prompt, (newVal) => {
  localPrompt.value = newVal
  if (newVal == '') {
    isamplify.value = false
    return false
  }
  const query = uni.createSelectorQuery().in(instance)
  query.select('.search-input')
    .boundingClientRect(data => {
      if (data) {
        const height = Math.ceil(data.height)

        emit('textareaHeightChange', height)
        if (height > 88) {
          isamplify.value = true
          if (props.isIOS) {
            textareaPadding.value = '0 28rpx 54rpx 0'
          } else {
            textareaPadding.value = '12rpx 38rpx 82rpx 0'
          }
          showForm.value = true
        } else {
          isamplify.value = false
          if (props.isIOS) {
            textareaPadding.value = '0 134rpx 0 44rpx'
          } else {
            textareaPadding.value = '12rpx 134rpx 12rpx 44rpx'
          }
          showForm.value = false
        }
      }
    })
    .exec()
})

watch(() => showModelConfig.value, (val) => {
  emit('showModelConfig', val)
})

watch(() => props.modelInfo, (val) => {
  if (val) {
    showConfigDialog()
  }
}, { immediate: true })

watch(() => props.modelName, (val) => {
  if (val) {
    if (unImage.includes(val)) {
      showAddImageBtn.value = false
    } else {
      showAddImageBtn.value = true
    }
    if (needImage.includes(val)) {
      functionHandle()
    }
  }
}, { immediate: true })

watch(() => props.pageAgentVariables, (newVal) => {
})

onMounted(() => {
  const query = uni.createSelectorQuery().in(instance)
  query.select('.search-input')
    .boundingClientRect(data => {
      if (data) {
        const height = Math.ceil(data.height)
        emit('textareaHeightChange', height)
        if (height > 68) {
          if (props.isIOS) {
            textareaPadding.value = '0 38rpx 54rpx 0'
          } else {
            textareaPadding.value = '12rpx 38rpx 82rpx 0'
          }
          showForm.value = true
        } else {
          if (props.isIOS) {
            textareaPadding.value = '0 134rpx 0 44rpx'
          } else {
            textareaPadding.value = '12rpx 134rpx 12rpx 44rpx'
          }
          showForm.value = false
        }
      }
    })
    .exec()
})

function showConfigDialog() {
  if (hasConfig.includes(props.modelName)) {
    showModelConfig.value = true
  } else {
    showModelConfig.value = false
  }
}

function modelConfigChange(obj) {
  emit('modelConfigChange', obj)
}

function toggleVoiceInput() {
  emit('toggle-voice-input')
}

function removeImage(index) {
  const item = props.imgsList[index]
  if (item && item.fileType) {
    try {
      const webviewFileCache = uni.getStorageSync('webviewFileCache') || []
      const updatedCache = webviewFileCache.filter(cacheItem => cacheItem.url !== item.imgUrl)
      uni.setStorageSync('webviewFileCache', updatedCache)
    } catch (error) {
    }
  }
  emit('remove-image', index)
}

function handleSendMessageabc(e) {
  try {
    paramInputFocused.value = false

    if (paramInputTimer.value) {
      clearTimeout(paramInputTimer.value)
      paramInputTimer.value = null
    }

    isUpdatingParam.value = false

    emit('send-message', localPrompt.value)
  } catch (error) {
    emit('send-message', localPrompt.value)
  }
}

function handleInputFocus(e) {
  try {
    if (props.isVoiceAnimationActive) {
      if (textarea.value) {
        textarea.value.blur()
      }
      return
    }
    showModelaConfig.value = true
    isKeyboardActive.value = true

    // #ifndef APP-PLUS
    if (e.detail && e.detail.height) {
      localInputBottom.value = e.detail.height
    }
    // #endif

    const isArray = Array.isArray(props.pageAgentVariables)
    if (isArray && props.pageAgentVariables.length > 0) {
      showAgentVariables.value = true
    }

    emit('input-focus', e)
    emit('keyboard-show', { height: e.detail.height })
  } catch (error) {
    emit('input-focus')
    if (e && e.detail && e.detail.height) {
      emit('keyboard-show', { height: e.detail.height })
    }
  }
}

function handleInputBlur() {
  try {
    // #ifndef APP-PLUS
    localInputBottom.value = 0
    // #endif
    setTimeout(() => {
      if (!paramInputFocused.value && !isUpdatingParam.value) {
        isKeyboardActive.value = false
        // #ifndef APP-PLUS
        localInputBottom.value = 0
        // #endif
      }
    }, 800)
    emit('input-blur')
    emit('keyboard-hide')
  } catch (error) {
    emit('input-blur')
    emit('keyboard-hide')
  }
}

function handleKeyboardHeightChange(e) {
  try {
    if (e && e.detail && e.detail.height !== undefined) {
      isKeyboardActive.value = e.detail.height > 0
      emit('keyboard-show', { height: e.detail.height })
    }
  } catch (error) {
    console.error('handleKeyboardHeightChange error:', error)
  }
}

function handleParamInputFocus() {
  paramInputFocused.value = true
  showAgentVariables.value = true

  if (paramInputTimer.value) {
    clearTimeout(paramInputTimer.value)
  }
}

function handleParamInputTap() {
  paramInputFocused.value = true
  showAgentVariables.value = true

  if (paramInputTimer.value) {
    clearTimeout(paramInputTimer.value)
  }
}

function handleParamInputBlur() {
  setTimeout(() => {
    paramInputFocused.value = false
  }, 100)
}

function handleInputClick() {
  try {
    emit('input-click')
  } catch (error) {
    emit('input-click')
  }
}

function startVoiceAnimation() {
  emit('start-voice-animation')
}

function stopVoiceAnimation() {
  emit('stop-voice-animation')
}

function handleFangda() {
  textareaRows.value = 100
  isFangdaActive.value = true
  emit('fangda')
}

function handleFangdas() {
  isFangdaActive.value = false
}

function functionHandle() {
  if (props.showFile) {
    emit('function-handle')
  }
}

function sourceHandle() {
  modelSelected.value = !modelSelected.value
  emit('source-handle')
}

function clearInput() {
  localPrompt.value = ''
  emit('update:prompt', localPrompt.value)
  emit('update:isClear', false)
  emit('send-message', '')
}

function updatePrompt(e) {
  try {
    let inputValue = ''
    if (e && typeof e === 'object') {
      if (e.target && typeof e.target.value !== 'undefined') {
        inputValue = e.target.value
      } else if (e.detail && typeof e.detail.value !== 'undefined') {
        inputValue = e.detail.value
      } else if (typeof e.value !== 'undefined') {
        inputValue = e.value
      } else {
        inputValue = e.toString ? e.toString() : ''
      }
    } else if (typeof e === 'string') {
      inputValue = e
    }

    localPrompt.value = inputValue || ''

    emit('update:prompt', localPrompt.value)
    emit('update:isClear', localPrompt.value && localPrompt.value.length > 0)

    if (props.pageAgentVariables && props.pageAgentVariables.length > 0) {
      showAgentVariables.value = true
    }

    nextTick(() => {
      const lineBreaks = (localPrompt.value && localPrompt.value.match ? (localPrompt.value.match(/\n/g) || []).length : 0)

      const textareaEl = textarea.value
      if (textareaEl) {
        const query = uni.createSelectorQuery().in(instance)
        query.select('.search-input')
          .boundingClientRect(data => {
            if (data) {
              const height = Math.ceil(data.height)
              emit('textareaHeightChange', height)

              const fontSize = 30
              const lineHeight = 40

              const heightBasedRows = Math.max(1, Math.ceil(height / lineHeight))

              const charsPerLine = Math.floor(data.width / (fontSize * 0.5))
              let charBasedRows = 1

              if (localPrompt.value) {
                localPrompt.value.split('\n').forEach(line => {
                  charBasedRows += Math.max(1, Math.ceil(line.length / charsPerLine)) - 1
                })
              }

              const estimatedRows = Math.max(lineBreaks + 1, heightBasedRows, charBasedRows)

              if (!isFangdaActive.value) {
                textareaRows.value = Math.max(1, Math.min(4, estimatedRows))
              } else {
                textareaRows.value = Math.max(10, estimatedRows)
                instance.proxy.$forceUpdate()
              }

              if (height > 68) {
                isamplify.value = true
                if (props.isIOS) {
                  textareaPadding.value = '0 38rpx 54rpx 0'
                } else {
                  textareaPadding.value = '12rpx 38rpx 82rpx 0'
                }
                showForm.value = true
              } else {
                isamplify.value = false
                if (props.isIOS) {
                  textareaPadding.value = '0 134rpx 0 44rpx'
                } else {
                  textareaPadding.value = '12rpx 134rpx 12rpx 44rpx'
                }
                showForm.value = false
              }
            }
          })
          .exec()
      } else {
        if (!isFangdaActive.value) {
          textareaRows.value = Math.max(1, Math.min(4, lineBreaks + 1))
        }
      }
    })
  } catch (error) {
    localPrompt.value = ''
    emit('update:prompt', '')
    emit('update:isClear', false)
  }
}

function updatepageAgentVariables(e, inx, index) {
  try {
    let inputValue = ''
    if (e && e.detail && typeof e.detail.value !== 'undefined') {
      inputValue = e.detail.value
    } else if (e && e.target && typeof e.target.value !== 'undefined') {
      inputValue = e.target.value
    } else if (e && typeof e === 'string') {
      inputValue = e
    } else {
      if (props.pageAgentVariables && props.pageAgentVariables[index] &&
          props.pageAgentVariables[index].components && props.pageAgentVariables[index].components[inx]) {
        inputValue = props.pageAgentVariables[index].components[inx].default_value || ''
      }
    }

    emit('update:pageAgentVariables', inputValue, inx, index)

    isUpdatingParam.value = true

    showAgentVariables.value = true
    paramInputFocused.value = true

    if (paramInputTimer.value) {
      clearTimeout(paramInputTimer.value)
    }

    paramInputTimer.value = setTimeout(() => {
      isUpdatingParam.value = false
      const isArray = Array.isArray(props.pageAgentVariables)
      const hasParamValue = isArray && props.pageAgentVariables.some(item =>
        item && item.components && Array.isArray(item.components) && item.components.some(comp =>
          comp && comp.default_value && comp.default_value.toString().trim() !== ''
        )
      )
      if (hasParamValue) {
        showAgentVariables.value = true
      }
    }, 1200)

  } catch (error) {
    showAgentVariables.value = true
    paramInputFocused.value = true
  }
}

function handleParamContainerClick() {
  try {
    showAgentVariables.value = true
    paramInputFocused.value = true

    if (paramInputTimer.value) {
      clearTimeout(paramInputTimer.value)
    }
  } catch (error) {
  }
}

function hideAgentVariables() {
  try {
    if (isUpdatingParam.value) {
      return
    }

    showAgentVariables.value = false
    paramInputFocused.value = false

  } catch (error) {
    showAgentVariables.value = false
    paramInputFocused.value = false
  }
}

function onInputAlternative(e) {
  updatePrompt(e)
}
</script>

<style lang="scss" scoped>
/* 将原有的样式复制到这里 */
.input-area {
  // position: static;
  position: relative;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 20rpx;
  z-index: 5;

  // border-top: 1px solid rgba(0, 242, 255, 0.15);
  // box-shadow: 0 -2rpx 10rpx rgba(0, 0, 0, 0.05);

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
    font-weight: normal;
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
  align-items: flex-end;
  width: 100%;
  background-color: #fff;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  border-radius: 30rpx;
  padding: 0 15rpx 0 25rpx;
  box-sizing: border-box;
  flex-wrap: wrap;
  position: relative;

  // overflow-y: scroll;
  height: auto;
  min-height: 0 !important;
}

.textarea_open {
  width: 29rpx;
  height: 29rpx;
  position: absolute;
  top: 23rpx;
  right: 27rpx;
  z-index: 5;
}

.search-icon {
  width: 40rpx;
  height: 40rpx;
  margin-right: 16rpx;
}

.search-input {
  flex: none;
  border: none;
  font-size: 36rpx;
  color: rgb(0 0 0) !important;
  font-weight: normal;
  font-family: AlimamaFangYuanTi;
  outline: none;
  width: 70%;
  background: transparent;
  box-sizing: border-box;
  height: auto;
}

.is_ios {
  margin: 0 !important;
  line-height: 1 !important;
}

.no_ios {
  line-height: 1.2 !important;
}

.search-right {
  width: auto;
  height: auto;
  margin-right: 0;
  border-radius: 0 26px 26px 0;
  box-sizing: border-box;
  display: flex;
  justify-content: space-around;
  align-items: center;
  position: absolute;
  right: 6rpx;
  bottom: calc(50% - 26rpx);
  z-index: 2;
}

.search-box1 {
  width: 50rpx;
  height: 44rpx;

  // margin-top: 24rpx;
  display: flex;
  align-items: center;
  flex: none;

  // position: absolute;
  // bottom: 0;
  // z-index: 999;
  margin-right: 20rpx;
}

.search-box1-img {
  width: 38rpx;
  height: 40rpx;
  display: block;
}

.search-box2 {
  width: 44rpx;
  height: 44rpx;
}

.search-box2-img {
  width: 44rpx;
  height: 44rpx;
}

.search-box3 {
  width: auto;
  display: flex;
  justify-content: center;
  align-items: center;
}

.search-box3-img {
  width: 40rpx;
  height: 23rpx;
}

.toodown-box {
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

.toodown {
  width: 100%;
  height: 28.81rpx;
  display: flex;
  justify-content: center;
  margin-top: 15rpx;

  .toodownimg {
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
  width: 300rpx;
  height: 40rpx;
  flex: none;
  margin: 0 auto;
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
  0%,
  100% {
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
  margin: 10rpx auto 8rpx;
  width: calc(100% - 100rpx);
  gap: 16rpx;
  position: fixed;
  bottom: 170rpx;
  left: 0;
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
  font-size: 18rpx;
  font-family: AlimamaFangYuanTi;
}

.button-group-box-inner:first-child {
  color: rgb(0 0 0 / 0.6);
}

.custom-carousel-wrapper {
  border: 1px solid rgb(156 156 156 / 0.3);
  box-shadow: 0 0 6px 0 rgb(86 71 250 / 0.3);
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
  box-shadow: 0 0 4rpx rgb(0 0 0 / 0.3);
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

.chu_box {
  bottom: 224rpx !important;

  .chu-inner {
    justify-content: flex-start;

    .chu-content {
      width: 284rpx;
      max-height: 500rpx;
      height: 500rpx;
      justify-content: flex-start;

      .chu-row {
        height: 60rpx;
        flex: none;

        .chu-text {
          font-size: 24rpx !important;
        }

        .chu-icon {
          width: 23rpx !important;
          height: 18rpx !important;
        }
      }
    }
  }
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

.imgs_list_item {
  position: relative;
  width: auto;
  flex: none;

  .imgs_list_close {
    position: absolute;
    top: 5rpx;
    right: 5rpx;
    width: 30rpx;
    height: 30rpx;
    z-index: 1000;
    background-color: #fff;
    border-radius: 100px;
  }

  .imgs_list_item_img {
    width: 100%;
    height: 120rpx;
    display: block;
    border-radius: 15rpx;
  }
}

.imgs_list {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 10rpx;
  left: 0;
  right: 0;
  z-index: 1;
  width: 100%;
  padding:  0 0 20rpx;
  box-sizing: border-box;
  overflow-x: auto;
  flex: none;
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

  // box-shadow: 0px 0 4px 0px rgba(0, 0, 0, 0.15);
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

@keyframes slideLeft {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(-3330%);
  }
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

.btn_join {
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


.input-area-back {
  background: none;
  border-radius: 30rpx;
  overflow: hidden;

  // border: 2px solid #d7aefc;
  // width: 100%;
  // box-shadow: 4rpx 4rpx 11rpx 5rpx rgba(0, 0, 0, 0.3),0rpx 6rpx 20rpx 0rpx rgba(255, 255, 255, 0.8);
  box-shadow: 0 4rpx 16rpx -4rpx rgb(90 87 255 / 0.5);
  transition: box-shadow 0.3s ease;
  animation: inputAreaBackAnimation 2s linear infinite;
  -moz-animation: inputareabackanimation 2s linear infinite;
  -webkit-animation: inputareabackanimation 2s linear infinite;
  -o-animation: inputareabackanimation 2s linear infinite;
}

// 定义循环动画
@keyframes inputAreaBackAnimation {
  0% {
    box-shadow: 0 4rpx 16rpx -4rpx rgb(90 87 255 / 0.5);
  }

  50% {
    box-shadow: 0 2rpx 16rpx -8rpx rgb(90 87 255 / 0.5);
  }

  100% {
    box-shadow: 0 4rpx 16rpx -4rpx rgb(90 87 255 / 0.5);
  }
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
    top: 0;
    height: 65rpx;
  }
}

.search_box_bor {
  border-radius: 30rpx;
}

.search_box {
  border-radius: 30rpx;
}

.search_boxa {
  border-radius: 30rpx;
}

.input_area_active {
  position: fixed !important;
  left: 0;
  right: 0;
  z-index: 999;
}

.textarea_input_isShowIcon {
  padding-bottom: 80rpx !important;
}

.textarea_input {
  min-height: 300rpx;
}

.textarea_int {
  font-size: 30rpx;
}

.scroll-container {
  width: 100%;
  overflow: hidden;
}

.scroll-content {
  display: flex;
  white-space: nowrap;
  animation: slideLeft 10s linear infinite;
}

.scroll-separator {
  width: 40rpx;
  display: inline-block;
}

.module_box {
  display: flex;
  align-items: center;
  justify-content: center;
}

.page_agent_variables_container {
  padding: 10rpx 0;
}

.page_agent_variables_scroll {
  max-height: 300rpx;
}

.page_agent_can {
  padding: 10rpx 0;
}

.page_agent_list {
  margin-bottom: 10rpx;
}

.page_can_tit {
  font-size: 24rpx;
  color: #666;
  margin-bottom: 8rpx;
}

.page_can_con {
  display: flex;
  align-items: center;
}

.page_can_input {
  flex: 1;
  height: 60rpx;
  border: 1px solid #ddd;
  border-radius: 10rpx;
  padding: 0 16rpx;
  font-size: 26rpx;
}

.search_suo {
  right: 60rpx !important;
}

.line {
  flex: 1;
  height: 1rpx;
  background-color: #e0e0e0;
}
</style>