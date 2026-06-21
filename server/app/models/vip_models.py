"""
VIP level system models -- kept for reference.
Actual VipLevel / UserVip are defined in user_models.py (canonical).
"""

# This file intentionally left empty to avoid duplicate table definitions.
# VipLevel and UserVip live in app.models.user_models.
# Re-export for backward compatibility with code that still imports them from here.
from app.models.user_models import UserVip, VipLevel  # noqa: F401  backwards-compat re-export
