"""静态测试页面 - 内置的接口测试页面"""

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter()


@router.get("", response_class=HTMLResponse, summary="测试页面首页")
def index():
    return HTMLResponse(
        """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>API 测试中心</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 20px; background: #f5f7fa; color: #2c3e50; }
.wrap { max-width: 1200px; margin: 0 auto; }
h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 12px; }
.menu { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
.menu a { padding: 8px 16px; background: #3498db; color: white; border-radius: 4px; text-decoration: none; font-size: 14px; }
.menu a:hover { background: #2980b9; }
.box { background: white; border-radius: 6px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
h2 { color: #34495e; margin-top: 0; }
.module { padding: 8px 0; border-bottom: 1px solid #ecf0f1; }
.module:last-child { border-bottom: 0; }
.code { background: #2c3e50; color: #ecf0f1; padding: 12px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 13px; }
.btn { padding: 6px 12px; background: #27ae60; color: white; border: 0; border-radius: 3px; cursor: pointer; margin-right: 6px; }
.btn:hover { background: #229954; }
</style>
</head>
<body>
<div class="wrap">
<h1>API 测试中心</h1>
<div class="menu">
<a href="/api/v1/test/health">健康检查</a>
<a href="/api/v1/test/docs">API 列表</a>
<a href="/docs">Swagger 文档</a>
<a href="/redoc">ReDoc 文档</a>
</div>
<div class="box">
<h2>服务概览</h2>
<p>本测试页面用于检查所有后端 API 服务是否正常运行.所有 API 入口均通过统一前缀 <code>/api/v1</code> 暴露.</p>
<div class="module"><b>高优先级模块</b>: 问答(ask) / 圈子(circle) / 考试(exam) / 直播(live) / 消息(message) / 通知(notification) / 积分(point) / 搜索(search) / 访问追踪(visit) / 行为(behavior)</div>
<div class="module"><b>中优先级模块</b>: 日程(schedule) / 排行榜(ranking) / 视频预读(video-preload) / 实名认证(auth-identity) / 广告(advertise) / 组织(organization) / 反馈(feedback) / Agent任务(agent-need-task) / 代理商使用(agent-usedetail) / 用户上下文(user-agent-context)</div>
<div class="module"><b>低优先级模块</b>: 露雅拉代理(luyala-proxy) / OpenRouter代理(openrouter-proxy) / 外呼回调(callback) / 用户模型聊天(user-model-chat) / 豆包图片编辑(doubao-image-edit) / 通义图像编辑(tongyi-image-edit) / 通义图生图(tongyi-image2image) / 实时服务目录(service-catalog)</div>
<h2>示例调用</h2>
<div class="code">curl http://localhost:8000/api/v1/ask/question/public-api/list</div>
<p><a class="btn" href="/docs">查看 Swagger 文档</a><a class="btn" href="/redoc">查看 ReDoc 文档</a></p>
</div>
</div>
</body>
</html>
"""
    )


@router.get("/health", summary="健康检查")
def health():
    return {"status": "ok", "code": 0, "data": {"healthy": True, "service": "ihui-ai-edu-server"}}


@router.get("/docs-page", response_class=HTMLResponse, summary="API文档页面")
def docs_page():
    return HTMLResponse(
        """
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>API 列表</title>
<style>body{font-family:sans-serif;padding:20px;background:#fafafa;color:#2c3e50}h1{color:#2c3e50}h2{color:#34495e;border-bottom:1px solid #ddd;padding-bottom:6px}ul{line-height:1.8}</style>
</head>
<body>
<h1>API 接口列表</h1>
<h2>Ask 问答</h2><ul><li>GET /api/v1/ask/category/public-api/list</li><li>GET /api/v1/ask/question/public-api/list</li><li>GET /api/v1/ask/question/public-api</li><li>POST /api/v1/ask/answer</li></ul>
<h2>Circle 圈子</h2><ul><li>GET /api/v1/circle/circle/list</li><li>GET /api/v1/circle/circle/{id}</li><li>GET /api/v1/circle/post/list</li></ul>
<h2>Exam 考试</h2><ul><li>GET /api/v1/exam/paper/list</li><li>GET /api/v1/exam/paper/{id}</li><li>POST /api/v1/exam/record/start</li></ul>
<h2>Live 直播</h2><ul><li>GET /api/v1/live/channel/list</li><li>POST /api/v1/live/channel/{id}/start</li></ul>
<h2>Point 积分</h2><ul><li>GET /api/v1/point/account</li><li>POST /api/v1/point/signin</li><li>GET /api/v1/point/goods/list</li></ul>
<h2>Visit 访问追踪</h2><ul><li>POST /api/v1/visit/track</li><li>GET /api/v1/visit/stats/today</li></ul>
<h2>完整文档</h2><ul><li><a href="/docs">/docs (Swagger UI)</a></li><li><a href="/redoc">/redoc (ReDoc)</a></li></ul>
</body></html>
"""
    )
