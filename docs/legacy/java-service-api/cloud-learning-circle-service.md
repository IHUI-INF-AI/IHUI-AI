# cloud-learning-circle-service 圈子服务

## 概述

圈子服务主要负责管理学习圈子相关的功能，包括圈子创建、加入、帖子发布和互动等功能，为用户提供一个交流学习的社区环境。

## 圈子管理接口

### 1. 创建圈子

- **接口路径**: `POST /auth-api/circle`
- **接口描述**: 创建一个新的学习圈子
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "name": "圈子名称",         // 必填，圈子名称
  "description": "圈子描述",   // 必填，圈子描述
  "cover": "封面图片URL",     // 必填，圈子封面图片URL
  "tags": ["标签1", "标签2"], // 可选，圈子标签列表
  "joinType": "apply",        // 必填，加入方式：free(自由加入), apply(申请加入), invite(邀请加入)
  "isPublic": true,           // 必填，是否公开
  "maxMembers": 500           // 可选，最大成员数量，0表示无限制
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 圈子ID
  "name": "圈子名称",         // 圈子名称
  "description": "圈子描述",   // 圈子描述
  "cover": "封面图片URL",     // 圈子封面图片URL
  "tags": ["标签1", "标签2"], // 圈子标签列表
  "joinType": "apply",        // 加入方式
  "isPublic": true,           // 是否公开
  "maxMembers": 500,          // 最大成员数量
  "memberNum": 1,             // 当前成员数量
  "postNum": 0,               // 帖子数量
  "creatorId": 1001,          // 创建者ID
  "creator": {                // 创建者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "member": {                 // 当前用户在圈子中的信息
    "isMember": true,         // 是否是成员
    "isCreator": true,        // 是否是创建者
    "isManager": true,        // 是否是管理员
    "joinTime": "2023-05-01 12:00:00"  // 加入时间
  },
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 修改圈子信息

- **接口路径**: `PUT /auth-api/circle`
- **接口描述**: 修改圈子信息
- **权限要求**: 需要登录认证，需要圈子管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，圈子ID
  "name": "修改后的圈子名称", // 可选，圈子名称
  "description": "修改后的圈子描述", // 可选，圈子描述
  "cover": "修改后的封面图片URL", // 可选，圈子封面图片URL
  "tags": ["新标签1", "新标签2"], // 可选，圈子标签列表
  "joinType": "free",         // 可选，加入方式
  "isPublic": false,          // 可选，是否公开
  "maxMembers": 1000          // 可选，最大成员数量
}
```
- **响应参数**: 同创建圈子接口

### 3. 删除圈子

- **接口路径**: `DELETE /auth-api/circle`
- **接口描述**: 删除一个圈子
- **权限要求**: 需要登录认证，需要圈子创建者权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，要删除的圈子ID
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 4. 获取圈子详情

- **接口路径**: `GET /public-api/circle`
- **接口描述**: 获取圈子详情
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，圈子ID
}
```
- **响应参数**: 同创建圈子接口

### 5. 获取圈子列表

- **接口路径**: `GET /public-api/circle/list`
- **接口描述**: 获取圈子列表
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "tag": "标签",              // 可选，标签
  "isPublic": true,           // 可选，是否公开
  "joinType": "free",         // 可选，加入方式
  "orderColumn": "memberNum", // 可选，排序字段，可选值：memberNum(成员数), postNum(帖子数), createTime(创建时间)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 圈子列表
    {
      // 同创建圈子接口的响应参数
    }
  ]
}
```

### 6. 获取用户加入的圈子列表

- **接口路径**: `GET /auth-api/member/circle/list`
- **接口描述**: 获取当前登录用户加入的圈子列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "isManager": false          // 可选，是否只返回管理的圈子
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 20,                // 总记录数
  "list": [                   // 圈子列表
    {
      // 同创建圈子接口的响应参数
    }
  ]
}
```

## 圈子成员管理接口

### 1. 申请加入圈子

- **接口路径**: `POST /auth-api/circle/join`
- **接口描述**: 申请加入一个圈子
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "circleId": 1,              // 必填，圈子ID
  "applyMessage": "申请加入理由" // 可选，申请加入理由
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 申请记录ID
  "circleId": 1,              // 圈子ID
  "memberId": 1001,           // 申请人ID
  "applyMessage": "申请加入理由", // 申请加入理由
  "status": "pending",        // 申请状态：pending(待审核), approved(已通过), rejected(已拒绝)
  "processTime": null,        // 处理时间
  "processMemberId": null,    // 处理人ID
  "createTime": "2023-05-01 12:00:00",  // 申请时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 退出圈子

- **接口路径**: `DELETE /auth-api/circle/quit`
- **接口描述**: 退出一个圈子
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "circleId": 1               // 必填，圈子ID
}
```
- **响应参数**:
```json
{
  "success": true             // 退出是否成功
}
```

### 3. 邀请加入圈子

- **接口路径**: `POST /auth-api/circle/invite`
- **接口描述**: 邀请用户加入圈子
- **权限要求**: 需要登录认证，需要圈子管理员权限
- **请求参数**:
```json
{
  "circleId": 1,              // 必填，圈子ID
  "memberId": 1002,           // 必填，被邀请人ID
  "inviteMessage": "邀请加入理由" // 可选，邀请加入理由
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 邀请记录ID
  "circleId": 1,              // 圈子ID
  "inviterId": 1001,          // 邀请人ID
  "memberId": 1002,           // 被邀请人ID
  "inviteMessage": "邀请加入理由", // 邀请加入理由
  "status": "pending",        // 邀请状态：pending(待处理), accepted(已接受), declined(已拒绝)
  "processTime": null,        // 处理时间
  "createTime": "2023-05-01 12:00:00",  // 邀请时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 4. 处理加入申请

- **接口路径**: `PUT /auth-api/circle/join/process`
- **接口描述**: 处理用户加入圈子的申请
- **权限要求**: 需要登录认证，需要圈子管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，申请记录ID
  "status": "approved",       // 必填，处理结果：approved(通过), rejected(拒绝)
  "processMessage": "处理意见" // 可选，处理意见
}
```
- **响应参数**:
```json
{
  "success": true             // 处理是否成功
}
```

### 5. 处理加入邀请

- **接口路径**: `PUT /auth-api/circle/invite/process`
- **接口描述**: 处理加入圈子的邀请
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1,                    // 必填，邀请记录ID
  "status": "accepted",       // 必填，处理结果：accepted(接受), declined(拒绝)
  "processMessage": "处理意见" // 可选，处理意见
}
```
- **响应参数**:
```json
{
  "success": true             // 处理是否成功
}
```

### 6. 获取圈子成员列表

- **接口路径**: `GET /public-api/circle/member/list`
- **接口描述**: 获取圈子成员列表
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "circleId": 1,              // 必填，圈子ID
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "isManager": false,         // 可选，是否只返回管理员
  "orderColumn": "joinTime",  // 可选，排序字段，可选值：joinTime(加入时间)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 100,               // 总记录数
  "list": [                   // 成员列表
    {
      "id": 1,                // 成员记录ID
      "circleId": 1,          // 圈子ID
      "memberId": 1001,       // 成员ID
      "isCreator": true,      // 是否是创建者
      "isManager": true,      // 是否是管理员
      "joinTime": "2023-05-01 12:00:00",  // 加入时间
      "member": {             // 成员信息
        "id": 1001,
        "nickname": "用户昵称",
        "avatar": "头像URL"
      }
    }
  ]
}
```

### 7. 设置成员为管理员

- **接口路径**: `PUT /auth-api/circle/member/manager`
- **接口描述**: 设置成员为管理员
- **权限要求**: 需要登录认证，需要圈子创建者权限
- **请求参数**:
```json
{
  "circleId": 1,              // 必填，圈子ID
  "memberId": 1002,           // 必填，成员ID
  "isManager": true           // 必填，是否设置为管理员
}
```
- **响应参数**:
```json
{
  "success": true             // 设置是否成功
}
```

### 8. 移除成员

- **接口路径**: `DELETE /auth-api/circle/member`
- **接口描述**: 移除圈子成员
- **权限要求**: 需要登录认证，需要圈子管理员权限
- **请求参数**:
```json
{
  "circleId": 1,              // 必填，圈子ID
  "memberId": 1002            // 必填，成员ID
}
```
- **响应参数**:
```json
{
  "success": true             // 移除是否成功
}
```

## 圈子帖子管理接口

### 1. 发布帖子

- **接口路径**: `POST /auth-api/circle/post`
- **接口描述**: 在圈子中发布一个帖子
- **权限要求**: 需要登录认证，需要是圈子成员
- **请求参数**:
```json
{
  "circleId": 1,              // 必填，圈子ID
  "title": "帖子标题",         // 必填，帖子标题
  "content": "帖子内容",       // 必填，帖子内容
  "images": ["图片URL1", "图片URL2"], // 可选，帖子图片列表
  "tags": ["标签1", "标签2"], // 可选，帖子标签列表
  "isTop": false,             // 可选，是否置顶，需要管理员权限
  "isPublic": true            // 可选，是否公开，非公开只有圈子成员可见
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 帖子ID
  "circleId": 1,              // 圈子ID
  "title": "帖子标题",         // 帖子标题
  "content": "帖子内容",       // 帖子内容
  "images": ["图片URL1", "图片URL2"], // 帖子图片列表
  "tags": ["标签1", "标签2"], // 帖子标签列表
  "isTop": false,             // 是否置顶
  "isPublic": true,           // 是否公开
  "viewNum": 0,               // 浏览数量
  "likeNum": 0,               // 点赞数量
  "commentNum": 0,            // 评论数量
  "memberId": 1001,           // 发布者ID
  "member": {                 // 发布者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "like": {                   // 当前用户点赞状态
    "isLike": false
  },
  "circle": {                 // 圈子信息
    "id": 1,
    "name": "圈子名称",
    "cover": "封面图片URL"
  },
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 修改帖子

- **接口路径**: `PUT /auth-api/circle/post`
- **接口描述**: 修改帖子
- **权限要求**: 需要登录认证，需要是帖子发布者或圈子管理员
- **请求参数**:
```json
{
  "id": 1,                    // 必填，帖子ID
  "title": "修改后的帖子标题", // 可选，帖子标题
  "content": "修改后的帖子内容", // 可选，帖子内容
  "images": ["新图片URL1", "新图片URL2"], // 可选，帖子图片列表
  "tags": ["新标签1", "新标签2"], // 可选，帖子标签列表
  "isTop": true,              // 可选，是否置顶，需要管理员权限
  "isPublic": false           // 可选，是否公开
}
```
- **响应参数**: 同发布帖子接口

### 3. 删除帖子

- **接口路径**: `DELETE /auth-api/circle/post`
- **接口描述**: 删除帖子
- **权限要求**: 需要登录认证，需要是帖子发布者或圈子管理员
- **请求参数**:
```json
{
  "id": 1                     // 必填，要删除的帖子ID
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 4. 获取帖子详情

- **接口路径**: `GET /public-api/circle/post`
- **接口描述**: 获取帖子详情
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，帖子ID
}
```
- **响应参数**: 同发布帖子接口

### 5. 获取圈子帖子列表

- **接口路径**: `GET /public-api/circle/post/list`
- **接口描述**: 获取圈子帖子列表
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "circleId": 1,              // 必填，圈子ID
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "tag": "标签",              // 可选，标签
  "memberId": 1001,           // 可选，发布者ID
  "isTop": false,             // 可选，是否只返回置顶帖子
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), likeNum(点赞数), commentNum(评论数), viewNum(浏览数)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 100,               // 总记录数
  "list": [                   // 帖子列表
    {
      // 同发布帖子接口的响应参数
    }
  ]
}
```

### 6. 置顶帖子

- **接口路径**: `PUT /auth-api/circle/post/top`
- **接口描述**: 置顶或取消置顶帖子
- **权限要求**: 需要登录认证，需要圈子管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，帖子ID
  "isTop": true               // 必填，是否置顶
}
```
- **响应参数**:
```json
{
  "success": true             // 设置是否成功
}
```

## 数据模型

### 加入方式枚举

- `free`: 自由加入
- `apply`: 申请加入
- `invite`: 邀请加入

### 申请状态枚举

- `pending`: 待审核
- `approved`: 已通过
- `rejected`: 已拒绝

### 邀请状态枚举

- `pending`: 待处理
- `accepted`: 已接受
- `declined`: 已拒绝
