package com.ai.manager.course.service.impl;

import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.ai.manager.course.mapper.ZhsUserCommentLogMapper;
import com.ai.manager.course.domain.ZhsUserCommentLog;
import com.ai.manager.course.service.IZhsUserCommentLogService;

/**
 * 用户评论点赞记录Service业务层处理
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
@Service
public class ZhsUserCommentLogServiceImpl implements IZhsUserCommentLogService 
{
    @Autowired
    private ZhsUserCommentLogMapper zhsUserCommentLogMapper;

    /**
     * 查询用户评论点赞记录
     * 
     * @param id 用户评论点赞记录主键
     * @return 用户评论点赞记录
     */
    @Override
    public ZhsUserCommentLog getById(Integer id)
    {
        return zhsUserCommentLogMapper.getById(id);
    }

    /**
     * 查询用户评论点赞记录列表
     * 
     * @param zhsUserCommentLog 用户评论点赞记录
     * @return 用户评论点赞记录
     */
    @Override
    public List<ZhsUserCommentLog> getList(ZhsUserCommentLog zhsUserCommentLog)
    {
        return zhsUserCommentLogMapper.getList(zhsUserCommentLog);
    }

    /**
     * 新增用户评论点赞记录
     * 
     * @param zhsUserCommentLog 用户评论点赞记录
     * @return 结果
     */
    @Override
    public int add(ZhsUserCommentLog zhsUserCommentLog)
    {
        return zhsUserCommentLogMapper.addZhsUserCommentLog(zhsUserCommentLog);
    }

    /**
     * 修改用户评论点赞记录
     * 
     * @param zhsUserCommentLog 用户评论点赞记录
     * @return 结果
     */
    @Override
    public int edit(ZhsUserCommentLog zhsUserCommentLog)
    {
        return zhsUserCommentLogMapper.edit(zhsUserCommentLog);
    }

    /**
     * 批量删除用户评论点赞记录
     * 
     * @param ids 需要删除的用户评论点赞记录主键
     * @return 结果
     */
    @Override
    public int delByIds(Integer[] ids)
    {
        return zhsUserCommentLogMapper.delByIds(ids);
    }

    /**
     * 删除用户评论点赞记录信息
     * 
     * @param id 用户评论点赞记录主键
     * @return 结果
     */
    @Override
    public int delById(Integer id)
    {
        return zhsUserCommentLogMapper.delById(id);
    }
}
