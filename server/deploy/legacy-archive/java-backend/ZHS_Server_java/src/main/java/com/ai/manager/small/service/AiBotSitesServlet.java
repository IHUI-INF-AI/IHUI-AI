package com.ai.manager.small.service;

import java.util.List;

public interface AiBotSitesServlet {
    List getKind(Integer pageNum, Integer pageSize, String section, String subSection, Integer type);
}
