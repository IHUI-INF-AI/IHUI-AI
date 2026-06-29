package com.ai.manager.core.interceptor;

import com.ai.manager.core.annotation.SkipLogin;
import com.ai.manager.core.config.ResponseResultInfo;
import com.ai.manager.core.config.SpringContextUtil;
import com.ai.manager.core.constants.BeanConfig;
import com.ai.manager.core.constants.CourseConfig;
import com.ai.manager.core.utils.JWTUtils;
import com.ai.manager.core.utils.JsonUtils;
import com.alibaba.fastjson.JSON;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.lang.reflect.Method;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;

@Component
public class LoginInterceptor implements HandlerInterceptor {
    private static final Logger logger = LoggerFactory.getLogger(LoginInterceptor.class);

    private JWTUtils jwtUtils;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        // 判断是否是登录，如果是床架登录日志
//        // 放行外部接口
//        if(request.getRequestURI().equals("/information")){
//            return true;
//        }
        request.setAttribute("startTime", System.currentTimeMillis());

        System.out.println("当前客户端网络IP：" + getRealClientIp(request));

        // 放行swagger
        if (request.getRequestURI().startsWith("/swagger-ui/") || request.getRequestURI().startsWith("/v3/")) {
            return true;
        }

        // 新增：判断是否有@SkipLogin拦截注解
        if (handler instanceof HandlerMethod) {
            HandlerMethod handlerMethod = (HandlerMethod) handler;
            Method method = handlerMethod.getMethod();
            // 方法或类上有@SkipLogin注解则跳过拦截
            if (method.isAnnotationPresent(SkipLogin.class) ||
                    handlerMethod.getBeanType().isAnnotationPresent(SkipLogin.class)) {
                return true;
            }
        }

        if (Objects.isNull(jwtUtils)) {
            jwtUtils = SpringContextUtil.getBean(JWTUtils.class);
        }
        logger.info("请求拦截: {} {}", request.getMethod(), request.getRequestURI());
        String header = request.getHeader(BeanConfig.ZHS_AUTHORIZATION);
        // 解析
        if (StringUtils.isBlank(header) || !header.startsWith("Bearer ")) {
            logger.error("当前身份认证失败!\n" + header);
            returnMsg(response, "40101", "认证失败，请提供有效的Bearer Token!");
            return false;
        }

        String bearer = header.replace("Bearer ", "");
        try {
            Map map = jwtUtils.parseJwt(bearer, Map.class);
//            map.put("expiresAt",0);
            if (!map.containsKey("uuid") || !map.containsKey("expiresAt") || Long.parseLong(map.get("expiresAt").toString()) < Instant.now().getEpochSecond()) {
                returnMsg(response, "40101",    "认证失败，请提供有效的Bearer Token！");
                return false;
            }
            
            // 将用户UUID添加到请求头中，供Controller使用
            String userUuid = map.get("uuid").toString();
            // 使用自定义请求包装器添加请求头
            request.setAttribute(CourseConfig.PLATFORM_USER_ID, userUuid);

            // 同时也添加到请求属性中，方便在Controller中通过@RequestHeader注解获取
            if (request instanceof CustomHttpServletRequestWrapper) {
                ((CustomHttpServletRequestWrapper) request).addHeader(CourseConfig.PLATFORM_USER_ID, userUuid);
            }

        } catch (Exception e) {
            e.printStackTrace();
            returnMsg(response, "40101", "认证失败，请提供有效的Bearer Token");
            return false;
        }
        return true;
    }

    private void returnMsg(HttpServletResponse response, String code, String msg) {
        response.setStatus(200); // 设置HTTP状态码为401 Unauthorized
        response.setContentType("application/json;charset=UTF-8"); // 设置响应内容类型为JSON
        ResponseResultInfo<Object> build = ResponseResultInfo.builder().code(code).msg(msg).build();
        try {
            PrintWriter writer = response.getWriter();
            String jsonString = JSON.toJSONString(build);
            writer.write(jsonString);
            writer.flush();
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        long startTime = (Long) request.getAttribute("startTime");
        long executionTime = System.currentTimeMillis() - startTime;
        logger.info("请求完成: {} {} | 耗时: {}ms",
                request.getMethod(), request.getRequestURI(), executionTime);
        if (ex != null) {
            logger.error("请求处理异常: ", ex);
        }
    }

    // ========== 核心方法：获取客户端真实IP ==========
    private String getRealClientIp(HttpServletRequest request) {
        // 1. 优先从反向代理请求头获取真实IP
        String ip = request.getHeader("X-Forwarded-For");
        // 2. 处理X-Forwarded-For为空/unknown的情况
        if (StringUtils.isBlank(ip) || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (StringUtils.isBlank(ip) || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("WL-Proxy-Client-IP"); // WebLogic代理
        }
        if (StringUtils.isBlank(ip) || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("HTTP_CLIENT_IP");
        }
        if (StringUtils.isBlank(ip) || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("HTTP_X_FORWARDED_FOR");
        }
        // 3. 所有代理头都没有，则取原生IP
        if (StringUtils.isBlank(ip) || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }

        // 4. 处理X-Forwarded-For包含多个IP的情况（格式：客户端IP, 代理IP1, 代理IP2...）
        if (StringUtils.isNotBlank(ip) && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }

        // 5. 特殊处理本地回环地址（如127.0.0.1、0:0:0:0:0:0:0:1）
        if ("0:0:0:0:0:0:0:1".equals(ip)) {
            ip = "127.0.0.1";
        }
        return ip;
    }

}