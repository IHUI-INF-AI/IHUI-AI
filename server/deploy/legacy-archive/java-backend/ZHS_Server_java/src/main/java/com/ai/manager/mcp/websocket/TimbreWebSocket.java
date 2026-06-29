package com.ai.manager.mcp.websocket;

import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.utils.JWTUtils;
import com.ai.manager.mcp.service.AliAIService;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;

import javax.websocket.*;
import javax.websocket.server.ServerEndpoint;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

@Component
@ServerEndpoint("/timbre-websocket")
public class TimbreWebSocket {

    // 存储每个会话的参数Future
    private static final ConcurrentHashMap<String, CompletableFuture<JsonObject>> parameterFutures = new ConcurrentHashMap<>();
    // 存储每个会话的处理结果
    private static final ConcurrentHashMap<String, ResponseResultInfo> processingResults = new ConcurrentHashMap<>();

    // Spring ApplicationContext引用
    private static ApplicationContext applicationContext;

    // Gson实例用于JSON处理
    private static final Gson gson = new Gson();

    public static void setApplicationContext(ApplicationContext context) {
        applicationContext = context;
    }

    /**
     * 获取AliAIService实例
     */
    private AliAIService getAliAIService() {
        return applicationContext.getBean(AliAIService.class);
    }

    /**
     * 获取JWTUtils实例
     */
    private JWTUtils getJWTUtils() {
        return applicationContext.getBean(JWTUtils.class);
    }

    /**
     * WebSocket连接建立时的回调方法
     */
    @OnOpen
    public void onOpen(Session session) {
        try {
            // ✅ 使用与LoginInterceptor相同的认证方式
            String token = getQueryParam(session, "token");

            if (!validateToken(token)) {
                sendMessage(session, "type", "error", "message", "认证失败，无效的token");
                session.close(new CloseReason(CloseReason.CloseCodes.VIOLATED_POLICY, "认证失败"));
                return;
            }

            // 保存用户信息到session中供后续使用
            String userUuid = getUserIdFromToken(token);
            session.getUserProperties().put("userUuid", userUuid);
            session.getUserProperties().put("token", token);

            // 认证成功后，继续原有业务逻辑
            sendMessage(session, "type", "info", "message", "认证成功，WebSocket连接已建立");

            // 为每个会话创建参数Future
            CompletableFuture<JsonObject> parameterFuture = new CompletableFuture<>();
            parameterFutures.put(session.getId(), parameterFuture);
            sendMessage(session, "type", "info", "message", "音色生成WebSocket连接已建立，请发送初始参数");

            // 异步等待参数并处理
            waitForParameters(session, parameterFuture);

        } catch (Exception e) {
            handleError(session, e);
        }
    }

    // 从查询参数中提取指定参数
    private String getQueryParam(Session session, String paramName) {
        try {
            String queryString = session.getQueryString();
            if (queryString != null) {
                String[] params = queryString.split("&");
                for (String param : params) {
                    if (param.startsWith(paramName + "=")) {
                        return param.substring(paramName.length() + 1);
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return null;
    }

    // 验证token的方法 - 使用与LoginInterceptor相同的逻辑
    private boolean validateToken(String token) {
        try {
            if (token == null || token.isEmpty()) {
                return false;
            }

            // 检查是否是Bearer格式
            if (!token.startsWith("Bearer ")) {
                return false;
            }

            // 提取实际的JWT token
            String bearerToken = token.replace("Bearer ", "");

            // 使用与LoginInterceptor相同的JWTUtils进行验证
            JWTUtils jwtUtils = getJWTUtils();
            Map<String, Object> claims = jwtUtils.parseJwt(bearerToken, Map.class);

            // 检查必要的字段和过期时间（与LoginInterceptor保持一致）
            if (!claims.containsKey("uuid") || !claims.containsKey("expiresAt")) {
                return false;
            }

            // 检查是否过期
            long expiresAt = Long.parseLong(claims.get("expiresAt").toString());
            long currentTime = System.currentTimeMillis() / 1000;

            return expiresAt > currentTime;

        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    // 从token中获取用户UUID - 使用与LoginInterceptor相同的逻辑
    private String getUserIdFromToken(String token) {
        try {
            String bearerToken = token.replace("Bearer ", "");
            JWTUtils jwtUtils = getJWTUtils();
            Map<String, Object> claims = jwtUtils.parseJwt(bearerToken, Map.class);
            return claims.get("uuid").toString();
        } catch (Exception e) {
            e.printStackTrace();
            return "unknown_user";
        }
    }

    /**
     * 异步等待参数并处理
     */
    private void waitForParameters(Session session, CompletableFuture<JsonObject> parameterFuture) {
        CompletableFuture.runAsync(() -> {
            try {
                // 等待初始参数
                JsonObject initialParameters = parameterFuture.get();

                if (session.isOpen()) {
                    sendMessage(session, "type", "info", "message", "初始参数已接收，开始调用generateTimbre...");

                    // 调用generateTimbre方法
                    ResponseResultInfo result = callGenerateTimbre(session, initialParameters);

                    if (result != null && session.isOpen()) {
                        // 保存处理结果
                        processingResults.put(session.getId(), result);

                        // 发送结果给客户端
                        sendMessage(session, "type", "timbre_result", "message", "音色生成完成",
                                "result", gson.toJson(result));

                        // 等待下次参数
                        waitForNextParameters(session);
                    }
                }

            } catch (Exception e) {
                if (session.isOpen()) {
                    handleError(session, e);
                }
            } finally {
                parameterFutures.remove(session.getId());
            }
        });
    }

    /**
     * 等待下次参数
     */
    private void waitForNextParameters(Session session) {
        try {
            // 创建新的参数Future用于下次参数接收
            CompletableFuture<JsonObject> nextParameterFuture = new CompletableFuture<>();
            parameterFutures.put(session.getId(), nextParameterFuture);

            sendMessage(session, "type", "info", "message", "请发送下次处理参数");

            // 异步等待下次参数
            CompletableFuture.runAsync(() -> {
                try {
                    JsonObject nextParameters = nextParameterFuture.get();

                    if (session.isOpen()) {
                        sendMessage(session, "type", "info", "message", "收到下次参数: " + nextParameters.toString());
                        // 处理下次参数的逻辑可以在这里实现
                        processNextParameters(session, nextParameters);
                    }

                } catch (Exception e) {
                    if (session.isOpen()) {
                        handleError(session, e);
                    }
                } finally {
                    parameterFutures.remove(session.getId());
                }
            });

        } catch (Exception e) {
            handleError(session, e);
        }
    }

    /**
     * 处理下次参数
     */
    private void processNextParameters(Session session, JsonObject parameters) {
        try {
            // 根据业务需求处理下次参数
            String action = parameters.has("action") ? parameters.get("action").getAsString() : "default";

            switch (action) {
                case "get_result":
                    // 获取之前的结果
                    ResponseResultInfo result = processingResults.get(session.getId());
                    if (result != null) {
                        sendMessage(session, "type", "previous_result", "result", gson.toJson(result));
                    } else {
                        sendMessage(session, "type", "info", "message", "没有找到之前的处理结果");
                    }
                    break;

                case "new_timbre":
                    // 生成新的音色
                    sendMessage(session, "type", "info", "message", "开始生成新音色...");
                    ResponseResultInfo newResult = callGenerateTimbre(session, parameters);
                    if (newResult != null) {
                        processingResults.put(session.getId(), newResult);
                        sendMessage(session, "type", "timbre_result", "message", "新音色生成完成",
                                "result", gson.toJson(newResult));
                    }
                    break;

                default:
                    sendMessage(session, "type", "info", "message", "未知操作: " + action);
                    break;
            }

            // 继续等待更多参数
            waitForNextParameters(session);

        } catch (Exception e) {
            handleError(session, e);
        }
    }

    /**
     * 调用generateTimbre方法
     */
    private ResponseResultInfo callGenerateTimbre(Session session, JsonObject parameters) {
        try {
            AliAIService aiService = getAliAIService();

            // 构造参数Map
            Map<String, Object> paramMap = new HashMap<>();

            // 从parameters中提取参数
            if (parameters.has("copyWriting")) {
                paramMap.put("copyWriting", parameters.get("copyWriting").getAsString());
            }

            // 添加其他可能的参数
            if (parameters.has("creator")) {
                paramMap.put("creator", parameters.get("creator").getAsString());
            }

            // 添加其他业务参数
            for (String key : parameters.keySet()) {
                if (!"copyWriting".equals(key) && !"creator".equals(key)) {
                    paramMap.put(key, parameters.get(key));
                }
            }

            // 获取creator（从session中获取用户UUID）
            String creator = (String) session.getUserProperties().get("userUuid");
            if (creator != null) {
                paramMap.put("creator", creator);
            }

            // 调用服务方法
            ResponseResultInfo result = aiService.generateTimbre(paramMap);

            return result;

        } catch (Exception e) {
            handleError(session, e);
            return null;
        }
    }

    /**
     * 接收客户端消息时的回调方法
     */
    @OnMessage
    public void onMessage(String message, Session session) {
        try {
            // ✅ 连接后不再验证token，直接处理业务消息
            JsonObject requestJson = JsonParser.parseString(message).getAsJsonObject();

            // 检查消息类型
            if (requestJson.has("type")) {
                String messageType = requestJson.get("type").getAsString();

                switch (messageType) {
                    case "initial_params":
                        // 处理初始参数
                        handleInitialParameters(session, requestJson);
                        break;

                    case "next_params":
                        // 处理下次参数
                        handleNextParameters(session, requestJson);
                        break;

                    default:
                        sendMessage(session, "type", "error", "message", "未知消息类型: " + messageType);
                        break;
                }
            } else {
                sendMessage(session, "type", "error", "message", "请指定消息类型");
            }
        } catch (Exception e) {
            handleError(session, e);
        }
    }

    /**
     * 处理初始参数
     */
    private void handleInitialParameters(Session session, JsonObject parameters) {
        try {
            CompletableFuture<JsonObject> parameterFuture = parameterFutures.get(session.getId());
            if (parameterFuture != null && !parameterFuture.isDone()) {
                parameterFuture.complete(parameters);
                sendMessage(session, "type", "info", "message", "初始参数已接收，开始处理...");
            } else {
                sendMessage(session, "type", "info", "message", "请等待当前处理完成或重新连接");
            }
        } catch (Exception e) {
            handleError(session, e);
        }
    }

    /**
     * 处理下次参数
     */
    private void handleNextParameters(Session session, JsonObject parameters) {
        try {
            CompletableFuture<JsonObject> parameterFuture = parameterFutures.get(session.getId());
            if (parameterFuture != null && !parameterFuture.isDone()) {
                parameterFuture.complete(parameters);
                sendMessage(session, "type", "info", "message", "下次参数已接收");
            } else {
                sendMessage(session, "type", "info", "message", "当前没有等待参数，请稍后再试");
            }
        } catch (Exception e) {
            handleError(session, e);
        }
    }

    /**
     * WebSocket连接关闭时的回调方法
     */
    @OnClose
    public void onClose(Session session, CloseReason closeReason) {
        // 清理资源
        CompletableFuture<JsonObject> parameterFuture = parameterFutures.remove(session.getId());
        if (parameterFuture != null && !parameterFuture.isDone()) {
            parameterFuture.cancel(true);
        }

        processingResults.remove(session.getId());

        sendMessage(session, "type", "info", "message", "WebSocket连接已关闭: " + closeReason.getReasonPhrase());
    }

    /**
     * WebSocket发生错误时的回调方法
     */
    @OnError
    public void onError(Session session, Throwable throwable) {
        handleError(session, throwable);
    }

    /**
     * 向客户端发送消息
     */
    private void sendMessage(Session session, String... keyValuePairs) {
        try {
            if (session.isOpen()) {
                StringBuilder jsonBuilder = new StringBuilder("{");
                for (int i = 0; i < keyValuePairs.length; i += 2) {
                    if (i > 0) jsonBuilder.append(",");
                    jsonBuilder.append("\"").append(keyValuePairs[i]).append("\":\"");
                    jsonBuilder.append(keyValuePairs[i + 1].replace("\"", "\\\"")).append("\"");
                }
                jsonBuilder.append("}");
                session.getBasicRemote().sendText(jsonBuilder.toString());
            }
        } catch (Exception e) {
            System.err.println("发送消息失败: " + e.getMessage());
        }
    }

    /**
     * 处理错误并向客户端发送错误信息
     */
    private void handleError(Session session, Throwable throwable) {
        try {
            sendMessage(session, "type", "error", "message", "发生错误: " + throwable.getMessage());
            throwable.printStackTrace();
        } catch (Exception e) {
            System.err.println("处理错误时发生异常: " + e.getMessage());
        }
    }
}