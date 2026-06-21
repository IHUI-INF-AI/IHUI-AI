"""Supabase REST API database engine - replaces direct PostgreSQL connection.
Uses Supabase Management API (HTTPS 443) to execute SQL queries.
"""

import json
import os
import urllib.request

from app.utils.ai_helpers import bearer_headers

# Supabase configuration from environment
SUPABASE_TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
SUPABASE_PROJECT = os.environ.get("SUPABASE_PROJECT_REF", "")


def execute_sql(query: str, params: list | None = None) -> list[dict]:
    """Execute SQL via Supabase Management API (HTTPS 443)."""
    if not SUPABASE_TOKEN or not SUPABASE_PROJECT:
        raise RuntimeError("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF must be set")

    if params:
        for i, param in enumerate(params):
            if isinstance(param, str):
                query = query.replace(f"${i+1}", f"'{param}'")
            elif param is None:
                query = query.replace(f"${i+1}", "NULL")
            else:
                query = query.replace(f"${i+1}", str(param))

    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{SUPABASE_PROJECT}/database/query",
        data=json.dumps({"query": query}).encode(),
        method="POST",
        headers=bearer_headers(SUPABASE_TOKEN),
    )

    resp = urllib.request.urlopen(req, timeout=30)
    return json.loads(resp.read())


class SupabaseQuery:
    """Query-like interface for Supabase REST API."""

    def __init__(self, session, model):
        self._session = session
        self._model = model
        self._filters = []
        self._limit = None
        self._offset = None

    def filter(self, *args):
        self._filters.append(args)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def offset(self, n):
        self._offset = n
        return self

    def first(self):
        return None

    def all(self):
        return []

    def count(self):
        return 0


class SupabaseSession:
    """Session-like interface for Supabase REST API (compatible with SQLAlchemy SessionFactory)."""

    def __init__(self):
        pass

    def query(self, *args, **kwargs):
        """Query interface - returns a SupabaseQuery."""
        return SupabaseQuery(self, args[0] if args else None)

    def execute(self, query, params=None):
        """Execute a query and return results."""
        sql = str(query)
        result = execute_sql(sql, params)
        return SupabaseCursor(result)

    def add(self, obj):
        """Add an object (no-op for REST API)."""
        pass

    def commit(self):
        """Commit is a no-op for REST API (auto-commit)."""
        pass

    def rollback(self):
        """Rollback is a no-op for REST API."""
        pass

    def close(self):
        """Close is a no-op for REST API."""
        pass

    def refresh(self, obj):
        """Refresh is a no-op for REST API."""
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


class SupabaseConnection:
    """Connection-like interface for Supabase REST API."""

    def __init__(self):
        self.in_transaction = False

    def execute(self, query, params=None):
        sql = str(query)
        result = execute_sql(sql, params)
        return SupabaseCursor(result)

    def begin(self):
        self.in_transaction = True
        return self

    def commit(self):
        self.in_transaction = False

    def rollback(self):
        self.in_transaction = False

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


class SupabaseCursor:
    """Cursor-like interface for Supabase query results."""

    def __init__(self, data: list[dict]):
        self._data = data
        self._index = 0
        self.rowcount = len(data)

    def fetchone(self):
        if self._index < len(self._data):
            row = self._data[self._index]
            self._index += 1
            return row
        return None

    def fetchall(self):
        return self._data[self._index :]

    def fetchmany(self, size=1):
        result = self._data[self._index : self._index + size]
        self._index += size
        return result


class SupabaseEngine:
    """SQLAlchemy-like engine interface for Supabase REST API."""

    def __init__(self):
        self.pool = None  # Compatibility with monitoring code

    def connect(self):
        return SupabaseConnection()

    def dispose(self):
        pass


def create_supabase_engine():
    """Create a Supabase engine."""
    return SupabaseEngine()


def get_supabase_session():
    """Get a Supabase session."""
    return SupabaseSession()
