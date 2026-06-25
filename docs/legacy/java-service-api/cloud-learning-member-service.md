# cloud-learning-member-service 会员服务

## 概述

会员服务主要负责管理平台上的用户信息、会员等级、会员权益和会员卡等功能。

## 用户信息接口

### 1. 获取用户详情

- **接口路径**: `GET /auth-api/member/detail`
- **接口描述**: 获取当前登录用户的详细信息
- **权限要求**: 需要登录认证
- **请求参数**: 无
- **响应参数**:
```json
{
  "id": 1001,                 // 用户ID
  "username": "用户名",        // 用户名
  "nickname": "用户昵称",      // 用户昵称
  "avatar": "头像URL",        // 用户头像
  "gender": "male",           // 性别：male(男), female(女), unknown(未知)
  "birthday": "1990-01-01",   // 生日
  "email": "电子邮箱",        // 电子邮箱
  "phone": "手机号码",        // 手机号码
  "signature": "个性签名",     // 个性签名
  "levelId": 1,              // 会员等级ID
  "level": {                 // 会员等级信息
    "id": 1,
    "name": "普通会员",
    "icon": "等级图标URL",
    "privileges": ["特权1", "特权2"]
  },
  "point": 1000,             // 积分
  "balance": 100.00,         // 余额
  "isVip": true,             // 是否是VIP
  "vipExpireTime": "2023-12-31 23:59:59", // VIP到期时间
  "status": "active",         // 用户状态
  "registerTime": "2023-01-01 12:00:00", // 注册时间
  "lastLoginTime": "2023-05-01 12:00:00", // 最后登录时间
  "loginCount": 100,         // 登录次数
  "studyTime": 86400,        // 学习时长（秒）
  "courseNum": 10,           // 学习课程数量
  "certificateNum": 5        // 证书数量
}
```

### 2. 更新用户信息

- **接口路径**: `PUT /auth-api/member/info`
- **接口描述**: 更新用户基本信息
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "nickname": "新用户昵称",    // 可选，用户昵称
  "avatar": "新头像URL",      // 可选，用户头像
  "gender": "female",         // 可选，性别
  "birthday": "1990-01-01",   // 可选，生日
  "signature": "新个性签名"    // 可选，个性签名
}
```
- **响应参数**:
```json
{
  "success": true,            // 更新是否成功
  "member": {               // 更新后的用户信息
    // 同获取用户详情接口中的用户信息
  }
}
```

### 3. 修改邮箱

- **接口路径**: `PUT /auth-api/member/email`
- **接口描述**: 修改用户邮箱
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "email": "新电子邮箱",      // 必填，新邮箱
  "captcha": "验证码",        // 必填，邮箱验证码
  "captchaKey": "验证码Key"   // 必填，验证码Key
}
```
- **响应参数**:
```json
{
  "success": true            // 修改是否成功
}
```

### 4. 修改手机号

- **接口路径**: `PUT /auth-api/member/phone`
- **接口描述**: 修改用户手机号
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "phone": "新手机号码",      // 必填，新手机号
  "captcha": "验证码",        // 必填，短信验证码
  "captchaKey": "验证码Key"   // 必填，验证码Key
}
```
- **响应参数**:
```json
{
  "success": true            // 修改是否成功
}
```

### 5. 获取用户列表

- **接口路径**: `GET /admin-api/member/list`
- **接口描述**: 获取用户列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "levelId": 1,               // 可选，会员等级ID
  "isVip": true,              // 可选，是否是VIP
  "status": "active",          // 可选，用户状态
  "registerStartTime": "2023-05-01", // 可选，注册开始时间
  "registerEndTime": "2023-05-31",   // 可选，注册结束时间
  "lastLoginStartTime": "2023-05-01", // 可选，最后登录开始时间
  "lastLoginEndTime": "2023-05-31",   // 可选，最后登录结束时间
  "orderColumn": "registerTime", // 可选，排序字段，可选值：registerTime(注册时间), lastLoginTime(最后登录时间), point(积分), balance(余额), studyTime(学习时长)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 1000,              // 总记录数
  "list": [                   // 用户列表
    {
      // 同获取用户详情接口中的用户信息
    }
  ]
}
```

### 6. 禁用/启用用户

- **接口路径**: `PUT /admin-api/member/status`
- **接口描述**: 禁用或启用用户
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1001,                // 必填，用户ID
  "status": "inactive"        // 必填，用户状态：active(启用), inactive(禁用), locked(锁定)
}
```
- **响应参数**:
```json
{
  "success": true            // 设置是否成功
}
```

## 会员等级接口

### 1. 获取会员等级列表

- **接口路径**: `GET /public-api/level/list`
- **接口描述**: 获取会员等级列表
- **权限要求**: 无需权限
- **请求参数**: 无
- **响应参数**:
```json
[
  {
    "id": 1,                  // 等级ID
    "name": "普通会员",        // 等级名称
    "icon": "等级图标URL",     // 等级图标
    "minPoint": 0,            // 最低积分要求
    "maxPoint": 999,          // 最高积分要求
    "privileges": [           // 等级特权列表
      {
        "id": 1,
        "name": "特权名称",
        "description": "特权描述",
        "icon": "特权图标URL"
      }
    ],
    "discount": 1.0,          // 折扣率
    "description": "等级描述",  // 等级描述
    "sortOrder": 1            // 排序序号
  }
]
```

### 2. 获取会员等级详情

- **接口路径**: `GET /public-api/level/{id}`
- **接口描述**: 获取会员等级详情
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "id": 1                    // 必填，等级ID，通过路径参数传递
}
```
- **响应参数**: 同获取会员等级列表中的单个等级对象

### 3. 添加会员等级

- **接口路径**: `POST /admin-api/level`
- **接口描述**: 添加一个新的会员等级
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "name": "新会员等级",       // 必填，等级名称
  "icon": "等级图标URL",     // 必填，等级图标
  "minPoint": 1000,          // 必填，最低积分要求
  "maxPoint": 9999,          // 必填，最高积分要求
  "privilegeIdList": [1, 2, 3], // 必填，特权ID列表
  "discount": 0.9,           // 必填，折扣率
  "description": "等级描述",   // 必填，等级描述
  "sortOrder": 2             // 必填，排序序号
}
```
- **响应参数**: 同获取会员等级详情

### 4. 修改会员等级

- **接口路径**: `PUT /admin-api/level`
- **接口描述**: 修改已有会员等级
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，等级ID
  "name": "修改后的会员等级",   // 可选，等级名称
  "icon": "修改后的等级图标URL", // 可选，等级图标
  "minPoint": 1000,          // 可选，最低积分要求
  "maxPoint": 9999,          // 可选，最高积分要求
  "privilegeIdList": [1, 2, 3], // 可选，特权ID列表
  "discount": 0.9,           // 可选，折扣率
  "description": "修改后的等级描述", // 可选，等级描述
  "sortOrder": 2             // 可选，排序序号
}
```
- **响应参数**: 同获取会员等级详情

### 5. 删除会员等级

- **接口路径**: `DELETE /admin-api/level/{id}`
- **接口描述**: 删除一个会员等级
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1                    // 必填，等级ID，通过路径参数传递
}
```
- **响应参数**:
```json
{
  "success": true            // 删除是否成功
}
```

## 会员特权接口

### 1. 获取会员特权列表

- **接口路径**: `GET /public-api/privilege/list`
- **接口描述**: 获取会员特权列表
- **权限要求**: 无需权限
- **请求参数**: 无
- **响应参数**:
```json
[
  {
    "id": 1,                  // 特权ID
    "name": "特权名称",        // 特权名称
    "description": "特权描述",  // 特权描述
    "icon": "特权图标URL",     // 特权图标
    "type": "discount",       // 特权类型：discount(折扣), free(免费), priority(优先), limit(限制解除)
    "value": "0.9",          // 特权值
    "unit": "比例",           // 单位
    "sortOrder": 1            // 排序序号
  }
]
```

### 2. 获取会员特权详情

- **接口路径**: `GET /public-api/privilege/{id}`
- **接口描述**: 获取会员特权详情
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "id": 1                    // 必填，特权ID，通过路径参数传递
}
```
- **响应参数**: 同获取会员特权列表中的单个特权对象

### 3. 添加会员特权

- **接口路径**: `POST /admin-api/privilege`
- **接口描述**: 添加一个新的会员特权
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "name": "新特权名称",       // 必填，特权名称
  "description": "特权描述",   // 必填，特权描述
  "icon": "特权图标URL",     // 必填，特权图标
  "type": "discount",       // 必填，特权类型
  "value": "0.8",          // 必填，特权值
  "unit": "比例",           // 必填，单位
  "sortOrder": 2            // 必填，排序序号
}
```
- **响应参数**: 同获取会员特权详情

### 4. 修改会员特权

- **接口路径**: `PUT /admin-api/privilege`
- **接口描述**: 修改已有会员特权
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，特权ID
  "name": "修改后的特权名称",   // 可选，特权名称
  "description": "修改后的特权描述", // 可选，特权描述
  "icon": "修改后的特权图标URL", // 可选，特权图标
  "type": "discount",       // 可选，特权类型
  "value": "0.8",          // 可选，特权值
  "unit": "比例",           // 可选，单位
  "sortOrder": 2            // 可选，排序序号
}
```
- **响应参数**: 同获取会员特权详情

### 5. 删除会员特权

- **接口路径**: `DELETE /admin-api/privilege/{id}`
- **接口描述**: 删除一个会员特权
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1                    // 必填，特权ID，通过路径参数传递
}
```
- **响应参数**:
```json
{
  "success": true            // 删除是否成功
}
```

## 会员卡接口

### 1. 获取会员卡列表

- **接口路径**: `GET /public-api/card/list`
- **接口描述**: 获取会员卡列表
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "type": "vip",             // 可选，会员卡类型
  "status": "on_sale"        // 可选，会员卡状态
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 20,                // 总记录数
  "list": [                   // 会员卡列表
    {
      "id": 1,                // 会员卡ID
      "name": "会员卡名称",    // 会员卡名称
      "description": "会员卡描述", // 会员卡描述
      "cover": "会员卡封面URL", // 会员卡封面
      "type": "vip",          // 会员卡类型：vip(VIP卡), point(积分卡), discount(折扣卡)
      "price": 99.00,         // 会员卡价格
      "originalPrice": 199.00, // 会员卡原价
      "validDays": 365,       // 有效天数
      "point": 1000,          // 赠送积分
      "discount": 0.8,        // 折扣率
      "privilegeList": [      // 特权列表
        {
          "id": 1,
          "name": "特权名称",
          "description": "特权描述"
        }
      ],
      "status": "on_sale",    // 会员卡状态：on_sale(在售), off_sale(下架), out_of_stock(售罄)
      "saleNum": 100,         // 销售数量
      "stockNum": 900,        // 库存数量
      "saleStartTime": "2023-05-01 00:00:00", // 销售开始时间
      "saleEndTime": "2023-05-31 23:59:59",   // 销售结束时间
      "createTime": "2023-05-01 12:00:00",  // 创建时间
      "updateTime": "2023-05-02 13:00:00"   // 更新时间
    }
  ]
}
```

### 2. 获取会员卡详情

- **接口路径**: `GET /public-api/card/{id}`
- **接口描述**: 获取会员卡详情
- **权限要求**: 无需权限
- **请求参数**:
```json
{
  "id": 1                    // 必填，会员卡ID，通过路径参数传递
}
```
- **响应参数**: 同获取会员卡列表中的单个会员卡对象

### 3. 添加会员卡

- **接口路径**: `POST /admin-api/card`
- **接口描述**: 添加一个新的会员卡
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "name": "新会员卡名称",     // 必填，会员卡名称
  "description": "会员卡描述",   // 必填，会员卡描述
  "cover": "会员卡封面URL",   // 必填，会员卡封面
  "type": "vip",            // 必填，会员卡类型
  "price": 99.00,           // 必填，会员卡价格
  "originalPrice": 199.00,   // 必填，会员卡原价
  "validDays": 365,         // 必填，有效天数
  "point": 1000,            // 可选，赠送积分
  "discount": 0.8,          // 可选，折扣率
  "privilegeIdList": [1, 2, 3], // 可选，特权ID列表
  "stockNum": 1000,         // 必填，库存数量
  "saleStartTime": "2023-05-01 00:00:00", // 必填，销售开始时间
  "saleEndTime": "2023-05-31 23:59:59"   // 必填，销售结束时间
}
```
- **响应参数**: 同获取会员卡详情

### 4. 修改会员卡

- **接口路径**: `PUT /admin-api/card`
- **接口描述**: 修改已有会员卡
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，会员卡ID
  "name": "修改后的会员卡名称", // 可选，会员卡名称
  "description": "修改后的会员卡描述", // 可选，会员卡描述
  "cover": "修改后的会员卡封面URL", // 可选，会员卡封面
  "type": "vip",            // 可选，会员卡类型
  "price": 99.00,           // 可选，会员卡价格
  "originalPrice": 199.00,   // 可选，会员卡原价
  "validDays": 365,         // 可选，有效天数
  "point": 1000,            // 可选，赠送积分
  "discount": 0.8,          // 可选，折扣率
  "privilegeIdList": [1, 2, 3], // 可选，特权ID列表
  "stockNum": 1000,         // 可选，库存数量
  "saleStartTime": "2023-05-01 00:00:00", // 可选，销售开始时间
  "saleEndTime": "2023-05-31 23:59:59"   // 可选，销售结束时间
}
```
- **响应参数**: 同获取会员卡详情

### 5. 删除会员卡

- **接口路径**: `DELETE /admin-api/card/{id}`
- **接口描述**: 删除一个会员卡
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1                    // 必填，会员卡ID，通过路径参数传递
}
```
- **响应参数**:
```json
{
  "success": true            // 删除是否成功
}
```

### 6. 会员卡上架/下架

- **接口路径**: `PUT /admin-api/card/status`
- **接口描述**: 会员卡上架或下架
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，会员卡ID
  "status": "off_sale"        // 必填，会员卡状态：on_sale(上架), off_sale(下架)
}
```
- **响应参数**:
```json
{
  "success": true            // 设置是否成功
}
```

### 7. 购买会员卡

- **接口路径**: `POST /auth-api/card/buy`
- **接口描述**: 购买会员卡
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1,                    // 必填，会员卡ID
  "num": 1                    // 可选，购买数量，默认为1
}
```
- **响应参数**:
```json
{
  "success": true,            // 购买是否成功
  "orderId": 1001,           // 订单ID
  "orderNo": "ORDER20230501001", // 订单号
  "totalAmount": 99.00       // 支付金额
}
```

### 8. 获取用户会员卡列表

- **接口路径**: `GET /auth-api/member/card/list`
- **接口描述**: 获取当前登录用户的会员卡列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "status": "valid",         // 可选，会员卡状态：valid(有效), expired(已过期), used(已使用)
  "type": "vip"              // 可选，会员卡类型
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 5,                 // 总记录数
  "list": [                   // 会员卡列表
    {
      "id": 1,                // 用户会员卡ID
      "cardId": 1,            // 会员卡ID
      "cardName": "会员卡名称", // 会员卡名称
      "cardCover": "会员卡封面URL", // 会员卡封面
      "type": "vip",          // 会员卡类型
      "price": 99.00,         // 会员卡价格
      "validDays": 365,       // 有效天数
      "point": 1000,          // 赠送积分
      "discount": 0.8,        // 折扣率
      "privilegeList": [      // 特权列表
        {
          "id": 1,
          "name": "特权名称",
          "description": "特权描述"
        }
      ],
      "status": "valid",      // 会员卡状态
      "startTime": "2023-05-01 12:00:00", // 生效时间
      "endTime": "2024-05-01 12:00:00",   // 到期时间
      "buyTime": "2023-05-01 12:00:00",   // 购买时间
      "useTime": null         // 使用时间
    }
  ]
}
```

## 数据模型

### 用户状态枚举

- `active`: 活跃
- `inactive`: 非活跃
- `locked`: 锁定

### 性别枚举

- `male`: 男
- `female`: 女
- `unknown`: 未知

### 会员卡类型枚举

- `vip`: VIP卡
- `point`: 积分卡
- `discount`: 折扣卡

### 会员卡状态枚举

- `on_sale`: 在售
- `off_sale`: 下架
- `out_of_stock`: 售罄

### 用户会员卡状态枚举

- `valid`: 有效
- `expired`: 已过期
- `used`: 已使用

### 特权类型枚举

- `discount`: 折扣
- `free`: 免费
- `priority`: 优先
- `limit`: 限制解除
