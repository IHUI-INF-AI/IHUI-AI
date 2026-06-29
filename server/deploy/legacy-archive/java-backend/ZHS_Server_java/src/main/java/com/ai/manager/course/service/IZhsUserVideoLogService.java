package com.ai.manager.course.service;

import java.util.List;

import com.ai.manager.course.domain.ZhsCourseVideo;
import com.ai.manager.course.domain.ZhsUserVideoLog;

/**
 * 用户操作课程视频Service接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
public interface IZhsUserVideoLogService
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
    public List<ZhsCourseVideo> getList(ZhsUserVideoLog zhsUserVideoLog);

    /**
     * 新增用户操作课程视频
     * 
     * @param zhsUserVideoLog 用户操作课程视频
     * @return 结果
     */
    public int add(ZhsUserVideoLog zhsUserVideoLog);

    /**
     * 修改用户操作课程视频
     * 
     * @param zhsUserVideoLog 用户操作课程视频
     * @return 结果
     */
    public int edit(ZhsUserVideoLog zhsUserVideoLog);

    /**
     * 批量删除用户操作课程视频
     * 
     * @param ids 需要删除的用户操作课程视频主键集合
     * @return 结果
     */
    public int delByIds(Integer[] ids);

    /**
     * 删除用户操作课程视频信息
     * 
     * @param id 用户操作课程视频主键
     * @return 结果
     */
    public int delById(Integer id);

    Integer delByUser(Integer type, String videoId, String userId, String platform);
}
