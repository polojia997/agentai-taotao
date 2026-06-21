import React, { useCallback, useState } from 'react';
import { useStore, store } from '../store';

const SearchPanel: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ path: string; line: number; content: string }>>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);

    const currentDir = store.getState().currentDir;
    if (!currentDir) {
      store.addToast({ type: 'error', message: '请先打开一个文件夹' });
      setSearching(false);
      return;
    }

    // 简易搜索：递归遍历目录搜索文件内容
    const searchInDir = async (dir: string): Promise<Array<{ path: string; line: number; content: string }>> => {
      const results: Array<{ path: string; line: number; content: string }> = [];
      const { ipcRenderer } = window.require('electron');

      try {
        const dirResult = await ipcRenderer.invoke('fs:readDir', dir);
        if (!dirResult.success) return results;

        for (const entry of dirResult.entries) {
          const fullPath = `${dir}\\${entry.name}`;

          // 跳过隐藏文件和 node_modules
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;

          if (entry.isDirectory) {
            const subResults = await searchInDir(fullPath);
            results.push(...subResults);
          } else if (entry.isFile) {
            // 只搜索文本文件
            const textExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '.c', '.cpp',
              '.html', '.css', '.json', '.md', '.txt', '.yaml', '.yml', '.xml', '.sh'];
            const ext = '.' + (entry.name.split('.').pop()?.toLowerCase() || '');
            if (textExts.includes(ext)) {
              try {
                const fileResult = await ipcRenderer.invoke('fs:readFile', fullPath);
                if (fileResult.success) {
                  const lines = fileResult.content.split('\n');
                  lines.forEach((line: string, idx: number) => {
                    if (line.toLowerCase().includes(query.toLowerCase())) {
                      results.push({
                        path: fullPath,
                        line: idx + 1,
                        content: line.trim().substring(0, 100),
                      });
                    }
                  });
                }
              } catch {
                // skip unreadable files
              }
            }
          }

          // 限制结果数量
          if (results.length > 200) break;
        }
      } catch {
        // skip
      }

      return results;
    };

    const found = await searchInDir(currentDir);
    setResults(found.slice(0, 200));
    setSearching(false);

    if (found.length === 0) {
      store.addToast({ type: 'info', message: `未找到 "${query}"` });
    }
  }, [query]);

  const handleOpenResult = useCallback((result: { path: string; line: number; content: string }) => {
    const name = result.path.split('\\').pop() || 'file';
    store.openTab({
      id: `tab-${result.path}`,
      path: result.path,
      name,
      type: 'code',
      isDirty: false,
    });
  }, []);

  return (
    <div className="search-panel">
      <div className="search-input-wrapper">
        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch();
          }}
          placeholder="搜索文件内容..."
        />
        <span className="search-input-icon" onClick={handleSearch} style={{ cursor: 'pointer' }}>
          🔍
        </span>
      </div>

      {searching ? (
        <div className="empty-state" style={{ padding: 20 }}>
          <div className="loading-dots">
            <div className="loading-dot" />
            <div className="loading-dot" />
            <div className="loading-dot" />
          </div>
          <div className="empty-state-hint">搜索中...</div>
        </div>
      ) : results.length > 0 ? (
        <div className="search-results">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
            找到 {results.length} 个结果
          </div>
          {results.map((r, i) => (
            <div
              key={i}
              className="search-result-item"
              onClick={() => handleOpenResult(r)}
            >
              <div style={{ fontWeight: 600 }}>
                {r.path.split('\\').pop()} : {r.line}
              </div>
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.content}
              </div>
              <div className="search-result-path">{r.path}</div>
            </div>
          ))}
        </div>
      ) : query ? (
        <div className="empty-state" style={{ padding: 20 }}>
          <div className="empty-state-hint">按 Enter 开始搜索</div>
        </div>
      ) : (
        <div className="empty-state" style={{ padding: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div className="empty-state-text">搜索文件内容</div>
          <div className="empty-state-hint">在项目目录中搜索</div>
        </div>
      )}
    </div>
  );
};

export default SearchPanel;