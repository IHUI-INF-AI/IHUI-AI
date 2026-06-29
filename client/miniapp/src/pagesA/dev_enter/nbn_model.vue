<template>
    <view class="nbn_model_container">
        <navigation-bars color="black" :viscosity="true" title="创建智能体" @pack="backPage" :showBack="true"
            :image="'https://file.aizhs.top/sys-mini/default/back.svg'" />
        
        <Loading v-if="loading"></Loading>
        
        <scroll-view class="agent_create_content" scroll-y>
            <!-- 智能体头像上传区域 -->
            <view class="title_icon">
                <image class="title_icon-image" src="https://file.aizhs.top/sys-mini/backf2.png" />
                <view class="title_icon-text">智能体头像</view>
            </view>
            
            <view class="avatar_upload_section">
                <view class="avatar_container" @click="chooseAvatar">
                    <image v-if="agentAvatar" class="avatar_preview" :src="agentAvatar" mode="aspectFill" />
                    <view v-else class="avatar_placeholder">
                        <image class="upload_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_addimage.png" />
                        <text class="upload_text">点击上传头像</text>
                    </view>
                </view>
            </view>
            
            <!-- 智能体名称输入框 -->
            <view class="title_icon">
                <image class="title_icon-image" src="https://file.aizhs.top/sys-mini/xtk/set_need_work.png" />
                <view class="title_icon-text">智能体名称</view>
            </view>
            
            <input class="agent_name_input" maxlength="30" v-model="agentName" type="text" placeholder="请输入智能体名称" />
            
            <!-- 智能体描述文本框 -->
            <view class="title_icon">
                <image class="title_icon-image" src="https://file.aizhs.top/sys-mini/xtk/set_need_text.png" />
                <view class="title_icon-text">智能体描述</view>
            </view>
            
            <textarea class="agent_desc_textarea" auto-height v-model="agentDescription" placeholder="请输入智能体的功能描述和使用说明"></textarea>
            
            <!-- n8n备份文件上传 -->
            <view class="title_icon">
                <image class="title_icon-image" src="https://file.aizhs.top/sys-mini/xtk/set_need_work.png" />
                <view class="title_icon-text">上传n8n备份文件（可选）</view>
            </view>
            
            <view class="n8n_file_upload_section">
                <view class="file_upload_btn" @click="chooseN8nFile">
                    <image class="upload_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_addimage.png" />
                    <text class="upload_text">{{ n8nFileName || '点击上传n8n备份JSON文件' }}</text>
                </view>
                <view v-if="n8nFileName" class="file_info">
                    <text class="file_name_text">{{ n8nFileName }}</text>
                    <text class="file_remove_btn" @click="removeN8nFile">删除</text>
                </view>
            </view>

            <!-- 智能体名称输入框 -->
            <view class="title_icon">
                <image class="title_icon-image" src="https://file.aizhs.top/sys-mini/xtk/set_need_work.png" />
                <view class="title_icon-text">n8n地址的正式路径</view>
            </view>
            
            <input class="agent_name_input" maxlength="200" v-model="agentUrl" type="text" placeholder="请输入n8n地址的正式路径" />
            <!-- 配置参数模块 -->
            <view class="title_icon">
                <image class="title_icon-image" src="https://file.aizhs.top/sys-mini/xtk/model_edit_yuan.png" />
                <view class="title_icon-text">输入参数</view>
            </view>
            
            <view class="config_params_section">
                <view v-for="(param, index) in configParams" :key="index" class="param_item">
                    <view class="param_header">
                        <text class="param_index">参数 {{ index + 1 }}</text>
                        <view class="param_actions">
                            <button v-if="configParams.length > 1" class="delete_btn" @click="removeParam(index)">删除</button>
                        </view>
                    </view>
                    
                    <view class="param_content">
                        <!-- 参数名称 -->
                        <view class="param_field">
                            <view class="field_label">参数名称</view>
                            <input class="field_input" v-model="param.parameterName" placeholder="请输入参数名称" maxlength="20" />
                        </view>
                        
                        <!-- 参数描述 -->
                        <view class="param_field">
                            <view class="field_label">参数描述</view>
                            <textarea class="field_textarea" v-model="param.parameterDescription" placeholder="请输入参数描述说明" auto-height></textarea>
                        </view>
                        
                        <!-- 键值类型选择 -->
                        <view class="param_field">
                            <view class="field_label">键值类型</view>
                            <view class="type_selector">
                                <view class="type_option" :class="{ active: param.type === 'text' }" @click="selectParamType(index, 'text')">
                                    <text>文本</text>
                                </view>
                                <view class="type_option" :class="{ active: param.type === 'image' }" @click="selectParamType(index, 'image')">
                                    <text>图片</text>
                                </view>
                                <view class="type_option" :class="{ active: param.type === 'video' }" @click="selectParamType(index, 'video')">
                                    <text>视频</text>
                                </view>
                                <view class="type_option" :class="{ active: param.type === 'audio' }" @click="selectParamType(index, 'audio')">
                                    <text>音频</text>
                                </view>
                                <view class="type_option" :class="{ active: param.type === 'boolean' }" @click="selectParamType(index, 'boolean')">
                                    <text>布尔</text>
                                </view>
                                <view class="type_option" :class="{ active: param.type === 'float' }" @click="selectParamType(index, 'float')">
                                    <text>浮点数</text>
                                </view>
                            </view>
                        </view>
                        
                        <!-- 默认值 -->
                        <view class="param_field">
                            <view class="field_label">默认值</view>
                            <input 
                                v-if="param.type === 'text'" 
                                class="field_input" 
                                v-model="param.Default" 
                                placeholder="请输入默认值" 
                                maxlength="100" 
                            />
                            <input 
                                v-else-if="param.type === 'image'" 
                                class="field_input" 
                                v-model="param.Default" 
                                placeholder="请输入图片URL" 
                                maxlength="300" 
                            />
                            <input 
                                v-else-if="param.type === 'video'" 
                                class="field_input" 
                                v-model="param.Default" 
                                placeholder="请输入视频URL" 
                                maxlength="300" 
                            />
                            <input 
                                v-else-if="param.type === 'audio'" 
                                class="field_input" 
                                v-model="param.Default" 
                                placeholder="请输入音频URL" 
                                maxlength="300" 
                            />
                            <input 
                                v-else-if="param.type === 'float'" 
                                class="field_input" 
                                v-model="param.Default" 
                                type="digit"
                                placeholder="请输入浮点数，如：3.14" 
                                maxlength="20" 
                            />
                            <view v-else-if="param.type === 'boolean'" class="boolean_selector">
                                <view class="boolean_option" :class="{ active: param.Default === 'true' }" @click="setBooleanValue(index, 'true')">
                                    <text>是</text>
                                </view>
                                <view class="boolean_option" :class="{ active: param.Default === 'false' }" @click="setBooleanValue(index, 'false')">
                                    <text>否</text>
                                </view>
                            </view>
                        </view>
                    </view>
                </view>
                
                <!-- 添加参数按钮 -->
                <view class="add_param_btn" @click="addParam">
                    <image class="add_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_addimage.png" />
                    <text class="add_text">添加参数</text>
                </view>
            </view>
            
            <!-- 输出参数模块 -->
            <view class="title_icon">
                <image class="title_icon-image" src="https://file.aizhs.top/sys-mini/xtk/model_edit_yuan.png" />
                <view class="title_icon-text">输出参数</view>
            </view>
            
            <view class="output_params_section">
                <view v-for="(param, index) in outputParams" :key="index" class="param_item">
                    <view class="param_header">
                        <text class="param_index">参数 {{ index + 1 }}</text>
                        <view class="param_actions">
                            <button v-if="outputParams.length > 1" class="delete_btn" @click="removeOutputParam(index)">删除</button>
                        </view>
                    </view>
                    
                    <view class="param_content">
                        <!-- 参数名称 -->
                        <view class="param_field">
                            <view class="field_label">参数名称</view>
                            <input class="field_input" v-model="param.parameterName" placeholder="请输入参数名称" maxlength="20" />
                        </view>
                        
                        <!-- 参数描述 -->
                        <view class="param_field">
                            <view class="field_label">参数描述</view>
                            <textarea class="field_textarea" v-model="param.parameterDescription" placeholder="请输入参数描述说明" auto-height></textarea>
                        </view>
                        
                        <!-- 键值类型选择 -->
                        <view class="param_field">
                            <view class="field_label">键值类型</view>
                            <view class="type_selector">
                                <view class="type_option" :class="{ active: param.type === 'text' }" @click="selectOutputParamType(index, 'text')">
                                    <text>文本</text>
                                </view>
                                <view class="type_option" :class="{ active: param.type === 'image' }" @click="selectOutputParamType(index, 'image')">
                                    <text>图片</text>
                                </view>
                                <view class="type_option" :class="{ active: param.type === 'video' }" @click="selectOutputParamType(index, 'video')">
                                    <text>视频</text>
                                </view>
                                <view class="type_option" :class="{ active: param.type === 'audio' }" @click="selectOutputParamType(index, 'audio')">
                                    <text>音频</text>
                                </view>
                                <view class="type_option" :class="{ active: param.type === 'boolean' }" @click="selectOutputParamType(index, 'boolean')">
                                    <text>布尔</text>
                                </view>
                                <view class="type_option" :class="{ active: param.type === 'float' }" @click="selectOutputParamType(index, 'float')">
                                    <text>浮点数</text>
                                </view>
                            </view>
                        </view>
                        
                        <!-- 默认值 -->
                        <view class="param_field">
                            <view class="field_label">默认值</view>
                            <input 
                                v-if="param.type === 'text'" 
                                class="field_input" 
                                v-model="param.Default" 
                                placeholder="请输入默认值" 
                                maxlength="100" 
                            />
                            <input 
                                v-else-if="param.type === 'image'" 
                                class="field_input" 
                                v-model="param.Default" 
                                placeholder="请输入图片URL" 
                                maxlength="300" 
                            />
                            <input 
                                v-else-if="param.type === 'video'" 
                                class="field_input" 
                                v-model="param.Default" 
                                placeholder="请输入视频URL" 
                                maxlength="300" 
                            />
                            <input 
                                v-else-if="param.type === 'audio'" 
                                class="field_input" 
                                v-model="param.Default" 
                                placeholder="请输入音频URL" 
                                maxlength="300" 
                            />
                            <input 
                                v-else-if="param.type === 'float'" 
                                class="field_input" 
                                v-model="param.Default" 
                                type="digit"
                                placeholder="请输入浮点数，如：3.14" 
                                maxlength="20" 
                            />
                            <view v-else-if="param.type === 'boolean'" class="boolean_selector">
                                <view class="boolean_option" :class="{ active: param.Default === 'true' }" @click="setOutputBooleanValue(index, 'true')">
                                    <text>是</text>
                                </view>
                                <view class="boolean_option" :class="{ active: param.Default === 'false' }" @click="setOutputBooleanValue(index, 'false')">
                                    <text>否</text>
                                </view>
                            </view>
                        </view>
                    </view>
                </view>
                
                <!-- 添加参数按钮 -->
                <view class="add_param_btn" @click="addOutputParam">
                    <image class="add_icon" src="https://file.aizhs.top/sys-mini/xtk/set_need_addimage.png" />
                    <text class="add_text">添加参数</text>
                </view>
            </view>
            
            <!-- 提交按钮 -->
            <view class="submit_section">
                <view class="submit_btn" @click="submitAgent">
                    <text>创建智能体</text>
                </view>
            </view>
            
            <view style="height: 20rpx;"></view>
        </scroll-view>
        
        <!-- 图片选择弹窗 -->
        <view class="image_picker_modal" v-if="showImagePicker">
            <view class="modal_content">
                <view class="picker_option" @click="selectImageSource('camera')">
                    <text>拍照</text>
                </view>
                <view class="picker_option" @click="selectImageSource('album')">
                    <text>相册</text>
                </view>
                <view class="picker_cancel" @click="showImagePicker = false">
                    <text>取消</text>
                </view>
            </view>
        </view>
    </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import NavigationBars from "@/components/navigation-bars/index.vue";
import Loading from "@/components/loading/index.vue";
import { uploadBusinessCarda } from "@/service/businessCard.js";
import { addN8nAgent } from "@/service/n8n.js";

const loading = ref(false)
const showImagePicker = ref(false)

const agentAvatar = ref('')
const agentName = ref('')
const agentDescription = ref('')
const agentUrl = ref('')
const n8nFileName = ref('')
const n8nFileData = ref(null)

const configParams = ref([
    {
        parameterName: '',
        parameterDescription: '',
        type: 'text',
        Default: ''
    }
])

const outputParams = ref([
    {
        parameterName: '',
        parameterDescription: '',
        type: 'text',
        Default: ''
    }
])

const userInfo = ref({})
const connector_user_id = ref('c42876a6-916c-4e1c-9c3f-e64fa03967dd')

onMounted(() => {
    userInfo.value = uni.getStorageSync("data") || {};
    if (userInfo.value.uuid) {
        connector_user_id.value = userInfo.value.uuid;
    }
})

function backPage() {
    uni.navigateBack()
}

function chooseAvatar() {
    showImagePicker.value = true
}

function chooseN8nFile() {
    if (typeof wx !== 'undefined' && wx.chooseMessageFile) {
        wx.chooseMessageFile({
            count: 1,
            type: 'file',
            extension: ['json'],
            success: (res) => {
                const file = res.tempFiles[0];
                const fileSize = file.size;
                const maxSize = 10 * 1024 * 1024;

                if (fileSize > maxSize) {
                    uni.showToast({ title: '文件大小不能超过10MB', icon: 'none', duration: 2000 });
                    return;
                }

                n8nFileName.value = file.name;

                uni.showLoading({ title: '解析文件中...', mask: true });

                uni.getFileSystemManager().readFile({
                    filePath: file.path,
                    encoding: 'utf8',
                    success: (data) => {
                        uni.hideLoading();
                        try {
                            const jsonData = JSON.parse(data.data);
                            n8nFileData.value = jsonData;
                            parseN8nJson(jsonData);
                            uni.showToast({ title: '文件解析成功', icon: 'success', duration: 2000 });
                        } catch (err) {
                            uni.showToast({ title: 'JSON文件格式错误', icon: 'none', duration: 2000 });
                            n8nFileName.value = '';
                            n8nFileData.value = null;
                        }
                    },
                    fail: (err) => {
                        uni.hideLoading();
                        uni.showToast({ title: '读取文件失败', icon: 'none', duration: 2000 });
                        n8nFileName.value = '';
                        n8nFileData.value = null;
                    }
                });
            },
            fail: (err) => {
                if (err.errMsg && !err.errMsg.includes('cancel')) {
                    uni.showToast({ title: '请从微信聊天记录中选择文件', icon: 'none', duration: 2000 });
                }
            }
        });
    } else {
        uni.showToast({ title: '当前环境不支持从聊天记录选择文件', icon: 'none', duration: 2000 });
    }
}

function parseN8nJson(jsonData) {
    try {
        if (jsonData.workflows && Array.isArray(jsonData.workflows) && jsonData.workflows.length > 0) {
            const workflow = jsonData.workflows[0];
            if (workflow.name && !agentName.value) {
                agentName.value = workflow.name;
            }
            if (workflow.settings && workflow.settings.description && !agentDescription.value) {
                agentDescription.value = workflow.settings.description;
            }
        }
        if (jsonData.name && !agentName.value) {
            agentName.value = jsonData.name;
        }
        if (jsonData.settings && jsonData.settings.description && !agentDescription.value) {
            agentDescription.value = jsonData.settings.description;
        }
    } catch (err) {
    }
}

function removeN8nFile() {
    n8nFileName.value = '';
    n8nFileData.value = null;
    uni.showToast({ title: '已删除文件', icon: 'success', duration: 1500 });
}

function selectImageSource(source) {
    showImagePicker.value = false
    const sourceType = source === 'camera' ? ['camera'] : ['album']

    uni.chooseImage({
        count: 1,
        sizeType: ['original', 'compressed'],
        sourceType: sourceType,
        success: (res) => {
            const tempFilePaths = res.tempFilePaths
            if (tempFilePaths && tempFilePaths.length > 0) {
                uploadAvatar(tempFilePaths[0])
            }
        },
        fail: (err) => {
            uni.showToast({ title: '选择图片失败', icon: 'none', duration: 2000 })
        }
    })
}

async function uploadAvatar(filePath) {
    try {
        uni.showLoading({ title: '上传中...' })

        const fileRes = await new Promise((resolve, reject) => {
            uni.getFileSystemManager().readFile({
                filePath: filePath,
                encoding: 'base64',
                success: resolve,
                fail: reject
            })
        })

        const base64Str = fileRes.data
        const fileName = filePath.split('/').pop()

        const res = await uploadBusinessCarda(base64Str, fileName)

        if (res.code === "200" && res.data) {
            agentAvatar.value = res.data
            uni.hideLoading()
            uni.showToast({ title: '上传成功', icon: 'success', duration: 2000 })
        } else {
            throw new Error(res.message || '上传失败')
        }
    } catch (err) {
        uni.hideLoading()
        uni.showToast({ title: err.message || '上传失败', icon: 'none', duration: 2000 })
    }
}

function addParam() {
    configParams.value.push({
        parameterName: '',
        parameterDescription: '',
        type: 'text',
        Default: ''
    })
}

function removeParam(index) {
    if (configParams.value.length > 1) {
        configParams.value.splice(index, 1)
    }
}

function selectParamType(index, type) {
    configParams.value[index].type = type
    configParams.value[index].Default = ''
    if (type === 'boolean') {
        configParams.value[index].Default = 'true'
    }
}

function setBooleanValue(index, value) {
    configParams.value[index].Default = value
}

function addOutputParam() {
    outputParams.value.push({
        parameterName: '',
        parameterDescription: '',
        type: 'text',
        Default: ''
    })
}

function removeOutputParam(index) {
    if (outputParams.value.length > 1) {
        outputParams.value.splice(index, 1)
    }
}

function selectOutputParamType(index, type) {
    outputParams.value[index].type = type
    outputParams.value[index].Default = ''
    if (type === 'boolean') {
        outputParams.value[index].Default = 'true'
    }
}

function setOutputBooleanValue(index, value) {
    outputParams.value[index].Default = value
}

function getTrueLength(str) {
    return Array.from(str).length;
}

function validateForm() {
    if (!agentName.value || agentName.value.trim() === '') {
        uni.showToast({ title: '请输入智能体名称', icon: 'none' })
        return false
    }
    if (agentName.value.trim().length < 2) {
        uni.showToast({ title: '智能体名称至少2个字符', icon: 'none' })
        return false
    }
    if (!agentDescription.value || agentDescription.value.trim() === '') {
        uni.showToast({ title: '请输入智能体描述', icon: 'none' })
        return false
    }
    const descriptionLength = getTrueLength(agentDescription.value.trim());
    if (descriptionLength < 10) {
        uni.showToast({ title: '智能体描述至少10个字符', icon: 'none' })
        return false
    }

    for (let i = 0; i < configParams.value.length; i++) {
        const param = configParams.value[i]
        if (!param.parameterName || param.parameterName.trim() === '') {
            uni.showToast({ title: `请输入参数${i + 1}的名称`, icon: 'none' })
            return false
        }
        if (!param.parameterDescription || param.parameterDescription.trim() === '') {
            uni.showToast({ title: `请输入参数${i + 1}的描述`, icon: 'none' })
            return false
        }
        if ((param.type === 'image' || param.type === 'video' || param.type === 'audio') && param.Default) {
            try {
                new URL(param.Default);
            } catch (e) {
                uni.showToast({
                    title: `参数${i + 1}的默认${param.type === 'image' ? '图片' : param.type === 'video' ? '视频' : '音频'}URL格式不正确`,
                    icon: 'none'
                })
                return false
            }
        }
        if (param.type === 'boolean' && param.Default && param.Default !== 'true' && param.Default !== 'false') {
            uni.showToast({ title: `参数${i + 1}的默认值必须是"是"或"否"`, icon: 'none' })
            return false
        }
        if (param.type === 'float' && param.Default) {
            const floatValue = parseFloat(param.Default);
            if (isNaN(floatValue)) {
                uni.showToast({ title: `参数${i + 1}的默认值必须是有效的浮点数`, icon: 'none' })
                return false
            }
        }
    }

    for (let i = 0; i < outputParams.value.length; i++) {
        const param = outputParams.value[i]
        if (!param.parameterName || param.parameterName.trim() === '') {
            uni.showToast({ title: `请输入输出参数${i + 1}的名称`, icon: 'none' })
            return false
        }
        if (!param.parameterDescription || param.parameterDescription.trim() === '') {
            uni.showToast({ title: `请输入输出参数${i + 1}的描述`, icon: 'none' })
            return false
        }
        if ((param.type === 'image' || param.type === 'video' || param.type === 'audio') && param.Default) {
            try {
                new URL(param.Default);
            } catch (e) {
                uni.showToast({
                    title: `输出参数${i + 1}的默认${param.type === 'image' ? '图片' : param.type === 'video' ? '视频' : '音频'}URL格式不正确`,
                    icon: 'none'
                })
                return false
            }
        }
        if (param.type === 'boolean' && param.Default && param.Default !== 'true' && param.Default !== 'false') {
            uni.showToast({ title: `输出参数${i + 1}的默认值必须是"是"或"否"`, icon: 'none' })
            return false
        }
        if (param.type === 'float' && param.Default) {
            const floatValue = parseFloat(param.Default);
            if (isNaN(floatValue)) {
                uni.showToast({ title: `输出参数${i + 1}的默认值必须是有效的浮点数`, icon: 'none' })
                return false
            }
        }
    }

    return true
}

async function submitAgent() {
    if (!validateForm()) {
        return
    }

    loading.value = true

    try {
        const n8nParams = {
            agentName: agentName.value.trim(),
            agentDescription: agentDescription.value.trim(),
            userId: connector_user_id.value,
            agentVariablesIn: JSON.stringify([
                {
                    parameterName: 'content',
                    type: 'text',
                    parameterDescription: '接收用户输入的提示词',
                    Default: ''
                },
                ...configParams.value.map(param => ({
                    parameterName: param.parameterName.trim(),
                    type: param.type,
                    parameterDescription: param.parameterDescription.trim(),
                    Default: param.Default
                }))
            ]),
            agentVariablesOut: JSON.stringify(outputParams.value.map(param => ({
                parameterName: param.parameterName.trim(),
                type: param.type,
                parameterDescription: param.parameterDescription.trim(),
                Default: param.Default
            }))),
            agentUrl: agentUrl.value || "https://zhangsan12.app.n8n.cloud/webhook/82e66b96-9d3f-494b-bbab-d51eb79e2c12",
            agentAvatar: agentAvatar.value || "https://file.aizhs.top/sys-backs/2025/09/24/391_42_20250924094836A218.png",
            agentN8nJson: n8nFileData.value ? JSON.stringify(n8nFileData.value) : null
        }

        const response = await addN8nAgent(n8nParams)

        if (response.code >= 200 && response.code < 300) {
            uni.showToast({ title: '智能体创建成功', icon: 'success', duration: 2000 })
            setTimeout(() => {
                uni.navigateBack()
            }, 2000)
        } else {
            throw new Error(response.message || '创建失败')
        }
    } catch (error) {
        uni.showToast({ title: error.message || '创建失败，请重试', icon: 'none', duration: 2000 })
    } finally {
        loading.value = false
    }
}
</script>

<style lang="scss" scoped>
.nbn_model_container {
    width: 100%;
    height: 100vh;
    background-color: #f5f5f5;
    display: flex;
    flex-direction: column;
}

// 智能体创建页面样式
.agent_create_content {
    flex: 1;
    overflow-y: auto;
    padding: 20rpx;
    box-sizing: border-box;
}

// 标题图标样式
.title_icon {
    display: flex;
    align-items: center;
    margin: 30rpx 0 20rpx;
    
    .title_icon-image {
        width: 40rpx;
        height: 40rpx;
        margin-right: 15rpx;
    }
    
    .title_icon-text {
        font-size: 32rpx;
        font-weight: bold;
        color: #333;
    }
}

// 头像上传区域
.avatar_upload_section {
    display: flex;
    justify-content: center;
    margin-bottom: 30rpx;
    
    .avatar_container {
        width: 160rpx;
        height: 160rpx;
        border-radius: 50%;
        border: 2rpx dashed #ddd;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #fafafa;
        overflow: hidden;
        
        .avatar_preview {
            width: 100%;
            height: 100%;
            border-radius: 50%;
        }
        
        .avatar_placeholder {
            display: flex;
            flex-direction: column;
            align-items: center;
            color: #999;
            
            .upload_icon {
                width: 50rpx;
                height: 50rpx;
                margin-bottom: 10rpx;
            }
            
            .upload_text {
                font-size: 24rpx;
            }
        }
    }
}

// 表单输入框样式
.agent_name_input {
    width: 100%;
    padding: 15rpx 25rpx;
    border: 2rpx solid #e5e5e5;
    border-radius: 15rpx;
    font-size: 28rpx;
    background-color: #fff;
    box-sizing: border-box;
    margin-bottom: 30rpx;
    line-height: 1.5;
    min-height: 70rpx;
    color: #000;
    
    &:focus {
        border-color: #007aff;
    }
}

.agent_desc_textarea {
    width: 100%;
    min-height: 200rpx;
    padding: 15rpx 25rpx;
    border: 2rpx solid #e5e5e5;
    border-radius: 15rpx;
    font-size: 28rpx;
    background-color: #fff;
    box-sizing: border-box;
    margin-bottom: 30rpx;
    line-height: 1.5;
    color: #000;
    
    &:focus {
        border-color: #007aff;
    }
}

// 配置参数模块
.config_params_section, .output_params_section {
    margin-bottom: 30rpx;
    
    .param_item {
        border: 2rpx solid #f0f0f0;
        border-radius: 15rpx;
        padding: 30rpx;
        margin-bottom: 20rpx;
        background-color: #fff;
        
        .param_header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20rpx;
            
            .param_index {
                font-size: 28rpx;
                font-weight: bold;
                color: #333;
            }
            
            .delete_btn {
                background-color: #ff3b30;
                color: #fff;
                border: none;
                border-radius: 8rpx;
                padding: 8rpx 16rpx;
                font-size: 24rpx;
            }
        }
        
        .param_content {
            .param_field {
                margin-bottom: 20rpx;
                
                &:last-child {
                    margin-bottom: 0;
                }
                
                .field_label {
                    font-size: 26rpx;
                    color: #666;
                    margin-bottom: 10rpx;
                }
                
                .field_input {
                    width: 100%;
                    padding: 12rpx 20rpx; /* 调整padding，减少上下padding以适应文字显示 */
                    border: 1rpx solid #e5e5e5;
                    border-radius: 8rpx;
                    font-size: 26rpx;
                    background-color: #fff;
                    box-sizing: border-box;
                    line-height: 1.5;
                    min-height: 60rpx; /* 设置最小高度以确保足够的显示空间 */
                    color: #000;
                }
                
                .field_textarea {
                    width: 100%;
                    min-height: 120rpx;
                    padding: 12rpx 20rpx; /* 调整padding，减少上下padding以适应文字显示 */
                    border: 1rpx solid #e5e5e5;
                    border-radius: 8rpx;
                    font-size: 26rpx;
                    background-color: #fff;
                    box-sizing: border-box;
                    line-height: 1.5;
                    color: #000;
                }
                
                .type_selector {
                    display: flex;
                    gap: 8rpx;
                    flex-wrap: nowrap;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    
                    .type_option {
                        flex: 0 0 auto;
                        min-width: 100rpx;
                        padding: 12rpx 16rpx;
                        border: 1rpx solid #e5e5e5;
                        border-radius: 8rpx;
                        text-align: center;
                        font-size: 24rpx;
                        color: #666;
                        background-color: #fff;
                        white-space: nowrap;
                        box-sizing: border-box;
                        
                        &.active {
                            border-color: #007aff;
                            color: #007aff;
                            background-color: #f0f8ff;
                        }
                    }
                }
                
                .boolean_selector {
                    display: flex;
                    gap: 15rpx;
                    
                    .boolean_option {
                        flex: 1;
                        padding: 15rpx;
                        border: 2rpx solid #e5e5e5;
                        border-radius: 8rpx;
                        text-align: center;
                        font-size: 26rpx;
                        font-weight: 500;
                        color: #666;
                        background-color: #fff;
                        transition: all 0.3s ease;
                        
                        &.active {
                            border-color: #007aff;
                            color: #fff;
                            background-color: #007aff;
                            font-weight: bold;
                            transform: scale(1.05);
                            box-shadow: 0 4rpx 12rpx rgb(0 122 255 / 0.3);
                        }
                    }
                }
            }
        }
    }
    
    .add_param_btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10rpx;
        width: 100%;
        padding: 25rpx;
        border: 2rpx dashed #ddd;
        border-radius: 15rpx;
        background-color: #fafafa;
        color: #666;
        box-sizing: border-box;
        margin-top: 20rpx;
        
        .add_icon {
            width: 30rpx;
            height: 30rpx;
        }
        
        .add_text {
            font-size: 26rpx;
        }
    }
}

// 提交按钮
.submit_section {
    padding: 20rpx;
    box-sizing: border-box;
    
    .submit_btn {
        width: 100%;
        background: #000;
        color: #fff;
        border: none;
        border-radius: 30rpx;
        padding: 35rpx;
        font-size: 32rpx;
        font-weight: bold;
        box-shadow: 0 8rpx 30rpx rgb(0 0 0 / 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        
        &:active {
            opacity: 0.8;
            transform: translateY(2rpx);
        }
    }
}

// 图片选择弹窗
.image_picker_modal {
    position: fixed;
    inset: 0;
    background-color: rgb(0 0 0 / 0.5);
    display: flex;
    align-items: flex-end;
    z-index: 1000;
    
    .modal_content {
        width: 100%;
        background-color: #fff;
        border-radius: 20rpx 20rpx 0 0;
        padding: 40rpx;
        box-sizing: border-box;
        
        .picker_option {
            width: 100%;
            text-align: center;
            padding: 30rpx;
            border: 2rpx solid #e5e5e5;
            border-radius: 15rpx;
            font-size: 28rpx;
            color: #333;
            background-color: #fff;
            margin-bottom: 20rpx;
            box-sizing: border-box;
            
            &:active {
                background-color: #f0f0f0;
            }
        }
        
        .picker_cancel {
            width: 100%;
            text-align: center;
            padding: 30rpx;
            border: 2rpx solid #e5e5e5;
            border-radius: 15rpx;
            font-size: 28rpx;
            color: #666;
            background-color: #fff;
            box-sizing: border-box;
            
            &:active {
                background-color: #f0f0f0;
            }
        }
    }
}

/* 修复input文字颜色为白色的问题 */
.field_input {
    color: #333; /* 设置文字颜色为深灰色 */
}

.field_textarea {
    color: #333; /* 设置文字颜色为深灰色 */
}

// n8n文件上传区域
.n8n_file_upload_section {
    margin-bottom: 30rpx;
    
    .file_upload_btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10rpx;
        width: 100%;
        padding: 25rpx;
        border: 2rpx dashed #ddd;
        border-radius: 15rpx;
        background-color: #fafafa;
        color: #666;
        box-sizing: border-box;
        
        .upload_icon {
            width: 30rpx;
            height: 30rpx;
        }
        
        .upload_text {
            font-size: 26rpx;
            color: #666;
        }
        
        &:active {
            background-color: #f0f0f0;
        }
    }
    
    .file_info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 15rpx;
        padding: 15rpx 20rpx;
        background-color: #f0f8ff;
        border-radius: 8rpx;
        border: 1rpx solid #007aff;
        
        .file_name_text {
            font-size: 24rpx;
            color: #007aff;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .file_remove_btn {
            font-size: 24rpx;
            color: #ff3b30;
            padding: 5rpx 15rpx;
            margin-left: 15rpx;
        }
    }
}

</style>