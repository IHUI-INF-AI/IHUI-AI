import logging
import time

from fastapi import Request, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest

logger = logging.getLogger(__name__)

REQUEST_COUNT = Counter(
    'pdf_service_requests_total',
    'Total request count',
    ['method', 'endpoint', 'status']
)

REQUEST_LATENCY = Histogram(
    'pdf_service_request_latency_seconds',
    'Request latency in seconds',
    ['method', 'endpoint']
)

ACTIVE_REQUESTS = Gauge(
    'pdf_service_active_requests',
    'Active requests count',
    ['method', 'endpoint']
)

PDF_OPERATIONS = Counter(
    'pdf_operations_total',
    'Total PDF operations',
    ['operation_type', 'status']
)

FILE_UPLOAD_SIZE = Histogram(
    'pdf_service_file_upload_size_bytes',
    'File upload size in bytes',
    buckets=[1024, 10240, 102400, 1048576, 10485760, 52428800, 104857600]
)

STORAGE_SIZE = Gauge(
    'pdf_service_storage_size_bytes',
    'Current storage size in bytes',
    ['storage_type']
)

FILE_COUNT = Gauge(
    'pdf_service_file_count',
    'Current file count',
    ['directory']
)


class PrometheusMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        method = request.method
        path = request.url.path

        if path == '/metrics':
            await self.app(scope, receive, send)
            return

        endpoint = self._get_endpoint(path)

        ACTIVE_REQUESTS.labels(method=method, endpoint=endpoint).inc()
        start_time = time.time()

        status_code = 500

        async def send_wrapper(message):
            nonlocal status_code
            if message['type'] == 'response.start':
                status_code = message['status']
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as e:
            logger.error(f"请求处理错误: {e}")
            raise
        finally:
            latency = time.time() - start_time
            ACTIVE_REQUESTS.labels(method=method, endpoint=endpoint).dec()
            REQUEST_COUNT.labels(method=method, endpoint=endpoint, status=status_code).inc()
            REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(latency)

    def _get_endpoint(self, path: str) -> str:
        parts = path.split('/')
        if len(parts) >= 4 and parts[1] == 'api' and parts[2] == 'pdf':
            if len(parts) > 4:
                if parts[4] == 'download':
                    return '/api/pdf/download'
                return f"/api/pdf/{parts[3]}"
            return '/api/pdf'
        return path


async def metrics_endpoint(request: Request) -> Response:
    from fastapi.responses import Response
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )


def track_pdf_operation(operation_type: str, success: bool = True):
    PDF_OPERATIONS.labels(
        operation_type=operation_type,
        status='success' if success else 'error'
    ).inc()


def track_file_upload(size: int):
    FILE_UPLOAD_SIZE.observe(size)


def update_storage_metrics(upload_dir: str, output_dir: str):
    import os

    for directory, storage_type in [(upload_dir, 'uploads'), (output_dir, 'outputs')]:
        total_size = 0
        file_count = 0

        if os.path.exists(directory):
            for root, _dirs, files in os.walk(directory):
                for f in files:
                    file_path = os.path.join(root, f)
                    try:
                        total_size += os.path.getsize(file_path)
                        file_count += 1
                    except OSError:
                        pass

        STORAGE_SIZE.labels(storage_type=storage_type).set(total_size)
        FILE_COUNT.labels(directory=storage_type).set(file_count)
