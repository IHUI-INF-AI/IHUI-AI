package com.ai.manager.course.service;

import java.util.List;
import com.ai.manager.course.domain.ZhsUserCommentLog;

/**
 * 用户评论点赞记录Service接口
 * 
 * @author Raindrop_L
 * @date 2025-08-29
 */
public interface IZhsUserCommentLogService
{
    /**
     * 查询用户评论点赞记录
     * 
     * @param id 用户评论点赞记录主键
     * @return 用户评论点赞记录
     */
    public ZhsUserCommentLog getById(Integer id);

    /**
     * 查询用户评论点赞记录列表
     * 
     * @param zhsUserCommentLog 用户评论点赞记录
     * @return 用户评论点赞记录集合
     */
    public List<ZhsUserCommentLog> getList(ZhsUserCommentLog zhsUserCommentLog);

    /**
     * 新增用户评论点赞记录
     * 
     * @param zhsUserCommentLog 用户评论点赞记录
     * @return 结果
     */
    public int add(ZhsUserCommentLog zhsUserCommentLog);

    /**
     * 修改用户评论点赞记录
     * 
     * @param zhsUserCommentLog 用户评论点赞记录
     * @return 结果
     */
    public int edit(ZhsUserCommentLog zhsUserCommentLog);

    /**
     * 批量删除用户评论点赞记录
     * 
     * @param ids 需要删除的用户评论点赞记录主键集合
     * @return 结果
     */
    public int delByIds(Integer[] ids);

    /**
     * 删除用户评论点赞记录信息
     * 
     * @param id 用户评论点赞记录主键
     * @return 结果
     */
    public int delById(Integer id);
}
