<template>
    <view class="input_body">
        <InputArea :needBottom="false" :isIOS="isIos" :prompt="searchText" @send-message="onSearch" :showFile="false"
            :isShowIcon="isShowIcon" :imgsList="imgsList" :modelName="modelName"
            :isVoiceAnimationActive="isVoiceAnimationActive" :isVoiceInput="isVoiceInput" :isLoading="loading"
            :statusBarHeight="String(statusBarHeight)" :titleBarHeight="String(titleBarHeight)" 
            :placeholderStyle="placeholderStyle" :inputFocused="inputFocused" :textarea_int="textarea_int"
            :isVoiceAnimationActiveStart="isVoiceAnimationActiveStart" :isClear="isCleara"
            @toggle-super-agent="toggleSuperAgent" @toggle-voice-input="toggleVoiceInput"
            @start-long-press="startLongPress" @end-long-press="endLongPress" @input-focus="handleInputFocus"
            @input-blur="handleInputBlur" @input-click="handleInputClick" @start-voice-animation="startVoiceAnimation"
            @stop-voice-animation="stopVoiceAnimation" @fangda="handleFangda" @update:prompt="updatePrompt"
            @update:isClear="isClearaUpdate" :showSend="true" :fromPath="fromPath" />
    </view>
</template>
<script setup>
import { ref, nextTick, onBeforeUnmount } from 'vue';
import InputArea from '../InputArea.vue';
import { fetchAudioText } from '@/service/login.js';

const props = defineProps({
    width: {
        type: String,
        default: 'calc(100% - 40rpx)'
    },
    isIos: {
        type: Boolean,
        default: false
    },
    textarea_int: {
        type: Boolean,
        default: true
    },
    statusBarHeight: {
        type: Number,
        default: 0
    },
    titleBarHeight: {
        type: Number,
        default: 0
    },
    fromPath: {
        type: String,
        default: 'nomal'
    }
});

const emit = defineEmits(['change']);

const loading = ref(false);
const searchText = ref('');
const isShowIcon = ref(false);
const imgsList = ref([]);
const modelName = ref('Doubao-1.6');
const isVoiceInput = ref(false);
const isInputVisible = ref(true);
const isVoiceAnimationActive = ref(false);
const isVoiceAnimationActiveStart = ref(false);
const inputFocused = ref(false);
const isCleara = ref(false);
const placeholderStyle = ref('请输入描述');
const prompt = ref('');
const fangda = ref(false);
const isRecording = ref(false);
const recordManagerai = ref(null);
const newRecorder = ref(null);
const showKeyboard = ref(false);
const isAuthorizingVoice = ref(false);
const pluginPreloaded = ref(false);
const timeout = ref(null);
const isLongPress = ref(false);
const sourceIsAgent = ref(false);
const sourceIs = ref(false);
const isFocused = ref(false);
const pressStartTime = ref(0);

nextTick(() => {
    // #ifdef MP-WEIXIN
    preloadVoicePlugin();
    // #endif
});

onBeforeUnmount(() => {
    clearTimeout(timeout.value);
});

function clear() {
    searchText.value = '';
}

function toggleVoiceInput() {
    isInputVisible.value = !isInputVisible.value;
    isVoiceAnimationActive.value = !isInputVisible.value;
}

function startVoiceAnimation() {
    isVoiceAnimationActiveStart.value = true;
    showKeyboard.value = false;
    // #ifdef APP-PLUS
    startActualRecord();
    return;
    // #endif
    startVoiceRecognition();
}

function stopVoiceAnimation() {
    isVoiceAnimationActiveStart.value = false;
    inputFocused.value = false;
    stopVoiceRecognition();
}

function startActualRecord() {
    isVoiceAnimationActiveStart.value = true;
    showKeyboard.value = false;
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
                        searchText.value = result;
                        emit('change', searchText.value);
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
    isVoiceAnimationActive.value = false;
    isVoiceAnimationActiveStart.value = false;
    isLongPress.value = false;
    isRecording.value = false;
    inputFocused.value = false;
}

function stopVoiceRecognition() {
    // #ifdef APP-PLUS
    isVoiceAnimationActive.value = false;
    if (newRecorder.value) {
        try { newRecorder.value.stop(); } catch (e) {}
        newRecorder.value = null;
    }
    resetVoiceState();
    return;
    // #endif
    // #ifdef MP-WEIXIN
    isVoiceAnimationActive.value = false;
    if (!isRecording.value) return;
    try {
        if (recordManagerai.value) recordManagerai.value.stop();
    } catch (e) {}
    isRecording.value = false;
    inputFocused.value = false;
    // #endif
}

async function startVoiceRecognition() {
    if (isRecording.value) return;
    showKeyboard.value = false;
    inputFocused.value = false;
    // #ifdef MP-WEIXIN
    try {
        const ok = preloadVoicePlugin();
        if (!ok) {
            uni.showToast({ title: '语音识别暂时不可用', icon: 'none' });
            return;
        }
        const authStatus = await getRecordAuthStatus();
        if (authStatus === 'authorized') {
            await startRecording();
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
    } catch (e) {
        isAuthorizingVoice.value = false;
    }
    // #endif
    // #ifndef MP-WEIXIN
    uni.showToast({ title: '请在微信小程序内使用语音搜索', icon: 'none' });
    // #endif
}

function preloadVoicePlugin(forceReinit) {
    // #ifdef MP-WEIXIN
    if (pluginPreloaded.value && !forceReinit) {
        if (recordManagerai.value) setupRecordCallbacks();
        return true;
    }
    try {
        const plugin = requirePlugin('WechatSI');
        if (!plugin || typeof plugin.getRecordRecognitionManager !== 'function') return false;
        recordManagerai.value = plugin.getRecordRecognitionManager();
        setupRecordCallbacks();
        pluginPreloaded.value = true;
        return true;
    } catch (e) {
        return false;
    }
    // #endif
    // #ifndef MP-WEIXIN
    return false;
    // #endif
}

function setupRecordCallbacks() {
    if (!recordManagerai.value) return;
    recordManagerai.value.onStop = (res) => {
        isRecording.value = false;
        showKeyboard.value = false;
        if (res.result && res.result.trim()) {
            searchText.value = res.result;
            emit('change', searchText.value);
        }
    };
    recordManagerai.value.onStart = () => { isRecording.value = true; };
    recordManagerai.value.onError = () => {
        isRecording.value = false;
        showKeyboard.value = false;
        uni.showToast({ title: '请重说', icon: 'none' });
    };
}

function showGoToSettingsTip() {
    uni.showModal({
        title: '权限申请',
        content: '使用语音功能需要您授权麦克风权限，请在设置中开启',
        confirmText: '去设置',
        cancelText: '取消',
        success: (res) => {
            if (res.confirm) uni.openSetting();
        }
    });
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

async function startRecording() {
    try {
        isRecording.value = true;
        if (recordManagerai.value) {
            recordManagerai.value.start({
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

function startLongPress(e) {
    clearTimeout(timeout.value);
    pressStartTime.value = Date.now();
    timeout.value = setTimeout(() => {
        isLongPress.value = true;
        handleLongPress(e);
    }, 500);
}

function endLongPress() {
    clearTimeout(timeout.value);
    inputFocused.value = false;
    if (isLongPress.value) {
        stopVoiceAnimation();
    }
    isLongPress.value = false;
    isVoiceAnimationActive.value = false;
}

function handleLongPress(e) {
    if (isLongPress.value) {
        isVoiceAnimationActive.value = true;
        startVoiceAnimation();
    }
}

function toggleSuperAgent() {
    sourceIsAgent.value = !sourceIsAgent.value;
    sourceIs.value = false;
    isShowIcon.value = false;
    inputFocused.value = false;
}

function onSearch(text) {
    searchText.value = text;
    emit('change', text);
}

function handleInputFocus() {
    sourceIs.value = false;
    sourceIsAgent.value = false;
    inputFocused.value = true;
    isFocused.value = true;
}

function handleInputBlur() {
    inputFocused.value = false;
}

function handleInputClick() {
    sourceIs.value = false;
    sourceIsAgent.value = false;
}

function handleFangda() {
    fangda.value = !fangda.value;
}

function updatePrompt(newValue) {
    prompt.value = newValue;
}

function isClearaUpdate(newVal) {
    isCleara.value = newVal;
}
</script>
<style lang="scss" scoped>
.input_body {
    margin: 0 0;
    box-sizing: border-box;
    width: 100%;
}

::v-deep .input-area {
    position: relative !important;
}
</style>