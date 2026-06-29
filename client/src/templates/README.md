# 组件模板索引

本目录包含项目开发中常用的组件模板，用于快速创建符合项目规范的新组件。

## 模板列表

| 模板文件 | 用途 | 特性 |
|----------|------|------|
| [ComponentTemplate.vue](./ComponentTemplate.vue) | 通用组件模板 | 暗色模式、响应式、语义化变量 |
| [CardTemplate.vue](./CardTemplate.vue) | 卡片组件模板 | 加载状态、选中状态、悬停效果 |
| [FormTemplate.vue](./FormTemplate.vue) | 表单组件模板 | 表单验证、加载状态、响应式 |
| [ListTemplate.vue](./ListTemplate.vue) | 列表组件模板 | 分页、空状态、加载状态 |

## 使用方法

### 1. 复制模板

```bash
# 复制模板到目标目录
cp src/templates/ComponentTemplate.vue src/components/YourComponent.vue
```

### 2. 修改组件

1. 修改组件名称
2. 调整 props 定义
3. 自定义样式变量
4. 添加业务逻辑

### 3. 样式规范

所有模板遵循以下规范：

- 使用 CSS 变量代替硬编码颜色
- 支持暗色模式
- 使用语义化命名
- 支持响应式布局

## 模板详细说明

### ComponentTemplate - 通用组件模板

适用于：页面区块、功能模块、内容区域

```vue
<template>
  <ComponentTemplate title="标题">
    <template #actions>
      <el-button>操作</el-button>
    </template>
    <!-- 内容 -->
  </ComponentTemplate>
</template>
```

### CardTemplate - 卡片组件模板

适用于：信息卡片、商品卡片、功能卡片

```vue
<template>
  <CardTemplate
    title="卡片标题"
    subtitle="副标题"
    :clickable="true"
    @click="handleClick"
  >
    <template #image>
      <img src="..." />
    </template>
    卡片内容
  </CardTemplate>
</template>
```

### FormTemplate - 表单组件模板

适用于：登录表单、注册表单、设置表单

```vue
<template>
  <FormTemplate
    title="登录"
    subtitle="请输入您的账号信息"
    submit-text="登录"
    :loading="loading"
    @submit="handleSubmit"
  >
    <el-form-item label="用户名">
      <el-input v-model="form.username" />
    </el-form-item>
    <el-form-item label="密码">
      <el-input v-model="form.password" type="password" />
    </el-form-item>
  </FormTemplate>
</template>
```

### ListTemplate - 列表组件模板

适用于：数据列表、商品列表、文章列表

```vue
<template>
  <ListTemplate
    title="数据列表"
    :loading="loading"
    :empty="list.length === 0"
    :show-pagination="true"
    :total="total"
    @update:page="handlePageChange"
  >
    <template #actions>
      <el-button type="primary">新增</el-button>
    </template>
    
    <ListItem v-for="item in list" :key="item.id" :data="item" />
  </ListTemplate>
</template>
```

## CSS 变量速查

### 颜色变量

```scss
// 文字颜色
--el-text-color-primary      // 主要文字
--el-text-color-regular      // 常规文字
--el-text-color-secondary    // 次要文字

// 背景颜色
--el-bg-color               // 基础背景
--el-bg-color-page          // 页面背景

// 边框颜色
--el-border-color           // 基础边框
--el-border-color-lighter   // 浅色边框
```

### 全局变量

```scss
// 圆角
--global-border-radius      // 8px
--global-border-radius-sm   // 4px
--global-border-radius-lg   // 12px

// 阴影
--global-box-shadow         // 基础阴影
--global-box-shadow-sm      // 小阴影
--global-box-shadow-lg      // 大阴影

// 间距
--spacing-xs                // 4px
--spacing-sm                // 8px
--spacing-md                // 12px
--spacing-lg                // 16px
--spacing-xl                // 24px
```

## 相关文档

- [CSS 变量命名规范](../docs/css-variables-guide.md)
- [暗色模式开发指南](../docs/dark-mode-guide.md)
- [CSS 变量速查表组件](../src/components/dev/CSSVariablesCheatsheet.vue)
- [硬编码颜色检测脚本](../scripts/check-hardcoded-colors.ts)（已移除，建议用 stylelint 或手动检查替代）
