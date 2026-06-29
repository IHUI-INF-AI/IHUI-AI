package com.ai.manager.small.websocket;

import com.ai.manager.small.domain.dto.AgentRequestDTO;
import com.ai.manager.small.service.AgentUploadService;
import com.ai.manager.small.util.ProblemPayloadUtils;
import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

import javax.websocket.*;
import javax.websocket.RemoteEndpoint;
import javax.websocket.server.ServerEndpoint;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.*;

@Component
@ServerEndpoint("/agent-websocket")
public class AgentStreamWebSocket {

    private static final Gson GSON = new Gson();
    private static final int CHUNK_SIZE = 120;
    private static final Logger log = LoggerFactory.getLogger(AgentStreamWebSocket.class);
    private static final int WS_LOG_MAX = 1000;
    private static ApplicationContext applicationContext;
    private static final ConcurrentHashMap<String, CopyOnWriteArraySet<Session>> CHAT_SESSIONS = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<Session, Long> SESSION_LAST_ACTIVE = new ConcurrentHashMap<>();
    private static final long SESSION_IDLE_TIMEOUT_MS = TimeUnit.MINUTES.toMillis(10);
    private static final long WS_MAX_IDLE_TIMEOUT_MS = TimeUnit.MINUTES.toMillis(30);
    private static final long KEEPALIVE_INTERVAL_SECONDS = 30;
    private static final ScheduledExecutorService SESSION_CLEANER = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "agent-ws-cleaner");
        t.setDaemon(true);
        return t;
    });
    private static final ScheduledExecutorService KEEPALIVE_DISPATCHER = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "agent-ws-keepalive");
        t.setDaemon(true);
        return t;
    });

    static {
        SESSION_CLEANER.scheduleAtFixedRate(AgentStreamWebSocket::cleanupStaleSessions, 5, 5, TimeUnit.MINUTES);
        KEEPALIVE_DISPATCHER.scheduleAtFixedRate(AgentStreamWebSocket::broadcastKeepAlive, KEEPALIVE_INTERVAL_SECONDS, KEEPALIVE_INTERVAL_SECONDS, TimeUnit.SECONDS);
    }

    public static void setApplicationContext(ApplicationContext context) {
        applicationContext = context;
    }

    private AgentUploadService getAgentUploadService() {
        if (applicationContext == null) {
            throw new IllegalStateException("ApplicationContext is not initialized");
        }
        return applicationContext.getBean(AgentUploadService.class);
    }

    @OnOpen
    public void onOpen(Session session) {
        if (session != null) {
            session.setMaxIdleTimeout(WS_MAX_IDLE_TIMEOUT_MS);
            try {
                RemoteEndpoint.Async async = session.getAsyncRemote();
                if (async != null && async.getBatchingAllowed()) {
                    async.setBatchingAllowed(false);
                }
                RemoteEndpoint.Basic basic = session.getBasicRemote();
                if (basic != null && basic.getBatchingAllowed()) {
                    basic.setBatchingAllowed(false);
                }
            } catch (Exception ignore) {}
        }
        JsonObject message = new JsonObject();
        message.addProperty("type", "info");
        message.addProperty("message", "Agent stream WebSocket connected");
        sendJson(session, message);
        touchSession(session);
    }

    @OnMessage
    public void onMessage(String message, Session session) {
        CompletableFuture.runAsync(() -> handleMessageInternal(message, session));
    }

    private void handleMessageInternal(String message, Session session) {
        try {
            JsonObject payload = JsonParser.parseString(message).getAsJsonObject();
            String messageType = payload.has("type") ? payload.get("type").getAsString() : "agent_request";
            touchSession(session);

            if ("ping".equalsIgnoreCase(messageType)) {
                JsonObject pong = new JsonObject();
                pong.addProperty("type", "pong");
                pong.addProperty("ts", Instant.now().getEpochSecond());
                sendJson(session, pong);
                return;
            }

            if ("subscribe".equalsIgnoreCase(messageType)) {
                String chatId = payload.has("chat_id") ? payload.get("chat_id").getAsString() : null;
                if (chatId == null || chatId.trim().isEmpty()) {
                    sendError(session, "invalid_chat", "chat_id required for subscribe");
                    return;
                }
                registerChatSession(chatId, session);
                JsonObject ack = new JsonObject();
                ack.addProperty("type", "subscribed");
                ack.addProperty("chat_id", chatId);
                sendJson(session, ack);
                return;
            }

            if ("unsubscribe".equalsIgnoreCase(messageType)) {
                String chatId = payload.has("chat_id") ? payload.get("chat_id").getAsString() : null;
                if (chatId != null) {
                    unregisterChatSession(chatId, session);
                }
                JsonObject ack = new JsonObject();
                ack.addProperty("type", "unsubscribed");
                ack.addProperty("chat_id", chatId);
                sendJson(session, ack);
                return;
            }

            JsonObject requestBody = extractRequestBody(payload);

            // If client provides an SSE URL, bridge it in real-time
            if (requestBody.has("sse_url") && !requestBody.get("sse_url").isJsonNull()) {
                String sseUrl = requestBody.get("sse_url").getAsString();
                String chatId = requestBody.has("chat_id") ? requestBody.get("chat_id").getAsString() : UUID.randomUUID().toString();

                JsonObject ack = new JsonObject();
                ack.addProperty("type", "streaming");
                ack.addProperty("mode", "sse-bridge");
                ack.addProperty("chat_id", chatId);
                sendJson(session, ack);

                // Run SSE bridge asynchronously
                CompletableFuture.runAsync(() -> streamFromSSE(sseUrl, chatId, session));
                return;
            }

            ProblemPayloadUtils.normalizeProblemField(requestBody);
            AgentRequestDTO agentRequestDTO = GSON.fromJson(requestBody, AgentRequestDTO.class);
            if (agentRequestDTO.getChatId() == null || agentRequestDTO.getChatId().trim().isEmpty()) {
                agentRequestDTO.setChatId(UUID.randomUUID().toString());
            }

            JsonObject output = getAgentUploadService().processAgentRequestRaw(agentRequestDTO);
            streamOutput(session, agentRequestDTO, output);
        } catch (Exception e) {
            sendError(session, "invalid_request", e.getMessage());
        }
    }

    private JsonObject extractRequestBody(JsonObject payload) {
        if (payload.has("payload") && payload.get("payload").isJsonObject()) {
            return payload.getAsJsonObject("payload");
        }
        JsonObject clone = new JsonObject();
        for (Map.Entry<String, JsonElement> entry : payload.entrySet()) {
            if (!"type".equals(entry.getKey())) {
                clone.add(entry.getKey(), entry.getValue());
            }
        }
        return clone;
    }

    private void streamOutput(Session session, AgentRequestDTO agentRequestDTO, JsonObject output) {
        // If upstream is streaming, this method should not be called.
        // Kept as fallback when we only have a final output.

        String fullText = extractReadableText(output);
        if (fullText == null || fullText.trim().isEmpty()) {
            fullText = output != null ? output.toString() : "";
        }

        int totalFragments = Math.max(1, (int) Math.ceil((double) fullText.length() / CHUNK_SIZE));
        for (int i = 0; i < totalFragments; i++) {
            int start = i * CHUNK_SIZE;
            int end = Math.min(fullText.length(), start + CHUNK_SIZE);
            String fragment = fullText.substring(start, end);

            JsonObject frame = new JsonObject();
            frame.addProperty("type", "answer");
            frame.addProperty("chat_id", agentRequestDTO.getChatId());
            frame.addProperty("content_type", "text");
            frame.addProperty("fragment_index", i + 1);
            frame.addProperty("fragment_count", totalFragments);
            frame.addProperty("created_at", Instant.now().getEpochSecond());
            frame.addProperty("has_more", (i + 1) < totalFragments);
            frame.addProperty("role", "assistant");
            frame.addProperty("id", UUID.randomUUID().toString());
            frame.addProperty("content", fragment);
            sendJson(session, frame);
        }

        JsonObject completed = new JsonObject();
        completed.addProperty("type", "completed");
        completed.addProperty("chat_id", agentRequestDTO.getChatId());
        completed.addProperty("created_at", Instant.now().getEpochSecond());
        completed.addProperty("content", fullText);
        if (output != null) {
            completed.add("raw", output);
        }
        sendJson(session, completed);
        broadcastFrame(agentRequestDTO.getChatId(), completed);
    }

    private String extractReadableText(JsonObject output) {
        if (output == null) {
            return "";
        }
        try {
            if (output.has("text") && output.get("text").isJsonObject()) {
                JsonObject text = output.getAsJsonObject("text");
                if (text.has("answer") && !text.get("answer").isJsonNull()) {
                    return text.get("answer").getAsString();
                }
                StringBuilder builder = new StringBuilder();
                for (Map.Entry<String, JsonElement> entry : text.entrySet()) {
                    JsonElement value = entry.getValue();
                    if (value != null && value.isJsonPrimitive() && value.getAsJsonPrimitive().isString()) {
                        if (builder.length() > 0) {
                            builder.append('\n');
                        }
                        builder.append(value.getAsString());
                    }
                }
                if (builder.length() > 0) {
                    return builder.toString();
                }
            }
        } catch (Exception ignored) {
        }
        return "";
    }

    @OnClose
    public void onClose(Session session, CloseReason closeReason) {
        JsonObject message = new JsonObject();
        message.addProperty("type", "info");
        message.addProperty("message", "Agent stream socket closed: " + closeReason.getReasonPhrase());
        sendJson(session, message);
        removeSessionFromAllChats(session);
        SESSION_LAST_ACTIVE.remove(session);
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        sendError(session, "internal_error", throwable.getMessage());
        removeSessionFromAllChats(session);
        SESSION_LAST_ACTIVE.remove(session);
    }

    private void sendError(Session session, String code, String message) {
        JsonObject error = new JsonObject();
        error.addProperty("type", "error");
        error.addProperty("code", code);
        error.addProperty("message", message);
        sendJson(session, error);
    }

    private void sendJson(Session session, JsonObject payload) {
        if (session == null || !session.isOpen() || payload == null) {
            return;
        }
        String message = GSON.toJson(payload);
        logWsPayload("session", session.getId(), message);
        sendTextBlocking(session, message);
    }

    private static void registerChatSession(String chatId, Session session) {
        CHAT_SESSIONS.computeIfAbsent(chatId, key -> new CopyOnWriteArraySet<>()).add(session);
        touchSession(session);
    }

    private static void unregisterChatSession(String chatId, Session session) {
        Set<Session> sessions = CHAT_SESSIONS.get(chatId);
        if (sessions != null) {
            sessions.remove(session);
            if (sessions.isEmpty()) {
                CHAT_SESSIONS.remove(chatId);
            }
        }
    }

    private static void removeSessionFromAllChats(Session session) {
        for (Map.Entry<String, CopyOnWriteArraySet<Session>> entry : CHAT_SESSIONS.entrySet()) {
            CopyOnWriteArraySet<Session> sessions = entry.getValue();
            if (sessions.remove(session) && sessions.isEmpty()) {
                CHAT_SESSIONS.remove(entry.getKey(), sessions);
            }
        }
    }

    private static void cleanupStaleSessions() {
        long now = System.currentTimeMillis();
        for (Map.Entry<Session, Long> entry : SESSION_LAST_ACTIVE.entrySet()) {
            Session session = entry.getKey();
            Long lastActive = entry.getValue();
            boolean stale = session == null || !session.isOpen()
                    || lastActive == null
                    || (now - lastActive) > SESSION_IDLE_TIMEOUT_MS;
            if (stale) {
                SESSION_LAST_ACTIVE.remove(session);
                removeSessionFromAllChats(session);
                if (session != null && session.isOpen()) {
                    try {
                        session.close(new CloseReason(CloseReason.CloseCodes.GOING_AWAY, "idle timeout"));
                    } catch (IOException ignored) {
                    }
                }
            }
        }
    }

    private static void broadcastKeepAlive() {
        if (SESSION_LAST_ACTIVE.isEmpty()) {
            return;
        }
        JsonObject ping = new JsonObject();
        ping.addProperty("type", "ping");
        ping.addProperty("ts", Instant.now().getEpochSecond());
        String message = GSON.toJson(ping);
        for (Session session : SESSION_LAST_ACTIVE.keySet()) {
            if (session != null && session.isOpen()) {
                sendTextBlocking(session, message);
            }
        }
    }

    private static void touchSession(Session session) {
        if (session != null) {
            SESSION_LAST_ACTIVE.put(session, System.currentTimeMillis());
        }
    }

    private void broadcastFrame(String chatId, JsonObject payload) {
        broadcastInternal(chatId, payload);
    }

    public static void broadcastExternalFrame(String chatId, JsonObject payload) {
        broadcastInternal(chatId, payload);
    }

    private static void broadcastInternal(String chatId, JsonObject payload) {
        if (payload == null || chatId == null || chatId.trim().isEmpty()) {
            return;
        }
        Set<Session> sessions = CHAT_SESSIONS.get(chatId);
        if (sessions == null || sessions.isEmpty()) {
            return;
        }
        String message = GSON.toJson(payload);
        logWsPayload("chat", chatId, message);
        for (Session target : sessions) {
            sendTextBlocking(target, message);
        }
    }

    private static void sendTextBlocking(Session session, String message) {
        if (session == null || !session.isOpen() || message == null) {
            return;
        }
        touchSession(session);
        try {
            RemoteEndpoint.Basic basic = session.getBasicRemote();
            if (basic != null) {
                try { if (basic.getBatchingAllowed()) basic.setBatchingAllowed(false); } catch (Exception ignore) {}
                basic.sendText(message);
            }
        } catch (Exception e) {
            try {
                if (session.isOpen()) {
                    session.close(new CloseReason(CloseReason.CloseCodes.CLOSED_ABNORMALLY, e.getMessage()));
                }
            } catch (IOException ignored) {}
        }
    }

    private static void logWsPayload(String scope, String id, String payload) {
        if (!log.isInfoEnabled()) {
            return;
        }
        String safe = payload == null ? "" : payload;
        if (safe.length() > WS_LOG_MAX) {
            safe = safe.substring(0, WS_LOG_MAX) + "...(" + payload.length() + " chars)";
        }
        log.info("[WS-SEND] {}={} payload={}", scope, id, safe);
    }

    /**
     * Bridge an upstream SSE (text/event-stream) to this WebSocket in real-time.
     * Expected events:
     *   event: answer
     *   data: {"content":"...","fragment_index":1,"fragment_count":N,"has_more":true,"role":"assistant","id":"...","created_at":...,"chat_id":"..."}
     *
     * Any unknown event types are passed through as {"type":"sse_event","event":"<name>","data":<rawJsonOrText>}
     */
    private void streamFromSSE(String sseUrl, String chatId, Session session) {
        HttpURLConnection conn = null;
        BufferedReader reader = null;
        try {
            URL url = new URL(sseUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setReadTimeout((int) TimeUnit.MINUTES.toMillis(10));
            conn.setConnectTimeout((int) TimeUnit.SECONDS.toMillis(30));
            conn.setRequestProperty("Accept", "text/event-stream");
            conn.setRequestProperty("Cache-Control", "no-cache");
            conn.setRequestProperty("Connection", "keep-alive");

            int code = conn.getResponseCode();
            if (code / 100 != 2) {
                sendError(session, "sse_upstream_error", "HTTP " + code + " from upstream");
                return;
            }

            InputStream is = conn.getInputStream();
            reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));

            String line;
            String currentEvent = "message";
            StringBuilder dataBuf = new StringBuilder();

            while ((line = reader.readLine()) != null) {
                touchSession(session);
                if (line.isEmpty()) {
                    // dispatch event
                    String data = dataBuf.toString();
                    dataBuf.setLength(0);

                    if (data.isEmpty()) {
                        currentEvent = "message";
                        continue;
                    }

                    // trim "data:" prefixes per SSE spec (can be multiple lines)
                    String payload = data.replaceFirst("^data:\\s*", "");
                    // try parse JSON, fall back to text
                    JsonObject wsPayload;

                    try {
                        JsonElement elem = JsonParser.parseString(payload);
                        if (elem.isJsonObject()) {
                            JsonObject obj = elem.getAsJsonObject();
                            // If upstream already uses OpenAI-like fields, forward as-is with type safety
                            if (!obj.has("type")) {
                                // map event types commonly used by LLM streams
                                if ("answer".equalsIgnoreCase(currentEvent)) {
                                    obj.addProperty("type", "answer");
                                } else if ("completed".equalsIgnoreCase(currentEvent) || "done".equalsIgnoreCase(currentEvent)) {
                                    obj.addProperty("type", "completed");
                                } else {
                                    obj.addProperty("type", "sse_event");
                                    obj.addProperty("event", currentEvent);
                                }
                            }
                            if (!obj.has("chat_id")) {
                                obj.addProperty("chat_id", chatId);
                            }
                            wsPayload = obj;
                        } else {
                            wsPayload = new JsonObject();
                            wsPayload.addProperty("type", "sse_event");
                            wsPayload.addProperty("event", currentEvent);
                            wsPayload.addProperty("chat_id", chatId);
                            wsPayload.addProperty("data", payload);
                        }
                    } catch (Exception parseErr) {
                        wsPayload = new JsonObject();
                        wsPayload.addProperty("type", "sse_event");
                        wsPayload.addProperty("event", currentEvent);
                        wsPayload.addProperty("chat_id", chatId);
                        wsPayload.addProperty("data", payload);
                    }

                    // Send to current session and broadcast to all subscribers immediately
                    sendJson(session, wsPayload);
                    broadcastFrame(chatId, wsPayload);

                    currentEvent = "message";
                    continue;
                }

                // parse lines like "event: xxx" and "data: yyy"
                if (line.startsWith("event:")) {
                    currentEvent = line.substring("event:".length()).trim();
                } else if (line.startsWith("data:")) {
                    if (dataBuf.length() > 0) {
                        dataBuf.append('\n');
                    }
                    dataBuf.append(line);
                } // ignore other SSE fields: id:, retry:, etc.
                
                // Stop early if client disconnected
                if (session == null || !session.isOpen()) {
                    break;
                }
            }
        } catch (Exception e) {
            sendError(session, "sse_bridge_exception", e.getMessage());
        } finally {
            try {
                if (reader != null) reader.close();
            } catch (IOException ignored) {}
            if (conn != null) {
                conn.disconnect();
            }
        }
    }
}
