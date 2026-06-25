<template>
    <div class="dialogue-overlay" @click="handleOverlayClick">
      <div class="dialogue-panel" @click.stop>
        <!-- 多行输入区域 -->
        <div class="dialogue-input-wrapper">
          <textarea
            ref="inputRef"
            v-model="inputText"
            class="dialogue-textarea"
            :placeholder="t('hardcoded.input1.请输入您的需求可')"
            @input="autoResize"
          ></textarea>
        <!-- 底部控制栏 -->
          <div class="dialogue-footer">
              <!-- 控制按钮行 -->
              <div class="footer-controls">
                <!-- 左侧：上传文件 -->
                <div class="footer-left">
                  <input
                    ref="fileInputRef"
                    type="file"
                    class="file-input"
                    multiple
                    @change="handleFiles"
                  />
                  <button class="icon-btn upload-btn" @click="triggerUpload" aria-label="上传附件">
                    📎
                  </button>
                </div>

                <!-- 中间：模式 Tab -->
                <div class="footer-center">
                  <button
                    class="mode-tab"
                    :class="{ active: activeMode === 'agent' }"
                    @click="activeMode = 'agent'"
                    title="Agent Mode"
                  >
                    <span class="mode-icon">🤖</span>
                    <span class="mode-text">Agent Mode</span>
                  </button>
                  <button
                    class="mode-tab"
                    :class="{ active: activeMode === 'image' }"
                    @click="activeMode = 'image'"
                    title="Image Mode"
                  >
                    <span class="mode-icon">🖼️</span>
                    <span class="mode-text">Image Mode</span>
                  </button>
                  <button
                    class="mode-tab"
                    :class="{ active: activeMode === 'video' }"
                    @click="activeMode = 'video'"
                    title="Video Mode"
                  >
                    <span class="mode-icon">🎬</span>
                    <span class="mode-text">Video Mode</span>
                  </button>
                </div>
              </div>
              
              <!-- 模式对应的下拉框和按钮 -->
              <div class="mode-settings">
                    <!-- Agent Mode -->
                    <div v-if="activeMode === 'agent'" class="mode-row">
                      <!-- 模型选择下拉框 -->
                      <div ref="modelSelectRef" class="unified-select-wrapper" @click="toggleModelDropdown">
                        <el-icon class="select-icon"><Grid /></el-icon>
                        <span class="select-text">{{ getModelDisplayName(agentModel) }}</span>
                        <el-icon class="select-arrow"><ArrowDown /></el-icon>
                      </div>
                      <Teleport to="body">
                        <div 
                          v-if="showModelDropdown" 
                         
                          class="unified-select-dropdown" 
                          :style="modelDropdownStyle"
                          @click.stop
                        >
                          <div 
                            v-for="option in modelOptions" 
                            :key="option.value"
                            class="unified-select-option"
                            :class="{ active: agentModel === option.value }"
                            @click="selectModel(option.value)"
                          >
                            <el-icon class="option-icon"><Grid /></el-icon>
                            <span class="option-text">{{ option.label }}</span>
                            <span v-if="agentModel === option.value" class="option-dot"></span>
                          </div>
                        </div>
                      </Teleport>
                      
                      <!-- 分辨率选择下拉框 -->
                      <div ref="resolutionSelectRef" class="unified-select-wrapper" @click="toggleResolutionDropdown">
                        <el-icon class="select-icon"><Grid /></el-icon>
                        <span class="select-text">{{ videoResolution }}</span>
                        <el-icon class="select-arrow"><ArrowDown /></el-icon>
                      </div>
                      <Teleport to="body">
                        <div 
                          v-if="showResolutionDropdown" 
                       
                          class="unified-select-dropdown" 
                          :style="resolutionDropdownStyle"
                          @click.stop
                        >
                          <div 
                            v-for="option in resolutionOptions" 
                            :key="option.value"
                            class="unified-select-option"
                            :class="{ active: videoResolution === option.value }"
                            @click="selectResolution(option.value)"
                          >
                            <el-icon class="option-icon"><Grid /></el-icon>
                            <span class="option-text">{{ option.label }}</span>
                            <span v-if="videoResolution === option.value" class="option-dot"></span>
                          </div>
                        </div>
                      </Teleport>
                      
                      <!-- 时长选择下拉框 -->
                      <div ref="durationSelectRef" class="unified-select-wrapper" @click="toggleDurationDropdown">
                        <el-icon class="select-icon"><Grid /></el-icon>
                        <span class="select-text">{{ videoDuration }}</span>
                        <el-icon class="select-arrow"><ArrowDown /></el-icon>
                      </div>
                      <Teleport to="body">
                        <div 
                          v-if="showDurationDropdown" 
                   
                          class="unified-select-dropdown" 
                          :style="durationDropdownStyle"
                          @click.stop
                        >
                          <div 
                            v-for="option in durationOptions" 
                            :key="option.value"
                            class="unified-select-option"
                            :class="{ active: videoDuration === option.value }"
                            @click="selectDuration(option.value)"
                          >
                            <el-icon class="option-icon"><Grid /></el-icon>
                            <span class="option-text">{{ option.label }}</span>
                            <span v-if="videoDuration === option.value" class="option-dot"></span>
                          </div>
                        </div>
                      </Teleport>


                      <!-- <div class="mode-group checkbox-group">
                        <label>
                          <input type="checkbox" v-model="enableAgentTools" />{{ t('hardcoded.input1.启用工具') }}</label>
                      </div> -->
                    </div>
            
                    <!-- Image Mode -->
                    <div v-else-if="activeMode === 'image'" class="mode-row">
                      <!-- 图像模型选择下拉框 -->
                      <div ref="imageModelSelectRef" class="unified-select-wrapper" @click="toggleImageModelDropdown">
                        <el-icon class="select-icon"><Grid /></el-icon>
                        <span class="select-text">{{ getImageModelDisplayName(imageModel) }}</span>
                        <el-icon class="select-arrow"><ArrowDown /></el-icon>
                      </div>
                      <Teleport to="body">
                        <div 
                          v-if="showImageModelDropdown" 
                        
                          class="unified-select-dropdown" 
                          :style="imageModelDropdownStyle"
                          @click.stop
                        >
                          <div 
                            v-for="option in imageModelOptions" 
                            :key="option.value"
                            class="unified-select-option"
                            :class="{ active: imageModel === option.value }"
                            @click="selectImageModel(option.value)"
                          >
                            <el-icon class="option-icon"><Grid /></el-icon>
                            <span class="option-text">{{ option.label }}</span>
                            <span v-if="imageModel === option.value" class="option-dot"></span>
                          </div>
                        </div>
                      </Teleport>
                      
                      <!-- 模板选择按钮 -->
                      <button class="unified-select-wrapper template-btn" @click="showTemplateDialog = true">
                        <el-icon class="select-icon"><Grid /></el-icon>
                        <span class="select-text">{{ t('hardcoded.input1.模板') }}</span>
                      </button>
                      
                      <!-- 图像比例选择下拉框 -->
                      <div ref="imageRatioSelectRef" class="unified-select-wrapper" @click="toggleImageRatioDropdown">
                        <el-icon class="select-icon"><Grid /></el-icon>
                        <span class="select-text">{{ imageRatio }}</span>
                        <el-icon class="select-arrow"><ArrowDown /></el-icon>
                      </div>
                      <Teleport to="body">
                        <div 
                          v-if="showImageRatioDropdown" 
                          
                          class="unified-select-dropdown" 
                          :style="imageRatioDropdownStyle"
                          @click.stop
                        >
                          <div 
                            v-for="option in imageRatioOptions" 
                            :key="option.value"
                            class="unified-select-option"
                            :class="{ active: imageRatio === option.value }"
                            @click="selectImageRatio(option.value)"
                          >
                            <el-icon class="option-icon"><Grid /></el-icon>
                            <span class="option-text">{{ option.label }}</span>
                            <span v-if="imageRatio === option.value" class="option-dot"></span>
                          </div>
                        </div>
                      </Teleport>
                    </div>
            
                    <!-- Video Mode -->
                    <div v-else class="mode-row">
                      <!-- 视频模型选择下拉框 -->
                      <div ref="videoModelSelectRef" class="unified-select-wrapper" @click="toggleVideoModelDropdown">
                        <el-icon class="select-icon"><Grid /></el-icon>
                        <span class="select-text">{{ getVideoModelDisplayName(videoModel) }}</span>
                        <el-icon class="select-arrow"><ArrowDown /></el-icon>
                      </div>
                      <Teleport to="body">
                        <div 
                          v-if="showVideoModelDropdown" 
                         
                          class="unified-select-dropdown" 
                          :style="videoModelDropdownStyle"
                          @click.stop
                        >
                          <div 
                            v-for="option in videoModelOptions" 
                            :key="option.value"
                            class="unified-select-option"
                            :class="{ active: videoModel === option.value }"
                            @click="selectVideoModel(option.value)"
                          >
                            <el-icon class="option-icon"><Grid /></el-icon>
                            <span class="option-text">{{ option.label }}</span>
                            <span v-if="videoModel === option.value" class="option-dot"></span>
                          </div>
                        </div>
                      </Teleport>
                      
                      <!-- 视频比例选择下拉框 -->
                      <div ref="videoRatioSelectRef" class="unified-select-wrapper" @click="toggleVideoRatioDropdown">
                        <el-icon class="select-icon"><Grid /></el-icon>
                        <span class="select-text">{{ videoRatio }}</span>
                        <el-icon class="select-arrow"><ArrowDown /></el-icon>
                      </div>
                      <Teleport to="body">
                        <div 
                          v-if="showVideoRatioDropdown" 
                
                          class="unified-select-dropdown" 
                          :style="videoRatioDropdownStyle"
                          @click.stop
                        >
                          <div 
                            v-for="option in videoRatioOptions" 
                            :key="option.value"
                            class="unified-select-option"
                            :class="{ active: videoRatio === option.value }"
                            @click="selectVideoRatio(option.value)"
                          >
                            <el-icon class="option-icon"><Grid /></el-icon>
                            <span class="option-text">{{ option.label }}</span>
                            <span v-if="videoRatio === option.value" class="option-dot"></span>
                          </div>
                        </div>
                      </Teleport>
                      
                      <!-- 视频分辨率选择下拉框 -->
                      <div ref="videoResolutionSelectRef" class="unified-select-wrapper" @click="toggleVideoResolutionDropdown">
                        <el-icon class="select-icon"><Grid /></el-icon>
                        <span class="select-text">{{ videoResolution }}</span>
                        <el-icon class="select-arrow"><ArrowDown /></el-icon>
                      </div>
                      <Teleport to="body">
                        <div 
                          v-if="showVideoResolutionDropdown" 
                          
                          class="unified-select-dropdown" 
                          :style="videoResolutionDropdownStyle"
                          @click.stop
                        >
                          <div 
                            v-for="option in resolutionOptions" 
                            :key="option.value"
                            class="unified-select-option"
                            :class="{ active: videoResolution === option.value }"
                            @click="selectVideoResolution(option.value)"
                          >
                            <el-icon class="option-icon"><Grid /></el-icon>
                            <span class="option-text">{{ option.label }}</span>
                            <span v-if="videoResolution === option.value" class="option-dot"></span>
                          </div>
                        </div>
                      </Teleport>
                      
                      <!-- 视频时长选择下拉框 -->
                      <div ref="videoDurationSelectRef" class="unified-select-wrapper" @click="toggleVideoDurationDropdown">
                        <el-icon class="select-icon"><Grid /></el-icon>
                        <span class="select-text">{{ videoDuration }}</span>
                        <el-icon class="select-arrow"><ArrowDown /></el-icon>
                      </div>
                      <Teleport to="body">
                        <div 
                          v-if="showVideoDurationDropdown" 
                          ref="videoDurationDropdownRef"
                          class="unified-select-dropdown" 
                          :style="videoDurationDropdownStyle"
                          @click.stop
                        >
                          <div 
                            v-for="option in durationOptions" 
                            :key="option.value"
                            class="unified-select-option"
                            :class="{ active: videoDuration === option.value }"
                            @click="selectVideoDuration(option.value)"
                          >
                            <el-icon class="option-icon"><Grid /></el-icon>
                            <span class="option-text">{{ option.label }}</span>
                            <span v-if="videoDuration === option.value" class="option-dot"></span>
                          </div>
                        </div>
                      </Teleport>
                    </div>
              </div>
                    <!-- 右侧：发送按钮 -->
                  <div class="footer-right">
                    <button class="primary-btn send-icon-btn" @click="submit" :title="t('hardcoded.input1.发送1')" aria-label="发送">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 3L8 13M8 3L4 7M8 3L12 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                </div>
          </div>

        </div>

    </div>



    <!-- 模板选择弹窗 -->
    <div v-if="showTemplateDialog" class="template-dialog-overlay" @click="showTemplateDialog = false">
      <div class="template-dialog-panel" @click.stop>
        <div class="template-dialog-header">
          <h3>{{ t('hardcoded.input1.选择模板') }}</h3>
          <button class="template-close-btn" @click="showTemplateDialog = false" aria-label="关闭">
            ✕
          </button>
        </div>
        <div class="template-dialog-content">
          <p>{{ t('hardcoded.input1.模板列表内容') }}</p>
          <p>{{ t('hardcoded.input1.模板列表内容') }}</p>
          <p>{{ t('hardcoded.input1.模板列表内容') }}</p>
          <p>{{ t('hardcoded.input1.模板列表内容') }}</p>
          <p>{{ t('hardcoded.input1.模板列表内容') }}</p>
          <p>{{ t('hardcoded.input1.模板列表内容') }}</p>
        
        </div>
      </div>
    </div>
    </div>
  </template>
  
<script>
import { ref, onMounted, nextTick } from 'vue';
import { useCleanup } from '@/composables/useCleanup';
import { DocumentAdd, Plus, ArrowDown, Grid } from '@element-plus/icons-vue';
import { useI18n } from 'vue-i18n';

  export default {
    name: 'Dialogue',
    emits: ['submit', 'close'],
    components: {
      DocumentAdd,
      Plus,
      ArrowDown,
      Grid,
    },
    setup(_, { emit }) {
      const { t } = useI18n();
      const cleanup = useCleanup();
      const inputText = ref('');
      const inputRef = ref(null);
      const fileInputRef = ref(null);
      const modelSelectRef = ref(null);
      const resolutionSelectRef = ref(null);
      const durationSelectRef = ref(null);
      const modelDropdownRef = ref(null);
      const resolutionDropdownRef = ref(null);
      const durationDropdownRef = ref(null);
      
      // Image Mode动态绑定
      const imageModelSelectRef = ref(null);
      const imageRatioSelectRef = ref(null);
      const imageModelDropdownRef = ref(null);
      const imageRatioDropdownRef = ref(null);
      const imageTemplateSelectRef = ref(null);
      const showImageModelDropdown = ref(false);
      const showImageRatioDropdown = ref(false);


      // Video Mode动态绑定
      const videoModelSelectRef = ref(null);
      const videoRatioSelectRef = ref(null);
      const videoResolutionSelectRef = ref(null);
      const videoDurationSelectRef = ref(null);
      const videoModelDropdownRef = ref(null);
      const videoRatioDropdownRef = ref(null);
      const videoResolutionDropdownRef = ref(null);
      const videoDurationDropdownRef = ref(null);
  
      const activeMode = ref('agent');
  
      const agentModel = ref('gpt-5.1');
      const enableAgentTools = ref(true);
      const showModelDropdown = ref(false);
      const showResolutionDropdown = ref(false);
      const showDurationDropdown = ref(false);
      
      const showVideoModelDropdown = ref(false);
      const showVideoRatioDropdown = ref(false);
      const showVideoResolutionDropdown = ref(false);
      const showVideoDurationDropdown = ref(false);
      
      const modelDropdownStyle = ref({ top: '0px', left: '0px', minWidth: '100px' });
      const resolutionDropdownStyle = ref({ top: '0px', left: '0px', minWidth: '100px' });
      const durationDropdownStyle = ref({ top: '0px', left: '0px', minWidth: '100px' });
      
      // Image Mode 下拉框样式
      const imageModelDropdownStyle = ref({ top: '0px', left: '0px', minWidth: '100px' });
      const imageRatioDropdownStyle = ref({ top: '0px', left: '0px', minWidth: '100px' });
      
      // Video Mode 下拉框样式
      const videoModelDropdownStyle = ref({ top: '0px', left: '0px', minWidth: '100px' });
      const videoRatioDropdownStyle = ref({ top: '0px', left: '0px', minWidth: '100px' });
      const videoResolutionDropdownStyle = ref({ top: '0px', left: '0px', minWidth: '100px' });
      const videoDurationDropdownStyle = ref({ top: '0px', left: '0px', minWidth: '100px' });
      
      // Agent Mode（死数据）
      const modelOptions = [
        { value: 'gpt-5.1', label: 'GPT-5.1' },
        { value: 'claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
        { value: 'claude-sonnet-4.0', label: 'Claude Sonnet 4.0' },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { value: 'gpt-2.0', label: 'GPT-2.0' },
      ];
      

      const resolutionOptions = [
        { value: '720p', label: '720p' },
        { value: '1080p', label: '1080p' },
        { value: '480p', label: '480p' },
        { value: '360p', label: '360p' },
      ];
      
      const durationOptions = [
        { value: '4s', label: '4s' },
        { value: '8s', label: '8s' },
        { value: '16s', label: '16s' },
        { value: '32s', label: '32s' },
      ];
      
      // Image Mode（死数据）
      const imageModelOptions = [
        { value: 'nano-banana', label: 'Nano Banana' },
        { value: 'Nano Banana Pro', label: 'Nano Banana Pro' },
        { value: 'dalle-3', label: 'DALL·E 3' },
        { value: 'Seedream4', label: 'Seedream4' },
        { value: 'GPT Image', label: 'GPT Image' },
      ];
      
      const imageRatioOptions = [
        { value: '1:1', label: '1:1' },
        { value: '4:3', label: '4:3' },
        { value: '16:9', label: '16:9' },
        { value: '9:16', label: '9:16' },
      ];
      
      
      // Video Mode（死数据）
      const videoModelOptions = [
        { value: 'sora2系列', label: t('data.input1.sora2系列') },
        { value: 'sora1', label: 'Sora1' },
        { value: 'Wan 2.0', label: 'Wan 2.0' },
        { value: 'klimg系列', label: t('data.input1.klimg系列1') },
        { value: 'sora-mini', label: 'Sora Mini' },
      ];
      
      const videoRatioOptions = [
        { value: '16:9', label: '16:9' },
        { value: '9:16', label: '9:16' },
        { value: '1:1', label: '1:1' },
        { value: '4:3', label: '4:3' },
        { value: '1:2', label: '1:2' },
      ];
      
      const getModelDisplayName = (value) => {
        const option = modelOptions.find(opt => opt.value === value);
        return option ? option.label : value;
      };
      
      const getImageModelDisplayName = (value) => {
        const option = imageModelOptions.find(opt => opt.value === value);
        return option ? option.label : value;
      };
      
      const getVideoModelDisplayName = (value) => {
        const option = videoModelOptions.find(opt => opt.value === value);
        return option ? option.label : value;
      };
      
      const updateDropdownPosition = (selectRef, styleRef) => {
        nextTick(() => {
          if (selectRef.value) {
            const rect = selectRef.value.getBoundingClientRect();
            styleRef.value = {
              top: `${rect.bottom + 4}px`,
              left: `${rect.left}px`,
              minWidth: `${rect.width}px`,
            };
          }
        });
      };
      
      const toggleModelDropdown = () => {
        const wasOpen = showModelDropdown.value;
        showModelDropdown.value = !showModelDropdown.value;
        showResolutionDropdown.value = false;
        showDurationDropdown.value = false;
        showImageModelDropdown.value = false;
        showImageRatioDropdown.value = false;
        showVideoModelDropdown.value = false;
        showVideoRatioDropdown.value = false;
        showVideoResolutionDropdown.value = false;
        showVideoDurationDropdown.value = false;
        if (!wasOpen && showModelDropdown.value) {
          updateDropdownPosition(modelSelectRef, modelDropdownStyle);
        }
      };
      
      const toggleResolutionDropdown = () => {
        const wasOpen = showResolutionDropdown.value;
        showResolutionDropdown.value = !showResolutionDropdown.value;
        showModelDropdown.value = false;
        showDurationDropdown.value = false;
        showImageModelDropdown.value = false;
        showImageRatioDropdown.value = false;
        showVideoModelDropdown.value = false;
        showVideoRatioDropdown.value = false;
        showVideoResolutionDropdown.value = false;
        showVideoDurationDropdown.value = false;
        if (!wasOpen && showResolutionDropdown.value) {
          updateDropdownPosition(resolutionSelectRef, resolutionDropdownStyle);
        }
      };
      
      const toggleDurationDropdown = () => {
        const wasOpen = showDurationDropdown.value;
        showDurationDropdown.value = !showDurationDropdown.value;
        showModelDropdown.value = false;
        showResolutionDropdown.value = false;
        showImageModelDropdown.value = false;
        showImageRatioDropdown.value = false;
        showVideoModelDropdown.value = false;
        showVideoRatioDropdown.value = false;
        showVideoResolutionDropdown.value = false;
        showVideoDurationDropdown.value = false;
        if (!wasOpen && showDurationDropdown.value) {
          updateDropdownPosition(durationSelectRef, durationDropdownStyle);
        }
      };
      
      const selectModel = (value) => {
        agentModel.value = value;
        showModelDropdown.value = false;
      };
      
      const selectResolution = (value) => {
        videoResolution.value = value;
        showResolutionDropdown.value = false;
      };
      
      const selectDuration = (value) => {
        videoDuration.value = value;
        showDurationDropdown.value = false;
      };
      
      // Image Mode 相关方法
      const toggleImageModelDropdown = () => {
        const wasOpen = showImageModelDropdown.value;
        showImageModelDropdown.value = !showImageModelDropdown.value;
        showImageRatioDropdown.value = false;
        showModelDropdown.value = false;
        showResolutionDropdown.value = false;
        showDurationDropdown.value = false;
        showVideoModelDropdown.value = false;
        showVideoRatioDropdown.value = false;
        showVideoResolutionDropdown.value = false;
        showVideoDurationDropdown.value = false;
        if (!wasOpen && showImageModelDropdown.value) {
          updateDropdownPosition(imageModelSelectRef, imageModelDropdownStyle);
        }
      };
      
      const toggleImageRatioDropdown = () => {
        const wasOpen = showImageRatioDropdown.value;
        showImageRatioDropdown.value = !showImageRatioDropdown.value;
        showImageModelDropdown.value = false;
        showModelDropdown.value = false;
        showResolutionDropdown.value = false;
        showDurationDropdown.value = false;
        showVideoModelDropdown.value = false;
        showVideoRatioDropdown.value = false;
        showVideoResolutionDropdown.value = false;
        showVideoDurationDropdown.value = false;
        if (!wasOpen && showImageRatioDropdown.value) {
          updateDropdownPosition(imageRatioSelectRef, imageRatioDropdownStyle);
        }
      };
      
      const selectImageModel = (value) => {
        imageModel.value = value;
        showImageModelDropdown.value = false;
      };
      
      const selectImageRatio = (value) => {
        imageRatio.value = value;
        showImageRatioDropdown.value = false;
      };
      
      // Video Mode 相关方法
      const toggleVideoModelDropdown = () => {
        const wasOpen = showVideoModelDropdown.value;
        showVideoModelDropdown.value = !showVideoModelDropdown.value;
        showVideoRatioDropdown.value = false;
        showVideoResolutionDropdown.value = false;
        showVideoDurationDropdown.value = false;
        showModelDropdown.value = false;
        showResolutionDropdown.value = false;
        showDurationDropdown.value = false;
        showImageModelDropdown.value = false;
        showImageRatioDropdown.value = false;
        if (!wasOpen && showVideoModelDropdown.value) {
          updateDropdownPosition(videoModelSelectRef, videoModelDropdownStyle);
        }
      };
      
      const toggleVideoRatioDropdown = () => {
        const wasOpen = showVideoRatioDropdown.value;
        showVideoRatioDropdown.value = !showVideoRatioDropdown.value;
        showVideoModelDropdown.value = false;
        showVideoResolutionDropdown.value = false;
        showVideoDurationDropdown.value = false;
        showModelDropdown.value = false;
        showResolutionDropdown.value = false;
        showDurationDropdown.value = false;
        showImageModelDropdown.value = false;
        showImageRatioDropdown.value = false;
        if (!wasOpen && showVideoRatioDropdown.value) {
          updateDropdownPosition(videoRatioSelectRef, videoRatioDropdownStyle);
        }
      };
      
      const toggleVideoResolutionDropdown = () => {
        const wasOpen = showVideoResolutionDropdown.value;
        showVideoResolutionDropdown.value = !showVideoResolutionDropdown.value;
        showVideoModelDropdown.value = false;
        showVideoRatioDropdown.value = false;
        showVideoDurationDropdown.value = false;
        showModelDropdown.value = false;
        showResolutionDropdown.value = false;
        showDurationDropdown.value = false;
        showImageModelDropdown.value = false;
        showImageRatioDropdown.value = false;
        if (!wasOpen && showVideoResolutionDropdown.value) {
          updateDropdownPosition(videoResolutionSelectRef, videoResolutionDropdownStyle);
        }
      };
      
      const toggleVideoDurationDropdown = () => {
        const wasOpen = showVideoDurationDropdown.value;
        showVideoDurationDropdown.value = !showVideoDurationDropdown.value;
        showVideoModelDropdown.value = false;
        showVideoRatioDropdown.value = false;
        showVideoResolutionDropdown.value = false;
        showModelDropdown.value = false;
        showResolutionDropdown.value = false;
        showDurationDropdown.value = false;
        showImageModelDropdown.value = false;
        showImageRatioDropdown.value = false;
        if (!wasOpen && showVideoDurationDropdown.value) {
          updateDropdownPosition(videoDurationSelectRef, videoDurationDropdownStyle);
        }
      };
      
      const selectVideoModel = (value) => {
        videoModel.value = value;
        showVideoModelDropdown.value = false;
      };
      
      const selectVideoRatio = (value) => {
        videoRatio.value = value;
        showVideoRatioDropdown.value = false;
      };
      
      const selectVideoResolution = (value) => {
        videoResolution.value = value;
        showVideoResolutionDropdown.value = false;
      };
      
      const selectVideoDuration = (value) => {
        videoDuration.value = value;
        showVideoDurationDropdown.value = false;
      };
  
      const imageModel = ref('nano-banana');
      const imageRatio = ref('1:1');
  
      const videoModel = ref(t('chatInput1.sora2Series'));
      const videoRatio = ref('16:9');
      const videoResolution = ref('720p');
      const videoDuration = ref('4s');

      const showTemplateDialog = ref(false);
  
      const autoResize = () => {
        const el = inputRef.value;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      };
  
      const triggerUpload = () => {
        if (fileInputRef.value) {
          fileInputRef.value.click();
        }
      };
  
      const handleFiles = (event) => {
        const files = Array.from(event.target.files || []);
        emit('submit', {
          type: 'files',
          files,
        });
      };
  
      const submit = () => {
        emit('submit', {
          type: 'text',
          text: inputText.value.trim(),
          mode: activeMode.value,
          options: {
            agentModel: agentModel.value,
            enableAgentTools: enableAgentTools.value,
            imageModel: imageModel.value,
            imageRatio: imageRatio.value,
            videoModel: videoModel.value,
            videoRatio: videoRatio.value,
            videoResolution: videoResolution.value,
            videoDuration: videoDuration.value,
          },
        });
      };

      const handleOverlayClick = () => {
        emit('close');
      };
  
      onMounted(() => {
        nextTick(() => {
          autoResize();
        });
        
        // 点击外部关闭下拉菜单
        const handleClickOutside = (event) => {
          const target = event.target;
          const wrappers = document.querySelectorAll('.unified-select-wrapper');
          const dropdowns = document.querySelectorAll('.unified-select-dropdown');
          let clickedInside = false;
          
          wrappers.forEach(wrapper => {
            if (wrapper && wrapper.contains(target)) {
              clickedInside = true;
            }
          });
          
          dropdowns.forEach(dropdown => {
            if (dropdown && dropdown.contains(target)) {
              clickedInside = true;
            }
          });
          
          if (!clickedInside) {
            showModelDropdown.value = false;
            showResolutionDropdown.value = false;
            showDurationDropdown.value = false;
            showImageModelDropdown.value = false;
            showImageRatioDropdown.value = false;
            showVideoModelDropdown.value = false;
            showVideoRatioDropdown.value = false;
            showVideoResolutionDropdown.value = false;
            showVideoDurationDropdown.value = false;
          }
        };
        
        // 窗口滚动和调整大小时更新下拉菜单位置
        let scrollRafId = null
        const handleScrollAndResize = () => {
          if (scrollRafId !== null) return
          scrollRafId = requestAnimationFrame(() => {
            scrollRafId = null
            if (showModelDropdown.value && modelSelectRef.value) {
              updateDropdownPosition(modelSelectRef, modelDropdownStyle);
            }
            if (showResolutionDropdown.value && resolutionSelectRef.value) {
              updateDropdownPosition(resolutionSelectRef, resolutionDropdownStyle);
            }
            if (showDurationDropdown.value && durationSelectRef.value) {
              updateDropdownPosition(durationSelectRef, durationDropdownStyle);
            }
            if (showImageModelDropdown.value && imageModelSelectRef.value) {
              updateDropdownPosition(imageModelSelectRef, imageModelDropdownStyle);
            }
            if (showImageRatioDropdown.value && imageRatioSelectRef.value) {
              updateDropdownPosition(imageRatioSelectRef, imageRatioDropdownStyle);
            }
            if (showVideoModelDropdown.value && videoModelSelectRef.value) {
              updateDropdownPosition(videoModelSelectRef, videoModelDropdownStyle);
            }
            if (showVideoRatioDropdown.value && videoRatioSelectRef.value) {
              updateDropdownPosition(videoRatioSelectRef, videoRatioDropdownStyle);
            }
            if (showVideoResolutionDropdown.value && videoResolutionSelectRef.value) {
              updateDropdownPosition(videoResolutionSelectRef, videoResolutionDropdownStyle);
            }
            if (showVideoDurationDropdown.value && videoDurationSelectRef.value) {
              updateDropdownPosition(videoDurationSelectRef, videoDurationDropdownStyle);
            }
          })
        };

        document.addEventListener('click', handleClickOutside);
        window.addEventListener('scroll', handleScrollAndResize, true);
        window.addEventListener('resize', handleScrollAndResize);

        // 在组件卸载时清理事件监听器
        cleanup.add(() => {
          document.removeEventListener('click', handleClickOutside);
          window.removeEventListener('scroll', handleScrollAndResize, true);
          window.removeEventListener('resize', handleScrollAndResize);
          if (scrollRafId !== null) {
            cancelAnimationFrame(scrollRafId);
            scrollRafId = null;
          }
        });
      });
  
      return {
        t,
        inputText,
        inputRef,
        fileInputRef,
        modelSelectRef,
        resolutionSelectRef,
        durationSelectRef,
        modelDropdownRef,
        resolutionDropdownRef,
        durationDropdownRef,
        imageModelSelectRef,
        imageRatioSelectRef,
        imageTemplateSelectRef,
        imageModelDropdownRef,
        imageRatioDropdownRef,
        videoModelSelectRef,
        videoRatioSelectRef,
        videoResolutionSelectRef,
        videoDurationSelectRef,
        videoModelDropdownRef,
        videoRatioDropdownRef,
        videoResolutionDropdownRef,
        videoDurationDropdownRef,
        activeMode,
        agentModel,
        enableAgentTools,
        imageModel,
        imageRatio,
        videoModel,
        videoRatio,
        videoResolution,
        videoDuration,
        showTemplateDialog,
        showModelDropdown,
        showResolutionDropdown,
        showDurationDropdown,
        showImageModelDropdown,
        showImageRatioDropdown,
        showVideoModelDropdown,
        showVideoRatioDropdown,
        showVideoResolutionDropdown,
        showVideoDurationDropdown,
        modelOptions,
        resolutionOptions,
        durationOptions,
        imageModelOptions,
        imageRatioOptions,
        videoModelOptions,
        videoRatioOptions,
        modelDropdownStyle,
        resolutionDropdownStyle,
        durationDropdownStyle,
        imageModelDropdownStyle,
        imageRatioDropdownStyle,
        videoModelDropdownStyle,
        videoRatioDropdownStyle,
        videoResolutionDropdownStyle,
        videoDurationDropdownStyle,
        getModelDisplayName,
        getImageModelDisplayName,
        getVideoModelDisplayName,
        toggleModelDropdown,
        toggleResolutionDropdown,
        toggleDurationDropdown,
        toggleImageModelDropdown,
        toggleImageRatioDropdown,
        toggleVideoModelDropdown,
        toggleVideoRatioDropdown,
        toggleVideoResolutionDropdown,
        toggleVideoDurationDropdown,
        selectModel,
        selectResolution,
        selectDuration,
        selectImageModel,
        selectImageRatio,
        selectVideoModel,
        selectVideoRatio,
        selectVideoResolution,
        selectVideoDuration,
        autoResize,
        triggerUpload,
        handleFiles,
        submit,
        handleOverlayClick,
      };
    },
  };
  </script>
  
  <style scoped>
  .dialogue-overlay {
    position: fixed;
    inset: 0;
    background: var(--color-black-40);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-dropdown);
  }
  
  .dialogue-panel {
    width: 720px;
    max-width: min(720px, calc(100vw - 24px));
    max-height: 80vh;
    background: var(--el-bg-color);
    border-radius: var(--global-border-radius);
    padding: 20px 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  
  .dialogue-input-wrapper {
    background: var(--el-fill-color-lighter);
    border-radius: var(--global-border-radius);
    padding: 8px 12px;
    border: var(--unified-border);
  }
  
  .dialogue-textarea {
    width: 100%;
    border: none;
    outline: none;
    resize: none;
    background: transparent;
    font-size: 14px;
    line-height: 1.6;
    color: var(--el-text-color-primary);
    max-height: 40vh;
  }
  
  .dialogue-textarea::placeholder {
    color: var(--el-text-color-placeholder);
  }
  
  .dialogue-footer {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  
  .footer-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 0 0 auto;
    min-width: 0;
  }
  
  .footer-left,
  .footer-right {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }
  
  .footer-center {
    display: flex;
    align-items: center;
    gap: 0;
    flex-shrink: 1;
    min-width: 0;
  }
  
  .file-input {
    display: none;
  }
  
  .icon-btn {
    min-width: 32px;
    height: 32px;
    width: 32px;
    padding: 0;
    border-radius: var(--global-border-radius);
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--el-fill-color);
    color: var(--el-text-color-regular);
    cursor: pointer;
    font-size: 12px;
    transition: background-color 0.15s ease, transform 0.15s ease;
    flex-shrink: 0;
  }
  
  .icon-btn:hover {
    background: var(--el-fill-color-dark);
    transform: translateY(-1px);
  }
  
  .mode-tab {
    position: relative;
    width: 32px;
    height: 32px;
    min-width: 32px;
    min-height: 32px;
    max-width: 32px;
    border-radius: var(--global-border-radius);
    border: none;
    background: var(--el-fill-color);
    color: var(--el-text-color-regular);
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
    flex-shrink: 0;
  }
  
  .mode-tab:first-child {
    border-radius: var(--global-border-radius);
  }
  
  .mode-tab:last-child {
    border-radius: var(--global-border-radius);
  }
  
  .mode-tab .mode-icon {
    font-size: 12px;
    line-height: 1;
  }
  
  .mode-tab .mode-text {
    position: absolute;
    opacity: 0;
    pointer-events: none;
    visibility: hidden;
    white-space: nowrap;
    background: var(--el-text-color-primary);
    color: var(--el-color-white);
    padding: 6px 10px;
    border-radius: var(--global-border-radius);
    font-size: 12px;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    transition: opacity 0.2s ease, visibility 0.2s ease;
    z-index: var(--z-dropdown);
    }
  
  .mode-tab .mode-text::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: var(--border-unified-color);
  }
  
  .mode-tab:hover .mode-text {
    opacity: 1;
    visibility: visible;
  }
  
  .mode-tab.active {
    background: var(--el-color-primary);
    color: var(--color-on-primary);
  }
  
  .mode-tab:hover {
    transform: translateY(-1px);
  }
  
  .primary-btn {
    height: 32px;
    padding: 0 12px;
    min-width: 48px;
    border-radius: var(--global-border-radius);
    border: none;
    background: var(--el-color-primary);
    color: var(--color-on-primary);
    font-size: 12px;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.15s ease;
  }
  
  .primary-btn:hover {
    background: var(--el-color-primary);
    transform: translateY(-1px);
  }
  
  /* 发送按钮 - 使用 CSS 变量，使用 CSS 变量控制 */

  /* 初始状态 */
  .send-icon-btn {
    --send-btn-size: 32px;
    --send-btn-padding: 0;
    
    width: var(--send-btn-size);
    height: var(--send-btn-size);
    min-width: var(--send-btn-size);
    min-height: var(--send-btn-size);
    padding: var(--send-btn-padding);
    border-radius: var(--global-border-radius);
    background: var(--el-text-color-placeholder);
    color: var(--el-color-white);
    }
  
  /* Hover 状态：背景不变，图标变蓝色 - 使用组合选择器确保优先级 */
  .send-icon-btn:hover {
    background: var(--el-text-color-placeholder);
    color: var(--el-color-primary);
    transition: color 0.3s ease;
    transform: none;
  }
  
  .send-icon-btn:hover svg {
    transition: stroke 0.3s ease;
  }
  
  /* Active 状态 */
  .send-icon-btn:active {
    transform: translateY(0);
    }
  
  /* SVG 图标尺寸 */
  .send-icon-btn svg {
    width: 16px;
    height: 16px;
  }
  
  .mode-settings {
    flex: 1;
    min-width: 0;
    padding: 6px 10px;
    border-radius: var(--global-border-radius);
    background: var(--color-gray-f9fafb);
    display: flex;
    align-items: center;
  }
  
  .mode-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    width: 100%;
  }

  /* 模型和模板属性 */
  .mode-group1 {
    display: flex;
    align-items: center;
  }
  
  /* 次要按钮 - 使用 CSS 变量，使用 CSS 变量控制 */
  .mode-group1 .secondary-btn {
    --secondary-btn-height: 32px;
    
    height: var(--secondary-btn-height);
    min-height: var(--secondary-btn-height);
    max-height: var(--secondary-btn-height);
    padding: 0 12px;
    min-width: auto;
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    background: var(--el-bg-color);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 12px;
    color: var(--el-text-color-primary);
    transition: all 0.15s ease;
  }
  
  .mode-group1 .secondary-btn:hover {
    background: var(--el-fill-color-lighter);
    transform: translateY(-1px);
  }



  .mode-group {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    min-width: 0;
  }
  
  .mode-group label {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    white-space: nowrap;
    flex-shrink: 0;
  }
  
  .mode-group select {
    height: 24px;
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    padding: 0 8px;
    font-size: 12px;
    color: var(--el-text-color-primary);
    background: var(--el-bg-color);
    outline: none;
    min-width: 60px;
    flex-shrink: 1;
  }

  /* 统一风格下拉框样式 */
  .unified-select-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 24px;
    padding: 0 12px;
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    background: var(--el-bg-color);
    cursor: pointer;
    transition: all 0.15s ease;
    min-width: 80px;
  }
  
  .unified-select-wrapper:hover {
    border-color: var(--el-border-color);
    background: var(--el-fill-color-lighter);
  }
  
  /* 模板按钮 - 使用 CSS 变量，使用 CSS 变量控制 */
  .unified-select-wrapper.template-btn {
    --template-btn-height: 24px;
    
    border: var(--unified-border);
    background: var(--el-bg-color);
    height: var(--template-btn-height);
    padding: 0 10px;
  }
  
  .unified-select-wrapper.template-btn:hover {
    border-color: var(--el-border-color);
    background: var(--el-fill-color-lighter);
  }
  
  .unified-select-wrapper .select-icon {
    font-size: 18px;
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
  }
  
  .unified-select-wrapper .select-text {
    flex: 1;
    font-size: 12px;
    color: var(--el-text-color-primary);
    white-space: nowrap;
    text-align: left;
  }
  
  .unified-select-wrapper .select-arrow {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
    transition: transform 0.15s ease;
  }
  
  .unified-select-dropdown {
    position: fixed;
    min-width: 100px;
    background: var(--el-bg-color);
    border: var(--unified-border);
    border-radius: var(--global-border-radius);
    z-index: var(--z-modal);
    max-height: 240px;
    overflow-y: auto;
    padding: 4px 0;
  }
  
  .unified-select-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    font-size: 12px;
    color: var(--el-text-color-primary);
    cursor: pointer;
    transition: background-color 0.15s ease;
    position: relative;
  }
  
  .unified-select-option:hover {
    background: var(--el-fill-color);
  }
  
  .unified-select-option .option-icon {
    font-size: 14px;
    color: var(--el-text-color-secondary);
    flex-shrink: 0;
  }
  
  .unified-select-option .option-text {
    flex: 1;
    text-align: left;
  }
  
  .unified-select-option .option-dot {
    width: 6px;
    height: 6px;
    border-radius: var(--global-border-radius);
    background: var(--el-color-primary);
    flex-shrink: 0;
    margin-left: auto;
  }
  
  .unified-select-option.active {
    background: var(--el-fill-color);
  }
  
  .secondary-btn {
    height: 24px;
    padding: 0 10px;
    min-width: 60px;
    border-radius: var(--global-border-radius);
    border: var(--unified-border);
    background: var(--el-bg-color);
    font-size: 12px;
    color: var(--el-text-color-primary);
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.15s ease;
    flex-shrink: 0;
    white-space: nowrap;
  }
  
  .secondary-btn:hover {
    background: var(--el-fill-color);
    transform: translateY(-1px);
  }
  
  .checkbox-group input {
    margin-right: 4px;
  }
  
  .template-dialog-overlay {
    position: fixed;
    inset: 0;
    background: var(--color-black-40);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
    height: 100vh;
  }

  .template-dialog-panel {
    width: 600px;
    max-width: min(600px, calc(100vw - 24px));
    max-height: 70vh;
    background: var(--el-bg-color);
    border-radius: var(--global-border-radius);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .template-dialog-header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    border-bottom: var(--unified-border-bottom);
  }

  .template-dialog-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .template-close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 24px;
    height: 24px;
    border-radius: var(--global-border-radius);
    border: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--el-fill-color);
    color: var(--el-text-color-regular);
    cursor: pointer;
    font-size: 16px;
    transition: background-color 0.15s ease, transform 0.15s ease;
  }

  .template-close-btn:hover {
    background: var(--el-fill-color-dark);
    transform: translateY(-1px);
  }

  .template-dialog-content {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }

  .template-dialog-content p {
    margin: 0;
    color: var(--el-text-color-secondary);
    font-size: 14px;
  }

  @media (width <= 768px) {
    .dialogue-panel {
      width: 100%;
      margin: 0 12px;
    }
  
    .dialogue-footer {
      flex-direction: column;
      align-items: stretch;
    }
  
    .footer-controls {
      width: 100%;
      flex-wrap: wrap;
    }
  
    .footer-center {
      width: 100%;
      justify-content: flex-start;
      overflow-x: auto;
      order: -1;
    }
  
    .mode-settings {
      width: 100%;
    }
  
    .mode-tab .mode-text {
      display: none;
    }

    .mode-row {
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
    }

    .mode-group {
      width: 100%;
      justify-content: space-between;
    }

    .template-dialog-panel {
      width: 100%;
      margin: 0 12px;
      max-height: 80vh;
    }
  }
  </style>
  
  
  