# cloud-learning-message-service 消息服务

## 概述

消息服务主要负责管理平台上的各种消息通知，包括系统通知、私信、评论通知和点赞通知等功能。

## 系统通知接口

### 1. 发送系统通知

- **接口路径**: `POST /admin-api/notification`
- **接口描述**: 发送系统通知
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "title": "通知标题",         // 必填，通知标题
  "content": "通知内容",       // 必填，通知内容
  "type": "system",           // 必填，通知类型：system(系统通知), activity(活动通知), maintenance(维护通知)
  "level": "normal",          // 必填，通知级别：normal(普通), important(重要), urgent(紧急)
  "targetType": "all",        // 必填，目标类型：all(所有用户), vip(VIP用户), member(普通用户), specified(指定用户)
  "memberIdList": [1001, 1002], // 可选，指定用户ID列表，targetType为specified时必填
  "isPush": true,            // 可选，是否推送，默认为true
  "isEmail": false,          // 可选，是否发送邮件，默认为false
  "isSms": false,           // 可选，是否发送短信，默认为false
  "pushTime": "2023-05-01 12:00:00" // 可选，推送时间，默认为当前时间
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 通知ID
  "title": "通知标题",         // 通知标题
  "content": "通知内容",       // 通知内容
  "type": "system",           // 通知类型
  "level": "normal",          // 通知级别
  "targetType": "all",        // 目标类型
  "memberIdList": [1001, 1002], // 指定用户ID列表
  "isPush": true,            // 是否推送
  "isEmail": false,          // 是否发送邮件
  "isSms": false,           // 是否发送短信
  "pushTime": "2023-05-01 12:00:00", // 推送时间
  "sendTime": "2023-05-01 12:00:00",  // 发送时间
  "sendNum": 1000,           // 发送数量
  "readNum": 500,            // 已读数量
  "status": "sent",          // 通知状态：draft(草稿), pending(待发送), sending(发送中), sent(已发送), failed(发送失败)
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

### 2. 获取系统通知列表

- **接口路径**: `GET /admin-api/notification/list`
- **接口描述**: 获取系统通知列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "type": "system",           // 可选，通知类型
  "level": "normal",          // 可选，通知级别
  "status": "sent",          // 可选，通知状态
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
  "list": [                   // 通知列表
    {
      // 同发送系统通知接口的响应参数
    }
  ]
}
```

### 3. 获取用户通知列表

- **接口路径**: `GET /auth-api/notification/list`
- **接口描述**: 获取当前登录用户的通知列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "type": "system",           // 可选，通知类型
  "level": "normal",          // 可选，通知级别
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
  "list": [                   // 通知列表
    {
      "id": 1,                // 通知记录ID
      "notificationId": 1,     // 通知ID
      "title": "通知标题",     // 通知标题
      "content": "通知内容",   // 通知内容
      "type": "system",       // 通知类型
      "level": "normal",      // 通知级别
      "isRead": false,       // 是否已读
      "readTime": null,       // 已读时间
      "createTime": "2023-05-01 12:00:00"  // 创建时间
    }
  ]
}
```

### 4. 标记通知为已读

- **接口路径**: `PUT /auth-api/notification/read`
- **接口描述**: 标记通知为已读
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，通知记录ID
}
```
- **响应参数**:
```json
{
  "success": true,            // 标记是否成功
  "readTime": "2023-05-01 12:30:00" // 已读时间
}
```

### 5. 批量标记通知为已读

- **接口路径**: `PUT /auth-api/notification/read/batch`
- **接口描述**: 批量标记通知为已读
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "idList": [1, 2, 3]       // 必填，通知记录ID列表
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

### 6. 获取未读通知数量

- **接口路径**: `GET /auth-api/notification/unread-count`
- **接口描述**: 获取当前登录用户的未读通知数量
- **权限要求**: 需要登录认证
- **请求参数**: 无
- **响应参数**:
```json
{
  "count": 5                 // 未读通知数量
}
```

## 私信接口

### 1. 发送私信

- **接口路径**: `POST /auth-api/message`
- **接口描述**: 发送一条私信
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "receiverId": 1002,         // 必填，接收者ID
  "content": "私信内容",       // 必填，私信内容
  "images": ["图片URL1", "图片URL2"] // 可选，私信图片列表
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 私信ID
  "senderId": 1001,           // 发送者ID
  "receiverId": 1002,         // 接收者ID
  "content": "私信内容",       // 私信内容
  "images": ["图片URL1", "图片URL2"], // 私信图片列表
  "isRead": false,           // 是否已读
  "readTime": null,          // 已读时间
  "sender": {                // 发送者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "receiver": {              // 接收者信息
    "id": 1002,
    "nickname": "接收者昵称",
    "avatar": "头像URL"
  },
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 获取私信列表

- **接口路径**: `GET /auth-api/message/list`
- **接口描述**: 获取当前登录用户的私信列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "memberId": 1002,           // 可选，对方用户ID
  "isRead": false,           // 可选，是否已读
  "type": "sent",            // 可选，消息类型：sent(已发送), received(已接收)
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
  "total": 50,                // 总记录数
  "list": [                   // 私信列表
    {
      // 同发送私信接口的响应参数
    }
  ]
}
```

### 3. 获取私信对话

- **接口路径**: `GET /auth-api/message/conversation`
- **接口描述**: 获取与指定用户的私信对话
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "memberId": 1002,           // 必填，对方用户ID
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
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
  "list": [                   // 私信列表
    {
      // 同发送私信接口的响应参数
    }
  ]
}
```

### 4. 标记私信为已读

- **接口路径**: `PUT /auth-api/message/read`
- **接口描述**: 标记私信为已读
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，私信ID
}
```
- **响应参数**:
```json
{
  "success": true,            // 标记是否成功
  "readTime": "2023-05-01 12:30:00" // 已读时间
}
```

### 5. 批量标记私信为已读

- **接口路径**: `PUT /auth-api/message/read/batch`
- **接口描述**: 批量标记私信为已读
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "idList": [1, 2, 3]       // 必填，私信ID列表
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

### 6. 删除私信

- **接口路径**: `DELETE /auth-api/message`
- **接口描述**: 删除一条私信
- **权限要求**: 需要登录认证，需要是私信发送者或接收者
- **请求参数**:
```json
{
  "id": 1                     // 必填，要删除的私信ID
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 7. 获取未读私信数量

- **接口路径**: `GET /auth-api/message/unread-count`
- **接口描述**: 获取当前登录用户的未读私信数量
- **权限要求**: 需要登录认证
- **请求参数**: 无
- **响应参数**:
```json
{
  "count": 3                 // 未读私信数量
}
```

## 评论通知接口

### 1. 发送评论通知

- **接口路径**: `POST /internal-api/comment-notification`
- **接口描述**: 发送评论通知（内部接口）
- **权限要求**: 内部接口
- **请求参数**:
```json
{
  "memberId": 1001,           // 必填，被评论者ID
  "commentId": 1,            // 必填，评论ID
  "commentContent": "评论内容", // 必填，评论内容
  "commenterId": 1002,       // 必填，评论者ID
  "commenterNickname": "评论者昵称", // 必填，评论者昵称
  "topicId": 1,              // 必填，主题ID
  "topicType": "article",     // 必填，主题类型
  "topicTitle": "主题标题"     // 必填，主题标题
}
```
- **响应参数**:
```json
{
  "success": true            // 发送是否成功
}
```

### 2. 获取评论通知列表

- **接口路径**: `GET /auth-api/comment-notification/list`
- **接口描述**: 获取当前登录用户的评论通知列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
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
  "list": [                   // 评论通知列表
    {
      "id": 1,                // 通知记录ID
      "commentId": 1,         // 评论ID
      "commentContent": "评论内容", // 评论内容
      "commenterId": 1002,    // 评论者ID
      "commenter": {          // 评论者信息
        "id": 1002,
        "nickname": "评论者昵称",
        "avatar": "头像URL"
      },
      "topicId": 1,           // 主题ID
      "topicType": "article",   // 主题类型
      "topicTitle": "主题标题", // 主题标题
      "isRead": false,        // 是否已读
      "readTime": null,        // 已读时间
      "createTime": "2023-05-01 12:00:00"  // 创建时间
    }
  ]
}
```

### 3. 标记评论通知为已读

- **接口路径**: `PUT /auth-api/comment-notification/read`
- **接口描述**: 标记评论通知为已读
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，通知记录ID
}
```
- **响应参数**:
```json
{
  "success": true,            // 标记是否成功
  "readTime": "2023-05-01 12:30:00" // 已读时间
}
```

### 4. 批量标记评论通知为已读

- **接口路径**: `PUT /auth-api/comment-notification/read/batch`
- **接口描述**: 批量标记评论通知为已读
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "idList": [1, 2, 3]       // 必填，通知记录ID列表
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

### 5. 获取未读评论通知数量

- **接口路径**: `GET /auth-api/comment-notification/unread-count`
- **接口描述**: 获取当前登录用户的未读评论通知数量
- **权限要求**: 需要登录认证
- **请求参数**: 无
- **响应参数**:
```json
{
  "count": 5                 // 未读评论通知数量
}
```

## 点赞通知接口

### 1. 发送点赞通知

- **接口路径**: `POST /internal-api/like-notification`
- **接口描述**: 发送点赞通知（内部接口）
- **权限要求**: 内部接口
- **请求参数**:
```json
{
  "memberId": 1001,           // 必填，被点赞者ID
  "likerId": 1002,           // 必填，点赞者ID
  "likerNickname": "点赞者昵称", // 必填，点赞者昵称
  "topicId": 1,              // 必填，主题ID
  "topicType": "article",     // 必填，主题类型
  "topicTitle": "主题标题"     // 必填，主题标题
}
```
- **响应参数**:
```json
{
  "success": true            // 发送是否成功
}
```

### 2. 获取点赞通知列表

- **接口路径**: `GET /auth-api/like-notification/list`
- **接口描述**: 获取当前登录用户的点赞通知列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
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
  "list": [                   // 点赞通知列表
    {
      "id": 1,                // 通知记录ID
      "likerId": 1002,         // 点赞者ID
      "liker": {              // 点赞者信息
        "id": 1002,
        "nickname": "点赞者昵称",
        "avatar": "头像URL"
      },
      "topicId": 1,           // 主题ID
      "topicType": "article",   // 主题类型
      "topicTitle": "主题标题", // 主题标题
      "isRead": false,        // 是否已读
      "readTime": null,        // 已读时间
      "createTime": "2023-05-01 12:00:00"  // 创建时间
    }
  ]
}
```

### 3. 标记点赞通知为已读

- **接口路径**: `PUT /auth-api/like-notification/read`
- **接口描述**: 标记点赞通知为已读
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，通知记录ID
}
```
- **响应参数**:
```json
{
  "success": true,            // 标记是否成功
  "readTime": "2023-05-01 12:30:00" // 已读时间
}
```

### 4. 批量标记点赞通知为已读

- **接口路径**: `PUT /auth-api/like-notification/read/batch`
- **接口描述**: 批量标记点赞通知为已读
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "idList": [1, 2, 3]       // 必填，通知记录ID列表
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

### 5. 获取未读点赞通知数量

- **接口路径**: `GET /auth-api/like-notification/unread-count`
- **接口描述**: 获取当前登录用户的未读点赞通知数量
- **权限要求**: 需要登录认证
- **请求参数**: 无
- **响应参数**:
```json
{
  "count": 8                 // 未读点赞通知数量
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

### 通知状态枚举

- `draft`: 草稿
- `pending`: 待发送
- `sending`: 发送中
- `sent`: 已发送
- `failed`: 发送失败

### 目标类型枚举

- `all`: 所有用户
- `vip`: VIP用户
- `member`: 普通用户
- `specified`: 指定用户

### 私信类型枚举

- `sent`: 已发送
- `received`: 已接收

### 主题类型枚举

- `article`: 文章
- `question`: 问题
- `answer`: 回答
- `comment`: 评论
- `live`: 直播
- `course`: 课程
- `circle`: 圈子
