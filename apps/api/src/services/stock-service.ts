/**
 * Stock 分析服务。
 * 迁移自旧架构 services/stock_analyse_service.py。
 */

export interface StockAnalysisRequest {
  symbol: string;
  question: string;
  conversationId?: string;
}

export interface StockAnalysisResult {
  symbol: string;
  analysis: string;
  conversationId: string;
  tokensUsed: number;
  createdAt: Date;
}

export interface TokenBalance {
  total: number;
  used: number;
  remaining: number;
}

// 模拟 Token 余额（实际应从 DB 读取）
const tokenBalance: TokenBalance = { total: 10000, used: 0, remaining: 10000 };

export function getTokenBalance(): TokenBalance {
  return { ...tokenBalance };
}

export function checkTokenBalance(required: number): boolean {
  return tokenBalance.remaining >= required;
}

export function deductTokens(amount: number): void {
  tokenBalance.used += amount;
  tokenBalance.remaining = tokenBalance.total - tokenBalance.used;
}

/**
 * 执行 Stock 分析。
 * 调用 AI 模型分析股票相关问题。
 */
export async function executeStockAnalysis(req: StockAnalysisRequest): Promise<StockAnalysisResult> {
  const STOCK_MODEL_ID = process.env.STOCK_MODEL_ID ?? 'gpt-4o-mini';
  const tokensRequired = Math.ceil(req.question.length / 4) + 500; // 估算 token 消耗

  if (!checkTokenBalance(tokensRequired)) {
    throw new Error(`Token 余额不足: 需要 ${tokensRequired}, 剩余 ${tokenBalance.remaining}`);
  }

  // TODO: 实际调用 AI 模型（使用 STOCK_MODEL_ID）
  // 当前为占位实现，返回结构化分析
  const analysis = `【${req.symbol}】分析报告\n\n问题: ${req.question}\n\n基于当前市场数据分析，${req.symbol} 近期走势需关注以下要点：\n1. 技术指标分析\n2. 基本面评估\n3. 市场情绪判断\n\n（模型: ${STOCK_MODEL_ID}）`;

  deductTokens(tokensRequired);

  return {
    symbol: req.symbol,
    analysis,
    conversationId: req.conversationId ?? `stock-${Date.now()}`,
    tokensUsed: tokensRequired,
    createdAt: new Date(),
  };
}

/**
 * 获取历史分析记录（分页）。
 */
export async function getStockHistory(_symbol: string | null, _page: number, _pageSize: number): Promise<{ list: StockAnalysisResult[]; total: number }> {
  // TODO: 从 DB 读取历史记录
  return { list: [], total: 0 };
}
