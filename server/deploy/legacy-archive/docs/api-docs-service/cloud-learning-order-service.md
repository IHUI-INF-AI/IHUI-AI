# cloud-learning-order-service 订单服务

## 概述

订单服务主要负责管理平台上的各种订单，包括课程订单、会员卡订单、礼品订单和支付等功能。

## 课程订单接口

### 1. 创建课程订单

- **接口路径**: `POST /auth-api/course-order`
- **接口描述**: 创建课程订单
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "courseId": 1,              // 必填，课程ID
  "couponId": 1,              // 可选，优惠券ID
  "payType": "alipay"         // 可选，支付方式，默认为alipay
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 订单ID
  "orderNo": "ORDER20230501001", // 订单号
  "courseId": 1,              // 课程ID
  "course": {                 // 课程信息
    "id": 1,
    "title": "课程标题",
    "cover": "封面图片URL",
    "price": 199.00,
    "originalPrice": 299.00
  },
  "couponId": 1,              // 优惠券ID
  "coupon": {                 // 优惠券信息
    "id": 1,
    "name": "优惠券名称",
    "type": "discount",
    "value": 50.00,
    "unit": "元"
  },
  "originalPrice": 199.00,     // 原价
  "discountAmount": 50.00,     // 优惠金额
  "payAmount": 149.00,        // 支付金额
  "payType": "alipay",        // 支付方式
  "status": "pending",        // 订单状态：pending(待支付), paid(已支付), cancelled(已取消), refunded(已退款)
  "memberId": 1001,           // 用户ID
  "member": {                 // 用户信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "payTime": null,            // 支付时间
  "cancelTime": null,         // 取消时间
  "refundTime": null,         // 退款时间
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 取消课程订单

- **接口路径**: `PUT /auth-api/course-order/cancel`
- **接口描述**: 取消课程订单
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，订单ID
}
```
- **响应参数**:
```json
{
  "success": true,            // 取消是否成功
  "cancelTime": "2023-05-01 12:30:00" // 取消时间
}
```

### 3. 获取课程订单详情

- **接口路径**: `GET /auth-api/course-order`
- **接口描述**: 获取课程订单详情
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，订单ID
}
```
- **响应参数**: 同创建课程订单接口

### 4. 获取课程订单列表

- **接口路径**: `GET /auth-api/course-order/list`
- **接口描述**: 获取当前登录用户的课程订单列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "status": "paid",           // 可选，订单状态
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), payTime(支付时间)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 20,                // 总记录数
  "list": [                   // 订单列表
    {
      // 同创建课程订单接口的响应参数
    }
  ]
}
```

### 5. 获取所有课程订单列表

- **接口路径**: `GET /admin-api/course-order/list`
- **接口描述**: 获取所有课程订单列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "courseId": 1,              // 可选，课程ID
  "memberId": 1001,           // 可选，用户ID
  "status": "paid",           // 可选，订单状态
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), payTime(支付时间), payAmount(支付金额)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 100,               // 总记录数
  "list": [                   // 订单列表
    {
      // 同创建课程订单接口的响应参数
    }
  ]
}
```

## 会员卡订单接口

### 1. 创建会员卡订单

- **接口路径**: `POST /auth-api/card-order`
- **接口描述**: 创建会员卡订单
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "cardId": 1,                // 必填，会员卡ID
  "num": 1,                  // 可选，购买数量，默认为1
  "couponId": 1,              // 可选，优惠券ID
  "payType": "alipay"         // 可选，支付方式，默认为alipay
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 订单ID
  "orderNo": "ORDER20230501001", // 订单号
  "cardId": 1,                // 会员卡ID
  "card": {                   // 会员卡信息
    "id": 1,
    "name": "会员卡名称",
    "cover": "会员卡封面URL",
    "price": 99.00,
    "originalPrice": 199.00,
    "validDays": 365
  },
  "num": 1,                  // 购买数量
  "couponId": 1,              // 优惠券ID
  "coupon": {                 // 优惠券信息
    "id": 1,
    "name": "优惠券名称",
    "type": "discount",
    "value": 20.00,
    "unit": "元"
  },
  "originalPrice": 99.00,      // 原价
  "discountAmount": 20.00,     // 优惠金额
  "payAmount": 79.00,         // 支付金额
  "payType": "alipay",        // 支付方式
  "status": "pending",        // 订单状态：pending(待支付), paid(已支付), cancelled(已取消), refunded(已退款)
  "memberId": 1001,           // 用户ID
  "member": {                 // 用户信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "payTime": null,            // 支付时间
  "cancelTime": null,         // 取消时间
  "refundTime": null,         // 退款时间
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 取消会员卡订单

- **接口路径**: `PUT /auth-api/card-order/cancel`
- **接口描述**: 取消会员卡订单
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，订单ID
}
```
- **响应参数**:
```json
{
  "success": true,            // 取消是否成功
  "cancelTime": "2023-05-01 12:30:00" // 取消时间
}
```

### 3. 获取会员卡订单详情

- **接口路径**: `GET /auth-api/card-order`
- **接口描述**: 获取会员卡订单详情
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，订单ID
}
```
- **响应参数**: 同创建会员卡订单接口

### 4. 获取会员卡订单列表

- **接口路径**: `GET /auth-api/card-order/list`
- **接口描述**: 获取当前登录用户的会员卡订单列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "status": "paid",           // 可选，订单状态
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), payTime(支付时间)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 20,                // 总记录数
  "list": [                   // 订单列表
    {
      // 同创建会员卡订单接口的响应参数
    }
  ]
}
```

### 5. 获取所有会员卡订单列表

- **接口路径**: `GET /admin-api/card-order/list`
- **接口描述**: 获取所有会员卡订单列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "cardId": 1,                // 可选，会员卡ID
  "memberId": 1001,           // 可选，用户ID
  "status": "paid",           // 可选，订单状态
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), payTime(支付时间), payAmount(支付金额)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 100,               // 总记录数
  "list": [                   // 订单列表
    {
      // 同创建会员卡订单接口的响应参数
    }
  ]
}
```

## 支付接口

### 1. 创建支付

- **接口路径**: `POST /auth-api/payment/create`
- **接口描述**: 创建支付
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "orderId": 1,               // 必填，订单ID
  "orderType": "course",       // 必填，订单类型：course(课程订单), card(会员卡订单)
  "payType": "alipay",        // 必填，支付方式：alipay(支付宝), wechat(微信支付), balance(余额支付)
  "returnUrl": "http://example.com/return", // 可选，支付成功返回地址
  "notifyUrl": "http://example.com/notify"  // 可选，支付结果通知地址
}
```
- **响应参数**:
```json
{
  "paymentId": 1,             // 支付ID
  "paymentNo": "PAY20230501001", // 支付号
  "orderId": 1,               // 订单ID
  "orderType": "course",       // 订单类型
  "payType": "alipay",        // 支付方式
  "payAmount": 149.00,        // 支付金额
  "payUrl": "https://openapi.alipay.com/gateway.do?...", // 支付地址
  "qrCode": "data:image/png;base64,...", // 二维码（支付宝扫码支付）
  "status": "created",        // 支付状态：created(已创建), paying(支付中), paid(已支付), failed(支付失败), cancelled(已取消)
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 查询支付状态

- **接口路径**: `GET /auth-api/payment/status`
- **接口描述**: 查询支付状态
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "paymentId": 1              // 必填，支付ID
}
```
- **响应参数**:
```json
{
  "paymentId": 1,             // 支付ID
  "paymentNo": "PAY20230501001", // 支付号
  "orderId": 1,               // 订单ID
  "orderType": "course",       // 订单类型
  "payType": "alipay",        // 支付方式
  "payAmount": 149.00,        // 支付金额
  "status": "paid",           // 支付状态
  "payTime": "2023-05-01 12:30:00", // 支付时间
  "thirdPartyNo": "2023050122001234567890123456789", // 第三方支付号
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 3. 取消支付

- **接口路径**: `PUT /auth-api/payment/cancel`
- **接口描述**: 取消支付
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "paymentId": 1              // 必填，支付ID
}
```
- **响应参数**:
```json
{
  "success": true,            // 取消是否成功
  "cancelTime": "2023-05-01 12:30:00" // 取消时间
}
```

### 4. 获取支付记录列表

- **接口路径**: `GET /auth-api/payment/list`
- **接口描述**: 获取当前登录用户的支付记录列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "orderType": "course",       // 可选，订单类型
  "payType": "alipay",        // 可选，支付方式
  "status": "paid",           // 可选，支付状态
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), payTime(支付时间)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 20,                // 总记录数
  "list": [                   // 支付记录列表
    {
      // 同创建支付接口的响应参数
    }
  ]
}
```

### 5. 获取所有支付记录列表

- **接口路径**: `GET /admin-api/payment/list`
- **接口描述**: 获取所有支付记录列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "orderId": 1,               // 可选，订单ID
  "orderType": "course",       // 可选，订单类型
  "payType": "alipay",        // 可选，支付方式
  "status": "paid",           // 可选，支付状态
  "memberId": 1001,           // 可选，用户ID
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), payTime(支付时间), payAmount(支付金额)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 100,               // 总记录数
  "list": [                   // 支付记录列表
    {
      // 同创建支付接口的响应参数
    }
  ]
}
```

## 退款接口

### 1. 申请退款

- **接口路径**: `POST /auth-api/refund/apply`
- **接口描述**: 申请退款
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "orderId": 1,               // 必填，订单ID
  "orderType": "course",       // 必填，订单类型：course(课程订单), card(会员卡订单)
  "reason": "退款原因",         // 必填，退款原因
  "refundAmount": 149.00      // 可选，退款金额，默认为订单支付金额
}
```
- **响应参数**:
```json
{
  "id": 1,                    // 退款ID
  "orderId": 1,               // 订单ID
  "orderType": "course",       // 订单类型
  "orderNo": "ORDER20230501001", // 订单号
  "reason": "退款原因",         // 退款原因
  "refundAmount": 149.00,      // 退款金额
  "status": "pending",        // 退款状态：pending(待审核), approved(已通过), rejected(已拒绝), processing(处理中), completed(已完成), failed(失败)
  "memberId": 1001,           // 用户ID
  "member": {                 // 用户信息
    "id": 1001,
    "nickname": "用户昵称",
    "avatar": "头像URL"
  },
  "applyTime": "2023-05-01 12:00:00", // 申请时间
  "processTime": null,         // 处理时间
  "completeTime": null,        // 完成时间
  "createTime": "2023-05-01 12:00:00",  // 创建时间
  "updateTime": "2023-05-02 13:00:00"   // 更新时间
}
```

### 2. 获取退款详情

- **接口路径**: `GET /auth-api/refund`
- **接口描述**: 获取退款详情
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "id": 1                     // 必填，退款ID
}
```
- **响应参数**: 同申请退款接口

### 3. 获取退款列表

- **接口路径**: `GET /auth-api/refund/list`
- **接口描述**: 获取当前登录用户的退款列表
- **权限要求**: 需要登录认证
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "orderType": "course",       // 可选，订单类型
  "status": "approved",        // 可选，退款状态
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), applyTime(申请时间), processTime(处理时间)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 20,                // 总记录数
  "list": [                   // 退款列表
    {
      // 同申请退款接口的响应参数
    }
  ]
}
```

### 4. 审核退款

- **接口路径**: `PUT /admin-api/refund/process`
- **接口描述**: 审核退款
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，退款ID
  "status": "approved",         // 必填，审核结果：approved(通过), rejected(拒绝)
  "processMessage": "审核意见"    // 可选，审核意见
}
```
- **响应参数**:
```json
{
  "success": true,            // 审核是否成功
  "processTime": "2023-05-01 12:30:00" // 处理时间
}
```

### 5. 处理退款

- **接口路径**: `PUT /admin-api/refund/handle`
- **接口描述**: 处理退款
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "id": 1,                    // 必填，退款ID
  "refundAmount": 149.00,      // 必填，实际退款金额
  "refundType": "original",     // 必填，退款方式：original(原路返回), balance(退回余额)
  "handleMessage": "处理说明"    // 可选，处理说明
}
```
- **响应参数**:
```json
{
  "success": true,            // 处理是否成功
  "completeTime": "2023-05-01 12:30:00" // 完成时间
}
```

### 6. 获取所有退款列表

- **接口路径**: `GET /admin-api/refund/list`
- **接口描述**: 获取所有退款列表
- **权限要求**: 需要管理员权限
- **请求参数**:
```json
{
  "pageNum": 1,               // 可选，页码，默认为1
  "pageSize": 10,             // 可选，每页大小，默认为10
  "keyword": "搜索关键字",      // 可选，搜索关键字
  "orderId": 1,               // 可选，订单ID
  "orderType": "course",       // 可选，订单类型
  "status": "approved",        // 可选，退款状态
  "memberId": 1001,           // 可选，用户ID
  "startTime": "2023-05-01",  // 可选，开始时间
  "endTime": "2023-05-31",    // 可选，结束时间
  "orderColumn": "createTime", // 可选，排序字段，可选值：createTime(创建时间), applyTime(申请时间), processTime(处理时间)
  "orderDirection": "desc"    // 可选，排序方向，asc或desc
}
```
- **响应参数**:
```json
{
  "pageNum": 1,               // 当前页码
  "pageSize": 10,             // 每页大小
  "total": 100,               // 总记录数
  "list": [                   // 退款列表
    {
      // 同申请退款接口的响应参数
    }
  ]
}
```

## 数据模型

### 订单状态枚举

- `pending`: 待支付
- `paid`: 已支付
- `cancelled`: 已取消
- `refunded`: 已退款

### 支付方式枚举

- `alipay`: 支付宝
- `wechat`: 微信支付
- `balance`: 余额支付

### 支付状态枚举

- `created`: 已创建
- `paying`: 支付中
- `paid`: 已支付
- `failed`: 支付失败
- `cancelled`: 已取消

### 退款状态枚举

- `pending`: 待审核
- `approved`: 已通过
- `rejected`: 已拒绝
- `processing`: 处理中
- `completed`: 已完成
- `failed`: 失败

### 退款方式枚举

- `original`: 原路返回
- `balance`: 退回余额
