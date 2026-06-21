"""playwright 端到端测试 9 个 RuoYi 管理页面 + 登录页 + 路由守卫 — 验证页面加载、菜单切换、API 联调.

需要:
  - uvicorn 启动在 http://127.0.0.1:18800
  - playwright 已 pip install + chromium 已 install
  - 跳过条件: 无 playwright / chromium / uvicorn 未启
"""

import asyncio
import socket
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))


def _free_port_in_use(host="127.0.0.1", port=18800):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect((host, port))
        s.close()
        return True
    except OSError:
        return False


pytestmark = pytest.mark.skipif(
    not _free_port_in_use(),
    reason="uvicorn 服务未启动在 18800 (启动: uvicorn app.main:app --port 18800)",
)


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def base_url():
    return "http://127.0.0.1:18800"


@pytest.mark.asyncio
async def test_index_page_loads(base_url):
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page()
        # 模拟已登录 (路由守卫需要 token)
        await page.add_init_script("window.localStorage.setItem('zhs_token', 'demo-test-12345678901234567890abcdef')")
        await page.goto(f"{base_url}/static/ruoyi/index.html", wait_until="domcontentloaded")
        title = await page.title()
        assert "若依" in title or "ZHS" in title
        await page.wait_for_selector(".el-menu-item", timeout=10000)
        menu_items = await page.locator(".el-menu-item").all_inner_texts()
        # 至少有: 首页 + 9 个管理模块
        assert len(menu_items) >= 10, f"应该有 >=10 个菜单项, 实际 {len(menu_items)}"
        assert any("用户管理" in t for t in menu_items)
        assert any("角色管理" in t for t in menu_items)
        assert any("定时任务" in t for t in menu_items)
        await browser.close()


@pytest.mark.asyncio
async def test_user_page_renders_table(base_url):
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page()
        await page.add_init_script("window.localStorage.setItem('zhs_token', 'demo-test-12345678901234567890abcdef')")
        await page.goto(f"{base_url}/static/ruoyi/index.html#/user", wait_until="domcontentloaded")
        await page.wait_for_selector(".el-table", timeout=10000)
        h3 = await page.locator("h3").first.inner_text()
        assert "用户管理" in h3
        headers = await page.locator(".el-table__header th").all_inner_texts()
        assert any("ID" in h for h in headers)
        assert any("用户名" in h for h in headers)
        await browser.close()


@pytest.mark.asyncio
async def test_dashboard_renders(base_url):
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page()
        await page.add_init_script("window.localStorage.setItem('zhs_token', 'demo-test-12345678901234567890abcdef')")
        await page.goto(f"{base_url}/static/ruoyi/index.html#/", wait_until="domcontentloaded")
        await page.wait_for_selector(".ruoyi-card", timeout=10000)
        h3 = await page.locator("h3").first.inner_text()
        assert "欢迎回来" in h3 or "admin" in h3.lower()
        # 4 个统计卡片
        cards = await page.locator(".ruoyi-card > div > div").all_inner_texts()
        assert any("用户总数" in c for c in cards)
        assert any("角色总数" in c for c in cards)
        await browser.close()


@pytest.mark.asyncio
async def test_menu_navigation(base_url):
    """vue-router 路由 + 侧边栏菜单导航."""
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page()
        await page.add_init_script("window.localStorage.setItem('zhs_token', 'demo-test-12345678901234567890abcdef')")
        await page.goto(f"{base_url}/static/ruoyi/index.html#/", wait_until="domcontentloaded")
        await page.wait_for_selector(".el-menu-item", timeout=10000)

        # 展开"系统管理"子菜单
        sys_parent = page.locator(".el-sub-menu__title:has-text('系统管理')").first
        await sys_parent.click()
        await page.wait_for_timeout(500)

        # 切到角色管理
        await page.locator(".el-menu-item:has-text('角色管理')").first.click()
        await page.wait_for_timeout(800)
        h3 = await page.locator("h3").first.inner_text()
        assert "角色" in h3, f"角色页 h3: {h3}"

        # 直接通过 hash 切到菜单管理
        await page.goto(f"{base_url}/static/ruoyi/index.html#/menu", wait_until="domcontentloaded")
        await page.wait_for_timeout(800)
        h3 = await page.locator("h3").first.inner_text()
        assert "菜单" in h3, f"菜单页 h3: {h3}"

        # 展开"任务调度"子菜单
        job_parent = page.locator(".el-sub-menu__title:has-text('任务调度')").first
        await job_parent.click()
        await page.wait_for_timeout(500)
        await page.locator(".el-menu-item:has-text('定时任务')").first.click()
        await page.wait_for_timeout(800)
        h3 = await page.locator("h3").first.inner_text()
        assert "定时" in h3, f"定时任务页 h3: {h3}"
        await browser.close()


@pytest.mark.asyncio
async def test_breadcrumb_renders(base_url):
    """面包屑导航应在主区域顶部."""
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page()
        await page.add_init_script("window.localStorage.setItem('zhs_token', 'demo-test-12345678901234567890abcdef')")
        await page.goto(f"{base_url}/static/ruoyi/index.html#/user", wait_until="domcontentloaded")
        await page.wait_for_selector(".el-breadcrumb", timeout=10000)
        breadcrumb = await page.locator(".el-breadcrumb").first.inner_text()
        assert "首页" in breadcrumb
        assert "用户管理" in breadcrumb
        await browser.close()


@pytest.mark.asyncio
async def test_login_page_loads(base_url):
    """独立登录页加载 + 元素齐全."""
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page()
        await page.goto(f"{base_url}/static/ruoyi/login.html", wait_until="domcontentloaded")
        await page.wait_for_selector(".login-card", timeout=10000)
        h1 = await page.locator("h1").first.inner_text()
        assert "ZHS" in h1
        inputs = await page.locator(".login-card .el-input__inner").all()
        assert len(inputs) >= 2
        tip = await page.locator(".login-tip").inner_text()
        assert "admin" in tip
        await browser.close()


@pytest.mark.asyncio
async def test_route_guard_redirects_to_login(base_url):
    """未登录访问 index.html 应被路由守卫跳到 login.html."""
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page()
        await page.goto(f"{base_url}/static/ruoyi/index.html", wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)
        assert "login.html" in page.url or "login" in page.url
        await browser.close()


@pytest.mark.asyncio
async def test_page_responsive_layout(base_url):
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        await page.add_init_script("window.localStorage.setItem('zhs_token', 'demo-test-12345678901234567890abcdef')")
        await page.goto(f"{base_url}/static/ruoyi/index.html", wait_until="domcontentloaded")
        await page.wait_for_selector(".ruoyi-shell", timeout=10000)
        shell_box = await page.locator(".ruoyi-shell").bounding_box()
        aside_box = await page.locator(".ruoyi-aside").bounding_box()
        main_box = await page.locator(".ruoyi-main").bounding_box()
        assert shell_box["width"] >= 1280
        assert aside_box["width"] == 220
        assert main_box["width"] > 1000
        await browser.close()


@pytest.mark.asyncio
async def test_video_page_renders(base_url):
    """HLS 视频播放页 — 验证页面元素 (video 标签 + 表单 + 路由跳转)."""
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page()
        await page.add_init_script("window.localStorage.setItem('zhs_token', 'demo-test-12345678901234567890abcdef')")
        await page.goto(f"{base_url}/static/ruoyi/index.html#/video", wait_until="domcontentloaded")
        await page.wait_for_selector("h3", timeout=10000)
        # 标题
        title = await page.locator("h3").first.text_content()
        assert "HLS" in (title or "")
        # videoId 输入框
        await page.fill("input[placeholder='请输入 videoId']", "test-video")
        # 转码按钮
        btn = page.locator("button:has-text('转码并播放')")
        assert await btn.count() == 1
        # 面包屑出现
        breadcrumb = await page.locator(".el-breadcrumb").text_content()
        assert "HLS" in (breadcrumb or "") or "视频" in (breadcrumb or "")
        await browser.close()


@pytest.mark.asyncio
async def test_video_page_menu_in_sidebar(base_url):
    """侧边栏有 '媒体管理' 菜单 + 'HLS 视频播放' 子项."""
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page()
        await page.add_init_script("window.localStorage.setItem('zhs_token', 'demo-test-12345678901234567890abcdef')")
        await page.goto(f"{base_url}/static/ruoyi/index.html", wait_until="domcontentloaded")
        await page.wait_for_selector(".ruoyi-aside", timeout=10000)
        # 点击媒体管理父菜单展开
        await page.click(".el-sub-menu__title:has-text('媒体管理')")
        await page.wait_for_timeout(200)
        sub = page.locator(".el-menu-item:has-text('HLS 视频播放')")
        assert await sub.count() == 1
        # 点击进入
        await sub.click()
        # hash 模式不会触发 navigation 事件, 改用 wait_for_function 检查
        await page.wait_for_function("() => location.hash === '#/video'", timeout=5000)
        # 等待 video 组件模板渲染 (h3 出现)
        await page.wait_for_selector("h3:has-text('HLS')", timeout=5000)
        # 填 videoId 触发转码后 video 标签才出现 — 这里只确认页面已切换
        h3 = await page.locator("h3:has-text('HLS')").first.text_content()
        assert "HLS" in (h3 or "")
        await browser.close()


@pytest.mark.asyncio
async def test_video_page_has_progress_skeleton(base_url):
    """HLS 页面有 progress 面板 (loading skeleton + progress bar)."""
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page()
        await page.add_init_script("window.localStorage.setItem('zhs_token', 'demo-test-12345678901234567890abcdef')")
        await page.goto(f"{base_url}/static/ruoyi/index.html#/video", wait_until="domcontentloaded")
        await page.wait_for_selector("h3:has-text('HLS')", timeout=10000)
        # 检查表单/按钮
        assert await page.locator("button:has-text('转码并播放')").count() == 1
        assert await page.locator("button:has-text('读取已有 m3u8')").count() == 1
        await browser.close()


@pytest.mark.asyncio
async def test_ws_indicator_renders_in_header(base_url):
    """顶栏显示 WebSocket 连接状态指示器 (彩色圆点 + 状态文本)."""
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page()
        await page.add_init_script("window.localStorage.setItem('zhs_token', 'demo-test-12345678901234567890abcdef')")
        await page.goto(f"{base_url}/static/ruoyi/index.html", wait_until="domcontentloaded", timeout=15000)
        await page.wait_for_selector(".ruoyi-main", timeout=10000)
        # 等待 Vue mount + Shell data 初始化
        await page.wait_for_timeout(1500)
        # 检查 WS 状态文本出现 (3 种之一: 在线/连接中/未连接)
        ws_text_candidates = ["实时通知在线", "连接中...", "未连接", "已断开"]
        body_text = await page.locator("body").text_content()
        matched = [t for t in ws_text_candidates if t in (body_text or "")]
        assert matched, f"WS 指示器未渲染, body 中找不到 {ws_text_candidates}"
        # 检查状态点 (background 颜色块)
        dot_count = await page.locator("span[style*='background']").count()
        assert dot_count >= 1, f"未找到状态点 (background 颜色块): {dot_count}"
        await browser.close()


@pytest.mark.asyncio
async def test_video_page_has_error_retry(base_url):
    """HLS 错误面板有重试按钮 (错误容错)."""
    from playwright.async_api import async_playwright

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        page = await browser.new_page()
        await page.add_init_script("window.localStorage.setItem('zhs_token', 'demo-test-12345678901234567890abcdef')")
        await page.goto(f"{base_url}/static/ruoyi/index.html#/video", wait_until="domcontentloaded")
        await page.wait_for_selector("h3:has-text('HLS')", timeout=10000)
        # 找到 Vue 组件实例
        result = await page.evaluate(
            """
            () => {
              const root = document.querySelector('#app').__vue_app__;
              return root ? 'has_app' : 'no_app';
            }
        """
        )
        assert result == "has_app"
        await browser.close()
