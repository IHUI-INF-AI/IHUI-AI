# cloud-learning-auth-service 权限认证服务

## 概述

权限认证服务主要负责处理用户认证、授权和权限管理等功能，是整个系统的安全基础。

## 用户认证接口

### 1. 用户登录

- **接口路径**: `POST /auth/login`
- **接口描述**: 用户登录接口
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "username": "用户名",        // 必填，用户登录名
  "password": "密码",         // 必填，用户密码
  "captcha": "验证码",        // 必填，验证码
  "captchaKey": "验证码Key"   // 必填，验证码Key
}
```
- **响应参数**:
```json
{
  "token": "用户令牌",         // JWT令牌
  "refreshToken": "刷新令牌",  // 刷新令牌
  "expiresIn": 3600,          // 令牌过期时间（秒）
  "tokenType": "Bearer",      // 令牌类型
  "memberId": 1001,           // 用户ID
  "username": "用户名",        // 用户名
  "nickname": "用户昵称",      // 用户昵称
  "avatar": "头像URL",        // 用户头像
  "roles": ["ROLE_USER"],     // 用户角色列表
  "permissions": ["user:view"] // 用户权限列表
}
```

### 2. 用户注册

- **接口路径**: `POST /auth/register`
- **接口描述**: 用户注册接口
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "username": "用户名",        // 必填，用户登录名
  "password": "密码",         // 必填，用户密码
  "confirmPassword": "确认密码", // 必填，确认密码
  "email": "电子邮箱",        // 必填，电子邮箱
  "phone": "手机号码",        // 必填，手机号码
  "nickname": "用户昵称",      // 可选，用户昵称
  "captcha": "验证码",        // 必填，验证码
  "captchaKey": "验证码Key"   // 必填，验证码Key
}
```
- **响应参数**:
```json
{
  "memberId": 1001,           // 用户ID
  "username": "用户名",        // 用户名
  "nickname": "用户昵称",      // 用户昵称
  "email": "电子邮箱",        // 电子邮箱
  "phone": "手机号码",        // 手机号码
  "status": "active",         // 用户状态
  "createTime": "2023-05-01 12:00:00"  // 注册时间
}
```

### 3. 刷新令牌

- **接口路径**: `POST /auth/refresh-token`
- **接口描述**: 刷新访问令牌
- **权限要求**: 无需权限（使用刷新令牌）
- **请求参数**:
```json
{
  "refreshToken": "刷新令牌"   // 必填，刷新令牌
}
```
- **响应参数**:
```json
{
  "token": "新用户令牌",       // 新JWT令牌
  "refreshToken": "新刷新令牌", // 新刷新令牌
  "expiresIn": 3600,          // 令牌过期时间（秒）
  "tokenType": "Bearer"       // 令牌类型
}
```

### 4. 用户登出

- **接口路径**: `POST /auth/logout`
- **接口描述**: 用户登出接口
- **权限要求**: 需要登录认证
- **请求参数**: 无
- **响应参数**:
```json
{
  "success": true             // 登出是否成功
}
```

### 5. 修改密码

- **接口路径**: `PUT /auth/password`
- **接口描述**: 修改用户密码
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "oldPassword": "原密码",    // 必填，原密码
  "newPassword": "新密码",    // 必填，新密码
  "confirmPassword": "确认新密码" // 必填，确认新密码
}
```
- **响应参数**:
```json
{
  "success": true             // 修改是否成功
}
```

### 6. 重置密码

- **接口路径**: `POST /auth/reset-password`
- **接口描述**: 重置用户密码
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "email": "电子邮箱",        // 必填，用户注册邮箱
  "captcha": "验证码",        // 必填，验证码
  "captchaKey": "验证码Key"   // 必填，验证码Key
}
```
- **响应参数**:
```json
{
  "success": true             // 重置请求是否成功
}
```

### 7. 确认重置密码

- **接口路径**: `POST /auth/confirm-reset-password`
- **接口描述**: 确认重置密码
- **权限要求**: 无需权限（使用重置令牌）
- **请求参数**:
```json
{
  "resetToken": "重置令牌",    // 必填，重置令牌
  "newPassword": "新密码",    // 必填，新密码
  "confirmPassword": "确认新密码" // 必填，确认新密码
}
```
- **响应参数**:
```json
{
  "success": true             // 重置是否成功
}
```

## 验证码接口

### 1. 获取验证码

- **接口路径**: `GET /auth/captcha`
- **接口描述**: 获取验证码图片
- **权限要求**: 无需权限
- **请求参数**: 无
- **响应参数**:
```json
{
  "captchaKey": "验证码Key",   // 验证码Key
  "captchaImage": "data:image/png;base64,..." // 验证码图片（Base64编码）
}
```

### 2. 发送短信验证码

- **接口路径**: `POST /auth/sms-captcha`
- **接口描述**: 发送短信验证码
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "phone": "手机号码",        // 必填，手机号码
  "type": "register"          // 必填，验证码类型：register(注册), reset(重置密码), login(登录)
}
```
- **响应参数**:
```json
{
  "success": true,            // 发送是否成功
  "message": "验证码已发送"    // 提示信息
}
```

### 3. 发送邮件验证码

- **接口路径**: `POST /auth/email-captcha`
- **接口描述**: 发送邮件验证码
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "email": "电子邮箱",        // 必填，电子邮箱
  "type": "register"          // 必填，验证码类型：register(注册), reset(重置密码), login(登录)
}
```
- **响应参数**:
```json
{
  "success": true,            // 发送是否成功
  "message": "验证码已发送"    // 提示信息
}
```

## 用户信息接口

### 1. 获取当前用户信息

- **接口路径**: `GET /auth/userinfo`
- **接口描述**: 获取当前登录用户信息
- **权限要求**: 需要登录认证
- **请求参数**: 无
- **响应参数**:
```json
{
  "memberId": 1001,           // 用户ID
  "username": "用户名",        // 用户名
  "nickname": "用户昵称",      // 用户昵称
  "email": "电子邮箱",        // 电子邮箱
  "phone": "手机号码",        // 手机号码
  "avatar": "头像URL",        // 用户头像
  "gender": "male",           // 性别：male(男), female(女), unknown(未知)
  "birthday": "1990-01-01",   // 生日
  "status": "active",         // 用户状态
  "roles": ["ROLE_USER"],     // 用户角色列表
  "permissions": ["user:view"] // 用户权限列表
}
```

### 2. 更新用户信息

- **接口路径**: `PUT /auth/userinfo`
- **接口描述**: 更新当前登录用户信息
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "nickname": "新用户昵称",    // 可选，用户昵称
  "avatar": "新头像URL",      // 可选，用户头像
  "gender": "male",           // 可选，性别：male(男), female(女), unknown(未知)
  "birthday": "1990-01-01",   // 可选，生日
  "signature": "个性签名"      // 可选，个性签名
}
```
- **响应参数**:
```json
{
  "memberId": 1001,           // 用户ID
  "username": "用户名",        // 用户名
  "nickname": "新用户昵称",    // 用户昵称
  "email": "电子邮箱",        // 电子邮箱
  "phone": "手机号码",        // 手机号码
  "avatar": "新头像URL",      // 用户头像
  "gender": "male",           // 性别
  "birthday": "1990-01-01",   // 生日
  "signature": "个性签名",     // 个性签名
  "status": "active",         // 用户状态
  "updateTime": "2023-05-02 13:00:00"  // 更新时间
}
```

## 权限管理接口

### 1. 获取角色列表

- **接口路径**: `GET /auth/roles`
- **接口描述**: 获取系统角色列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字"      // 可选，搜索关键字
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 20,                // 总记录数
  "list": [                   // 角色列表
    {
      "id": 1,                // 角色ID
      "name": "管理员",        // 角色名称
      "code": "ROLE_ADMIN",   // 角色代码
      "description": "系统管理员角色", // 角色描述
      "permissions": [        // 角色权限列表
        "user:view",
        "user:edit",
        "user:delete"
      ],
      "createTime": "2023-05-01 12:00:00",  // 创建时间
      "updateTime": "2023-05-02 13:00:00"   // 更新时间
    }
  ]
}
```

### 2. 获取权限列表

- **接口路径**: `GET /auth/permissions`
- **接口描述**: 获取系统权限列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字"      // 可选，搜索关键字
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 50,                // 总记录数
  "list": [                   // 权限列表
    {
      "id": 1,                // 权限ID
      "name": "查看用户",      // 权限名称
      "code": "user:view",     // 权限代码
      "description": "查看用户信息权限", // 权限描述
      "type": "menu",         // 权限类型：menu(菜单), button(按钮), api(API)
      "parentId": 0,           // 父权限ID
      "path": "/user/list",    // 权限路径
      "icon": "user-icon",     // 权限图标
      "sortOrder": 1,          // 排序序号
      "createTime": "2023-05-01 12:00:00",  // 创建时间
      "updateTime": "2023-05-02 13:00:00"   // 更新时间
    }
  ]
}
```

### 3. 检查权限

- **接口路径**: `GET /auth/check-permission`
- **接口描述**: 检查当前用户是否拥有指定权限
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "permission": "user:view"   // 必填，要检查的权限代码
}
```
- **响应参数**:
```json
{
  "hasPermission": true       // 是否拥有权限
}
```

## 数据模型

### 用户状态枚举

- `active`: 活跃
- `inactive`: 非活跃
- `locked`: 锁定
- `expired`: 已过期

### 性别枚举

- `male`: 男
- `female`: 女
- `unknown`: 未知

### 验证码类型枚举

- `register`: 注册
- `reset`: 重置密码
- `login`: 登录

### 权限类型枚举

- `menu`: 菜单
- `button`: 按钮
- `api`: API

## 错误码

| 错误码 | 错误信息 | 描述 |
|--------|----------|------|
| 400 | 请求参数错误 | 请求参数格式或内容不正确 |
| 401 | 未授权 | 用户未登录或token已过期 |
| 403 | 权限不足 | 用户没有权限执行该操作 |
| 404 | 资源不存在 | 请求的资源不存在 |
| 409 | 资源冲突 | 资源已存在或状态冲突 |
| 422 | 请求参数验证失败 | 请求参数验证不通过 |
| 429 | 请求过于频繁 | 请求过于频繁，请稍后再试 |
| 500 | 服务器内部错误 | 服务器处理请求时发生错误 |
