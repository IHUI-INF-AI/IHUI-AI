# Stock Analyse WebSocket manager.
# Wraps the global ConnectionManager with stock-specific helpers.
import json
import time

from fastapi import WebSocket
from loguru import logger

STOCK_MODEL_ID = "stock_analyse"


class StockAnalyseWSManager:
    # Dedicated WS manager for stock analyse module
    def __init__(self):
        self.active_connections: dict[str, WebSocket] = {}
        self.connection_info: dict[str, dict] = {}
        logger.info("StockAnalyseWSManager initialised")

    async def connect(self, client_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        self.connection_info[client_id] = {
            "connected_at": time.time(),
            "last_activity": time.time(),
            "message_count": 0,
            "client_host": websocket.client.host if hasattr(websocket.client, "host") else "unknown",  # type: ignore[union-attr]
        }
        logger.info("Stock WS connected: " + client_id)

    def disconnect(self, client_id: str):
        self.active_connections.pop(client_id, None)
        self.connection_info.pop(client_id, None)
        logger.info("Stock WS disconnected: " + client_id + ", remaining: " + str(len(self.active_connections)))

    async def send_message(self, client_id: str, message: dict) -> bool:
        ws = self.active_connections.get(client_id)
        if not ws:
            logger.warning("Stock WS client not found: " + client_id)
            return False
        try:
            await ws.send_text(json.dumps(message, ensure_ascii=False))
            info = self.connection_info.get(client_id)
            if info:
                info["last_activity"] = time.time()
                info["message_count"] += 1
            return True
        except Exception as e:
            logger.error("Stock WS send error: " + str(e))
            return False

    def is_connected(self, client_id: str) -> bool:
        return client_id in self.active_connections


# Module-level singleton
stock_ws_manager = StockAnalyseWSManager()
