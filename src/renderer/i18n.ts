// TAOTAO i18n 简易国际化模块
// 支持 zh-CN / en-US 切换

export type Locale = 'zh-CN' | 'en-US';

const dict: Record<string, Record<Locale, string>> = {
  // ===== 应用 =====
  'app.name':                   { 'zh-CN': 'TAOTAO',  'en-US': 'TAOTAO' },
  'app.tagline':                { 'zh-CN': '智能编程 Agent', 'en-US': 'AI Coding Agent' },

  // ===== 顶栏 =====
  'topbar.newChat':             { 'zh-CN': '新建会话', 'en-US': 'New Chat' },
  'topbar.settings':            { 'zh-CN': '设置', 'en-US': 'Settings' },
  'topbar.donate':              { 'zh-CN': '捐赠', 'en-US': 'Donate' },
  'topbar.about':               { 'zh-CN': '关于', 'en-US': 'About' },
  'topbar.language':            { 'zh-CN': '语言', 'en-US': 'Language' },
  'topbar.language.zh':         { 'zh-CN': '中文', 'en-US': 'Chinese' },
  'topbar.language.en':         { 'zh-CN': '英文', 'en-US': 'English' },

  // ===== 活动栏 / 侧栏 =====
  'sidebar.chat':               { 'zh-CN': '会话', 'en-US': 'Chat' },
  'sidebar.explorer':           { 'zh-CN': '资源管理器', 'en-US': 'Explorer' },
  'sidebar.search':             { 'zh-CN': '搜索', 'en-US': 'Search' },
  'sidebar.skills':             { 'zh-CN': '技能', 'en-US': 'Skills' },
  'sidebar.models':             { 'zh-CN': '模型', 'en-US': 'Models' },
  'sidebar.terminal':           { 'zh-CN': '终端', 'en-US': 'Terminal' },
  'sidebar.audit':              { 'zh-CN': '审计', 'en-US': 'Audit' },

  // ===== 会话 =====
  'chat.placeholder':           { 'zh-CN': '输入消息，Shift+Enter 换行，/ 触发命令', 'en-US': 'Type a message, Shift+Enter for newline, / for commands' },
  'chat.send':                  { 'zh-CN': '发送', 'en-US': 'Send' },
  'chat.stop':                  { 'zh-CN': '停止', 'en-US': 'Stop' },
  'chat.empty.welcome':         { 'zh-CN': '开始一个新的会话', 'en-US': 'Start a new conversation' },
  'chat.empty.hint':            { 'zh-CN': '我会写代码、跑命令、读文件、改 Bug。试试问我点什么。', 'en-US': 'I can write code, run commands, read files, fix bugs. Try asking me something.' },
  'chat.thinking':              { 'zh-CN': '思考中…', 'en-US': 'Thinking…' },
  'chat.error.noModel':         { 'zh-CN': '请先在【模型】面板配置 API Key', 'en-US': 'Please configure an API key in Models panel first' },
  'chat.error.network':         { 'zh-CN': '网络错误，请检查代理或网络', 'en-US': 'Network error, check proxy or network' },

  // ===== 模型 =====
  'model.add':                  { 'zh-CN': '添加模型', 'en-US': 'Add Model' },
  'model.name':                 { 'zh-CN': '名称', 'en-US': 'Name' },
  'model.provider':             { 'zh-CN': '服务商', 'en-US': 'Provider' },
  'model.apiKey':               { 'zh-CN': 'API Key', 'en-US': 'API Key' },
  'model.apiUrl':               { 'zh-CN': 'API 地址', 'en-US': 'API URL' },
  'model.modelName':            { 'zh-CN': '模型名', 'en-US': 'Model Name' },
  'model.save':                 { 'zh-CN': '保存', 'en-US': 'Save' },
  'model.delete':               { 'zh-CN': '删除', 'en-US': 'Delete' },
  'model.test':                 { 'zh-CN': '测试', 'en-US': 'Test' },
  'model.active':               { 'zh-CN': '已启用', 'en-US': 'Active' },
  'model.reset':                { 'zh-CN': '恢复默认预设', 'en-US': 'Reset to Defaults' },
  'model.preset.intro':         { 'zh-CN': '选择服务商快速填充：', 'en-US': 'Quick fill by provider:' },

  // ===== 终端 / 资源管理器 =====
  'terminal.title':             { 'zh-CN': '终端', 'en-US': 'Terminal' },
  'terminal.input.placeholder': { 'zh-CN': '在 TAOTAO 中运行 shell 命令', 'en-US': 'Run a shell command in TAOTAO' },
  'explorer.title':             { 'zh-CN': '资源管理器', 'en-US': 'Explorer' },
  'explorer.empty':             { 'zh-CN': '未打开文件夹', 'en-US': 'No folder opened' },
  'search.title':               { 'zh-CN': '搜索', 'en-US': 'Search' },
  'search.placeholder':         { 'zh-CN': '搜索文件…', 'en-US': 'Search files…' },

  // ===== 审计 =====
  'audit.title':                { 'zh-CN': '审计日志', 'en-US': 'Audit Log' },
  'audit.clear':                { 'zh-CN': '清空日志', 'en-US': 'Clear Log' },
  'audit.empty':                { 'zh-CN': '暂无日志', 'en-US': 'No logs' },
  'audit.size':                 { 'zh-CN': '总条数', 'en-US': 'Total' },

  // ===== 技能 =====
  'skills.title':               { 'zh-CN': '技能', 'en-US': 'Skills' },
  'skills.empty':               { 'zh-CN': '暂无技能', 'en-US': 'No skills' },

  // ===== 设置 =====
  'settings.title':             { 'zh-CN': '设置', 'en-US': 'Settings' },
  'settings.appearance':        { 'zh-CN': '外观', 'en-US': 'Appearance' },
  'settings.theme.dark':         { 'zh-CN': '深色', 'en-US': 'Dark' },
  'settings.theme.light':       { 'zh-CN': '浅色', 'en-US': 'Light' },
  'settings.fontSize':          { 'zh-CN': '字体大小', 'en-US': 'Font Size' },
  'settings.language':          { 'zh-CN': '语言', 'en-US': 'Language' },

  // ===== 捐赠 =====
  'donate.title':               { 'zh-CN': '支持 TAOTAO', 'en-US': 'Support TAOTAO' },
  'donate.intro':               { 'zh-CN': 'TAOTAO 是开源软件，永久免费。如果它帮到了你，欢迎请我喝杯咖啡 ☕', 'en-US': 'TAOTAO is open-source and forever free. If it helps you, buy me a coffee ☕' },
  'donate.wechat':              { 'zh-CN': '微信扫码', 'en-US': 'WeChat Pay' },
  'donate.alipay':              { 'zh-CN': '支付宝', 'en-US': 'Alipay' },
  'donate.thanks':              { 'zh-CN': '感谢你的支持！', 'en-US': 'Thank you for your support!' },

  // ===== 关于 =====
  'about.title':                { 'zh-CN': '关于 TAOTAO', 'en-US': 'About TAOTAO' },
  'about.version':              { 'zh-CN': '版本', 'en-US': 'Version' },
  'about.author':               { 'zh-CN': '作者', 'en-US': 'Author' },
  'about.github':               { 'zh-CN': 'GitHub 仓库', 'en-US': 'GitHub Repo' },
  'about.license':              { 'zh-CN': '许可证', 'en-US': 'License' },
  'about.desc':                 { 'zh-CN': '一个会写代码、会用工具、能自我验证的本地 AI Agent。', 'en-US': 'A local AI Agent that writes code, uses tools, and self-verifies.' },

  // ===== 通用 =====
  'common.cancel':              { 'zh-CN': '取消', 'en-US': 'Cancel' },
  'common.confirm':             { 'zh-CN': '确定', 'en-US': 'Confirm' },
  'common.close':               { 'zh-CN': '关闭', 'en-US': 'Close' },
  'common.yes':                 { 'zh-CN': '是', 'en-US': 'Yes' },
  'common.no':                  { 'zh-CN': '否', 'en-US': 'No' },
  'common.loading':             { 'zh-CN': '加载中…', 'en-US': 'Loading…' },
  'common.success':             { 'zh-CN': '成功', 'en-US': 'Success' },
  'common.failed':              { 'zh-CN': '失败', 'en-US': 'Failed' },
};

let currentLocale: Locale = 'zh-CN';
const listeners: Array<(loc: Locale) => void> = [];

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(loc: Locale): void {
  currentLocale = loc;
  try {
    localStorage.setItem('taotao.locale', loc);
  } catch (e) {}
  listeners.forEach(fn => fn(loc));
}

export function initLocale(): void {
  try {
    const saved = localStorage.getItem('taotao.locale') as Locale | null;
    if (saved === 'zh-CN' || saved === 'en-US') {
      currentLocale = saved;
    } else {
      // 跟随系统语言
      const sys = (navigator.language || 'zh-CN').toLowerCase();
      currentLocale = sys.startsWith('zh') ? 'zh-CN' : 'en-US';
    }
  } catch (e) {
    currentLocale = 'zh-CN';
  }
}

export function onLocaleChange(fn: (loc: Locale) => void): () => void {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export function t(key: string, params?: Record<string, string | number>): string {
  const entry = dict[key];
  let s = entry ? (entry[currentLocale] || entry['zh-CN'] || key) : key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return s;
}
