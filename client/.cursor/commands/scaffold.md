# 快速脚手架

根据需求快速生成项目结构或功能模块。

## 指令

请根据以下需求生成代码脚手架：

{{selection}}

### 支持的脚手架类型

1. **功能模块**
```
src/modules/user/
├── api/
│   └── index.ts          # API 接口
├── components/
│   ├── UserList.vue      # 用户列表
│   ├── UserForm.vue      # 用户表单
│   └── UserDetail.vue    # 用户详情
├── composables/
│   └── useUser.ts        # 组合式函数
├── stores/
│   └── user.ts           # 状态管理
├── types/
│   └── index.ts          # 类型定义
├── views/
│   ├── index.vue         # 列表页
│   └── [id].vue          # 详情页
└── index.ts              # 模块入口
```

2. **组件库**
```
src/components/Button/
├── Button.vue            # 组件实现
├── Button.test.ts        # 单元测试
├── Button.stories.ts     # Storybook
├── types.ts              # 类型定义
└── index.ts              # 导出
```

3. **API 模块**
```
src/api/user/
├── index.ts              # 接口函数
├── types.ts              # 类型定义
└── mock.ts               # Mock 数据
```

### 输出

1. 目录结构说明
2. 各文件的基础代码
3. 使用说明
