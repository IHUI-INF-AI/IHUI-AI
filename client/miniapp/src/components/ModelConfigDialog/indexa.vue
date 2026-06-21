<template>
    <view class="model_config_dialog">
        <view class="config_form">
            <view class="icon-button-group" style="width: 100%;justify-content: space-between;padding: 20rpx 0 0;">
                <view class="icon-button" @click="uploadFirstFrame">
                    <view class="image-container">
                        <image v-if="!firstFrameUrl" src="/static/images/icon-album.png" mode="widthFix" style="width: 74rpx;" class="icon-imagea"/>
                        <image v-else :src="firstFrameUrl" mode="aspectFill" style="width: 74rpx; height: 74rpx; border-radius: 8rpx;" class="icon-imagea"/>
                        <view v-if="firstFrameUrl" class="delete-button" @click.stop="deleteFirstFrame">
                            <image src="/static/images/close_input.png" mode="widthFix" style="width: 32rpx; height: 32rpx;" />
                        </view>
                    </view>
                    <text class="icon-text">{{ firstFrameName || '添加首帧图' }}</text>
                </view>
                <view class="icon-button" @click="uploadLastFrame">
                    <view class="image-container">
                        <image v-if="!lastFrameUrl" src="/static/images/icon-album.png" mode="widthFix" style="width: 74rpx;" class="icon-imagea"/>
                        <image v-else :src="lastFrameUrl" mode="aspectFill" style="width: 74rpx; height: 74rpx; border-radius: 8rpx;" class="icon-imagea"/>
                        <view v-if="lastFrameUrl" class="delete-button" @click.stop="deleteLastFrame">
                            <image src="/static/images/close_input.png" mode="widthFix" style="width: 32rpx; height: 32rpx;" />
                        </view>
                    </view>
                    <text class="icon-text">{{ lastFrameName || '添加尾帧图' }}</text>
                </view>
                <view class="icon-button audio-button-wrapper" @click="showAudioMenu">
                    <view class="image-container">
                        <image v-if="!audioUrl" src="/static/images/icon-yinpin.png" mode="widthFix" style="width: 74rpx;" class="icon-imagea"/>
                        <image v-else src="/static/images/icon-audio-success.png" mode="widthFix" style="width: 74rpx;" class="icon-imagea"/>
                        <view v-if="audioUrl" class="delete-button" @click.stop="deleteAudio">
                            <image src="/static/images/close_input.png" mode="widthFix" style="width: 32rpx; height: 32rpx;" />
                        </view>
                    </view>
                    <text class="icon-text">{{ audioName || '参考音色' }}</text>
                    
                    <view v-if="showAudioMenuPopup" class="audio-menu-popup" @click.stop>
                        <view class="audio-menu-content">
                            <view class="audio-menu-header">
                                <text class="audio-menu-title">选择音色</text>
                                <view class="audio-menu-close" @click="showAudioMenuPopup = false">
                                    <image src="/static/images/close_input.png" mode="widthFix" style="width: 32rpx; height: 32rpx;" />
                                </view>
                            </view>
                            <view class="audio-menu-body">
                                <view class="audio-menu-item" @click="selectVoice">
                                    <view class="audio-menu-item-icon">
                                        <image src="/static/images/icon-yinpin.png" mode="widthFix" style="width: 40rpx;" />
                                    </view>
                                    <view class="audio-menu-item-text">
                                        <text class="audio-menu-item-title">选择音色</text>
                                        <text class="audio-menu-item-desc">{{ audioName ? '当前：' + audioName : '从系统音色库中选择' }}</text>
                                    </view>
                                    <view class="audio-menu-item-arrow">
                                        <image src="/static/images/icon-arrow-right.png" mode="widthFix" style="width: 24rpx;" />
                                    </view>
                                </view>
                                <view class="audio-menu-item" @click="cloneVoice">
                                    <view class="audio-menu-item-icon">
                                        <image src="/static/images/icon-kelong.png" mode="widthFix" style="width: 40rpx;" />
                                    </view>
                                    <view class="audio-menu-item-text">
                                        <text class="audio-menu-item-title">克隆音色</text>
                                        <text class="audio-menu-item-desc">上传音频文件克隆音色</text>
                                    </view>
                                    <view class="audio-menu-item-arrow">
                                        <image src="/static/images/icon-arrow-right.png" mode="widthFix" style="width: 24rpx;" />
                                    </view>
                                </view>
                            </view>
                        </view>
                    </view>
                </view>
                
                <view v-if="showRecordDialog" class="record-dialog-overlay" @click="showRecordDialog = false">
                    <view class="record-dialog-content" @click.stop>
                        <view class="record-dialog-header">
                            <text class="record-dialog-title">音色克隆</text>
                            <view class="record-dialog-close" @click="showRecordDialog = false">
                                <image src="/static/images/close_input.png" mode="widthFix" style="width: 32rpx; height: 32rpx;" />
                            </view>
                        </view>
                        <view class="record-dialog-body">
                            <view class="record-text-container">
                                <text class="record-text-label">请朗读以下文本：</text>
                                <view class="record-text-box">
                                    <text class="record-text">{{ recordText }}</text>
                                </view>
                            </view>
                            <view class="record-status-container">
                                <text class="record-status-text">
                                    {{ isRecording ? `录音中... ${recordDuration}秒` : '点击下方按钮开始录音' }}
                                </text>
                            </view>
                            <view class="record-button-container">
                                <view 
                                    class="record-button" 
                                    :class="{ 'recording': isRecording }"
                                    @click="isRecording ? stopRecord() : startRecord()"
                                >
                                    <image 
                                        v-if="!isRecording" 
                                        src="/static/images/icon-record.png" 
                                        mode="widthFix" 
                                        style="width: 80rpx; height: 80rpx;" 
                                    />
                                    <image 
                                        v-else 
                                        src="/static/images/icon-stop.png" 
                                        mode="widthFix" 
                                        style="width: 80rpx; height: 80rpx;" 
                                    />
                                </view>
                                <text class="record-button-text">{{ isRecording ? '停止录音' : '开始录音' }}</text>
                            </view>
                            <view class="record-tips">
                                <text class="record-tips-text">建议录音时长10-30秒，请确保环境安静</text>
                            </view>
                        </view>
                    </view>
                </view>
                
                <view class="icon-button" @click="uploadVideo">
                    <view class="image-container">
                        <image v-if="!videoUrl" src="/static/images/icon-kelong.png" mode="widthFix" style="width: 74rpx;" class="icon-imagea"/>
                        <image v-else src="/static/images/icon-video-success.png" mode="widthFix" style="width: 74rpx;" class="icon-imagea"/>
                        <view v-if="videoUrl" class="delete-button" @click.stop="deleteVideo">
                            <image src="/static/images/close_input.png" mode="widthFix" style="width: 32rpx; height: 32rpx;" />
                        </view>
                    </view>
                    <text class="icon-text">{{ videoName || '克隆数字人' }}</text>
                </view>
            </view>
            
            <view v-if="false">
                <text class="font_t title">选择系统音色</text>
                <picker v-model="selectedVoiceIndex" :range="systemVoices" :range-key="'remark'" @change="voiceChange">
                    <view class="uni-input" style="color: #000000;">
                        {{ selectedVoiceName }}
                    </view>
                </picker>
            </view>
            
            <view v-for="item in variables" :key="item.name" v-if="shouldShowItem(item)">
                <view class="f_b" v-if="isBooleanOption(item.value)">
                    <text class="font_t title">{{ item.desc }}</text>
                    <view class="switch_wrapper" 
                        :style="{ backgroundColor: getConfigValue(item.name) ? '#E0E1FC' : '#C4C4C4' }"
                        @click="toggleSwitch(item.name)">
                        <view class="switch_input" :style="{ backgroundColor: getConfigValue(item.name) ? '#7B61FF' : '#FFFFFF' }">
                        </view>
                    </view>
                </view>
                
                <view v-else-if="isArrayOption(item.value) && item.value.length > 0 && item.value[0] !== true && item.value[0] !== false">
                    <text class="font_t title">{{ item.desc }}</text>
                    <selecter :options="item.value" :desc="item.desc" :type="isSizeType(item.value) ? 'ratio' : ''" @change="(val) => setConfigValue(item.name, val)" />
                </view>
                
                <view v-else>
                    <text class="font_t title">{{ item.desc }}</text>
                    <input class="dom_input" :value="getConfigInputValue(item.name)" type="text" 
                        :placeholder="`请输入${item.desc}`" @input="(e) => setConfigInputValue(item.name, e.target.value)">
                </view>
            </view>
        </view>
    </view>
</template>
<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import selecter from './selecter.vue';
import request from '../../utils/service/index.js';
import { uploadBybase64a } from '../../service/businessCard.js';
import { readFileToBase64 } from '@/utils/readFileToBase64.js';
import { aliGenerateTimbre } from '../../service/aiModels.js';

const props = defineProps({
    modelName: String,
    modelNameEN: String,
    modelInfo: Object,
    imgsList: Array,
    fromPath: String,
    modelConfigChangeData: Object
});

const emit = defineEmits(['change']);

onMounted(() => {
    fetchSystemVoices();
    if (props.modelInfo) {
        parseModelInfo(props.modelInfo);
    }
});

const imageOp = ref({});
const scale = ref([]);
const scaleKey = ref('size');
const freedom = ref(0.5);
const freedomKey = 'scale';
const negative = ref('');
const negativeKey = 'negative_prompt';
const useNegative = ref(false);
const frames = ref(121);
const framesKey = 'frames';
const imageCounts = ref([]);
const imageCount = ref(0);
const countTip = ref('');
const imageSizeByK = ref([]);
const typeOp = ref(['可爱', '酷炫', '科技', '国风', '动画']);
const watermark = ref(false);
const logo_info = ref({
    add_logo: false,
    position: 2,
    language: 0,
    opacity: 1,
    logo_text_content: ''
});
const shuiyinweizhiOp = ref(['右下角', '左下角', '左上角', '右上角']);
const shuiyinweizhiValue = ref('右下角');
const isVideoModel = ref(false);
const videoDuration = ref(5);
const videoDurationOptions = ref([3, 5, 10, 15]);
const videoMovement = ref('平移');
const videoMovementOptions = ref(['平移', '缩放', '旋转', '跟踪']);
const systemVoices = ref(['默认音色', '甜美女声', '成熟男声', '清澈童声', '专业播音', '情感朗读']);
const selectedVoice = ref('默认音色');
const selectedVoiceIndex = ref(0);
const showAudioMenuPopup = ref(false);
const showRecordDialog = ref(false);
const recordText = ref('我正在录制智汇 AI 定制克隆声音。通过这段录制，你将拥有一个与自己声音高度相似的 AI 语音模型。这个模型的应用场景十分丰富，无论是制作专属于你的个性化语音助手，让它在日常中为你提供便捷服务，还是生成专属的音频内容，比如有声书、短视频旁白、节日祝福语音等等，都能轻松实现。');
const isRecording = ref(false);
const recordDuration = ref(0);
const recordTimer = ref(null);
const enhanceClarity = ref(false);
const usePromptExtend = ref(false);
const firstFrameUrl = ref('');
const lastFrameUrl = ref('');
const audioUrl = ref('');
const videoUrl = ref('');
const firstFrameName = ref('');
const lastFrameName = ref('');
const audioName = ref('');
const videoName = ref('');
const variables = ref([]);
const configParamsObj = ref({});
const setVariables = ref([]);
const configVal = ref({});
const configIndex = ref(0);
const size = ref('');
const scaleVal = ref('');
const type = ref('');

const modelOptions = ref({
    'qwen-image': ['negative', 'scale', 'count', 'type', 'freedom', 'watermark'],
    'qwen-image-Edit': ['scale'],
    'wan2.5-i2v-plus': ['negative', 'scale', 'duration', 'movement', 'frames', 'watermark', 'enhanceClarity'],
    'hunyuanTo3D': [],
    'qwen-plus': [],
    'Doubao-1.6': [],
    'GLM-4.5': [],
    'Nano_Banana': [],
    'doubao-seedream-4.0': ['negative', 'size', 'scale', 'count', 'type', 'freedom', 'watermark', 'logo_info'],
    'volcengine-t2v': ['negative', 'scale', 'frames', 'duration', 'movement', 'watermark', 'enhanceClarity']
});

const imageSizes = ref({
    'qwen-image': {
        '1:1': '1328*1328',
        '3:4': '1140*1472',
        '4:3': '1472*1140',
        '16:9': '1664*928',
        '9:16': '928*1664'
    },
    'qwen-image-Edit': {
        '1:1': '1328*1328',
        '3:4': '1140*1472',
        '4:3': '1472*1140',
        '16:9': '1664*928',
        '9:16': '928*1664'
    },
    'doubao-seedream-4.0': {
        '1k': {
            '1:1': '1024x1024',
            '4:3': '1152x864',
            '3:2': '1248x832',
            '16:9': '1280x720',
            '21:9': '1512x648',
        },
        '2k': {
            '1:1': '2048x2048',
            '4:3': '2304x1728',
            '3:2': '2496x1664',
            '16:9': '2560x1440',
            '21:9': '3024x1296',
        },
        '4k': {
            '1:1': '4096x4096',
            '4:3': '4736x3552',
            '3:2': '5024x3360',
            '16:9': '5472x2072',
            '21:9': '6272x2688',
        }
    },
    'volcengine-t2v': {
        '1:1': '1:1',
        '3:4': '3:4',
        '4:3': '4:3',
        '16:9': '16:9',
        '9:16': '9:16',
        '21:9': '21:9',
    }
});

const configList = ref([
    { name: '风格', id: 'type' },
    { name: '比例', id: 'scale' },
    { name: '分辨率', id: 'size' },
    { name: '图片数量', id: 'count' },
    { name: '视频帧数', id: 'frames' },
    { name: '自由度', id: 'freedom' },
    { name: '反向提示词', id: 'negative' },
    { name: '水印', id: 'watermark' },
]);
const configValRef = ref({});

const selectedVoiceName = computed(() => {
    if (!selectedVoice.value) {
        return '请选择音色';
    }
    return typeof selectedVoice.value === 'object' ? selectedVoice.value.remark : selectedVoice.value;
});

function parseModelInfo(modelInfo) {
    if (modelInfo && modelInfo.variables == undefined) {
        return;
    }
    
    let variablesArray = modelInfo.variables;
    
    if (typeof variablesArray === 'string') {
        try {
            variablesArray = JSON.parse(variablesArray);
        } catch (e) {
            return;
        }
    }
    
    if (!Array.isArray(variablesArray)) {
        return;
    }
    
    const parsedVariables = [];
    
    variablesArray.forEach(variable => {
        if (variable && variable.name && variable.desc !== undefined && variable.value !== undefined) {
            parsedVariables.push({
                name: variable.name,
                desc: variable.desc,
                value: variable.value
            });
        }
    });
    if (parsedVariables.length > 0) {
        variables.value = parsedVariables;
        initSetVariables();
    }
}

function initSetVariables() {
    firstFrameUrl.value = '';
    firstFrameName.value = '';
    lastFrameUrl.value = '';
    lastFrameName.value = '';
    audioUrl.value = '';
    audioName.value = '';
    videoUrl.value = '';
    videoName.value = '';
    
    setVariables.value = [];
    variables.value.forEach(item => {
        let initialValue = '';
        
        if (isBooleanOption(item.value)) {
            initialValue = false;
        } else if (isArrayOption(item.value) && item.value.length > 0) {
            initialValue = item.value[0];
        } else {
            initialValue = item.value || '';
        }
        
        setVariables.value.push({
            name: item.name,
            desc: item.desc,
            value: initialValue
        });
    });
    emit('change', { ...configParamsObj.value, setVariables: setVariables.value });
}

function updateSetVariable(name, value) {
    const index = setVariables.value.findIndex(item => item.name === name);
    if (index !== -1) {
        setVariables.value[index].value = value;
    } else {
        const variableInfo = variables.value.find(item => item.name === name);
        if (variableInfo) {
            setVariables.value.push({
                name: name,
                desc: variableInfo.desc,
                value: value
            });
        }
    }
    emit('change', { ...configParamsObj.value, setVariables: setVariables.value });
}

function shouldShowItem(item) {
    if (['duration', 'movement', 'frames', 'enhanceClarity'].includes(item.name)) {
        return isVideoModel.value;
    }
    return true;
}

function isBooleanOption(value) {
    return Array.isArray(value) && value.length === 2 && 
           value[0] === true && value[1] === false;
}

function isArrayOption(value) {
    return Array.isArray(value);
}

function isSizeType(value) {
    if (!Array.isArray(value) || value.length === 0) {
        return false;
    }
    const firstItem = value[0];
    if (typeof firstItem === 'object' && firstItem !== null) {
        const keys = Object.keys(firstItem);
        return keys.some(key => key.toLowerCase().includes('k'));
    }
    return false;
}

function getConfigValue(name) {
    const valueMap = {
        'watermark': watermark.value,
        'enhanceClarity': enhanceClarity.value,
        'prompt_extend': usePromptExtend.value || false
    };
    return valueMap[name] || false;
}

function setConfigValue(name, value) {
    switch(name) {
        case 'size':
            size.value = value;
            break;
        case 'scale':
            scaleVal.value = value;
            break;
        case 'n':
            imageCount.value = value;
            break;
        case 'duration':
            videoDuration.value = value;
            break;
        case 'movement':
            videoMovement.value = value;
            break;
        case 'type':
            type.value = value;
            break;
        case 'seed':
            freedom.value = Number(value);
            break;
        case 'frames':
            frames.value = Number(value);
            break;
        case 'prompt_extend':
            usePromptExtend.value = value;
            break;
    }
    
    updateSetVariable(name, value);
}

function getConfigInputValue(name) {
    const valueMap = {
        'negative_prompt': negative.value,
        'freedom': freedom.value.toString()
    };
    return valueMap[name] || '';
}

function setConfigInputValue(name, value) {
    switch(name) {
        case 'negative_prompt':
            negative.value = value;
            break;
        case 'freedom':
            freedom.value = Number(value);
            break;
    }
    
    updateSetVariable(name, value);
}

function toggleSwitch(name) {
    let newValue = false;
    
    switch(name) {
        case 'watermark':
            switchChange1();
            newValue = watermark.value;
            break;
        case 'enhanceClarity':
            toggleEnhanceClarity();
            newValue = enhanceClarity.value;
            break;
        case 'prompt_extend':
            usePromptExtend.value = !usePromptExtend.value;
            newValue = usePromptExtend.value;
            break;
    }
    
    updateSetVariable(name, newValue);
}

function showConfigItem(item, index) {
    configVal.value = item;
    configIndex.value = index;
}

function reset(name) {
    firstFrameUrl.value = '';
    firstFrameName.value = '';
    lastFrameUrl.value = '';
    lastFrameName.value = '';
    audioUrl.value = '';
    audioName.value = '';
    videoUrl.value = '';
    videoName.value = '';
    
    if (name === 'volcengine-t2v') {
        scaleKey.value = 'aspect_ratio';
        framesKey.value = 'frames';
        frames.value = 121;
        
        emit('change', configParamsObj.value);
    } else {
        countTip.value = "";
        configParamsObj.value = {};
    }
}

function framesBlur(e) {
    try {
        let val = Math.round(e.detail.value);
        if (val < 121) {
            val = 121;
        } else if (val > 241) {
            val = 241;
        }

        frames.value = val;

        configParamsObj.value[framesKey] = val;
        emit('change', configParamsObj.value);
    } catch (error) {
        frames.value = 121;
        configParamsObj.value[framesKey] = 121;
        emit('change', configParamsObj.value);
    }
}

function switchChange1() {
    watermark.value = !watermark.value;
    if (watermark.value) {
        configParamsObj.value.watermark = true;
    } else {
        configParamsObj.value.watermark = false;
    }
    emit('change', configParamsObj.value);
}

function toggleEnhanceClarity() {
    enhanceClarity.value = !enhanceClarity.value;
    if (enhanceClarity.value) {
        configParamsObj.value.enhance_clarity = true;
    } else {
        configParamsObj.value.enhance_clarity = false;
    }
    emit('change', configParamsObj.value);
}

function voiceChange(e) {
    try {
        const index = e.detail.value;
        if (systemVoices.value && systemVoices.value[index]) {
            selectedVoice.value = systemVoices.value[index];
            selectedVoiceIndex.value = index;
        } else {
            selectedVoice.value = systemVoices.value[0] || '默认音色';
            selectedVoiceIndex.value = 0;
        }
    } catch (error) {
        selectedVoice.value = systemVoices.value[0] || '默认音色';
        selectedVoiceIndex.value = 0;
    }
}

function fetchSystemVoices() {
    request({
        url: '/ali/audio/sys',
        method: 'get',
        base: 1
    }).then(res => {
        if (res.data && Array.isArray(res.data)) {
            systemVoices.value = res.data;
            if (systemVoices.value.length > 0) {
                selectedVoiceIndex.value = 0;
                selectedVoice.value = systemVoices.value[0];
            }
        }
    }).catch(err => {
        systemVoices.value = ['默认音色', '甜美女声', '成熟男声', '清澈童声', '专业播音', '情感朗读'];
        selectedVoiceIndex.value = 0;
        selectedVoice.value = systemVoices.value[0];
    });
}

function deleteFirstFrame() {
    firstFrameUrl.value = '';
    firstFrameName.value = '';
    configParamsObj.value.firstFrame = '';
    emit('change', { ...configParamsObj.value });
}

function deleteLastFrame() {
    lastFrameUrl.value = '';
    lastFrameName.value = '';
    configParamsObj.value.lastFrame = '';
    emit('change', { ...configParamsObj.value });
}

function deleteAudio() {
    audioUrl.value = '';
    audioName.value = '';
    configParamsObj.value.voice = '';
    emit('change', { ...configParamsObj.value });
}

function deleteVideo() {
    videoUrl.value = '';
    videoName.value = '';
    configParamsObj.value.cloneVideo = '';
    emit('change', { ...configParamsObj.value });
}

function uploadFirstFrame() {
    uni.chooseImage({
        count: 1,
        sizeType: ['original', 'compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
            const tempFilePath = res.tempFilePaths[0];
            const fileName = res.tempFiles[0].name || '首帧图';
            firstFrameUrl.value = tempFilePath;
            firstFrameName.value = fileName;
            emit('change', { ...configParamsObj.value, firstFrame: tempFilePath });
        }
    });
}

function uploadLastFrame() {
    uni.chooseImage({
        count: 1,
        sizeType: ['original', 'compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
            const tempFilePath = res.tempFilePaths[0];
            const fileName = res.tempFiles[0].name || '尾帧图';
            lastFrameUrl.value = tempFilePath;
            lastFrameName.value = fileName;
            emit('change', { ...configParamsObj.value, lastFrame: tempFilePath });
        }
    });
}

function uploadAudio() {
    uni.chooseMessageFile({
        count: 1,
        type: 'file',
        extension: ['mp3', 'wav', 'm4a'],
        success: (res) => {
            const tempFilePath = res.tempFiles[0].path;
            const fileName = res.tempFiles[0].name || '音频文件';
            audioUrl.value = tempFilePath;
            audioName.value = fileName;
            emit('change', { ...configParamsObj.value, referenceAudio: tempFilePath });
        },
        fail: (err) => {
            uni.showToast({
                title: '选择音频文件失败',
                icon: 'none'
            });
        }
    });
}

function uploadVideo() {
    uni.chooseVideo({
        maxDuration: 60,
        success: (res) => {
            const tempFilePath = res.tempFilePath;
            const fileName = '视频文件.mp4';
            videoUrl.value = tempFilePath;
            videoName.value = fileName;
            emit('change', { ...configParamsObj.value, referenceVideo: tempFilePath });
        }
    });
}

function showAudioMenu() {
    showAudioMenuPopup.value = true;
}

function selectVoice() {
    showAudioMenuPopup.value = false;
    
    if (systemVoices.value && systemVoices.value.length > 0) {
        const voiceList = systemVoices.value.map(voice => voice.remark || voice);
        uni.showActionSheet({
            itemList: voiceList,
            success: (res) => {
                const index = res.tapIndex;
                selectedVoice.value = systemVoices.value[index];
                selectedVoiceIndex.value = index;
                audioName.value = voiceList[index];
                uni.showToast({
                    title: `已选择：${voiceList[index]}`,
                    icon: 'none'
                });
            },
            fail: (err) => {
                console.log('取消选择音色', err);
            }
        });
    } else {
        uni.showLoading({
            title: '加载音色列表...'
        });
        fetchSystemVoices();
        setTimeout(() => {
            uni.hideLoading();
            if (systemVoices.value && systemVoices.value.length > 0) {
                selectVoice();
            } else {
                uni.showToast({
                    title: '音色列表加载失败',
                    icon: 'none'
                });
            }
        }, 1000);
    }
}

function cloneVoice() {
    showAudioMenuPopup.value = false;
    showRecordDialog.value = true;
}

function startRecord() {
    const recorderManager = uni.getRecorderManager();
    
    recorderManager.onStart(() => {
        isRecording.value = true;
        recordDuration.value = 0;
        recordTimer.value = setInterval(() => {
            recordDuration.value++;
        }, 1000);
    });
    
    recorderManager.onStop((res) => {
        isRecording.value = false;
        if (recordTimer.value) {
            clearInterval(recordTimer.value);
            recordTimer.value = null;
        }
        
        const { tempFilePath } = res;
        console.log('录音完成，文件路径：', tempFilePath);
        
        uploadRecordFile(tempFilePath);
    });
    
    recorderManager.onError((err) => {
        console.error('录音失败：', err);
        isRecording.value = false;
        if (recordTimer.value) {
            clearInterval(recordTimer.value);
            recordTimer.value = null;
        }
        
        uni.showToast({
            title: '录音失败，请重试',
            icon: 'none'
        });
    });
    
    recorderManager.start({
        format: 'mp3',
        duration: 60000
    });
}

function stopRecord() {
    const recorderManager = uni.getRecorderManager();
    recorderManager.stop();
}

function uploadRecordFile(filePath) {
    console.log('开始上传录音文件，路径：', filePath);
    
    uni.showLoading({
        title: '上传中...'
    });
    
    const fileName = `audio_${recordDuration.value}s.mp3`;
    console.log('文件名：', fileName);
    
    // #ifdef MP-WEIXIN || MP-ALIPAY || APP-PLUS
    readFileToBase64(filePath).then((base64Data) => {
        return uploadBybase64a(base64Data, fileName);
    }).then(response => {
        console.log('上传响应：', response);
        uni.hideLoading();
        if (response && response.code === 200) {
            const uploadedAudioUrl = response.data;
            const copyWriting = recordText.value;
            const audioPath = uploadedAudioUrl;
            const chatId = Date.now().toString();
            uni.showLoading({ title: '正在合成语音...' });
            aliGenerateTimbre({ copyWriting, audioPath, chatId }).then(synthesisRes => {
                uni.hideLoading();
                if (synthesisRes && synthesisRes.data && synthesisRes.data.url) {
                    audioUrl.value = synthesisRes.data.url;
                    audioName.value = fileName;
                    showRecordDialog.value = false;
                    uni.showToast({ title: '音色克隆成功', icon: 'success' });
                } else {
                    uni.showToast({ title: '语音合成失败', icon: 'none' });
                }
            }).catch(synthesisErr => {
                uni.hideLoading();
                uni.showToast({ title: '语音合成失败，请重试', icon: 'none' });
            });
        } else {
            uni.showToast({ title: (response && response.msg) || '上传失败', icon: 'none' });
        }
    }).catch(err => {
        console.error('读取或上传失败：', err);
        uni.hideLoading();
        uni.showToast({ title: '读取或上传失败，请重试', icon: 'none' });
    });
    // #endif
    
    // #ifdef H5
    console.log('检测到 H5 环境');
    uni.uploadFile({
        url: 'https://bsm.aizhs.top/prod-api/file/upload',
        filePath: filePath,
        name: 'file',
        success: (res) => {
            console.log('H5上传响应：', res);
            uni.hideLoading();
            const data = JSON.parse(res.data);
            if (data.code === 200) {
                const uploadedAudioUrl = data.data.url;
                console.log('上传成功，音频URL：', uploadedAudioUrl);
                
                uni.showLoading({
                    title: '正在合成语音...'
                });
                
                const copyWriting = recordText.value;
                const audioPath = uploadedAudioUrl;
                const chatId = Date.now().toString();
                
                console.log('调用通义语音合成，参数：', { copyWriting, audioPath, chatId });
                
                aliGenerateTimbre({
                    copyWriting,
                    audioPath,
                    chatId
                }).then(synthesisRes => {
                    console.log('语音合成响应：', synthesisRes);
                    uni.hideLoading();
                    
                    if (synthesisRes && synthesisRes.data && synthesisRes.data.url) {
                        audioUrl.value = synthesisRes.data.url;
                        audioName.value = fileName;
                        showRecordDialog.value = false;
                        
                        uni.showToast({
                            title: '音色克隆成功',
                            icon: 'success'
                        });
                    } else {
                        console.error('语音合成失败，响应：', synthesisRes);
                        uni.showToast({
                            title: '语音合成失败',
                            icon: 'none'
                        });
                    }
                }).catch(synthesisErr => {
                    uni.hideLoading();
                    console.error('语音合成失败：', synthesisErr);
                    uni.showToast({
                        title: '语音合成失败，请重试',
                        icon: 'none'
                    });
                });
            } else {
                console.error('H5上传失败，响应码：', data.code, '消息：', data.msg);
                uni.showToast({
                    title: data.msg || '上传失败',
                    icon: 'none'
                });
            }
        },
        fail: (err) => {
            console.error('H5上传失败：', err);
            uni.hideLoading();
            uni.showToast({
                title: '上传失败，请重试',
                icon: 'none'
            });
        }
    });
    // #endif
}

watch(
    () => props.modelName,
    (n) => {
        reset(n);

        isVideoModel.value = n && (n.includes('t2v') || n.includes('i2v'));
        
        imageSizeByK.value = [];
        scale.value = [];
        if (imageSizes.value[n]) {
            let list = [];
            let val = '';
            for (let key in imageSizes.value[n]) {
                val = key;
                list.push(key);
            }
            if (val.indexOf(":") > 0) {
                imageOp.value = imageSizes.value[n];
                scale.value = list;
            }
            if (val.indexOf("k") > 0) {
                imageSizeByK.value = list;
            }
        }
    },
    { immediate: true }
);

watch(
    () => props.modelNameEN,
    (n) => {
        reset(n);

        isVideoModel.value = n && (n.includes('t2v') || n.includes('i2v'));
        
        imageSizeByK.value = [];
        scale.value = [];
        if (imageSizes.value[n]) {
            let list = [];
            let val = '';
            for (let key in imageSizes.value[n]) {
                val = key;
                list.push(key);
            }
            if (val.indexOf(":") > 0) {
                imageOp.value = imageSizes.value[n];
                scale.value = list;
            }
            if (val.indexOf("k") > 0) {
                imageSizeByK.value = list;
            }
        }
    },
    { immediate: true }
);

watch(
    () => props.modelInfo,
    (n) => {
        if (n && n.variables) {
            parseModelInfo(n);
        } else {
            setVariables.value = [];
            variables.value = [];
        }
    },
    { immediate: true }
);

watch(freedom, (val) => {
    configParamsObj.value[freedomKey] = val;
    updateSetVariable('freedom', val);
    emit('change', configParamsObj.value);
});

watch(
    () => watermark.value,
    (n) => {
        logo_info.value.add_logo = !!n;
    },
    { immediate: true }
);

watch(
    () => logo_info.value,
    (n) => {
        if (n.add_logo === true) {
            configParamsObj.value.logo_info = n;
        } else {
            configParamsObj.value.logo_info = {};
        }
        emit('change', configParamsObj.value);
    },
    { deep: true }
);

watch(negative, (val) => {
    if (val && useNegative.value) {
        configParamsObj.value[negativeKey] = val;
        updateSetVariable('negative_prompt', val);
        emit('change', configParamsObj.value);
    }
});

watch(
    () => props.imgsList,
    (n) => {
        if (props.modelName === 'volcengine-t2v') {
            if (n.length > 0) {
                modelOptions.value['volcengine-t2v'] = ['negative', 'frames', 'duration', 'movement', 'watermark', 'enhanceClarity'];
                reset(props.modelName);
            } else {
                modelOptions.value['volcengine-t2v'] = ['negative', 'scale', 'frames', 'duration', 'movement', 'watermark', 'enhanceClarity'];
                reset(props.modelName);
            }
        }
    },
    { immediate: true }
);

watch(frames, (n, o) => {
    if (n !== o) {
        configParamsObj.value[framesKey] = n;
        updateSetVariable('frames', n);
        emit('change', configParamsObj.value);
    }
}, { immediate: true });

watch(videoDuration, (n) => {
    configParamsObj.value.duration = n;
    updateSetVariable('duration', n);
    emit('change', configParamsObj.value);
}, { immediate: true });

watch(videoMovement, (n) => {
    configParamsObj.value.movement = n;
    updateSetVariable('movement', n);
    emit('change', configParamsObj.value);
}, { immediate: true });

watch(enhanceClarity, (n) => {
    configParamsObj.value.enhance_clarity = n;
    updateSetVariable('enhanceClarity', n);
    emit('change', configParamsObj.value);
}, { immediate: true });

watch(variables, (n) => {
    variables.value = n;
}, { immediate: true });

watch(
    () => props.modelConfigChangeData,
    (n) => {
        if (n && n.setVariables) {
            setVariables.value = n.setVariables;
            n.setVariables.forEach(item => {
                updateSetVariable(item.name, item.value);
            });
            Object.keys(n).forEach(key => {
                if (key !== 'setVariables') {
                    configParamsObj.value[key] = n[key];
                }
            });
            emit('change', configParamsObj.value);
        }
    },
    { immediate: true }
);
</script>

<style lang="scss" scoped>
.model_config_dialog {
    width: 100%;
    box-sizing: border-box;
    transition: all 0.5s ease-out;
    padding-bottom: 20rpx;
    margin-top: 20rpx;
}

.c_t_b {
    width: 100%;
    overflow-x: scroll;
    height: 72rpx;
    box-sizing: border-box;
    border-top: 1rpx solid #D8D8D8;
    padding: auto;

    .c_t_i {
        height: 50rpx;
        border-radius: 8rpx;
        padding: 0 18rpx;
        border: 1rpx solid;
        margin: 0 18rpx;
        font-size: 22rpx;
        font-weight: normal;
        line-height: 50rpx;
        white-space: nowrap;
    }
}

.active {
    backdrop-filter: blur(10rpx);
    border-color: #518dfd !important;
    background-color: #d9e6fd !important;
}

.config_form {
    width: 100%;
    box-sizing: border-box;

    .title {
        display: block;
        margin: 8rpx 0;
    }
}

.dom_input {
    width: 290rpx !important;
    height: 38rpx !important;
    border-radius: 10rpx !important;
    background: rgba(218, 218, 218, 0.37) !important;
    color: #000000 !important;
}

.tip_input {
    box-sizing: border-box !important;
    height: 38rpx !important;
    background: rgba(218, 218, 218, 0.37) !important;
    color: #000000 !important;
}

.switch_wrapper {
    width: 66rpx;
    height: 35rpx;
    border-radius: 30rpx;
    position: relative;
    transition: all 0.3s ease;

    .switch_input {
        width: 23rpx;
        height: 23rpx;
        border-radius: 100%;
        position: absolute;
        top: 7rpx;
        right: 9rpx;
        transition: all 0.3s ease;
    }
}

.switch_disabled {
    opacity: 0.6;
    cursor: not-allowed;
    user-select: none;
    pointer-events: none;
}

.uni-input {
    margin-top: 20rpx;
    margin-bottom: 30rpx;
    width: 100%;
    height: 80rpx;
    line-height: 80rpx;
    padding-left: 30rpx;
    box-sizing: border-box;
    border: 1rpx solid #E8E8E8;
    border-radius: 16rpx;
    background-color: #FFFFFF;
    font-size: 28rpx;
    color: #333333;
}

.f_b {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.font_t.title {
    font-size: 28rpx;
    font-weight: 500;
    color: #333333;
}

.icon-button-group {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    margin-bottom: 0;
}

.icon-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 10rpx 5rpx;
    width: 140rpx;
    border: 2px dashed #DFBBFF;
    background: #F4F4FF;
    border-radius: 15rpx;
    padding: 10rpx 0;
}

.image-container {
    position: relative;
    display: inline-block;
}

.delete-button {
    position: absolute;
    top: -8rpx;
    right: -16rpx;
    width: 32rpx;
    height: 32rpx;
    background-color: #ffffff;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.15);
    z-index: 10;
}

.delete-button image {
    width: 32rpx;
    height: 32rpx;
}

.icon-imagea {
    width: 74rpx !important;
    height: 74rpx !important;
    margin-bottom: 10rpx;
}

.icon-text {
    font-size: 24rpx;
    color: #333;
    text-align: center;
    line-height: 32rpx;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.color_bg {
    background: linear-gradient(239deg, #D19EFF 6%, rgba(255, 242, 0, 0.3) 32%, rgba(146, 146, 146, 0.3) 52%, rgba(255, 242, 0, 0.3) 73%, #CD96FF 93%);
    padding: 2rpx;
    border-radius: 30rpx;
    overflow: hidden;

    .color_cont {
        width: 100%;
        background-color: #fff;
        background-size: 100% 100%;
        background-repeat: no-repeat;
        border-radius: 30rpx;
        height: auto;
        box-sizing: border-box;
        padding: 23rpx 21rpx;
    }
}

.flex_column {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.f_c {
    display: flex;
    align-items: center;
    justify-content: center;
}

.f_n {
    display: flex;
    align-items: center;
}

.f_b {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.font_t {
    font-size: 24rpx;
    font-weight: 600;
    line-height: normal;
    color: #3D3D3D;
}

.font_n {}

.selecter {
    margin-top: 10rpx;
    margin-bottom: 20rpx;
}

.selecter_item {
    width: 88rpx;
    height: 38rpx;
    margin: 0 6rpx 6rpx 0;
    border: 1px solid #ddd;
    border-radius: 4rpx;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 24rpx;
    color: #666;
}

.selecter_item.active {
    border: 1px solid #7B61FF;
    color: #7B61FF;
    background-color: #F5F3FF;
}

.audio-button-wrapper {
    position: relative;
}

.audio-menu-popup {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-top: 16rpx;
    z-index: 9999;
}

.audio-menu-content {
    width: 500rpx;
    background-color: #ffffff;
    border-radius: 24rpx;
    overflow: hidden;
    box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.15);
}

.audio-menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 32rpx 32rpx 24rpx;
    border-bottom: 1rpx solid #E8E8E8;
}

.audio-menu-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333333;
}

.audio-menu-close {
    width: 48rpx;
    height: 48rpx;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
}

.audio-menu-body {
    padding: 16rpx 0;
}

.audio-menu-item {
    display: flex;
    align-items: center;
    padding: 24rpx 32rpx;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.audio-menu-item:active {
    background-color: #F5F5F5;
}

.audio-menu-item-icon {
    width: 80rpx;
    height: 80rpx;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #F5F3FF;
    border-radius: 16rpx;
    margin-right: 24rpx;
}

.audio-menu-item-text {
    flex: 1;
    display: flex;
    flex-direction: column;
}

.audio-menu-item-title {
    font-size: 28rpx;
    font-weight: 500;
    color: #333333;
    margin-bottom: 8rpx;
}

.audio-menu-item-desc {
    font-size: 24rpx;
    color: #999999;
}

.audio-menu-item-arrow {
    width: 32rpx;
    height: 32rpx;
    display: flex;
    justify-content: center;
    align-items: center;
}

.record-dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
}

.record-dialog-content {
    width: 600rpx;
    background-color: #ffffff;
    border-radius: 32rpx;
    overflow: hidden;
}

.record-dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 32rpx;
    border-bottom: 1rpx solid #f0f0f0;
}

.record-dialog-title {
    font-size: 36rpx;
    font-weight: bold;
    color: #333333;
}

.record-dialog-close {
    width: 48rpx;
    height: 48rpx;
    display: flex;
    justify-content: center;
    align-items: center;
}

.record-dialog-body {
    padding: 32rpx;
}

.record-text-container {
    margin-bottom: 32rpx;
}

.record-text-label {
    font-size: 28rpx;
    color: #666666;
    display: block;
    margin-bottom: 16rpx;
}

.record-text-box {
    background-color: #f8f8f8;
    border-radius: 16rpx;
    padding: 24rpx;
    min-height: 120rpx;
}

.record-text {
    font-size: 28rpx;
    color: #333333;
    line-height: 1.6;
}

.record-status-container {
    display: flex;
    justify-content: center;
    margin-bottom: 32rpx;
}

.record-status-text {
    font-size: 28rpx;
    color: #666666;
}

.record-button-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 24rpx;
}

.record-button {
    width: 160rpx;
    height: 160rpx;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 8rpx 24rpx rgba(102, 126, 234, 0.4);
    transition: all 0.3s ease;
}

.record-button.recording {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    animation: pulse 1.5s infinite;
}

@keyframes pulse {
    0%, 100% {
        transform: scale(1);
        box-shadow: 0 8rpx 24rpx rgba(245, 87, 108, 0.4);
    }
    50% {
        transform: scale(1.05);
        box-shadow: 0 12rpx 32rpx rgba(245, 87, 108, 0.6);
    }
}

.record-button-text {
    font-size: 28rpx;
    color: #666666;
    margin-top: 16rpx;
}

.record-tips {
    text-align: center;
}

.record-tips-text {
    font-size: 24rpx;
    color: #999999;
}
</style>