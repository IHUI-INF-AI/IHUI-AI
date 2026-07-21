/**
 * AI 电脑控制 Tauri IPC 封装(2026-07-22 立)
 *
 * 10 个 computer_control action 的前端调用层,对应 src-tauri/src/lib.rs 中的 #[tauri::command]。
 * 调用方需确保在 Tauri 运行时环境(非浏览器)下使用,否则 invoke 会抛错。
 */
import { invoke } from '@tauri-apps/api/core'
import type {
  ComputerClipboardGetParams,
  ComputerClipboardSetParams,
  ComputerKeyboardHotkeyParams,
  ComputerKeyboardPressParams,
  ComputerKeyboardTypeParams,
  ComputerMouseClickParams,
  ComputerMouseMoveParams,
  ComputerMouseScrollParams,
  ComputerScreenshotScreenParams,
} from '@ihui/types'

type Args = Record<string, unknown>

export interface ScreenshotResult {
  screenshot: string
}
export interface OkResult {
  ok: boolean
}
export interface WindowInfo {
  title: string
  appName: string
  bounds: [number, number, number, number]
}
export interface ActiveWindowResult {
  window: WindowInfo
}
export interface ClipboardResult {
  clipboard: string
}

export function screenshotScreen(
  params?: ComputerScreenshotScreenParams,
): Promise<ScreenshotResult> {
  return invoke<ScreenshotResult>('screenshot_screen', params as unknown as Args)
}

export function mouseMove(params: ComputerMouseMoveParams): Promise<OkResult> {
  return invoke<OkResult>('mouse_move', params as unknown as Args)
}

export function mouseClick(params: ComputerMouseClickParams): Promise<OkResult> {
  return invoke<OkResult>('mouse_click', params as unknown as Args)
}

export function keyboardType(
  params: ComputerKeyboardTypeParams,
): Promise<OkResult> {
  return invoke<OkResult>('keyboard_type', params as unknown as Args)
}

export function mouseScroll(
  params: ComputerMouseScrollParams,
): Promise<OkResult> {
  return invoke<OkResult>('mouse_scroll', params as unknown as Args)
}

export function keyboardPress(
  params: ComputerKeyboardPressParams,
): Promise<OkResult> {
  return invoke<OkResult>('keyboard_press', params as unknown as Args)
}

export function keyboardHotkey(
  params: ComputerKeyboardHotkeyParams,
): Promise<OkResult> {
  return invoke<OkResult>('keyboard_hotkey', params as unknown as Args)
}

export function activeWindow(): Promise<ActiveWindowResult> {
  return invoke<ActiveWindowResult>('active_window')
}

export function clipboardGet(
  params?: ComputerClipboardGetParams,
): Promise<ClipboardResult> {
  return invoke<ClipboardResult>('clipboard_get', params as unknown as Args)
}

export function clipboardSet(
  params: ComputerClipboardSetParams,
): Promise<OkResult> {
  return invoke<OkResult>('clipboard_set', params as unknown as Args)
}
