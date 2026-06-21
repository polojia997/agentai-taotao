// ========== 代码自动验证模块 ==========
// 改完文件自动跑语法检查，错误回灌到 LLM

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execFileAsync = promisify(execFile);

export type VerifyKind = 'syntax' | 'type' | 'lint' | 'test';
export type VerifyLevel = 'ok' | 'warning' | 'error';

export interface VerifyResult {
  filePath: string;
  kind: VerifyKind;
  level: VerifyLevel;
  message: string;
  details?: string;
  durationMs: number;
}

// 工具链检测（避免反复调用不存在的工具）
const toolAvailable: Record<string, boolean> = {};
async function hasTool(name: string): Promise<boolean> {
  if (name in toolAvailable) return toolAvailable[name];
  try {
    await execFileAsync(name, ['--version'], { timeout: 3000 });
    toolAvailable[name] = true;
  } catch {
    toolAvailable[name] = false;
  }
  return toolAvailable[name];
}

// 简单的 Node.js / Python / JSON 语法检查
async function verifySyntax(filePath: string): Promise<VerifyResult> {
  const start = Date.now();
  const ext = path.extname(filePath).toLowerCase();

  try {
    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
      await execFileAsync('node', ['--check', filePath], { timeout: 8000 });
    } else if (ext === '.ts' || ext === '.tsx') {
      if (await hasTool('tsc')) {
        await execFileAsync('tsc', ['--noEmit', '--allowJs', '--skipLibCheck', filePath], { timeout: 15000 });
      } else {
        return {
          filePath, kind: 'syntax', level: 'warning',
          message: 'TypeScript 编译器 (tsc) 未安装，跳过语法检查',
          durationMs: Date.now() - start,
        };
      }
    } else if (ext === '.py') {
      await execFileAsync('python', ['-m', 'py_compile', filePath], { timeout: 8000 });
    } else if (ext === '.json') {
      JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } else if (ext === '.jsonc') {
      const content = fs.readFileSync(filePath, 'utf-8');
      // 去掉注释
      const stripped = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      JSON.parse(stripped);
    } else {
      return {
        filePath, kind: 'syntax', level: 'warning',
        message: `不支持的文件类型：${ext}`,
        durationMs: Date.now() - start,
      };
    }

    return {
      filePath, kind: 'syntax', level: 'ok',
      message: '语法检查通过',
      durationMs: Date.now() - start,
    };
  } catch (e: any) {
    return {
      filePath, kind: 'syntax', level: 'error',
      message: '语法错误',
      details: e.stderr || e.stdout || e.message,
      durationMs: Date.now() - start,
    };
  }
}

export async function verifyFile(filePath: string, kind: VerifyKind = 'syntax'): Promise<VerifyResult> {
  if (!fs.existsSync(filePath)) {
    return {
      filePath, kind, level: 'error',
      message: '文件不存在',
      durationMs: 0,
    };
  }

  switch (kind) {
    case 'syntax': return verifySyntax(filePath);
    case 'type': return verifySyntax(filePath); // type 检查复用 syntax
    case 'lint':
      // 简化版：依赖外部工具
      return {
        filePath, kind: 'lint', level: 'warning',
        message: 'Lint 检查需要配置 ESLint，已跳过',
        durationMs: 0,
      };
    case 'test':
      return {
        filePath, kind: 'test', level: 'warning',
        message: '测试需要项目级配置，已跳过',
        durationMs: 0,
      };
  }
}

// 批量验证
export async function verifyFiles(filePaths: string[]): Promise<VerifyResult[]> {
  const results = await Promise.all(filePaths.map(p => verifyFile(p)));
  return results;
}

// 把结果转成中文描述（供 LLM 阅读）
export function formatVerifyResult(r: VerifyResult): string {
  const icon = r.level === 'ok' ? '✅' : r.level === 'warning' ? '⚠️' : '❌';
  const label = r.level === 'ok' ? '通过' : r.level === 'warning' ? '警告' : '失败';
  let text = `${icon} [${label}] ${path.basename(r.filePath)} (${r.kind}, ${r.durationMs}ms): ${r.message}`;
  if (r.details) {
    text += `\n\`\`\`\n${r.details.slice(0, 1500)}\n\`\`\``;
  }
  return text;
}
