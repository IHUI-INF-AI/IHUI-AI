package com.ai.manager.course.mapper;

import java.util.List;
import com.ai.manager.course.domain.ZhsUserVideoLog;
import com.baomidou.dynamic.datasource.annotation.DS;
import org.apache.ibatis.annotations.Param;

/**
 * 用户操作课程视频Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@DS("course")
public interface ZhsUserVideoLogMapper 
{
    /**
     * 查询用户操作课程视频
     * 
     * @param id 用户操作课程视频主键
     * @return 用户操作课程视频
     */
    public ZhsUserVideoLog getById(Integer id);

    /**
     * 查询用户操作课程视频列表
     * 
     * @param zhsUserVideoLog 用户操作课程视频
     * @return 用户操作课程视频集合
     */
    public List<ZhsUserVideoLog> getList(ZhsUserVideoLog zhsUserVideoLog);

    /**
     * 新增用户操作课程视频
     * 
     * @param zhsUserVideoLog 用户操作课程视频
     * @return 结果
     */
    public int addZhsUserVideoLog(ZhsUserVideoLog zhsUserVideoLog);

    /**
     * 修改用户操作课程视频
     * 
     * @param zhsUserVideoLog 用户操作课程视频
     * @return 结果
     */
    public int edit(ZhsUserVideoLog zhsUserVideoLog);

    /**
     * 删除用户操作课程视频
     * 
     * @param id 用户操作课程视频主键
     * @return 结果
     */
    public int delById(Integer id);

    /**
     * 批量删除用户操作课程视频
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int delByIds(Integer[] ids);

    Integer delByUser(@Param("type") Integer type, @Param("videoId") String videoId, @Param("userId") String userId, @Param("platform") String platform);
}
