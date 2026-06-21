// ========== 危险命令拦截模块 ==========
// 类似 Codex 的工作空间沙箱：拦截破坏性命令

export type CommandRisk = 'safe' | 'suspicious' | 'destructive' | 'forbidden';

export interface CommandCheck {
  risk: CommandRisk;
  reason?: string;
  suggestion?: string;
}

// 危险命令黑名单（精确匹配）
const FORBIDDEN_PATTERNS: RegExp[] = [
  // 格式化/擦除磁盘
  /(^|\s|;|&&|\|\|)format\s+[a-zA-Z]:/i,
  /mkfs(\.[a-z0-9]+)?\s/i,
  /dd\s+if=.*of=\/dev\/(sd|hd|nvme|disk)/i,
  // 递归删除根目录或系统目录
  /rm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+|-[a-zA-Z]*f[a-zA-Z]*\s+|.*-rf\s+)*\//i,
  /rm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+|-[a-zA-Z]*f[a-zA-Z]*\s+|.*-rf\s+)*\/(boot|etc|usr|var|lib|sbin|bin|opt)(\/|\s|$)/i,
  /rmdir\s+\/(boot|etc|usr|var|lib|sbin|bin|opt)\b/i,
  /del\s+\/[a-zA-Z]:?\\?(windows|program\s*files|users|system32)/i,
  // 远程代码执行
  /curl\s+.*\|\s*(sudo\s+)?(ba)?sh/i,
  /wget\s+.*\|\s*(sudo\s+)?(ba)?sh/i,
  /curl\s+.*\|\s*python/i,
  /curl\s+-o\s+\/etc\//i,
  // 系统破坏
  /shutdown(\.exe)?\s/,
  /reboot(\.exe)?\s/,
  /poweroff(\.exe)?\s/,
  /init\s+[0-6]\b/,
  /halt\s/,
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,  // fork 炸弹
  // 注册表破坏（Windows）
  /reg\s+delete\s+.*HKEY_(LOCAL_MACHINE|CLASSES_ROOT|CURRENT_USER)/i,
  /regedit\s+\/s\s+/i,
  // bcdedit/bootrec
  /bcdedit\s+\/delete/i,
  /bootrec\s+\/fixmbr/i,
  // PowerShell 危险
  /Remove-Item\s+.*-Recurse.*-Force.*[\/\\](Windows|Program\s*Files)/i,
  /Clear-Disk\s/,
  /Initialize-Disk\s/,
  // 网络嗅探/MITM
  /arpspoof\s/,
  /ettercap\s+/,
  // 数据库破坏
  /DROP\s+(DATABASE|SCHEMA)\s+/i,
  /TRUNCATE\s+/i,
];

// 可疑命令（需要用户确认）
const SUSPICIOUS_PATTERNS: RegExp[] = [
  /sudo\s+/,
  /chmod\s+(777|666)\s/,
  /chown\s+.*\//,
  /rm\s+(-[a-zA-Z]*r|-[a-zA-Z]*f)/i,
  /npm\s+(uninstall|rm)\s+-g/,
  /pip\s+uninstall\s+/,
  /git\s+push\s+.*--force/,
  /git\s+reset\s+--hard/,
  /git\s+clean\s+-fd/,
  /kill\s+-9\s+/,
  /taskkill\s+\/f\s+\/im/,
  /sc\s+(delete|stop)\s+/i,
  /net\s+user\s+.*\s+\/delete/i,
  /netsh\s+.*delete/,
  // 网络出站
  /curl\s+http/,
  /wget\s+http/,
  /Invoke-WebRequest/,
];

// 工作空间逃逸检测
const ESCAPE_PATTERNS: RegExp[] = [
  /(cd|chdir)\s+\/etc\b/i,
  /(cd|chdir)\s+\/boot\b/i,
  /(cd|chdir)\s+\/var\b/i,
  /(cd|chdir)\s+[A-Z]:\\Windows/i,
  /(cd|chdir)\s+[A-Z]:\\Program\s*Files/i,
  />\s*\/etc\//,
  />\s*\/boot\//,
  />\s*\/var\//,
  />\s*[A-Z]:\\Windows\\/,
];

export function checkCommand(command: string, workspaceRoot?: string): CommandCheck {
  if (!command || !command.trim()) {
    return { risk: 'safe' };
  }

  const normalized = command.trim();

  // 1. 禁止命令（硬拦截）
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        risk: 'forbidden',
        reason: `检测到禁止执行的命令模式：${pattern.source}`,
        suggestion: '此命令会破坏系统，已被安全策略阻止。',
      };
    }
  }

  // 2. 逃逸检测
  for (const pattern of ESCAPE_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        risk: 'forbidden',
        reason: `检测到工作空间逃逸：${pattern.source}`,
        suggestion: '请勿访问工作空间之外的系统目录。',
      };
    }
  }

  // 3. 可疑命令（需要确认）
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        risk: 'suspicious',
        reason: `可疑命令：${pattern.source}`,
        suggestion: '请确认你真的要执行此操作。',
      };
    }
  }

  // 4. 检查工作空间边界（如果提供了）
  if (workspaceRoot) {
    const cwdMatch = normalized.match(/(?:^|\s|;|&&)(?:cd|chdir)\s+["']?([^\s"']+)/i);
    if (cwdMatch) {
      const target = cwdMatch[1];
      // 绝对路径且不在工作空间内
      if ((target.includes('/') || target.includes('\\')) && !target.startsWith(workspaceRoot)) {
        return {
          risk: 'suspicious',
          reason: `切换到工作空间外目录：${target}`,
          suggestion: '建议保持在工作空间内操作。',
        };
      }
    }
  }

  return { risk: 'safe' };
}

// 风险等级的中文描述
export function describeRisk(risk: CommandRisk): string {
  switch (risk) {
    case 'safe': return '安全';
    case 'suspicious': return '可疑';
    case 'destructive': return '破坏性';
    case 'forbidden': return '禁止';
  }
}
