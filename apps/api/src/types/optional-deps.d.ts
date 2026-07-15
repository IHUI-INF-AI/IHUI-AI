// 阿里云 SDK 类型适配层
// 业务代码在 sms.ts 中定义本地接口 AliyunSmsModules,并对动态 import 的 SDK
// 做 as 强转。SDK 实际类型与本地接口不完全重叠(@alicloud/dysmsapi20170525
// 不导出 Config,Config 来自 @alicloud/openapi-client 兄弟包)。
// 此 shim 声明 SDK 暴露的命名空间类型,使 as 转换可成功。
// 当 SDK 未安装时,业务代码 try/catch 兜底降级为日志输出。
declare module '@alicloud/dysmsapi20170525' {
  export default class Dysmsapi {
    constructor(config: unknown)
    sendSms(request: unknown): Promise<unknown>
  }
  export class SendSmsRequest {
    constructor(input: Record<string, unknown>)
  }
}

declare module '@alicloud/openapi-client' {
  export class Config {
    constructor(input: Record<string, unknown>)
  }
}
