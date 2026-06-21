// ========== 模型配置类型 ==========
export interface ModelConfig {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'agnes' | 'zhipu' | 'siliconflow' | 'groq' | 'qianfan' | 'dashscope' | 'github' | 'custom';
  apiUrl: string;
  apiKey: string;
  modelName: string;
  maxTokens: number;
  temperature: number;
  isActive: boolean;
  // 模型强度等级
  strength?: 'low' | 'medium' | 'high';
}

// ========== Agent 模式 ==========
export type AgentMode = 'auto' | 'plan' | 'agent' | 'ask';

// ========== 聊天消息类型 ==========
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  modelId?: string;
}

// ========== 文件类型 ==========
export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isFile: boolean;
  children?: FileEntry[];
  expanded?: boolean;
}

// ========== 打开的文件标签 ==========
export interface OpenTab {
  id: string;
  path: string;
  name: string;
  type: 'code' | 'image' | 'video' | 'model' | 'diff' | 'chat' | 'editor';
  isDirty: boolean;
  content?: string;
  language?: string;
}

// ========== 侧边栏 Tab ==========
export type SidebarTab = 'files' | 'search' | 'models' | 'skills' | 'git' | 'plan' | 'agents' | 'audit';

// ========== Skills 系统 ==========
export interface Skill {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  prompt: string;        // 注入到系统提示词中
  tags: string[];
  author: string;
  version: string;
}

export interface SkillCategory {
  id: string;
  name: string;
  icon: string;
}

// ========== 上下文菜单 ==========
export interface ContextMenuOption {
  label: string;
  icon?: string;
  action: () => void;
  danger?: boolean;
  divider?: boolean;
}

// ========== Toast 通知 ==========
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

// ========== 应用配置 ==========
export interface AppConfig {
  theme: 'dark';
  fontSize: number;
  tabSize: number;
  autoSave: boolean;
  language: 'zh-CN';
}

// ========== API 响应类型 ==========
export interface ApiResponse {
  success: boolean;
  content?: string;
  error?: string;
}

// ========== 文件操作结果 ==========
export interface FileResult {
  success: boolean;
  content?: string;
  error?: string;
}

export interface DirResult {
  success: boolean;
  entries?: FileEntry[];
  error?: string;
}

export interface StatResult {
  success: boolean;
  size?: number;
  mtime?: number;
  error?: string;
}

export interface BinaryResult {
  success: boolean;
  data?: string;
  mimeType?: string;
  size?: number;
  error?: string;
}

// ========== 终端类型 ==========
export interface TerminalState {
  isRunning: boolean;
  cwd: string;
}

// ========== 全局状态 ==========
export interface AppState {
  models: ModelConfig[];
  activeModelId: string | null;
  chatMessages: ChatMessage[];
  openTabs: OpenTab[];
  activeTabId: string | null;
  fileTree: FileEntry[];
  currentDir: string;
  sidebarTab: SidebarTab;
  isStreaming: boolean;
  toasts: Toast[];
  config: AppConfig;
  terminal: TerminalState;
  agentMode: AgentMode;
  groqApiKey: string;
  installedSkills: string[];  // 已安装的 skill IDs
  dryRun?: boolean;           // Dry-run 模式：写文件前先出 diff
}

// ========== 图片/视频生成 ==========
export interface GenerateImageResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface GenerateVideoResult {
  success: boolean;
  taskId?: string;
  status?: string;
  videoUrl?: string;
  error?: string;
}