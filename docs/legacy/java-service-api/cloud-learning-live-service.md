# cloud-learning-live-service 直播服务

## 概述

直播服务主要负责管理平台上的直播课程功能，包括直播创建、直播管理、直播观看和直播互动等功能。

## 直播管理接口

### 1. 创建直播

- **接口路径**: `POST /auth-api/live`
- **接口描述**: 创建一场新直播
- **权限要求**: 需要登录认证，需要教师或管理员权限
- **请求参数**:
```json
{
  "title": "直播标题",         // 必填，直播标题
  "description": "直播描述",   // 可选，直播描述
  "cover": "封面图片URL",     // 必填，直播封面图片URL
  "startTime": "2023-05-01 19:00:00", // 必填，直播开始时间
  "endTime": "2023-05-01 21:00:00",   // 必填，直播结束时间
  "categoryId": 1,            // 必填，直播分类ID
  "tags": ["标签1", "标签2"], // 可选，直播标签列表
  "isFree": false,            // 必填，是否免费
  "price": 99.00,             // 必填，直播价格，免费时为0
  "maxAudience": 1000,        // 可选，最大观看人数，默认为0表示无限制
  "allowReplay": true,        // 可选，是否允许回放，默认为true
  "replayPrice": 49.00,       // 可选，回放价格，免费时为0
  "allowChat": true,          // 可选，是否允许聊天，默认为true
  "allowQuestion": true,       // 可选，是否允许提问，默认为true
  "needPassword": false,       // 可选，是否需要密码，默认为false
  "password": "123456",        // 可选，直播密码
  "isPublic": true            // 可选，是否公开，默认为true
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 直播ID
  "title": "直播标题",         // 直播标题
  "description": "直播描述",   // 直播描述
  "cover": "封面图片URL",     // 直播封面图片URL
  "startTime": "2023-05-01 19:00:00", // 直播开始时间
  "endTime": "2023-05-01 21:00:00",   // 直播结束时间
  "categoryId": 1,            // 直播分类ID
  "category": {               // 直播分类信息
    "id": 1,
    "name": "分类名称"
  },
  "tags": ["标签1", "标签2"], // 直播标签列表
  "isFree": false,            // 是否免费
  "price": 99.00,             // 直播价格
  "maxAudience": 1000,        // 最大观看人数
  "allowReplay": true,        // 是否允许回放
  "replayPrice": 49.00,       // 回放价格
  "allowChat": true,          // 是否允许聊天
  "allowQuestion": true,       // 是否允许提问
  "needPassword": false,       // 是否需要密码
  "password": "123456",        // 直播密码
  "isPublic": true,           // 是否公开
  "status": "not_started",    // 直播状态：not_started(未开始), living(直播中), ended(已结束), cancelled(已取消)
  "audienceNum": 0,           // 当前观看人数
  "totalAudienceNum": 0,      // 总观看人数
  "likeNum": 0,               // 点赞数量
  "giftNum": 0,               // 礼物数量
  "memberId": 1001,           // 创建者ID
  "member": {                 // 创建者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "pushUrl": "rtmp://push.example.com/live/123456", // 推流地址
  "playUrl": "http://play.example.com/live/123456.m3u8", // 播放地址
  "replayUrl": null,          // 回放地址，直播结束后生成
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 修改直播

- **接口路径**: `PUT /auth-api/live`
- **接口描述**: 修改已有直播
- **权限要求**: 需要登录认证，需要是直播创建者或管理员
- **请求参数**:
```json
{
  "id": 1,                    // 必填，直播ID
  "title": "修改后的直播标题", // 可选，直播标题
  "description": "修改后的直播描述", // 可选，直播描述
  "cover": "修改后的封面图片URL", // 可选，直播封面图片URL
  "startTime": "2023-05-01 19:00:00", // 可选，直播开始时间
  "endTime": "2023-05-01 21:30:00",   // 可选，直播结束时间
  "categoryId": 2,            // 可选，直播分类ID
  "tags": ["新标签1", "新标签2"], // 可选，直播标签列表
  "isFree": true,             // 可选，是否免费
  "price": 0,                 // 可选，直播价格
  "maxAudience": 1500,        // 可选，最大观看人数
  "allowReplay": false,       // 可选，是否允许回放
  "replayPrice": 0,           // 可选，回放价格
  "allowChat": false,         // 可选，是否允许聊天
  "allowQuestion": false,      // 可选，是否允许提问
  "needPassword": true,        // 可选，是否需要密码
  "password": "654321",        // 可选，直播密码
  "isPublic": false           // 可选，是否公开
}
```
- **响应参数**: 同创建直播接口

### 3. 删除直播

- **接口路径**: `DELETE /auth-api/live`
- **接口描述**: 删除一场直播
- **权限要求**: 需要登录认证，需要是直播创建者或管理员
- **请求参数**:
```json
{
  "id": 1                     // 必填，要删除的直播ID
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 4. 获取直播详情

- **接口路径**: `GET /public-api/live`
- **接口描述**: 获取直播详情
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，直播ID
}
```
- **响应参数**: 同创建直播接口

### 5. 获取直播列表

- **接口路径**: `GET /public-api/live/list`
- **接口描述**: 获取直播列表
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "categoryId": 1,            // 可选，分类ID
  "tag": "标签",              // 可选，标签
  "memberId": 1001,           // 可选，创建者ID
  "status": "living",         // 可选，直播状态
  "isFree": false,            // 可选，是否免费
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "startTime", // 可选，排序字段，可选值：startTime(开始时间), audienceNum(观看人数), likeNum(点赞数)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 直播列表
    {
      // 同创建直播接口的响应参数
    }
  ]
}
```

### 6. 获取用户直播列表

- **接口路径**: `GET /auth-api/member/live/list`
- **接口描述**: 获取当前登录用户创建的直播列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "status": "living",         // 可选，直播状态
  "isFree": false,            // 可选，是否免费
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "startTime", // 可选，排序字段
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 20,                // 总记录数
  "list": [                   // 直播列表
    {
      // 同创建直播接口的响应参数
    }
  ]
}
```

### 7. 开始直播

- **接口路径**: `POST /auth-api/live/start`
- **接口描述**: 开始一场直播
- **权限要求**: 需要登录认证，需要是直播创建者
- **请求参数**:
```json
{
  "id": 1                     // 必填，直播ID
}
```
- **响应参数**:
```json
{
  "success": true,            // 开始是否成功
  "pushUrl": "rtmp://push.example.com/live/123456", // 推流地址
  "playUrl": "http://play.example.com/live/123456.m3u8" // 播放地址
}
```

### 8. 结束直播

- **接口路径**: `POST /auth-api/live/end`
- **接口描述**: 结束一场直播
- **权限要求**: 需要登录认证，需要是直播创建者
- **请求参数**:
```json
{
  "id": 1                     // 必填，直播ID
}
```
- **响应参数**:
```json
{
  "success": true,            // 结束是否成功
  "replayUrl": "http://replay.example.com/live/123456.mp4" // 回放地址
}
```

### 9. 取消直播

- **接口路径**: `POST /auth-api/live/cancel`
- **接口描述**: 取消一场未开始的直播
- **权限要求**: 需要登录认证，需要是直播创建者
- **请求参数**:
```json
{
  "id": 1                     // 必填，直播ID
}
```
- **响应参数**:
```json
{
  "success": true             // 取消是否成功
}
```

## 直播观看接口

### 1. 获取直播观看地址

- **接口路径**: `GET /auth-api/live/play-url`
- **接口描述**: 获取直播观看地址
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1,                    // 必填，直播ID
  "password": "123456"        // 可选，直播密码，需要密码时必填
}
```
- **响应参数**:
```json
{
  "playUrl": "http://play.example.com/live/123456.m3u8", // 播放地址
  "isPaid": true,             // 是否已付费
  "isPassword": false         // 是否需要密码
}
```

### 2. 获取直播回放地址

- **接口路径**: `GET /auth-api/live/replay-url`
- **接口描述**: 获取直播回放地址
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，直播ID
}
```
- **响应参数**:
```json
{
  "replayUrl": "http://replay.example.com/live/123456.mp4", // 回放地址
  "isPaid": true             // 是否已付费
}
```

### 3. 记录观看行为

- **接口路径**: `POST /auth-api/live/watch`
- **接口描述**: 记录用户观看直播的行为
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "liveId": 1,               // 必填，直播ID
  "duration": 1800,           // 必填，观看时长（秒）
  "isReplay": false          // 可选，是否是回放，默认为false
}
```
- **响应参数**:
```json
{
  "success": true,            // 记录是否成功
  "totalDuration": 1800       // 总观看时长（秒）
}
```

### 4. 获取观看记录

- **接口路径**: `GET /auth-api/live/watch/list`
- **接口描述**: 获取用户观看直播的记录列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "memberId": 1001,           // 可选，创建者ID
  "isReplay": false,          // 可选，是否是回放
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "watchTime", // 可选，排序字段，可选值：watchTime(观看时间), duration(观看时长)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 观看记录列表
    {
      "id": 1,                // 记录ID
      "liveId": 1,            // 直播ID
      "liveTitle": "直播标题", // 直播标题
      "liveCover": "封面图片URL", // 直播封面
      "memberId": 1001,       // 创建者ID
      "memberNickname": "创建者昵称", // 创建者昵称
      "isReplay": false,      // 是否是回放
      "duration": 1800,        // 观看时长（秒）
      "watchTime": "2023-05-01 19:30:00", // 观看时间
      "createTime": "2023-05-01 19:30:00"  // 记录时间
    }
  ]
}
```

## 直播互动接口

### 1. 发送聊天消息

- **接口路径**: `POST /auth-api/live/chat`
- **接口描述**: 发送直播聊天消息
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "liveId": 1,               // 必填，直播ID
  "content": "聊天内容"       // 必填，聊天内容
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 消息ID
  "liveId": 1,               // 直播ID
  "content": "聊天内容",       // 聊天内容
  "memberId": 1001,           // 发送者ID
  "member": {                 // 发送者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "isTeacher": false,         // 是否是老师
  "createTime": "2023-05-01 19:30:00"  // 发送时间
}
```

### 2. 获取聊天消息列表

- **接口路径**: `GET /public-api/live/chat/list`
- **接口描述**: 获取直播聊天消息列表
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "liveId": 1,               // 必填，直播ID
  "lastId": 0,               // 可选，最后一条消息ID，用于获取新消息
  "pageSize": 20             // 可选，返回数量，默认为20
}
```
- **响应参数**:
```json
{
  "list": [                   // 消息列表
    {
      // 同发送聊天消息接口的响应参数
    }
  ]
}
```

### 3. 发送提问

- **接口路径**: `POST /auth-api/live/question`
- **接口描述**: 发送直播提问
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "liveId": 1,               // 必填，直播ID
  "content": "提问内容"       // 必填，提问内容
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 提问ID
  "liveId": 1,               // 直播ID
  "content": "提问内容",       // 提问内容
  "memberId": 1001,           // 提问者ID
  "member": {                 // 提问者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "status": "pending",        // 提问状态：pending(待回答), answered(已回答), ignored(已忽略)
  "answer": null,             // 回答内容
  "answerTime": null,         // 回答时间
  "createTime": "2023-05-01 19:30:00"  // 提问时间
}
```

### 4. 回答提问

- **接口路径**: `PUT /auth-api/live/question/answer`
- **接口描述**: 回答直播提问
- **权限要求**: 需要登录认证，需要是直播创建者
- **请求参数**:
```json
{
  "id": 1,                    // 必填，提问ID
  "answer": "回答内容"         // 必填，回答内容
}
```
- **响应参数**:
```json
{
  "success": true,            // 回答是否成功
  "answerTime": "2023-05-01 19:35:00" // 回答时间
}
```

### 5. 忽略提问

- **接口路径**: `PUT /auth-api/live/question/ignore`
- **接口描述**: 忽略直播提问
- **权限要求**: 需要登录认证，需要是直播创建者
- **请求参数**:
```json
{
  "id": 1                     // 必填，提问ID
}
```
- **响应参数**:
```json
{
  "success": true             // 忽略是否成功
}
```

### 6. 获取提问列表

- **接口路径**: `GET /auth-api/live/question/list`
- **接口描述**: 获取直播提问列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "liveId": 1,               // 必填，直播ID
  "status": "pending",        // 可选，提问状态
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10             // 可选，每页大小，默认为10
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 20,                // 总记录数
  "list": [                   // 提问列表
    {
      // 同发送提问接口的响应参数
    }
  ]
}
```

## 直播礼物接口

### 1. 赠送礼物

- **接口路径**: `POST /auth-api/live/gift`
- **接口描述**: 赠送直播礼物
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "liveId": 1,               // 必填，直播ID
  "giftId": 1,               // 必填，礼物ID
  "num": 1                   // 必填，礼物数量
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 礼物记录ID
  "liveId": 1,               // 直播ID
  "giftId": 1,               // 礼物ID
  "gift": {                  // 礼物信息
    "id": 1,
    "name": "礼物名称",
    "image": "礼物图片URL",
    "price": 10.00           // 礼物价格
  },
  "num": 1,                  // 礼物数量
  "totalPrice": 10.00,       // 总价格
  "memberId": 1001,           // 赠送者ID
  "member": {                 // 赠送者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "createTime": "2023-05-01 19:30:00"  // 赠送时间
}
```

### 2. 获取礼物列表

- **接口路径**: `GET /public-api/live/gift/list`
- **接口描述**: 获取直播礼物列表
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "liveId": 1,               // 必填，直播ID
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10             // 可选，每页大小，默认为10
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 30,                // 总记录数
  "list": [                   // 礼物记录列表
    {
      // 同赠送礼物接口的响应参数
    }
  ]
}
```

### 3. 获取礼物统计

- **接口路径**: `GET /auth-api/live/gift/statistics`
- **接口描述**: 获取直播礼物统计
- **权限要求**: 需要登录认证，需要是直播创建者
- **请求参数**:
```json
{
  "liveId": 1                 // 必填，直播ID
}
```
- **响应参数**:
```json
{
  "totalNum": 100,            // 礼物总数量
  "totalPrice": 1000.00,      // 礼物总价格
  "giftList": [               // 礼物统计列表
    {
      "giftId": 1,            // 礼物ID
      "giftName": "礼物名称",   // 礼物名称
      "giftImage": "礼物图片URL", // 礼物图片
      "num": 50,             // 礼物数量
      "price": 10.00,        // 礼物单价
      "totalPrice": 500.00    // 礼物总价
    }
  ]
}
```

## 数据模型

### 直播状态枚举

- `not_started`: 未开始
- `living`: 直播中
- `ended`: 已结束
- `cancelled`: 已取消

### 提问状态枚举

- `pending`: 待回答
- `answered`: 已回答
- `ignored`: 已忽略
