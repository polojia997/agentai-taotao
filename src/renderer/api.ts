import { ModelConfig, GenerateImageResult, GenerateVideoResult } from './types';
import { ToolDefinition } from './tools';

// ========== API 调用核心 ==========

export async function sendChatMessage(
  model: ModelConfig,
  messages: Array<{ role: string; content: string }>,
  onChunk: (chunk: string) => void,
): Promise<void> {
  switch (model.provider) {
    case 'openai':
    case 'zhipu':
    case 'siliconflow':
    case 'groq':
    case 'qianfan':
    case 'dashscope':
    case 'github':
    case 'agnes':
      return callOpenAI(model, messages, onChunk);
    case 'anthropic':
      return callAnthropic(model, messages, onChunk);
    case 'gemini':
      return callGemini(model, messages, onChunk);
    case 'ollama':
      return callOllama(model, messages, onChunk);
    case 'custom':
    default:
      return callOpenAI(model, messages, onChunk);
  }
}

// ========== Agent 工具调用 API（非流式） ==========
export interface ToolCallResponse {
  content: string | null;
  toolCalls: Array<{
    id: string;
    name: string;
    arguments: string;
  }> | null;
}

export async function sendAgentMessage(
  model: ModelConfig,
  messages: Array<{ role: string; content: string; tool_calls?: any[]; tool_call_id?: string }>,
  tools: ToolDefinition[],
): Promise<ToolCallResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (model.apiKey) {
    headers['Authorization'] = `Bearer ${model.apiKey}`;
  }

  const body: any = {
    model: model.modelName,
    messages,
    max_tokens: model.maxTokens,
    temperature: model.temperature,
    tools,
    tool_choice: 'auto',
  };

  try {
    const response = await fetchWithTimeout(model.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API 错误 ${response.status}: ${errText.slice(0, 500)}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;

    if (!msg) {
      return { content: null, toolCalls: null };
    }

    // 检查是否有 tool calls
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      return {
        content: msg.content || null,
        toolCalls: msg.tool_calls.map((tc: any) => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        })),
      };
    }

    // 纯文本回复
    return { content: msg.content || '', toolCalls: null };
  } catch (err: any) {
    throw err;
  }
}

// ========== OpenAI / 兼容 API (流式) ==========
async function callOpenAI(
  model: ModelConfig,
  messages: Array<{ role: string; content: string }>,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (model.apiKey) {
    headers['Authorization'] = `Bearer ${model.apiKey}`;
  }

  const body = {
    model: model.modelName,
    messages,
    max_tokens: model.maxTokens,
    temperature: model.temperature,
    stream: true,
  };

  const response = await fetchWithTimeout(model.apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API 错误 ${response.status}: ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取流响应');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const data = trimmed.slice(6);
      if (data === '[DONE]') continue;

      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          onChunk(delta);
        }
      } catch {
        // skip malformed JSON chunks
      }
    }
  }
}

// ========== Anthropic Claude API (流式) ==========
async function callAnthropic(
  model: ModelConfig,
  messages: Array<{ role: string; content: string }>,
  onChunk: (chunk: string) => void,
): Promise<void> {
  // 提取 system 消息
  const systemMsg = messages.find(m => m.role === 'system');
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': model.apiKey,
    'anthropic-version': '2023-06-01',
  };

  const body: any = {
    model: model.modelName,
    max_tokens: model.maxTokens,
    messages: chatMessages,
    stream: true,
  };
  if (systemMsg) {
    body.system = systemMsg.content;
  }

  const response = await fetchWithTimeout(model.apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API 错误 ${response.status}: ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取流响应');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      const data = trimmed.slice(6);

      try {
        const json = JSON.parse(data);
        if (json.type === 'content_block_delta') {
          const delta = json.delta?.text;
          if (delta) {
            onChunk(delta);
          }
        }
      } catch {
        // skip
      }
    }
  }
}

// ========== Google Gemini API (流式) ==========
async function callGemini(
  model: ModelConfig,
  messages: Array<{ role: string; content: string }>,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const url = model.apiUrl.includes('?')
    ? `${model.apiUrl}&key=${model.apiKey}`
    : `${model.apiUrl}?key=${model.apiKey}&alt=sse`;

  // 转换消息格式为 Gemini 格式
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body = {
    contents,
    generationConfig: {
      maxOutputTokens: model.maxTokens,
      temperature: model.temperature,
    },
  };

  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API 错误 ${response.status}: ${errText}`);
  }

  // Gemini SSE 格式
  const text = await response.text();
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data: ')) continue;

    const data = trimmed.slice(6);
    try {
      const json = JSON.parse(data);
      const textPart = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textPart) {
        onChunk(textPart);
      }
    } catch {
      // skip
    }
  }
}

// ========== Ollama API (流式) ==========
async function callOllama(
  model: ModelConfig,
  messages: Array<{ role: string; content: string }>,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const body = {
    model: model.modelName,
    messages,
    stream: true,
    options: {
      num_predict: model.maxTokens,
      temperature: model.temperature,
    },
  };

  const response = await fetchWithTimeout(model.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Ollama API 错误 ${response.status}: ${errText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取流响应');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const json = JSON.parse(trimmed);
        const delta = json.message?.content;
        if (delta) {
          onChunk(delta);
        }
      } catch {
        // skip
      }
    }
  }
}

// ========== Agnes AI 图片生成 ==========
const AGNES_BASE_URL = 'https://apihub.agnes-ai.com/v1';
const API_TIMEOUT = 120000;        // 文本/图片：120秒超时
const VIDEO_API_TIMEOUT = 600000;  // 视频任务创建：600秒（视频本身就慢）

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = API_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.log(`[API] 请求超时 (${timeoutMs}ms): ${url}`);
    controller.abort();
  }, timeoutMs);

  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  });
}

export async function generateImage(
  apiKey: string,
  model: string,
  prompt: string,
  size: string = '1024x1024',
  referenceImages?: string[],
): Promise<GenerateImageResult> {
  try {
    if (!apiKey) {
      return { success: false, error: '请先设置 API Key！在模型配置中为 Agnes 模型填入 API Key。' };
    }

    const body: any = {
      model,
      prompt,
      size,
    };

    console.log(`[Image] 开始生成图片: model=${model}, prompt=${prompt.slice(0, 50)}..., size=${size}`);

    // 图生图模式 (agnes-image-2.0-flash)
    if (referenceImages && referenceImages.length > 0) {
      body.tags = ['img2img'];
      body.extra_body = {
        image: referenceImages,
        response_format: 'url',
      };
    }

    const response = await fetchWithTimeout(`${AGNES_BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Image] API 错误 ${response.status}: ${errText}`);
      // 暴露 status、headers、body 全文，便于排查
      const headers = Object.fromEntries(response.headers.entries());
      return {
        success: false,
        error: `图片生成失败 [HTTP ${response.status} ${response.statusText}]\nURL: ${response.url}\n响应头: ${JSON.stringify(headers, null, 2)}\n响应体: ${errText}`,
      };
    }

    const data = await response.json();
    console.log('[Image] API 返回:', JSON.stringify(data).slice(0, 200));

    const url = data.data?.[0]?.url;
    if (url) {
      return { success: true, url };
    }
    return {
      success: false,
      error: `返回结果中没有图片 URL\n原始响应: ${JSON.stringify(data).slice(0, 500)}`,
    };
  } catch (err: any) {
    console.error('[Image] 异常:', err.message);
    if (err.name === 'AbortError') {
      return { success: false, error: '图片生成请求超时（120秒），请检查网络或稍后重试。' };
    }
    return { success: false, error: `网络异常: ${err.message}` };
  }
}

// ========== Agnes AI 视频生成 ==========
export async function createVideoTask(
  apiKey: string,
  prompt: string,
  options?: {
    width?: number;
    height?: number;
    numFrames?: number;
    frameRate?: number;
    imageUrl?: string;
    mode?: 'ti2vid' | 'keyframes';
    negativePrompt?: string;
    seed?: number;
  },
): Promise<GenerateVideoResult> {
  try {
    if (!apiKey) {
      return { success: false, error: '请先设置 API Key！在模型配置中为 Agnes 模型填入 API Key。' };
    }

    // Agnes Video V2.0 要求 num_frames = 4n+1，且最小 5 帧
    const frames = options?.numFrames || 121;
    // 确保符合 4n+1 约束
    const adjustedFrames = Math.max(5, Math.floor((frames - 1) / 4) * 4 + 1);

    const body: any = {
      model: 'agnes-video-v2.0',
      prompt,
      width: options?.width || 1152,
      height: options?.height || 768,
      num_frames: adjustedFrames,
      frame_rate: options?.frameRate || 24,
    };

    console.log(`[Video] 创建视频任务: prompt=${prompt.slice(0, 50)}..., ${body.width}x${body.height}, ${body.num_frames}帧`);

    if (options?.imageUrl) {
      body.image = options.imageUrl;
    }
    if (options?.mode) {
      body.mode = options.mode;
    }
    if (options?.negativePrompt) {
      body.negative_prompt = options.negativePrompt;
    }
    if (options?.seed !== undefined) {
      body.seed = options.seed;
    }

    const response = await fetchWithTimeout(`${AGNES_BASE_URL}/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }, VIDEO_API_TIMEOUT);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[Video] 创建任务失败 ${response.status}: ${errText}`);
      const headers = Object.fromEntries(response.headers.entries());
      const baseInfo = `[HTTP ${response.status} ${response.statusText}]\nURL: ${response.url}\n响应头: ${JSON.stringify(headers, null, 2)}\n响应体: ${errText}`;
      if (response.status === 403 || response.status === 401) {
        return {
          success: false,
          error: `视频模型权限不足。该 API Key 可能没有视频生成权限，请检查 Agnes AI 账户是否开通了视频服务。\n${baseInfo}`,
        };
      }
      if (response.status === 402) {
        return {
          success: false,
          error: '账户余额不足，无法创建视频任务。请在 Agnes AI 充值。',
        };
      }
      return { success: false, error: `视频任务创建失败\n${baseInfo}` };
    }

    const data = await response.json();
    console.log('[Video] 创建任务返回:', JSON.stringify(data).slice(0, 200));

    const taskId = data.task_id || data.id;
    if (!taskId) {
      return { success: false, error: `返回结果中没有任务 ID，原始响应: ${JSON.stringify(data).slice(0, 200)}` };
    }
    return { success: true, taskId, status: 'pending' };
  } catch (err: any) {
    console.error('[Video] 创建任务异常:', err.message);
    if (err.name === 'AbortError') {
      return { success: false, error: '视频任务创建请求超时（120秒），请检查网络或稍后重试。' };
    }
    return { success: false, error: `网络异常: ${err.message}` };
  }
}

// 轮询视频任务状态
export async function pollVideoTask(
  apiKey: string,
  taskId: string,
): Promise<GenerateVideoResult> {
  try {
    const response = await fetchWithTimeout(`${AGNES_BASE_URL}/videos/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    }, 60000); // 轮询用60秒超时

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      return { success: false, status: 'error', error: `查询失败 (HTTP ${response.status}): ${errBody.slice(0, 200)}` };
    }

    const data = await response.json();
    const status = data.status || data.state || 'unknown';

    if (status === 'completed' || status === 'succeeded') {
      const videoUrl = data.video_url || data.videoUrl || data.remixed_from_video_id || data.url;
      console.log('[Video] 生成完成:', videoUrl);
      if (!videoUrl) {
        return { success: false, status: 'error', error: `任务完成但未获取到视频URL。响应: ${JSON.stringify(data).slice(0, 300)}` };
      }
      return { success: true, status: 'completed', videoUrl };
    }

    if (status === 'failed' || status === 'error') {
      const errMsg = data.error || data.message || '视频生成失败';
      console.error('[Video] 生成失败:', errMsg);
      return { success: false, status: 'failed', error: errMsg };
    }

    // 返回实际状态用于显示
    return { success: true, status: status || 'processing' };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { success: false, status: 'error', error: '轮询请求超时（60秒），可能是网络问题。将自动重试...' };
    }
    return { success: false, status: 'error', error: err.message };
  }
}