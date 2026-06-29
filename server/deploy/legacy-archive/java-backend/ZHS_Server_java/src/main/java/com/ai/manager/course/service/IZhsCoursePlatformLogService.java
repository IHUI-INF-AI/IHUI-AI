package com.ai.manager.course.service;

import java.util.List;
import com.ai.manager.course.domain.ZhsCoursePlatformLog;

/**
 * 视频发布平台记录Service接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
public interface IZhsCoursePlatformLogService
{
    /**
     * 查询视频发布平台记录
     * 
     * @param id 视频发布平台记录主键
     * @return 视频发布平台记录
     */
    public ZhsCoursePlatformLog getById(String id);

    /**
     * 查询视频发布平台记录列表
     * 
     * @param zhsCoursePlatformLog 视频发布平台记录
     * @return 视频发布平台记录集合
     */
    public List<ZhsCoursePlatformLog> getList(ZhsCoursePlatformLog zhsCoursePlatformLog);

    /**
     * 新增视频发布平台记录
     * 
     * @param zhsCoursePlatformLog 视频发布平台记录
     * @return 结果
     */
    public int add(ZhsCoursePlatformLog zhsCoursePlatformLog);

    /**
     * 修改视频发布平台记录
     * 
     * @param zhsCoursePlatformLog 视频发布平台记录
     * @return 结果
     */
    public int edit(ZhsCoursePlatformLog zhsCoursePlatformLog);

    /**
     * 批量删除视频发布平台记录
     * 
     * @param ids 需要删除的视频发布平台记录主键集合
     * @return 结果
     */
    public int delByIds(String[] ids);

    /**
     * 删除视频发布平台记录信息
     * 
     * @param id 视频发布平台记录主键
     * @return 结果
     */
    public int delById(String id);
}
