"""聊天室 WebSocket 模块 (迁移自 coze_zhs_py/api/chat_room_socket.py).

提供 9 个端点 (前缀 /cozeZhsApi/chat-room):
  - WebSocket /ws
  - GET    /rooms/{room_id}/users
  - GET    /users/{user_uuid}/rooms
  - GET    /history
  - DELETE /messages/{message_id}
  - POST   /send
  - PUT    /messages/mark-read
  - PUT    /rooms/rename
  - DELETE /users/{user_uuid}/rooms/{room_id}

复用 app.models.chat_room_models 的 ORM 模型 (ChatRoom / ChatRoomUser / ChatLetter).
"""
from app.api.v1.chat_room.router import router

__all__ = ["router"]
