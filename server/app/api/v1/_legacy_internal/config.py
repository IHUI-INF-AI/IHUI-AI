"""Backwards-compat: `from api.config import settings`"""
from app.services._legacy_settings import LegacySettings, get_legacy_settings, settings

__all__ = ["LegacySettings", "get_legacy_settings", "settings"]
