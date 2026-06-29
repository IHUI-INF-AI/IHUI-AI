package com.ai.manager.course.service.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ai.manager.course.mapper.ZhsCoursePlatformLogMapper;
import com.ai.manager.course.domain.ZhsCoursePlatformLog;
import com.ai.manager.course.service.IZhsCoursePlatformLogService;

/**
 * 视频发布平台记录Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@Service
public class ZhsCoursePlatformLogServiceImpl implements IZhsCoursePlatformLogService 
{
    @Autowired
    private ZhsCoursePlatformLogMapper zhsCoursePlatformLogMapper;

    /**
     * 查询视频发布平台记录
     * 
     * @param id 视频发布平台记录主键
     * @return 视频发布平台记录
     */
    @Override
    public ZhsCoursePlatformLog getById(String id)
    {
        return zhsCoursePlatformLogMapper.getById(id);
    }

    /**
     * 查询视频发布平台记录列表
     * 
     * @param zhsCoursePlatformLog 视频发布平台记录
     * @return 视频发布平台记录
     */
    @Override
    public List<ZhsCoursePlatformLog> getList(ZhsCoursePlatformLog zhsCoursePlatformLog)
    {
        return zhsCoursePlatformLogMapper.getList(zhsCoursePlatformLog);
    }

    /**
     * 新增视频发布平台记录
     * 
     * @param zhsCoursePlatformLog 视频发布平台记录
     * @return 结果
     */
    @Override
    public int add(ZhsCoursePlatformLog zhsCoursePlatformLog)
    {
        return zhsCoursePlatformLogMapper.addZhsCoursePlatformLog(zhsCoursePlatformLog);
    }

    /**
     * 修改视频发布平台记录
     * 
     * @param zhsCoursePlatformLog 视频发布平台记录
     * @return 结果
     */
    @Override
    public int edit(ZhsCoursePlatformLog zhsCoursePlatformLog)
    {
        return zhsCoursePlatformLogMapper.edit(zhsCoursePlatformLog);
    }

    /**
     * 批量删除视频发布平台记录
     * 
     * @param ids 需要删除的视频发布平台记录主键
     * @return 结果
     */
    @Override
    public int delByIds(String[] ids)
    {
        return zhsCoursePlatformLogMapper.delByIds(ids);
    }

    /**
     * 删除视频发布平台记录信息
     * 
     * @param id 视频发布平台记录主键
     * @return 结果
     */
    @Override
    public int delById(String id)
    {
        return zhsCoursePlatformLogMapper.delById(id);
    }
}
