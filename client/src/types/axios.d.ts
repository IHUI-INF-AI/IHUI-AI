import 'axios'

declare module 'axios' {
  interface AxiosRequestConfig {
    base?: number
  }
  interface InternalAxiosRequestConfig {
    base?: number
  }
}
