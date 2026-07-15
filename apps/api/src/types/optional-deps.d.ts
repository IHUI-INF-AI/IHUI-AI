// 阿里云 SDK 为可选依赖,未安装时降级处理
// 业务代码已用 try/catch 捕获动态 import 错误,此处仅补齐类型声明以便 tsc 通过
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
