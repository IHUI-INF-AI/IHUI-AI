package com.ai.manager.course.service;

import java.util.List;
import com.ai.manager.course.domain.ZhsCourseVideo;

/**
 * 课程视频Service接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
public interface IZhsCourseVideoService
{
    /**
     * 查询课程视频
     *
     * @param id       课程视频主键
     * @param userUuid
     * @param platform
     * @return 课程视频
     */
    public ZhsCourseVideo getById(String id, String userUuid, String platform);

    /**
     * 查询课程视频列表
     * 
     * @param zhsCourseVideo 课程视频
     * @return 课程视频集合
     */
    public List<ZhsCourseVideo> getList(ZhsCourseVideo zhsCourseVideo);

    /**
     * 新增课程视频
     * 
     * @param zhsCourseVideo 课程视频
     * @return 结果
     */
    public int add(ZhsCourseVideo zhsCourseVideo);

    /**
     * 修改课程视频
     *
     * @param zhsCourseVideo 课程视频
     * @param uuid
     * @return 结果
     */
    public int edit(ZhsCourseVideo zhsCourseVideo, String uuid);

    /**
     * 批量删除课程视频
     *
     * @param ids  需要删除的课程视频主键集合
     * @param uuid
     * @return 结果
     */
    public int delByIds(String[] ids, String uuid);

    /**
     * 删除课程视频信息
     * 
     * @param id 课程视频主键
     * @return 结果
     */
    public int delById(String id);

    Integer addBatch(List<ZhsCourseVideo> zhsCourseVideos);

    void move(String videoId, Integer type, String userUuid);

    Integer issue(String ids, String uuid);
}
