# cloud-learning-behavior-service 行为服务

## 概述

行为服务主要负责跟踪和管理用户的各种行为数据，包括点赞、收藏、浏览和评论等功能，为平台提供用户行为分析和个性化推荐的基础数据。

## 点赞管理接口

### 1. 点赞

- **接口路径**: `POST /auth-api/like`
- **接口描述**: 对指定主题进行点赞
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "topicId": 1,              // 必填，主题ID
  "topicType": "lesson",       // 必填，主题类型
  "status": true,             // 必填，点赞状态，true为点赞，false为取消点赞
  "topicMemberId": 1001       // 可选，主题所属会员ID，没有则为0
}
```
- **响应参数**:
```json
{
  "id": 1,                  // 点赞记录ID
  "topicId": 1,              // 主题ID
  "topicType": "lesson",       // 主题类型
  "status": true,             // 点赞状态
  "memberId": 1001,           // 用户ID
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 点赞/取消赞

- **接口路径**: `PUT /auth-api/like`
- **接口描述**: 对指定主题进行点赞或取消点赞
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1,                  // 必填，点赞记录ID
  "topicId": 1,              // 必填，主题ID
  "topicType": "lesson",       // 必填，主题类型
  "status": true,             // 必填，点赞状态，true为点赞，false为取消点赞
  "memberId": 1001,           // 必填，用户ID
  "topicMemberId": 1001       // 可选，主题所属会员ID，没有则为0
}
```
- **响应参数**: 同点赞接口

### 3. 获取用户点赞记录

- **接口路径**: `GET /auth-api/like/list`
- **接口描述**: 获取当前登录用户的点赞记录列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "topicId": 1,              // 可选，主题ID
  "topicType": "lesson"        // 可选，主题类型
}
```
- **响应参数**:
```json
[
  {
    // 同点赞接口的响应参数
  }
]
```

### 4. 获取点赞统计列表

- **接口路径**: `GET /public-api/like/count`
- **接口描述**: 获取指定主题的点赞统计信息
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "topicIdList": [1, 2, 3],   // 必填，主题ID列表
  "topicType": "lesson"        // 必填，主题类型
}
```
- **响应参数**:
```json
[
  {
    "topicId": 1,              // 主题ID
    "topicType": "lesson",       // 主题类型
    "likeNum": 10              // 点赞数量
  }
]
```

### 5. 获取用户点赞状态

- **接口路径**: `GET /public-api/like/status`
- **接口描述**: 获取当前用户对指定主题的点赞状态
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "topicIdList": [1, 2, 3],   // 必填，主题ID列表
  "topicType": "lesson"        // 必填，主题类型
}
```
- **响应参数**:
```json
[
  {
    "topicId": 1,              // 主题ID
    "topicType": "lesson",       // 主题类型
    "isLike": true             // 是否已点赞
  }
]
```

## 收藏管理接口

### 1. 收藏

- **接口路径**: `POST /auth-api/favorite`
- **接口描述**: 收藏指定主题
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "topicId": 1,              // 必填，主题ID
  "topicType": "lesson",       // 必填，主题类型
  "topicMemberId": 1001       // 可选，主题所属会员ID，没有则为0
}
```
- **响应参数**:
```json
{
  "id": 1,                  // 收藏记录ID
  "topicId": 1,              // 主题ID
  "topicType": "lesson",       // 主题类型
  "memberId": 1001,           // 用户ID
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 取消收藏

- **接口路径**: `DELETE /auth-api/favorite`
- **接口描述**: 取消收藏指定主题
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "topicId": 1,              // 必填，主题ID
  "topicType": "lesson"        // 必填，主题类型
}
```
- **响应参数**:
```json
{
  "success": true             // 取消收藏是否成功
}
```

### 3. 获取用户收藏记录

- **接口路径**: `GET /auth-api/favorite/list`
- **接口描述**: 获取当前登录用户的收藏记录列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "topicType": "lesson"        // 可选，主题类型
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 收藏记录列表
    {
      // 同收藏接口的响应参数
    }
  ]
}
```

### 4. 获取收藏统计列表

- **接口路径**: `GET /public-api/favorite/count`
- **接口描述**: 获取指定主题的收藏统计信息
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "topicIdList": [1, 2, 3],   // 必填，主题ID列表
  "topicType": "lesson"        // 必填，主题类型
}
```
- **响应参数**:
```json
[
  {
    "topicId": 1,              // 主题ID
    "topicType": "lesson",       // 主题类型
    "favoriteNum": 5           // 收藏数量
  }
]
```

### 5. 获取用户收藏状态

- **接口路径**: `GET /public-api/favorite/status`
- **接口描述**: 获取当前用户对指定主题的收藏状态
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "topicIdList": [1, 2, 3],   // 必填，主题ID列表
  "topicType": "lesson"        // 必填，主题类型
}
```
- **响应参数**:
```json
[
  {
    "topicId": 1,              // 主题ID
    "topicType": "lesson",       // 主题类型
    "isFavorite": true         // 是否已收藏
  }
]
```

## 浏览管理接口

### 1. 记录浏览

- **接口路径**: `POST /public-api/watch`
- **接口描述**: 记录用户浏览指定主题的行为
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "topicId": 1,              // 必填，主题ID
  "topicType": "lesson",       // 必填，主题类型
  "memberId": 1001,           // 可选，用户ID，未登录则为0
  "topicMemberId": 1001,      // 可选，主题所属会员ID，没有则为0
  "duration": 120             // 可选，浏览时长（秒）
}
```
- **响应参数**:
```json
{
  "id": 1,                  // 浏览记录ID
  "topicId": 1,              // 主题ID
  "topicType": "lesson",       // 主题类型
  "memberId": 1001,           // 用户ID
  "duration": 120,           // 浏览时长（秒）
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 获取浏览统计列表

- **接口路径**: `GET /public-api/watch/count`
- **接口描述**: 获取指定主题的浏览统计信息
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "topicIdList": [1, 2, 3],   // 必填，主题ID列表
  "topicType": "lesson"        // 必填，主题类型
}
```
- **响应参数**:
```json
[
  {
    "topicId": 1,              // 主题ID
    "topicType": "lesson",       // 主题类型
    "watchNum": 100            // 浏览数量
  }
]
```

### 3. 获取用户浏览记录

- **接口路径**: `GET /auth-api/watch/list`
- **接口描述**: 获取当前登录用户的浏览记录列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "topicType": "lesson"        // 可选，主题类型
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 100,               // 总记录数
  "list": [                   // 浏览记录列表
    {
      // 同记录浏览接口的响应参数
    }
  ]
}
```

## 评论管理接口

### 1. 发表评论

- **接口路径**: `POST /auth-api/comment`
- **接口描述**: 对指定主题发表评论
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "content": "评论内容",       // 必填，评论内容
  "topicId": 1,              // 必填，主题ID
  "topicType": "lesson",       // 必填，主题类型
  "parentId": 0,             // 可选，父评论ID，0表示顶级评论
  "topicMemberId": 1001       // 可选，主题所属会员ID，没有则为0
}
```
- **响应参数**:
```json
{
  "id": 1,                  // 评论ID
  "content": "评论内容",       // 评论内容
  "topicId": 1,              // 主题ID
  "topicType": "lesson",       // 主题类型
  "parentId": 0,             // 父评论ID
  "memberId": 1001,           // 评论者ID
  "likeNum": 5,              // 点赞数量
  "replyNum": 2,             // 回复数量
  "member": {                // 评论者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "like": {                  // 当前用户点赞状态
    "isLike": true
  },
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 修改评论

- **接口路径**: `PUT /auth-api/comment`
- **接口描述**: 修改已有评论
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1,                  // 必填，评论ID
  "content": "修改后的评论内容" // 必填，修改后的评论内容
}
```
- **响应参数**: 同发表评论接口

### 3. 删除评论

- **接口路径**: `DELETE /auth-api/comment`
- **接口描述**: 删除一条评论
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                   // 必填，要删除的评论ID
}
```
- **响应参数**:
```json
{
  "success": true           // 删除是否成功
}
```

### 4. 获取评论列表

- **接口路径**: `GET /public-api/comment/list`
- **接口描述**: 获取指定主题的评论列表
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "topicId": 1,              // 必填，主题ID
  "topicType": "lesson",       // 必填，主题类型
  "parentId": 0,             // 可选，父评论ID，0表示获取顶级评论
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), likeNum(点赞数)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 评论列表
    {
      // 同发表评论接口的响应参数
    }
  ]
}
```

### 5. 获取评论详情

- **接口路径**: `GET /public-api/comment`
- **接口描述**: 获取评论详情
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "id": 1                   // 必填，评论ID
}
```
- **响应参数**: 同发表评论接口

### 6. 获取评论回复列表

- **接口路径**: `GET /public-api/comment/reply/list`
- **接口描述**: 获取评论的回复列表
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "parentId": 1              // 必填，父评论ID
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 20,                // 总记录数
  "list": [                   // 回复列表
    {
      // 同发表评论接口的响应参数
    }
  ]
}
```

### 7. 获取用户评论列表

- **接口路径**: `GET /auth-api/member/comment/list`
- **接口描述**: 获取当前登录用户的评论列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "topicType": "lesson"        // 可选，主题类型
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 30,                // 总记录数
  "list": [                   // 评论列表
    {
      // 同发表评论接口的响应参数
    }
  ]
}
```

### 8. 获取用户评论数量

- **接口路径**: `GET /public-api/comment/member/count`
- **接口描述**: 获取指定会员的评论数量
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "memberId": 1001            // 可选，会员ID，不填则获取当前登录用户的评论数量
}
```
- **响应参数**:
```json
{
  "count": 25                 // 评论数量
}
```

## 数据模型

### 主题类型枚举

- `question`: 问题
- `answer`: 回答
- `article`: 文章
- `lesson`: 课程
- `live`: 直播
- `exam`: 考试
- `circle`: 圈子
- `comment`: 评论

### 排序字段枚举

- `createTime`: 创建时间
- `likeNum`: 点赞数量
- `favoriteNum`: 收藏数量
- `watchNum`: 浏览数量
