"""
JWT KeyPair 路由.

迁移自 edu Java 微服务 ihui-ai-edu-auth-service 的 KeyPairController.
原始 Java 类: com.ihui.edu.auth.controller.KeyPairController

提供 JWT 公钥获取端点, 供其他微服务验证 token 签名.
"""

import base64

from fastapi import APIRouter
from loguru import logger

from app.schemas.common import error, success

router = APIRouter(prefix="/jwt", tags=["JWT KeyPair"])

# 模块级缓存: 避免每次请求都生成新密钥对
_rsa_public_key_b64: str | None = None


@router.get("/publicKey", summary="获取 JWT 公钥")
def get_public_key():
    """获取 JWT RSA 公钥.

    从配置中读取 RSA 公钥 (JWT_RSA_PUBLIC_KEY), 若未配置则自动生成
    RSA 密钥对并缓存, 返回 base64 编码的公钥字符串.

    其他微服务可使用此公钥验证 JWT token 的签名.

    Returns:
        成功: {publicKey: base64 编码的 RSA 公钥}
        失败: 错误信息
    """
    global _rsa_public_key_b64

    # 警告: 当前 JWT 使用 HS256 对称签名, 此 RSA 公钥并未用于 token 验证.
    # 仅供未来迁移到 RS256 时参考. 调用方不应依赖此公钥校验当前 token.
    rsa_warning = "JWT currently uses HS256, this RSA public key is not used for verification"

    try:
        # 优先从配置读取
        from app.config import settings

        configured_key = getattr(settings, "JWT_RSA_PUBLIC_KEY", None)
        if configured_key:
            return success({"publicKey": configured_key, "warning": rsa_warning})

        # 使用缓存的密钥对
        if _rsa_public_key_b64:
            return success({"publicKey": _rsa_public_key_b64, "warning": rsa_warning})

        # 生成新的 RSA 密钥对 (2048 位)
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa

        private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public_key_pem = private_key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
        _rsa_public_key_b64 = base64.b64encode(public_key_pem).decode("utf-8")

        logger.info("JWT RSA keypair generated and cached")
        return success({"publicKey": _rsa_public_key_b64, "warning": rsa_warning})
    except Exception as e:
        logger.error("Get JWT public key error: {}", e)
        return error("获取公钥失败", "500000")
