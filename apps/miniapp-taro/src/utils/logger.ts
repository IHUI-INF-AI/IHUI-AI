type LogLevel = 'error' | 'warn' | 'info' | 'debug'

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
}

const currentLevel: LogLevel = 'error'

export const logger = {
  error: (module: string, action: string, err: unknown) => {
    if (LOG_LEVELS[currentLevel] >= LOG_LEVELS.error) {
      console.error(`[${module}] ${action} failed:`, err)
    }
  },
  warn: (module: string, action: string, message: string) => {
    if (LOG_LEVELS[currentLevel] >= LOG_LEVELS.warn) {
      console.warn(`[${module}] ${action}: ${message}`)
    }
  },
  info: (module: string, action: string, message: string) => {
    if (LOG_LEVELS[currentLevel] >= LOG_LEVELS.info) {
      console.info(`[${module}] ${action}: ${message}`)
    }
  },
}
