# cloud-learning-exam-service 考试服务

## 概述

考试服务主要负责管理平台上的考试、测验和作业等功能，包括试题管理、试卷管理、考试管理和成绩管理等。

## 试题管理接口

### 1. 添加试题

- **接口路径**: `POST /auth-api/question`
- **接口描述**: 添加一道新试题
- **权限要求**: 需要登录认证，需要教师或管理员权限
- **请求参数**:
```json
{
  "type": "single_choice",    // 必填，试题类型：single_choice(单选题), multiple_choice(多选题), true_false(判断题), fill_blank(填空题), essay(问答题)
  "content": "试题内容",       // 必填，试题内容
  "options": [                // 选择题必填，选项列表
    {
      "label": "A",           // 选项标签
      "content": "选项内容"     // 选项内容
    }
  ],
  "answer": ["A"],            // 必填，答案列表，单选题和判断题只有一个答案，多选题可以有多个答案
  "analysis": "答案解析",      // 可选，答案解析
  "difficulty": 1,            // 可选，难度等级，1-5，默认为3
  "score": 5,                 // 可选，分值，默认为5
  "cidList": [1, 2, 3],      // 可选，试题分类ID列表
  "tags": ["标签1", "标签2"]  // 可选，试题标签列表
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 试题ID
  "type": "single_choice",    // 试题类型
  "content": "试题内容",       // 试题内容
  "options": [                // 选项列表
    {
      "label": "A",           // 选项标签
      "content": "选项内容"     // 选项内容
    }
  ],
  "answer": ["A"],            // 答案列表
  "analysis": "答案解析",      // 答案解析
  "difficulty": 1,            // 难度等级
  "score": 5,                 // 分值
  "cidList": [1, 2, 3],      // 试题分类ID列表
  "categoryList": [           // 试题分类信息
    {
      "id": 1,
      "name": "分类名称"
    }
  ],
  "tags": ["标签1", "标签2"],  // 试题标签列表
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

### 2. 修改试题

- **接口路径**: `PUT /auth-api/question`
- **接口描述**: 修改已有试题
- **权限要求**: 需要登录认证，需要是试题创建者或管理员
- **请求参数**:
```json
{
  "id": 1,                    // 必填，试题ID
  "type": "multiple_choice",  // 可选，试题类型
  "content": "修改后的试题内容", // 可选，试题内容
  "options": [                // 可选，选项列表
    {
      "label": "A",           // 选项标签
      "content": "修改后的选项内容" // 选项内容
    }
  ],
  "answer": ["A", "B"],       // 可选，答案列表
  "analysis": "修改后的答案解析", // 可选，答案解析
  "difficulty": 2,            // 可选，难度等级
  "score": 10,                // 可选，分值
  "cidList": [1, 2, 3],      // 可选，试题分类ID列表
  "tags": ["新标签1", "新标签2"] // 可选，试题标签列表
}
```
- **响应参数**: 同添加试题接口

### 3. 删除试题

- **接口路径**: `DELETE /auth-api/question`
- **接口描述**: 删除一道试题
- **权限要求**: 需要登录认证，需要是试题创建者或管理员
- **请求参数**:
```json
{
  "id": 1                     // 必填，要删除的试题ID
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 4. 获取试题详情

- **接口路径**: `GET /auth-api/question`
- **接口描述**: 获取试题详情
- **权限要求**: 需要登录认证，需要教师或管理员权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，试题ID
}
```
- **响应参数**: 同添加试题接口

### 5. 获取试题列表

- **接口路径**: `GET /auth-api/question/list`
- **接口描述**: 获取试题列表
- **权限要求**: 需要登录认证，需要教师或管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "type": "single_choice",    // 可选，试题类型
  "difficulty": 3,            // 可选，难度等级
  "cid": 1,                   // 可选，分类ID
  "tag": "标签",              // 可选，标签
  "memberId": 1001,           // 可选，创建者ID
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), difficulty(难度), score(分值)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 100,               // 总记录数
  "list": [                   // 试题列表
    {
      // 同添加试题接口的响应参数
    }
  ]
}
```

### 6. 获取用户试题列表

- **接口路径**: `GET /auth-api/member/question/list`
- **接口描述**: 获取当前登录用户创建的试题列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "type": "single_choice",    // 可选，试题类型
  "difficulty": 3,            // 可选，难度等级
  "cid": 1,                   // 可选，分类ID
  "tag": "标签",              // 可选，标签
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
  "list": [                   // 试题列表
    {
      // 同添加试题接口的响应参数
    }
  ]
}
```

### 7. 批量导入试题

- **接口路径**: `POST /auth-api/question/import`
- **接口描述**: 批量导入试题
- **权限要求**: 需要登录认证，需要教师或管理员权限
- **请求参数**:
```json
{
  "file": "试题文件",         // 必填，试题文件，支持Excel格式
  "cidList": [1, 2, 3]       // 可选，试题分类ID列表
}
```
- **响应参数**:
```json
{
  "successNum": 95,           // 成功导入数量
  "failNum": 5,               // 失败数量
  "failList": [               // 失败列表
    {
      "row": 3,               // 行号
      "reason": "试题类型不正确" // 失败原因
    }
  ]
}
```

### 8. 导出试题

- **接口路径**: `GET /auth-api/question/export`
- **接口描述**: 导出试题
- **权限要求**: 需要登录认证，需要教师或管理员权限
- **请求参数**:
```json
{
  "idList": [1, 2, 3]         // 必填，试题ID列表
}
```
- **响应参数**: 文件下载流

## 试卷管理接口

### 1. 创建试卷

- **接口路径**: `POST /auth-api/paper`
- **接口描述**: 创建一份新试卷
- **权限要求**: 需要登录认证，需要教师或管理员权限
- **请求参数**:
```json
{
  "title": "试卷标题",         // 必填，试卷标题
  "description": "试卷描述",   // 可选，试卷描述
  "totalScore": 100,          // 必填，试卷总分
  "passScore": 60,            // 必填，及格分数
  "timeLimit": 120,           // 必填，考试时间限制（分钟）
  "questionList": [           // 必填，试题列表
    {
      "questionId": 1,        // 必填，试题ID
      "score": 5              // 必填，试题分值
    }
  ],
  "randomOrder": false,       // 可选，是否随机排序，默认为false
  "showAnswer": false,        // 可选，是否显示答案，默认为false
  "allowRetake": false,       // 可选，是否允许重考，默认为false
  "maxRetakeCount": 0         // 可选，最大重考次数，默认为0
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 试卷ID
  "title": "试卷标题",         // 试卷标题
  "description": "试卷描述",   // 试卷描述
  "totalScore": 100,          // 试卷总分
  "passScore": 60,            // 及格分数
  "timeLimit": 120,           // 考试时间限制（分钟）
  "questionList": [           // 试题列表
    {
      "id": 1,                // 试题ID
      "type": "single_choice", // 试题类型
      "content": "试题内容",   // 试题内容
      "options": [            // 选项列表
        {
          "label": "A",       // 选项标签
          "content": "选项内容" // 选项内容
        }
      ],
      "score": 5,             // 试题分值
      "difficulty": 1,        // 难度等级
      "cidList": [1, 2, 3],  // 试题分类ID列表
      "tags": ["标签1", "标签2"] // 试题标签列表
    }
  ],
  "randomOrder": false,       // 是否随机排序
  "showAnswer": false,        // 是否显示答案
  "allowRetake": false,       // 是否允许重考
  "maxRetakeCount": 0,        // 最大重考次数
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

### 2. 修改试卷

- **接口路径**: `PUT /auth-api/paper`
- **接口描述**: 修改已有试卷
- **权限要求**: 需要登录认证，需要是试卷创建者或管理员
- **请求参数**:
```json
{
  "id": 1,                    // 必填，试卷ID
  "title": "修改后的试卷标题", // 可选，试卷标题
  "description": "修改后的试卷描述", // 可选，试卷描述
  "totalScore": 100,          // 可选，试卷总分
  "passScore": 60,            // 可选，及格分数
  "timeLimit": 120,           // 可选，考试时间限制（分钟）
  "questionList": [           // 可选，试题列表
    {
      "questionId": 1,        // 必填，试题ID
      "score": 5              // 必填，试题分值
    }
  ],
  "randomOrder": true,        // 可选，是否随机排序
  "showAnswer": false,        // 可选，是否显示答案
  "allowRetake": true,        // 可选，是否允许重考
  "maxRetakeCount": 3         // 可选，最大重考次数
}
```
- **响应参数**: 同创建试卷接口

### 3. 删除试卷

- **接口路径**: `DELETE /auth-api/paper`
- **接口描述**: 删除一份试卷
- **权限要求**: 需要登录认证，需要是试卷创建者或管理员
- **请求参数**:
```json
{
  "id": 1                     // 必填，要删除的试卷ID
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 4. 获取试卷详情

- **接口路径**: `GET /auth-api/paper`
- **接口描述**: 获取试卷详情
- **权限要求**: 需要登录认证，需要教师或管理员权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，试卷ID
}
```
- **响应参数**: 同创建试卷接口

### 5. 获取试卷列表

- **接口路径**: `GET /auth-api/paper/list`
- **接口描述**: 获取试卷列表
- **权限要求**: 需要登录认证，需要教师或管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "memberId": 1001,           // 可选，创建者ID
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), totalTime(总时长), totalScore(总分)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 试卷列表
    {
      // 同创建试卷接口的响应参数
    }
  ]
}
```

### 6. 获取用户试卷列表

- **接口路径**: `GET /auth-api/member/paper/list`
- **接口描述**: 获取当前登录用户创建的试卷列表
- **权限要求**: 需要登录认证
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
  "total": 20,                // 总记录数
  "list": [                   // 试卷列表
    {
      // 同创建试卷接口的响应参数
    }
  ]
}
```

## 考试管理接口

### 1. 创建考试

- **接口路径**: `POST /auth-api/exam`
- **接口描述**: 创建一场新考试
- **权限要求**: 需要登录认证，需要教师或管理员权限
- **请求参数**:
```json
{
  "title": "考试标题",         // 必填，考试标题
  "description": "考试描述",   // 可选，考试描述
  "paperId": 1,               // 必填，试卷ID
  "startTime": "2023-05-01 09:00:00", // 必填，考试开始时间
  "endTime": "2023-05-01 11:00:00",   // 必填，考试结束时间
  "allowLate": false,         // 可选，是否允许迟到，默认为false
  "lateTime": 10,             // 可选，迟到时间限制（分钟），默认为10
  "allowEarly": false,        // 可选，是否允许提前交卷，默认为false
  "earlyTime": 30,            // 可选，提前交卷时间限制（分钟），默认为30
  "memberIdList": [1001, 1002], // 可选，指定考生ID列表，为空则所有用户可参加
  "isPublic": true,           // 可选，是否公开，默认为true
  "status": "draft"           // 可选，考试状态，默认为draft
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 考试ID
  "title": "考试标题",         // 考试标题
  "description": "考试描述",   // 考试描述
  "paperId": 1,               // 试卷ID
  "paper": {                  // 试卷信息
    "id": 1,
    "title": "试卷标题",
    "totalScore": 100,
    "timeLimit": 120
  },
  "startTime": "2023-05-01 09:00:00", // 考试开始时间
  "endTime": "2023-05-01 11:00:00",   // 考试结束时间
  "allowLate": false,         // 是否允许迟到
  "lateTime": 10,             // 迟到时间限制（分钟）
  "allowEarly": false,        // 是否允许提前交卷
  "earlyTime": 30,            // 提前交卷时间限制（分钟）
  "memberIdList": [1001, 1002], // 指定考生ID列表
  "isPublic": true,           // 是否公开
  "status": "draft",          // 考试状态
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

### 2. 修改考试

- **接口路径**: `PUT /auth-api/exam`
- **接口描述**: 修改已有考试
- **权限要求**: 需要登录认证，需要是考试创建者或管理员
- **请求参数**:
```json
{
  "id": 1,                    // 必填，考试ID
  "title": "修改后的考试标题", // 可选，考试标题
  "description": "修改后的考试描述", // 可选，考试描述
  "paperId": 2,               // 可选，试卷ID
  "startTime": "2023-05-01 09:00:00", // 可选，考试开始时间
  "endTime": "2023-05-01 11:00:00",   // 可选，考试结束时间
  "allowLate": true,          // 可选，是否允许迟到
  "lateTime": 15,             // 可选，迟到时间限制（分钟）
  "allowEarly": true,         // 可选，是否允许提前交卷
  "earlyTime": 45,            // 可选，提前交卷时间限制（分钟）
  "memberIdList": [1001, 1002, 1003], // 可选，指定考生ID列表
  "isPublic": false,          // 可选，是否公开
  "status": "published"       // 可选，考试状态
}
```
- **响应参数**: 同创建考试接口

### 3. 删除考试

- **接口路径**: `DELETE /auth-api/exam`
- **接口描述**: 删除一场考试
- **权限要求**: 需要登录认证，需要是考试创建者或管理员
- **请求参数**:
```json
{
  "id": 1                     // 必填，要删除的考试ID
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 4. 获取考试详情

- **接口路径**: `GET /auth-api/exam`
- **接口描述**: 获取考试详情
- **权限要求**: 需要登录认证，需要教师或管理员权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，考试ID
}
```
- **响应参数**: 同创建考试接口

### 5. 获取考试列表

- **接口路径**: `GET /auth-api/exam/list`
- **接口描述**: 获取考试列表
- **权限要求**: 需要登录认证，需要教师或管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "status": "published",      // 可选，考试状态
  "memberId": 1001,           // 可选，创建者ID
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), startTime(开始时间)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 30,                // 总记录数
  "list": [                   // 考试列表
    {
      // 同创建考试接口的响应参数
    }
  ]
}
```

### 6. 获取用户考试列表

- **接口路径**: `GET /auth-api/member/exam/list`
- **接口描述**: 获取当前登录用户创建的考试列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "status": "published",      // 可选，考试状态
  "orderColumn": "createTime", // 可选，排序字段
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 15,                // 总记录数
  "list": [                   // 考试列表
    {
      // 同创建考试接口的响应参数
    }
  ]
}
```

### 7. 发布考试

- **接口路径**: `PUT /auth-api/exam/publish`
- **接口描述**: 发布考试
- **权限要求**: 需要登录认证，需要是考试创建者或管理员
- **请求参数**:
```json
{
  "id": 1                     // 必填，考试ID
}
```
- **响应参数**:
```json
{
  "success": true             // 发布是否成功
}
```

### 8. 取消发布考试

- **接口路径**: `PUT /auth-api/exam/unpublish`
- **接口描述**: 取消发布考试
- **权限要求**: 需要登录认证，需要是考试创建者或管理员
- **请求参数**:
```json
{
  "id": 1                     // 必填，考试ID
}
```
- **响应参数**:
```json
{
  "success": true             // 取消发布是否成功
}
```

## 成绩管理接口

### 1. 开始考试

- **接口路径**: `POST /auth-api/exam/start`
- **接口描述**: 开始参加考试
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "examId": 1                 // 必填，考试ID
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 考试记录ID
  "examId": 1,                // 考试ID
  "memberId": 1001,           // 考生ID
  "startTime": "2023-05-01 09:00:00", // 考试开始时间
  "endTime": null,            // 考试结束时间
  "status": "in_progress",    // 考试状态
  "score": null,              // 考试得分
  "paper": {                  // 试卷信息
    "id": 1,
    "title": "试卷标题",
    "timeLimit": 120,
    "questionList": [
      {
        "id": 1,              // 试题ID
        "type": "single_choice", // 试题类型
        "content": "试题内容", // 试题内容
        "options": [          // 选项列表
          {
            "label": "A",     // 选项标签
            "content": "选项内容" // 选项内容
          }
        ],
        "score": 5            // 试题分值
      }
    ]
  }
}
```

### 2. 提交考试

- **接口路径**: `PUT /auth-api/exam/submit`
- **接口描述**: 提交考试答案
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1,                    // 必填，考试记录ID
  "answerList": [             // 必填，答案列表
    {
      "questionId": 1,        // 必填，试题ID
      "answer": ["A"]         // 必填，答案列表
    }
  ]
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 考试记录ID
  "examId": 1,                // 考试ID
  "memberId": 1001,           // 考生ID
  "startTime": "2023-05-01 09:00:00", // 考试开始时间
  "endTime": "2023-05-01 10:30:00",   // 考试结束时间
  "status": "completed",      // 考试状态
  "score": 85,                // 考试得分
  "totalScore": 100,          // 试卷总分
  "passScore": 60,            // 及格分数
  "isPass": true,             // 是否及格
  "answerList": [             // 答案列表
    {
      "questionId": 1,        // 试题ID
      "question": {           // 试题信息
        "id": 1,
        "type": "single_choice",
        "content": "试题内容",
        "options": [
          {
            "label": "A",
            "content": "选项内容"
          }
        ],
        "answer": ["A"],      // 正确答案
        "analysis": "答案解析", // 答案解析
        "score": 5
      },
      "answer": ["A"],        // 考生答案
      "isCorrect": true,      // 是否正确
      "score": 5               // 得分
    }
  ]
}
```

### 3. 获取考试记录详情

- **接口路径**: `GET /auth-api/exam/record`
- **接口描述**: 获取考试记录详情
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，考试记录ID
}
```
- **响应参数**: 同提交考试接口

### 4. 获取用户考试记录列表

- **接口路径**: `GET /auth-api/member/exam/record/list`
- **接口描述**: 获取当前登录用户的考试记录列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "examId": 1,                // 可选，考试ID
  "status": "completed",      // 可选，考试状态
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), startTime(开始时间), score(得分)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 20,                // 总记录数
  "list": [                   // 考试记录列表
    {
      // 同提交考试接口的响应参数
    }
  ]
}
```

### 5. 获取考试记录列表

- **接口路径**: `GET /auth-api/exam/record/list`
- **接口描述**: 获取考试记录列表
- **权限要求**: 需要登录认证，需要教师或管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "examId": 1,                // 可选，考试ID
  "memberId": 1001,           // 可选，考生ID
  "status": "completed",      // 可选，考试状态
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), startTime(开始时间), score(得分)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 100,               // 总记录数
  "list": [                   // 考试记录列表
    {
      // 同提交考试接口的响应参数
    }
  ]
}
```

### 6. 获取考试成绩统计

- **接口路径**: `GET /auth-api/exam/statistics`
- **接口描述**: 获取考试成绩统计
- **权限要求**: 需要登录认证，需要教师或管理员权限
- **请求参数**:
```json
{
  "examId": 1                 // 必填，考试ID
}
```
- **响应参数**:
```json
{
  "examId": 1,                // 考试ID
  "totalNum": 100,            // 总考试人数
  "completedNum": 95,          // 已完成人数
  "passNum": 80,              // 及格人数
  "passRate": 84.2,           // 及格率（百分比）
  "avgScore": 75.5,           // 平均分
  "maxScore": 98,             // 最高分
  "minScore": 35,             // 最低分
  "scoreDistribution": [      // 分数分布
    {
      "range": "90-100",      // 分数段
      "num": 20               // 人数
    },
    {
      "range": "80-89",
      "num": 30
    },
    {
      "range": "70-79",
      "num": 25
    },
    {
      "range": "60-69",
      "num": 15
    },
    {
      "range": "0-59",
      "num": 10
    }
  ]
}
```

## 数据模型

### 试题类型枚举

- `single_choice`: 单选题
- `multiple_choice`: 多选题
- `true_false`: 判断题
- `fill_blank`: 填空题
- `essay`: 问答题

### 考试状态枚举

- `draft`: 草稿
- `published`: 已发布
- `started`: 已开始
- `ended`: 已结束
- `canceled`: 已取消

### 考试记录状态枚举

- `not_started`: 未开始
- `in_progress`: 进行中
- `completed`: 已完成
- `timeout`: 超时
- `canceled`: 已取消
