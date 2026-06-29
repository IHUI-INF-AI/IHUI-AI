"""
OAuth models (from zhs_center_project).
"""

from sqlalchemy import JSON, Column, DateTime, Integer, String, Text

from app.database import Base
from app.models.base import TimestampMixin, id_column


class OAuthApp(TimestampMixin, Base):
    """OAuth application (zhs_center_project.oauth_apps).

    Round 22 扩展: 新增 redirect_uris JSON 列存回调地址白名单 (数组),
    支持多回调地址精确匹配 (取代 redirect_uri 单值前缀校验).
    保留 redirect_uri 列向后兼容 (单回调场景).

    Round 23 扩展: 新增 scopes JSON 列存应用允许的权限范围 (数组),
    如 ["read:profile", "write:orders"]. authorize 时校验请求 scope 是否子集.

    Round 29-A 扩展: 新增 icon 列存应用图标 URL (可空).
    图标由 admin 上传得到 URL 后保存, 在 OAuthAuthorize 授权确认页展示.
    不存 base64 二进制, 仅存 URL (与 GitHub/Google OAuth 应用一致).

    Round 31-B 扩展: 新增 owner_uuid 列存创建者 user_uuid, 实现多租户隔离.
    - create 时写入 owner_uuid = 当前登录用户
    - list 默认仅返回当前用户的应用 (admin 可查全部)
    - delete / reset-secret 校验 owner_uuid, 非 owner 拒绝 (403)
    向后兼容: 历史应用 owner_uuid 为 NULL, 视为 "无主" 应用, 任何登录用户可管理
    (避免历史数据锁定, 后续 admin 可手动指派 owner).
    """

    __tablename__ = "oauth_apps"

    id = id_column(comment="ID")
    client_id = Column(String(100), unique=True, nullable=False, comment="Client ID")
    client_secret = Column(String(255), nullable=False, comment="Client secret")
    name = Column(String(100), nullable=False, comment="App name")
    redirect_uri = Column(Text, nullable=True, comment="Redirect URI (单回调, 向后兼容)")
    # Round 22: 多回调地址白名单 (JSON 数组, 如 ["https://a.com/cb","https://b.com/cb"])
    redirect_uris = Column(JSON, nullable=True, comment="回调地址白名单 (JSON 数组)")
    is_active = Column(Integer, default=1, comment="Active status")
    # Round 23: 应用允许的权限范围 (JSON 数组, 如 ["read:profile", "write:orders"])
    scopes = Column(JSON, nullable=True, comment="应用允许的权限范围 (JSON 数组)")
    # Round 29-A: 应用图标 URL (可空, admin 上传后保存)
    icon = Column(String(512), nullable=True, comment="应用图标 URL")
    # Round 31-B: 创建者 user_uuid (多租户隔离, NULL 视为无主应用, 历史兼容)
    owner_uuid = Column(String(64), nullable=True, comment="创建者 user_uuid")


class OAuthSession(TimestampMixin, Base):
    """OAuth session (zhs_center_project.oauth_sessions).

    Round 22 扩展: 新增 code_challenge + code_challenge_method 列支持 PKCE.
    PKCE (Proof Key for Code Exchange) 用于公开客户端 (SPA/Mobile) 防止授权码拦截.
    流程: 客户端生成 code_verifier -> 计算 code_challenge -> authorize 时传 challenge ->
    token 时传 verifier -> 服务端校验 BASE64URL(SHA256(verifier)) == challenge.

    Round 23 扩展: 新增 scope 列存实际授权的权限范围 (空格分隔字符串, OAuth2 标准).
    """

    __tablename__ = "oauth_sessions"

    id = id_column(comment="ID")
    code = Column(String(100), unique=True, nullable=False, comment="Auth code")
    client_id = Column(String(100), nullable=False, comment="Client ID")
    user_uuid = Column(String(64), nullable=False, comment="User UUID")
    expires_at = Column(DateTime, nullable=False, comment="Session expiry")
    state = Column(String(128), nullable=True, comment="CSRF state token")
    is_used = Column(Integer, default=0, comment="Used flag")
    # Round 22: PKCE 字段
    code_challenge = Column(String(256), nullable=True, comment="PKCE code_challenge")
    code_challenge_method = Column(
        String(10), nullable=True, comment="PKCE method: S256 (仅支持 S256, 不支持 plain)"
    )
    # Round 23: 实际授权的权限范围 (空格分隔字符串, OAuth2 标准)
    scope = Column(Text, nullable=True, comment="授权的 scope (空格分隔字符串)")


class OAuthUser(TimestampMixin, Base):
    """OAuth user mapping (zhs_center_project.oauth_users)."""

    __tablename__ = "oauth_users"

    id = id_column(comment="ID")
    user_uuid = Column(String(64), nullable=False, comment="User UUID")
    provider = Column(String(50), nullable=False, comment="OAuth provider")
    provider_user_id = Column(String(100), nullable=False, comment="Provider user ID")
    access_token = Column(Text, nullable=True, comment="Access token")
    refresh_token = Column(Text, nullable=True, comment="Refresh token")
    expires_at = Column(DateTime, nullable=True, comment="Token expiry")


class OAuthAuditLog(TimestampMixin, Base):
    """OAuth 审计日志 (zhs_center_project.oauth_audit_logs).

    Round 27-C 新增. 记录所有 OAuth 敏感操作, 供管理员审计追溯.
    覆盖事件:
    - app_create: 创建 OAuth 应用
    - app_delete: 删除 (软删除) OAuth 应用
    - app_reset_secret: 重置 client_secret
    - authorize_grant: 用户授权签发 code
    - authorize_deny: 用户拒绝授权 (前端记录)
    - token_issue: code 换 access_token
    - token_refresh: refresh_token 换新 access_token
    - protected_access: 受 OAuth scope 保护的 endpoint 被访问 (示范场景, 可选)
    """

    __tablename__ = "oauth_audit_logs"

    id = id_column(comment="ID")
    # 事件类型 (app_create / app_delete / app_reset_secret / authorize_grant /
    # authorize_deny / token_issue / token_refresh / protected_access)
    event = Column(String(50), nullable=False, comment="事件类型")
    # 关联的 OAuth 应用 client_id (部分事件如 token_refresh 可能缺)
    client_id = Column(String(100), nullable=True, comment="OAuth 应用 client_id")
    # 操作者 user_uuid (管理员操作 / 用户授权)
    user_uuid = Column(String(64), nullable=True, comment="操作者 user_uuid")
    # 操作来源 IP (用于追溯异常来源)
    ip = Column(String(64), nullable=True, comment="操作来源 IP")
    # 结果状态 (success / failure)
    status = Column(String(20), default="success", comment="结果状态")
    # 失败原因 / 详细说明 (success 时可为空)
    detail = Column(Text, nullable=True, comment="详细说明 / 失败原因")
    # 请求参数摘要 (JSON, 不含敏感字段如 client_secret / code_verifier)
    request_summary = Column(JSON, nullable=True, comment="请求参数摘要 (脱敏)")


class OAuthScopeMeta(TimestampMixin, Base):
    """OAuth scope 元数据 (zhs_center_project.oauth_scope_meta).

    Round 29-D 新增. 可配置的 scope 元数据中心, 取代前端硬编码的 scope 描述表.
    admin 在后台维护 scope 元数据, OAuthAuthorize 授权确认页动态读取展示.

    字段:
    - scope: scope 标识符 (唯一, 如 "read:profile")
    - name: scope 中文名 (展示用, 如 "读取资料")
    - description: scope 详细描述 (授权页展示, 如 "读取您的资料 (昵称/头像/简介)")
    - icon: scope 图标 URL (可空, 用于授权页展示)
    - category: scope 分类 (可空, 如 "profile" / "orders" / "wallet", 用于分组展示)
    - is_active: 是否启用 (0 禁用, 1 启用; 禁用后授权页回退到默认描述)
    - sort_order: 排序权重 (asc, 默认 0; 用于授权页展示顺序)

    用法:
    - GET /oauth-apps/scope-meta (公开, 授权页用): 返回所有 is_active=1 的 scope 元数据
    - GET /oauth-apps/admin/scope-meta (admin): 列表 + 分页
    - POST /oauth-apps/admin/scope-meta (admin): 创建
    - PUT /oauth-apps/admin/scope-meta/{id} (admin): 更新
    - DELETE /oauth-apps/admin/scope-meta/{id} (admin): 删除
    """

    __tablename__ = "oauth_scope_meta"

    id = id_column(comment="ID")
    # scope 标识符 (唯一, 如 "read:profile")
    scope = Column(String(100), unique=True, nullable=False, comment="scope 标识符")
    # scope 中文名 (展示用)
    name = Column(String(100), nullable=False, comment="scope 中文名")
    # scope 详细描述 (授权页展示)
    description = Column(Text, nullable=True, comment="scope 详细描述")
    # scope 图标 URL (可空)
    icon = Column(String(512), nullable=True, comment="scope 图标 URL")
    # scope 分类 (可空, 用于分组展示)
    category = Column(String(50), nullable=True, comment="scope 分类")
    # 是否启用 (0 禁用, 1 启用)
    is_active = Column(Integer, default=1, comment="是否启用")
    # 排序权重 (asc, 默认 0)
    sort_order = Column(Integer, default=0, comment="排序权重 (asc)")
