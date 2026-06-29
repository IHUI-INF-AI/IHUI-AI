# cloud-learning-search-service 搜索服务

## 概述

搜索服务主要负责处理全文搜索、搜索建议、热门搜索等业务功能，为系统提供高效的内容搜索能力。

## 搜索接口

### 1. 全文搜索

- **接口路径**: `GET /public-api/search`
- **接口描述**: 全文搜索接口，支持多种内容类型搜索
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "keyword": "Java编程",     // 必填，搜索关键字
  "type": "course",         // 可选，搜索类型：course(课程), question(问题), article(文章), video(视频), all(全部)
  "pageNum": 1,             // 可选，页码，默认为1
  "pageSize": 10,           // 可选，每页大小，默认为10
  "sort": "relevance",      // 可选，排序方式：relevance(相关度), time(时间), hot(热度)
  "categoryId": 1,          // 可选，分类ID
  "minPrice": 0,            // 可选，最低价格（仅课程搜索）
  "maxPrice": 1000          // 可选，最高价格（仅课程搜索）
}
```
- **响应参数**:
```json
{
  "keyword": "Java编程",     // 搜索关键字
  "total": 150,             // 总记录数
  "pageNum": 1,             // 当前页码
  "pageSize": 10,           // 每页大小
  "results": [              // 搜索结果列表
    {
      "type": "course",     // 结果类型
      "id": 123,            // 结果ID
      "title": "Java编程入门教程", // 标题
      "description": "从零开始学习Java编程语言", // 描述
      "image": "课程封面URL", // 图片
      "author": "张老师",    // 作者/发布者
      "price": 299,         // 价格（仅课程）
      "score": 4.8,         // 评分
      "studentCount": 1500, // 学习人数（仅课程）
      "createTime": "2023-05-01 12:00:00", // 创建时间
      "highlight": {        // 高亮信息
        "title": "<em>Java</em>编程入门教程",
        "description": "从零开始学习<em>Java</em>编程语言"
      }
    }
  ],
  "facets": {               // 搜索聚合信息
    "types": [              // 类型分布
      {
        "type": "course",
        "count": 80
      },
      {
        "type": "question",
        "count": 50
      }
    ],
    "categories": [         // 分类分布
      {
        "id": 1,
        "name": "编程语言",
        "count": 60
      }
    ]
  }
}
```

### 2. 搜索建议

- **接口路径**: `GET /public-api/search/suggest`
- **接口描述**: 获取搜索建议
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "keyword": "jav",         // 必填，搜索关键字前缀
  "limit": 10               // 可选，建议数量，默认为10
}
```
- **响应参数**:
```json
[
  {
    "keyword": "Java",      // 建议关键字
    "count": 150            // 相关结果数量
  },
  {
    "keyword": "JavaScript",
    "count": 80
  },
  {
    "keyword": "Java编程",
    "count": 60
  }
]
```

### 3. 热门搜索

- **接口路径**: `GET /public-api/search/hot`
- **接口描述**: 获取热门搜索关键词
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "limit": 10,              // 可选，热门词数量，默认为10
  "type": "daily"           // 可选，时间范围：daily(今日), weekly(本周), monthly(本月)
}
```
- **响应参数**:
```json
[
  {
    "keyword": "Python",    // 热门关键词
    "count": 250,           // 搜索次数
    "trend": "up"           // 趋势：up(上升), down(下降), stable(稳定)
  },
  {
    "keyword": "Java",
    "count": 200,
    "trend": "stable"
  },
  {
    "keyword": "机器学习",
    "count": 180,
    "trend": "up"
  }
]
```

### 4. 搜索历史

- **接口路径**: `GET /auth-api/search/history`
- **接口描述**: 获取当前用户的搜索历史
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "limit": 20               // 可选，历史记录数量，默认为20
}
```
- **响应参数**:
```json
[
  {
    "keyword": "Java编程",  // 搜索关键词
    "searchTime": "2023-05-01 14:30:00", // 搜索时间
    "resultCount": 150      // 搜索结果数量
  },
  {
    "keyword": "Python基础",
    "searchTime": "2023-05-01 10:15:00",
    "resultCount": 80
  }
]
```

### 5. 清空搜索历史

- **接口路径**: `DELETE /auth-api/search/history`
- **接口描述**: 清空当前用户的搜索历史
- **权限要求**: 需要登录认证
- **请求参数**: 无
- **响应参数**:
```json
{
  "success": true           // 清空是否成功
}
```

## 索引管理接口（管理员）

### 1. 重建索引

- **接口路径**: `POST /auth-api/search/index/rebuild`
- **接口描述**: 重建搜索索引
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "type": "course"          // 可选，索引类型：course(课程), question(问题), article(文章), video(视频), all(全部)
}
```
- **响应参数**:
```json
{
  "success": true,          // 重建是否成功
  "taskId": "TASK202305011200001", // 任务ID
  "message": "索引重建任务已开始" // 提示信息
}
```

### 2. 获取索引状态

- **接口路径**: `GET /auth-api/search/index/status`
- **接口描述**: 获取索引状态信息
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "type": "course"          // 可选，索引类型
}
```
- **响应参数**:
```json
{
  "type": "course",         // 索引类型
  "documentCount": 1500,    // 文档数量
  "indexSize": "256MB",     // 索引大小
  "lastUpdateTime": "2023-05-01 12:00:00", // 最后更新时间
  "status": "healthy"       // 索引状态
}
```

### 3. 优化索引

- **接口路径**: `POST /auth-api/search/index/optimize`
- **接口描述**: 优化搜索索引
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "type": "course"          // 可选，索引类型
}
```
- **响应参数**:
```json
{
  "success": true,          // 优化是否成功
  "message": "索引优化完成" // 提示信息
}
```

## 搜索统计接口（管理员）

### 1. 获取搜索统计

- **接口路径**: `GET /auth-api/search/statistics`
- **接口描述**: 获取搜索统计信息
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "startTime": "2023-05-01", // 可选，开始时间
  "endTime": "2023-05-31",   // 可选，结束时间
  "type": "daily"           // 可选，统计粒度：daily(每日), weekly(每周), monthly(每月)
}
```
- **响应参数**:
```json
{
  "totalSearches": 15000,    // 总搜索次数
  "uniqueUsers": 5000,       // 独立用户数
  "avgSearchPerUser": 3.0,   // 人均搜索次数
  "topKeywords": [           // 热门关键词
    {
      "keyword": "Python",
      "count": 2500
    },
    {
      "keyword": "Java",
      "count": 2000
    }
  ],
  "searchTrends": [          // 搜索趋势
    {
      "date": "2023-05-01",
      "count": 500
    },
    {
      "date": "2023-05-02",
      "count": 520
    }
  ]
}
```

### 2. 获取无结果搜索

- **接口路径**: `GET /auth-api/search/no-results`
- **接口描述**: 获取无结果的搜索关键词
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "startTime": "2023-05-01", // 可选，开始时间
  "endTime": "2023-05-31",   // 可选，结束时间
  "limit": 20               // 可选，数量限制，默认为20
}
```
- **响应参数**:
```json
[
  {
    "keyword": "不存在的关键词", // 无结果关键词
    "count": 15,            // 搜索次数
    "lastSearchTime": "2023-05-01 14:30:00" // 最后搜索时间
  }
]
```

## 数据模型

### 搜索类型枚举
- `course`: 课程
- `question`: 问题
- `article`: 文章
- `video`: 视频
- `all`: 全部

### 排序方式枚举
- `relevance`: 相关度
- `time`: 时间
- `hot`: 热度

### 索引状态枚举
- `healthy`: 健康
- `rebuilding`: 重建中
- `error`: 错误
- `optimizing`: 优化中

### 趋势枚举
- `up`: 上升
- `down`: 下降
- `stable`: 稳定