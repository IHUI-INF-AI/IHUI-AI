# cloud-learning-resource-service 资源服务

## 概述

资源服务主要负责处理学习资源相关的业务功能，包括资源上传、资源管理、资源分类等。

## 资源管理接口

### 1. 上传资源

- **接口路径**: `POST /auth-api/resource/upload`
- **接口描述**: 上传学习资源
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "file": "资源文件",        // 必填，资源文件
  "type": "video",          // 必填，资源类型
  "categoryId": 1,          // 可选，分类ID
  "title": "资源标题",       // 必填，资源标题
  "description": "资源描述", // 可选，资源描述
  "tags": ["标签1", "标签2"] // 可选，标签列表
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 资源ID
  "title": "资源标题",       // 资源标题
  "type": "video",           // 资源类型
  "url": "资源URL",          // 资源访问URL
  "size": 1024000,           // 资源大小（字节）
  "duration": 3600,          // 资源时长（秒，仅视频/音频）
  "format": "mp4",          // 资源格式
  "thumbnail": "缩略图URL",  // 缩略图URL
  "status": "uploaded",     // 资源状态
  "memberId": 1001,          // 上传者ID
  "categoryId": 1,           // 分类ID
  "tags": ["标签1", "标签2"], // 标签列表
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 获取资源列表

- **接口路径**: `GET /auth-api/resource/list`
- **接口描述**: 获取资源列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "type": "video",           // 可选，资源类型
  "categoryId": 1,            // 可选，分类ID
  "keyword": "搜索关键字",     // 可选，搜索关键字
  "status": "published",     // 可选，资源状态
  "memberId": 1001           // 可选，上传者ID
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 100,               // 总记录数
  "list": [                   // 资源列表
    {
      "id": 1,                // 资源ID
      "title": "资源标题",     // 资源标题
      "type": "video",        // 资源类型
      "url": "资源URL",       // 资源访问URL
      "size": 1024000,        // 资源大小
      "duration": 3600,       // 资源时长
      "format": "mp4",       // 资源格式
      "thumbnail": "缩略图URL", // 缩略图URL
      "status": "published", // 资源状态
      "memberId": 1001,       // 上传者ID
      "categoryId": 1,        // 分类ID
      "viewCount": 100,       // 浏览数
      "downloadCount": 50,    // 下载数
      "likeCount": 20,        // 点赞数
      "createTime": "2023-05-01 12:00:00"  // 创建时间
    }
  ]
}
```

### 3. 获取资源详情

- **接口路径**: `GET /auth-api/resource/{id}`
- **接口描述**: 获取资源详情
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，资源ID，通过路径参数传递
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 资源ID
  "title": "资源标题",       // 资源标题
  "type": "video",           // 资源类型
  "url": "资源URL",          // 资源访问URL
  "size": 1024000,           // 资源大小
  "duration": 3600,          // 资源时长
  "format": "mp4",          // 资源格式
  "thumbnail": "缩略图URL",  // 缩略图URL
  "description": "资源描述",  // 资源描述
  "status": "published",     // 资源状态
  "memberId": 1001,          // 上传者ID
  "categoryId": 1,           // 分类ID
  "tags": ["标签1", "标签2"], // 标签列表
  "viewCount": 100,          // 浏览数
  "downloadCount": 50,       // 下载数
  "likeCount": 20,           // 点赞数
  "member": {                // 上传者信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "category": {              // 分类信息
    "id": 1,
    "name": "分类名称"
  },
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 4. 更新资源信息

- **接口路径**: `PUT /auth-api/resource/{id}`
- **接口描述**: 更新资源信息
- **权限要求**: 需要登录认证（只能更新自己的资源）
- **请求参数**:
```json
{
  "id": 1,                    // 必填，资源ID，通过路径参数传递
  "title": "新标题",         // 可选，新标题
  "description": "新描述",    // 可选，新描述
  "categoryId": 2,           // 可选，新分类ID
  "tags": ["新标签1", "新标签2"] // 可选，新标签列表
}
```
- **响应参数**: 同获取资源详情

### 5. 删除资源

- **接口路径**: `DELETE /auth-api/resource/{id}`
- **接口描述**: 删除资源
- **权限要求**: 需要登录认证（只能删除自己的资源）
- **请求参数**:
```json
{
  "id": 1                     // 必填，资源ID，通过路径参数传递
}
```
- **响应参数**:
```json
{
  "success": true             // 删除是否成功
}
```

### 6. 下载资源

- **接口路径**: `GET /auth-api/resource/{id}/download`
- **接口描述**: 下载资源
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，资源ID，通过路径参数传递
}
```
- **响应参数**: 返回资源文件流

## 资源分类接口

### 1. 获取分类列表

- **接口路径**: `GET /auth-api/resource/category/list`
- **接口描述**: 获取资源分类列表
- **权限要求**: 需要登录认证
- **请求参数**: 无
- **响应参数**:
```json
[
  {
    "id": 1,                // 分类ID
    "name": "视频资源",      // 分类名称
    "type": "video",        // 资源类型
    "description": "视频学习资源", // 分类描述
    "icon": "video-icon",   // 分类图标
    "sortOrder": 1,          // 排序序号
    "status": "active",     // 状态
    "createTime": "2023-05-01 12:00:00"  // 创建时间
  }
]
```

### 2. 创建分类

- **接口路径**: `POST /auth-api/resource/category`
- **接口描述**: 创建资源分类（管理员权限）
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "name": "新分类",          // 必填，分类名称
  "type": "document",       // 必填，资源类型
  "description": "分类描述", // 可选，分类描述
  "icon": "doc-icon",       // 可选，分类图标
  "sortOrder": 1            // 必填，排序序号
}
```
- **响应参数**: 同获取分类列表中的单个分类对象

## 数据模型

### 资源类型枚举
- `video`: 视频
- `audio`: 音频
- `document`: 文档
- `image`: 图片
- `other`: 其他

### 资源状态枚举
- `uploaded`: 已上传
- `processing`: 处理中
- `published`: 已发布
- `hidden`: 隐藏
- `deleted`: 已删除

### 资源格式枚举
- `mp4`: MP4视频
- `mp3`: MP3音频
- `pdf`: PDF文档
- `doc`: Word文档
- `ppt`: PowerPoint文档
- `jpg`: JPEG图片
- `png`: PNG图片