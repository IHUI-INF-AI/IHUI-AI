# Coze Open API compat layer.
import time
import uuid

import httpx
from loguru import logger

from app.config import settings


def _headers():
    return {"Authorization": "Bearer " + settings.COZE_PRIVATE_KEY, "Content-Type": "application/json"}


class CozeClient:
    # Coze async client wrapper using httpx.
    def __init__(self):
        self.base = settings.COZE_API_BASE
        self._client = None

    async def __aenter__(self):
        self._client = httpx.AsyncClient(timeout=30)
        return self

    async def __aexit__(self, *a):
        if self._client:
            await self._client.aclose()

    async def _request(self, method, path, **kw):
        try:
            r = await self._client.request(method, self.base + path, headers=_headers(), **kw)
            return r.json()
        except Exception as e:
            logger.error("Coze request error " + method + " " + path + ": " + str(e))
            return {"code": -1, "msg": str(e)}

    async def _raw(self, method, path, **kw):
        return await self._client.request(method, self.base + path, headers=_headers(), **kw)

    # ---- Bot ----
    async def list_bots(self, space_id="", page=1, size=20):
        return await self._request(
            "GET",
            "/v1/bot/list",
            params={"space_id": space_id or settings.COZE_ACCOUNT_ID, "page_index": page, "page_size": size},
        )

    async def get_bot(self, bot_id):
        return await self._request("GET", "/v1/bot/get_online_info", params={"bot_id": bot_id})

    async def create_bot(self, payload):
        return await self._request("POST", "/v1/bot/create", json=payload)

    async def update_bot(self, bot_id, payload):
        return await self._request("POST", "/v1/bot/update", json={"bot_id": bot_id, **payload})

    async def delete_bot(self, bot_id):
        return await self._request("POST", "/v1/bot/delete", json={"bot_id": bot_id})

    async def publish_bot(self, bot_id, version=""):
        return await self._request("POST", "/v1/bot/publish", json={"bot_id": bot_id, "version": version})

    # ---- Chat ----
    async def chat(self, payload):
        return await self._request("POST", "/v3/chat", json=payload)

    async def chat_stream(self, payload):
        return self._client.stream("POST", self.base + "/v3/chat", headers=_headers(), json=payload)

    # ---- Conversation ----
    async def create_conversation(self, bot_id, user_id):
        return await self._request("POST", "/v1/conversation/create", json={"bot_id": bot_id, "user_id": user_id})

    async def list_conversations(self, bot_id, user_id, page=1, size=20):
        return await self._request(
            "GET",
            "/v1/conversation/list",
            params={"bot_id": bot_id, "user_id": user_id, "page_index": page, "page_size": size},
        )

    async def retrieve_conversation(self, conversation_id):
        return await self._request("GET", "/v1/conversation/retrieve", params={"conversation_id": conversation_id})

    # ---- Messages ----
    async def list_messages(self, conversation_id, page=1, size=20, bot_id=""):
        p = {"conversation_id": conversation_id, "page_index": page, "page_size": size}
        if bot_id:
            p["bot_id"] = bot_id
        return await self._request("GET", "/v1/conversation/message/list", params=p)

    async def message_feedback(self, message_id, conversation_id, feedback_type, content=""):
        return await self._request(
            "POST",
            "/v1/conversation/message/feedback",
            json={
                "message_id": message_id,
                "conversation_id": conversation_id,
                "feedback_type": feedback_type,
                "content": content,
            },
        )

    # ---- Workflow ----
    async def run_workflow(self, workflow_id, parameters):
        return await self._request(
            "POST", "/v1/workflow/run", json={"workflow_id": workflow_id, "parameters": parameters}
        )

    async def run_workflow_stream(self, workflow_id, parameters):
        return self._client.stream(
            "POST",
            self.base + "/v1/workflow/run",
            headers=_headers(),
            json={"workflow_id": workflow_id, "parameters": parameters},
        )

    async def resume_workflow(self, workflow_id, event_id, resume_data, interrupt_type):
        return await self._request(
            "POST",
            "/v1/workflow/run/resume",
            json={
                "workflow_id": workflow_id,
                "event_id": event_id,
                "resume_data": resume_data,
                "interrupt_type": interrupt_type,
            },
        )

    async def workflow_history(self, workflow_id, execute_id):
        return await self._request(
            "GET", "/v1/workflow/run/history", params={"workflow_id": workflow_id, "execute_id": execute_id}
        )

    # ---- Dataset ----
    async def list_datasets(self, space_id="", page=1, size=20):
        return await self._request(
            "GET",
            "/v1/datasets/list",
            params={"space_id": space_id or settings.COZE_ACCOUNT_ID, "page_index": page, "page_size": size},
        )

    async def create_dataset(self, payload):
        return await self._request("POST", "/v1/datasets/create", json=payload)

    async def list_documents(self, dataset_id, page=1, size=20):
        return await self._request(
            "GET",
            "/v1/datasets/documents/list",
            params={"dataset_id": dataset_id, "page_index": page, "page_size": size},
        )

    async def upload_document(self, dataset_id, file_bytes, filename):
        return await self._upload_multipart(
            "/v1/datasets/documents/upload",
            {"dataset_id": dataset_id, "document_name": filename, "document_source": "0"},
            file_bytes,
            filename,
        )

    async def list_images(self, dataset_id, page=1, size=20):
        return await self._request(
            "GET", "/v1/datasets/images/list", params={"dataset_id": dataset_id, "page_index": page, "page_size": size}
        )

    async def upload_image(self, dataset_id, file_bytes, filename):
        return await self._upload_multipart(
            "/v1/datasets/images/upload", {"dataset_id": dataset_id}, file_bytes, filename
        )

    async def _upload_multipart(self, path, data, file_bytes, filename):
        try:
            r = await self._client.post(
                self.base + path,
                headers={"Authorization": "Bearer " + settings.COZE_PRIVATE_KEY},
                data=data,
                files={"file": (filename, file_bytes)},
            )
            return r.json()
        except Exception as e:
            logger.error("Coze upload error: " + str(e))
            return {"code": -1, "msg": str(e)}

    # ---- Template ----
    async def list_templates(self, page=1, size=20):
        return await self._request("GET", "/v1/templates/list", params={"page_index": page, "page_size": size})

    async def duplicate_template(self, template_id, workspace_id, name):
        return await self._request(
            "POST",
            "/v1/templates/duplicate",
            json={"template_id": template_id, "workspace_id": workspace_id, "name": name},
        )

    # ---- Workspace ----
    async def list_workspaces(self, page=1, size=20):
        return await self._request("GET", "/v1/workspaces/list", params={"page_index": page, "page_size": size})

    async def create_workspace_members(self, workspace_id, members):
        return await self._request(
            "POST", "/v1/workspaces/members/create", json={"workspace_id": workspace_id, "members": members}
        )

    async def delete_workspace_members(self, workspace_id, member_ids):
        return await self._request(
            "POST", "/v1/workspaces/members/delete", json={"workspace_id": workspace_id, "member_ids": member_ids}
        )

    # ---- Variable ----
    async def retrieve_variable(self, connector_id, variable_id):
        return await self._request(
            "GET",
            "/v1/connectors/variables/retrieve",
            params={"connector_id": connector_id, "variable_id": variable_id},
        )

    async def list_variables(self, connector_id, page=1, size=20):
        return await self._request(
            "GET",
            "/v1/connectors/variables/list",
            params={"connector_id": connector_id, "page_index": page, "page_size": size},
        )

    async def update_variable(self, payload):
        return await self._request("POST", "/v1/connectors/variables/update", json=payload)

    async def create_variable(self, payload):
        return await self._request("POST", "/v1/connectors/variables/create", json=payload)

    async def delete_variable(self, connector_id, variable_id):
        return await self._request(
            "POST", "/v1/connectors/variables/delete", json={"connector_id": connector_id, "variable_id": variable_id}
        )

    # ---- App ----
    async def list_apps(self, page=1, size=20):
        return await self._request("GET", "/v1/apps/list", params={"page_index": page, "page_size": size})

    async def list_api_apps(self, page=1, size=20):
        return await self._request("GET", "/v1/apps/list_api_apps", params={"page_index": page, "page_size": size})

    async def list_app_events(self, app_id, page=1, size=20):
        return await self._request(
            "GET", "/v1/apps/events", params={"app_id": app_id, "page_index": page, "page_size": size}
        )

    # ---- File ----
    async def upload_file(self, file_bytes, filename):
        try:
            r = await self._client.post(
                self.base + "/v1/files/upload",
                headers={"Authorization": "Bearer " + settings.COZE_PRIVATE_KEY},
                files={"file": (filename, file_bytes)},
            )
            return r.json()
        except Exception as e:
            logger.error("Coze upload file error: " + str(e))
            return {"code": -1, "msg": str(e)}


# Get Coze access token via JWT RS256 flow
async def get_coze_jwt_access_token():
    pk = settings.COZE_PRIVATE_KEY
    if not pk.strip().startswith("-----"):
        raise ValueError("COZE_PRIVATE_KEY is not a PEM key")
    try:
        import jwt
    except ImportError:
        from jose import jwt
    now = int(time.time())
    token = jwt.encode(
        {
            "iss": settings.COZE_ACCOUNT_ID,
            "aud": settings.COZE_OAUTH_APP_AUD,
            "iat": now,
            "exp": now + 3600,
            "jti": str(uuid.uuid4()),
        },
        pk,
        algorithm="RS256",
        headers={"kid": settings.COZE_PUBLIC_KEY_ID},
    )
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.post(
            settings.COZE_OAUTH_TOKEN_URL,
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
            json={"duration_seconds": 3600, "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer"},
        )
        data = r.json()
    if "access_token" not in data:
        raise ValueError("No access_token in response")
    return data["access_token"]


def list_bots_sync(space_id="", page=1, size=20):
    with httpx.Client(timeout=10) as c:
        return c.get(
            settings.COZE_API_BASE + "/v1/bot/list",
            headers=_headers(),
            params={"space_id": space_id or settings.COZE_ACCOUNT_ID, "page_index": page, "page_size": size},
        ).json()
