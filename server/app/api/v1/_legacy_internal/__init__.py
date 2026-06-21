"""Compatibility shim for legacy client/backend/api/* imports.

Modules migrated from client/backend may import `from api.xxx` or
`from api.config import settings`. This package re-exports the
migrated equivalents so the legacy code keeps working without
sweeping edits.
"""
