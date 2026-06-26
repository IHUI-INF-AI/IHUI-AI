"""Master router - only imports modules that actually have route files."""

from fastapi import APIRouter

# --- Agents ---
from app.api.v1.agents.agents import router as agents_router
from app.api.v1.agents.buy import router as buy_router
from app.api.v1.agents.cache import router as cache_router
from app.api.v1.agents.categories import router as categories_router
# 2026-06-26: 用户确认纳入封版, 注册 agents.category_link 端点
from app.api.v1.agents.category_link import router as agents_category_link_router
from app.api.v1.agents.creation import router as creation_router
from app.api.v1.agents.developer import router as developer_router
from app.api.v1.agents.examine import router as examine_router
from app.api.v1.agents.heat import router as heat_router
from app.api.v1.agents.identity import router as identity_router
from app.api.v1.agents.rules import router as rules_router
from app.api.v1.agents.settlement import router as settlement_router
from app.api.v1.agents.withdrawal import router as agent_withdrawal_router

# --- Audio (TTS / ASR / Voiceprint / Audio Chat) ---
from app.api.v1.ai.audio.route import router as audio_router
from app.api.v1.ai.audio.voiceprint import router as voiceprint_router
from app.api.v1.ai.bailian.route import router as bailian_router

# --- AI Proxies ---
from app.api.v1.ai.dashscope.route import router as dashscope_router
from app.api.v1.ai.doubao.route import router as doubao_router
from app.api.v1.ai.gemini.route import router as gemini_router
from app.api.v1.ai.jimeng4 import router as jimeng4_router
from app.api.v1.ai.model_info import router as ai_model_info_router
from app.api.v1.ai.n8n.route import router as n8n_router
from app.api.v1.ai.sora2.route import router as sora2_router
from app.api.v1.ai.suno.route import router as suno_router
from app.api.v1.ai.tencent.route import router as tencent_router
from app.api.v1.ai.video_tasks import router as video_tasks_router
from app.api.v1.ai.volcengine.route import router as volcengine_router
from app.api.v1.auth.ali_login import router as ali_login_router
from app.api.v1.auth.bindings import router as bindings_router

# --- Captcha / Login ---
from app.api.v1.auth.captcha import router as captcha_router
from app.api.v1.auth.dingtalk import router as dingtalk_router
from app.api.v1.auth.enterprise_wechat import router as enterprise_wechat_router
from app.api.v1.auth.feishu import router as feishu_router

# --- Authentication ---
from app.api.v1.auth.google import router as google_router
from app.api.v1.auth.login import router as login_router
from app.api.v1.auth.oauth import router as oauth_router
from app.api.v1.auth.coze_oauth import router as coze_oauth_router
from app.api.v1.auth.sms import router as sms_router

# --- Auth (User SK) ---
from app.api.v1.auth.user_sk import router as user_sk_router
from app.api.v1.auth.username_login import router as username_login_router
from app.api.v1.auth.wechat import router as wechat_router

# --- SSO & JWT KeyPair (迁移自 edu Java 微服务) ---
from app.api.v1.auth.keypair import router as keypair_router
from app.api.v1.auth.sso import router as sso_router

# --- Orders (通用订单管理, 迁移自 edu Java 微服务) ---
from app.api.v1.orders import router as orders_router

# --- Member 会员域 (EduMember / Company / Tag / Post / Group / Level / CheckIn / Follow) ---
from app.api.v1.member import router as member_router

# --- Bots ---
from app.api.v1.bots.bots import router as bots_router
from app.api.v1.bots.chat import router as bots_chat_router

# --- Canary ---
from app.api.v1.canary_routes import router as canary_router

# --- Chat ---
from app.api.v1.chat.coze import router as chat_router
from app.api.v1.chat.deepseek import router as deepseek_router
from app.api.v1.chat.doubao import router as doubao_ws_router
from app.api.v1.chat.history import router as chat_history_router
from app.api.v1.chat.kling import router as kling_router
from app.api.v1.chat.multi import router as multi_router
from app.api.v1.chat.qwen import router as qwen_router
from app.api.v1.chat.qwen_omni import router as qwen_omni_router
from app.api.v1.chat.zhipu import router as zhipu_ws_router

# --- Content ---
from app.api.v1.content.about_us import router as about_us_router
from app.api.v1.content.activity import router as activity_router
from app.api.v1.content.cms import router as content_cms_router
from app.api.v1.content.contact import router as contact_router
from app.api.v1.content.file_storage import router as file_storage_router
from app.api.v1.content.information import router as information_router

# --- Courses ---
from app.api.v1.courses.courses import router as courses_router

# --- Finance ---
from app.api.v1.finance.commission import router as commission_router
from app.api.v1.finance.distribution import router as distribution_router
from app.api.v1.finance.fund import router as finance_fund_router
from app.api.v1.finance.fund_info import router as finance_fund_info_router
from app.api.v1.finance.margin import router as margin_router
from app.api.v1.finance.withdrawal import router as withdrawal_router

# --- MCP ---
from app.api.v1.mcp import router as mcp_router

# --- Monitor ---
from app.api.v1.monitor.alerts import router as monitor_alerts_router
from app.api.v1.monitor.backfill import router as monitor_backfill_router
from app.api.v1.monitor.canary_audit import router as monitor_canary_audit_router
from app.api.v1.monitor.canary_promoter import router as monitor_canary_promoter_router
from app.api.v1.monitor.inhibition_playground import router as monitor_inhibition_playground_router
from app.api.v1.payments.alipay import router as alipay_router
from app.api.v1.payments.alipay_fund import router as alipay_fund_router
from app.api.v1.payments.fund import router as fund_router
from app.api.v1.payments.reconciliation import router as reconciliation_router

# --- Payments ---
from app.api.v1.payments.wechat import router as wechat_pay_router
from app.api.v1.resource.context import router as resource_context_router

# --- Resource ---
from app.api.v1.resource.home import router as resource_home_router

# --- Users ---
from app.api.v1.system.admin import router as sys_admin_router
from app.api.v1.system.audit import router as sys_audit_router
from app.api.v1.system.auto_recovery import router as sys_auto_recovery_router
from app.api.v1.system.codegen import router as sys_codegen_router

# --- System ---
from app.api.v1.system.dictionary import router as sys_dictionary_router
from app.api.v1.system.user import router as sys_user_router

# --- Tools ---
from app.api.v1.tools import router as tools_router
from app.api.v1.user.users import router as users_router
from app.api.v1.user.vip import router as vip_router

# --- WebSocket timbre (HTTP CRUD) ---
from app.api.v1.ws.timbre import router as ws_timbre_router

# --- WebSocket Admin (Fault Tolerance & Monitoring) ---
from app.api.v1.ws_admin import router as ws_admin_router

# --- Personality (可选) ---
try:
    from app.api.v1.tools.personality import router as personality_router

    HAS_PERSONALITY = True
except Exception:
    personality_router = None
    HAS_PERSONALITY = False

# --- Developer Link (Agent 域 -- Coze 账号绑定) ---
from app.api.v1.agents.developer_link import router as developer_link_router

# --- Agent Rule Params ---
from app.api.v1.agents.rule_params import router as rule_params_router

# --- SMS Proxy ---
from app.api.v1.auth.sms_proxy import router as sms_proxy_router

# --- AIGC ---
from app.api.v1.content.aigc import router as aigc_router

# --- Courses Ext ---
from app.api.v1.courses.courses_ext import router as courses_ext_router
from app.api.v1.coze.apps import router as coze_apps_router
from app.api.v1.coze.audio import router as coze_audio_router
from app.api.v1.coze.chat_audio import router as coze_chat_audio_router

# --- Coze ---
from app.api.v1.coze.conversations import router as coze_conversations_router
from app.api.v1.coze.datasets import router as coze_datasets_router
from app.api.v1.coze.files import router as coze_files_router
from app.api.v1.coze.review import router as coze_review_router
from app.api.v1.coze.templates import router as coze_templates_router
from app.api.v1.coze.variables import router as coze_variables_router
from app.api.v1.coze.workflows import router as coze_workflows_router
from app.api.v1.coze.workflows_async import router as coze_workflows_async_router
from app.api.v1.coze.workspaces import router as coze_workspaces_router

# --- Product (Finance 域 -- 历史 zhs_product 表) ---
from app.api.v1.finance.product import router as product_router

# --- Product Identity (Finance 域 -- 开通身份订单) ---
from app.api.v1.finance.product_identity import router as product_identity_router

# --- LLM Models ---
from app.api.v1.llm.models_unify import router as llm_models_unify_router
from app.api.v1.llm.ws import router as llm_ws_router

# --- Multi-Agent Crew (多智能体协作) ---
try:
    from app.api.v1.crew import router as crew_router

    HAS_CREW = True
except Exception:
    crew_router = None
    HAS_CREW = False

# --- Knowledge RAG (知识库) ---
try:
    from app.api.v1.knowledge import router as knowledge_router

    HAS_KNOWLEDGE = True
except Exception:
    knowledge_router = None
    HAS_KNOWLEDGE = False

# --- Remote Device ---
from app.api.v1.remote import router as remote_router
from app.api.v1.remote import third_router as remote_third_router

# --- Refund 退款流程 ---
from app.api.v1.refund import router as refund_router

# --- Stock Analyse ---
from app.api.v1.stock.analyse import router as stock_analyse_router

# --- Video ---
from app.api.v1.video import router as video_router

# --- File Upload (可选) ---
try:
    from app.api.v1.content.file_upload import router as file_upload_router

    HAS_FILE_UPLOAD = True
except Exception:
    try:
        from app.api.v1.resource.file_upload import router as file_upload_router

        HAS_FILE_UPLOAD = True
    except Exception:
        file_upload_router = None
        HAS_FILE_UPLOAD = False

# --- Ask 问答社区 ---
try:
    from app.api.v1.ask import router as ask_router

    HAS_ASK = True
except Exception:
    ask_router = None
    HAS_ASK = False

# --- Circle 圈子社区 ---
try:
    from app.api.v1.circle import router as circle_router

    HAS_CIRCLE = True
except Exception:
    circle_router = None
    HAS_CIRCLE = False

# --- Exam 考试系统 ---
try:
    from app.api.v1.exam import router as exam_router

    HAS_EXAM = True
except Exception:
    exam_router = None
    HAS_EXAM = False

# --- Live 直播 ---
try:
    from app.api.v1.live import router as live_router

    HAS_LIVE = True
except Exception:
    live_router = None
    HAS_LIVE = False

# --- Message 消息通知 ---
try:
    from app.api.v1.message import router as message_router

    HAS_MESSAGE = True
except Exception:
    message_router = None
    HAS_MESSAGE = False

# --- Notification 通知系统 ---
try:
    from app.api.v1.notification import router as notification_router

    HAS_NOTIFICATION = True
except Exception:
    notification_router = None
    HAS_NOTIFICATION = False

# --- Point 积分体系 ---
try:
    from app.api.v1.point import router as point_router

    HAS_POINT = True
except Exception:
    point_router = None
    HAS_POINT = False

# --- Search 搜索 ---
try:
    from app.api.v1.search import router as search_router

    HAS_SEARCH = True
except Exception:
    search_router = None
    HAS_SEARCH = False

# --- Visit 访问追踪 ---
try:
    from app.api.v1.visit import router as visit_router

    HAS_VISIT = True
except Exception:
    visit_router = None
    HAS_VISIT = False

# --- Behavior 行为分析 ---
try:
    from app.api.v1.behavior import router as behavior_router

    HAS_BEHAVIOR = True
except Exception:
    behavior_router = None
    HAS_BEHAVIOR = False

# --- Schedule 日程 ---
try:
    from app.api.v1.schedule import router as schedule_router

    HAS_SCHEDULE = True
except Exception:
    schedule_router = None
    HAS_SCHEDULE = False

# --- Ranking 排行榜 ---
try:
    from app.api.v1.ranking import router as ranking_router

    HAS_RANKING = True
except Exception:
    ranking_router = None
    HAS_RANKING = False

# --- Advertise 广告管理 ---
try:
    from app.api.v1.advertise import router as advertise_router

    HAS_ADVERTISE = True
except Exception:
    advertise_router = None
    HAS_ADVERTISE = False

# --- Organization 组织管理 ---
try:
    from app.api.v1.organization import router as organization_router

    HAS_ORGANIZATION = True
except Exception:
    organization_router = None
    HAS_ORGANIZATION = False

# --- Feedback 用户反馈 ---
try:
    from app.api.v1.feedback import router as feedback_router

    HAS_FEEDBACK = True
except Exception:
    feedback_router = None
    HAS_FEEDBACK = False

# --- Auth Identity 实名认证 ---
try:
    from app.api.v1.auth_identity import router as auth_identity_router

    HAS_AUTH_IDENTITY = True
except Exception:
    auth_identity_router = None
    HAS_AUTH_IDENTITY = False

# --- App Version 小程序版本管理 ---
try:
    from app.api.v1.app_version import router as app_version_router

    HAS_APP_VERSION = True
except Exception:
    app_version_router = None
    HAS_APP_VERSION = False

# --- Agent Upload Agent上传 ---
try:
    from app.api.v1.agent_upload import router as agent_upload_router

    HAS_AGENT_UPLOAD = True
except Exception:
    agent_upload_router = None
    HAS_AGENT_UPLOAD = False

# --- Category Dictionary 分类字典 ---
try:
    from app.api.v1.category_dictionary import router as category_dict_router

    HAS_CATEGORY_DICT = True
except Exception:
    category_dict_router = None
    HAS_CATEGORY_DICT = False

# --- Education Platform 教育平台 ---
try:
    from app.api.v1.education_platform import router as education_platform_router

    HAS_EDU_PLATFORM = True
except Exception:
    education_platform_router = None
    HAS_EDU_PLATFORM = False

# --- Course Audit 课程审核 ---
try:
    from app.api.v1.course_audit import router as course_audit_router

    HAS_COURSE_AUDIT = True
except Exception:
    course_audit_router = None
    HAS_COURSE_AUDIT = False

# --- User Comment Log 评论日志 ---
try:
    from app.api.v1.user_comment_log import router as user_comment_log_router

    HAS_USER_COMMENT_LOG = True
except Exception:
    user_comment_log_router = None
    HAS_USER_COMMENT_LOG = False

# --- User Video Log 视频观看日志 ---
try:
    from app.api.v1.user_video_log import router as user_video_log_router

    HAS_USER_VIDEO_LOG = True
except Exception:
    user_video_log_router = None
    HAS_USER_VIDEO_LOG = False

# --- User Video Comment 视频评论 ---
try:
    from app.api.v1.user_video_comment import router as user_video_comment_router

    HAS_USER_VIDEO_COMMENT = True
except Exception:
    user_video_comment_router = None
    HAS_USER_VIDEO_COMMENT = False

# --- TBox 第三方设备 ---
try:
    from app.api.v1.tbox import router as tbox_router

    HAS_TBOX = True
except Exception:
    tbox_router = None
    HAS_TBOX = False

# --- Agent Need Task Agent需求任务 ---
try:
    from app.api.v1.agent_need_task import router as agent_need_task_router

    HAS_AGENT_NEED_TASK = True
except Exception:
    agent_need_task_router = None
    HAS_AGENT_NEED_TASK = False

# --- Agent Use Detail 代理商使用明细 ---
try:
    from app.api.v1.agent_usedetail import router as agent_usedetail_router

    HAS_AGENT_USEDETAIL = True
except Exception:
    agent_usedetail_router = None
    HAS_AGENT_USEDETAIL = False

# --- User Agent Context 用户上下文 ---
try:
    from app.api.v1.user_agent_context import router as user_agent_context_router

    HAS_USER_AGENT_CONTEXT = True
except Exception:
    user_agent_context_router = None
    HAS_USER_AGENT_CONTEXT = False

# --- User Agent Image 用户图片交互 ---
try:
    from app.api.v1.user_agent_image import router as user_agent_image_router

    HAS_USER_AGENT_IMAGE = True
except Exception:
    user_agent_image_router = None
    HAS_USER_AGENT_IMAGE = False

# --- Video Preload 视频预读 ---
try:
    from app.api.v1.video_preload import router as video_preload_router
    HAS_VIDEO_PRELOAD = True
except Exception:
    video_preload_router = None
    HAS_VIDEO_PRELOAD = False

# --- Luyala Proxy 露雅拉代理 ---
try:
    from app.api.v1.luyala_proxy import router as luyala_proxy_router
    HAS_LUYALA_PROXY = True
except Exception:
    luyala_proxy_router = None
    HAS_LUYALA_PROXY = False

# --- OpenRouter Proxy ---
try:
    from app.api.v1.openrouter_proxy import router as openrouter_proxy_router
    HAS_OPENROUTER_PROXY = True
except Exception:
    openrouter_proxy_router = None
    HAS_OPENROUTER_PROXY = False

# --- Callback 外呼回调 ---
try:
    from app.api.v1.callback import router as callback_router
    HAS_CALLBACK = True
except Exception:
    callback_router = None
    HAS_CALLBACK = False

# --- User Model Chat 用户模型聊天 ---
try:
    from app.api.v1.user_model_chat import router as user_model_chat_router
    HAS_USER_MODEL_CHAT = True
except Exception:
    user_model_chat_router = None
    HAS_USER_MODEL_CHAT = False

# --- Doubao Image Edit 豆包图片编辑 ---
try:
    from app.api.v1.doubao_image_edit import router as doubao_image_edit_router
    HAS_DOUBAO_IMAGE_EDIT = True
except Exception:
    doubao_image_edit_router = None
    HAS_DOUBAO_IMAGE_EDIT = False

# --- Tongyi Image Edit 通义图像编辑 ---
try:
    from app.api.v1.tongyi_image_edit import router as tongyi_image_edit_router
    HAS_TONGYI_IMAGE_EDIT = True
except Exception:
    tongyi_image_edit_router = None
    HAS_TONGYI_IMAGE_EDIT = False

# --- Tongyi Image2Image 通义图生图 ---
try:
    from app.api.v1.tongyi_image2image import router as tongyi_image2image_router
    HAS_TONGYI_IMAGE2IMAGE = True
except Exception:
    tongyi_image2image_router = None
    HAS_TONGYI_IMAGE2IMAGE = False

# --- Service Catalog 实时服务目录 ---
try:
    from app.api.v1.service_catalog import router as service_catalog_router
    HAS_SERVICE_CATALOG = True
except Exception:
    service_catalog_router = None
    HAS_SERVICE_CATALOG = False

# --- Test 静态测试页面 ---
try:
    from app.api.v1.test import router as test_router
    HAS_TEST = True
except Exception:
    test_router = None
    HAS_TEST = False

# --- Learn 学习服务 (迁移自 edu server ihui-ai-edu-learn-service, 16模块/127端点) ---
try:
    from app.api.v1.learn import router as learn_router
    HAS_LEARN = True
except Exception:
    learn_router = None
    HAS_LEARN = False


# Create main API router
api_router = APIRouter()

# =============================================================================
# Register all sub-routers
# =============================================================================

# Authentication
# 2026-06-21 联调: login/wechat/bindings 自带 /auth 前缀, 去掉 include 的重复 prefix
api_router.include_router(login_router, tags=["Authentication"])
api_router.include_router(sms_router, prefix="/auth", tags=["SMS"])
api_router.include_router(google_router, prefix="/auth", tags=["Google OAuth"])
api_router.include_router(oauth_router, prefix="/auth", tags=["OAuth"])
api_router.include_router(coze_oauth_router, tags=["Coze OAuth"])
api_router.include_router(wechat_router, tags=["WeChat Auth"])
api_router.include_router(bindings_router, tags=["Account Bindings"])
api_router.include_router(username_login_router, prefix="", tags=["Username Login"])
api_router.include_router(user_sk_router, prefix="/auth", tags=["User SK"])

# SSO & JWT KeyPair (迁移自 edu Java 微服务, 自带 /sso 和 /jwt 前缀)
api_router.include_router(keypair_router, tags=["JWT KeyPair"])
api_router.include_router(sso_router, tags=["SSO"])

# Orders (通用订单管理, 自带 /order 前缀)
api_router.include_router(orders_router, tags=["Order"])

# Refund 退款流程 (自带 /refunds 前缀)
api_router.include_router(refund_router, tags=["Refund"])

# Member 会员域 (自带 /member 前缀)
api_router.include_router(member_router, tags=["Member"])

# Dual-Write 双写期管理 (自带 /dual-write 前缀)
# 2026-06-24 修复: dual_write_router 模块文件不存在, 注释掉死代码引用避免启动 NameError
# api_router.include_router(dual_write_router, tags=["Dual-Write"])

# User
api_router.include_router(users_router, prefix="/user", tags=["Users"])
api_router.include_router(vip_router, prefix="/user", tags=["VIP"])

# Agents
# 修复路由前缀冲突: 12 个子 router 原本共用 /agents 前缀, 导致 /list /create /{id} 等路径
# 被第一个注册的 agents_router 屏蔽, buy/settlement/withdrawal/categories/examine/developer/
# rules/identity/cache 的同名端点永远不可达。现给每个子 router 加独立子前缀。
# agents_router 保持 /agents (前端在用 /agents/list 和 /agents/create)。
# 前端 agent-withdrawal.ts 的 /agents/apply 已同步改为 /agents/withdrawal/apply。
api_router.include_router(agents_router, prefix="/agents", tags=["Agents"])
api_router.include_router(buy_router, prefix="/agents/buy", tags=["Agent Purchase"])
api_router.include_router(categories_router, prefix="/agents/categories", tags=["Agent Categories"])
api_router.include_router(examine_router, prefix="/agents/examine", tags=["Agent Review"])
api_router.include_router(developer_router, prefix="/agents/developer", tags=["Agent Developers"])
api_router.include_router(settlement_router, prefix="/agents/settlement", tags=["Agent Settlement"])
api_router.include_router(agent_withdrawal_router, prefix="/agents/withdrawal", tags=["Agent Withdrawal"])
api_router.include_router(rules_router, prefix="/agents/rules", tags=["Agent Rules"])
api_router.include_router(heat_router, prefix="/agents/heat", tags=["Agent Heat Stats"])
api_router.include_router(identity_router, prefix="/agents/identity", tags=["Agent Identity"])
api_router.include_router(creation_router, prefix="/agents/creation", tags=["Agent Creation"])
api_router.include_router(cache_router, prefix="/agents/cache", tags=["Agent Cache"])
api_router.include_router(rule_params_router, tags=["Agent Rule Params"])
# 2026-06-26: 用户确认纳入封版, 注册 agents_category_link_router
api_router.include_router(agents_category_link_router, prefix="/agents/category-link", tags=["Agent Category Link"])

# Bots
api_router.include_router(bots_router, prefix="/bots", tags=["Bots"])
api_router.include_router(bots_chat_router, prefix="/bots", tags=["Bot Chat"])

# Chat
api_router.include_router(chat_router, prefix="/chat", tags=["Chat"])
api_router.include_router(chat_history_router, prefix="/chat", tags=["Chat History"])
api_router.include_router(qwen_router, prefix="/chat", tags=["Qwen Chat"])
api_router.include_router(deepseek_router, prefix="/chat", tags=["DeepSeek Chat"])
api_router.include_router(kling_router, prefix="/chat", tags=["Kling Chat"])
api_router.include_router(multi_router, prefix="/chat", tags=["Multi-Model Chat"])
api_router.include_router(qwen_omni_router, prefix="/chat", tags=["Qwen Omni"])
api_router.include_router(doubao_ws_router, prefix="/chat", tags=["Doubao WS"])
api_router.include_router(zhipu_ws_router, prefix="/chat", tags=["Zhipu WS"])

# AI Proxies
api_router.include_router(dashscope_router, prefix="/ai/dashscope", tags=["AI: DashScope"])
api_router.include_router(doubao_router, prefix="/ai/doubao", tags=["AI: Doubao"])
api_router.include_router(volcengine_router, prefix="/ai/volcengine", tags=["AI: VolcEngine"])
api_router.include_router(jimeng4_router, prefix="/ai", tags=["AI: Jimeng"])
api_router.include_router(ai_model_info_router, prefix="/ai", tags=["AI: Model Info"])
api_router.include_router(tencent_router, prefix="/ai/tencent", tags=["AI: Tencent"])
api_router.include_router(suno_router, prefix="/ai/suno", tags=["AI: Suno"])
api_router.include_router(sora2_router, prefix="/ai/sora2", tags=["AI: Sora2"])
api_router.include_router(gemini_router, prefix="/ai/gemini", tags=["AI: Gemini"])
api_router.include_router(bailian_router, prefix="/ai/bailian", tags=["AI: Bailian"])
api_router.include_router(n8n_router, prefix="/ai/n8n", tags=["AI: N8N"])
api_router.include_router(video_tasks_router, prefix="/ai", tags=["AI: Video Tasks"])
api_router.include_router(audio_router, prefix="/ai/audio", tags=["AI: Audio"])
api_router.include_router(voiceprint_router, prefix="/ai/audio", tags=["AI: Voiceprint"])

# Payments
api_router.include_router(wechat_pay_router, prefix="/payments/wechat", tags=["WeChat Pay"])
api_router.include_router(alipay_router, prefix="/payments/alipay", tags=["Alipay"])
api_router.include_router(reconciliation_router, prefix="/payments", tags=["Reconciliation"])
api_router.include_router(fund_router, prefix="/payments", tags=["Payment Fund"])
api_router.include_router(alipay_fund_router, prefix="/payments", tags=["Alipay Fund"])

# Finance
api_router.include_router(commission_router, prefix="/finance", tags=["Finance: Commission"])
api_router.include_router(margin_router, prefix="/finance", tags=["Finance: Margin"])
api_router.include_router(withdrawal_router, prefix="/finance/withdrawal", tags=["Finance: Withdrawal"])
api_router.include_router(distribution_router, prefix="/finance", tags=["Finance: Distribution"])
api_router.include_router(finance_fund_router, prefix="/finance", tags=["Finance: Fund"])
# 2026-06-26: 用户确认纳入封版, 注册 finance_fund_info_router
api_router.include_router(finance_fund_info_router, tags=["Finance: User Fund Info"])

# Courses
api_router.include_router(courses_router, prefix="/courses", tags=["Courses"])
api_router.include_router(courses_ext_router, prefix="/courses", tags=["Courses Ext"])

# Content
api_router.include_router(about_us_router, prefix="/content", tags=["Content"])
api_router.include_router(content_cms_router, prefix="/content/cms", tags=["Content: CMS"])
api_router.include_router(activity_router, prefix="/content/activity", tags=["Content: Activity"])
api_router.include_router(information_router, prefix="/content/information", tags=["Content: Information"])
api_router.include_router(file_storage_router, prefix="/content/files", tags=["Content: File Storage"])
api_router.include_router(contact_router, prefix="/content", tags=["Content: Contact"])
api_router.include_router(product_router, prefix="/zhs_product", tags=["Product"])
api_router.include_router(product_identity_router, prefix="/product_identity", tags=["Product Identity"])
api_router.include_router(developer_link_router, prefix="/developerLink", tags=["Developer Link"])
api_router.include_router(aigc_router, prefix="/content/aigc", tags=["AIGC"])

# System
api_router.include_router(sys_user_router, prefix="/system", tags=["System"])
api_router.include_router(sys_admin_router, prefix="/system/admin", tags=["System Admin"])
api_router.include_router(sys_audit_router, prefix="/system/audit", tags=["System: Audit"])
api_router.include_router(sys_codegen_router, prefix="/system", tags=["System: Codegen"])
api_router.include_router(sys_dictionary_router, tags=["System: Dictionary"])
# 2026-06-26 新增: WebSocket 自动恢复监控路由
api_router.include_router(
    sys_auto_recovery_router, prefix="/system", tags=["System: Auto Recovery"]
)

# Monitor
api_router.include_router(monitor_alerts_router, prefix="/monitor/alerts", tags=["Monitor: Alerts"])
api_router.include_router(monitor_backfill_router, prefix="/monitor/backfill", tags=["Monitor: Backfill Progress"])
api_router.include_router(monitor_canary_promoter_router, prefix="/monitor", tags=["Monitor: Canary Promoter Override"])
api_router.include_router(monitor_canary_audit_router, prefix="/monitor", tags=["Monitor: Canary Audit"])
api_router.include_router(
    monitor_inhibition_playground_router, prefix="/monitor", tags=["Monitor: Inhibition Playground"]
)

# Canary
api_router.include_router(canary_router, prefix="/canary", tags=["Canary"])

# Resource
api_router.include_router(resource_home_router, prefix="/resource", tags=["Resource"])
api_router.include_router(resource_context_router, prefix="/resource/context", tags=["Resource: Context"])

# Tools
api_router.include_router(tools_router, prefix="/tools", tags=["Tools"])

# Auth
api_router.include_router(captcha_router, prefix="/auth", tags=["Captcha"])
api_router.include_router(ali_login_router, prefix="/auth", tags=["Ali Login"])
api_router.include_router(enterprise_wechat_router, prefix="/auth", tags=["Enterprise WeChat"])
api_router.include_router(feishu_router, prefix="/auth", tags=["Feishu Auth"])
api_router.include_router(dingtalk_router, prefix="/auth", tags=["DingTalk Auth"])

# Personality
if personality_router:
    api_router.include_router(personality_router, tags=["Personality"])

# Stock
api_router.include_router(stock_analyse_router, tags=["Stock Analyse"])

# LLM
api_router.include_router(llm_models_unify_router, prefix="/llm", tags=["LLM: Models Unify"])
api_router.include_router(llm_ws_router, prefix="/llm", tags=["LLM: Stream WS (coze_zhs_py)"])

# Multi-Agent Crew (多智能体协作)
if crew_router:
    api_router.include_router(crew_router, tags=["Multi-Agent Crew"])

# Knowledge RAG (知识库)
if knowledge_router:
    api_router.include_router(knowledge_router, tags=["Knowledge RAG"])

# Coze
api_router.include_router(coze_conversations_router, prefix="/coze/conversations", tags=["Coze: Conversations"])
api_router.include_router(coze_workflows_router, prefix="/coze/workflows", tags=["Coze: Workflows"])
api_router.include_router(coze_workflows_async_router, prefix="/coze/workflows/async", tags=["Coze: Workflows Async"])
api_router.include_router(coze_datasets_router, prefix="/coze/datasets", tags=["Coze: Datasets"])
api_router.include_router(coze_files_router, prefix="/coze/files", tags=["Coze: Files"])
api_router.include_router(coze_templates_router, prefix="/coze/templates", tags=["Coze: Templates"])
api_router.include_router(coze_variables_router, prefix="/coze/variables", tags=["Coze: Variables"])
api_router.include_router(coze_workspaces_router, prefix="/coze/workspaces", tags=["Coze: Workspaces"])
api_router.include_router(coze_review_router, prefix="/coze/review", tags=["Coze: Review"])
api_router.include_router(coze_apps_router, prefix="/coze/apps", tags=["Coze: Apps"])
api_router.include_router(coze_audio_router, prefix="/coze/audio", tags=["Coze: Audio"])
api_router.include_router(coze_chat_audio_router, prefix="/coze/chat-audio", tags=["Coze: Chat Audio"])

# MCP
api_router.include_router(mcp_router, prefix="/mcp", tags=["MCP"])

# WebSocket
api_router.include_router(ws_timbre_router, prefix="/ws/timbre", tags=["WS Timbre"])
api_router.include_router(ws_admin_router, tags=["WS Admin"])

# Remote
api_router.include_router(remote_router, tags=["Remote Device"])
api_router.include_router(remote_third_router, tags=["Remote Third"])

# Video
api_router.include_router(video_router, tags=["Video Preload & Breakpoint"])

# SMS
api_router.include_router(sms_proxy_router)

# File Upload
if file_upload_router:
    api_router.include_router(file_upload_router)

# Ask
if ask_router:
    api_router.include_router(ask_router, tags=["Ask"])

# Circle
if circle_router:
    api_router.include_router(circle_router, tags=["Circle"])

# Exam
if exam_router:
    api_router.include_router(exam_router, tags=["Exam"])

# Live
if live_router:
    api_router.include_router(live_router, tags=["Live"])

# Message
if message_router:
    api_router.include_router(message_router, tags=["Message"])

# Notification
if notification_router:
    api_router.include_router(notification_router, tags=["Notification"])

# Point
if point_router:
    api_router.include_router(point_router, tags=["Point"])

# Search
if search_router:
    api_router.include_router(search_router, tags=["Search"])

# Visit
if visit_router:
    api_router.include_router(visit_router, tags=["Visit Tracking"])

# Behavior
if behavior_router:
    api_router.include_router(behavior_router, tags=["Behavior"])

# Schedule
if schedule_router:
    api_router.include_router(schedule_router, tags=["Schedule"])

# Ranking
if ranking_router:
    api_router.include_router(ranking_router, tags=["Ranking"])

# Advertise
if advertise_router:
    api_router.include_router(advertise_router, tags=["Advertise"])

# Organization
if organization_router:
    api_router.include_router(organization_router, tags=["Organization"])

# Feedback
if feedback_router:
    api_router.include_router(feedback_router, tags=["Feedback"])

# Auth Identity
if auth_identity_router:
    api_router.include_router(auth_identity_router, tags=["Auth Identity"])

# App Version
if app_version_router:
    api_router.include_router(app_version_router, tags=["App Version"])

# Agent Upload
if agent_upload_router:
    api_router.include_router(agent_upload_router, tags=["Agent Upload"])

# Category Dictionary
if category_dict_router:
    api_router.include_router(category_dict_router, tags=["Category Dictionary"])

# Education Platform
if education_platform_router:
    api_router.include_router(education_platform_router, tags=["Education Platform"])

# Course Audit
if course_audit_router:
    api_router.include_router(course_audit_router, tags=["Course Audit"])

# User Comment Log
if user_comment_log_router:
    api_router.include_router(user_comment_log_router, tags=["User Comment Log"])

# User Video Log
if user_video_log_router:
    api_router.include_router(user_video_log_router, tags=["User Video Log"])

# User Video Comment
if user_video_comment_router:
    api_router.include_router(user_video_comment_router, tags=["User Video Comment"])

# TBox
if tbox_router:
    api_router.include_router(tbox_router, tags=["TBox"])

# Agent Need Task
if agent_need_task_router:
    api_router.include_router(agent_need_task_router, tags=["Agent Need Task"])

# Agent Use Detail
if agent_usedetail_router:
    api_router.include_router(agent_usedetail_router, tags=["Agent Use Detail"])

# User Agent Context
if user_agent_context_router:
    api_router.include_router(user_agent_context_router, tags=["User Agent Context"])

# User Agent Image
if user_agent_image_router:
    api_router.include_router(user_agent_image_router, tags=["User Agent Image"])

# Video Preload
if video_preload_router:
    api_router.include_router(video_preload_router, tags=["Video Preload"])

# Luyala Proxy
if luyala_proxy_router:
    api_router.include_router(luyala_proxy_router, tags=["Luyala Proxy"])

# OpenRouter Proxy
if openrouter_proxy_router:
    api_router.include_router(openrouter_proxy_router, tags=["OpenRouter Proxy"])

# Callback
if callback_router:
    api_router.include_router(callback_router, tags=["Callback"])

# User Model Chat
if user_model_chat_router:
    api_router.include_router(user_model_chat_router, tags=["User Model Chat"])

# Doubao Image Edit
if doubao_image_edit_router:
    api_router.include_router(doubao_image_edit_router, tags=["Doubao Image Edit"])

# Tongyi Image Edit
if tongyi_image_edit_router:
    api_router.include_router(tongyi_image_edit_router, tags=["Tongyi Image Edit"])

# Tongyi Image2Image
if tongyi_image2image_router:
    api_router.include_router(tongyi_image2image_router, tags=["Tongyi Image2Image"])

# Service Catalog
if service_catalog_router:
    api_router.include_router(service_catalog_router, tags=["Service Catalog"])

# Test Page
if test_router:
    api_router.include_router(test_router, tags=["Test"])

# Learn 学习服务 (迁移自 edu server ihui-ai-edu-learn-service)
if learn_router:
    api_router.include_router(learn_router, tags=["Learn"])

# --- Migrated from coze_zhs_py ---
# Agent category sync (coze_zhs_py/api/category_sync_api.py)
from app.api.v1.agents.category_sync import router as category_sync_router  # noqa: E402

api_router.include_router(category_sync_router, tags=["Agent Category Sync (coze_zhs_py)"])

# Agent upload processing (ZHS_Server_java/small/controller/AgentUploadController.java)
# 注意: 该 router 自带 /api/agent 前缀, 不能 include 到 api_router (/api/v1) 下,
# 否则路径变成 /api/v1/api/agent/upload 导致 404.
# 已在 main.py 中直接 include 到 app 上.

# AI Bot Sites (ZHS_Server_java/small/controller/AiBotSitesController.java)
from app.api.v1.ai_bot_sites import router as ai_bot_sites_router  # noqa: E402

api_router.include_router(ai_bot_sites_router, tags=["AI Bot Sites"])

# TBox (ZHS_Server_java/mcp/controller/TBoxController.java)
from app.api.v1.mcp.tbox import router as tbox_notify_router  # noqa: E402

api_router.include_router(tbox_notify_router, tags=["TBox Notify"])

# Real-time Timbre WebSocket (ZHS_Server_java/mcp/websocket/TimbreWebSocket.java)
from app.api.v1.ws.timbre_generate import router as timbre_generate_router  # noqa: E402

api_router.include_router(timbre_generate_router, tags=["Timbre WS Generate"])

# Resource Watermark (ZHS_Server_java/small/controller/ResourceNowController.java)
from app.api.v1.resource.watermark import router as resource_watermark_router  # noqa: E402

api_router.include_router(resource_watermark_router, tags=["Resource Watermark"])

# --- Member Legacy Routes: Java MemberController 1:1 兼容 (80+ 个端点) ---
# 注意: 必须在 admin_panel 之前注册, 因为两者都定义了 /post/list, /post, /group/list 等路径.
# Member 业务域的语义优先于 SysPost / SysGroup (admin_panel 概念).
from app.api.v1.member_legacy import router as member_legacy_router  # noqa: E402

api_router.include_router(member_legacy_router)

# --- Resource Legacy Routes: Java ResourceController 1:1 兼容 (42 个端点) ---
# 必须在 admin_panel 之前注册, 因为两者都定义了 /category/*, /statistics 等路径.
# Resource 业务域的语义优先于 SysCategory / SysStatistics (admin_panel 概念).
from app.api.v1.resource_legacy import router as resource_legacy_router  # noqa: E402

api_router.include_router(resource_legacy_router)

# --- Article + Invoice + Exam Legacy Routes: 1:1 兼容 Java (42 端点) ---
# 必须在 admin_panel 之前注册, 因为都定义了 /exam/*, /article/* 等路径.
from app.api.v1.article_invoice_exam_legacy import router as article_invoice_exam_legacy_router  # noqa: E402

api_router.include_router(article_invoice_exam_legacy_router)

# --- Admin 管理后台 (13 个核心模块: profile/logininfor/notice-job/user-mgmt/menu-role/dept-post/dict-type-data/dictionary/config/online/codegen) ---
from app.api.v1.admin_panel import register_routers as _register_admin_panel  # noqa: E402

_register_admin_panel(api_router)

# --- Edu 业务域聚合 (迁移自 edu Java 23 个 Spring Cloud 微服务) ---
from app.api.v1.edu import register_routers as _register_edu_panel  # noqa: E402

_register_edu_panel(api_router)

# --- Legacy Compat: Java 旧 API 1:1 兼容 (已清空, 历史路径由各业务模块真实路由覆盖) ---
from app.api.legacy_compat import router as legacy_compat_router  # noqa: E402

api_router.include_router(legacy_compat_router)

# --- 封存前补齐: A 类 4 个完全未迁移 Controller + B 类 3 个模型已建无 API Controller ---
# A1: 算力购买规则 (迁移自 ai-smart-society-java: PowerPurchaseRuleController)
from app.api.v1.finance.power_purchase_rule import router as power_purchase_rule_router  # noqa: E402

api_router.include_router(power_purchase_rule_router)

# A2: 开发者资金日志 (迁移自 ai-smart-society-java: ZhsDeveloperFundLogsController)
from app.api.v1.finance.developer_fund_logs import router as developer_fund_logs_router  # noqa: E402

api_router.include_router(developer_fund_logs_router)

# A3: 用户系统链接 (迁移自 ai-smart-society-java: ZhsUserSysLinkController)
from app.api.v1.user.user_sys_link import router as user_sys_link_router  # noqa: E402

api_router.include_router(user_sys_link_router)

# B1: 热门课程推荐 (迁移自 ai-smart-society-java: ZhsPopularCoursesController)
from app.api.v1.courses.popular_courses import router as popular_courses_router  # noqa: E402

api_router.include_router(popular_courses_router)

# B2: 课程临时表 (迁移自 ai-smart-society-java: ZhsCourseTempController)
from app.api.v1.courses.course_temp import router as course_temp_router  # noqa: E402

api_router.include_router(course_temp_router)

# B3: 课程视频临时表 (迁移自 ai-smart-society-java: ZhsCourseVideoTempController)
from app.api.v1.courses.video_temp import router as video_temp_router  # noqa: E402

api_router.include_router(video_temp_router)

# --- 封存前补齐: 3 个完全未迁移 Controller (19 端点) ---
# C1: 字典管理已移至 server/archive/_new_endpoints_pending_review_2026-06-26/, 暂不导入/注册

# C2: 用户资金信息已移至 server/archive/_new_endpoints_pending_review_2026-06-26/, 暂不导入/注册

# C3: Agent 分类关联已移至 server/archive/_new_endpoints_pending_review_2026-06-26/, 暂不导入/注册

# --- 封存前补齐: 16 个部分缺失 Controller 的 54 个端点 ---
# 2026-06-26: 用户确认纳入封版, 注册 legacy_supplement_router
from app.api.v1.legacy_supplement import router as legacy_supplement_router  # noqa: E402

api_router.include_router(legacy_supplement_router)

# --- Category Legacy Routes: 1:1 兼容 Java CategoryController (47 端点) ---
# 必须在 admin_panel 之前注册, 避免 /category/* 被 admin 路由屏蔽.
from app.api.v1.category_legacy import router as category_legacy_router  # noqa: E402

api_router.include_router(category_legacy_router)

# --- Learn Legacy Routes: 1:1 兼容 Java LearnController 17 模块 (75 端点) ---
from app.api.v1.learn_legacy import router as learn_legacy_router  # noqa: E402

api_router.include_router(learn_legacy_router)

# --- Certificate Legacy Routes: 1:1 兼容 Java CertificateController (15 端点) ---
from app.api.v1.certificate_legacy import router as certificate_legacy_router  # noqa: E402

api_router.include_router(certificate_legacy_router)

# --- Exam Legacy Routes: 1:1 兼容 Java ExamController 8 模块 (23 端点) ---
from app.api.v1.exam_legacy import router as exam_legacy_router  # noqa: E402

api_router.include_router(exam_legacy_router)

# --- News Legacy Routes: 1:1 兼容 Java NewsController (12 端点) ---
from app.api.v1.news_legacy import router as news_legacy_router  # noqa: E402

api_router.include_router(news_legacy_router)

# --- Live Legacy Routes: 1:1 兼容 Java LiveController 7 模块 (15 端点) ---
from app.api.v1.live_legacy import router as live_legacy_router  # noqa: E402

api_router.include_router(live_legacy_router)

# --- Ask / Circle Legacy Routes: 1:1 兼容 Java AskController 9 模块 (29 端点) ---
from app.api.v1.ask_legacy import router as ask_legacy_router  # noqa: E402

api_router.include_router(ask_legacy_router)

# --- Misc Legacy Routes: 1:1 兼容 Java 杂项 Controller 25+ (55 端点) ---
from app.api.v1.misc_legacy import router as misc_legacy_router  # noqa: E402

api_router.include_router(misc_legacy_router)

# --- Invoice Title Legacy Routes: 1:1 兼容 Java InvoiceTitleController (7 端点) ---
from app.api.v1.invoice_title_legacy import router as invoice_title_legacy_router  # noqa: E402

api_router.include_router(invoice_title_legacy_router)

# --- 历史项目迁移补齐: 7 个新路由模块 (2026-06-26, 迁移自 coze_zhs_py) ---
# P0: 聊天室 WebSocket (迁移自 coze_zhs_py/api/chat_room_socket.py, 9 端点)
from app.api.v1.chat_room import router as chat_room_router  # noqa: E402

api_router.include_router(chat_room_router, tags=["Chat Room WS (coze_zhs_py)"])

# P0: 公共 Socket 管理器 + Redis 跨实例同步 (迁移自 coze_zhs_py/api/public_socket.py, 2 端点)
from app.api.ws.public_socket_v2 import router as public_socket_v2_router  # noqa: E402

api_router.include_router(public_socket_v2_router, tags=["Public Socket v2 (coze_zhs_py)"])

# P0: Coze 原生 WebSocket chat (迁移自 coze_zhs_py/api/websocket.py, 7 端点)
from app.api.v1.coze_ws import router as coze_ws_router  # noqa: E402

api_router.include_router(coze_ws_router, tags=["Coze WS (coze_zhs_py)"])

# P0: 提现审核/处理端点 (迁移自 coze_zhs_py/api/agent_withdrawal_detail.py, 7 端点)
from app.api.v1.agents.withdrawal_admin import router as agent_withdrawal_admin_router  # noqa: E402

api_router.include_router(
    agent_withdrawal_admin_router,
    prefix="/agents",
    tags=["Agent Withdrawal Admin (coze_zhs_py)"],
)

# P1: WebSocket 实时语音识别 (迁移自 coze_zhs_py/api/websocket_audio.py, 2 端点)
from app.api.v1.ai.audio.ws_router import router as audio_ws_router  # noqa: E402

api_router.include_router(audio_ws_router, tags=["Audio WS (coze_zhs_py)"])

# P1: Coze stream_run 聊天 (迁移自 coze_zhs_py/api/coze_chat.py, 1 端点)
from app.api.v1.coze.stream_chat import router as coze_stream_chat_router  # noqa: E402

api_router.include_router(coze_stream_chat_router, tags=["Coze Stream Chat (coze_zhs_py)"])

# P1: Kling O1 omni-video (迁移自 coze_zhs_py/api/kling_video_synthesis.py, 1 端点)
from app.api.v1.chat.kling_o1 import router as kling_o1_router  # noqa: E402

api_router.include_router(kling_o1_router, tags=["Kling O1 (coze_zhs_py)"])
