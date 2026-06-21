// ========== 任务复杂度路由器 ==========
// 根据请求打分，自动选模型

export type ComplexityLevel = 'trivial' | 'simple' | 'moderate' | 'complex' | 'expert';

export interface ModelRecommendation {
  modelId: string;
  reason: string;
  estimatedCost: number; // 0-1
  estimatedLatencyMs: number;
}

export interface RoutingDecision {
  level: ComplexityLevel;
  score: number;
  signals: string[];
  recommendation: ModelRecommendation;
}

// 模型能力等级映射（涛哥可以自己调整）
const MODEL_TIERS: Record<string, { level: ComplexityLevel; cost: number; latency: number }> = {
  'glm-4.7-flash': { level: 'simple', cost: 0, latency: 2000 },
  'deepseek-v4-flash': { level: 'simple', cost: 0, latency: 3000 },
  'glm-5.1': { level: 'complex', cost: 0.3, latency: 5000 },
  'deepseek-v4-pro': { level: 'expert', cost: 0.5, latency: 8000 },
  'kimi-k2.5': { level: 'complex', cost: 0.4, latency: 6000 },
};

// 关键词权重
const COMPLEX_KEYWORDS = [
  '架构', '重构', '设计', '优化', '调试', '性能', '安全',
  '并发', '分布式', '算法', '数据库', '事务', '缓存',
  '架构', '微服务', 'Kubernetes', 'Docker', 'CI/CD',
  'TypeScript 泛型', '类型推导', '宏', '元编程',
  'refactor', 'architect', 'optimize', 'debug', 'algorithm',
  'database schema', 'distributed', 'concurrency',
];

const SIMPLE_KEYWORDS = [
  '你好', '解释', '什么是', '怎么用', '介绍',
  'hello', 'what is', 'explain', 'how to', 'introduce',
  '重命名', '改个名字', 'rename', '注释', 'comment',
];

const FILE_PATH_KEYWORDS = [
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go',
  'src/', 'lib/', 'app/', 'components/', 'pages/',
];

export function routeRequest(prompt: string, availableModels: string[] = Object.keys(MODEL_TIERS)): RoutingDecision {
  const signals: string[] = [];
  let score = 0;

  // 1. 长度信号
  const length = prompt.length;
  if (length < 50) {
    score -= 1;
    signals.push(`请求很短（${length} 字符）→ 简单任务`);
  } else if (length < 300) {
    score += 0;
    signals.push(`请求长度适中（${length} 字符）`);
  } else if (length < 1500) {
    score += 1;
    signals.push(`请求较长（${length} 字符）`);
  } else {
    score += 2;
    signals.push(`请求很长（${length} 字符）→ 复杂任务`);
  }

  // 2. 关键词信号
  for (const kw of COMPLEX_KEYWORDS) {
    if (prompt.toLowerCase().includes(kw.toLowerCase())) {
      score += 0.5;
      signals.push(`检测到复杂关键词: ${kw}`);
    }
  }
  for (const kw of SIMPLE_KEYWORDS) {
    if (prompt.toLowerCase().includes(kw.toLowerCase())) {
      score -= 0.5;
      signals.push(`检测到简单关键词: ${kw}`);
    }
  }

  // 3. 文件路径/代码引用
  for (const kw of FILE_PATH_KEYWORDS) {
    if (prompt.includes(kw)) {
      score += 0.3;
      signals.push(`检测到文件路径/代码引用: ${kw}`);
    }
  }

  // 4. 标记符号（代码块、错误信息）
  const codeBlockMatches = prompt.match(/```/g)?.length || 0;
  if (codeBlockMatches >= 2) {
    score += 1;
    signals.push(`包含代码块（${codeBlockMatches / 2} 块）`);
  }

  const errorPattern = /error|exception|stack\s*trace|TypeError|ReferenceError/i;
  if (errorPattern.test(prompt)) {
    score += 1;
    signals.push(`包含错误信息 → 调试任务`);
  }

  // 5. 决策
  let level: ComplexityLevel;
  if (score < -0.5) level = 'trivial';
  else if (score < 0.5) level = 'simple';
  else if (score < 2) level = 'moderate';
  else if (score < 4) level = 'complex';
  else level = 'expert';

  // 6. 选模型：找匹配 level 的第一个可用模型
  let pickedModel: string | undefined;
  let pickedTier: any;

  // 优先级：exact level → 上一级 → 上一级
  const levelPriority: ComplexityLevel[] =
    level === 'trivial' ? ['simple', 'moderate', 'complex', 'expert'] :
    level === 'simple' ? ['simple', 'moderate', 'complex', 'expert'] :
    level === 'moderate' ? ['moderate', 'complex', 'expert', 'simple'] :
    level === 'complex' ? ['complex', 'expert', 'moderate', 'simple'] :
    ['expert', 'complex', 'moderate', 'simple'];

  for (const lv of levelPriority) {
    for (const m of availableModels) {
      const tier = MODEL_TIERS[m];
      if (tier?.level === lv) {
        pickedModel = m;
        pickedTier = tier;
        break;
      }
    }
    if (pickedModel) break;
  }

  if (!pickedModel) {
    pickedModel = availableModels[0] || 'glm-4.7-flash';
    pickedTier = MODEL_TIERS[pickedModel] || { level: 'simple', cost: 0, latency: 3000 };
  }

  const recommendation: ModelRecommendation = {
    modelId: pickedModel,
    reason: `任务复杂度：${level}（评分 ${score.toFixed(1)}）`,
    estimatedCost: pickedTier.cost,
    estimatedLatencyMs: pickedTier.latency,
  };

  return { level, score, signals, recommendation };
}

export function describeComplexity(level: ComplexityLevel): string {
  return {
    trivial: '极简单',
    simple: '简单',
    moderate: '中等',
    complex: '复杂',
    expert: '专家级',
  }[level];
}
