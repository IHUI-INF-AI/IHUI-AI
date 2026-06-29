package com.ai.manager.course.service.impl;

import java.util.List;

import com.ai.manager.course.domain.ZhsCourseVideo;
import com.ai.manager.course.mapper.ZhsCourseVideoMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ai.manager.course.mapper.ZhsUserVideoLogMapper;
import com.ai.manager.course.domain.ZhsUserVideoLog;
import com.ai.manager.course.service.IZhsUserVideoLogService;

/**
 * 用户操作课程视频Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@Service
public class ZhsUserVideoLogServiceImpl implements IZhsUserVideoLogService 
{
    @Autowired
    private ZhsUserVideoLogMapper zhsUserVideoLogMapper;
    @Autowired
    private ZhsCourseVideoMapper courseVideoMapper;

    /**
     * 查询用户操作课程视频
     * 
     * @param id 用户操作课程视频主键
     * @return 用户操作课程视频
     */
    @Override
    public ZhsUserVideoLog getById(Integer id)
    {
        return zhsUserVideoLogMapper.getById(id);
    }

    /**
     * 查询用户操作课程视频列表
     * 
     * @param zhsUserVideoLog 用户操作课程视频
     * @return 用户操作课程视频
     */
    @Override
    public List<ZhsCourseVideo> getList(ZhsUserVideoLog zhsUserVideoLog)
    {
        return courseVideoMapper.getLogList(zhsUserVideoLog);
    }

    /**
     * 新增用户操作课程视频
     * 
     * @param zhsUserVideoLog 用户操作课程视频
     * @return 结果
     */
    @Override
    public int add(ZhsUserVideoLog zhsUserVideoLog)
    {
        int i = zhsUserVideoLogMapper.addZhsUserVideoLog(zhsUserVideoLog);
        return i;
    }

    /**
     * 修改用户操作课程视频
     * 
     * @param zhsUserVideoLog 用户操作课程视频
     * @return 结果
     */
    @Override
    public int edit(ZhsUserVideoLog zhsUserVideoLog)
    {
        return zhsUserVideoLogMapper.edit(zhsUserVideoLog);
    }

    /**
     * 批量删除用户操作课程视频
     * 
     * @param ids 需要删除的用户操作课程视频主键
     * @return 结果
     */
    @Override
    public int delByIds(Integer[] ids)
    {
        return zhsUserVideoLogMapper.delByIds(ids);
    }

    /**
     * 删除用户操作课程视频信息
     * 
     * @param id 用户操作课程视频主键
     * @return 结果
     */
    @Override
    public int delById(Integer id)
    {
        return zhsUserVideoLogMapper.delById(id);
    }

    @Override
    public Integer delByUser(Integer type, String videoId, String userId, String platform) {
        return zhsUserVideoLogMapper.delByUser(type, videoId, userId, platform);
    }
}
