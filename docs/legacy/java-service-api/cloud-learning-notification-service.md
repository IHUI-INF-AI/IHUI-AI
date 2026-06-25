# cloud-learning-notification-service 通知服务

## 概述

通知服务主要负责管理平台上的各种推送通知，包括站内信、邮件通知、短信通知和APP推送等功能。

## 站内信接口

### 1. 发送站内信

- **接口路径**: `POST /admin-api/letter`
- **接口描述**: 发送站内信
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "title": "站内信标题",       // 必填，站内信标题
  "content": "站内信内容",     // 必填，站内信内容
  "type": "system",           // 必填，站内信类型：system(系统通知), activity(活动通知), maintenance(维护通知)
  "level": "normal",          // 必填，站内信级别：normal(普通), important(重要), urgent(紧急)
  "targetType": "all",        // 必填，目标类型：all(所有用户), vip(VIP用户), member(普通用户), specified(指定用户)
  "memberIdList": [1001, 1002], // 可选，指定用户ID列表，targetType为specified时必填
  "sendTime": "2023-05-01 12:00:00" // 可选，发送时间，默认为当前时间
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 站内信ID
  "title": "站内信标题",       // 站内信标题
  "content": "站内信内容",     // 站内信内容
  "type": "system",           // 站内信类型
  "level": "normal",          // 站内信级别
  "targetType": "all",        // 目标类型
  "memberIdList": [1001, 1002], // 指定用户ID列表
  "sendTime": "2023-05-01 12:00:00", // 发送时间
  "sendNum": 1000,           // 发送数量
  "readNum": 500,            // 已读数量
  "status": "sent",          // 站内信状态：draft(草稿), pending(待发送), sending(发送中), sent(已发送), failed(发送失败)
  "memberId": 1001,           // 创建者ID
  "member": {                 // 创建者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 获取站内信列表

- **接口路径**: `GET /admin-api/letter/list`
- **接口描述**: 获取站内信列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "type": "system",           // 可选，站内信类型
  "level": "normal",          // 可选，站内信级别
  "status": "sent",          // 可选，站内信状态
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), sendTime(发送时间), sendNum(发送数量)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 站内信列表
    {
      // 同发送站内信接口的响应参数
    }
  ]
}
```

### 3. 获取用户站内信列表

- **接口路径**: `GET /auth-api/letter/list`
- **接口描述**: 获取当前登录用户的站内信列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "type": "system",           // 可选，站内信类型
  "level": "normal",          // 可选，站内信级别
  "isRead": false,           // 可选，是否已读
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 20,                // 总记录数
  "list": [                   // 站内信列表
    {
      "id": 1,                // 站内信记录ID
      "letterId": 1,          // 站内信ID
      "title": "站内信标题",   // 站内信标题
      "content": "站内信内容", // 站内信内容
      "type": "system",       // 站内信类型
      "level": "normal",      // 站内信级别
      "isRead": false,       // 是否已读
      "readTime": null,       // 已读时间
      "createTime": "2023-05-01 12:00:00"  // 创建时间
    }
  ]
}
```

### 4. 标记站内信为已读

- **接口路径**: `PUT /auth-api/letter/read`
- **接口描述**: 标记站内信为已读
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，站内信记录ID
}
```
- **响应参数**:
```json
{
  "success": true,            // 标记是否成功
  "readTime": "2023-05-01 12:30:00" // 已读时间
}
```

### 5. 批量标记站内信为已读

- **接口路径**: `PUT /auth-api/letter/read/batch`
- **接口描述**: 批量标记站内信为已读
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "idList": [1, 2, 3]       // 必填，站内信记录ID列表
}
```
- **响应参数**:
```json
{
  "success": true,            // 标记是否成功
  "readNum": 3,             // 已标记数量
  "readTime": "2023-05-01 12:30:00" // 已读时间
}
```

### 6. 获取未读站内信数量

- **接口路径**: `GET /auth-api/letter/unread-count`
- **接口描述**: 获取当前登录用户的未读站内信数量
- **权限要求**: 需要登录认证
- **请求参数**: 无
- **响应参数**:
```json
{
  "count": 5                 // 未读站内信数量
}
```

## 邮件通知接口

### 1. 发送邮件通知

- **接口路径**: `POST /admin-api/email`
- **接口描述**: 发送邮件通知
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "title": "邮件标题",         // 必填，邮件标题
  "content": "邮件内容",       // 必填，邮件内容
  "type": "system",           // 必填，邮件类型：system(系统通知), activity(活动通知), maintenance(维护通知)
  "targetType": "all",        // 必填，目标类型：all(所有用户), vip(VIP用户), member(普通用户), specified(指定用户)
  "memberIdList": [1001, 1002], // 可选，指定用户ID列表，targetType为specified时必填
  "sendTime": "2023-05-01 12:00:00" // 可选，发送时间，默认为当前时间
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 邮件记录ID
  "title": "邮件标题",         // 邮件标题
  "content": "邮件内容",       // 邮件内容
  "type": "system",           // 邮件类型
  "targetType": "all",        // 目标类型
  "memberIdList": [1001, 1002], // 指定用户ID列表
  "sendTime": "2023-05-01 12:00:00", // 发送时间
  "sendNum": 1000,           // 发送数量
  "successNum": 950,         // 成功数量
  "failNum": 50,             // 失败数量
  "status": "sent",          // 邮件状态：draft(草稿), pending(待发送), sending(发送中), sent(已发送), failed(发送失败)
  "memberId": 1001,           // 创建者ID
  "member": {                 // 创建者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 获取邮件通知列表

- **接口路径**: `GET /admin-api/email/list`
- **接口描述**: 获取邮件通知列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "type": "system",           // 可选，邮件类型
  "status": "sent",          // 可选，邮件状态
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), sendTime(发送时间), sendNum(发送数量)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 邮件通知列表
    {
      // 同发送邮件通知接口的响应参数
    }
  ]
}
```

### 3. 获取邮件通知详情

- **接口路径**: `GET /admin-api/email/{id}`
- **接口描述**: 获取邮件通知详情
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，邮件记录ID，通过路径参数传递
}
```
- **响应参数**: 同发送邮件通知接口

### 4. 获取邮件发送失败列表

- **接口路径**: `GET /admin-api/email/fail-list/{id}`
- **接口描述**: 获取邮件发送失败列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，邮件记录ID，通过路径参数传递
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10              // 可选，每页大小，默认为10
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 失败列表
    {
      "id": 1,                // 失败记录ID
      "emailId": 1,            // 邮件记录ID
      "email": "email@example.com", // 邮箱地址
      "reason": "邮箱地址不存在", // 失败原因
      "sendTime": "2023-05-01 12:00:00" // 发送时间
    }
  ]
}
```

## 短信通知接口

### 1. 发送短信通知

- **接口路径**: `POST /admin-api/sms`
- **接口描述**: 发送短信通知
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "content": "短信内容",       // 必填，短信内容
  "type": "system",           // 必填，短信类型：system(系统通知), activity(活动通知), maintenance(维护通知)
  "targetType": "all",        // 必填，目标类型：all(所有用户), vip(VIP用户), member(普通用户), specified(指定用户)
  "memberIdList": [1001, 1002], // 可选，指定用户ID列表，targetType为specified时必填
  "sendTime": "2023-05-01 12:00:00" // 可选，发送时间，默认为当前时间
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 短信记录ID
  "content": "短信内容",       // 短信内容
  "type": "system",           // 短信类型
  "targetType": "all",        // 目标类型
  "memberIdList": [1001, 1002], // 指定用户ID列表
  "sendTime": "2023-05-01 12:00:00", // 发送时间
  "sendNum": 1000,           // 发送数量
  "successNum": 950,         // 成功数量
  "failNum": 50,             // 失败数量
  "status": "sent",          // 短信状态：draft(草稿), pending(待发送), sending(发送中), sent(已发送), failed(发送失败)
  "memberId": 1001,           // 创建者ID
  "member": {                 // 创建者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 获取短信通知列表

- **接口路径**: `GET /admin-api/sms/list`
- **接口描述**: 获取短信通知列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "type": "system",           // 可选，短信类型
  "status": "sent",          // 可选，短信状态
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), sendTime(发送时间), sendNum(发送数量)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 短信通知列表
    {
      // 同发送短信通知接口的响应参数
    }
  ]
}
```

### 3. 获取短信通知详情

- **接口路径**: `GET /admin-api/sms/{id}`
- **接口描述**: 获取短信通知详情
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，短信记录ID，通过路径参数传递
}
```
- **响应参数**: 同发送短信通知接口

### 4. 获取短信发送失败列表

- **接口路径**: `GET /admin-api/sms/fail-list/{id}`
- **接口描述**: 获取短信发送失败列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，短信记录ID，通过路径参数传递
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10              // 可选，每页大小，默认为10
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 失败列表
    {
      "id": 1,                // 失败记录ID
      "smsId": 1,              // 短信记录ID
      "phone": "13800138000",   // 手机号
      "reason": "手机号不存在",   // 失败原因
      "sendTime": "2023-05-01 12:00:00" // 发送时间
    }
  ]
}
```

## APP推送接口

### 1. 发送APP推送

- **接口路径**: `POST /admin-api/push`
- **接口描述**: 发送APP推送
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "title": "推送标题",         // 必填，推送标题
  "content": "推送内容",       // 必填，推送内容
  "type": "system",           // 必填，推送类型：system(系统通知), activity(活动通知), maintenance(维护通知)
  "targetType": "all",        // 必填，目标类型：all(所有用户), vip(VIP用户), member(普通用户), specified(指定用户)
  "memberIdList": [1001, 1002], // 可选，指定用户ID列表，targetType为specified时必填
  "platform": "all",          // 可选，目标平台：all(所有平台), android(Android), ios(iOS)
  "sendTime": "2023-05-01 12:00:00" // 可选，发送时间，默认为当前时间
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 推送记录ID
  "title": "推送标题",         // 推送标题
  "content": "推送内容",       // 推送内容
  "type": "system",           // 推送类型
  "targetType": "all",        // 目标类型
  "memberIdList": [1001, 1002], // 指定用户ID列表
  "platform": "all",          // 目标平台
  "sendTime": "2023-05-01 12:00:00", // 发送时间
  "sendNum": 1000,           // 发送数量
  "successNum": 950,         // 成功数量
  "failNum": 50,             // 失败数量
  "status": "sent",          // 推送状态：draft(草稿), pending(待发送), sending(发送中), sent(已发送), failed(发送失败)
  "memberId": 1001,           // 创建者ID
  "member": {                 // 创建者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 获取APP推送列表

- **接口路径**: `GET /admin-api/push/list`
- **接口描述**: 获取APP推送列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "type": "system",           // 可选，推送类型
  "platform": "all",          // 可选，目标平台
  "status": "sent",          // 可选，推送状态
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), sendTime(发送时间), sendNum(发送数量)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // APP推送列表
    {
      // 同发送APP推送接口的响应参数
    }
  ]
}
```

### 3. 获取APP推送详情

- **接口路径**: `GET /admin-api/push/{id}`
- **接口描述**: 获取APP推送详情
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，推送记录ID，通过路径参数传递
}
```
- **响应参数**: 同发送APP推送接口

### 4. 获取APP推送发送失败列表

- **接口路径**: `GET /admin-api/push/fail-list/{id}`
- **接口描述**: 获取APP推送发送失败列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，推送记录ID，通过路径参数传递
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10              // 可选，每页大小，默认为10
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 失败列表
    {
      "id": 1,                // 失败记录ID
      "pushId": 1,             // 推送记录ID
      "deviceId": "device123",   // 设备ID
      "reason": "设备离线",     // 失败原因
      "sendTime": "2023-05-01 12:00:00" // 发送时间
    }
  ]
}
```

## 设备管理接口

### 1. 注册设备

- **接口路径**: `POST /auth-api/device`
- **接口描述**: 注册设备
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "deviceId": "device123",     // 必填，设备ID
  "platform": "android",     // 必填，平台：android(Android), ios(iOS)
  "model": "设备型号",        // 必填，设备型号
  "osVersion": "系统版本",    // 必填，系统版本
  "appVersion": "应用版本",   // 必填，应用版本
  "pushToken": "推送令牌"    // 必填，推送令牌
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 设备记录ID
  "deviceId": "device123",     // 设备ID
  "platform": "android",     // 平台
  "model": "设备型号",        // 设备型号
  "osVersion": "系统版本",    // 系统版本
  "appVersion": "应用版本",   // 应用版本
  "pushToken": "推送令牌",   // 推送令牌
  "isOnline": true,           // 是否在线
  "lastActiveTime": "2023-05-01 12:00:00", // 最后活跃时间
  "memberId": 1001,           // 用户ID
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 修改设备

- **接口路径**: `PUT /auth-api/device`
- **接口描述**: 修改设备信息
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1,                    // 必填，设备记录ID
  "deviceId": "device123",     // 可选，设备ID
  "platform": "android",     // 可选，平台
  "model": "新设备型号",      // 可选，设备型号
  "osVersion": "新系统版本",  // 可选，系统版本
  "appVersion": "新应用版本", // 可选，应用版本
  "pushToken": "新推送令牌"  // 可选，推送令牌
}
```
- **响应参数**: 同注册设备接口

### 3. 删除设备

- **接口路径**: `DELETE /auth-api/device`
- **接口描述**: 删除设备
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，要删除的设备记录ID
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 4. 获取用户设备列表

- **接口路径**: `GET /auth-api/device/list`
- **接口描述**: 获取当前登录用户的设备列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "platform": "android",      // 可选，平台
  "isOnline": true,           // 可选，是否在线
  "orderColumn": "lastActiveTime", // 可选，排序字段
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 5,                 // 总记录数
  "list": [                   // 设备列表
    {
      // 同注册设备接口的响应参数
    }
  ]
}
```

## 数据模型

### 通知类型枚举

- `system`: 系统通知
- `activity`: 活动通知
- `maintenance`: 维护通知

### 通知级别枚举

- `normal`: 普通
- `important`: 重要
- `urgent`: 紧急

### 目标类型枚举

- `all`: 所有用户
- `vip`: VIP用户
- `member`: 普通用户
- `specified`: 指定用户

### 通知状态枚举

- `draft`: 草稿
- `pending`: 待发送
- `sending`: 发送中
- `sent`: 已发送
- `failed`: 发送失败

### 平台枚举

- `all`: 所有平台
- `android`: Android
- `ios`: iOS
