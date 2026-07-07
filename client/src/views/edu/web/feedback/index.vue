<template>
  <div class="feedback-container">
    <div class="feedback-header">
      <h1 class="feedback-title">意见反馈</h1>
      <p class="feedback-subtitle">您的意见对我们非常重要</p>
    </div>
    
    <div class="feedback-content">
      <el-form
        ref="feedbackFormRef"
        :model="feedbackForm"
        :rules="feedbackRules"
        label-width="100px"
        class="feedback-form"
      >
        <el-form-item label="反馈类型" prop="type">
          <el-select v-model="feedbackForm.type" placeholder="请选择反馈类型" style="width: 100%">
            <el-option label="功能建议" value="suggestion" />
            <el-option label="问题反馈" value="problem" />
            <el-option label="内容纠错" value="correction" />
            <el-option label="其他" value="other" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="反馈标题" prop="title">
          <el-input
            v-model="feedbackForm.title"
            placeholder="请简要描述您的反馈"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="详细描述" prop="content">
          <el-input
            v-model="feedbackForm.content"
            type="textarea"
            :rows="6"
            placeholder="请详细描述您的意见或建议..."
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="联系方式" prop="contact">
          <el-input
            v-model="feedbackForm.contact"
            placeholder="请留下您的联系方式（手机/邮箱），方便我们回复您"
          />
        </el-form-item>
        
        <el-form-item label="上传截图">
          <el-upload
            class="upload-demo"
            action="#"
            :auto-upload="false"
            :on-change="handleFileChange"
            :file-list="fileList"
            list-type="picture-card"
            :limit="3"
          >
            <el-icon><Plus /></el-icon>
            <template #tip>
              <div class="el-upload__tip">
                支持 jpg/png 格式，最多上传3张图片
              </div>
            </template>
          </el-upload>
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="submitFeedback" :loading="submitting">
            提交反馈
          </el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 反馈须知 -->
      <div class="feedback-notice">
        <h3>反馈须知</h3>
        <ul>
          <li>请尽量详细描述您遇到的问题或建议，以便我们更好地处理</li>
          <li>如有必要，请附上相关截图，帮助我们更快定位问题</li>
          <li>留下您的联系方式，我们会尽快回复您的反馈</li>
          <li>感谢您对我们的支持与信任！</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@/lib/lucide-fallback'

export default {
  name: "FeedbackIndex",
  components: {
    Plus
  },
  setup() {
    const feedbackFormRef = ref(null)
    const submitting = ref(false)
    const fileList = ref([])
    
    const feedbackForm = reactive({
      type: '',
      title: '',
      content: '',
      contact: ''
    })
    
    const feedbackRules = {
      type: [
        { required: true, message: '请选择反馈类型', trigger: 'change' }
      ],
      title: [
        { required: true, message: '请输入反馈标题', trigger: 'blur' },
        { min: 2, max: 50, message: '标题长度在 2 到 50 个字符', trigger: 'blur' }
      ],
      content: [
        { required: true, message: '请输入详细描述', trigger: 'blur' },
        { min: 10, max: 500, message: '描述长度在 10 到 500 个字符', trigger: 'blur' }
      ]
    }
    
    const handleFileChange = (uploadFile, uploadFileList) => {
      // 处理文件变化，更新文件列表
      fileList.value = uploadFileList
    }
    
    const submitFeedback = async () => {
      if (!feedbackFormRef.value) return
      
      await feedbackFormRef.value.validate((valid) => {
        if (valid) {
          submitting.value = true
          
          // 模拟提交
          setTimeout(() => {
            submitting.value = false
            ElMessage.success('感谢您的反馈，我们会尽快处理！')
            resetForm()
          }, 1500)
        }
      })
    }
    
    const resetForm = () => {
      if (feedbackFormRef.value) {
        feedbackFormRef.value.resetFields()
      }
      fileList.value = []
    }
    
    return {
      feedbackFormRef,
      feedbackForm,
      feedbackRules,
      submitting,
      fileList,
      handleFileChange,
      submitFeedback,
      resetForm
    }
  }
}
</script>

<style lang="scss" scoped>
.feedback-container {
  max-width: 1200px;
  min-width: 1200px;
  margin: 30px auto 40px;
  padding: 0 20px;
  background: #fff;
  border-radius: 8px;
}

.feedback-header {
  text-align: center;
  padding: 40px 0;
  border-bottom: 1px solid #eee;
}

.feedback-title {
  font-size: 32px;
  color: #303133;
  margin: 0 0 10px;
  font-weight: 600;
}

.feedback-subtitle {
  font-size: 18px;
  color: #606266;
  margin: 0;
}

.feedback-content {
  padding: 40px 0;
  display: flex;
  gap: 50px;
}

.feedback-form {
  flex: 1;
  max-width: 700px;
  
  :deep(.el-form-item__label) {
    font-weight: 500;
  }
  
  :deep(.el-textarea__inner) {
    font-family: inherit;
  }
}

.upload-demo {
  :deep(.el-upload--picture-card) {
    width: 100px;
    height: 100px;
    line-height: 100px;
  }
  
  :deep(.el-upload-list__item) {
    width: 100px;
    height: 100px;
  }
}

.feedback-notice {
  flex: 0 0 300px;
  background: #f5f7fa;
  padding: 30px;
  border-radius: 8px;
  height: fit-content;
  
  h3 {
    font-size: 18px;
    color: #303133;
    margin: 0 0 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid #409eff;
  }
  
  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    
    li {
      position: relative;
      padding-left: 20px;
      margin-bottom: 15px;
      font-size: 14px;
      line-height: 1.8;
      color: #606266;
      
      &::before {
        content: '•';
        position: absolute;
        left: 0;
        color: #409eff;
        font-weight: bold;
      }
      
      &:last-child {
        margin-bottom: 0;
      }
    }
  }
}

@media (max-width: 1200px) {
  .feedback-container {
    min-width: auto;
  }
  
  .feedback-content {
    flex-direction: column;
  }
  
  .feedback-form {
    max-width: 100%;
  }
  
  .feedback-notice {
    flex: none;
    width: 100%;
  }
}
</style>
