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

// mysql2 可选依赖类型声明
// migrate-legacy-data.ts(P0-MIG-2 历史迁移脚本)动态 import mysql2/promise.js
// 从 Java MySQL 旧系统导入数据到 PostgreSQL 新系统。mysql2 为可选依赖,
// 仅在执行历史迁移时按需安装(pnpm --filter @ihui/api add mysql2),
// 不加入 package.json 正式依赖(本项目运行时用 PostgreSQL,不用 MySQL)。
declare module 'mysql2/promise.js' {
  export interface Pool {
    query<T = Record<string, unknown>[]>(sql: string): Promise<[T, unknown]>
    end(): Promise<void>
  }
  export function createPool(opts: {
    uri: string
    connectionLimit?: number
  }): Pool
}
