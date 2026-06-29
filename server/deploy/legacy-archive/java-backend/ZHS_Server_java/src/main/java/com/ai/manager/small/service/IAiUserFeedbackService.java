package com.ai.manager.small.service;


import com.ai.manager.small.domain.AiUserFeedback;

import java.util.List;

/**
 * 用户反馈Service接口
 * 
 * @author Raindrop_L
 * @date 2025-09-12
 */
public interface IAiUserFeedbackService
{
    /**
     * 查询用户反馈
     * 
     * @param id 用户反馈主键
     * @return 用户反馈
     */
    public AiUserFeedback getById(Integer id);

    /**
     * 查询用户反馈列表
     * 
     * @param aiUserFeedback 用户反馈
     * @return 用户反馈集合
     */
    public List<AiUserFeedback> getList(AiUserFeedback aiUserFeedback);

    /**
     * 新增用户反馈
     * 
     * @param aiUserFeedback 用户反馈
     * @return 结果
     */
    public int add(AiUserFeedback aiUserFeedback);

    /**
     * 修改用户反馈
     * 
     * @param aiUserFeedback 用户反馈
     * @return 结果
     */
    public int edit(AiUserFeedback aiUserFeedback);

    /**
     * 批量删除用户反馈
     * 
     * @param ids 需要删除的用户反馈主键集合
     * @return 结果
     */
    public int delByIds(Integer[] ids);

    /**
     * 删除用户反馈信息
     * 
     * @param id 用户反馈主键
     * @return 结果
     */
    public int delById(Integer id);
}
