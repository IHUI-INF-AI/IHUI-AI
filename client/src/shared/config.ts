function getEnvVar(key: string): string | undefined {
  return import.meta.env[key]
}

export interface ApiConfig {
  baseURL: string
  timeout: number
  retryCount: number
}

export interface AppConfig {
  api: ApiConfig
  upload: {
    maxSize: number
    allowedTypes: string[]
  }
  pagination: {
    defaultPageSize: number
    pageSizeOptions: number[]
  }
  theme: {
    defaultTheme: 'light' | 'dark' | 'auto'
  }
}

export interface AppConfigExtended extends AppConfig {
  [key: string]: any
}

interface Logger {
  debug: (message: string, ...args: any[]) => void
}

class ConfigManagerClass {
  private config: AppConfig
  private logger: Logger | null = null
  private readonly defaultConfig: AppConfig = {
    api: {
      baseURL: getEnvVar('VITE_API_BASE_URL') || '/api',
      timeout: parseInt(getEnvVar('VITE_API_TIMEOUT') || '30000'),
      retryCount: 3,
    },
    upload: {
      maxSize: parseInt(getEnvVar('VITE_UPLOAD_MAX_SIZE') || '10485760'),
      allowedTypes: (getEnvVar('VITE_UPLOAD_ALLOWED_TYPES') || 'image/*,application/pdf').split(
        ','
      ),
    },
    pagination: {
      defaultPageSize: parseInt(getEnvVar('VITE_DEFAULT_PAGE_SIZE') || '20'),
      pageSizeOptions: [10, 20, 50, 100],
    },
    theme: {
      defaultTheme: (getEnvVar('VITE_DEFAULT_THEME') as 'light' | 'dark' | 'auto') || 'auto',
    },
  }

  constructor() {
    this.config = { ...this.defaultConfig }
  }

  setLogger(logger: Logger): void {
    this.logger = logger
  }

  getAll(): AppConfig {
    if (this.logger) {
      this.logger.debug('Getting all config:', this.config)
    }
    return { ...this.config }
  }

  getConfig(): AppConfig {
    return { ...this.config }
  }

  setConfig(config: Partial<AppConfig>): void {
    this.config = { ...this.config, ...config }
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value
  }

  getApiConfig(): ApiConfig {
    return { ...this.config.api }
  }

  setApiConfig(config: Partial<ApiConfig>): void {
    this.config.api = { ...this.config.api, ...config }
  }

  reset(): void {
    this.config = { ...this.defaultConfig }
  }

  extend<T extends AppConfigExtended>(config: T): T {
    return { ...this.config, ...config }
  }
}

export const ConfigManager = new ConfigManagerClass()
