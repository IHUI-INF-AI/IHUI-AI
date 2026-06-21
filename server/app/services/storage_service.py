import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import BinaryIO

import aiofiles
import aiofiles.os


class FileStorageService:
    def __init__(self, base_dir: str = "storage"):
        self.base_dir = Path(base_dir)
        self.uploads_dir = self.base_dir / "uploads"
        self.thumbnails_dir = self.base_dir / "thumbnails"
        self.cache_dir = self.base_dir / "cache"

        self._ensure_dirs()

    def _ensure_dirs(self):
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.thumbnails_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _get_file_path(self, file_id: str) -> Path:
        return self.uploads_dir / file_id

    def _get_thumbnail_path(self, file_id: str) -> Path:
        return self.thumbnails_dir / f"{file_id}.jpg"

    async def save_file(self, file_id: str, content: bytes, metadata: dict | None = None) -> dict:
        file_path = self._get_file_path(file_id)

        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)

        file_hash = hashlib.sha256(content).hexdigest()

        result = {
            "id": file_id,
            "size": len(content),
            "hash": file_hash,
            "path": str(file_path),
            "createdAt": datetime.now().isoformat()
        }

        if metadata:
            result["metadata"] = metadata
            meta_path = file_path.with_suffix('.meta')
            async with aiofiles.open(meta_path, 'w') as f:
                await f.write(json.dumps(metadata))

        return result

    async def save_stream(self, file_id: str, stream: BinaryIO, chunk_size: int = 8192) -> dict:
        file_path = self._get_file_path(file_id)
        hasher = hashlib.sha256()
        total_size = 0

        async with aiofiles.open(file_path, 'wb') as f:
            while True:
                chunk = stream.read(chunk_size)
                if not chunk:
                    break
                await f.write(chunk)
                hasher.update(chunk)
                total_size += len(chunk)

        return {
            "id": file_id,
            "size": total_size,
            "hash": hasher.hexdigest(),
            "path": str(file_path),
            "createdAt": datetime.now().isoformat()
        }

    async def read_file(self, file_id: str) -> bytes | None:
        file_path = self._get_file_path(file_id)

        if not file_path.exists():
            return None

        async with aiofiles.open(file_path, 'rb') as f:
            return await f.read()

    async def read_file_stream(self, file_id: str, chunk_size: int = 8192):
        file_path = self._get_file_path(file_id)

        if not file_path.exists():
            return

        async with aiofiles.open(file_path, 'rb') as f:
            while True:
                chunk = await f.read(chunk_size)
                if not chunk:
                    break
                yield chunk

    async def delete_file(self, file_id: str) -> bool:
        file_path = self._get_file_path(file_id)
        meta_path = file_path.with_suffix('.meta')
        thumb_path = self._get_thumbnail_path(file_id)

        deleted = False

        if file_path.exists():
            await aiofiles.os.remove(file_path)
            deleted = True

        if meta_path.exists():
            await aiofiles.os.remove(meta_path)

        if thumb_path.exists():
            await aiofiles.os.remove(thumb_path)

        return deleted

    async def get_file_info(self, file_id: str) -> dict | None:
        file_path = self._get_file_path(file_id)

        if not file_path.exists():
            return None

        stat = await aiofiles.os.stat(file_path)

        info = {
            "id": file_id,
            "size": stat.st_size,
            "createdAt": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "modifiedAt": datetime.fromtimestamp(stat.st_mtime).isoformat()
        }

        meta_path = file_path.with_suffix('.meta')
        if meta_path.exists():
            async with aiofiles.open(meta_path) as f:
                content = await f.read()
                info["metadata"] = json.loads(content)

        return info

    async def list_files(self, limit: int = 100, offset: int = 0) -> list[dict]:
        files = []

        for i, file_path in enumerate(self.uploads_dir.iterdir()):
            if i < offset:
                continue
            if i >= offset + limit:
                break

            if file_path.is_file() and file_path.suffix != '.meta':
                stat = await aiofiles.os.stat(file_path)
                files.append({
                    "id": file_path.name,
                    "size": stat.st_size,
                    "modifiedAt": datetime.fromtimestamp(stat.st_mtime).isoformat()
                })

        return files

    async def save_thumbnail(self, file_id: str, thumbnail: bytes) -> str:
        thumb_path = self._get_thumbnail_path(file_id)

        async with aiofiles.open(thumb_path, 'wb') as f:
            await f.write(thumbnail)

        return str(thumb_path)

    async def get_thumbnail(self, file_id: str) -> bytes | None:
        thumb_path = self._get_thumbnail_path(file_id)

        if not thumb_path.exists():
            return None

        async with aiofiles.open(thumb_path, 'rb') as f:
            return await f.read()

    async def get_cache(self, key: str) -> bytes | None:
        cache_path = self.cache_dir / key

        if not cache_path.exists():
            return None

        async with aiofiles.open(cache_path, 'rb') as f:
            return await f.read()

    async def set_cache(self, key: str, value: bytes, ttl: int = 3600) -> None:
        cache_path = self.cache_dir / key
        meta_path = cache_path.with_suffix('.ttl')

        async with aiofiles.open(cache_path, 'wb') as f:
            await f.write(value)

        expires_at = datetime.now().timestamp() + ttl
        async with aiofiles.open(meta_path, 'w') as f:
            await f.write(str(expires_at))

    async def cleanup_cache(self) -> int:
        cleaned = 0
        now = datetime.now().timestamp()

        for cache_file in self.cache_dir.iterdir():
            if cache_file.suffix == '.ttl':
                async with aiofiles.open(cache_file) as f:
                    expires_at = float(await f.read())

                if expires_at < now:
                    data_file = cache_file.with_suffix('')
                    if data_file.exists():
                        await aiofiles.os.remove(data_file)
                    await aiofiles.os.remove(cache_file)
                    cleaned += 1

        return cleaned

    async def get_storage_stats(self) -> dict:
        total_size = 0
        file_count = 0

        for file_path in self.uploads_dir.iterdir():
            if file_path.is_file() and file_path.suffix != '.meta':
                stat = await aiofiles.os.stat(file_path)
                total_size += stat.st_size
                file_count += 1

        return {
            "totalFiles": file_count,
            "totalSize": total_size,
            "uploadsDir": str(self.uploads_dir),
            "thumbnailsDir": str(self.thumbnails_dir),
            "cacheDir": str(self.cache_dir)
        }

file_storage = FileStorageService()

# 兼容 services.__init__ 的导入
StorageService = FileStorageService


class StorageBackend:
    """占位,兼容 __init__ 导入"""
    LOCAL = "local"


class LocalStorage:
    """占位,兼容 __init__ 导入"""
    pass
