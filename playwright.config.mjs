import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* 每个测试的最大运行时间 */
  timeout: 30_000,
  /* 断言的超时时间 */
  expect: {
    timeout: 5000,
  },
  /* 失败时不重试，保持测试纯净 */
  retries: 0,
  /* 并行测试设置（1个 worker 比较稳） */
  workers: 1,
  /* 报告格式 */
  reporter: 'list',
  
  use: {
    /* 基础 URL，匹配您的 dev server */
    baseURL: 'http://localhost:3000',

    /* 即使测试失败也收集追踪信息，方便排查 */
    trace: 'on-first-retry',
    
    /* 核心改动：直接借用本地安装的 Chrome，无需下载 headless-shell */
    channel: 'chrome', 
    
    /* 模拟桌面端配置 */
    ...devices['Desktop Chrome'],
  },

  /* 配置项目 */
  projects: [
    {
      name: 'chromium',
      // 这里已经通过上面的全局 use 配置了 channel: 'chrome'
    },
  ],

  /* 自动启动本地服务器 */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 60_000,
  },
});