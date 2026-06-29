package com.ai.manager.course.mapper;

import java.util.List;
import com.ai.manager.course.domain.ZhsCoursePlatformLog;
import com.baomidou.dynamic.datasource.annotation.DS;
import org.apache.ibatis.annotations.Param;

/**
 * 视频发布平台记录Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@DS("course")
public interface ZhsCoursePlatformLogMapper 
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
    public int addZhsCoursePlatformLog(ZhsCoursePlatformLog zhsCoursePlatformLog);

    /**
     * 修改视频发布平台记录
     * 
     * @param zhsCoursePlatformLog 视频发布平台记录
     * @return 结果
     */
    public int edit(ZhsCoursePlatformLog zhsCoursePlatformLog);

    /**
     * 删除视频发布平台记录
     * 
     * @param id 视频发布平台记录主键
     * @return 结果
     */
    public int delById(String id);

    /**
     * 批量删除视频发布平台记录
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int delByIds(String[] ids);

    void delByCourseIds(@Param("courseIds") List<String> courseIds);
}
