package com.ai.manager.small.service.impl;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.small.domain.AgentUpload;
import com.ai.manager.small.domain.dto.AgentRequestDTO;
import com.ai.manager.small.domain.dto.AgentUploadDTO;
import com.ai.manager.small.mapper.AgentUploadCenterMapper;
import com.ai.manager.small.mapper.AgentUploadMapper;
import com.ai.manager.small.service.AgentUploadService;
import com.ai.manager.small.util.ProblemPayloadUtils;
import com.ai.manager.small.websocket.AgentStreamWebSocket;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.google.common.collect.Maps;
import com.google.gson.*;
import com.google.gson.stream.JsonReader;
import lombok.SneakyThrows;
import okhttp3.*;
import okio.BufferedSource;
import org.apache.commons.beanutils.BeanUtils;
import org.apache.commons.lang3.StringUtils;
import org.assertj.core.util.Lists;
import org.bytedeco.javacv.FFmpegFrameGrabber;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.BadSqlGrammarException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import javax.servlet.http.HttpServletRequest;
import java.io.*;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;


@Service

public class AgentUploadServiceImpl implements AgentUploadService {
    private static final Logger log = LoggerFactory.getLogger(AgentUploadServiceImpl.class);

    private static final int STREAM_LOG_MAX = 1000; // 最大打印长度，避免爆日志

    private void debugStream(String channel, String event, String text) {
        try {
            String payload = text == null ? "null" : text;
            if (payload.length() > STREAM_LOG_MAX) {
                payload = payload.substring(0, STREAM_LOG_MAX) + "...(" + text.length() + " chars)";
            }
            log.info("[STREAM] [{}] event={} payload={}", channel, event, payload);
        } catch (Exception ignore) {
            // 不因日志影响主流程
        }
    }

    @Value("${n8n.token.counting.unit}")
    private Integer COUNTING_UNIT;

    @Value("${app.ws.publicUrl:}")
    private String PUBLIC_WS_URL;
    @Value("${app.ws.subscribeDelayMs:300}")
    private int SUBSCRIBE_DELAY_MS;
    /**
     * 生成完整的 WebSocket 绝对地址：
     * 1) 若配置 app.ws.publicUrl（如：wss://api.example.com/agent-websocket），优先返回该值；
     * 2) 否则根据当前请求自动拼接，支持 X-Forwarded-* 头，http→ws、https→wss。
     */
    private String buildFullWsUrl() {
        if (StringUtils.isNotBlank(PUBLIC_WS_URL)) {
            return PUBLIC_WS_URL;
        }
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs == null) {
                // 回退为相对路径（极端场景：无请求上下文，比如异步任务）
                return "/agent-websocket";
            }
            HttpServletRequest req = attrs.getRequest();

            // 兼容反向代理：优先读取 X-Forwarded-* 头
            String forwardedProto = req.getHeader("X-Forwarded-Proto");
            String forwardedHost = req.getHeader("X-Forwarded-Host");
            String forwardedPort = req.getHeader("X-Forwarded-Port");

            String httpScheme = StringUtils.isNotBlank(forwardedProto)
                    ? forwardedProto
                    : (req.isSecure() ? "https" : "http");

            // http/https → ws/wss
            String wsScheme = "ws";
            if ("https".equalsIgnoreCase(httpScheme)) {
                wsScheme = "wss";
            } else if ("http".equalsIgnoreCase(httpScheme)) {
                wsScheme = "ws";
            } else if ("wss".equalsIgnoreCase(httpScheme) || "ws".equalsIgnoreCase(httpScheme)) {
                wsScheme = httpScheme.toLowerCase();
            }

            String hostPort;
            if (StringUtils.isNotBlank(forwardedHost)) {
                hostPort = forwardedHost;
            } else {
                String serverName = req.getServerName();
                int serverPort = req.getServerPort();
                boolean isDefaultPort = ("https".equalsIgnoreCase(httpScheme) && serverPort == 443)
                        || ("http".equalsIgnoreCase(httpScheme) && serverPort == 80);
                hostPort = isDefaultPort ? serverName : (serverName + ":" + serverPort);
            }

            // 若 X-Forwarded-Host 不带端口，且给了 X-Forwarded-Port，则补上端口
            if (StringUtils.isNotBlank(forwardedHost)
                    && !forwardedHost.contains(":")
                    && StringUtils.isNotBlank(forwardedPort)) {
                hostPort = forwardedHost + ":" + forwardedPort;
            }

//            return wsScheme + "://" + hostPort + "/agent-websocket";
            return "wss://kou.aizhs.top/ws/agent-websocket";
        } catch (Exception ignore) {
            return "/agent-websocket";
        }
    }


    private static final int HTTP_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
    private final ExecutorService streamExecutor = new ThreadPoolExecutor(
            4,
            16,
            60L,
            TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(100),
            runnable -> {
                Thread t = new Thread(runnable, "agent-stream-" + UUID.randomUUID());
                t.setDaemon(true);
                return t;
            },
            new ThreadPoolExecutor.CallerRunsPolicy()
    );
    @Autowired
    private AgentUploadMapper agentUploadMapper;
    @Autowired
    private AgentUploadCenterMapper agentUploadCenterMapper;
    @Autowired
    private ISysFileService fileUploadService;


    @Transactional
    public ResponseEntity<String> uploadAgent(AgentUploadDTO agentUploadDTO) {
        System.out.println(JSON.toJSONString(agentUploadDTO));

        // 生成全局唯一ID（32位）
        String agentId = generateAgentId();
        agentUploadDTO.setAgentId(agentId);  // 设置到DTO
        if (agentUploadDTO.getStreamEnabled() == null) {
            agentUploadDTO.setStreamEnabled(false);
        }
        String connectorUserId = Optional.ofNullable(agentUploadDTO.getConnectorUserId())
                .filter(id -> id != null && !id.trim().isEmpty())
                .orElse(agentUploadDTO.getUserId());
        if (connectorUserId == null || connectorUserId.trim().isEmpty()) {
            throw new IllegalArgumentException("userId or connectorUserId must be provided");
        }
        agentUploadDTO.setConnectorUserId(connectorUserId);
        agentUploadDTO.setUserId(connectorUserId);

        // 执行三个插入操作
        agentUploadMapper.insertIntoAgentsUpload(agentUploadDTO);
        Map in = publishInToObj(agentUploadDTO.getAgentVariablesIn(), agentUploadDTO.getUserId());
        agentUploadMapper.insertIntoAgents(agentUploadDTO, JSON.toJSONString(in));
        agentUploadMapper.insertIntoZhsAgentExamine(agentUploadDTO);
        persistStreamFlag(agentId, agentUploadDTO.getStreamEnabled());


        // agentUploadMapper.insertIntoZhsUserAgentContext(agentUploadDTO);
        Map<String, Object> resp = new HashMap<>();
        resp.put("code", HttpStatus.CREATED.value());    // code 等于 HTTP Status
        resp.put("data", "Agent uploaded successfully");
        resp.put("agentId", agentId);                    // 返回覆盖后的随机ID
        return ResponseEntity.status(HttpStatus.CREATED).body(JSON.toJSONString(resp));
    }

    @Override
    public ResponseEntity<String> uploadAgent(String rawPayload) {
        if (rawPayload == null || rawPayload.trim().isEmpty()) {
            throw new IllegalArgumentException("request body cannot be empty");
        }
        AgentUploadDTO dto;
        try {
            dto = JSON.parseObject(rawPayload, AgentUploadDTO.class);
        } catch (Exception ex) {
            throw new IllegalArgumentException("invalid AgentUploadDTO payload", ex);
        }
        return uploadAgent(dto);
    }

    @Override
    public AgentRequestDTO buildAgentRequest(String rawPayload) {
        if (rawPayload == null || rawPayload.trim().isEmpty()) {
            throw new IllegalArgumentException("request body cannot be empty");
        }
        AgentRequestDTO parsed = tryParseAgentRequestDto(rawPayload);

        // 如果解析成 AgentRequestDTO 成功且有 agentId，则补齐必要字段
        if (parsed != null && StringUtils.isNotBlank(parsed.getAgentId())) {
            if (parsed.getCountingUnit() <= 0) {
                parsed.setCountingUnit(defaultCountingUnit());
            }
            if (StringUtils.isBlank(parsed.getChatId())) {
                parsed.setChatId(parsed.getUserUuid());
            }

            // 规范化 problem；若为空/[]，则回退到 inToObj 逻辑以从 additional_messages/images 聚合 problem
            String normalized = normalizeProblemString(parsed.getProblem());
            if (StringUtils.isBlank(normalized) || "[]".equals(normalized)) {
                Map<String, Object> normalizedMap = inToObj(rawPayload);
                return mapToAgentRequestDto(normalizedMap);
            }
            parsed.setProblem(normalized);
            return parsed;
        }

        // 否则直接走 inToObj 兼容各种前端入参
        Map<String, Object> normalized = inToObj(rawPayload);
        return mapToAgentRequestDto(normalized);
    }

    // 生成符合业务规则的ID（示例：AG前缀+时间戳+随机码）
    private String generateAgentId() {
        return UUID.randomUUID().toString();

    }

    private final Gson gson = new Gson();

    private final OkHttpClient sseHttp = new OkHttpClient.Builder()
            .connectTimeout(HTTP_TIMEOUT_MS, java.util.concurrent.TimeUnit.MILLISECONDS)
            .readTimeout(0, java.util.concurrent.TimeUnit.MILLISECONDS) // SSE: no read timeout
            .retryOnConnectionFailure(true)
            .protocols(java.util.Collections.singletonList(Protocol.HTTP_1_1))
            .build();
    private boolean streamUpstreamSseWithOkHttp(String postUrl, JsonObject inputPayload, String chatId) throws Exception {
        RequestBody body = RequestBody.create(
                inputPayload == null ? "" : inputPayload.toString(),
                MediaType.parse("application/json; charset=utf-8")
        );
        Request req = new Request.Builder()
                .url(postUrl)
                .addHeader("Pragma", "no-cache")
                .addHeader("X-Accel-Buffering", "no")
                .addHeader("X-Requested-With", "XMLHttpRequest")
                .addHeader("Content-Type", "application/json")
                .addHeader("Accept", "text/event-stream")
                .addHeader("Cache-Control", "no-cache")
                .addHeader("Connection", "keep-alive")
                .addHeader("Accept-Encoding", "identity")
                .addHeader("stream", "true")
                .post(body)
                .build();
        try (Response resp = sseHttp.newCall(req).execute()) {
            int code = resp.code();
            if (code >= 400) {
                JsonObject error = new JsonObject();
                error.addProperty("type", "error");
                error.addProperty("chat_id", chatId);
                error.addProperty("message", "Webhook responded status " + code);
                AgentStreamWebSocket.broadcastExternalFrame(chatId, error);
                return false;
            }
            String contentType = resp.header("Content-Type", "");
            contentType = contentType == null ? "" : contentType.toLowerCase();
            log.info("[STREAM] Upstream Content-Type={}, URL={}", contentType, postUrl);

            // if (contentType.contains("text/event-stream") || contentType.isEmpty()) {
                try (BufferedSource ignored = resp.body().source();
                     InputStream is = resp.body().byteStream();
                     BufferedReader reader = new BufferedReader(new InputStreamReader(is, java.nio.charset.StandardCharsets.UTF_8), 8192)) {
                        // System.out.println(reader.readLine());
                    return parseAndBroadcastSse(reader, chatId);
                }
            // } else {
            //     String bodyStr = resp.body() != null ? resp.body().string() : "";
            //     emitJsonResponse(bodyStr, chatId);
            //     return true;
            // }
        }
    }

    private JsonObject getTargetVariableInObject(String targetParameterName, JsonArray variablesInArray) {
        for (JsonElement element : variablesInArray) {
            JsonObject obj = element.getAsJsonObject();
            String objParameterName = obj.get("parameterName").getAsString();
            if (targetParameterName.equals(objParameterName)) {
                return obj;
            }
        }

        return null;
    }

    private JsonElement normalizeElement(JsonElement element) {
        if (element == null || element.isJsonNull()) {
            return JsonNull.INSTANCE;
        }
        if (element.isJsonPrimitive() && element.getAsJsonPrimitive().isString()) {
            String raw = element.getAsString();
            if (raw == null) {
                return JsonNull.INSTANCE;
            }
            String trimmed = raw.trim();
            if (trimmed.isEmpty()) {
                return JsonNull.INSTANCE;
            }
            if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
                try {
                    return JsonParser.parseString(trimmed);
                } catch (JsonSyntaxException ignored) {
                    return new JsonPrimitive(trimmed);
                }
            }
            return new JsonPrimitive(trimmed);
        }
        return element;
    }

    private void appendStringValue(JsonObject target, String key, String value) {
        if (target == null || key == null || value == null) {
            return;
        }
        if (!target.has(key)) {
            target.addProperty(key, value);
            return;
        }
        JsonElement existing = target.get(key);
        JsonArray array;
        if (existing.isJsonArray()) {
            array = existing.getAsJsonArray();
        } else {
            array = new JsonArray();
            array.add(existing.deepCopy());
        }
        array.add(new JsonPrimitive(value));
        target.add(key, array);
    }



    //  获取agent响应
    // 解析响应内容并分类存储
    private JsonObject buildAgentInputPayload(AgentUpload agent, String problems) {
        if (agent == null) {
            throw new RuntimeException("Agent not found");
        }
        JsonArray problemsArray = coerceProblemsToArray(problems);
        String variablesInStr = Optional.ofNullable(agent.getAgentVariablesIn()).orElse("[]");
        JsonElement variablesInElement = JsonParser.parseString(variablesInStr);
        JsonArray variablesInArray;
        if (variablesInElement.isJsonArray()) {
            variablesInArray = variablesInElement.getAsJsonArray();
        } else if (variablesInElement.isJsonObject()) {
            variablesInArray = new JsonArray();
            variablesInArray.add(variablesInElement);
        } else {
            throw new IllegalArgumentException("agentVariablesIn must be a JSON array or object");
        }

        JsonObject inputParamsObject = new JsonObject();
        Map<String, List<JsonElement>> paramValueMap = new HashMap<>();
        for (JsonElement element : problemsArray) {
            JsonObject problemObject = element.getAsJsonObject();
            String targetParameterName = problemObject.get("parameterName").getAsString();
            JsonObject variableInObject = getTargetVariableInObject(targetParameterName, variablesInArray);

            String key = targetParameterName;
            JsonElement rawContent = problemObject.get("content");
            JsonElement normalized = normalizeElement(rawContent);
            if (normalized == null || normalized.isJsonNull() ||
                    (normalized.isJsonPrimitive() && normalized.getAsJsonPrimitive().isString() && normalized.getAsString().isEmpty())) {
                JsonElement defEl = variableInObject != null ? variableInObject.get("Default") : null;
                if (defEl != null && !defEl.isJsonNull()) {
                    if (defEl.isJsonArray() && defEl.getAsJsonArray().size() > 0) {
                        normalized = normalizeElement(defEl.getAsJsonArray().get(0));
                    } else {
                        normalized = normalizeElement(defEl);
                    }
                }
                if (normalized == null) normalized = JsonNull.INSTANCE;
            }
            paramValueMap.computeIfAbsent(key, k -> new ArrayList<>()).add(normalized.deepCopy());
        }

        for (Map.Entry<String, List<JsonElement>> entry : paramValueMap.entrySet()) {
            String paramNameKey = entry.getKey();
            List<JsonElement> values = entry.getValue();
            if (values == null || values.isEmpty()) {
                inputParamsObject.add(paramNameKey, JsonNull.INSTANCE);
                continue;
            }
            if (values.size() == 1) {
                JsonElement single = values.get(0);
                inputParamsObject.add(paramNameKey,
                        (single == null || single.isJsonNull()) ? JsonNull.INSTANCE : single.deepCopy());
                continue;
            }
            JsonArray arr = new JsonArray();
            for (JsonElement v : values) {
                arr.add(v == null || v.isJsonNull() ? JsonNull.INSTANCE : v.deepCopy());
            }
            inputParamsObject.add(paramNameKey, arr);
        }
        return inputParamsObject;
    }

    private JsonArray coerceProblemsToArray(String rawProblems) {
        String safeProblems = (rawProblems == null || rawProblems.trim().isEmpty()) ? "[]" : rawProblems.trim();
        JsonElement element = parseJsonSafely(safeProblems);
        return toProblemArray(element);
    }

    private JsonElement parseJsonSafely(String json) {
        System.out.println(json);
        if (json == null) return JsonNull.INSTANCE;
        String trimmed = json.trim();
        try {
            // 严格解析
            return JsonParser.parseString(trimmed);
        } catch (JsonSyntaxException ex) {
            try {
                // 宽松解析
                com.google.gson.stream.JsonReader reader =
                        new com.google.gson.stream.JsonReader(new java.io.StringReader(trimmed));
                reader.setLenient(true);
                return JsonParser.parseReader(reader);
            } catch (Exception ignore) {
                // 仍失败：返回原始字符串作为 JsonPrimitive，交由上层兜底逻辑处理
                return new JsonPrimitive(trimmed);
            }
        }
    }

    private JsonArray toProblemArray(JsonElement element) {
        if (element == null || element.isJsonNull()) {
            return new JsonArray();
        }
        if (element.isJsonArray()) {
            return element.getAsJsonArray();
        }
        if (element.isJsonObject()) {
            JsonObject obj = element.getAsJsonObject();
            JsonArray arr = new JsonArray();
            if (obj.has("parameterName") && obj.has("content")) {
                arr.add(obj);
                return arr;
            }
            for (Map.Entry<String, JsonElement> entry : obj.entrySet()) {
                JsonObject mapped = new JsonObject();
                mapped.addProperty("parameterName", entry.getKey());
                mapped.add("content", entry.getValue());
                arr.add(mapped);
            }
            return arr;
        }
        if (element.isJsonPrimitive() && element.getAsJsonPrimitive().isString()) {
            String nested = element.getAsString();
            if (nested != null && !nested.trim().isEmpty()) {
                JsonElement parsed = parseJsonSafely(nested);
                if (parsed != null && (parsed.isJsonArray() || parsed.isJsonObject())) {
                    return toProblemArray(parsed);
                }
                // 解析不了：把原字符串当成 content 包装为单条问题
                JsonArray arr = new JsonArray();
                JsonObject single = new JsonObject();
                single.addProperty("parameterName", "content");
                single.addProperty("content", nested);
                arr.add(single);
                return arr;
            } else {
                // 空字符串等价于空问题集
                return new JsonArray();
            }
        }
        throw new IllegalArgumentException("problems must be a JSON array or object");
    }

    private JsonObject extractAnswerObject(JsonElement element) {
        if (element == null || element.isJsonNull()) {
            throw new IllegalArgumentException("Agent response cannot be null");
        }
        if (element.isJsonObject()) {
            return element.getAsJsonObject();
        }
        if (element.isJsonArray()) {
            JsonArray arr = element.getAsJsonArray();
            if (arr.size() == 0) {
                throw new IllegalArgumentException("Agent response array is empty");
            }
            JsonElement first = arr.get(0);
            if (!first.isJsonObject()) {
                throw new IllegalArgumentException("Agent response array must contain objects");
            }
            return first.getAsJsonObject();
        }
        if (element.isJsonPrimitive() && element.getAsJsonPrimitive().isString()) {
            String nested = element.getAsString();
            if (nested != null && !nested.trim().isEmpty()) {
                return extractAnswerObject(parseJsonSafely(nested));
            }
        }
        throw new IllegalArgumentException("Agent response must be a JSON object or array");
    }

    private String extractStatus(JsonObject answerObject) {
        if (answerObject == null) {
            return null;
        }
        if (answerObject.has("status") && !answerObject.get("status").isJsonNull()) {
            return answerObject.get("status").getAsString();
        }
        if (answerObject.has("task_status") && !answerObject.get("task_status").isJsonNull()) {
            return answerObject.get("task_status").getAsString();
        }
        return null;
    }

    @SneakyThrows
    private JsonObject getAgentResponse(String agentId, String problems, Integer CountingUnit) {
        AgentUpload agent = agentUploadMapper.selectByAgentId(agentId);
        if (agent == null) {
            throw new RuntimeException("Agent not found");
        }

        JsonObject inputParamsObject = buildAgentInputPayload(agent, problems);


        // 安全获取agentUrl字段（带空值检查）
        String agentUrl = Optional.ofNullable(agent.getAgentUrl())
                .filter(url -> !url.trim().isEmpty())
                .orElseThrow(() -> new IllegalArgumentException("Agent URL cannot be null or empty"));
        //Map a= Maps.newHashMap();
        //a.put("body",inputParamsObject);
        // 发送POST请求
        HttpResponse postResponse = HttpRequest.post(agentUrl)
                .header("Content-Type", "application/json")
                .header("Accept", "text/event-stream")
                .header("stream", "true")
                .body(inputParamsObject.toString())
                .timeout(HTTP_TIMEOUT_MS) // 设置超时时间为2分钟
                .execute();

        System.out.println(postResponse.header("Content-Type"));
        System.out.println(postResponse.body());
        JsonElement responseElement = parseJsonSafely(postResponse.body());
        JsonObject answerObject = extractAnswerObject(responseElement);
        answerObject = waitForTaskIfNeeded(answerObject, agentUrl);
        int videoToken = 0;
        String ratio = null;
       if (answerObject.has("token") && !answerObject.get("token").isJsonNull()) {
            videoToken = answerObject.get("token").getAsInt();
        }
        if (answerObject.has("ratio") && !answerObject.get("ratio").isJsonNull()) {
            ratio = answerObject.get("ratio").getAsString();
        }


        // 解析variablesOut字符串为JsonArray
        String variablesOutStr = Optional.ofNullable(agent.getAgentVariablesOut()).orElse("[]");
        JsonElement variablesOutElement = JsonParser.parseString(variablesOutStr);
        JsonArray variablesOutArray;
        if (variablesOutElement.isJsonArray()) {
            variablesOutArray = variablesOutElement.getAsJsonArray();
        } else if (variablesOutElement.isJsonObject()) {
            variablesOutArray = new JsonArray();
            variablesOutArray.add(variablesOutElement);
        } else {
            throw new IllegalArgumentException("agentVariablesOut must be a JSON array or object");
        }

        Map<String, JsonObject> outputTypeMap = new LinkedHashMap<>();

        for (JsonElement outElement : variablesOutArray) {
            JsonObject variableOutObject = outElement.getAsJsonObject();
            String targetParameterName = Optional.ofNullable(variableOutObject.get("parameterName"))
                    .map(JsonElement::getAsString)
                    .orElse(null);
            if (targetParameterName == null) {
                continue;
            }
            String targetType = Optional.ofNullable(variableOutObject.get("type"))
                    .map(JsonElement::getAsString)
                    .map(s -> s.toLowerCase(Locale.ROOT))
                    .orElse("");

            JsonElement answerValue = answerObject.get(targetParameterName);
            if (answerValue == null || answerValue.isJsonNull()
                    || (answerValue.isJsonPrimitive() && answerValue.getAsJsonPrimitive().isString()
                    && answerValue.getAsString().trim().isEmpty())) {
                answerValue = variableOutObject.get("default");
            }
            answerValue = normalizeElement(answerValue);
            if (answerValue == null || answerValue.isJsonNull()) {
                continue;
            }

            JsonObject typeBucket = outputTypeMap.computeIfAbsent(targetType, k -> new JsonObject());
            typeBucket.add(targetParameterName, answerValue.deepCopy());
        }

        JsonObject finalOutput = new JsonObject();
        JsonObject textParams = new JsonObject();
        JsonObject imageParams = new JsonObject();
        JsonObject videoParams = new JsonObject();
        JsonObject audioParams = new JsonObject();

        int totalTokensUsed = 0;
        List<String> agentFileUrlParts = new ArrayList<>();
        boolean videoTokenCounted = false;

        for (Map.Entry<String, JsonObject> typeEntry : outputTypeMap.entrySet()) {
            String typeKey = typeEntry.getKey();
            JsonObject paramsByName = typeEntry.getValue();

            for (Map.Entry<String, JsonElement> paramEntry : paramsByName.entrySet()) {
                String paramName = paramEntry.getKey();
                JsonElement value = paramEntry.getValue();

                switch (typeKey) {
                    case "text":
                        if (value != null && value.isJsonPrimitive()) {
                            String textValue = value.getAsString();
                            textParams.addProperty(paramName, textValue);
                            if (CountingUnit != null) {
                                totalTokensUsed += textValue.length() * CountingUnit;
                            }
                        } else if (value != null) {
                            textParams.add(paramName, value.deepCopy());
                            if (CountingUnit != null) {
                                totalTokensUsed += value.toString().length() * CountingUnit;
                            }
                        }
                        break;
                    case "image":
                        totalTokensUsed += handleImageValue(paramName, value, imageParams, agentFileUrlParts, CountingUnit);
                        break;
                    case "video":
                        totalTokensUsed += handleVideoValue(paramName, value, videoParams, agentFileUrlParts, CountingUnit);
                        if (!videoTokenCounted && CountingUnit != null && videoToken > 0) {
                            totalTokensUsed += videoToken;
                            videoTokenCounted = true;
                        }
                        break;
                    case "audio":
                        totalTokensUsed += handleAudioValue(paramName, value, audioParams, agentFileUrlParts, CountingUnit);
                        break;
                    default:
                        if (value != null) {
                            JsonElement normalized = normalizeElement(value);
                            if (normalized != null && !normalized.isJsonNull()) {
                                if (normalized.isJsonPrimitive()) {
                                    String textValue = normalized.getAsString();
                                    textParams.addProperty(paramName, textValue);
                                    if (CountingUnit != null) {
                                        totalTokensUsed += textValue.length() * CountingUnit;
                                    }
                                } else {
                                    textParams.add(paramName, normalized.deepCopy());
                                    if (CountingUnit != null) {
                                        totalTokensUsed += normalized.toString().length() * CountingUnit;
                                    }
                                }
                            }
                        }
                        break;
                }
            }
        }

        if (textParams.entrySet().isEmpty()) {
            for (Map.Entry<String, JsonElement> entry : answerObject.entrySet()) {
                String key = entry.getKey();
                if ("token".equalsIgnoreCase(key)
                        || "ratio".equalsIgnoreCase(key)
                        || "task_status".equalsIgnoreCase(key)
                        || "task_id".equalsIgnoreCase(key)) {
                    continue;
                }
                JsonElement rawValue = entry.getValue();
                JsonElement normalized = normalizeElement(rawValue);
                if (normalized == null || normalized.isJsonNull()) {
                    continue;
                }
                if (normalized.isJsonPrimitive()) {
                    String textValue = normalized.getAsString();
                    textParams.addProperty(key, textValue);
                    if (CountingUnit != null) {
                        totalTokensUsed += textValue.length() * CountingUnit;
                    }
                } else {
                    textParams.add(key, normalized.deepCopy());
                    if (CountingUnit != null) {
                        totalTokensUsed += normalized.toString().length() * CountingUnit;
                    }
                }
            }
            if (textParams.entrySet().isEmpty() && answerObject.entrySet().size() > 0) {
                textParams.addProperty("raw", answerObject.toString());
            }
        }

        String derivedStatus = extractStatus(answerObject);

        String agentFileUrl = agentFileUrlParts.isEmpty()
                ? ""
                : String.join(";", agentFileUrlParts);
        finalOutput.addProperty("agentFileUrl", agentFileUrl);
        if (derivedStatus != null && !derivedStatus.trim().isEmpty()) {
            finalOutput.addProperty("status", derivedStatus);
        }

        if (ratio != null) {
            finalOutput.addProperty("ratio", ratio);
        }

        finalOutput.add("text", textParams);
        
        if (!imageParams.entrySet().isEmpty()) {
            finalOutput.add("image", imageParams);
        }
        if (!videoParams.entrySet().isEmpty()) {
            finalOutput.add("video", videoParams);
        }
        if (!audioParams.entrySet().isEmpty()) {
            finalOutput.add("audio", audioParams);
        }

        finalOutput.addProperty("totalTokensUsed", totalTokensUsed);

        return finalOutput;
    }

    /**
     * 从最终输出结构中提取可读文本：
     * 1) 优先 text.answer
     * 2) 然后拼接 text.* 的所有字符串字段
     * 3) 失败则返回空串（上层可回退到 output.toString()）
     */
    private String extractTextFromOutput(JsonObject output) {
        if (output == null) return "";
        try {
            if (output.has("text") && output.get("text").isJsonObject()) {
                JsonObject textObj = output.getAsJsonObject("text");
                if (textObj.has("answer") && !textObj.get("answer").isJsonNull()) {
                    return textObj.get("answer").getAsString();
                }
                StringBuilder sb = new StringBuilder();
                for (Map.Entry<String, JsonElement> e : textObj.entrySet()) {
                    JsonElement v = e.getValue();
                    if (v != null && v.isJsonPrimitive() && v.getAsJsonPrimitive().isString()) {
                        if (sb.length() > 0) sb.append('\n');
                        sb.append(v.getAsString());
                    }
                }
                if (sb.length() > 0) return sb.toString();
            }
        } catch (Exception ignored) {}
        return "";
    }

    public JsonObject processAgentRequestRaw(AgentRequestDTO agentRequestDTO) {
        return processAgentCore(agentRequestDTO);
    }

    public String processAgentRequest(AgentRequestDTO agentRequestDTO) {
        JsonObject output = processAgentRequestRaw(agentRequestDTO);
        JsonObject clientPayload = buildClientResponse(output);
        return clientPayload.toString();
    }

    @SneakyThrows
    @Override
    public Map<String, Object> processAgentPayload(String rawBody) {
//        String normalizedBody = normalizeProblemsPayload(rawBody);
//        AgentRequestDTO agentRequestDTO;
//        try {
//            agentRequestDTO = buildAgentRequest(normalizedBody);
//        } catch (Exception ex) {
//            throw new IllegalArgumentException("Invalid JSON payload: " + ex.getMessage(), ex);
//        }
        Map<String, Object> stringObjectMap = inToObj(rawBody);
        AgentRequestDTO agentRequestDTO = AgentRequestDTO.builder().build();
        BeanUtils.copyProperties(agentRequestDTO, stringObjectMap);
        boolean streamEnabled = isAgentStreamEnabled(agentRequestDTO.getAgentId());
        return streamEnabled
                ? processAgentRequestStream(agentRequestDTO)
                : processAgentRequestWebsocketBridge(agentRequestDTO);
    }

    private JsonObject buildClientResponse(JsonObject output) {
        JsonObject payload = new JsonObject();
        int token = 0;
        if (output != null && output.has("totalTokensUsed") && output.get("totalTokensUsed").isJsonPrimitive()) {
            token = output.get("totalTokensUsed").getAsInt();
        }
        payload.addProperty("token", token);

        JsonObject content = new JsonObject();

        // 提取纯文本答案（若有）
        String textAnswer = extractTextFromOutput(output);
        if (textAnswer == null) {
            textAnswer = "";
        }

        List<String> agentFileUrls = extractAgentFileUrls(output);
        if (!agentFileUrls.isEmpty()) {
            JsonArray urlArray = new JsonArray();
            for (String url : agentFileUrls) {
                urlArray.add(url);
            }
            content.add("url", urlArray);
        }
        if (textAnswer.trim().length() > 0) {
            content.addProperty("text", textAnswer);
        }
        payload.add("content", content);
        return payload;
    }

    private List<String> extractAgentFileUrls(JsonObject output) {
        List<String> urls = new ArrayList<>();
        if (output == null || !output.has("agentFileUrl") || output.get("agentFileUrl").isJsonNull()) {
            return urls;
        }
        String raw = output.get("agentFileUrl").getAsString();
        if (raw == null || raw.trim().isEmpty()) {
            return urls;
        }
        String[] parts = raw.split(";");
        for (String part : parts) {
            if (part == null) {
                continue;
            }
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                urls.add(trimmed);
            }
        }
        return urls;
    }

    @Override
    public boolean isAgentStreamEnabled(String agentId) {
        if (agentId == null || agentId.trim().isEmpty()) {
            return false;
        }
        try {
            Boolean flag = agentUploadMapper.selectStreamEnabled(agentId);
            return Boolean.TRUE.equals(flag);
        } catch (BadSqlGrammarException ex) {
            log.debug("stream_enabled column not available, defaulting stream flag to false: {}", ex.getMessage());
            return false;
        }
    }

    @Override
    public Map<String, Object> processAgentRequestWebsocketBridge(AgentRequestDTO agentRequestDTO) {
        return processAgentRequestBridge(agentRequestDTO, false);
    }

    @Override
    public Map<String, Object> processAgentRequestStream(AgentRequestDTO agentRequestDTO) {
        return processAgentRequestBridge(agentRequestDTO, true);
    }

    private Map<String, Object> processAgentRequestBridge(AgentRequestDTO agentRequestDTO, boolean streamPreferred) {
        String agentId = agentRequestDTO.getAgentId();
        AgentUpload agent = agentUploadMapper.selectByAgentId(agentId);
        if (agent == null) {
            throw new RuntimeException("Agent not found");
        }
        String chatId = Optional.ofNullable(agentRequestDTO.getChatId())
                .filter(id -> id != null && !id.trim().isEmpty())
                .orElse(UUID.randomUUID().toString());
        agentRequestDTO.setChatId(chatId);

        JsonObject inputPayload = streamPreferred
                ? buildStreamInputPayloadLenient(agent, agentRequestDTO.getProblem())
                : buildAgentInputPayload(agent, agentRequestDTO.getProblem());

        CompletableFuture.runAsync(() -> {
            // small gate: give client a moment to subscribe WS before streaming begins
            try {
                if (SUBSCRIBE_DELAY_MS > 0) {
                    Thread.sleep(Math.min(SUBSCRIBE_DELAY_MS, 3000));
                }
            } catch (InterruptedException ignored) {}
            streamAgentWebhook(agent, inputPayload, chatId);
        }, streamExecutor);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("code", 200);
        response.put("message", "ok");
        response.put("mode", streamPreferred ? "websocket-stream" : "websocket");
        response.put("chat_id", chatId);
        response.put("websocket", buildFullWsUrl());
        Map<String, Object> subscribePayload = new LinkedHashMap<>();
        subscribePayload.put("type", "subscribe");
        subscribePayload.put("chat_id", chatId);
        response.put("subscribe_payload", subscribePayload);
        return response;
    }

    private String normalizeProblemsPayload(String rawBody) {
        String normalizedBody = rawBody;
        try {
            String safe = (rawBody == null || rawBody.trim().isEmpty()) ? "{}" : rawBody.trim();
            JsonElement rootEl = JsonParser.parseString(safe);
            if (rootEl != null && rootEl.isJsonObject()) {
                JsonObject obj = rootEl.getAsJsonObject();
                if (obj.has("problem") && !obj.has("problems")) {
                    JsonElement p = obj.get("problem");
                    com.google.gson.JsonArray arr = new com.google.gson.JsonArray();
                    if (p != null && p.isJsonArray()) {
                        arr = p.getAsJsonArray();
                    } else if (p != null && !p.isJsonNull()) {
                        arr.add(p);
                    }
                    obj.addProperty("problems", arr.toString());
                    obj.remove("problem");
                    normalizedBody = obj.toString();
                } else if (obj.has("problems")) {
                    JsonElement pe = obj.get("problems");
                    if (pe != null && !pe.isJsonNull()) {
                        if (pe.isJsonArray()) {
                            obj.addProperty("problems", pe.getAsJsonArray().toString());
                            normalizedBody = obj.toString();
                        } else if (pe.isJsonObject()) {
                            com.google.gson.JsonArray arr = new com.google.gson.JsonArray();
                            arr.add(pe);
                            obj.addProperty("problems", arr.toString());
                            normalizedBody = obj.toString();
                        } else if (pe.isJsonPrimitive() && pe.getAsJsonPrimitive().isString()) {
                            String s = pe.getAsString();
                            try {
                                JsonReader reader = new JsonReader(new StringReader(s));
                                reader.setLenient(true);
                                JsonElement parsed = JsonParser.parseReader(reader);
                                com.google.gson.JsonArray arr = new com.google.gson.JsonArray();
                                if (parsed != null && parsed.isJsonArray()) {
                                    obj.addProperty("problems", parsed.getAsJsonArray().toString());
                                } else if (parsed != null && parsed.isJsonObject()) {
                                    arr.add(parsed.getAsJsonObject());
                                    obj.addProperty("problems", arr.toString());
                                } else if (parsed != null && parsed.isJsonPrimitive()) {
                                    arr.add(parsed.getAsJsonPrimitive());
                                    obj.addProperty("problems", arr.toString());
                                } else {
                                    arr.add(s);
                                    obj.addProperty("problems", arr.toString());
                                }
                                normalizedBody = obj.toString();
                            } catch (Exception bad) {
                                com.google.gson.JsonArray arr = new com.google.gson.JsonArray();
                                arr.add(s);
                                obj.addProperty("problems", arr.toString());
                                normalizedBody = obj.toString();
                            }
                        }
                    }
                }
            }
        } catch (Exception ignore) {}
        return normalizedBody;
    }


    private JsonObject processAgentCore(AgentRequestDTO agentRequestDTO) {
        String agentId = agentRequestDTO.getAgentId();
        String userUuid = agentRequestDTO.getUserUuid();
        String userUrl = agentRequestDTO.getUserUrl();
        String problem = agentRequestDTO.getProblem();
        String chatId = agentRequestDTO.getChatId();
        Integer CountingUnit = agentRequestDTO.getCountingUnit();

        AgentUpload agent = agentUploadMapper.selectByAgentId(agentId);//得到入参出参和agenturl
        if (agent == null) {
            throw new RuntimeException("Agent not found");
        }

        JsonObject output = getAgentResponse(agentId, problem, CountingUnit);

        String newId = UUID.randomUUID().toString(); // 生成新的唯一ID
        String modelName = agent.getAgentName(); // 获取agent_name作为modelName
        Long sendTime = Instant.now().getEpochSecond(); // 当前时间戳（秒值）

        String ratio = output.has("ratio") ? output.get("ratio").getAsString() : null;
        String answer = output.get("text").getAsJsonObject().has("answer") ?
                output.get("text").getAsJsonObject().get("answer").getAsString() : null;
        String agentUrl = output.get("agentFileUrl").getAsString();

        agentUploadMapper.insertNewContext(
                newId,
                agentId,
                userUuid,
                problem,
                answer,
                userUrl,
                agentUrl,
                sendTime,
                modelName,
                chatId,
                ratio
        );

        agentUploadMapper.deleteOldestContextWhenOverflow(chatId);

        Integer tokenQuantity = agentUploadCenterMapper.selectTokenQuantityByUserUuid(userUuid);
        if (tokenQuantity == null) {
            throw new RuntimeException("User margin not found");
        }

        int totalTokensUsed = output.get("totalTokensUsed").getAsInt();
        int newTokenQuantity = tokenQuantity - totalTokensUsed;
        agentUploadCenterMapper.updateTokenQuantity(userUuid, newTokenQuantity);

        return output;
    }

    /**
     * 分析并打印视频参数
     */
    private String analyzeVideoParameters(FFmpegFrameGrabber grabber) {
        // 视频分辨率
        int width = grabber.getImageWidth();
        int height = grabber.getImageHeight();

        // 视频长度(毫秒转换为时分秒)
        long durationMs = grabber.getLengthInTime();
        long hours = TimeUnit.MILLISECONDS.toHours(durationMs);
        long minutes = TimeUnit.MILLISECONDS.toMinutes(durationMs) -
                TimeUnit.HOURS.toMinutes(hours);
        long seconds = TimeUnit.MILLISECONDS.toSeconds(durationMs) -
                TimeUnit.MINUTES.toSeconds(TimeUnit.MILLISECONDS.toMinutes(durationMs));

        // 视频比例
        String aspectRatio = calculateAspectRatio(width, height);
        //返回宽高比
        return aspectRatio;

    }

    /**
     * 计算视频宽高比
     */
    private String calculateAspectRatio(int width, int height) {
        if (width <= 0 || height <= 0) {
            return "未知";
        }

        // 计算最大公约数
        int gcd = gcd(width, height);
        int ratioWidth = width / gcd;
        int ratioHeight = height / gcd;

        return ratioWidth + ":" + ratioHeight;
    }

    /**
     * 计算最大公约数
     */
    private int gcd(int a, int b) {
        return b == 0 ? a : gcd(b, a % b);
    }


    public Map<String, Object> selectByAgentId(String agentId) {
        AgentUpload agent = agentUploadMapper.selectByAgentId(agentId);
        if (agent == null) {
            return null;
        }

        Map<String, Object> result = new HashMap<>();
        result.put("agent_variables_in", agent.getAgentVariablesIn());
        result.put("agent_variables_out", agent.getAgentVariablesOut());
        result.put("agent_url", agent.getAgentUrl());
        return result;
    }

    /**
     * Unified media handler to de-duplicate logic across image/video/audio.
     * mediaType: "image" | "video" | "audio"
     */
    private int handleMediaValue(String paramName,
                                 JsonElement value,
                                 JsonObject bucketParams,
                                 List<String> agentFileUrlParts,
                                 Integer countingUnit,
                                 String mediaType) {
        if (value == null || value.isJsonNull()) {
            return 0;
        }
        // If it's an array, handle each element recursively.
        if (value.isJsonArray()) {
            int tokens = 0;
            for (JsonElement el : value.getAsJsonArray()) {
                tokens += handleMediaValue(paramName, el, bucketParams, agentFileUrlParts, countingUnit, mediaType);
            }
            return tokens;
        }

        int tokensUsed = 0;
        String urlOut = null;

        try {
            if (value.isJsonObject()) {
                // Object payload with {fileName, fileContentBase64}
                JsonObject fileObject = value.getAsJsonObject();
                String fileName = fileObject.has("fileName") && !fileObject.get("fileName").isJsonNull()
                        ? fileObject.get("fileName").getAsString()
                        : paramName;
                String base64 = fileObject.has("fileContentBase64") && !fileObject.get("fileContentBase64").isJsonNull()
                        ? fileObject.get("fileContentBase64").getAsString()
                        : null;

                if (base64 != null) {
                    byte[] fileBytes = Base64.getDecoder().decode(base64);
                    urlOut = fileUploadService.uploadMinio(fileBytes, fileName);

                    if (countingUnit != null) {
                        if ("audio".equalsIgnoreCase(mediaType)) {
                            // For audio, prefer duration-based token accounting
                            ByteArrayInputStream audioStream = new ByteArrayInputStream(fileBytes);
                            FFmpegFrameGrabber grabber = new FFmpegFrameGrabber(audioStream);
                            try {
                                grabber.start();
                                int audioDuration = (int) (grabber.getLengthInTime() / 1_000_000);
                                tokensUsed += audioDuration * countingUnit;
                            } finally {
                                try { grabber.stop(); } catch (Exception ignored) {}
                                try { grabber.release(); } catch (Exception ignored) {}
                                try { audioStream.close(); } catch (IOException ignored) {}
                            }
                        } else {
                            // For image/video, approximate by file size (KB)
                            tokensUsed += (fileBytes.length / 1024) * countingUnit;
                        }
                    }
                }
            } else if (value.isJsonPrimitive()) {
                // It might be a network URL/path
                String remotePath = value.getAsString();
                if (remotePath != null && !remotePath.trim().isEmpty()) {
                    ResponseResultInfo<String> uploadResult = fileUploadService.fileUploadNetworkPath(remotePath);
                    urlOut = uploadResult.getData();

                    if (countingUnit != null) {
                        if ("audio".equalsIgnoreCase(mediaType)) {
                            // Duration-based estimate from remote path
                            FFmpegFrameGrabber grabber = new FFmpegFrameGrabber(remotePath);
                            try {
                                grabber.start();
                                int audioDuration = (int) (grabber.getLengthInTime() / 1_000_000);
                                tokensUsed += audioDuration * countingUnit;
                            } finally {
                                try { grabber.stop(); } catch (Exception ignored) {}
                                try { grabber.release(); } catch (Exception ignored) {}
                            }
                        } else {
                            // Size-based estimate from remote content length
                            tokensUsed += estimateRemoteSizeInKB(remotePath) * countingUnit;
                        }
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        if (urlOut != null) {
            appendStringValue(bucketParams, paramName, urlOut);
            agentFileUrlParts.add(urlOut);
        }
        return tokensUsed;
    }

    private int handleImageValue(String paramName, JsonElement value, JsonObject imageParams,
                                 List<String> agentFileUrlParts, Integer countingUnit) {
        return handleMediaValue(paramName, value, imageParams, agentFileUrlParts, countingUnit, "image");
    }

    private int handleVideoValue(String paramName, JsonElement value, JsonObject videoParams,
                                  List<String> agentFileUrlParts, Integer countingUnit) {
        return handleMediaValue(paramName, value, videoParams, agentFileUrlParts, countingUnit, "video");
    }

    private int handleAudioValue(String paramName, JsonElement value, JsonObject audioParams,
                                 List<String> agentFileUrlParts, Integer countingUnit) {
        return handleMediaValue(paramName, value, audioParams, agentFileUrlParts, countingUnit, "audio");
    }

    private int estimateRemoteSizeInKB(String fileUrl) {
        if (fileUrl == null || fileUrl.trim().isEmpty()) {
            return 0;
        }
        try {
            URL url = new URL(fileUrl);
            java.net.URLConnection connection = url.openConnection();
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            int length = connection.getContentLength();
            if (length > 0) {
                return length / 1024;
            }
        } catch (IOException ignored) {
        }
        return 0;
    }

    private JsonObject waitForTaskIfNeeded(JsonObject answerObject, String agentUrl) throws InterruptedException {
        if (answerObject == null || !answerObject.has("task_status")) {
            return answerObject;
        }
        String status = answerObject.get("task_status").getAsString();
        if ("succeeded".equalsIgnoreCase(status) || "success".equalsIgnoreCase(status)) {
            return answerObject;
        }
        if (!answerObject.has("task_id")) {
            return answerObject;
        }
        String taskId = answerObject.get("task_id").getAsString();
        Map<String, String> taskMap = new HashMap<>();
        taskMap.put("task_id", taskId);

        int tokenFromResponse = answerObject.has("token") && !answerObject.get("token").isJsonNull()
                ? answerObject.get("token").getAsInt() : 0;
        String ratioFromResponse = answerObject.has("ratio") && !answerObject.get("ratio").isJsonNull()
                ? answerObject.get("ratio").getAsString() : null;

        int maxAttempts = 30;
        int attempts = 0;
        while (!"succeeded".equalsIgnoreCase(status) && !"success".equalsIgnoreCase(status)) {
            if (++attempts > maxAttempts) {
                System.out.println("任务查询超过最大重试次数，结束轮询 taskId=" + taskId);
                break;
            }
            Thread.sleep(10000); // 每10秒检查一次

            HttpResponse latestResponse;
            try {
                latestResponse = HttpRequest.post(agentUrl)
                        .header("Content-Type", "application/json")
                        .body(JSON.toJSONString(taskMap))
                        .timeout(HTTP_TIMEOUT_MS)
                        .execute();
            } catch (Exception ex) {
                System.out.println("任务查询请求异常，继续重试：" + ex.getMessage());
                continue;
            }

            if (latestResponse.getStatus() >= 500) {
                System.out.println("任务查询返回状态码 " + latestResponse.getStatus() + "，继续重试");
                continue;
            }

            String latestBody = latestResponse.body();
            JsonArray latestResponseBodyArray;
            try {
                latestResponseBodyArray = JsonParser.parseString(latestBody).getAsJsonArray();
            } catch (Exception parseEx) {
                System.out.println("任务查询结果解析失败，继续重试：" + parseEx.getMessage());
                continue;
            }
            JsonObject latestAnswerObject = latestResponseBodyArray.get(0).getAsJsonObject();

            JsonElement urlElement = latestAnswerObject.get("url");
            if (latestAnswerObject.has("token") && !latestAnswerObject.get("token").isJsonNull()) {
                tokenFromResponse = latestAnswerObject.get("token").getAsInt();
            }
            if (latestAnswerObject.has("ratio") && !latestAnswerObject.get("ratio").isJsonNull()) {
                ratioFromResponse = latestAnswerObject.get("ratio").getAsString();
            }

            boolean hasValidUrl = urlElement != null && !urlElement.isJsonNull()
                    && urlElement.getAsString().contains("https://");
            boolean hasMetrics = tokenFromResponse > 0
                    && ratioFromResponse != null
                    && !ratioFromResponse.isEmpty();

            if (hasValidUrl || hasMetrics) {
                if (hasValidUrl) {
                    System.out.println("任务完成, URL: " + urlElement.getAsString());
                }
                answerObject = latestAnswerObject;
                break;
            }

            if (latestAnswerObject.has("task_status") && !latestAnswerObject.get("task_status").isJsonNull()) {
                status = latestAnswerObject.get("task_status").getAsString();
            }
        }
        return answerObject;
    }

    private Map<String, Object> buildStreamingPayload(AgentRequestDTO agentRequestDTO, JsonObject output) {
        Map<String, Object> payload = new LinkedHashMap<>();
        String chatId = Optional.ofNullable(agentRequestDTO.getChatId())
                .filter(id -> id != null && !id.trim().isEmpty())
                .orElse(UUID.randomUUID().toString());
        long timestamp = Instant.now().getEpochSecond();

        String content = extractTextFromOutput(output);
        if (content == null || content.trim().isEmpty()) {
            content = output != null ? output.toString() : "";
        }

        payload.put("chat_id", chatId);
        payload.put("content", content);
        payload.put("content_type", "text");
        payload.put("created_at", timestamp);
        payload.put("fragment_count", 1);
        payload.put("id", UUID.randomUUID().toString());
        payload.put("is_merged", true);
        payload.put("role", "assistant");
        payload.put("type", "answer");
        payload.put("updated_at", timestamp);
        return payload;
    }

    private void streamAgentWebhook(AgentUpload agent, JsonObject inputPayload, String chatId) {
        String agentUrl = Optional.ofNullable(agent.getAgentUrl())
                .filter(url -> !url.trim().isEmpty())
                .orElseThrow(() -> new IllegalArgumentException("Agent URL cannot be null or empty"));
        final String postUrl = ensureStreamQueryParam(agentUrl);
        final int maxAttempts = 3;
        Exception lastException = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            boolean completedSent = false;
            try {
                log.info("[STREAM] (attempt {}) Connecting upstream SSE (OkHttp) at {}", attempt, postUrl);
                completedSent = streamUpstreamSseWithOkHttp(postUrl, inputPayload, chatId);
                if (!completedSent) {
                    emitCompleted(chatId);
                }
                return;
            } catch (Exception ex) {
                lastException = ex;
                if (attempt < maxAttempts) {
                    try { Thread.sleep(1000L * attempt); } catch (InterruptedException ignored) {}
                    continue;
                }
                JsonObject error = new JsonObject();
                error.addProperty("type", "error");
                error.addProperty("chat_id", chatId);
                error.addProperty("message", ex.getMessage());
                AgentStreamWebSocket.broadcastExternalFrame(chatId, error);
                emitCompleted(chatId);
            }
        }
        if (lastException != null) {
            lastException.printStackTrace();
        }
    }

    private boolean parseAndBroadcastSse(BufferedReader reader, String chatId) throws IOException {
        String eventName = "message"; // default SSE event
        String line;
        boolean completedEmitted = false;
        StringBuilder dataBuf = null; // accumulate multi-line data: blocks

        while ((line = reader.readLine()) != null) {
            if (line.isEmpty()) {
                // end of an SSE event block -> flush accumulated data
                if (dataBuf != null && dataBuf.length() > 0) {
                    String payload = dataBuf.toString().trim();
                    dataBuf.setLength(0);
                    if ("[DONE]".equalsIgnoreCase(payload)) {
                        emitCompleted(chatId);
                        completedEmitted = true;
                        return true;
                    }
                    // coerce possible quoted-JSON string into real JSON text
                    String coerced = coerceJsonString(payload);
                    emitSseDataLineImmediate(chatId, eventName, coerced);
                }
                // reset for next block
                eventName = "message";
                continue;
            }

            if (line.charAt(0) == ':') {
                // comment / heartbeat
                continue;
            }

            if (line.startsWith("event:")) {
                eventName = line.substring(6).trim();
                if (eventName.isEmpty()) eventName = "message";
                continue;
            }

            if (line.startsWith("data:")) {
                String data = line.substring(5).trim();
                if (dataBuf == null) dataBuf = new StringBuilder();
                if (dataBuf.length() > 0) dataBuf.append('\n');
                dataBuf.append(data);
                continue;
            }

            // Vendor sometimes sends raw JSON lines without data: prefix
            String trimmed = line.trim();
            if ("[DONE]".equalsIgnoreCase(trimmed)) {
                emitCompleted(chatId);
                completedEmitted = true;
                return true;
            }
            if (isProbablyStandaloneJson(trimmed)) {
                String coerced = coerceJsonString(trimmed);
                emitSseDataLineImmediate(chatId, eventName, coerced);
                continue;
            }
            // otherwise ignore unrecognized lines
        }

        // Flush any leftover data on stream end
        if (!completedEmitted) {
            if (dataBuf != null && dataBuf.length() > 0) {
                String payload = dataBuf.toString().trim();
                if (!payload.isEmpty()) {
                    if ("[DONE]".equalsIgnoreCase(payload)) {
                        emitCompleted(chatId);
                        completedEmitted = true;
                    } else {
                        String coerced = coerceJsonString(payload);
                        emitSseDataLineImmediate(chatId, eventName, coerced);
                    }
                }
            }
            if (!completedEmitted) {
                emitCompleted(chatId);
            }
        }
        return true;
    }

    // If the payload is a JSON-quoted string that itself contains JSON, unwrap and return inner JSON text.
    private String coerceJsonString(String s) {
        if (s == null) return "";
        String t = s.trim();
        if (t.isEmpty()) return t;
        // Handle cases like "{\"type\":\"begin\",...}" -> {"type":"begin",...}
        if (t.startsWith("\"") && t.endsWith("\"")) {
            try {
                JsonElement el = JsonParser.parseString(t);
                if (el.isJsonPrimitive() && el.getAsJsonPrimitive().isString()) {
                    String inner = el.getAsString();
                    return inner != null ? inner : t;
                }
            } catch (Exception ignore) { /* fall through */ }
        }
        return t;
    }


    private void emitSseDataLineImmediate(String chatId, String eventName, String payloadLine) {
        JsonObject frame = new JsonObject();
        frame.addProperty("type", eventName == null ? "message" : eventName);
        frame.addProperty("chat_id", chatId);
        frame.addProperty("created_at", Instant.now().getEpochSecond());
        try {
            // Try strict parse first
            JsonElement el = JsonParser.parseString(payloadLine);
            JsonObject asJsonObject = el.getAsJsonObject();
            asJsonObject.addProperty("totalTokensUsed", asJsonObject.get("totalTokensUsed").getAsInt() * COUNTING_UNIT);
            frame.add("data", el);
        } catch (Exception strict) {
            try {
                // Lenient: wrap as text delta to avoid buffering until JSON becomes balanced
                JsonObject data = new JsonObject();
                data.addProperty("delta", payloadLine);
                frame.add("data", data);
            } catch (Exception ignore) {
                frame.addProperty("data_text", payloadLine);
            }
        }
        AgentStreamWebSocket.broadcastExternalFrame(chatId, frame);
    }

    private boolean tryEmitBufferedFrame(String chatId, String eventName, StringBuilder dataBuilder) {
        if (!shouldFlushWithoutDelimiter(dataBuilder)) {
            return false;
        }
        return emitStreamFrame(chatId, eventName, dataBuilder);
    }

    private boolean shouldFlushWithoutDelimiter(CharSequence buffer) {
        if (buffer == null || buffer.length() == 0) {
            return false;
        }
        String trimmed = buffer.toString().trim();
        if (trimmed.isEmpty()) {
            return false;
        }
        if ("[DONE]".equalsIgnoreCase(trimmed)) {
            return true;
        }
        char first = trimmed.charAt(0);
        char last = trimmed.charAt(trimmed.length() - 1);
        if ((first == '{' && last == '}') || (first == '[' && last == ']')) {
            return hasBalancedJsonBrackets(trimmed);
        }
        // 纯文本行，视为单条事件
        return true;
    }

    private boolean hasBalancedJsonBrackets(String text) {
        int curly = 0;
        int square = 0;
        boolean inString = false;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == '"' && (i == 0 || text.charAt(i - 1) != '\\')) {
                inString = !inString;
                continue;
            }
            if (inString) {
                continue;
            }
            if (c == '{') {
                curly++;
            } else if (c == '}') {
                curly--;
            } else if (c == '[') {
                square++;
            } else if (c == ']') {
                square--;
            }
            if (curly < 0 || square < 0) {
                return false;
            }
        }
        return curly == 0 && square == 0;
    }

    private boolean emitStreamFrame(String chatId, String eventName, StringBuilder dataBuilder) {
        if (dataBuilder.length() == 0) {
            return false;
        }
        String raw = dataBuilder.toString();
        dataBuilder.setLength(0);
        // Fast path: if raw is [DONE], emit completed and return
        if ("[DONE]".equalsIgnoreCase(raw != null ? raw.trim() : null)) { emitCompleted(chatId); return true; }

        JsonObject frame = new JsonObject();
        frame.addProperty("type", eventName);
        frame.addProperty("chat_id", chatId);
        frame.addProperty("created_at", Instant.now().getEpochSecond());
        try {
            JsonElement element = JsonParser.parseString(raw);
            frame.add("data", element);
            if (element.isJsonObject() && element.getAsJsonObject().has("chat_id")) {
                frame.addProperty("chat_id", element.getAsJsonObject().get("chat_id").getAsString());
            }
        } catch (JsonSyntaxException ex) {
            frame.addProperty("data_text", raw);
        }
        AgentStreamWebSocket.broadcastExternalFrame(chatId, frame);
        try {
            String payload = frame.has("data")
                    ? frame.get("data").toString()
                    : (frame.has("data_text") ? frame.get("data_text").getAsString() : "");

            debugStream("WS", eventName, payload);
        } catch (Exception ignore) {}
        return "completed".equalsIgnoreCase(eventName);
    }

    private void emitJsonResponse(String body, String chatId) {
        JsonObject frame = new JsonObject();
        frame.addProperty("type", "answer");
        frame.addProperty("chat_id", chatId);
        frame.addProperty("created_at", Instant.now().getEpochSecond());
        try {
            JsonElement element = JsonParser.parseString(body);
            String answerText = extractAnswerText(element);
            boolean streamed = streamAnswerIfPossible(answerText, chatId);
            if (streamed) {
                emitCompleted(chatId);
                return;
            }
            frame.add("data", element);
        } catch (JsonSyntaxException ex) {
            frame.addProperty("data_text", body);
        }
        AgentStreamWebSocket.broadcastExternalFrame(chatId, frame);
        try {
            String payload = frame.has("data")
                    ? frame.get("data").toString()
                    : (frame.has("data_text") ? frame.get("data_text").getAsString() : "");
            debugStream("WS", "answer", payload);
        } catch (Exception ignore) {}
        emitCompleted(chatId);
    }

    private boolean streamAnswerIfPossible(String answer, String chatId) {
        if (StringUtils.isBlank(answer)) {
            return false;
        }
        List<String> segments = segmentOutputText(answer);
        if (segments.size() <= 1) {
            return false;
        }
        int total = segments.size();
        for (int i = 0; i < total; i++) {
            emitDeltaFrame(chatId, segments.get(i), i + 1, total);
        }
        return true;
    }

    private String extractAnswerText(JsonElement element) {
        if (element == null || element.isJsonNull()) {
            return null;
        }
        if (element.isJsonPrimitive()) {
            return element.getAsString();
        }
        if (element.isJsonArray() && element.getAsJsonArray().size() > 0) {
            return extractAnswerText(element.getAsJsonArray().get(0));
        }
        if (!element.isJsonObject()) {
            return null;
        }
        JsonObject obj = element.getAsJsonObject();
        String direct = firstNonNullString(
                obj.get("output"),
                obj.get("answer"),
                obj.get("content"),
                obj.get("text")
        );
        if (StringUtils.isNotBlank(direct)) {
            return direct;
        }
        if (obj.has("data")) {
            String nested = extractAnswerText(obj.get("data"));
            if (StringUtils.isNotBlank(nested)) {
                return nested;
            }
        }
        if (obj.has("text") && obj.get("text").isJsonObject()) {
            String nested = extractAnswerText(obj.get("text"));
            if (StringUtils.isNotBlank(nested)) {
                return nested;
            }
        }
        if (obj.has("message")) {
            String nested = extractAnswerText(obj.get("message"));
            if (StringUtils.isNotBlank(nested)) {
                return nested;
            }
        }
        for (Map.Entry<String, JsonElement> entry : obj.entrySet()) {
            if (entry.getValue() != null && entry.getValue().isJsonObject()) {
                String nested = extractAnswerText(entry.getValue());
                if (StringUtils.isNotBlank(nested)) {
                    return nested;
                }
            }
        }
        return null;
    }

    private String firstNonNullString(JsonElement... elements) {
        if (elements == null) {
            return null;
        }
        for (JsonElement element : elements) {
            if (element == null || element.isJsonNull()) {
                continue;
            }
            if (element.isJsonPrimitive()) {
                String value = element.getAsString();
                if (StringUtils.isNotBlank(value)) {
                    return value;
                }
            }
        }
        return null;
    }

    private List<String> segmentOutputText(String output) {
        List<String> segments = new ArrayList<>();
        if (StringUtils.isBlank(output)) {
            return segments;
        }
        final int chunkLimit = 200;
        String normalized = output
                .replace("\r\n", "\n")
                .replace("\\r\\n", "\n")
                .replace("\\n", "\n")
                .replace("\r", "\n");

        String[] lines = normalized.split("\\n+");
        StringBuilder current = new StringBuilder();
        for (String rawLine : lines) {
            String line = rawLine == null ? "" : rawLine.trim();
            if (line.isEmpty()) {
                continue;
            }
            if (current.length() > 0 && current.length() + line.length() + 1 > chunkLimit) {
                segments.add(current.toString());
                current.setLength(0);
            }
            if (current.length() > 0) {
                current.append('\n');
            }
            current.append(line);
        }
        if (current.length() > 0) {
            segments.add(current.toString());
        }
        if (segments.size() <= 1 && normalized.length() > chunkLimit) {
            segments.clear();
            for (int i = 0; i < normalized.length(); i += chunkLimit) {
                int end = Math.min(normalized.length(), i + chunkLimit);
                segments.add(normalized.substring(i, end));
            }
        }
        return segments;
    }

    private void emitDeltaFrame(String chatId, String delta, int index, int total) {
        JsonObject frame = new JsonObject();
        frame.addProperty("type", "message");
        frame.addProperty("chat_id", chatId);
        frame.addProperty("created_at", Instant.now().getEpochSecond());

        JsonObject data = new JsonObject();
        data.addProperty("delta", delta);
        data.addProperty("index", index);
        data.addProperty("total", total);
        frame.add("data", data);

        AgentStreamWebSocket.broadcastExternalFrame(chatId, frame);
        try {
            debugStream("WS", "chunk", delta);
        } catch (Exception ignore) {}
    }

    private void emitCompleted(String chatId) {
        JsonObject completed = new JsonObject();
        completed.addProperty("type", "completed");
        completed.addProperty("chat_id", chatId);
        completed.addProperty("created_at", Instant.now().getEpochSecond());
        AgentStreamWebSocket.broadcastExternalFrame(chatId, completed);
        try {
            debugStream("WS", "completed", "{\"status\":\"done\"}");
        } catch (Exception ignore) {}
    }

    private void persistStreamFlag(String agentId, Boolean streamEnabled) {
        if (streamEnabled == null) {
            return;
        }
        try {
            agentUploadMapper.updateStreamEnabled(agentId, streamEnabled);
        } catch (BadSqlGrammarException ex) {
            log.debug("stream_enabled column not found, skip persisting stream flag: {}", ex.getMessage());
        }
    }


    /*
    客户端入参转化为key/Value结构

     */
    private Map<String, Object> inToObj(String in){
        JSONObject jsonObject = JSON.parseObject(in);
        Map<String, Object> result = Maps.newHashMap();

        String agentId = jsonObject.getString("bot_id");
        if (StringUtils.isBlank(agentId)) {
            agentId = jsonObject.getString("agent_id");
        }
        if (StringUtils.isBlank(agentId)) {
            agentId = jsonObject.getString("agentId");
        }
        result.put("agentId", agentId);

        String userUuid = firstNonBlank(jsonObject.getString("user_uuid"),
                jsonObject.getString("userUuid"),
                jsonObject.getString("user_id"));
        result.put("userUuid", userUuid);

        String chatId = firstNonBlank(jsonObject.getString("chat_id"),
                jsonObject.getString("conversation_id"),
                userUuid);
        result.put("chatId", chatId);

        Integer countingUnit = jsonObject.getInteger("counting_unit");
        if (countingUnit == null) {
            countingUnit = defaultCountingUnit();
        }
        result.put("countingUnit", countingUnit);

        String userUrl = firstNonBlank(jsonObject.getString("user_url"),
                jsonObject.getString("userUrl"));
        if (StringUtils.isNotBlank(userUrl)) {
            result.put("userUrl", userUrl);
        }

        JSONArray additionalMessages = jsonObject.getJSONArray("additional_messages");
        String aggregatedContent = aggregateAdditionalMessages(additionalMessages);

        Map<String, Object> problem = Maps.newHashMap();

        // images（如果有则并入 problem）
        JSONArray images = jsonObject.getJSONArray("images");
        if (images != null && !images.isEmpty()) {
            // 直接把数组并入 problem，按键名 "image" 统一收口
            problem.put("image", images);
        }

        if (StringUtils.isNotBlank(aggregatedContent)) {
            problem.put("content", aggregatedContent);
        }

        JSONArray agentVariables = jsonObject.getJSONArray("agent_variables");
        if (agentVariables != null) {
            for (int i = 0; i < agentVariables.size(); i++) {
                JSONObject next = agentVariables.getJSONObject(i);
                JSONArray components = next.getJSONArray("components");
                if (components == null) {
                    continue;
                }
                for (int j = 0; j < components.size(); j++) {
                    JSONObject field = components.getJSONObject(j);
                    if (field == null) {
                        continue;
                    }
                    String name = field.getString("name");
                    Object val = field.containsKey("value") ? field.get("value") : field.get("default_value");
                    if (StringUtils.isNotBlank(name)) {
                        problem.put(name, val);
                    }
                }
            }
        }
        result.put("problem", JSON.toJSONString(problem));
        return result;
    }


    /*
    上架n8n时入参格式转客户端解析结构 保存到agents的agent_variables中
     */
    private Map<String, Object> publishInToObj(String in, String uuid){
        JSONArray jsonArray = new JSONArray();
        if (StringUtils.isNotBlank(in)) {
            try {
                Object parsed = JSON.parse(in);
                if (parsed instanceof JSONArray) {
                    jsonArray = (JSONArray) parsed;
                } else if (parsed instanceof JSONObject) {
                    jsonArray.add(parsed);
                } else {
                    log.warn("agentVariablesIn is not array/object, treat as empty. value={}", in);
                }
            } catch (Exception ex) {
                log.warn("failed to parse agentVariablesIn, treat as empty. value={}, error={}", in, ex.getMessage());
            }
        }
        Map<String, Object> result = Maps.newHashMap();
        result.put("id", uuid);
/*
    [
        {
            "parameterName": "content",
            "parameterDescription": "提示词",
            "type": "text",
            "Default": "123"
        },
        {
            "parameterName": "Boolean1",
            "parameterDescription": "bool",
            "type": "boolean",
            "Default": [

            ]
        }
    ]
 */

        List<Map> components = Lists.newArrayList();
        for (int i = 0; i < jsonArray.size(); i++) {
            JSONObject next = jsonArray.getJSONObject(i);
            String name = next.getString("parameterName");
            String description = next.getString("parameterDescription");
            String type = next.getString("type");
            Object defaultValue = next.get("Default");
            Map<String, Object> component = Maps.newHashMap();
            component.put("name",name);
            component.put("description",description);
            component.put("type",type);
            component.put("default_value", defaultValue);
            component.put("is_required", false);
            components.add(component);
        }

        result.put("components",components);
        return result;
/*
    [
        {
            "id": "7537587415553196074",
            "components": [
                {
                    "name": "title",
                    "type": "text",
                    "description": "标题（养生） ",
                    "is_required": true,
                    "default_value": ""
                }
            ]
        }
    ]
 */
    }





    private AgentRequestDTO tryParseAgentRequestDto(String rawPayload) {
        try {
            JsonElement element = JsonParser.parseString(rawPayload);
            if (element == null || !element.isJsonObject()) {
                return null;
            }
            JsonObject root = element.getAsJsonObject();
//            ProblemPayloadUtils.normalizeProblemField(root);
            return gson.fromJson(root, AgentRequestDTO.class);
        } catch (Exception ex) {
            log.debug("raw payload is not AgentRequestDTO format: {}", ex.getMessage());
            return null;
        }
    }

    private AgentRequestDTO mapToAgentRequestDto(Map<String, Object> payload) {
        AgentRequestDTO dto = new AgentRequestDTO();
        dto.setAgentId(asString(payload.get("agentId")));
        dto.setUserUuid(asString(payload.containsKey("userUuid") ? payload.get("userUuid") : payload.get("user_id")));
        dto.setChatId(asString(payload.getOrDefault("chatId", dto.getUserUuid())));
        dto.setCountingUnit(Optional.ofNullable(asInteger(payload.get("countingUnit"))).orElse(defaultCountingUnit()));
        dto.setUserUrl(asString(payload.get("userUrl")));
        dto.setProblem(normalizeProblemString(payload.get("problem")));
        if (StringUtils.isBlank(dto.getAgentId())) {
            throw new IllegalArgumentException("agentId cannot be null or empty");
        }
        if (StringUtils.isBlank(dto.getUserUuid())) {
            throw new IllegalArgumentException("userUuid cannot be null or empty");
        }
        return dto;
    }

    private int defaultCountingUnit() {
        return COUNTING_UNIT != null ? COUNTING_UNIT : 3;
    }

    private String normalizeProblemString(Object rawProblem) {
        if (rawProblem == null) {
            return "[]";
        }
        if (rawProblem instanceof String) {
            String str = (String) rawProblem;
            if (StringUtils.isBlank(str)) {
                return "[]";
            }
            try {
                JsonElement element = JsonParser.parseString(str);
                String normalized = ProblemPayloadUtils.normalizeProblemValue(element);
                return normalized != null ? normalized : str;
            } catch (Exception ex) {
                return str;
            }
        }
        try {
            String json = JSON.toJSONString(rawProblem);
            JsonElement element = JsonParser.parseString(json);
            String normalized = ProblemPayloadUtils.normalizeProblemValue(element);
            return normalized != null ? normalized : json;
        } catch (Exception ex) {
            return "[]";
        }
    }

    private String aggregateAdditionalMessages(JSONArray additionalMessages) {
        if (additionalMessages == null || additionalMessages.isEmpty()) {
            return null;
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < additionalMessages.size(); i++) {
            JSONObject next = additionalMessages.getJSONObject(i);
            if (next == null) {
                continue;
            }
            String content = next.getString("content");
            if (StringUtils.isNotBlank(content)) {
                if (sb.length() > 0) {
                    sb.append(' ');
                }
                sb.append(content.trim());
            }
        }
        return sb.length() == 0 ? null : sb.toString();
    }

    private String asString(Object value) {
        return value == null ? null : Objects.toString(value, null);
    }

    private Integer asInteger(Object value) {
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            String str = (String) value;
            if (StringUtils.isBlank(str)) {
                return null;
            }
            try {
                return Integer.parseInt(str.trim());
            } catch (NumberFormatException ignored) {
            }
        }
        return null;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (StringUtils.isNotBlank(value)) {
                return value;
            }
        }
        return null;
    }




    /**
     * 构造流式场景的入参（宽松版）：
     * 1) 首选严格的 buildAgentInputPayload；
     * 2) 如遇到 problems 解析异常，退化为 {"content": "<原始problem字符串>"}，不再抛错。
     */
    private JsonObject buildStreamInputPayloadLenient(AgentUpload agent, String problems) {
        try {
            return buildAgentInputPayload(agent, problems);
        } catch (Exception ex) {
            JsonObject fallback = new JsonObject();
            fallback.addProperty("content", problems == null ? "" : problems);
            return fallback;
        }
    }

    /**
     * 如果 URL 中没有 stream=true，则自动追加该查询参数，帮助上游选择流式返回。
     * - http://a.com/xxx           -> http://a.com/xxx?stream=true
     * - http://a.com/xxx?a=1       -> http://a.com/xxx?a=1&stream=true
     * - 已包含 stream=true/false   -> 原样返回，不重复添加
     */
    private String ensureStreamQueryParam(String url) {
        if (url == null || url.trim().isEmpty()) return url;
        String lower = url.toLowerCase(Locale.ROOT);
        // 如果已经包含 stream=...，不再追加
        if (lower.contains("stream=")) {
            return url;
        }
        // 仅当是 webhook/test 等标准入口时添加；否则保持原样更安全
        boolean looksLikeWebhook = lower.contains("/webhook") || lower.contains("/webhook-test");
        if (!looksLikeWebhook) {
            return url;
        }
        if (url.contains("?")) {
            return url + "&stream=true";
        }
        return url + "?stream=true";
    }

    // Helper: read all content from InputStream as UTF-8 string
    private String readAll(InputStream is) throws IOException {
        if (is == null) return "";
        StringBuilder sb = new StringBuilder();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            char[] buf = new char[4096];
            int n;
            while ((n = br.read(buf)) != -1) {
                sb.append(buf, 0, n);
            }
        }
        return sb.toString();
    }

    // Heuristic: is this line probably a standalone JSON or short delta?
    private boolean isProbablyStandaloneJson(String s) {
        if (s == null) return false;
        String t = s.trim();
        if (t.isEmpty()) return false;
        char first = t.charAt(0);
        char last = t.charAt(t.length() - 1);
        if ((first == '{' && last == '}') || (first == '[' && last == ']')) {
            return hasBalancedJsonBrackets(t);
        }
        // Short tokens like plain text deltas are also OK to emit per-line
        return t.length() <= 512; // heuristics: flush small data lines immediately
    }}
