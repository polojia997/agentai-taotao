import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useStore, store } from '../store';
import { ChatMessage, AgentMode, FileEntry } from '../types';
import { sendChatMessage, sendAgentMessage, generateImage, createVideoTask, pollVideoTask } from '../api';
import { AGENT_TOOLS, executeTool } from '../tools';
import { getActiveSkillsPrompt } from '../skills';
import { marked } from 'marked';
import { parseSlashCommand, renderHelp, SLASH_COMMANDS } from '../slashCommands';

marked.setOptions({ breaks: true, gfm: true });

interface ChatPanelProps {
  tabId: string;
}

// Agent 模式定义
const AGENT_MODES: { key: AgentMode; label: string; desc: string; icon: string }[] = [
  { key: 'auto', label: '自动', desc: 'AI 自主判断', icon: '🔄' },
  { key: 'plan', label: '规划', desc: '先规划再执行', icon: '📋' },
  { key: 'agent', label: '智能体', desc: '工具调用执行', icon: '🤖' },
  { key: 'ask', label: '问答', desc: '纯文本问答', icon: '💡' },
];

// 扁平化文件树
function flattenFiles(entries: FileEntry[]): { name: string; path: string }[] {
  const result: { name: string; path: string }[] = [];
  function walk(items: FileEntry[]) {
    for (const item of items) {
      if (!item.children || item.children.length === 0) {
        result.push({ name: item.name, path: item.path });
      }
      if (item.children) walk(item.children);
    }
  }
  walk(entries);
  return result;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ tabId }) => {
  const state = useStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [input, setInput] = React.useState('');
  const [showModeMenu, setShowModeMenu] = React.useState(false);
  const [showFilePicker, setShowFilePicker] = React.useState(false);
  const [filePickerQuery, setFilePickerQuery] = React.useState('');
  const [cursorPos, setCursorPos] = React.useState(0);
  const [isRecording, setIsRecording] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const activeModel = state.models.find(m => m.id === state.activeModelId);
  const flatFiles = React.useMemo(() => flattenFiles(state.fileTree), [state.fileTree]);

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.chatMessages]);

  // 给代码块添加操作按钮（Codex 风格：顶部悬浮栏 + 语言标签 + 复制 + 应用）
  useEffect(() => {
    const container = document.querySelector('.chat-messages');
    if (!container) return;

    const codeBlocks = container.querySelectorAll('.chat-bubble pre');
    codeBlocks.forEach((el) => {
      const pre = el as HTMLElement;
      // 避免重复添加
      if (pre.querySelector('.code-block-actions')) return;
      const code = pre.querySelector('code');
      if (!code) return;

      // 检测语言
      const codeClass = code.className || '';
      const langMatch = codeClass.match(/language-(\w+)/);
      const lang = langMatch ? langMatch[1] : 'text';

      const actions = document.createElement('div');
      actions.className = 'code-block-actions';
      actions.innerHTML = `
        <span class="code-lang">${lang}</span>
        <div class="code-actions-right">
          <button class="code-action-btn" title="复制代码" data-action="copy">📋 复制</button>
          <button class="code-action-btn" title="应用到编辑器" data-action="apply">📝 应用</button>
        </div>
      `;

      actions.querySelector('[data-action="copy"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = code.textContent || '';
        navigator.clipboard.writeText(text).then(() => {
          const btn = actions.querySelector('[data-action="copy"]') as HTMLButtonElement;
          const original = btn.innerHTML;
          btn.innerHTML = '✓ 已复制';
          btn.classList.add('copied');
          store.addToast({ type: 'success', message: '已复制到剪贴板' });
          setTimeout(() => {
            btn.innerHTML = original;
            btn.classList.remove('copied');
          }, 1500);
        });
      });

      actions.querySelector('[data-action="apply"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = code.textContent || '';
        // 找到当前激活的编辑器 tab 并更新内容
        const activeTab = store.getState().openTabs.find(t => t.id === store.getState().activeTabId);
        if (activeTab && activeTab.type === 'editor') {
          store.openTab({ ...activeTab, content: text, isDirty: true });
          store.addToast({ type: 'success', message: '已应用到编辑器' });
        } else {
          store.addToast({ type: 'error', message: '请先打开一个编辑器标签页' });
        }
      });

      pre.style.position = 'relative';
      pre.appendChild(actions);
    });
  }, [state.chatMessages, state.openTabs, state.activeTabId]);

  // 视频任务轮询辅助函数
  const doVideoPolling = useCallback((taskId: string, apiKey: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    store.updateLastAssistantMessage(`🎬 视频任务已创建 (ID: \`${taskId}\`)\n\n⏳ 已加入队列，正在等待生成...`);

    let attempts = 0;
    const maxAttempts = 240; // 20 分钟（每5秒轮询一次）
    let consecutiveErrors = 0;

    pollRef.current = setInterval(async () => {
      try {
        attempts++;
        const pollResult = await pollVideoTask(apiKey, taskId);

        if (pollResult.status === 'completed' && pollResult.videoUrl) {
          clearInterval(pollRef.current!);
          store.updateLastAssistantMessage(
            `✅ 视频生成完成！（耗时 ${Math.round(attempts * 5 / 60)} 分钟）\n\n` +
            `[🎬 点击下载视频](${pollResult.videoUrl})\n\n` +
            `<video controls width="100%" style="max-width:640px;border-radius:8px;">` +
            `<source src="${pollResult.videoUrl}" type="video/mp4"></video>`
          );
          store.setStreaming(false);
          return;
        }

        if (pollResult.status === 'failed') {
          clearInterval(pollRef.current!);
          store.updateLastAssistantMessage(`❌ 视频生成失败: ${pollResult.error || '未知错误'}`);
          store.setStreaming(false);
          return;
        }

        if (pollResult.status === 'error') {
          consecutiveErrors++;
          if (consecutiveErrors >= 5) {
            clearInterval(pollRef.current!);
            store.updateLastAssistantMessage(
              `❌ 轮询连续失败 ${consecutiveErrors} 次，已停止。\n` +
              `最后错误: ${pollResult.error}\n\n` +
              `任务 ID: \`${taskId}\`\n` +
              `可以稍后手动查询：\`GET /v1/videos/${taskId}\``
            );
            store.setStreaming(false);
            return;
          }
          // 单次错误不停止，继续重试
          store.updateLastAssistantMessage(
            `🎬 视频任务 (ID: \`${taskId}\`)\n\n` +
            `⚠️ 轮询异常 (${consecutiveErrors}/5): ${pollResult.error}\n` +
            `将继续自动重试...`
          );
          return;
        }

        if (attempts >= maxAttempts) {
          clearInterval(pollRef.current!);
          store.updateLastAssistantMessage(
            `⏰ 视频生成等待超时（已等待 ${maxAttempts * 5 / 60} 分钟）。\n\n` +
            `任务 ID: \`${taskId}\`\n` +
            `当前状态: ${pollResult.status || 'unknown'}\n\n` +
            `视频可能仍在后台生成中，可稍后手动查询：\`GET /v1/videos/${taskId}\``
          );
          store.setStreaming(false);
          return;
        }

        // 正常等待中 - 显示状态和进度
        consecutiveErrors = 0; // 重置错误计数
        const dots = '.'.repeat((attempts % 3) + 1);
        const elapsed = Math.round(attempts * 5 / 60);
        const statusMap: Record<string, string> = {
          'queued': '排队中',
          'generating': '生成中',
          'processing': '处理中',
          'running': '处理中',
          'pending': '等待中',
        };
        const statusText = statusMap[pollResult.status || ''] || pollResult.status || '处理中';
        store.updateLastAssistantMessage(
          `🎬 视频任务 (ID: \`${taskId}\`)\n\n` +
          `状态: **${statusText}**${dots}\n` +
          `已等待: ${elapsed} 分钟（视频生成通常需要 1-10 分钟）`
        );
      } catch (err: any) {
        consecutiveErrors++;
        if (consecutiveErrors >= 5) {
          clearInterval(pollRef.current!);
          store.updateLastAssistantMessage(`❌ 轮询异常: ${err.message}`);
          store.setStreaming(false);
        }
      }
    }, 5000);
  }, []);

  const addUserMessage = (text: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
      modelId: activeModel?.id,
    };
    store.addMessage(userMsg);
  };

  const addAssistantMsg = (content: string) => {
    const msg: ChatMessage = {
      id: `msg-${Date.now() + 1}-${Math.random().toString(36).slice(2)}`,
      role: 'assistant',
      content,
      timestamp: Date.now(),
      modelId: activeModel?.id,
    };
    store.addMessage(msg);
    return msg;
  };

  // 根据 Agent 模式构建系统提示
  const getSystemPrompt = (mode: AgentMode): string => {
    const skillsPrompt = getActiveSkillsPrompt(state.installedSkills);
    let base = '';
    switch (mode) {
      case 'auto':
        base = '你是 TAOTAO，一个智能 AI 编程助手。请根据用户需求自主选择最佳方式完成任务。如果用户请求编程任务，请主动写代码并解释。';
        break;
      case 'plan':
        base = '你是 TAOTAO，一个 AI 规划助手。请先分析用户的需求，制定详细的步骤计划，然后逐步执行。每次回复前先列出计划。';
        break;
      case 'agent':
        base = '你是 TAOTAO，一个具备工具调用能力的 AI 智能体。你可以操作文件、执行命令、搜索代码来完成用户的复杂任务。';
        break;
      case 'ask':
        base = '你是 TAOTAO，一个 AI 知识问答助手。请简洁准确地回答用户的问题。';
        break;
      default:
        base = '你是 TAOTAO，一个智能 AI 编程助手。';
    }
    return base + skillsPrompt;
  };

  // 处理 @ 文件引用
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setInput(val);
    setCursorPos(pos);

    // 检测 @ 触发文件选择器
    const beforeCursor = val.slice(0, pos);
    const atMatch = beforeCursor.match(/@([^\s@]*)$/);
    if (atMatch) {
      setFilePickerQuery(atMatch[1].toLowerCase());
      setShowFilePicker(true);
    } else {
      setShowFilePicker(false);
    }
  };

  const handleFileSelect = (filePath: string) => {
    const beforeCursor = input.slice(0, cursorPos);
    const afterCursor = input.slice(cursorPos);
    const newBefore = beforeCursor.replace(/@[^\s@]*$/, `@${filePath} `);
    const newInput = newBefore + afterCursor;
    setInput(newInput);
    setShowFilePicker(false);
    textareaRef.current?.focus();
  };

  const filteredFiles = flatFiles.filter(f =>
    f.name.toLowerCase().includes(filePickerQuery) || f.path.toLowerCase().includes(filePickerQuery)
  ).slice(0, 8);

  // ===== 语音输入 (MediaRecorder + Groq Whisper) =====
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startVoiceInput = useCallback(async () => {
    const groqKey = state.groqApiKey;
    if (!groqKey) {
      store.addToast({ type: 'error', message: '请先在模型配置中设置 Groq API Key（免费注册: console.groq.com）' });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        if (audioBlob.size < 100) {
          setIsRecording(false);
          store.addToast({ type: 'error', message: '录音太短，请重试' });
          return;
        }

        store.addToast({ type: 'info', message: '正在识别语音...' });

        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'audio.webm');
          formData.append('model', 'whisper-large-v3-turbo');
          formData.append('response_format', 'json');

          const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${groqKey}` },
            body: formData,
          });

          if (!response.ok) {
            const errText = await response.text();
            setIsRecording(false);
            store.addToast({ type: 'error', message: `识别失败: ${response.status} ${errText.slice(0, 100)}` });
            return;
          }

          const data = await response.json() as any;
          setIsRecording(false);
          if (data.text) {
            setInput(prev => (prev ? prev + ' ' + data.text : data.text));
            store.addToast({ type: 'success', message: '语音识别完成' });
          } else {
            store.addToast({ type: 'error', message: '未检测到语音' });
          }
        } catch (e: any) {
          setIsRecording(false);
          store.addToast({ type: 'error', message: '语音识别异常: ' + e.message });
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      store.addToast({ type: 'info', message: '正在聆听（请说话，再次点击停止）...' });
    } catch (e: any) {
      setIsRecording(false);
      store.addToast({ type: 'error', message: '无法访问麦克风: ' + e.message });
    }
  }, [state.groqApiKey]);

  const stopVoiceInput = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  // ===== 文件上传 =====
  const handleFileUpload = useCallback(async () => {
    try {
      const { ipcRenderer } = (window as any).require('electron');
      const result = await ipcRenderer.invoke('dialog:openFile', {
        filters: [
          { name: '所有文件', extensions: ['*'] },
          { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] },
          { name: '代码', extensions: ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'h', 'css', 'html', 'json'] },
          { name: '文档', extensions: ['md', 'txt', 'pdf', 'csv'] },
        ],
        properties: ['openFile'],
      });
      if (result && result.filePath) {
        const fileName = result.filePath.split(/[\\/]/).pop();
        // 读取文件并添加到消息中
        const readResult = await ipcRenderer.invoke('fs:readFile', result.filePath);
        if (readResult.success) {
          const preview = readResult.content.slice(0, 3000);
          const fileInfo = `\n\n📎 **已上传文件:** \`${fileName}\`\n\`\`\`\n${preview}\n${readResult.content.length > 3000 ? '...(内容已截断)' : ''}\n\`\`\``;
          setInput(prev => prev + fileInfo);
        }
        store.addToast({ type: 'success', message: `已添加文件: ${fileName}` });
      }
    } catch (e: any) {
      store.addToast({ type: 'error', message: '文件上传失败: ' + e.message });
    }
  }, []);

  // ===== 复制消息 =====
  const copyMessage = useCallback((content: string, msgId: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(msgId);
      store.addToast({ type: 'success', message: '已复制到剪贴板' });
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {
      store.addToast({ type: 'error', message: '复制失败' });
    });
  }, []);

  // ===== 保存图片 =====
  const saveImage = useCallback(async (url: string) => {
    try {
      const { ipcRenderer } = (window as any).require('electron');
      const result = await ipcRenderer.invoke('dialog:saveFile', {
        defaultPath: 'image.png',
        filters: [{ name: 'PNG 图片', extensions: ['png'] }],
      });
      if (result && result.filePath) {
        await ipcRenderer.invoke('fs:downloadToFile', url, result.filePath);
        store.addToast({ type: 'success', message: '图片已保存到: ' + result.filePath });
      }
    } catch (e: any) {
      store.addToast({ type: 'error', message: '保存图片失败: ' + e.message });
    }
  }, []);

  // ===== 提取消息中的图片URL =====
  const extractImageUrls = (content: string): string[] => {
    const urls: string[] = [];
    const mdMatch = content.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/g);
    if (mdMatch) {
      mdMatch.forEach(m => {
        const urlMatch = m.match(/\((https?:\/\/[^\s)]+)\)/);
        if (urlMatch) urls.push(urlMatch[1]);
      });
    }
    // 也匹配直接图片链接
    const imgMatch = content.match(/https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s]*)?/gi);
    if (imgMatch) {
      imgMatch.forEach(url => {
        if (!urls.includes(url)) urls.push(url);
      });
    }
    return urls;
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || state.isStreaming) return;

    if (!activeModel) {
      store.addToast({ type: 'error', message: '请先在模型配置中激活一个模型' });
      return;
    }

    setInput('');
    setShowFilePicker(false);

    // ===== Slash 命令系统 =====
    if (text.startsWith('/')) {
      const slash = parseSlashCommand(text);
      if (slash) {
        // 记录用户消息
        addUserMessage(text);

        switch (slash.kind) {
          case 'help':
            addAssistantMsg(renderHelp());
            return;

          case 'features':
            {
              const features = [
                '✅ **危险命令拦截** — `rm -rf /`、`format C:` 等已被安全策略阻止',
                '✅ **代码自动验证** — 改完 .js/.ts/.py/.json 自动语法检查',
                '✅ **任务路由** — 根据复杂度自动选模型',
                '✅ **审计日志** — 危险操作全程记录',
                '✅ **Slash 命令** — `/plan /compact /model /auto /reasoning /dryrun /features /audit /route /help`',
                '✅ **Dry-run 模式** — `/dryrun on` 写文件前出 diff 不真改',
                '✅ **Plan 模式** — `/plan <任务>` 先规划再执行',
                '✅ **推理深度** — `/reasoning <low|medium|high>`',
              ];
              addAssistantMsg('## 🎯 已启用的功能\n\n' + features.join('\n'));
              return;
            }

          case 'plan':
            // 切到规划模式
            store.setAgentMode('plan');
            addAssistantMsg(`📋 **已切换到规划模式**\n\n任务：${slash.prompt}\n\n请稍候，AI 正在分析需求并制定计划...`);
            // 继续走正常 plan 处理：把 prompt 当作用户输入
            // 这里不 return，让它继续走 plan 模式
            break;

          case 'compact':
            {
              const msgs = store.getState().chatMessages;
              if (msgs.length < 4) {
                addAssistantMsg('ℹ️ 当前消息太少，无需压缩。');
                return;
              }
              const half = Math.floor(msgs.length / 2);
              const kept = msgs.slice(-half);
              store.setMessages(kept);
              addAssistantMsg(`✅ 已压缩上下文，保留最近 ${half} 条消息。`);
              return;
            }

          case 'model':
            {
              const target = state.models.find(m => m.id === slash.modelId || m.modelName === slash.modelId);
              if (target) {
                store.setActiveModelId(target.id);
                addAssistantMsg(`✅ 已切换到模型：**${target.modelName}**`);
              } else {
                addAssistantMsg(`❌ 找不到模型：\`${slash.modelId}\`\n\n可用：\n${state.models.map(m => `- \`${m.id}\``).join('\n')}`);
              }
              return;
            }

          case 'auto':
            store.setAgentMode('auto');
            addAssistantMsg('✅ 已恢复自动模式（AI 自主选择最佳方式）');
            return;

          case 'reasoning':
            {
              const map = { low: '低', medium: '中', high: '高' };
              // 简化：用 system prompt 提示
              addAssistantMsg(`✅ 推理深度设置为：**${map[slash.level]}**\n\n_（下次请求生效）_`);
              return;
            }

          case 'dryrun':
            store.setDryRun(slash.enabled);
            addAssistantMsg(slash.enabled
              ? '🛡️ **Dry-run 模式已开启**\n\n下次写文件时会先输出 diff，需要你确认后才落地。'
              : '✅ Dry-run 模式已关闭，文件会直接写入。');
            return;

          case 'audit':
            {
              try {
                const { ipcRenderer } = (window as any).require('electron');
                const events: any[] = await ipcRenderer.invoke('audit:list', slash.kindFilter, slash.limit);
                if (events.length === 0) {
                  addAssistantMsg('📋 审计日志为空');
                  return;
                }
                const lines = events.map(e => {
                  const d = new Date(e.timestamp).toLocaleString('zh-CN');
                  const kindMap: Record<string, string> = {
                    'command.blocked': '🚫 命令阻止',
                    'command.executed': '⚠️ 命令执行',
                    'verify.failed': '❌ 验证失败',
                    'verify.passed': '✅ 验证通过',
                    'plan.created': '📋 计划创建',
                    'plan.approved': '👍 计划批准',
                    'file.written': '📝 文件写入',
                    'file.deleted': '🗑️ 文件删除',
                  };
                  const label = kindMap[e.kind] || e.kind;
                  return `**${label}** \`${d}\`\n  └─ ${e.summary}`;
                });
                addAssistantMsg(`## 🛡️ 审计日志（最近 ${events.length} 条）\n\n${lines.join('\n\n')}`);
              } catch (e: any) {
                addAssistantMsg(`❌ 读取审计日志失败：${e.message}`);
              }
              return;
            }

          case 'route':
            {
              try {
                const { ipcRenderer } = (window as any).require('electron');
                const availableModels = state.models.map(m => m.id);
                const decision: any = await ipcRenderer.invoke('router:route', slash.prompt, availableModels);
                const lines = decision.signals.map((s: string) => `- ${s}`).join('\n');
                addAssistantMsg(
                  `## 🧠 路由决策\n\n` +
                  `- **复杂度等级**: ${decision.level}（评分 ${decision.score.toFixed(1)}）\n` +
                  `- **推荐模型**: \`${decision.recommendation.modelId}\`\n` +
                  `- **理由**: ${decision.recommendation.reason}\n` +
                  `- **预估延迟**: ${decision.recommendation.estimatedLatencyMs}ms\n\n` +
                  `**评分信号**:\n${lines}`
                );
              } catch (e: any) {
                addAssistantMsg(`❌ 路由失败：${e.message}`);
              }
              return;
            }

          case 'reply':
            addAssistantMsg(slash.text);
            return;
        }
      }
    }

    // ===== 图片生成命令 =====
    const imgMatch = text.match(/^\/image\s+(.+)/i);
    const img2imgMatch = text.match(/^\/img2img\s+(https?:\/\/\S+)\s+(.+)/i);
    const vidMatch = text.match(/^\/video\s+(.+)/i);
    const vidFromMatch = text.match(/^\/videofrom\s+(https?:\/\/\S+)\s+(.+)/i);

    // 图生图
    if (img2imgMatch) {
      const imageUrl = img2imgMatch[1];
      const prompt = img2imgMatch[2];
      addUserMessage(`/img2img ${imageUrl} ${prompt}`);
      if (!activeModel.apiKey) {
        addAssistantMsg('❌ 请先在模型配置中为 Agnes 模型设置 API Key');
        return;
      }
      addAssistantMsg('🎨 正在基于参考图编辑图片，请稍候...');
      store.setStreaming(true);

      try {
        const result = await generateImage(activeModel.apiKey, 'agnes-image-2.0-flash', prompt, '1024x768', [imageUrl]);
        if (result.success && result.url) {
          store.updateLastAssistantMessage(`✅ 图片编辑完成！\n\n参考图:\n![](${imageUrl})\n\n编辑结果:\n![](${result.url})`);
        } else {
          store.updateLastAssistantMessage(`❌ 图片编辑失败: ${result.error || '未知错误'}`);
        }
      } catch (err: any) {
        store.updateLastAssistantMessage(`❌ 图片编辑异常: ${err.message || '网络错误'}`);
      } finally {
        store.setStreaming(false);
      }
      return;
    }

    // 文生图
    if (imgMatch) {
      const prompt = imgMatch[1];
      addUserMessage(`/image ${prompt}`);
      if (!activeModel.apiKey) {
        addAssistantMsg('❌ 请先在模型配置中为 Agnes 模型设置 API Key');
        return;
      }
      addAssistantMsg('🎨 正在生成图片，请稍候...');
      store.setStreaming(true);

      try {
        const imgModel = activeModel.modelName.includes('image') ? activeModel.modelName : 'agnes-image-2.1-flash';
        const result = await generateImage(activeModel.apiKey, imgModel, prompt);
        if (result.success && result.url) {
          store.updateLastAssistantMessage(`✅ 图片生成完成！\n\n![](${result.url})`);
        } else {
          store.updateLastAssistantMessage(`❌ 图片生成失败: ${result.error || '未知错误'}`);
        }
      } catch (err: any) {
        store.updateLastAssistantMessage(`❌ 图片生成异常: ${err.message || '网络错误'}`);
      } finally {
        store.setStreaming(false);
      }
      return;
    }

    // 图生视频
    if (vidFromMatch) {
      const imageUrl = vidFromMatch[1];
      const prompt = vidFromMatch[2];
      addUserMessage(`/videofrom ${imageUrl} ${prompt}`);
      if (!activeModel.apiKey) {
        addAssistantMsg('❌ 请先在模型配置中为 Agnes 模型设置 API Key');
        return;
      }
      addAssistantMsg('🎬 正在基于图片创建视频任务...');
      store.setStreaming(true);

      try {
        const createResult = await createVideoTask(activeModel.apiKey, prompt, { imageUrl });
        if (!createResult.success || !createResult.taskId) {
          store.updateLastAssistantMessage(`❌ 视频任务创建失败: ${createResult.error || '未知错误'}`);
          store.setStreaming(false);
        } else {
          doVideoPolling(createResult.taskId, activeModel.apiKey);
        }
      } catch (err: any) {
        store.updateLastAssistantMessage(`❌ 视频任务异常: ${err.message || '网络错误'}`);
        store.setStreaming(false);
      }
      return;
    }

    // 文生视频
    if (vidMatch) {
      const prompt = vidMatch[1];
      addUserMessage(`/video ${prompt}`);
      if (!activeModel.apiKey) {
        addAssistantMsg('❌ 请先在模型配置中为 Agnes 模型设置 API Key');
        return;
      }
      addAssistantMsg('🎬 正在创建视频任务...');
      store.setStreaming(true);

      try {
        const createResult = await createVideoTask(activeModel.apiKey, prompt);
        if (!createResult.success || !createResult.taskId) {
          store.updateLastAssistantMessage(`❌ 视频任务创建失败: ${createResult.error || '未知错误'}`);
          store.setStreaming(false);
        } else {
          doVideoPolling(createResult.taskId, activeModel.apiKey);
        }
      } catch (err: any) {
        store.updateLastAssistantMessage(`❌ 视频任务异常: ${err.message || '网络错误'}`);
        store.setStreaming(false);
      }
      return;
    }

    // ===== 普通文本对话 =====
    // 如果当前激活的是图片/视频模型，自动路由到对应命令
    if (activeModel.modelName.includes('image')) {
      // 图片模型：自动转为 /image 命令
      addUserMessage(text);
      addAssistantMsg('🎨 正在生成图片，请稍候...');
      store.setStreaming(true);
      try {
        const imgModel = activeModel.modelName.includes('2.0') ? 'agnes-image-2.0-flash' : 'agnes-image-2.1-flash';
        const result = await generateImage(activeModel.apiKey, imgModel, text);
        if (result.success && result.url) {
          store.updateLastAssistantMessage(`✅ 图片生成完成！\n\n![](${result.url})`);
        } else {
          store.updateLastAssistantMessage(`❌ 图片生成失败: ${result.error || '未知错误'}`);
        }
      } catch (err: any) {
        store.updateLastAssistantMessage(`❌ 图片生成异常: ${err.message || '网络错误'}`);
      } finally {
        store.setStreaming(false);
      }
      return;
    }

    if (activeModel.modelName.includes('video')) {
      // 视频模型：自动转为 /video 命令
      addUserMessage(text);
      addAssistantMsg('🎬 正在创建视频任务...');
      store.setStreaming(true);
      try {
        const createResult = await createVideoTask(activeModel.apiKey, text);
        if (!createResult.success || !createResult.taskId) {
          store.updateLastAssistantMessage(`❌ 视频任务创建失败: ${createResult.error || '未知错误'}`);
          store.setStreaming(false);
        } else {
          doVideoPolling(createResult.taskId, activeModel.apiKey);
        }
      } catch (err: any) {
        store.updateLastAssistantMessage(`❌ 视频任务异常: ${err.message || '网络错误'}`);
        store.setStreaming(false);
      }
      return;
    }

    addUserMessage(text);

    // ===== Agent / 规划 模式：真正的 Agent 循环 =====
    if (state.agentMode === 'agent' || state.agentMode === 'plan') {
      const assistantMsg = addAssistantMsg('🤖 正在思考...');
      store.setStreaming(true);

      const agentSystemPrompt = state.agentMode === 'agent'
        ? `你是 TAOTAO，一个强大的 AI 编程助手。你可以使用工具来完成任务：

**工具说明：**
- read_file: 读取文件内容
- write_file: 写入/创建文件
- edit_file: 精确编辑文件（搜索替换）
- list_directory: 列出目录内容
- execute_command: 执行终端命令
- search_code: 在代码库中搜索
- task_complete: 标记任务完成

**工作流程：**
1. 分析用户需求，确定需要做什么
2. 读取相关文件了解现状
3. 编写或修改代码
4. 如有需要，执行命令验证
5. 调用 task_complete 标记任务完成

**重要规则：**
- 每次只调用你真正需要的工具
- 创建新文件前先确认目录存在
- 修改文件时使用 edit_file 而非 write_file（write_file 会覆盖整个文件）
- 执行有副作用的命令前先确认
- 完成任务后必须调用 task_complete`
        : `你是 TAOTAO，一个 AI 规划助手。请先分析用户的需求，制定详细计划，然后逐步执行。

**工具说明：**
- read_file: 读取文件内容
- write_file: 写入/创建文件
- edit_file: 精确编辑文件
- list_directory: 列出目录
- execute_command: 执行命令
- search_code: 搜索代码
- task_complete: 标记完成

**工作流程：**
1. 先输出你的分析和计划（用文字）
2. 逐步执行每一步：读取文件 → 编辑代码 → 验证
3. 最后调用 task_complete 总结`

      const skillsPrompt = getActiveSkillsPrompt(state.installedSkills);

      const agentMessages: Array<{ role: string; content: string; tool_calls?: any[]; tool_call_id?: string }> = [
        { role: 'system', content: agentSystemPrompt + skillsPrompt },
        { role: 'user', content: text },
      ];

      let loopCount = 0;
      const maxLoops = 15;

      try {
        while (loopCount < maxLoops) {
          loopCount++;
          const response = await sendAgentMessage(activeModel, agentMessages, AGENT_TOOLS);

          // 有工具调用
          if (response.toolCalls && response.toolCalls.length > 0) {
            // 更新界面显示当前操作
            const toolNames = response.toolCalls.map(tc => tc.name).join(', ');
            if (response.content) {
              store.updateLastAssistantMessage(
                `🤖 **Agent 思考:** ${response.content}\n\n🔧 **正在执行:** \`${toolNames}\`...`
              );
            } else {
              store.updateLastAssistantMessage(`🔧 **调用工具:** \`${toolNames}\`...`);
            }

            // 添加 assistant 消息（含 tool_calls）
            agentMessages.push({
              role: 'assistant',
              content: response.content || '',
              tool_calls: response.toolCalls.map(tc => ({
                id: tc.id,
                type: 'function',
                function: { name: tc.name, arguments: tc.arguments },
              })),
            });

            // 执行每个工具调用
            for (const toolCall of response.toolCalls) {
              let args: Record<string, any> = {};
              try {
                args = JSON.parse(toolCall.arguments);
              } catch {
                args = {};
              }

              const result = await executeTool(toolCall.name, args);

              // 更新界面
              const statusIcon = result.success ? '✅' : '❌';
              const currentContent = store.getState().chatMessages[store.getState().chatMessages.length - 1]?.content || '';
              const toolResultText = `\n\n${statusIcon} **\`${toolCall.name}\`** 结果:\n\`\`\`\n${result.success ? result.output : result.error}\n\`\`\``;
              store.updateLastAssistantMessage(currentContent + toolResultText);

              // 添加 tool 结果消息
              agentMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: result.success ? result.output : `错误: ${result.error}`,
              });
            }
          } else {
            // 纯文本回复 → Agent 完成
            store.updateLastAssistantMessage(response.content || '任务完成。');
            break;
          }
        }

        if (loopCount >= maxLoops) {
          store.updateLastAssistantMessage('⚠️ Agent 达到最大循环次数，请检查是否陷入循环。');
        }
      } catch (err: any) {
        store.updateLastAssistantMessage(`❌ Agent 执行出错: ${err.message || '网络错误'}`);
      } finally {
        store.setStreaming(false);
      }
      return;
    }

    // ===== 普通文本对话 =====
    const assistantMsg = addAssistantMsg('');
    store.setStreaming(true);

    try {
      const systemPrompt = getSystemPrompt(state.agentMode);
      const allMessages = store.getState().chatMessages
        .filter(m => m.id !== assistantMsg.id)
        .map(m => ({ role: m.role, content: m.content }));

      const messages = state.agentMode !== 'ask'
        ? [{ role: 'system', content: systemPrompt }, ...allMessages]
        : allMessages;

      await sendChatMessage(
        activeModel,
        messages,
        (chunk: string) => {
          const current = store.getState().chatMessages;
          const last = current[current.length - 1];
          if (last && last.role === 'assistant') {
            store.updateLastAssistantMessage(last.content + chunk);
          }
        },
      );
    } catch (err: any) {
      store.updateLastAssistantMessage(`❌ 请求失败: ${err.message || '网络错误'}`);
    } finally {
      store.setStreaming(false);
    }
  }, [input, activeModel, state.isStreaming, state.agentMode, doVideoPolling]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const renderMarkdown = (content: string) => {
    return { __html: marked.parse(content) as string };
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const currentMode = AGENT_MODES.find(m => m.key === state.agentMode) || AGENT_MODES[0];

  return (
    <div className="chat-panel">
      {/* 头部：紧凑的模型/模式/强度选择器 */}
      <div className="chat-header">
        <div className="chat-header-left">
          <div className="chat-header-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>AI 对话</span>
          </div>
        </div>

        <div className="chat-header-controls">
          {/* Agent 模式选择（紧凑 chip 风格） */}
          <div className="agent-mode-selector">
            <div
              className="agent-mode-current"
              onClick={() => setShowModeMenu(!showModeMenu)}
              title={`Agent 模式: ${currentMode.label} - ${currentMode.desc}`}
            >
              <span>{currentMode.icon}</span>
              <span>{currentMode.label}</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
            {showModeMenu && (
              <div className="agent-mode-dropdown">
                {AGENT_MODES.map(mode => (
                  <div
                    key={mode.key}
                    className={`agent-mode-item ${state.agentMode === mode.key ? 'active' : ''}`}
                    onClick={() => {
                      store.setAgentMode(mode.key);
                      setShowModeMenu(false);
                      store.addToast({ type: 'info', message: `已切换到「${mode.label}」模式` });
                    }}
                  >
                    <span>{mode.icon}</span>
                    <div>
                      <div className="agent-mode-item-title">{mode.label}</div>
                      <div className="agent-mode-item-desc">{mode.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 模型强度选择 */}
          {activeModel && (
            <div className="model-strength">
              <select
                className="strength-select"
                value={activeModel.strength || 'medium'}
                onChange={(e) => {
                  const val = e.target.value as 'low' | 'medium' | 'high';
                  store.updateModel(activeModel.id, { strength: val });
                  store.addToast({ type: 'info', message: `强度已切换为: ${val === 'high' ? '高' : val === 'low' ? '低' : '中'}` });
                }}
                title="模型推理强度"
              >
                <option value="low">🐣 低</option>
                <option value="medium">⭐ 中</option>
                <option value="high">⚡ 高</option>
              </select>
            </div>
          )}

          {/* 清空对话图标按钮 */}
          <button
            className="topbar-icon-btn"
            onClick={() => store.clearChat()}
            title="清空对话"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
            </svg>
          </button>
        </div>
      </div>

      {/* 提示栏 */}
      <div className="chat-hint-bar">
        <span>💡 </span>
        <span className="chat-hint">@文件 引用文件 | /image 生图 | /video 生视频 | Ctrl+Enter 发送</span>
      </div>

      {/* 消息列表 */}
      <div className="chat-messages">
        {state.chatMessages.map(msg => (
          <div key={msg.id} className={`chat-message ${msg.role}`}>
            <div className={`chat-avatar ${msg.role === 'user' ? 'user' : 'ai'}`}>
              {msg.role === 'user' ? '我' : 'T'}
            </div>
            <div className="chat-bubble">
              {msg.role === 'assistant' ? (
                <div
                  className="markdown-content"
                  dangerouslySetInnerHTML={renderMarkdown(msg.content || '_准备中..._')}
                />
              ) : (
                <div>{msg.content}</div>
              )}
              <div style={{ fontSize: 10, color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)', marginTop: 4 }}>
                {formatTime(msg.timestamp)}
              </div>
              {/* 消息操作按钮（仅 AI 回复） */}
              {msg.role === 'assistant' && msg.content && !state.isStreaming && (
                <div className="msg-actions">
                  <button
                    className={`msg-action-btn ${copiedId === msg.id ? 'copied' : ''}`}
                    onClick={() => copyMessage(msg.content, msg.id)}
                    title="复制全部内容"
                  >
                    {copiedId === msg.id ? '✓ 已复制' : '📋 复制'}
                  </button>
                  {extractImageUrls(msg.content).map((url, i) => (
                    <button
                      key={i}
                      className="msg-action-btn"
                      onClick={() => saveImage(url)}
                      title={`保存图片: ${url}`}
                    >
                      💾 保存图片
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* 流式加载中 */}
        {state.isStreaming && state.chatMessages.length > 0 && state.chatMessages[state.chatMessages.length - 1].role === 'assistant' && (
          <div style={{ textAlign: 'center', padding: '4px 0' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', animation: 'pulse 1.5s infinite' }}>
              生成中...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区 */}
      <div className="chat-input-area">
        {/* 工具栏 */}
        <div className="chat-toolbar">
          <button
            className={`chat-toolbar-btn ${isRecording ? 'recording' : ''}`}
            onClick={isRecording ? stopVoiceInput : startVoiceInput}
            title={isRecording ? '停止录音' : '语音输入'}
            disabled={state.isStreaming}
          >
            {isRecording ? '⏹' : '🎤'}
          </button>
          <button
            className="chat-toolbar-btn"
            onClick={handleFileUpload}
            title="上传文件/图片"
            disabled={state.isStreaming}
          >
            📎
          </button>
          <div className="chat-model-selector">
            <select
              value={state.activeModelId || ''}
              onChange={(e) => store.setActiveModel(e.target.value || null)}
            >
              <option value="">-- 选择模型 --</option>
              {state.models.map(m => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.strength === 'high' ? '(高)' : m.strength === 'low' ? '(低)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="chat-input-row">
          <div className="chat-input-wrapper">
            <textarea
              ref={textareaRef}
              className="chat-input"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={`[${currentMode.label}模式] 输入消息 (Enter 发送, Shift+Enter 换行) | @文件 引用文件 | 🎤 语音 | 📎 上传`}
              rows={3}
              disabled={state.isStreaming}
            />
            {/* @文件选择器 */}
            {showFilePicker && filteredFiles.length > 0 && (
              <div className="file-picker-dropdown">
                {filteredFiles.map(f => (
                  <div
                    key={f.path}
                    className="file-picker-item"
                    onClick={() => handleFileSelect(f.path)}
                  >
                    <span style={{ marginRight: 6 }}>📄</span>
                    <span>{f.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>{f.path}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || state.isStreaming || !activeModel}
            title="发送 (Enter)"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;