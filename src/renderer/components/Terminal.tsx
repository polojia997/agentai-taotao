import React, { useCallback, useEffect, useRef } from 'react';
import { useStore, store } from '../store';

// 使用 xterm.js 的简易封装 (如果没有 node-pty，使用模拟终端)
const Terminal: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const [output, setOutput] = React.useState<string[]>([]);
  const [input, setInput] = React.useState('');
  const [isRunning, setIsRunning] = React.useState(false);

  const startTerminal = useCallback(async () => {
    const { ipcRenderer } = window.require('electron');
    const cwd = store.getState().currentDir || '';
    const result = await ipcRenderer.invoke('terminal:create', cwd);
    if (result.success) {
      setIsRunning(true);
      setOutput([]);
    }
  }, []);

  const stopTerminal = useCallback(async () => {
    const { ipcRenderer } = window.require('electron');
    await ipcRenderer.invoke('terminal:kill');
    setIsRunning(false);
  }, []);

  const sendCommand = useCallback(() => {
    if (!input.trim()) return;
    const { ipcRenderer } = window.require('electron');
    ipcRenderer.send('terminal:write', input + '\r\n');
    setOutput(prev => [...prev, `> ${input}`]);
    setInput('');

    // 模拟输出
    setTimeout(() => {
      setOutput(prev => [...prev, `  命令已发送到终端`]);
    }, 500);
  }, [input]);

  // 监听终端数据
  useEffect(() => {
    const { ipcRenderer } = window.require('electron');

    const handleData = (_event: any, data: string) => {
      setOutput(prev => [...prev, data]);
    };

    const handleExit = (_event: any, code: number) => {
      setOutput(prev => [...prev, `\n[进程退出, 退出码: ${code}]`]);
      setIsRunning(false);
    };

    ipcRenderer.on('terminal:data', handleData);
    ipcRenderer.on('terminal:exit', handleExit);

    return () => {
      ipcRenderer.removeListener('terminal:data', handleData);
      ipcRenderer.removeListener('terminal:exit', handleExit);
    };
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="terminal-container">
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 8px',
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {isRunning ? '🟢 终端运行中' : '⚪ 终端未启动'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {store.getState().currentDir || '~'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {!isRunning ? (
            <button className="topbar-btn" onClick={startTerminal} style={{ fontSize: 11 }}>
              ▶ 启动终端
            </button>
          ) : (
            <button className="topbar-btn" onClick={stopTerminal} style={{ fontSize: 11 }}>
              ⏹ 停止
            </button>
          )}
          <button className="topbar-btn" onClick={() => setOutput([])} style={{ fontSize: 11 }}>
            🗑 清空
          </button>
        </div>
      </div>

      <div
        ref={outputRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '4px 8px',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          height: 'calc(100% - 56px)',
        }}
      >
        {output.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: 8 }}>
            终端就绪。点击"启动终端"开始，或直接在下方输入命令。
          </div>
        ) : (
          output.map((line, i) => (
            <div key={i} style={{ lineHeight: 1.5 }}>
              {line.startsWith('> ') ? (
                <span style={{ color: 'var(--accent-success)' }}>{line}</span>
              ) : (
                <span>{line}</span>
              )}
            </div>
          ))
        )}
      </div>

      <div style={{
        display: 'flex',
        gap: 4,
        padding: '4px 8px',
        background: 'var(--bg-primary)',
        borderTop: '1px solid var(--border-color)',
      }}>
        <span style={{ color: 'var(--accent-success)', fontSize: 12, lineHeight: '28px' }}>$</span>
        <input
          ref={inputRef}
          className="chat-input"
          style={{
            flex: 1,
            minHeight: 28,
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            padding: '4px 8px',
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              sendCommand();
            }
          }}
          placeholder={isRunning ? '输入命令...' : '终端未启动'}
          disabled={!isRunning}
        />
      </div>
    </div>
  );
};

export default Terminal;