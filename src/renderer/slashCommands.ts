// ========== Slash 命令系统 ==========
// 聊天框输入 /xxx 直接执行，类似 Codex

export type SlashCommandResult =
  | { kind: 'reply'; text: string }
  | { kind: 'plan'; prompt: string }
  | { kind: 'compact' }
  | { kind: 'model'; modelId: string }
  | { kind: 'auto' }
  | { kind: 'reasoning'; level: 'low' | 'medium' | 'high' }
  | { kind: 'dryrun'; enabled: boolean }
  | { kind: 'features' }
  | { kind: 'audit'; kindFilter?: string; limit?: number }
  | { kind: 'route'; prompt: string }
  | { kind: 'help' };

export interface SlashCommand {
  name: string;
  description: string;
  usage: string;
  examples: string[];
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: 'help',
    description: '显示所有 slash 命令',
    usage: '/help',
    examples: ['/help'],
  },
  {
    name: 'plan',
    description: '进入规划模式：先生成计划，用户确认后再执行',
    usage: '/plan <任务描述>',
    examples: ['/plan 帮我加一个用户登录功能', '/plan 重构一下 store.ts'],
  },
  {
    name: 'compact',
    description: '压缩当前会话上下文，节省 token',
    usage: '/compact',
    examples: ['/compact'],
  },
  {
    name: 'model',
    description: '锁定使用指定模型（覆盖自动选择）',
    usage: '/model <模型ID>',
    examples: ['/model glm-4.7-flash', '/model deepseek-v4-pro'],
  },
  {
    name: 'auto',
    description: '恢复自动选择模型',
    usage: '/auto',
    examples: ['/auto'],
  },
  {
    name: 'reasoning',
    description: '设置推理深度',
    usage: '/reasoning <low|medium|high>',
    examples: ['/reasoning high', '/reasoning low'],
  },
  {
    name: 'dryrun',
    description: '切换 Dry-run 模式（写文件前先出 diff 不真改）',
    usage: '/dryrun [on|off]',
    examples: ['/dryrun on', '//dryrun off', '/dryrun'],
  },
  {
    name: 'features',
    description: '查看当前启用的功能特性',
    usage: '/features',
    examples: ['/features'],
  },
  {
    name: 'audit',
    description: '查看审计日志',
    usage: '/audit [类型] [数量]',
    examples: ['/audit', '/audit command.blocked 20', '/audit verify.failed'],
  },
  {
    name: 'route',
    description: '预测某个请求会被路由到哪个模型',
    usage: '/route <请求内容>',
    examples: ['/route 重构一下我的用户系统', '/route 1+1 等于几'],
  },
];

// 解析斜杠命令
export function parseSlashCommand(input: string): SlashCommandResult | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  const match = trimmed.match(/^\/(\w+)(?:\s+(.*))?$/s);
  if (!match) return null;

  const cmd = match[1].toLowerCase();
  const args = (match[2] || '').trim();

  switch (cmd) {
    case 'help':
      return { kind: 'help' };

    case 'plan':
      if (!args) {
        return { kind: 'reply', text: '用法：`/plan <任务描述>`\n\n例如：`/plan 帮我加一个用户登录功能`' };
      }
      return { kind: 'plan', prompt: args };

    case 'compact':
      return { kind: 'compact' };

    case 'model':
      if (!args) {
        return { kind: 'reply', text: '用法：`/model <模型ID>`\n\n例如：`/model glm-4.7-flash`' };
      }
      return { kind: 'model', modelId: args };

    case 'auto':
      return { kind: 'auto' };

    case 'reasoning':
      if (!['low', 'medium', 'high'].includes(args)) {
        return { kind: 'reply', text: '用法：`/reasoning <low|medium|high>`' };
      }
      return { kind: 'reasoning', level: args as 'low' | 'medium' | 'high' };

    case 'dryrun':
      if (args === 'on' || args === 'true' || args === '1') return { kind: 'dryrun', enabled: true };
      if (args === 'off' || args === 'false' || args === '0') return { kind: 'dryrun', enabled: false };
      return { kind: 'dryrun', enabled: true };

    case 'features':
      return { kind: 'features' };

    case 'audit':
      {
        const parts = args.split(/\s+/);
        const kindFilter = parts[0];
        const limit = parts[1] ? parseInt(parts[1], 10) : 20;
        return { kind: 'audit', kindFilter, limit };
      }

    case 'route':
      if (!args) {
        return { kind: 'reply', text: '用法：`/route <请求内容>`' };
      }
      return { kind: 'route', prompt: args };

    default:
      return { kind: 'reply', text: `未知命令：/${cmd}\n\n输入 \`/help\` 查看所有命令。` };
  }
}

// 渲染帮助文本
export function renderHelp(): string {
  const lines = ['## 📖 Slash 命令列表\n'];
  for (const cmd of SLASH_COMMANDS) {
    lines.push(`**\`${cmd.usage}\`** — ${cmd.description}`);
    if (cmd.examples.length > 0) {
      lines.push(`   例如：${cmd.examples.map(e => `\`${e}\``).join(' / ')}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
