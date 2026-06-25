# cloud-learning-content-service 内容服务

## 概述

内容服务主要负责管理平台上的各种内容资源，包括文章、资讯、公告等内容的管理和发布，为用户提供丰富的学习资源。

## 文章管理接口

### 1. 发布文章

- **接口路径**: `POST /auth-api/article`
- **接口描述**: 发布一篇新文章
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "title": "文章标题",         // 必填，文章标题
  "summary": "文章摘要",       // 必填，文章摘要
  "content": "文章内容",       // 必填，文章内容
  "cover": "封面图片URL",     // 必填，文章封面图片URL
  "cidList": [1, 2, 3],      // 可选，文章分类ID列表
  "tags": ["标签1", "标签2"], // 可选，文章标签列表
  "status": "published",     // 可选，文章状态，默认为published
  "isTop": false,             // 可选，是否置顶，默认为false
  "isOriginal": true,         // 可选，是否原创，默认为true
  "originalUrl": "原文链接",   // 可选，原文链接，非原创时必填
  "author": "作者",           // 可选，作者，默认为当前用户昵称
  "source": "来源",           // 可选，来源
  "allowComment": true,       // 可选，是否允许评论，默认为true
  "seoKeywords": "SEO关键词", // 可选，SEO关键词
  "seoDescription": "SEO描述" // 可选，SEO描述
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 文章ID
  "title": "文章标题",         // 文章标题
  "summary": "文章摘要",       // 文章摘要
  "content": "文章内容",       // 文章内容
  "cover": "封面图片URL",     // 文章封面图片URL
  "cidList": [1, 2, 3],      // 文章分类ID列表
  "categoryList": [           // 文章分类信息
    {
      "id": 1,
      "name": "分类名称"
    }
  ],
  "tags": ["标签1", "标签2"], // 文章标签列表
  "status": "published",     // 文章状态
  "isTop": false,             // 是否置顶
  "isOriginal": true,         // 是否原创
  "originalUrl": "原文链接",   // 原文链接
  "author": "作者",           // 作者
  "source": "来源",           // 来源
  "allowComment": true,       // 是否允许评论
  "seoKeywords": "SEO关键词", // SEO关键词
  "seoDescription": "SEO描述", // SEO描述
  "viewNum": 0,               // 浏览数量
  "likeNum": 0,               // 点赞数量
  "commentNum": 0,            // 评论数量
  "favoriteNum": 0,            // 收藏数量
  "memberId": 1001,           // 发布者ID
  "member": {                 // 发布者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "like": {                   // 当前用户点赞状态
    "isLike": false
  },
  "favorite": {               // 当前用户收藏状态
    "isFavorite": false
  },
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 修改文章

- **接口路径**: `PUT /auth-api/article`
- **接口描述**: 修改已有文章
- **权限要求**: 需要登录认证，需要是文章发布者或管理员
- **请求参数**:
```json
{
  "id": 1,                    // 必填，文章ID
  "title": "修改后的文章标题", // 可选，文章标题
  "summary": "修改后的文章摘要", // 可选，文章摘要
  "content": "修改后的文章内容", // 可选，文章内容
  "cover": "修改后的封面图片URL", // 可选，文章封面图片URL
  "cidList": [1, 2, 3],      // 可选，文章分类ID列表
  "tags": ["新标签1", "新标签2"], // 可选，文章标签列表
  "status": "published",     // 可选，文章状态
  "isTop": true,              // 可选，是否置顶
  "isOriginal": false,        // 可选，是否原创
  "originalUrl": "新的原文链接", // 可选，原文链接，非原创时必填
  "author": "新作者",         // 可选，作者
  "source": "新来源",         // 可选，来源
  "allowComment": false,      // 可选，是否允许评论
  "seoKeywords": "新SEO关键词", // 可选，SEO关键词
  "seoDescription": "新SEO描述" // 可选，SEO描述
}
```
- **响应参数**: 同发布文章接口

### 3. 删除文章

- **接口路径**: `DELETE /auth-api/article`
- **接口描述**: 删除一篇文章
- **权限要求**: 需要登录认证，需要是文章发布者或管理员
- **请求参数**:
```json
{
  "id": 1                     // 必填，要删除的文章ID
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 4. 获取文章详情

- **接口路径**: `GET /public-api/article`
- **接口描述**: 获取文章详情
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，文章ID
}
```
- **响应参数**: 同发布文章接口

### 5. 获取文章列表

- **接口路径**: `GET /public-api/article/list`
- **接口描述**: 获取文章列表
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "cid": 1,                   // 可选，分类ID
  "tag": "标签",              // 可选，标签
  "memberId": 1001,           // 可选，发布者ID
  "status": "published",      // 可选，文章状态
  "isTop": false,             // 可选，是否只返回置顶文章
  "isOriginal": true,         // 可选，是否只返回原创文章
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), viewNum(浏览数), likeNum(点赞数), commentNum(评论数)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 100,               // 总记录数
  "list": [                   // 文章列表
    {
      // 同发布文章接口的响应参数
    }
  ]
}
```

### 6. 获取用户文章列表

- **接口路径**: `GET /auth-api/member/article/list`
- **接口描述**: 获取当前登录用户的文章列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "status": "published",      // 可选，文章状态
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
  "list": [                   // 文章列表
    {
      // 同发布文章接口的响应参数
    }
  ]
}
```

### 7. 置顶文章

- **接口路径**: `PUT /auth-api/article/top`
- **接口描述**: 置顶或取消置顶文章
- **权限要求**: 需要登录认证，需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，文章ID
  "isTop": true               // 必填，是否置顶
}
```
- **响应参数**:
```json
{
  "success": true             // 设置是否成功
}
```

## 资讯管理接口

### 1. 发布资讯

- **接口路径**: `POST /auth-api/news`
- **接口描述**: 发布一条新资讯
- **权限要求**: 需要登录认证，需要管理员权限
- **请求参数**:
```json
{
  "title": "资讯标题",         // 必填，资讯标题
  "summary": "资讯摘要",       // 必填，资讯摘要
  "content": "资讯内容",       // 必填，资讯内容
  "cover": "封面图片URL",     // 必填，资讯封面图片URL
  "cidList": [1, 2, 3],      // 可选，资讯分类ID列表
  "tags": ["标签1", "标签2"], // 可选，资讯标签列表
  "status": "published",     // 可选，资讯状态，默认为published
  "isTop": false,             // 可选，是否置顶，默认为false
  "source": "来源",           // 可选，来源
  "author": "作者",           // 可选，作者
  "publishTime": "2023-05-01 12:00:00", // 可选，发布时间，默认为当前时间
  "seoKeywords": "SEO关键词", // 可选，SEO关键词
  "seoDescription": "SEO描述" // 可选，SEO描述
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 资讯ID
  "title": "资讯标题",         // 资讯标题
  "summary": "资讯摘要",       // 资讯摘要
  "content": "资讯内容",       // 资讯内容
  "cover": "封面图片URL",     // 资讯封面图片URL
  "cidList": [1, 2, 3],      // 资讯分类ID列表
  "categoryList": [           // 资讯分类信息
    {
      "id": 1,
      "name": "分类名称"
    }
  ],
  "tags": ["标签1", "标签2"], // 资讯标签列表
  "status": "published",     // 资讯状态
  "isTop": false,             // 是否置顶
  "source": "来源",           // 来源
  "author": "作者",           // 作者
  "publishTime": "2023-05-01 12:00:00", // 发布时间
  "seoKeywords": "SEO关键词", // SEO关键词
  "seoDescription": "SEO描述", // SEO描述
  "viewNum": 0,               // 浏览数量
  "memberId": 1001,           // 发布者ID
  "member": {                 // 发布者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 修改资讯

- **接口路径**: `PUT /auth-api/news`
- **接口描述**: 修改已有资讯
- **权限要求**: 需要登录认证，需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，资讯ID
  "title": "修改后的资讯标题", // 可选，资讯标题
  "summary": "修改后的资讯摘要", // 可选，资讯摘要
  "content": "修改后的资讯内容", // 可选，资讯内容
  "cover": "修改后的封面图片URL", // 可选，资讯封面图片URL
  "cidList": [1, 2, 3],      // 可选，资讯分类ID列表
  "tags": ["新标签1", "新标签2"], // 可选，资讯标签列表
  "status": "published",     // 可选，资讯状态
  "isTop": true,              // 可选，是否置顶
  "source": "新来源",         // 可选，来源
  "author": "新作者",         // 可选，作者
  "publishTime": "2023-05-01 12:00:00", // 可选，发布时间
  "seoKeywords": "新SEO关键词", // 可选，SEO关键词
  "seoDescription": "新SEO描述" // 可选，SEO描述
}
```
- **响应参数**: 同发布资讯接口

### 3. 删除资讯

- **接口路径**: `DELETE /auth-api/news`
- **接口描述**: 删除一条资讯
- **权限要求**: 需要登录认证，需要管理员权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，要删除的资讯ID
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 4. 获取资讯详情

- **接口路径**: `GET /public-api/news`
- **接口描述**: 获取资讯详情
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，资讯ID
}
```
- **响应参数**: 同发布资讯接口

### 5. 获取资讯列表

- **接口路径**: `GET /public-api/news/list`
- **接口描述**: 获取资讯列表
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "cid": 1,                   // 可选，分类ID
  "tag": "标签",              // 可选，标签
  "status": "published",      // 可选，资讯状态
  "isTop": false,             // 可选，是否只返回置顶资讯
  "orderColumn": "publishTime", // 可选，排序字段，可选值：publishTime(发布时间), viewNum(浏览数)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 资讯列表
    {
      // 同发布资讯接口的响应参数
    }
  ]
}
```

### 6. 置顶资讯

- **接口路径**: `PUT /auth-api/news/top`
- **接口描述**: 置顶或取消置顶资讯
- **权限要求**: 需要登录认证，需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，资讯ID
  "isTop": true               // 必填，是否置顶
}
```
- **响应参数**:
```json
{
  "success": true             // 设置是否成功
}
```

## 公告管理接口

### 1. 发布公告

- **接口路径**: `POST /auth-api/announcement`
- **接口描述**: 发布一条新公告
- **权限要求**: 需要登录认证，需要管理员权限
- **请求参数**:
```json
{
  "title": "公告标题",         // 必填，公告标题
  "content": "公告内容",       // 必填，公告内容
  "type": "system",           // 必填，公告类型：system(系统公告), activity(活动公告), maintenance(维护公告)
  "level": "normal",          // 必填，公告级别：normal(普通), important(重要), urgent(紧急)
  "status": "published",     // 可选，公告状态，默认为published
  "startTime": "2023-05-01 12:00:00", // 可选，开始时间，默认为当前时间
  "endTime": "2023-05-31 23:59:59",   // 可选，结束时间，默认为一个月后
  "isTop": false,             // 可选，是否置顶，默认为false
  "targetType": "all",        // 可选，目标类型：all(所有用户), vip(VIP用户), member(普通用户)
  "memberIdList": [1001, 1002] // 可选，指定用户ID列表，targetType为specified时必填
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 公告ID
  "title": "公告标题",         // 公告标题
  "content": "公告内容",       // 公告内容
  "type": "system",           // 公告类型
  "level": "normal",          // 公告级别
  "status": "published",     // 公告状态
  "startTime": "2023-05-01 12:00:00", // 开始时间
  "endTime": "2023-05-31 23:59:59",   // 结束时间
  "isTop": false,             // 是否置顶
  "targetType": "all",        // 目标类型
  "memberIdList": [1001, 1002], // 指定用户ID列表
  "viewNum": 0,               // 浏览数量
  "memberId": 1001,           // 发布者ID
  "member": {                 // 发布者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 修改公告

- **接口路径**: `PUT /auth-api/announcement`
- **接口描述**: 修改已有公告
- **权限要求**: 需要登录认证，需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，公告ID
  "title": "修改后的公告标题", // 可选，公告标题
  "content": "修改后的公告内容", // 可选，公告内容
  "type": "activity",         // 可选，公告类型
  "level": "important",      // 可选，公告级别
  "status": "published",     // 可选，公告状态
  "startTime": "2023-05-01 12:00:00", // 可选，开始时间
  "endTime": "2023-05-31 23:59:59",   // 可选，结束时间
  "isTop": true,              // 可选，是否置顶
  "targetType": "vip",        // 可选，目标类型
  "memberIdList": [1001, 1002] // 可选，指定用户ID列表
}
```
- **响应参数**: 同发布公告接口

### 3. 删除公告

- **接口路径**: `DELETE /auth-api/announcement`
- **接口描述**: 删除一条公告
- **权限要求**: 需要登录认证，需要管理员权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，要删除的公告ID
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 4. 获取公告详情

- **接口路径**: `GET /public-api/announcement`
- **接口描述**: 获取公告详情
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，公告ID
}
```
- **响应参数**: 同发布公告接口

### 5. 获取公告列表

- **接口路径**: `GET /public-api/announcement/list`
- **接口描述**: 获取公告列表
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "type": "system",           // 可选，公告类型
  "level": "important",       // 可选，公告级别
  "status": "published",      // 可选，公告状态
  "isTop": false,             // 可选，是否只返回置顶公告
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), startTime(开始时间), level(级别)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 30,                // 总记录数
  "list": [                   // 公告列表
    {
      // 同发布公告接口的响应参数
    }
  ]
}
```

### 6. 置顶公告

- **接口路径**: `PUT /auth-api/announcement/top`
- **接口描述**: 置顶或取消置顶公告
- **权限要求**: 需要登录认证，需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，公告ID
  "isTop": true               // 必填，是否置顶
}
```
- **响应参数**:
```json
{
  "success": true             // 设置是否成功
}
```

## 分类管理接口

### 1. 获取分类列表

- **接口路径**: `GET /public-api/category/list`
- **接口描述**: 获取分类列表
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "type": "article",          // 必填，分类类型：article(文章), news(资讯)
  "isShow": true,             // 可选，是否显示
  "level": 1,                 // 可选，分类级别
  "pid": 0                    // 可选，父级ID，0表示顶级分类
}
```
- **响应参数**:
```json
[
  {
    "id": 1,                  // 分类ID
    "name": "分类名称",        // 分类名称
    "type": "article",        // 分类类型
    "sortOrder": 1,           // 排序序号
    "isShow": true,           // 是否显示
    "level": 1,               // 分类级别
    "pid": 0,                 // 父级ID
    "children": [              // 子分类列表
      {
        "id": 2,
        "name": "子分类名称",
        // 其他字段同父分类
      }
    ],
    "createTime": "2023-05-01 12:00:00",  // 创建时间
    "updateTime": "2023-05-02 13:00:00"   // 更新时间
  }
]
```

### 2. 获取分类详情

- **接口路径**: `GET /public-api/category`
- **接口描述**: 获取分类详情
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，分类ID
}
```
- **响应参数**: 同获取分类列表中的单个分类对象

### 3. 添加分类

- **接口路径**: `POST /auth-api/category`
- **接口描述**: 添加一个新的分类
- **权限要求**: 需要登录认证，需要管理员权限
- **请求参数**:
```json
{
  "type": "article",          // 必填，分类类型
  "pid": 0,                   // 必填，父级分类ID，不填为0表示顶级分类
  "name": "分类名称",         // 必填，分类名称
  "sortOrder": 1,             // 必填，排序序号
  "isShow": true              // 必填，是否显示
}
```
- **响应参数**: 同获取分类详情

### 4. 修改分类

- **接口路径**: `PUT /auth-api/category`
- **接口描述**: 修改已有分类
- **权限要求**: 需要登录认证，需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，分类ID
  "type": "article",          // 可选，分类类型
  "pid": 0,                   // 可选，父级分类ID
  "name": "修改后的分类名称", // 可选，分类名称
  "sortOrder": 1,             // 可选，排序序号
  "isShow": true              // 可选，是否显示
}
```
- **响应参数**: 同获取分类详情

### 5. 删除分类

- **接口路径**: `DELETE /auth-api/category`
- **接口描述**: 删除一个分类
- **权限要求**: 需要登录认证，需要管理员权限
- **请求参数**:
```json
{
  "id": 1                     // 必填，要删除的分类ID
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

## 数据模型

### 文章状态枚举

- `draft`: 草稿
- `published`: 已发布
- `offline`: 已下线

### 资讯状态枚举

- `draft`: 草稿
- `published`: 已发布
- `offline`: 已下线

### 公告状态枚举

- `draft`: 草稿
- `published`: 已发布
- `offline`: 已下线

### 公告类型枚举

- `system`: 系统公告
- `activity`: 活动公告
- `maintenance`: 维护公告

### 公告级别枚举

- `normal`: 普通
- `important`: 重要
- `urgent`: 紧急

### 公告目标类型枚举

- `all`: 所有用户
- `vip`: VIP用户
- `member`: 普通用户
- `specified`: 指定用户

### 分类类型枚举

- `article`: 文章
- `news`: 资讯
