package com.ai.manager.course.mapper;

import com.ai.manager.course.domain.ZhsCourseVideo;
import com.ai.manager.course.domain.ZhsUserVideoLog;
import com.baomidou.dynamic.datasource.annotation.DS;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 课程视频Mapper接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@DS("course")
public interface ZhsCourseVideoMapper 
{
    /**
     * 查询课程视频
     *
     * @param id       课程视频主键
     * @param userUuid
     * @param platform
     * @return 课程视频
     */
    public ZhsCourseVideo getById(@Param("id") String id, @Param("userUuid") String userUuid, @Param("platform") String platform);

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
    public int addZhsCourseVideo(ZhsCourseVideo zhsCourseVideo);

    /**
     * 修改课程视频
     * 
     * @param zhsCourseVideo 课程视频
     * @return 结果
     */
    public int edit(ZhsCourseVideo zhsCourseVideo);

    /**
     * 删除课程视频
     * 
     * @param id 课程视频主键
     * @return 结果
     */
    public int delById(String id);

    /**
     * 批量删除课程视频
     * 
     * @param ids 需要删除的数据主键集合
     * @return 结果
     */
    public int delByIds(@Param("ids") List<String> ids, @Param("uuid") String uuid);

    void delByCourseIds(@Param("agentIds") List<String> agentIds);

    Integer addBatch(@Param("zhsCourseVideos") List<ZhsCourseVideo> zhsCourseVideos);

    List<ZhsCourseVideo> getLogList(ZhsUserVideoLog zhsUserVideoLog);

    Integer getMaxSort(String courseId);

    List<ZhsCourseVideo> getNeedStickyList(@Param("videoId") String videoId, @Param("userUuid") String userUuid);

    List<ZhsCourseVideo> getNeedMoveList(@Param("videoId") String videoId, @Param("userUuid") String userUuid, @Param("type") Integer type);

    int moveList(@Param("list") List<ZhsCourseVideo> list);

    void addTemp(ZhsCourseVideo temp);

    int delByIds2(@Param("ids") String[] ids, @Param("uuid") String uuid);

    List<ZhsCourseVideo> getByIds(@Param("ids") String[] ids, @Param("uuid") String uuid);
}
