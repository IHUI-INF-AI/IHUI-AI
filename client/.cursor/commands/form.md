# 生成表单

根据字段定义生成完整的表单组件。

## 指令

请根据以下字段生成表单：

{{selection}}

### 表单结构

```vue
<template>
  <el-form
    ref="formRef"
    :model="formData"
    :rules="rules"
    label-width="100px"
    @submit.prevent="handleSubmit"
  >
    <el-form-item label="用户名" prop="username">
      <el-input
        v-model="formData.username"
        placeholder="请输入用户名"
        clearable
      />
    </el-form-item>

    <el-form-item label="邮箱" prop="email">
      <el-input
        v-model="formData.email"
        type="email"
        placeholder="请输入邮箱"
      />
    </el-form-item>

    <el-form-item label="状态" prop="status">
      <el-select v-model="formData.status" placeholder="请选择">
        <el-option label="启用" value="active" />
        <el-option label="禁用" value="inactive" />
      </el-select>
    </el-form-item>

    <el-form-item>
      <el-button type="primary" native-type="submit">提交</el-button>
      <el-button @click="handleReset">重置</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'

const formRef = ref<FormInstance>()

const formData = reactive({
  username: '',
  email: '',
  status: '',
})

const rules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' },
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' },
  ],
}

const handleSubmit = async () => {
  const valid = await formRef.value?.validate()
  if (valid) {
    // 提交逻辑
  }
}

const handleReset = () => {
  formRef.value?.resetFields()
}
</script>
```

### 支持的字段类型

- 文本输入
- 数字输入
- 选择器
- 日期选择
- 开关
- 单选/多选
- 文件上传

### 输出

完整的表单组件代码
