# cloud-learning-learn-service 学习服务

## 概述

学习服务主要负责管理平台上的学习过程，包括课程学习、学习进度、学习记录和学习统计等功能。

## 课程学习接口

### 1. 获取课程内容

- **接口路径**: `GET /auth-api/course/content`
- **接口描述**: 获取课程的学习内容
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "courseId": 1,              // 必填，课程ID
  "chapterId": 1              // 可选，章节ID，不填则获取整个课程内容
}
```
- **响应参数**:
```json
{
  "courseId": 1,              // 课程ID
  "courseTitle": "课程标题",   // 课程标题
  "chapters": [               // 章节列表
    {
      "id": 1,                // 章节ID
      "title": "章节标题",     // 章节标题
      "description": "章节描述", // 章节描述
      "orderNum": 1,           // 排序号
      "lessons": [            // 课时列表
        {
          "id": 1,            // 课时ID
          "title": "课时标题", // 课时标题
          "type": "video",     // 课时类型：video(视频), audio(音频), document(文档), live(直播), exam(考试)
          "duration": 1800,    // 课时时长（秒）
          "content": {        // 课时内容
            "url": "课时资源URL", // 资源URL
            "size": 1024000    // 资源大小（字节）
          },
          "isFree": false,    // 是否免费
          "orderNum": 1,       // 排序号
          "studyStatus": "not_started", // 学习状态：not_started(未开始), studying(学习中), completed(已完成)
          "studyProgress": 0,  // 学习进度（百分比）
          "studyTime": 0       // 学习时长（秒）
        }
      ]
    }
  ],
  "studyProgress": 25,        // 课程学习进度（百分比）
  "studyTime": 3600,          // 课程学习时长（秒）
  "lastStudyTime": "2023-05-01 12:00:00" // 最后学习时间
}
```

### 2. 记录学习进度

- **接口路径**: `POST /auth-api/learn/progress`
- **接口描述**: 记录学习进度
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "courseId": 1,              // 必填，课程ID
  "lessonId": 1,              // 必填，课时ID
  "progress": 50,             // 必填，学习进度（百分比）
  "studyTime": 900,           // 必填，学习时长（秒）
  "position": 600              // 可选，播放位置（秒），视频课时有效
}
```
- **响应参数**:
```json
{
  "success": true,            // 记录是否成功
  "studyProgress": 50,        // 当前学习进度（百分比）
  "studyTime": 900,           // 当前学习时长（秒）
  "isCompleted": false        // 是否已完成
}
```

### 3. 完成课时学习

- **接口路径**: `POST /auth-api/learn/complete`
- **接口描述**: 标记课时学习完成
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "courseId": 1,              // 必填，课程ID
  "lessonId": 1               // 必填，课时ID
}
```
- **响应参数**:
```json
{
  "success": true,            // 标记是否成功
  "courseProgress": 30,       // 课程学习进度（百分比）
  "lessonCompleted": true,    // 课时是否已完成
  "courseCompleted": false    // 课程是否已完成
}
```

### 4. 获取学习记录

- **接口路径**: `GET /auth-api/learn/record/list`
- **接口描述**: 获取学习记录列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "courseId": 1,              // 可选，课程ID
  "startDate": "2023-05-01",  // 可选，开始日期
  "endDate": "2023-05-31"     // 可选，结束日期
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 学习记录列表
    {
      "id": 1,                // 记录ID
      "courseId": 1,          // 课程ID
      "courseTitle": "课程标题", // 课程标题
      "lessonId": 1,          // 课时ID
      "lessonTitle": "课时标题", // 课时标题
      "lessonType": "video",   // 课时类型
      "studyTime": 1800,      // 学习时长（秒）
      "progress": 100,         // 学习进度（百分比）
      "isCompleted": true,     // 是否已完成
      "studyDate": "2023-05-01", // 学习日期
      "createTime": "2023-05-01 12:00:00" // 记录时间
    }
  ]
}
```

### 5. 获取学习统计

- **接口路径**: `GET /auth-api/learn/statistics`
- **接口描述**: 获取学习统计数据
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "type": "day",              // 可选，统计类型：day(按天), week(按周), month(按月)
  "startDate": "2023-05-01",  // 可选，开始日期
  "endDate": "2023-05-31"     // 可选，结束日期
}
```
- **响应参数**:
```json
{
  "totalStudyTime": 86400,    // 总学习时长（秒）
  "totalCourseNum": 5,        // 学习课程数量
  "completedCourseNum": 2,    // 已完成课程数量
  "totalLessonNum": 50,       // 学习课时数量
  "completedLessonNum": 30,   // 已完成课时数量
  "avgStudyTime": 1728,       // 平均学习时长（秒）
  "maxStudyTime": 3600,       // 最大学习时长（秒）
  "continuousDays": 7,        // 连续学习天数
  "statisticsList": [         // 统计列表
    {
      "date": "2023-05-01",   // 日期
      "studyTime": 3600,      // 学习时长（秒）
      "courseNum": 2,         // 学习课程数量
      "lessonNum": 5          // 学习课时数量
    }
  ]
}
```

### 6. 获取学习排行

- **接口路径**: `GET /public-api/learn/ranking`
- **接口描述**: 获取学习排行榜
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "type": "studyTime",        // 必填，排行类型：studyTime(学习时长), courseNum(课程数量), lessonNum(课时数量), continuousDays(连续天数)
  "period": "week",           // 可选，排行周期：day(日), week(周), month(月), total(总榜)，默认为week
  "limit": 10                // 可选，返回数量，默认为10
}
```
- **响应参数**:
```json
{
  "type": "studyTime",        // 排行类型
  "period": "week",           // 排行周期
  "list": [                   // 排行列表
    {
      "rank": 1,              // 排名
      "memberId": 1001,       // 用户ID
      "nickname": "用户昵称",   // 用户昵称
      "avatar": "头像URL",     // 用户头像
      "value": 86400,         // 排行值
      "unit": "秒"            // 单位
    }
  ]
}
```

## 学习计划接口

### 1. 创建学习计划

- **接口路径**: `POST /auth-api/plan`
- **接口描述**: 创建一个学习计划
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "title": "学习计划标题",     // 必填，学习计划标题
  "description": "学习计划描述", // 可选，学习计划描述
  "courseIdList": [1, 2, 3],  // 必填，课程ID列表
  "startDate": "2023-05-01",  // 必填，开始日期
  "endDate": "2023-05-31",    // 必填，结束日期
  "dailyStudyTime": 3600,     // 可选，每日学习时长（秒），默认为3600
  "reminderEnabled": true,     // 可选，是否开启提醒，默认为false
  "reminderTime": "09:00",     // 可选，提醒时间，默认为09:00
  "isPublic": false          // 可选，是否公开，默认为false
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 学习计划ID
  "title": "学习计划标题",     // 学习计划标题
  "description": "学习计划描述", // 学习计划描述
  "courseIdList": [1, 2, 3],  // 课程ID列表
  "courseList": [             // 课程列表
    {
      "id": 1,                // 课程ID
      "title": "课程标题",     // 课程标题
      "cover": "封面图片URL",  // 课程封面
      "totalLessons": 20,      // 总课时数
      "completedLessons": 5,   // 已完成课时数
      "progress": 25          // 学习进度（百分比）
    }
  ],
  "startDate": "2023-05-01",  // 开始日期
  "endDate": "2023-05-31",    // 结束日期
  "dailyStudyTime": 3600,     // 每日学习时长（秒）
  "reminderEnabled": true,     // 是否开启提醒
  "reminderTime": "09:00",     // 提醒时间
  "isPublic": false,          // 是否公开
  "progress": 15,             // 计划进度（百分比）
  "totalStudyTime": 86400,    // 总学习时长（秒）
  "plannedStudyTime": 108000,  // 计划学习时长（秒）
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

### 2. 修改学习计划

- **接口路径**: `PUT /auth-api/plan`
- **接口描述**: 修改已有学习计划
- **权限要求**: 需要登录认证，需要是计划创建者
- **请求参数**:
```json
{
  "id": 1,                    // 必填，学习计划ID
  "title": "修改后的学习计划标题", // 可选，学习计划标题
  "description": "修改后的学习计划描述", // 可选，学习计划描述
  "courseIdList": [1, 2, 3, 4], // 可选，课程ID列表
  "startDate": "2023-05-01",  // 可选，开始日期
  "endDate": "2023-06-30",    // 可选，结束日期
  "dailyStudyTime": 7200,     // 可选，每日学习时长（秒）
  "reminderEnabled": false,    // 可选，是否开启提醒
  "reminderTime": "10:00",     // 可选，提醒时间
  "isPublic": true           // 可选，是否公开
}
```
- **响应参数**: 同创建学习计划接口

### 3. 删除学习计划

- **接口路径**: `DELETE /auth-api/plan`
- **接口描述**: 删除一个学习计划
- **权限要求**: 需要登录认证，需要是计划创建者
- **请求参数**:
```json
{
  "id": 1                     // 必填，要删除的学习计划ID
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 4. 获取学习计划详情

- **接口路径**: `GET /auth-api/plan`
- **接口描述**: 获取学习计划详情
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，学习计划ID
}
```
- **响应参数**: 同创建学习计划接口

### 5. 获取学习计划列表

- **接口路径**: `GET /auth-api/plan/list`
- **接口描述**: 获取学习计划列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "status": "in_progress",    // 可选，计划状态：not_started(未开始), in_progress(进行中), completed(已完成), expired(已过期)
  "isPublic": false,         // 可选，是否公开
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), progress(进度), startDate(开始时间)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 20,                // 总记录数
  "list": [                   // 学习计划列表
    {
      // 同创建学习计划接口的响应参数
    }
  ]
}
```

### 6. 获取公开学习计划列表

- **接口路径**: `GET /public-api/plan/list`
- **接口描述**: 获取公开学习计划列表
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
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
  "list": [                   // 学习计划列表
    {
      // 同创建学习计划接口的响应参数
    }
  ]
}
```

## 笔记管理接口

### 1. 创建笔记

- **接口路径**: `POST /auth-api/note`
- **接口描述**: 创建一条学习笔记
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "courseId": 1,              // 必填，课程ID
  "lessonId": 1,              // 可选，课时ID
  "title": "笔记标题",         // 必填，笔记标题
  "content": "笔记内容",       // 必填，笔记内容
  "images": ["图片URL1", "图片URL2"], // 可选，笔记图片列表
  "tags": ["标签1", "标签2"], // 可选，笔记标签列表
  "isPublic": false          // 可选，是否公开，默认为false
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 笔记ID
  "courseId": 1,              // 课程ID
  "lessonId": 1,              // 课时ID
  "title": "笔记标题",         // 笔记标题
  "content": "笔记内容",       // 笔记内容
  "images": ["图片URL1", "图片URL2"], // 笔记图片列表
  "tags": ["标签1", "标签2"], // 笔记标签列表
  "isPublic": false,          // 是否公开
  "likeNum": 0,               // 点赞数量
  "commentNum": 0,            // 评论数量
  "memberId": 1001,           // 创建者ID
  "member": {                 // 创建者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "course": {                 // 课程信息
    "id": 1,
    "title": "课程标题",
    "cover": "封面图片URL"
  },
  "lesson": {                 // 课时信息
    "id": 1,
    "title": "课时标题"
  },
  "like": {                   // 当前用户点赞状态
    "isLike": false
  },
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 修改笔记

- **接口路径**: `PUT /auth-api/note`
- **接口描述**: 修改已有笔记
- **权限要求**: 需要登录认证，需要是笔记创建者
- **请求参数**:
```json
{
  "id": 1,                    // 必填，笔记ID
  "title": "修改后的笔记标题", // 可选，笔记标题
  "content": "修改后的笔记内容", // 可选，笔记内容
  "images": ["新图片URL1", "新图片URL2"], // 可选，笔记图片列表
  "tags": ["新标签1", "新标签2"], // 可选，笔记标签列表
  "isPublic": true           // 可选，是否公开
}
```
- **响应参数**: 同创建笔记接口

### 3. 删除笔记

- **接口路径**: `DELETE /auth-api/note`
- **接口描述**: 删除一条笔记
- **权限要求**: 需要登录认证，需要是笔记创建者
- **请求参数**:
```json
{
  "id": 1                     // 必填，要删除的笔记ID
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 4. 获取笔记详情

- **接口路径**: `GET /public-api/note`
- **接口描述**: 获取笔记详情
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，笔记ID
}
```
- **响应参数**: 同创建笔记接口

### 5. 获取笔记列表

- **接口路径**: `GET /public-api/note/list`
- **接口描述**: 获取笔记列表
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "courseId": 1,              // 可选，课程ID
  "lessonId": 1,              // 可选，课时ID
  "memberId": 1001,           // 可选，创建者ID
  "tag": "标签",              // 可选，标签
  "isPublic": true,           // 可选，是否公开
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), likeNum(点赞数), commentNum(评论数)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 100,               // 总记录数
  "list": [                   // 笔记列表
    {
      // 同创建笔记接口的响应参数
    }
  ]
}
```

### 6. 获取用户笔记列表

- **接口路径**: `GET /auth-api/member/note/list`
- **接口描述**: 获取当前登录用户的笔记列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "courseId": 1,              // 可选，课程ID
  "lessonId": 1,              // 可选，课时ID
  "tag": "标签",              // 可选，标签
  "isPublic": true,           // 可选，是否公开
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
  "list": [                   // 笔记列表
    {
      // 同创建笔记接口的响应参数
    }
  ]
}
```

## 数据模型

### 课时类型枚举

- `video`: 视频
- `audio`: 音频
- `document`: 文档
- `live`: 直播
- `exam`: 考试

### 学习状态枚举

- `not_started`: 未开始
- `studying`: 学习中
- `completed`: 已完成

### 学习计划状态枚举

- `not_started`: 未开始
- `in_progress`: 进行中
- `completed`: 已完成
- `expired`: 已过期

### 统计类型枚举

- `day`: 按天
- `week`: 按周
- `month`: 按月

### 排行类型枚举

- `studyTime`: 学习时长
- `courseNum`: 课程数量
- `lessonNum`: 课时数量
- `continuousDays`: 连续天数

### 排行周期枚举

- `day`: 日榜
- `week`: 周榜
- `month`: 月榜
- `total`: 总榜
