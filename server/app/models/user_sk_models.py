"""
UserSK model - DEPRECATED.

This module previously defined a separate UserSK model for table 'user_sk'.
The canonical model is now UserSKInfo from token_models.py (table 'user_sk_info').

This file re-exports UserSKInfo as UserSK for backward compatibility.
"""

from app.models.token_models import UserSKInfo as UserSK

__all__ = ["UserSK"]
