import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn, ChildProcess, exec } from 'child_process';
import { checkCommand, describeRisk, CommandRisk } from './safety';
import { verifyFile, verifyFiles, formatVerifyResult, VerifyResult } from './verifier';
import { audit, AuditEventKind } from './audit';
import { routeRequest, describeComplexity } from './autoRouter';

// 加载 .env 文件（不依赖 dotenv 包）
function loadEnv(): void {
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (!m) continue;
      const k = m[1];
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  } catch (e) {
    // 静默
  }
}
loadEnv();

// 启用语音识别支持
app.commandLine.appendSwitch('enable-speech-dispatcher');
app.commandLine.appendSwitch('enable-speech-recognition');

// 设置用户数据目录到安装目录下，避免沙箱限制
const userDataPath = path.join(path.dirname(app.getPath('exe')), '.electron-data');
app.setPath('userData', userDataPath);
app.setPath('appData', userDataPath);
app.setPath('logs', path.join(userDataPath, 'logs'));
app.setPath('crashDumps', path.join(userDataPath, 'crash'));
if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

let mainWindow: BrowserWindow | null = null;
let terminalProcess: ChildProcess | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'TAOTAO - AI 智能编程助手',
    icon: path.join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
    frame: true,
    backgroundColor: '#1e1e2e',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    killTerminal();
  });

  // 全中文菜单
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        { label: '打开文件...', accelerator: 'Ctrl+O', click: () => openFile() },
        { label: '打开文件夹...', accelerator: 'Ctrl+K Ctrl+O', click: () => openFolder() },
        { type: 'separator' },
        { label: '保存', accelerator: 'Ctrl+S', click: () => mainWindow?.webContents.send('menu:save') },
        { label: '另存为...', accelerator: 'Ctrl+Shift+S', click: () => mainWindow?.webContents.send('menu:saveAs') },
        { type: 'separator' },
        { label: '退出', accelerator: 'Alt+F4', click: () => app.quit() },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'Ctrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'Ctrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'Ctrl+X', role: 'cut' },
        { label: '复制', accelerator: 'Ctrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'Ctrl+V', role: 'paste' },
        { label: '全选', accelerator: 'Ctrl+A', role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', accelerator: 'Ctrl+R', role: 'reload' },
        { label: '强制重新加载', accelerator: 'Ctrl+Shift+R', role: 'forceReload' },
        { type: 'separator' },
        { label: '放大', accelerator: 'Ctrl+=', role: 'zoomIn' },
        { label: '缩小', accelerator: 'Ctrl+-', role: 'zoomOut' },
        { label: '重置缩放', accelerator: 'Ctrl+0', role: 'resetZoom' },
        { type: 'separator' },
        { label: '切换全屏', accelerator: 'F11', role: 'togglefullscreen' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 TAOTAO',
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: '关于 TAOTAO',
              message: 'TAOTAO - AI 智能编程助手',
              detail: '一个模仿 CODEX 的全中文 AI 编程助手\n支持自定义接入任何大模型',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

async function openFile() {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: '所有文件', extensions: ['*'] }],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    mainWindow?.webContents.send('menu:openFiles', result.filePaths);
  }
}

async function openFolder() {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    mainWindow?.webContents.send('menu:openFolder', result.filePaths[0]);
  }
}

function killTerminal(): void {
  if (terminalProcess) {
    try {
      terminalProcess.kill();
    } catch (e) {
      // ignore
    }
    terminalProcess = null;
  }
}

// ==================== 文件操作 IPC ====================

ipcMain.handle('dialog:openFile', async (_event, options?: { filters?: any[]; properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles' | 'createDirectory' | 'promptToCreate' | 'noResolveAliases' | 'treatPackageAsDirectory' | 'dontAddToRecent'> }) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: options?.properties || ['openFile', 'multiSelections'],
    filters: options?.filters || [
      { name: '所有文件', extensions: ['*'] },
      { name: '代码文件', extensions: ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'cpp', 'c', 'html', 'css', 'json'] },
    ],
  });
  if (result.canceled) return null;
  const filePath = result.filePaths[0];
  return filePath ? { filePath } : null;
});

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
  });
  return result;
});

ipcMain.handle('dialog:saveFile', async (_event, options?: { defaultPath?: string; filters?: any[] }) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: options?.defaultPath || 'untitled',
    filters: options?.filters || [
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  if (result.canceled) return null;
  return { filePath: result.filePath };
});

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:writeBinary', async (_event, filePath: string, base64Data: string) => {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:downloadToFile', async (_event, url: string, filePath: string) => {
  try {
    const https = require('https');
    const http = require('http');
    const protocol = url.startsWith('https') ? https : http;

    return new Promise((resolve) => {
      protocol.get(url, (response: any) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          // 跟随重定向
          const redirectUrl = response.headers.location;
          const redirectProtocol = redirectUrl.startsWith('https') ? https : http;
          redirectProtocol.get(redirectUrl, (redirectRes: any) => {
            const chunks: Buffer[] = [];
            redirectRes.on('data', (chunk: Buffer) => chunks.push(chunk));
            redirectRes.on('end', () => {
              fs.writeFileSync(filePath, Buffer.concat(chunks));
              resolve({ success: true });
            });
          }).on('error', (e: any) => resolve({ success: false, error: e.message }));
        } else {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => {
            fs.writeFileSync(filePath, Buffer.concat(chunks));
            resolve({ success: true });
          });
        }
      }).on('error', (e: any) => resolve({ success: false, error: e.message }));
    });
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:readDir', async (_event, dirPath: string) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return {
      success: true,
      entries: entries.map(e => ({
        name: e.name,
        isDirectory: e.isDirectory(),
        isFile: e.isFile(),
      })),
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:stat', async (_event, filePath: string) => {
  try {
    const stat = fs.statSync(filePath);
    return { success: true, size: stat.size, mtime: stat.mtimeMs };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:deleteFile', async (_event, filePath: string) => {
  try {
    fs.unlinkSync(filePath);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:deleteDir', async (_event, dirPath: string) => {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:createDir', async (_event, dirPath: string) => {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:createFile', async (_event, filePath: string) => {
  try {
    fs.writeFileSync(filePath, '', 'utf-8');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('fs:exists', async (_event, filePath: string) => {
  return fs.existsSync(filePath);
});

ipcMain.handle('fs:getUserHome', async () => {
  return os.homedir();
});

ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
  shell.openPath(filePath);
});

// ==================== 语音识别 (Groq Whisper API) ====================
// 语音识别在渲染进程直接调用 Groq API，主进程仅提供 IPC 通知

// 获取根驱动器列表 (Windows)
ipcMain.handle('fs:getDrives', async () => {
  const drives: string[] = [];
  for (let i = 65; i <= 90; i++) {
    const drive = String.fromCharCode(i) + ':\\';
    if (fs.existsSync(drive)) {
      drives.push(drive);
    }
  }
  return drives;
});

// ==================== 终端 IPC ====================

ipcMain.handle('terminal:create', async (_event, cwd: string) => {
  killTerminal();
  try {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    terminalProcess = spawn(shell, [], {
      cwd: cwd || os.homedir(),
      env: { ...process.env, TERM: 'xterm-256color' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    terminalProcess.stdout?.on('data', (data: Buffer) => {
      mainWindow?.webContents.send('terminal:data', data.toString());
    });

    terminalProcess.stderr?.on('data', (data: Buffer) => {
      mainWindow?.webContents.send('terminal:data', data.toString());
    });

    terminalProcess.on('exit', (code) => {
      mainWindow?.webContents.send('terminal:exit', code);
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.on('terminal:write', (_event, data: string) => {
  if (terminalProcess?.stdin?.writable) {
    terminalProcess.stdin.write(data);
  }
});

ipcMain.on('terminal:resize', (_event, cols: number, rows: number) => {
  // PTY resize would go here if using node-pty
});

ipcMain.handle('terminal:kill', async () => {
  killTerminal();
  return { success: true };
});

// ==================== 图片/文件预览 ====================

ipcMain.handle('fs:readBinary', async (_event, filePath: string) => {
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.bmp': 'image/bmp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.avi': 'video/x-msvideo',
      '.glb': 'model/gltf-binary',
      '.gltf': 'model/gltf+json',
      '.obj': 'model/obj',
      '.stl': 'model/stl',
      '.fbx': 'application/octet-stream',
    };
    const mimeType = mimeMap[ext] || 'application/octet-stream';
    return {
      success: true,
      data: data.toString('base64'),
      mimeType,
      size: data.length,
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

// ==================== Agent 工具 IPC ====================

// Agent 执行命令（非交互式，返回输出）
ipcMain.handle('agent:executeCommand', async (_event, command: string, cwd?: string) => {
  return new Promise((resolve) => {
    const workDir = cwd || process.cwd();
    const timeout = 60000; // 60秒超时
    const child = exec(command, {
      cwd: workDir,
      maxBuffer: 1024 * 1024, // 1MB
      timeout,
      shell: process.platform === 'win32' ? 'powershell.exe' : 'bash',
    }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: true, // 即使命令失败也返回结果
          stdout: stdout || '',
          stderr: stderr || error.message || '',
          exitCode: error.killed ? -1 : (error as any).code || 1,
        });
      } else {
        resolve({
          success: true,
          stdout: stdout || '',
          stderr: stderr || '',
          exitCode: 0,
        });
      }
    });
  });
});

// Agent 搜索代码
ipcMain.handle('agent:searchCode', async (_event, options: { pattern: string; directory?: string; fileTypes?: string }) => {
  try {
    const searchDir = options.directory || process.cwd();
    const pattern = options.pattern;
    const extFilter = options.fileTypes || '';

    if (!fs.existsSync(searchDir)) {
      return { success: false, error: `目录不存在: ${searchDir}` };
    }

    const results: string[] = [];
    const regex = new RegExp(pattern, 'i');

    function walk(dir: string, depth: number) {
      if (depth > 5) return; // 限制深度
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          // 跳过 node_modules, .git, dist
          if (entry.isDirectory()) {
            if (['node_modules', '.git', 'dist', '.electron-data', 'build'].includes(entry.name)) continue;
            walk(fullPath, depth + 1);
          } else if (entry.isFile()) {
            // 文件类型过滤
            if (extFilter) {
              const exts = extFilter.split(',').map(e => e.trim());
              const fileExt = path.extname(entry.name);
              if (!exts.includes(fileExt)) continue;
            }
            // 跳过二进制文件
            const ext = path.extname(entry.name).toLowerCase();
            const skipExts = ['.exe', '.dll', '.png', '.jpg', '.ico', '.bin', '.obj', '.o', '.so', '.dylib'];
            if (skipExts.includes(ext)) continue;

            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              const lines = content.split('\n');
              lines.forEach((line, idx) => {
                if (regex.test(line)) {
                  const relPath = path.relative(searchDir, fullPath);
                  results.push(`${relPath}:${idx + 1}: ${line.trim().slice(0, 200)}`);
                }
              });
            } catch {
              // skip unreadable files
            }
          }
        }
      } catch {
        // skip unreadable directories
      }
    }

    walk(searchDir, 0);
    return { success: true, matches: results };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('app:getVersion', async () => {
  return app.getVersion();
});

ipcMain.handle('app:getPath', async (_event, name: string) => {
  return app.getPath(name as any);
});

// ==================== 安全/审计/验证/路由 IPC ====================

// 危险命令检查
ipcMain.handle('safety:checkCommand', async (_event, command: string, workspaceRoot?: string) => {
  return checkCommand(command, workspaceRoot);
});

// 带检查的命令执行（危险命令会被拒绝）
ipcMain.handle('safety:executeCommand', async (_event, command: string, cwd?: string, workspaceRoot?: string) => {
  const check = checkCommand(command, workspaceRoot);

  if (check.risk === 'forbidden') {
    audit.log('command.blocked', `禁止命令: ${command.slice(0, 100)}`, check);
    return {
      success: false,
      blocked: true,
      risk: check.risk,
      reason: check.reason,
      suggestion: check.suggestion,
      message: `⛔ 命令被安全策略阻止：${check.reason}\n\n${check.suggestion || ''}`,
    };
  }

  // 可疑命令：执行但记录
  if (check.risk === 'suspicious') {
    audit.log('command.executed', `可疑命令: ${command.slice(0, 100)}`, check);
  }

  // 复用原有 exec 逻辑（这里简化调用，由 renderer 调 agent:executeCommand）
  return { success: true, risk: check.risk, reason: check.reason };
});

// 文件写入后自动验证
ipcMain.handle('verifier:checkFile', async (_event, filePath: string) => {
  const result = await verifyFile(filePath);
  if (result.level === 'error') {
    audit.log('verify.failed', `${filePath}: ${result.message}`, result);
  } else if (result.level === 'ok') {
    audit.log('verify.passed', filePath, result);
  }
  return result;
});

// 批量验证
ipcMain.handle('verifier:checkFiles', async (_event, filePaths: string[]) => {
  const results = await verifyFiles(filePaths);
  return results.map(r => formatVerifyResult(r));
});

// 任务复杂度路由
ipcMain.handle('router:route', async (_event, prompt: string, availableModels: string[]) => {
  return routeRequest(prompt, availableModels);
});

// 审计日志
ipcMain.handle('audit:list', async (_event, kindFilter?: string, limit: number = 50) => {
  return audit.recent(kindFilter as AuditEventKind | undefined, limit);
});

ipcMain.handle('audit:log', async (_event, kind: AuditEventKind, summary: string, details?: any) => {
  audit.log(kind, summary, details);
  return { success: true };
});

ipcMain.handle('audit:size', async () => {
  return audit.size();
});

ipcMain.handle('audit:clear', async () => {
  audit.clear();
  return { success: true };
});

// 默认模型预设（Key 通过 .env 注入，不在源码中硬编码）
const DEFAULT_MODEL_PRESETS = [
  {
    id: 'model-1781391826050',
    name: 'Agnes 2.0 Flash (快速)',
    provider: 'agnes',
    apiUrl: 'https://apihub.agnes-ai.com/v1/chat/completions',
    apiKey: process.env.AGNES_API_KEY || '',
    modelName: 'agnes-2.0-flash',
    maxTokens: 65536,
    temperature: 0.7,
    isActive: true,
    strength: 'high',
  },
  {
    id: 'model-1781392539882',
    name: 'Agnes Image 2.1 Flash (图片)',
    provider: 'agnes',
    apiUrl: 'https://apihub.agnes-ai.com/v1/images/generations',
    apiKey: process.env.AGNES_API_KEY || '',
    modelName: 'agnes-image-2.1-flash',
    maxTokens: 4096,
    temperature: 0.7,
    isActive: false,
    strength: 'high',
  },
  {
    id: 'model-1781394996409',
    name: 'Agnes Video V2.0 (视频)',
    provider: 'agnes',
    apiUrl: 'https://apihub.agnes-ai.com/v1/videos',
    apiKey: process.env.AGNES_API_KEY || '',
    modelName: 'agnes-video-v2.0',
    maxTokens: 4096,
    temperature: 0.7,
    isActive: false,
    strength: 'high',
  },
  {
    id: 'model-1781427761607',
    name: 'GitHub Models GPT-4o Mini (免费)',
    provider: 'github',
    apiUrl: 'https://models.inference.ai.azure.com/chat/completions',
    apiKey: process.env.GITHUB_TOKEN || '',
    modelName: 'gpt-4o-mini',
    maxTokens: 4096,
    temperature: 0.7,
    isActive: false,
    strength: 'high',
  },
  {
    id: 'model-1781428594851',
    name: 'Groq Llama 3.3 70B (快速)',
    provider: 'groq',
    apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: process.env.GROQ_API_KEY || '',
    modelName: 'llama-3.3-70b-versatile',
    maxTokens: 4096,
    temperature: 0.7,
    isActive: false,
    strength: 'high',
  },
];

ipcMain.handle('models:resetToDefaults', async () => {
  return { success: true, models: DEFAULT_MODEL_PRESETS };
});

ipcMain.handle('models:getDefaults', async () => {
  return DEFAULT_MODEL_PRESETS;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  killTerminal();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  killTerminal();
});