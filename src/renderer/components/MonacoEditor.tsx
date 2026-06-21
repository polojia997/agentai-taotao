import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';

interface MonacoEditorProps {
  filePath: string;
  diffMode?: boolean;
}

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', java: 'java', go: 'go', rs: 'rust',
  cpp: 'cpp', c: 'c', h: 'c', cs: 'csharp',
  html: 'html', css: 'css', scss: 'scss', less: 'less',
  json: 'json', xml: 'xml', yaml: 'yaml', yml: 'yaml',
  md: 'markdown', sql: 'sql', sh: 'shell', bat: 'shell', ps1: 'shell',
};

function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return LANGUAGE_MAP[ext] || 'plaintext';
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({ filePath, diffMode = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // 读取文件内容
  useEffect(() => {
    const loadFile = async () => {
      setLoading(true);
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('fs:readFile', filePath);
      if (result.success) {
        setContent(result.content);
      } else {
        setContent(`// 无法读取文件: ${result.error}`);
      }
      setLoading(false);
    };
    loadFile();
  }, [filePath]);

  // 初始化编辑器
  useEffect(() => {
    if (!containerRef.current || loading) return;

    const lang = getLanguage(filePath);

    const editor = monaco.editor.create(containerRef.current, {
      value: content,
      language: lang,
      theme: 'vs-dark',
      fontSize: 14,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
      minimap: { enabled: true },
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      automaticLayout: true,
      scrollBeyondLastLine: false,
      tabSize: 4,
      wordWrap: 'off',
      bracketPairColorization: { enabled: true },
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      padding: { top: 8 },
    });

    editorRef.current = editor;

    // 监听内容变化，自动保存
    editor.onDidChangeModelContent(() => {
      const newContent = editor.getValue();
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.invoke('fs:writeFile', filePath, newContent);
    });

    return () => {
      editor.dispose();
    };
  }, [filePath, loading]);

  // 更新内容
  useEffect(() => {
    if (editorRef.current && content) {
      const currentVal = editorRef.current.getValue();
      if (currentVal !== content) {
        editorRef.current.setValue(content);
      }
    }
  }, [content]);

  if (loading) {
    return (
      <div className="empty-state">
        <div className="loading-dots">
          <div className="loading-dot" />
          <div className="loading-dot" />
          <div className="loading-dot" />
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="editor-container" />;
};

export default MonacoEditor;