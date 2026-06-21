// ========== Agent 工具定义与执行引擎 ==========
// 实现真正的 Agent 能力：文件操作、命令执行、代码搜索等

const { ipcRenderer } = (window as any).require('electron');

// ========== 工具定义 (OpenAI Function Calling 格式) ==========
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: '读取指定路径的文件内容。用于查看代码、配置文件等。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '文件的绝对路径' },
        },
        required: ['filePath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_file',
      description: '写入内容到指定路径的文件。会覆盖已有文件，如果文件不存在则创建。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '文件的绝对路径' },
          content: { type: 'string', description: '要写入的文件内容' },
        },
        required: ['filePath', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: '精确编辑文件：搜索文件中的特定字符串并替换为新内容。只替换第一次出现。',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: '文件的绝对路径' },
          old_string: { type: 'string', description: '文件中要替换的原文（必须精确匹配）' },
          new_string: { type: 'string', description: '替换后的新内容' },
        },
        required: ['filePath', 'old_string', 'new_string'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_directory',
      description: '列出目录中的文件和子目录。',
      parameters: {
        type: 'object',
        properties: {
          dirPath: { type: 'string', description: '目录的绝对路径' },
        },
        required: ['dirPath'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'execute_command',
      description: '在终端中执行命令并返回结果。用于运行编译、测试、git 等命令。注意：命令在项目目录下执行。',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: '要执行的 shell 命令' },
          cwd: { type: 'string', description: '工作目录（可选，默认为当前项目目录）' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_code',
      description: '在代码库中搜索匹配指定正则表达式的内容。用于查找函数、类、变量等。',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: '正则表达式搜索模式' },
          directory: { type: 'string', description: '搜索目录的绝对路径（可选）' },
          fileTypes: { type: 'string', description: '文件类型过滤，如 .ts,.tsx（可选）' },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'task_complete',
      description: '标记任务已完成。当你已经完成了用户的所有要求时调用此函数，输出最终总结。',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: '任务完成的总结，包括你做了哪些操作以及结果' },
        },
        required: ['summary'],
      },
    },
  },
];

// ========== 工具执行 ==========
export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export async function executeTool(name: string, args: Record<string, any>): Promise<ToolResult> {
  switch (name) {
    case 'read_file':
      return readFile(args.filePath);
    case 'write_file':
      return writeFile(args.filePath, args.content);
    case 'edit_file':
      return editFile(args.filePath, args.old_string, args.new_string);
    case 'list_directory':
      return listDirectory(args.dirPath);
    case 'execute_command':
      return executeCommand(args.command, args.cwd);
    case 'search_code':
      return searchCode(args.pattern, args.directory, args.fileTypes);
    case 'task_complete':
      return { success: true, output: `任务完成: ${args.summary}` };
    default:
      return { success: false, output: '', error: `未知工具: ${name}` };
  }
}

async function readFile(filePath: string): Promise<ToolResult> {
  try {
    const result = await ipcRenderer.invoke('fs:readFile', filePath);
    if (result.success) {
      const preview = result.content.length > 8000
        ? result.content.slice(0, 8000) + '\n... (内容已截断，共 ' + result.content.length + ' 字符)'
        : result.content;
      return { success: true, output: preview };
    }
    return { success: false, output: '', error: result.error };
  } catch (e: any) {
    return { success: false, output: '', error: e.message };
  }
}

async function writeFile(filePath: string, content: string): Promise<ToolResult> {
  try {
    const result = await ipcRenderer.invoke('fs:writeFile', filePath, content);
    if (result.success) {
      return { success: true, output: `文件已写入: ${filePath}` };
    }
    return { success: false, output: '', error: result.error };
  } catch (e: any) {
    return { success: false, output: '', error: e.message };
  }
}

async function editFile(filePath: string, oldString: string, newString: string): Promise<ToolResult> {
  try {
    // 先读取文件
    const readResult = await ipcRenderer.invoke('fs:readFile', filePath);
    if (!readResult.success) {
      return { success: false, output: '', error: `无法读取文件: ${readResult.error}` };
    }

    const content: string = readResult.content;
    if (!content.includes(oldString)) {
      return {
        success: false,
        output: '',
        error: `在文件中未找到要替换的文本。请确保 old_string 与文件内容精确匹配（包括缩进和空白字符）。文件内容前200字符: ${content.slice(0, 200)}`,
      };
    }

    // 只替换第一次出现
    const newContent = content.replace(oldString, newString);
    const writeResult = await ipcRenderer.invoke('fs:writeFile', filePath, newContent);
    if (writeResult.success) {
      return { success: true, output: `文件已编辑: ${filePath}` };
    }
    return { success: false, output: '', error: writeResult.error };
  } catch (e: any) {
    return { success: false, output: '', error: e.message };
  }
}

async function listDirectory(dirPath: string): Promise<ToolResult> {
  try {
    const result = await ipcRenderer.invoke('fs:readDir', dirPath);
    if (result.success) {
      const entries = result.entries as Array<{ name: string; isDirectory: boolean; isFile: boolean }>;
      const lines = entries.map(e =>
        `${e.isDirectory ? '📁' : '📄'} ${e.name}${e.isDirectory ? '/' : ''}`
      );
      return { success: true, output: lines.join('\n') || '(空目录)' };
    }
    return { success: false, output: '', error: result.error };
  } catch (e: any) {
    return { success: false, output: '', error: e.message };
  }
}

async function executeCommand(command: string, cwd?: string): Promise<ToolResult> {
  try {
    // === 危险命令拦截（Codex 风格沙箱） ===
    const check = await ipcRenderer.invoke('safety:checkCommand', command, cwd || process.cwd());
    if (check.risk === 'forbidden') {
      return {
        success: false,
        output: '',
        error: `⛔ 命令被安全策略阻止：${check.reason}\n\n${check.suggestion || ''}\n\n如果你认为这是误判，请在终端手动执行。`,
      };
    }
    // 可疑命令：返回警告但仍执行
    if (check.risk === 'suspicious') {
      // 不阻止，只在结果里标注
    }

    const result = await ipcRenderer.invoke('agent:executeCommand', command, cwd);
    if (result.success) {
      let output = (result.stdout || '') + (result.stderr ? '\n[stderr]\n' + result.stderr : '');
      if (check.risk === 'suspicious') {
        output = `⚠️ 警告：${check.reason}\n\n` + output;
      }
      const truncated = output.length > 4000 ? output.slice(0, 4000) + '\n... (输出已截断)' : output;
      return { success: true, output: truncated || '(命令执行完成，无输出)' };
    }
    return { success: false, output: '', error: result.error };
  } catch (e: any) {
    return { success: false, output: '', error: e.message };
  }
}

async function searchCode(pattern: string, directory?: string, fileTypes?: string): Promise<ToolResult> {
  try {
    const result = await ipcRenderer.invoke('agent:searchCode', {
      pattern,
      directory: directory || '',
      fileTypes: fileTypes || '',
    });
    if (result.success) {
      const matches = result.matches as string[];
      const output = matches.length > 0
        ? matches.slice(0, 30).join('\n') + (matches.length > 30 ? `\n... 还有 ${matches.length - 30} 条结果` : '')
        : '未找到匹配结果';
      return { success: true, output };
    }
    return { success: false, output: '', error: result.error };
  } catch (e: any) {
    return { success: false, output: '', error: e.message };
  }
}