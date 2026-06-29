# cloud-learning-setting-service 配置服务

## 概述

配置服务主要负责处理系统配置管理、参数设置、配置分组等业务功能，为系统提供统一的配置管理能力。

## 配置管理接口

### 1. 获取配置列表

- **接口路径**: `GET /auth-api/settings`
- **接口描述**: 获取系统配置列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "group": "system",         // 可选，配置分组
  "keyword": "搜索关键字",     // 可选，搜索关键字
  "enabled": true            // 可选，是否启用
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 配置列表
    {
      "id": 1,                // 配置ID
      "key": "site.name",     // 配置键
      "value": "探学在线",     // 配置值
      "type": "string",       // 配置类型
      "group": "system",      // 配置分组
      "label": "网站名称",     // 配置标签
      "description": "网站显示名称", // 配置描述
      "options": "",          // 配置选项（JSON字符串）
      "sortOrder": 1,          // 排序序号
      "enabled": true,         // 是否启用
      "readonly": false,      // 是否只读
      "createTime": "2023-05-01 12:00:00",  // 创建时间
      "updateTime": "2023-05-02 13:00:00"   // 更新时间
    }
  ]
}
```

### 2. 获取配置详情

- **接口路径**: `GET /auth-api/setting/{key}`
- **接口描述**: 获取指定配置的详情
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "key": "site.name"         // 必填，配置键，通过路径参数传递
}
```
- **响应参数**: 同配置列表中的单个配置对象

### 3. 创建配置

- **接口路径**: `POST /auth-api/setting`
- **接口描述**: 创建新的系统配置
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "key": "new.setting",      // 必填，配置键
  "value": "默认值",          // 必填，配置值
  "type": "string",          // 必填，配置类型
  "group": "custom",         // 必填，配置分组
  "label": "新配置项",        // 必填，配置标签
  "description": "新配置项描述", // 可选，配置描述
  "options": "{}",           // 可选，配置选项（JSON字符串）
  "sortOrder": 10,           // 可选，排序序号
  "enabled": true,           // 可选，是否启用
  "readonly": false          // 可选，是否只读
}
```
- **响应参数**: 同获取配置详情

### 4. 更新配置

- **接口路径**: `PUT /auth-api/setting/{key}`
- **接口描述**: 更新系统配置
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "key": "site.name",        // 必填，配置键，通过路径参数传递
  "value": "新网站名称",      // 可选，新配置值
  "type": "string",          // 可选，新配置类型
  "group": "system",         // 可选，新配置分组
  "label": "新网站名称标签",   // 可选，新配置标签
  "description": "新网站名称描述", // 可选，新配置描述
  "options": "{}",           // 可选，新配置选项
  "sortOrder": 2,            // 可选，新排序序号
  "enabled": true,           // 可选，新启用状态
  "readonly": false          // 可选，新只读状态
}
```
- **响应参数**: 同获取配置详情

### 5. 删除配置

- **接口路径**: `DELETE /auth-api/setting/{key}`
- **接口描述**: 删除系统配置
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "key": "new.setting"       // 必填，配置键，通过路径参数传递
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 6. 批量更新配置

- **接口路径**: `PUT /auth-api/settings/batch`
- **接口描述**: 批量更新多个配置
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
[
  {
    "key": "site.name",      // 必填，配置键
    "value": "新网站名称"     // 必填，新配置值
  },
  {
    "key": "site.description",
    "value": "新网站描述"
  }
]
```
- **响应参数**:
```json
{
  "success": true,            // 批量更新是否成功
  "updatedCount": 2           // 更新的配置数量
}
```

### 7. 启用/禁用配置

- **接口路径**: `PUT /auth-api/setting/{key}/enable`
- **接口描述**: 启用或禁用配置
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "key": "site.name",        // 必填，配置键，通过路径参数传递
  "enabled": false           // 必填，启用状态
}
```
- **响应参数**:
```json
{
  "success": true,            // 操作是否成功
  "enabled": false            // 当前启用状态
}
```

## 配置分组接口

### 1. 获取配置分组列表

- **接口路径**: `GET /auth-api/setting/groups`
- **接口描述**: 获取配置分组列表
- **权限要求**: 需要管理员权限
- **请求参数**: 无
- **响应参数**:
```json
[
  {
    "group": "system",       // 分组名称
    "label": "系统配置",      // 分组标签
    "description": "系统基础配置", // 分组描述
    "icon": "system-icon",   // 分组图标
    "sortOrder": 1,          // 排序序号
    "configCount": 15        // 配置数量
  },
  {
    "group": "email",
    "label": "邮件配置",
    "description": "邮件服务配置",
    "icon": "email-icon",
    "sortOrder": 2,
    "configCount": 8
  }
]
```

### 2. 创建配置分组

- **接口路径**: `POST /auth-api/setting/group`
- **接口描述**: 创建新的配置分组
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "group": "new.group",      // 必填，分组名称
  "label": "新分组",         // 必填，分组标签
  "description": "新分组描述", // 可选，分组描述
  "icon": "new-icon",        // 可选，分组图标
  "sortOrder": 10            // 可选，排序序号
}
```
- **响应参数**: 同获取配置分组列表中的单个分组对象

### 3. 更新配置分组

- **接口路径**: `PUT /auth-api/setting/group/{group}`
- **接口描述**: 更新配置分组
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "group": "new.group",      // 必填，分组名称，通过路径参数传递
  "label": "更新后的分组标签", // 可选，新分组标签
  "description": "更新后的分组描述", // 可选，新分组描述
  "icon": "updated-icon",    // 可选，新分组图标
  "sortOrder": 5             // 可选，新排序序号
}
```
- **响应参数**: 同获取配置分组列表中的单个分组对象

### 4. 删除配置分组

- **接口路径**: `DELETE /auth-api/setting/group/{group}`
- **接口描述**: 删除配置分组
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "group": "new.group"       // 必填，分组名称，通过路径参数传递
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

## 公共配置接口

### 1. 获取公共配置

- **接口路径**: `GET /public-api/settings`
- **接口描述**: 获取公共配置（无需权限）
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "groups": ["system", "site"] // 可选，配置分组列表
}
```
- **响应参数**:
```json
{
  "system": {                 // 系统配置组
    "site.name": "探学在线",
    "site.description": "专业的在线学习平台"
  },
  "site": {                   // 网站配置组
    "logo.url": "/images/logo.png",
    "favicon.url": "/images/favicon.ico"
  }
}
```

### 2. 获取单个公共配置

- **接口路径**: `GET /public-api/setting/{key}`
- **接口描述**: 获取单个公共配置值
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "key": "site.name"         // 必填，配置键，通过路径参数传递
}
```
- **响应参数**:
```json
{
  "value": "探学在线"         // 配置值
}
```

## 配置导入导出接口

### 1. 导出配置

- **接口路径**: `GET /auth-api/settings/export`
- **接口描述**: 导出系统配置
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "groups": ["system", "email"] // 可选，导出的配置分组
}
```
- **响应参数**: 返回JSON格式的配置文件

### 2. 导入配置

- **接口路径**: `POST /auth-api/settings/import`
- **接口描述**: 导入系统配置
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "file": "配置文件",        // 必填，配置文件
  "overwrite": true         // 可选，是否覆盖现有配置
}
```
- **响应参数**:
```json
{
  "success": true,            // 导入是否成功
  "importedCount": 25,        // 导入的配置数量
  "skippedCount": 3           // 跳过的配置数量
}
```

## 数据模型

### 配置类型枚举
- `string`: 字符串
- `number`: 数字
- `boolean`: 布尔值
- `json`: JSON对象
- `array`: 数组
- `select`: 下拉选择
- `radio`: 单选按钮
- `checkbox`: 多选按钮

### 配置分组枚举（示例）
- `system`: 系统配置
- `site`: 网站配置
- `email`: 邮件配置
- `sms`: 短信配置
- `storage`: 存储配置
- `payment`: 支付配置
- `security`: 安全配置
- `custom`: 自定义配置