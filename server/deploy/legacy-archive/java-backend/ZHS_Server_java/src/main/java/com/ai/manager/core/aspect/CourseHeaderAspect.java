package com.ai.manager.core.aspect;

import com.ai.manager.core.annotation.CourseHeaderCheck;
import com.ai.manager.core.constants.CourseConfig;
import com.ai.manager.course.domain.ZhsEducationPlatform;
import com.ai.manager.course.service.IZhsEducationPlatformService;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import javax.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * AOP 切面，用于验证请求头是否存在 CourseConfig.COURSE_HEADER_KEY
 */
@Aspect
@Component
public class CourseHeaderAspect {

    // 静态缓存
    private static final Map<String, ZhsEducationPlatform> PLATFORM_CACHE = new ConcurrentHashMap<>();

    @Autowired
    private IZhsEducationPlatformService zhsEducationPlatformService;

    @Before("@annotation(courseHeaderCheck)")
    public void checkCourseHeader(JoinPoint joinPoint, CourseHeaderCheck courseHeaderCheck) {
        HttpServletRequest request = ((ServletRequestAttributes) RequestContextHolder.getRequestAttributes()).getRequest();
        String headerValue = request.getHeader(CourseConfig.PLATFORM_TYPE);
        if (headerValue == null || headerValue.isEmpty()) {
            throw new IllegalArgumentException("请求头中缺少 " + CourseConfig.PLATFORM_TYPE + " 字段");
        }
        
        // 检查缓存
        if (!PLATFORM_CACHE.containsKey(headerValue)) {
            // 缓存不存在，调用服务获取平台列表并缓存
            List<ZhsEducationPlatform> list = zhsEducationPlatformService.getList(null);
            clearPlatformCache();
            list.forEach(item -> PLATFORM_CACHE.put(item.getCode(), item));
        }
    }

    /**
     * 获取平台缓存数据
     * @return 缓存数据
     */
    public static Map<String, ZhsEducationPlatform> getPlatformCache() {
        return PLATFORM_CACHE;
    }

    /**
     * 清除平台缓存
     */
    public static void clearPlatformCache() {
        PLATFORM_CACHE.clear();
    }
}