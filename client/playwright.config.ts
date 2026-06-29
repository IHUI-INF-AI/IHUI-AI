import { defineConfig, devices } from '@playwright/test'
import { existsSync } from 'fs'
import { BACKEND_URL, FRONTEND_URL, PREVIEW_URL } from './config/ports'

// =============================================================================
// 端口约定 (2026-06-18 起为单一规范, 详见 client/README.md#开发环境端口约定)
// 8000 = FastAPI 后端 (uvicorn)
// 8888 = Vite dev server (本地 dev 调试)
// 4173 = Vite preview server (CI 集成测试)
// =============================================================================
const isCI = !!process.env.CI && process.env.CI !== 'false' && process.env.CI !== '0'
const isRetriesForced = process.env.PW_RETRIES !== undefined
const retries = isRetriesForced ? Number(process.env.PW_RETRIES) : (isCI ? 2 : 2)
// CI 用 1 worker 避免资源争抢; 本地默认 1 worker 保证视觉回归稳定性
// 如需加速可用 --workers=2 或 PW_WORKERS=2 环境变量(可能引入偶发 flaky)
const workers = isCI ? 1 : (process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : 1)
// PW_BASE_URL: 前端入口 (dev=8888, CI preview=4173)
// PW_BACKEND_URL: 后端直连入口 (默认 8000, 一般只在 e2e 直连时用)
// 端口字面量已抽到 client/config/ports.ts, 改端口只改那一个文件
const baseURL = process.env.PW_BASE_URL ?? FRONTEND_URL
const backendURL = process.env.PW_BACKEND_URL ?? BACKEND_URL
// CI 集成测试时切换到 preview (4173), 避免占用 dev 端口
const ciBaseURL = process.env.CI ? PREVIEW_URL : baseURL

// 离线环境: CDN 拒绝下载新 chromium, 用本地已装的 1208 版本
const LOCAL_CHROMIUM = 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe'
const LOCAL_HEADLESS_SHELL = 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-win64/chrome-headless-shell.exe'

function pickChromium(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
  if (existsSync(LOCAL_CHROMIUM)) return LOCAL_CHROMIUM
  return undefined
}

function pickHeadlessShell(): string | undefined {
  if (process.env.PLAYWRIGHT_HEADLESS_SHELL_EXECUTABLE) return process.env.PLAYWRIGHT_HEADLESS_SHELL_EXECUTABLE
  if (existsSync(LOCAL_HEADLESS_SHELL)) return LOCAL_HEADLESS_SHELL
  return undefined
}

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/node_modules/**', '**/dist/**', '**/visual-regression.spec.ts-snapshots/**', '**/archive/**'],
  fullyParallel: true,
  forbidOnly: isCI,
  retries,
  workers,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['list']]
    : [['html', { open: 'never', outputFolder: 'playwright-report' }], ['list']],
  outputDir: 'test-results',
  timeout: 60000,
  expect: { timeout: 8000 },
  use: {
    baseURL,
    trace: isCI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: isCI ? 'retain-on-failure' : 'off',
    actionTimeout: 8000,
    navigationTimeout: 25000,
    // 全局禁用动画:确保 CI 和本地环境一致,避免 JS 动画(打字机/跑马灯)导致视觉回归不稳定
    reducedMotion: 'reduce',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'zh-CN',
        ...(pickChromium()
          ? {
              launchOptions: {
                executablePath: pickChromium(),
                args: ['--disable-features=ServiceWorker'],
              },
            }
          : {
              launchOptions: {
                args: ['--disable-features=ServiceWorker'],
              },
            }),
      },
    },
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        locale: 'zh-CN',
        ...(pickHeadlessShell()
          ? {
              launchOptions: {
                executablePath: pickHeadlessShell(),
                args: ['--disable-features=ServiceWorker'],
              },
            }
          : {
              launchOptions: {
                args: ['--disable-features=ServiceWorker'],
              },
            }),
      },
    },
  ],
  metadata: {
    baseURL,
    backendURL,
    ciMode: isCI,
    testDir: './e2e',
  },
  webServer: {
    command: 'npm run dev',
    url: FRONTEND_URL,
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
})
