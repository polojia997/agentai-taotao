import { AppState, ModelConfig, ChatMessage, OpenTab, Toast, FileEntry, AgentMode } from './types';

// ========== 默认模型配置 ==========
const defaultModels: ModelConfig[] = [
  // ===== 付费模型 =====
  {
    id: 'model-1',
    name: 'GPT-4o (OpenAI)',
    provider: 'openai',
    apiUrl: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    modelName: 'gpt-4o',
    maxTokens: 4096,
    temperature: 0.7,
    isActive: false,
    strength: 'high',
  },
  {
    id: 'model-2',
    name: 'Claude 3.5 Sonnet (Anthropic)',
    provider: 'anthropic',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    apiKey: '',
    modelName: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    temperature: 0.7,
    isActive: false,
    strength: 'high',
  },
  {
    id: 'model-3',
    name: 'Gemini 2.0 Flash (Google)',
    provider: 'gemini',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
    apiKey: '',
    modelName: 'gemini-2.0-flash-exp',
    maxTokens: 8192,
    temperature: 0.7,
    isActive: false,
    strength: 'medium',
  },
  {
    id: 'model-4',
    name: 'Ollama (本地模型)',
    provider: 'ollama',
    apiUrl: 'http://localhost:11434/api/chat',
    apiKey: '',
    modelName: 'qwen2.5:7b',
    maxTokens: 4096,
    temperature: 0.7,
    isActive: false,
    strength: 'low',
  },
  // ===== 免费模型（注册即用）=====
  {
    id: 'model-5',
    name: '智谱 GLM-4-Flash (免费)',
    provider: 'zhipu',
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    apiKey: '',
    modelName: 'glm-4-flash',
    maxTokens: 8192,
    temperature: 0.7,
    isActive: false,
    strength: 'medium',
  },
  {
    id: 'model-6',
    name: '硅基流动 Qwen2.5-7B (免费)',
    provider: 'siliconflow',
    apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
    apiKey: '',
    modelName: 'Qwen/Qwen2.5-7B-Instruct',
    maxTokens: 4096,
    temperature: 0.7,
    isActive: false,
    strength: 'medium',
  },
  {
    id: 'model-7',
    name: 'Groq Llama 3.3 70B (免费)',
    provider: 'groq',
    apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: '',
    modelName: 'llama-3.3-70b-versatile',
    maxTokens: 4096,
    temperature: 0.7,
    isActive: false,
    strength: 'high',
  },
  {
    id: 'model-8',
    name: '百度 ERNIE-Speed (免费)',
    provider: 'qianfan',
    apiUrl: 'https://qianfan.baidubce.com/v2/chat/completions',
    apiKey: '',
    modelName: 'ernie-speed-8k',
    maxTokens: 4096,
    temperature: 0.7,
    isActive: false,
    strength: 'medium',
  },
  {
    id: 'model-9',
    name: '阿里 Qwen Turbo (免费)',
    provider: 'dashscope',
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    apiKey: '',
    modelName: 'qwen-turbo',
    maxTokens: 4096,
    temperature: 0.7,
    isActive: false,
    strength: 'medium',
  },
  {
    id: 'model-10',
    name: 'GitHub Models GPT-4o Mini (免费)',
    provider: 'github',
    apiUrl: 'https://models.inference.ai.azure.com/chat/completions',
    apiKey: '',
    modelName: 'gpt-4o-mini',
    maxTokens: 4096,
    temperature: 0.7,
    isActive: false,
    strength: 'high',
  },
];

// ========== 初始状态 ==========
const initialState: AppState = {
  models: defaultModels,
  activeModelId: null,
  chatMessages: [],
  openTabs: [],
  activeTabId: null,
  fileTree: [],
  currentDir: '',
  sidebarTab: 'files',
  isStreaming: false,
  toasts: [],
  config: {
    theme: 'dark',
    fontSize: 14,
    tabSize: 4,
    autoSave: true,
    language: 'zh-CN',
  },
  terminal: {
    isRunning: false,
    cwd: '',
  },
  agentMode: 'auto',
  groqApiKey: localStorage.getItem('taotao-groq-key') || '',
  installedSkills: JSON.parse(localStorage.getItem('taotao-skills') || '[]'),
};

// ========== 简单状态管理 ==========
type Listener = (state: AppState) => void;

class Store {
  private state: AppState;
  private listeners: Set<Listener> = new Set();

  constructor() {
    // 从 localStorage 加载模型配置
    const savedModels = localStorage.getItem('taotao-models');
    const savedActiveModel = localStorage.getItem('taotao-active-model');

    let initialModels: ModelConfig[];
    if (savedModels) {
      try {
        initialModels = JSON.parse(savedModels);
      } catch {
        initialModels = defaultModels;
      }
    } else {
      initialModels = defaultModels;
    }

    this.state = {
      ...initialState,
      models: initialModels,
      activeModelId: savedActiveModel || null,
    };

    // 异步从主进程拉默认模型（涛哥备份的 Agnes/Groq/GitHub 等）
    this.loadDefaultPresets();
  }

  // 加载主进程注入的默认模型预设
  private async loadDefaultPresets() {
    try {
      const { ipcRenderer } = (window as any).require('electron');
      const presets: ModelConfig[] = await ipcRenderer.invoke('models:getDefaults');
      if (!presets || presets.length === 0) return;

      // 合并：以现有列表的 id 优先，缺失的 id 才补上
      const existingIds = new Set(this.state.models.map(m => m.id));
      const merged = [...this.state.models];
      for (const p of presets) {
        if (!existingIds.has(p.id)) {
          merged.push(p);
        }
      }
      this.setState({ models: merged });
      this.saveModels(merged);
    } catch (e) {
      // 静默失败
    }
  }

  getState(): AppState {
    return this.state;
  }

  setState(partial: Partial<AppState>) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => l(this.state));
  }

  // ========== 模型操作 ==========
  addModel(model: ModelConfig) {
    const models = [...this.state.models, model];
    this.setState({ models });
    this.saveModels(models);
  }

  updateModel(id: string, updates: Partial<ModelConfig>) {
    const models = this.state.models.map(m =>
      m.id === id ? { ...m, ...updates } : m
    );
    this.setState({ models });
    this.saveModels(models);
  }

  deleteModel(id: string) {
    const models = this.state.models.filter(m => m.id !== id);
    if (this.state.activeModelId === id) {
      this.setState({ models, activeModelId: null });
    } else {
      this.setState({ models });
    }
    this.saveModels(models);
  }

  setActiveModel(id: string | null) {
    // 取消所有模型激活
    const models = this.state.models.map(m => ({
      ...m,
      isActive: m.id === id,
    }));
    this.setState({ models, activeModelId: id });
    this.saveModels(models);
    if (id) {
      localStorage.setItem('taotao-active-model', id);
    } else {
      localStorage.removeItem('taotao-active-model');
    }
  }

  private saveModels(models: ModelConfig[]) {
    localStorage.setItem('taotao-models', JSON.stringify(models));
  }

  // ========== 聊天操作 ==========
  addMessage(message: ChatMessage) {
    this.setState({
      chatMessages: [...this.state.chatMessages, message],
    });
  }

  // 设置整个消息列表（用于 /compact 压缩）
  setMessages(messages: ChatMessage[]) {
    this.setState({ chatMessages: messages });
  }

  // 设置激活模型
  setActiveModelId(modelId: string) {
    this.setState({ activeModelId: modelId });
  }

  // Dry-run 模式（用于写文件前出 diff）
  setDryRun(enabled: boolean) {
    this.setState({ dryRun: enabled } as any);
  }

  updateLastAssistantMessage(content: string) {
    const messages = [...this.state.chatMessages];
    const last = messages[messages.length - 1];
    if (last && last.role === 'assistant') {
      messages[messages.length - 1] = { ...last, content };
    }
    this.setState({ chatMessages: messages });
  }

  clearChat() {
    this.setState({ chatMessages: [] });
  }

  setStreaming(isStreaming: boolean) {
    this.setState({ isStreaming });
  }

  setAgentMode(mode: AgentMode) {
    this.setState({ agentMode: mode });
  }

  setGroqApiKey(key: string) {
    localStorage.setItem('taotao-groq-key', key);
    this.setState({ groqApiKey: key });
  }

  // ========== Skills 操作 ==========
  installSkill(skillId: string) {
    const installed = [...this.state.installedSkills];
    if (!installed.includes(skillId)) {
      installed.push(skillId);
      localStorage.setItem('taotao-skills', JSON.stringify(installed));
      this.setState({ installedSkills: installed });
    }
  }

  uninstallSkill(skillId: string) {
    const installed = this.state.installedSkills.filter(id => id !== skillId);
    localStorage.setItem('taotao-skills', JSON.stringify(installed));
    this.setState({ installedSkills: installed });
  }

  isSkillInstalled(skillId: string): boolean {
    return this.state.installedSkills.includes(skillId);
  }

  // ========== 标签页操作 ==========
  openTab(tab: OpenTab) {
    const existing = this.state.openTabs.find(t => t.path === tab.path);
    if (existing) {
      this.setState({ activeTabId: existing.id });
    } else {
      this.setState({
        openTabs: [...this.state.openTabs, tab],
        activeTabId: tab.id,
      });
    }
    // 自动打开聊天面板
    if (tab.type === 'chat') {
      this.setState({ sidebarTab: 'files' });
    }
  }

  closeTab(id: string) {
    const tabs = this.state.openTabs.filter(t => t.id !== id);
    let activeTabId = this.state.activeTabId;
    if (activeTabId === id) {
      activeTabId = tabs.length > 0 ? tabs[tabs.length - 1].id : null;
    }
    this.setState({ openTabs: tabs, activeTabId });
  }

  setActiveTab(id: string | null) {
    this.setState({ activeTabId: id });
  }

  // ========== 文件操作 ==========
  setFileTree(tree: FileEntry[]) {
    this.setState({ fileTree: tree });
  }

  setCurrentDir(dir: string) {
    this.setState({ currentDir: dir });
  }

  // ========== 侧边栏 ==========
  setSidebarTab(tab: AppState['sidebarTab']) {
    this.setState({ sidebarTab: tab });
  }

  // ========== Toast ==========
  addToast(toast: Omit<Toast, 'id'>) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const newToast = { ...toast, id };
    this.setState({ toasts: [...this.state.toasts, newToast] });
    // 自动移除
    setTimeout(() => {
      this.removeToast(id);
    }, toast.duration || 3000);
  }

  removeToast(id: string) {
    this.setState({
      toasts: this.state.toasts.filter(t => t.id !== id),
    });
  }
}

// 全局单例
export const store = new Store();

// React Hook
export function useStore(): AppState {
  const [state, setState] = React.useState(store.getState());
  
  React.useEffect(() => {
    return store.subscribe(setState);
  }, []);
  
  return state;
}

import React from 'react';