"""Backwards-compat: `from api.auth import verify_api_key`"""
from app.api.v1._legacy_internal._api_key import api_key_header, verify_api_key

__all__ = ["api_key_header", "verify_api_key"]
