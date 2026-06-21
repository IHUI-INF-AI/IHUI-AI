 
/**
 * 前端日志工具
 * 统一管理前端日志输出，支持日志级别控制
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

class Logger {
  private level: LogLevel
  private isDevelopment: boolean

  constructor() {
    // 从环境变量或localStorage读取日志级别
    const envLevel =
      import.meta.env.VITE_LOG_LEVEL?.toUpperCase() ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('LOG_LEVEL')?.toUpperCase()
        : undefined) ||
      'INFO'

    this.level = LogLevel[envLevel as keyof typeof LogLevel] || LogLevel.INFO
    this.isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development'

    // 生产环境默认只显示WARN和ERROR
    if (!this.isDevelopment && this.level < LogLevel.WARN) {
      this.level = LogLevel.WARN
    }
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: string, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString()
    const argsStr = args.length > 0 ? ` ${JSON.stringify(args)}` : ''
    return `[${timestamp}] [${level}] ${message}${argsStr}`
  }

  /**
   * 调试日志（仅在开发环境显示）
   */
  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG && this.isDevelopment) {
      const msg = this.formatMessage('DEBUG', message, ...args)
      console.debug(msg)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('dev-activity', {
            detail: { level: 'DEBUG', message, args },
          })
        )
      }
    }
  }

  /**
   * 信息日志
   */
  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      const msg = this.formatMessage('INFO', message, ...args)
      console.log(msg)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('dev-activity', {
            detail: { level: 'INFO', message, args },
          })
        )
      }
    }
  }

  /**
   * 警告日志
   */
  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      const msg = this.formatMessage('WARN', message, ...args)
      console.warn(msg)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('dev-activity', {
            detail: { level: 'WARN', message, args },
          })
        )
      }
    }
  }

  /**
   * 错误日志
   */
  error(message: string, error?: Error | unknown, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      // 所有错误都记录到控制台，方便调试
      const errorData =
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error
      const msg = this.formatMessage('ERROR', message, errorData, ...args)
      console.error(msg)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('dev-activity', {
            detail: { level: 'ERROR', message, args, error: errorData },
          })
        )
      }

      // 在开发环境显示完整Error stack
      if (this.isDevelopment && error instanceof Error) {
        console.error('Error stack:', error.stack)
      }
    }
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.level = level
    localStorage.setItem('LOG_LEVEL', LogLevel[level])
  }

  /**
   * 获取当前日志级别
   */
  getLevel(): LogLevel {
    return this.level
  }
}

// 导出单例
export const logger = new Logger()

// 兼容性：导出默认导出
export default logger
