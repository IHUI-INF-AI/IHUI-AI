# cloud-learning-oss-service OSS服务

## 概述

OSS服务主要负责管理平台上的文件存储，包括文件上传、文件下载、文件管理和CDN加速等功能。

## 文件上传接口

### 1. 获取上传凭证

- **接口路径**: `GET /auth-api/upload/token`
- **接口描述**: 获取文件上传凭证
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "type": "image",            // 必填，文件类型：image(图片), video(视频), audio(音频), document(文档)
  "purpose": "avatar",        // 必填，上传用途：avatar(头像), cover(封面), content(内容), attachment(附件)
  "fileName": "example.jpg",   // 必填，文件名
  "fileSize": 1024000        // 必填，文件大小（字节）
}
```
- **响应参数**:
```json
{
  "uploadId": "UPLOAD20230501001", // 上传ID
  "uploadUrl": "https://oss.example.com/upload", // 上传地址
  "token": "upload_token_string", // 上传凭证
  "policy": "upload_policy_base64", // 上传策略
  "signature": "upload_signature", // 上传签名
  "expireTime": "2023-05-01 13:00:00", // 过期时间
  "maxFileSize": 10485760    // 最大文件大小（字节）
}
```

### 2. 确认上传完成

- **接口路径**: `POST /auth-api/upload/confirm`
- **接口描述**: 确认文件上传完成
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "uploadId": "UPLOAD20230501001", // 必填，上传ID
  "fileName": "example.jpg",   // 必填，文件名
  "fileSize": 1024000,       // 必填，文件大小（字节）
  "fileType": "image/jpeg",    // 必填，文件MIME类型
  "fileHash": "file_hash_string" // 必填，文件哈希值
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 文件ID
  "fileName": "example.jpg",   // 文件名
  "originalName": "原始文件名.jpg", // 原始文件名
  "fileType": "image/jpeg",    // 文件MIME类型
  "fileSize": 1024000,       // 文件大小（字节）
  "fileHash": "file_hash_string", // 文件哈希值
  "url": "https://cdn.example.com/files/1.jpg", // 文件URL
  "thumbnailUrl": "https://cdn.example.com/thumbnails/1.jpg", // 缩略图URL
  "type": "image",           // 文件类型
  "purpose": "avatar",        // 上传用途
  "memberId": 1001,           // 上传者ID
  "member": {                 // 上传者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 3. 分片上传初始化

- **接口路径**: `POST /auth-api/upload/multipart/init`
- **接口描述**: 初始化分片上传
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "type": "video",            // 必填，文件类型：image(图片), video(视频), audio(音频), document(文档)
  "purpose": "content",       // 必填，上传用途：avatar(头像), cover(封面), content(内容), attachment(附件)
  "fileName": "example.mp4",  // 必填，文件名
  "fileSize": 102400000,     // 必填，文件大小（字节）
  "chunkSize": 10485760       // 必填，分片大小（字节）
}
```
- **响应参数**:
```json
{
  "uploadId": "UPLOAD20230501001", // 上传ID
  "uploadUrl": "https://oss.example.com/upload", // 上传地址
  "token": "upload_token_string", // 上传凭证
  "policy": "upload_policy_base64", // 上传策略
  "signature": "upload_signature", // 上传签名
  "chunkNum": 10,            // 分片数量
  "chunkSize": 10485760,     // 分片大小（字节）
  "expireTime": "2023-05-01 13:00:00" // 过期时间
}
```

### 4. 上传分片

- **接口路径**: `POST /auth-api/upload/multipart/chunk`
- **接口描述**: 上传文件分片
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "uploadId": "UPLOAD20230501001", // 必填，上传ID
  "chunkIndex": 1,           // 必填，分片索引（从1开始）
  "chunkData": "base64_encoded_chunk_data" // 必填，分片数据（Base64编码）
}
```
- **响应参数**:
```json
{
  "success": true,            // 上传是否成功
  "chunkIndex": 1,           // 分片索引
  "chunkHash": "chunk_hash_string" // 分片哈希值
}
```

### 5. 完成分片上传

- **接口路径**: `POST /auth-api/upload/multipart/complete`
- **接口描述**: 完成分片上传
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "uploadId": "UPLOAD20230501001", // 必填，上传ID
  "fileName": "example.mp4",  // 必填，文件名
  "fileSize": 102400000,     // 必填，文件大小（字节）
  "fileType": "video/mp4",    // 必填，文件MIME类型
  "chunkHashList": [         // 必填，分片哈希列表
    "chunk_hash_string_1",
    "chunk_hash_string_2"
  ]
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 文件ID
  "fileName": "example.mp4",   // 文件名
  "originalName": "原始文件名.mp4", // 原始文件名
  "fileType": "video/mp4",    // 文件MIME类型
  "fileSize": 102400000,     // 文件大小（字节）
  "fileHash": "file_hash_string", // 文件哈希值
  "url": "https://cdn.example.com/files/1.mp4", // 文件URL
  "thumbnailUrl": "https://cdn.example.com/thumbnails/1.jpg", // 缩略图URL
  "duration": 1800,           // 视频时长（秒）
  "resolution": "1920x1080",   // 视频分辨率
  "type": "video",           // 文件类型
  "purpose": "content",       // 上传用途
  "memberId": 1001,           // 上传者ID
  "member": {                 // 上传者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

## 文件管理接口

### 1. 获取文件详情

- **接口路径**: `GET /auth-api/file`
- **接口描述**: 获取文件详情
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，文件ID
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 文件ID
  "fileName": "example.jpg",   // 文件名
  "originalName": "原始文件名.jpg", // 原始文件名
  "fileType": "image/jpeg",    // 文件MIME类型
  "fileSize": 1024000,       // 文件大小（字节）
  "fileHash": "file_hash_string", // 文件哈希值
  "url": "https://cdn.example.com/files/1.jpg", // 文件URL
  "thumbnailUrl": "https://cdn.example.com/thumbnails/1.jpg", // 缩略图URL
  "type": "image",           // 文件类型
  "purpose": "avatar",        // 上传用途
  "memberId": 1001,           // 上传者ID
  "member": {                 // 上传者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "downloadNum": 10,         // 下载次数
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 获取文件列表

- **接口路径**: `GET /auth-api/file/list`
- **接口描述**: 获取文件列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "type": "image",            // 可选，文件类型
  "purpose": "avatar",        // 可选，上传用途
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), fileSize(文件大小), downloadNum(下载次数)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 文件列表
    {
      // 同获取文件详情接口的响应参数
    }
  ]
}
```

### 3. 删除文件

- **接口路径**: `DELETE /auth-api/file`
- **接口描述**: 删除文件
- **权限要求**: 需要登录认证，需要是文件上传者或管理员
- **请求参数**:
```json
{
  "id": 1                     // 必填，要删除的文件ID
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 4. 批量删除文件

- **接口路径**: `DELETE /auth-api/file/batch`
- **接口描述**: 批量删除文件
- **权限要求**: 需要登录认证，需要是文件上传者或管理员
- **请求参数**:
```json
{
  "idList": [1, 2, 3]       // 必填，文件ID列表
}
```
- **响应参数**:
```json
{
  "success": true,            // 删除是否成功
  "successNum": 3,           // 成功删除数量
  "failNum": 0              // 失败删除数量
}
```

### 5. 获取所有文件列表

- **接口路径**: `GET /admin-api/file/list`
- **接口描述**: 获取所有文件列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "type": "image",            // 可选，文件类型
  "purpose": "avatar",        // 可选，上传用途
  "memberId": 1001,           // 可选，上传者ID
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), fileSize(文件大小), downloadNum(下载次数)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 100,               // 总记录数
  "list": [                   // 文件列表
    {
      // 同获取文件详情接口的响应参数
    }
  ]
}
```

## CDN接口

### 1. 刷新CDN缓存

- **接口路径**: `POST /admin-api/cdn/refresh`
- **接口描述**: 刷新CDN缓存
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "urls": [                   // 必填，URL列表
    "https://cdn.example.com/files/1.jpg",
    "https://cdn.example.com/files/2.jpg"
  ]
}
```
- **响应参数**:
```json
{
  "taskId": "CDN_REFRESH20230501001", // 任务ID
  "urlNum": 2,               // URL数量
  "status": "processing",      // 刷新状态：processing(处理中), completed(已完成), failed(失败)
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 查询CDN刷新状态

- **接口路径**: `GET /admin-api/cdn/refresh/status`
- **接口描述**: 查询CDN刷新状态
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "taskId": "CDN_REFRESH20230501001" // 必填，任务ID
}
```
- **响应参数**:
```json
{
  "taskId": "CDN_REFRESH20230501001", // 任务ID
  "urlNum": 2,               // URL数量
  "successNum": 2,            // 成功数量
  "failNum": 0,              // 失败数量
  "status": "completed",      // 刷新状态
  "failList": [              // 失败列表
    {
      "url": "https://cdn.example.com/files/3.jpg",
      "reason": "URL不存在"
    }
  ],
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-01 12:30:00"   // 更新时间
}
```

### 3. 预热CDN缓存

- **接口路径**: `POST /admin-api/cdn/preload`
- **接口描述**: 预热CDN缓存
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "urls": [                   // 必填，URL列表
    "https://cdn.example.com/files/1.jpg",
    "https://cdn.example.com/files/2.jpg"
  ]
}
```
- **响应参数**:
```json
{
  "taskId": "CDN_PRELOAD20230501001", // 任务ID
  "urlNum": 2,               // URL数量
  "status": "processing",      // 预热状态：processing(处理中), completed(已完成), failed(失败)
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 4. 查询CDN预热状态

- **接口路径**: `GET /admin-api/cdn/preload/status`
- **接口描述**: 查询CDN预热状态
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "taskId": "CDN_PRELOAD20230501001" // 必填，任务ID
}
```
- **响应参数**:
```json
{
  "taskId": "CDN_PRELOAD20230501001", // 任务ID
  "urlNum": 2,               // URL数量
  "successNum": 2,            // 成功数量
  "failNum": 0,              // 失败数量
  "status": "completed",      // 预热状态
  "failList": [              // 失败列表
    {
      "url": "https://cdn.example.com/files/3.jpg",
      "reason": "URL不存在"
    }
  ],
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-01 12:30:00"   // 更新时间
}
```

### 5. 获取CDN流量统计

- **接口路径**: `GET /admin-api/cdn/traffic`
- **接口描述**: 获取CDN流量统计
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "startTime": "2023-05-01",  // 必填，开始时间
  "endTime": "2023-05-31",    // 必填，结束时间
  "domain": "cdn.example.com" // 可选，域名
}
```
- **响应参数**:
```json
{
  "totalTraffic": 1024000000,  // 总流量（字节）
  "domain": "cdn.example.com", // 域名
  "statisticsList": [         // 统计列表
    {
      "date": "2023-05-01",   // 日期
      "traffic": 102400000    // 流量（字节）
    }
  ]
}
```

## 存储统计接口

### 1. 获取存储统计

- **接口路径**: `GET /admin-api/storage/statistics`
- **接口描述**: 获取存储统计
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "type": "image"            // 可选，文件类型
}
```
- **响应参数**:
```json
{
  "totalSize": 102400000000,   // 总大小（字节）
  "totalNum": 1000,           // 总数量
  "typeStatistics": [         // 类型统计
    {
      "type": "image",       // 文件类型
      "size": 51200000000,  // 大小（字节）
      "num": 500            // 数量
    },
    {
      "type": "video",       // 文件类型
      "size": 51200000000,  // 大小（字节）
      "num": 500            // 数量
    }
  ],
  "dateStatistics": [         // 日期统计
    {
      "date": "2023-05-01", // 日期
      "size": 1024000000,   // 大小（字节）
      "num": 10            // 数量
    }
  ]
}
```

### 2. 获取用户存储统计

- **接口路径**: `GET /auth-api/storage/statistics`
- **接口描述**: 获取当前登录用户的存储统计
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "type": "image"            // 可选，文件类型
}
```
- **响应参数**:
```json
{
  "totalSize": 10240000,      // 总大小（字节）
  "totalNum": 100,            // 总数量
  "typeStatistics": [         // 类型统计
    {
      "type": "image",       // 文件类型
      "size": 5120000,      // 大小（字节）
      "num": 50             // 数量
    },
    {
      "type": "video",       // 文件类型
      "size": 5120000,      // 大小（字节）
      "num": 50             // 数量
    }
  ],
  "dateStatistics": [         // 日期统计
    {
      "date": "2023-05-01", // 日期
      "size": 1024000,     // 大小（字节）
      "num": 1              // 数量
    }
  ]
}
```

## 数据模型

### 文件类型枚举

- `image`: 图片
- `video`: 视频
- `audio`: 音频
- `document`: 文档

### 上传用途枚举

- `avatar`: 头像
- `cover`: 封面
- `content`: 内容
- `attachment`: 附件
