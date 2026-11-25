// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本机执行器（桌面端独占，G4）。
 *
 * 浏览器里这些函数不该被调用：`isDesktopHost()` 为 false 时调用方直接不渲染卡片。
 * 命令名与 Rust `invoke_handler!` 逐字同名（`device_executor_status` / `_start` / `_stop`）。
 * 执行逻辑不在这里，也不在桌面端 —— 常驻进程是 CLI `ihui device start`。
 */

export interface DeviceExecutorStatus {
  supported: boolean
  paired: boolean
  deviceName: string | null
  running: boolean
  pid: number | null
  taskRegistered: boolean
}

/** 当前是否在 Tauri 客户端（不是浏览器预览） */
export function isDesktopHost(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean((window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
}

async function invokeCmd<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

export function getDeviceExecutorStatus(): Promise<DeviceExecutorStatus> {
  return invokeCmd<DeviceExecutorStatus>('device_executor_status')
}

export function startDeviceExecutor(): Promise<DeviceExecutorStatus> {
  return invokeCmd<DeviceExecutorStatus>('device_executor_start')
}

export function stopDeviceExecutor(): Promise<DeviceExecutorStatus> {
  return invokeCmd<DeviceExecutorStatus>('device_executor_stop')
}

/** 本机主机名（自助接入时拼默认设备名） */
export function getExecutorHostName(): Promise<string> {
  return invokeCmd<string>('device_executor_host_name')
}

/**
 * 自助接入（G5，2026-11-26）：不需要配对码。
 *
 * 令牌来自 `POST /api/devices/self-token`（登录态换设备令牌，见 api-client），
 * 这里只把令牌与设备名交给桌面端；落盘与指纹计算由 CLI `ihui device adopt` 完成
 * （全仓唯一一份指纹实现，桌面端不另算）。`workspace` 省略时桌面端弹原生目录选择。
 */
export function adoptDeviceExecutor(input: {
  deviceId: string
  deviceToken: string
  name: string
  apiUrl?: string
  workspace?: string
}): Promise<DeviceExecutorStatus> {
  const payload = JSON.stringify({
    device_id: input.deviceId,
    device_token: input.deviceToken,
    name: input.name,
    api_url: input.apiUrl,
  })
  return invokeCmd<DeviceExecutorStatus>('device_executor_adopt', {
    payload,
    workspace: input.workspace ?? null,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
