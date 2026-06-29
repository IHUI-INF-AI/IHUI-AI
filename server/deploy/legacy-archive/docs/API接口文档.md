# ZHS平台API接口文档

## 目录
- [课程模块接口](#课程模块接口)
- [应用模块接口](#应用模块接口)
- [MCP模块接口](#mcp模块接口)
- [Small模块接口](#small模块接口)

### 12. 用户反馈管理
**接口地址：** `/feedback`

#### 12.1 提交用户反馈
**接口地址：** `POST /feedback/submit`

**请求参数：**
```json
{
  "userId": "用户ID",
  "content": "反馈内容",
  "contact": "联系方式",
  "type": "反馈类型"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "提交结果"
}
```

#### 12.2 获取反馈列表
**接口地址：** `GET /feedback/list`

**请求参数：**
```
page: 页码
quantity: 每页数量
type: 反馈类型(可选)
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "feedbacks": "反馈列表",
    "total": "总数",
    "page": "当前页",
    "quantity": "每页数量"
  }
}
```

#### 12.3 获取反馈详情
**接口地址：** `GET /feedback/{id}`

**请求参数：**
```
id: 反馈ID
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "id": "反馈ID",
    "userId": "用户ID",
    "content": "反馈内容",
    "contact": "联系方式",
    "type": "反馈类型",
    "status": "处理状态",
    "createTime": "创建时间",
    "updateTime": "更新时间"
  }
}
```

#### 12.4 处理反馈
**接口地址：** `PUT /feedback/{id}`

**请求参数：**
```json
{
  "status": "处理状态",
  "remark": "处理备注"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "处理结果"
}
```

#### 12.5 删除反馈
**接口地址：** `DELETE /feedback/{ids}`

**请求参数：**
```
ids: 反馈ID列表，多个ID用逗号分隔
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "删除结果"
}
```

### 13. 智能体审核管理
**接口地址：** `/examine`

#### 13.1 查询智能体审核列表
**接口地址：** `GET /examine/list`

**请求参数：**
```
page: 页码
quantity: 每页数量
status: 审核状态(可选)
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "agents": "智能体列表",
    "total": "总数",
    "page": "当前页",
    "quantity": "每页数量"
  }
}
```

#### 13.2 获取智能体审核详情
**接口地址：** `GET /examine/{id}`

**请求参数：**
```
id: 智能体ID
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "id": "智能体ID",
    "name": "智能体名称",
    "description": "智能体描述",
    "creatorId": "创建者ID",
    "status": "审核状态",
    "createTime": "创建时间",
    "updateTime": "更新时间"
  }
}
```

#### 13.3 新增智能体审核
**接口地址：** `POST /examine`

**请求参数：**
```json
{
  "name": "智能体名称",
  "description": "智能体描述",
  "creatorId": "创建者ID"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "新增结果"
}
```

#### 13.4 修改智能体审核
**接口地址：** `PUT /examine`

**请求参数：**
```json
{
  "id": "智能体ID",
  "name": "智能体名称",
  "description": "智能体描述"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "修改结果"
}
```

#### 13.5 删除智能体审核
**接口地址：** `DELETE /examine/{ids}`

**请求参数：**
```
ids: 智能体ID列表，多个ID用逗号分隔
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "删除结果"
}
```

#### 13.6 审批通过
**接口地址：** `PUT /examine/pass`

**请求参数：**
```json
{
  "id": "智能体ID",
  "remark": "审批备注"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "审批结果"
}
```

#### 13.7 审批驳回
**接口地址：** `PUT /examine/reject`

**请求参数：**
```json
{
  "id": "智能体ID",
  "remark": "驳回原因"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "审批结果"
}
```

---

## 注意事项

1. 所有接口均返回JSON格式数据
2. 成功响应格式为：`{"code": "200", "msg": "操作成功", "data": {}}`
3. 错误响应格式为：`{"code": "错误码", "msg": "错误信息", "data": {}}`
4. 需要认证的接口请在请求头中添加：`Authorization: Bearer JWT令牌`
5. 所有时间格式均为：`yyyy-MM-dd HH:mm:ss`
6. 分页参数：`page`（页码，从1开始），`quantity`（每页数量）
7. 标记为"已弃用"的接口不建议使用，可能在未来版本中移除
8. 新版本接口（如/distributionNow、/resource等）是对旧版本接口的升级，建议优先使用新版本接口

## 课程模块接口

### 1. 课程管理

#### 1.1 获取课程列表
**接口地址：** `GET /course/list`

**请求头：**
```
platform: 平台类型
uuid: 用户ID
```

**请求参数：**
```
pageNum: 页码
pageSize: 每页数量
orderByColumn: 排序字段
其他课程查询条件...
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": [
    {
      "id": "课程ID",
      "title": "课程标题",
      "description": "课程描述",
      "platform": "平台ID",
      "creator": "创建者ID",
      "createTime": "创建时间",
      "updateTime": "更新时间"
    }
  ]
}
```

#### 1.2 获取课程详情
**接口地址：** `GET /course/{id}`

**请求头：**
```
platform: 平台类型
uuid: 用户ID
```

**路径参数：**
```
id: 课程ID
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "id": "课程ID",
    "title": "课程标题",
    "description": "课程描述",
    "content": "课程内容",
    "platform": "平台ID",
    "creator": "创建者ID",
    "createTime": "创建时间",
    "updateTime": "更新时间"
  }
}
```

#### 1.3 新增课程
**接口地址：** `POST /course`

**请求头：**
```
platform: 平台类型
uuid: 用户ID
```

**请求体：**
```json
{
  "title": "课程标题",
  "description": "课程描述",
  "content": "课程内容",
  "coverImage": "封面图片URL"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "id": "新创建的课程ID"
  }
}
```

#### 1.4 修改课程
**接口地址：** `PUT /course`

**请求头：**
```
uuid: 用户ID
```

**请求体：**
```json
{
  "id": "课程ID",
  "title": "课程标题",
  "description": "课程描述",
  "content": "课程内容",
  "coverImage": "封面图片URL"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": true
}
```

#### 1.5 删除课程
**接口地址：** `DELETE /course/{ids}`

**请求头：**
```
uuid: 用户ID
```

**路径参数：**
```
ids: 课程ID，多个ID用逗号分隔
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": true
}
```

#### 1.6 下架课程
**接口地址：** `POST /course/delist/{ids}`

**请求头：**
```
uuid: 用户ID
```

**路径参数：**
```
ids: 课程ID，多个ID用逗号分隔
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": true
}
```

---

## 应用模块接口

### 1. 授权管理

#### 1.1 获取授权用户
**接口地址：** `GET /auth_management/get/{uuid}`

**路径参数：**
```
uuid: 用户唯一标识
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "uuid": "用户唯一标识",
    "appId": "应用ID",
    "permissions": ["权限列表"]
  }
}
```

#### 1.2 解绑小程序
**接口地址：** `POST /auth_management/remove`

**请求体：**
```json
{
  "uuid": "用户唯一标识",
  "appId": "应用ID"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": true
}
```

### 2. 支付管理

#### 2.1 微信支付
**接口地址：** `POST /app/pay/wx/android`

**请求体：**
```json
{
  "uuid": "用户唯一标识",
  "desc": "商品描述",
  "id": "商品ID",
  "productType": "产品类型"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "appId": "微信小程序ID",
    "timeStamp": "时间戳",
    "nonceStr": "随机字符串",
    "package": "prepay_id=wx123456789",
    "signType": "RSA",
    "paySign": "签名"
  }
}
```

---

## MCP模块接口

### 1. 智能体管理

#### 1.1 智能体列表查询
**接口地址：** `GET /agent/rule/search`

**请求参数：**
```
rule: 查询规则
page: 页码
size: 每页数量
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "total": "总数",
    "list": [
      {
        "id": "智能体ID",
        "name": "智能体名称",
        "description": "智能体描述",
        "avatar": "头像URL",
        "type": "智能体类型"
      }
    ]
  }
}
```

### 2. 阿里云百炼接口

#### 2.1 生成音色
**接口地址：** `POST /ali/generate/timbre`

**请求头：**
```
uuid: 用户ID
```

**请求体：**
```json
{
  "copyWriting": "要合成的文本内容",
  "auditPath": "音频文件路径",
  "creator": "用户ID"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "url": "生成的音频文件URL",
    "total_tokens": 128
  }
}
```

#### 2.2 获取系统音色
**接口地址：** `GET /ali/audio/sys`

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": [
    {
      "id": "音色ID",
      "name": "音色名称",
      "gender": "性别",
      "language": "语言",
      "description": "描述"
    }
  ]
}
```

#### 2.3 视频形象保存
**接口地址：** `POST /ali/video/to/digital`

**请求头：**
```
uuid: 用户ID
```

**请求体：**
```json
{
  "videoUrl": "视频文件URL",
  "type": 2,
  "imageName": "形象名称"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "audioUrl": "提取的音频URL",
    "imageUrl": "提取的图像URL"
  }
}
```

#### 2.4 获取定制形象
**接口地址：** `GET /ali/get/digital/{type}`

**请求头：**
```
uuid: 用户ID
```

**路径参数：**
```
type: 形象类型 (0:音频, 1:图像, 2:视频)
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": [
    {
      "id": "形象ID",
      "name": "形象名称",
      "type": "形象类型",
      "imageUrl": "图像URL",
      "audioUrl": "音频URL",
      "videoUrl": "视频URL"
    }
  ]
}
```

### 3. 可灵AI接口

#### 3.1 生成数字人
**接口地址：** `POST /kling/generate/video`

**请求体：**
```json
{
  "prompt": "生成提示词",
  "model": "模型名称",
  "duration": "持续时间"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "taskId": "任务ID",
    "status": "处理状态"
  }
}
```

#### 3.2 查询生成进度
**接口地址：** `GET /kling/video/info/{id}`

**路径参数：**
```
id: 任务ID
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "taskId": "任务ID",
    "status": "处理状态",
    "progress": "进度百分比",
    "resultUrl": "结果URL"
  }
}
```

### 4. 资源处理接口

#### 4.1 视频转音频
**接口地址：** `GET /mcp/resource/video/to/audio`

**请求参数：**
```
videoUrl: 视频URL
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "audioUrl": "转换后的音频URL",
    "duration": "音频时长(秒)"
  }
}
```

---

## Small模块接口

### 1. 登录相关

#### 1.1 获取微信OpenID
**接口地址：** `POST /login/getOpenId`

**请求参数：**
```
code: 微信授权码
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "openId": "微信OpenID",
    "sessionKey": "会话密钥"
  }
}
```

#### 1.2 手机号登录
**接口地址：** `POST /login/getPhoneNumber`

**请求参数：**
```
code: 微信授权码
openId: 微信OpenID
parentId: 父级ID(可选)
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "token": "JWT令牌",
    "userInfo": {
      "id": "用户ID",
      "phone": "手机号",
      "openId": "微信OpenID"
    }
  }
}
```

#### 1.3 换绑微信账号
**接口地址：** `POST /login/editWxOpenId`

**请求体：**
```json
{
  "phone": "手机号",
  "openId": "新的微信OpenID"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": true
}
```

#### 1.4 获取微信小程序码
**接口地址：** `GET /login/getWxCode`

**请求参数：**
```
invite_code: 邀请码
back: 背景样式(可选)
```

**响应格式：**
```
直接返回小程序码图片数据
```

#### 1.5 获取Minio文件
**接口地址：** `GET /login/getMinioFile`

**请求参数：**
```
filePath: 文件路径
```

**响应格式：**
```
直接返回文件数据流
```

#### 1.6 获取URL链接
**接口地址：** `GET /login/get/url/link`

**请求参数：**
```
uuid: 用户唯一标识
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "URL链接"
}
```

### 2. 资源管理

#### 2.1 Token扣减
**接口地址：** `POST /resource/token/deduct`

**请求头：**
```
Authorization: Bearer JWT令牌
```

**请求体：**
```json
{
  "userId": "用户ID",
  "amount": "扣减数量",
  "reason": "扣减原因"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "remainingTokens": "剩余Token数量"
  }
}
```

#### 2.2 Token回退
**接口地址：** `POST /resource/token/rollback`

**请求头：**
```
Authorization: Bearer JWT令牌
```

**请求体：**
```json
{
  "userId": "用户ID",
  "amount": "回退数量",
  "reason": "回退原因",
  "transactionId": "原交易ID"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "remainingTokens": "剩余Token数量"
  }
}
```

#### 2.3 获取智能体
**接口地址：** `GET /resource/agent/list`

**请求头：**
```
Authorization: Bearer JWT令牌
```

**请求参数：**
```
page: 页码
size: 每页数量
type: 智能体类型(可选)
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "total": "总数",
    "list": [
      {
        "id": "智能体ID",
        "name": "智能体名称",
        "description": "智能体描述",
        "avatar": "头像URL",
        "type": "智能体类型"
      }
    ]
  }
}
```

### 3. 支付相关

#### 3.1 JSAPI/小程序下单
**接口地址：** `POST /pay/initiatePay`

**请求头：**
```
Authorization: 用户认证令牌
```

**请求参数：**
```json
{
  "uuid": "用户唯一标识",
  "openId": "小程序唯一标识",
  "desc": "商品名称",
  "id": "商品id",
  "productType": "订单类型：0token(商品) 1活动 2开通身份 5购买开发者身份 4购买智能体 6购买课程 7购买课程附件",
  "amount": "金额(当productType为1时必需)"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "appId": "微信小程序ID",
    "timeStamp": "时间戳",
    "nonceStr": "随机字符串",
    "package": "prepay_id=wx123456789",
    "signType": "RSA",
    "paySign": "签名"
  }
}
```

#### 3.2 微信支付订单号查询订单
**接口地址：** `POST /pay/queryOrderById`

**请求参数：**
```json
{
  "transaction_id": "微信支付订单号"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "transactionId": "微信支付订单号",
    "outTradeNo": "商户订单号",
    "tradeState": "交易状态",
    "tradeStateDesc": "交易状态描述",
    "total": "订单总金额",
    "successTime": "支付完成时间"
  }
}
```

#### 3.3 商户订单号查询订单
**接口地址：** `POST /pay/queryOrderByOutTradeNo`

**请求参数：**
```json
{
  "out_trade_no": "商户订单号"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "transactionId": "微信支付订单号",
    "outTradeNo": "商户订单号",
    "tradeState": "交易状态",
    "tradeStateDesc": "交易状态描述",
    "total": "订单总金额",
    "successTime": "支付完成时间"
  }
}
```

#### 3.4 关闭订单
**接口地址：** `POST /pay/closeOrder`

**请求参数：**
```json
{
  "out_trade_no": "商户订单号"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": true
}
```

#### 3.5 退款申请
**接口地址：** `POST /pay/refunds`

**请求参数：**
```json
{
  "out_trade_no": "商户订单号",
  "out_refund_no": "商户退款单号",
  "amount": "退款金额",
  "reason": "退款原因"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "refundId": "微信退款单号",
    "outRefundNo": "商户退款单号",
    "refund": "退款金额",
    "total": "订单总金额",
    "status": "退款状态"
  }
}
```

#### 3.6 支付回调通知
**接口地址：** `POST /pay/notify`

**请求头：**
```
Wechatpay-Signature: 签名
Wechatpay-Timestamp: 时间戳
Wechatpay-Nonce: 随机字符串
Wechatpay-Serial: 证书序列号
```

**请求参数：**
```json
{
  "支付回调通知数据"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "回调处理结果"
}
```

#### 3.7 提现回调
**接口地址：** `POST /pay/transferNotify`

**请求头：**
```
Wechatpay-Signature: 签名
Wechatpay-Timestamp: 时间戳
Wechatpay-Nonce: 随机字符串
Wechatpay-Serial: 证书序列号
```

**请求参数：**
```json
{
  "提现回调通知数据"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "回调处理结果"
}
```

#### 3.8 购买课程支付回调
**接口地址：** `POST /pay/course/notify`

**请求头：**
```
Wechatpay-Signature: 签名
Wechatpay-Timestamp: 时间戳
Wechatpay-Nonce: 随机字符串
Wechatpay-Serial: 证书序列号
```

**请求参数：**
```json
{
  "课程支付回调通知数据"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "回调处理结果"
}
```

### 4. 智能体相关

#### 4.1 智能体上传
**接口地址：** `POST /api/agent/upload`

**请求头：**
```
Authorization: Bearer JWT令牌
Content-Type: multipart/form-data
```

**请求参数：**
```
file: 智能体文件
name: 智能体名称
description: 智能体描述
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "agentId": "智能体ID",
    "name": "智能体名称",
    "url": "智能体访问URL",
    "status": "处理状态"
  }
}
```

#### 4.2 智能体变量选择
**接口地址：** `POST /api/agent/variable/select`

**请求头：**
```
Authorization: Bearer JWT令牌
```

**请求体：**
```json
{
  "agentId": "智能体ID",
  "variables": ["变量列表"]
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "agentId": "智能体ID",
    "selectedVariables": ["已选择的变量"],
    "template": "处理后的模板"
  }
}
```

#### 4.3 智能体请求处理
**接口地址：** `POST /api/agent/request`

**请求头：**
```
Authorization: Bearer JWT令牌
```

**请求体：**
```json
{
  "agentId": "智能体ID",
  "input": "用户输入",
  "context": "上下文信息"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "response": "智能体响应",
    "context": "更新后的上下文",
    "tokensUsed": "使用的Token数量"
  }
}
```

### 5. 活动相关

#### 5.1 活动列表查询
**接口地址：** `GET /zhs_activity/list`

**请求参数：**
```
page: 页码
size: 每页数量
status: 活动状态(可选)
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "total": "总数",
    "list": [
      {
        "id": "活动ID",
        "title": "活动标题",
        "description": "活动描述",
        "coverImage": "封面图片URL",
        "startTime": "开始时间",
        "endTime": "结束时间",
        "status": "活动状态"
      }
    ]
  }
}
```

#### 5.2 活动详情获取
**接口地址：** `GET /zhs_activity/{id}`

**路径参数：**
```
id: 活动ID
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "id": "活动ID",
    "title": "活动标题",
    "description": "活动描述",
    "content": "活动内容",
    "coverImage": "封面图片URL",
    "startTime": "开始时间",
    "endTime": "结束时间",
    "status": "活动状态",
    "participants": "参与人数"
  }
}
```

### 6. 购买记录

#### 6.1 智能体购买记录列表
**接口地址：** `GET /zhs_agent_buy/list`

**请求参数：**
```
page: 页码
size: 每页数量
userId: 用户ID(可选)
agentId: 智能体ID(可选)
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "total": "总数",
    "list": [
      {
        "id": "购买记录ID",
        "userId": "用户ID",
        "agentId": "智能体ID",
        "agentName": "智能体名称",
        "price": "购买价格",
        "purchaseTime": "购买时间",
        "status": "购买状态"
      }
    ]
  }
}
```

#### 6.2 智能体购买记录详情
**接口地址：** `GET /zhs_agent_buy/{id}`

**路径参数：**
```
id: 购买记录ID
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "id": "购买记录ID",
    "userId": "用户ID",
    "agentId": "智能体ID",
    "agentName": "智能体名称",
    "agentDescription": "智能体描述",
    "price": "购买价格",
    "purchaseTime": "购买时间",
    "status": "购买状态",
    "orderNo": "订单号"
  }
}
```

### 7. 开通身份订单

#### 7.1 开通身份订单列表
**接口地址：** `GET /product_identity/list`

**请求参数：**
```
page: 页码
size: 每页数量
userId: 用户ID(可选)
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "total": "总数",
    "list": [
      {
        "id": "订单ID",
        "userId": "用户ID",
        "identityType": "身份类型",
        "price": "开通价格",
        "purchaseTime": "购买时间",
        "status": "订单状态"
      }
    ]
  }
}
```

#### 7.2 开通身份订单详情
**接口地址：** `GET /product_identity/{id}`

**路径参数：**
```
id: 订单ID
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "id": "订单ID",
    "userId": "用户ID",
    "identityType": "身份类型",
    "identityName": "身份名称",
    "price": "开通价格",
    "purchaseTime": "购买时间",
    "status": "订单状态",
    "orderNo": "订单号"
  }
}
```

### 8. 提现相关

#### 8.1 提现详情数据面板
**接口地址：** `GET /zhsWithdrawal/dashboard`

**请求头：**
```
Authorization: Bearer JWT令牌
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "totalAmount": "总提现金额",
    "pendingAmount": "待处理金额",
    "completedAmount": "已完成金额",
    "totalCount": "总提现次数",
    "pendingCount": "待处理次数",
    "completedCount": "已完成次数"
  }
}
```

#### 8.2 发起提现申请
**接口地址：** `POST /zhsWithdrawal/apply`

**请求头：**
```
Authorization: Bearer JWT令牌
```

**请求体：**
```json
{
  "amount": "提现金额",
  "accountType": "账户类型",
  "accountNo": "账户号码",
  "accountName": "账户姓名"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "withdrawalId": "提现申请ID",
    "status": "提现状态"
  }
}
```

#### 8.3 提现记录查询
**接口地址：** `GET /zhsWithdrawal/list`

**请求头：**
```
Authorization: Bearer JWT令牌
```

**请求参数：**
```
page: 页码
size: 每页数量
status: 提现状态(可选)
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "total": "总数",
    "list": [
      {
        "id": "提现记录ID",
        "amount": "提现金额",
        "accountType": "账户类型",
        "accountNo": "账户号码",
        "accountName": "账户姓名",
        "status": "提现状态",
        "applyTime": "申请时间",
        "processTime": "处理时间"
      }
    ]
  }
}
```

#### 8.4 可收款查询
**接口地址：** `GET /zhsWithdrawal/available`

**请求头：**
```
Authorization: Bearer JWT令牌
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "availableAmount": "可收款金额",
    "frozenAmount": "冻结金额",
    "totalIncome": "总收入"
  }
}
```

### 9. 分销管理（新版本）

#### 9.1 获取操盘手下家列表
**接口地址：** `GET /distributionNow/getSubordinates`

**请求参数：**
```
open_id: 用户openId
quantity: 每页数量
page: 页码
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "subordinates": "下家列表",
    "total": "总数",
    "page": "当前页",
    "quantity": "每页数量"
  }
}
```

#### 9.2 获取用户及下级订单
**接口地址：** `POST /distributionNow/getUserAndChildrenOrders`

**请求参数：**
```json
{
  "id": "用户ID",
  "page": "页码",
  "quantity": "每页数量"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "orders": "订单列表",
    "total": "总数",
    "page": "当前页",
    "quantity": "每页数量"
  }
}
```

#### 9.3 获取操盘手数据卡片统计
**接口地址：** `GET /distributionNow/getOperatorDataCardData`

**请求参数：**
```
user_id: 用户ID
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "totalOrders": "总订单数",
    "totalAmount": "总金额",
    "todayOrders": "今日订单数",
    "todayAmount": "今日金额",
    "subordinateCount": "下级数量"
  }
}
```

#### 9.4 获取下级用户订单统计
**接口地址：** `GET /distributionNow/getUserInviteeOrderStats`

**请求参数：**
```
user_id: 用户ID
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "inviteeOrderStats": "下级用户订单统计数据"
  }
}
```

#### 9.5 获取用户佣金明细
**接口地址：** `GET /distributionNow/getUserCommissionDetail`

**请求参数：**
```
user_id: 用户ID
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "commissionDetails": "佣金明细列表",
    "totalCommission": "总佣金"
  }
}
```

### 10. 资源管理（新版本）
**接口地址：** `/resource`

#### 10.1 处理用户Token扣减及流水（已弃用）
**接口地址：** `POST /resource/getTokenCount`

**请求参数：**
```json
{
  "token": "用户token",
  "count": "扣减数量"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "处理结果"
}
```

#### 10.2 回退token
**接口地址：** `POST /resource/getTokenReturn`

**请求参数：**
```json
{
  "token": "用户token",
  "count": "回退数量"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "回退结果"
}
```

#### 10.3 获取cozetoken（已弃用）
**接口地址：** `GET /resource/getAccessToken`

**请求参数：**
```
无
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "cozetoken"
}
```

#### 10.4 获取智能体列表（已弃用）
**接口地址：** `GET /resource/getAgentList`

**请求参数：**
```
无
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "智能体列表"
}
```

#### 10.5 获取智能体（已弃用）
**接口地址：** `GET /resource/getAgent`

**请求参数：**
```
id: 智能体ID
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "智能体信息"
}
```

#### 10.6 获取智能体2
**接口地址：** `GET /resource/getAgent2`

**请求参数：**
```
id: 智能体ID
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "智能体信息"
}
```

#### 10.7 保存用户上下文
**接口地址：** `POST /resource/saveUserContext`

**请求参数：**
```json
{
  "userId": "用户ID",
  "context": "上下文内容",
  "field": "字段名"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "保存结果"
}
```

#### 10.8 获取用户上下文
**接口地址：** `GET /resource/getUserContext`

**请求参数：**
```
userId: 用户ID
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "用户上下文"
}
```

#### 10.9 按字段获取用户上下文
**接口地址：** `GET /resource/getUserContext/field`

**请求参数：**
```
userId: 用户ID
field: 字段名
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "字段值"
}
```

#### 10.10 删除上下文字段
**接口地址：** `POST /resource/remove/context/field`

**请求参数：**
```json
{
  "userId": "用户ID",
  "field": "字段名"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": "删除结果"
}
```

#### 10.11 文件上传
**接口地址：** `POST /resource/fileUpload`

**请求参数：**
```
file: 上传的文件
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "url": "文件访问URL",
    "fileName": "文件名"
  }
}
```

#### 10.12 获取开发者价格信息
**接口地址：** `GET /resource/developer/price`

**请求参数：**
```
无
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "priceInfo": "开发者价格信息"
  }
}
```

#### 10.13 网络路径文件上传
**接口地址：** `POST /resource/fileUploadNetworkPath`

**请求参数：**
```json
{
  "url": "文件网络路径"
}
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "url": "文件访问URL",
    "fileName": "文件名"
  }
}
```

### 11. 分销流水管理
**接口地址：** `/flow`

#### 11.1 我的订单
**接口地址：** `GET /flow/orderList`

**请求参数：**
```
userId: 用户ID
page: 页码
quantity: 每页数量
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "orders": "订单列表",
    "total": "总数",
    "page": "当前页",
    "quantity": "每页数量"
  }
}
```

#### 11.2 分销流水列表
**接口地址：** `GET /flow/list`

**请求参数：**
```
userId: 用户ID
page: 页码
quantity: 每页数量
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "flows": "分销流水列表",
    "total": "总数",
    "page": "当前页",
    "quantity": "每页数量"
  }
}
```

#### 11.3 分销统计
**接口地址：** `GET /flow/getStatistics`

**请求参数：**
```
userId: 用户ID
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "totalOrders": "总订单数",
    "totalAmount": "总金额",
    "totalCommission": "总佣金",
    "todayOrders": "今日订单数",
    "todayAmount": "今日金额",
    "todayCommission": "今日佣金"
  }
}
```

#### 11.4 我的团队
**接口地址：** `GET /flow/getTraderTeam`

**请求参数：**
```
userId: 用户ID
page: 页码
quantity: 每页数量
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "teamMembers": "团队成员列表",
    "total": "总数",
    "page": "当前页",
    "quantity": "每页数量"
  }
}
```

#### 11.5 我的团队（按中心）
**接口地址：** `GET /flow/getTraderTeamByCenter`

**请求参数：**
```
userId: 用户ID
page: 页码
quantity: 每页数量
```

**响应格式：**
```json
{
  "code": "200",
  "msg": "操作成功",
  "data": {
    "teamMembers": "团队成员列表",
    "total": "总数",
    "page": "当前页",
    "quantity": "每页数量"
  }
}
```

---

## 通用响应格式说明

所有接口均遵循统一的响应格式：

```json
{
  "code": "状态码",
  "msg": "消息",
  "data": "响应数据"
}
```

### 状态码说明

- `200`: 操作成功
- `400`: 请求参数错误
- `401`: 未授权/登录失效
- `403`: 无权限访问
- `404`: 资源不存在
- `500`: 服务器内部错误

### 通用请求头说明

- `Authorization`: Bearer JWT令牌，用于身份验证
- `uuid`: 用户唯一标识
- `platform`: 平台类型

---

## 注意事项

1. 所有需要身份验证的接口都需要在请求头中携带有效的JWT令牌
2. 日期时间格式统一使用ISO 8601标准：`yyyy-MM-dd'T'HH:mm:ss'Z'`
3. 金额单位统一为分
4. 分页参数：`page`从1开始，`size`默认为10
5. 列表接口默认按创建时间倒序排列
6. 所有接口均支持CORS跨域请求
