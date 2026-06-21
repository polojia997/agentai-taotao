import React, { useCallback, useEffect, useState } from 'react';
import { useStore, store } from '../store';
import { FileEntry } from '../types';

const FILE_ICONS: Record<string, string> = {
  ts: '🟦', tsx: '⚛', js: '🟨', jsx: '⚛',
  py: '🐍', java: '☕', go: '🔵', rs: '🦀',
  cpp: '🔧', c: '🔧', h: '🔧',
  html: '🌐', css: '🎨', scss: '🎨',
  json: '📋', xml: '📋', yaml: '📋', yml: '📋',
  md: '📝', txt: '📃', log: '📃',
  png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼', svg: '🖼', webp: '🖼',
  mp4: '🎬', mov: '🎬', avi: '🎬', webm: '🎬',
  glb: '🧊', gltf: '🧊', obj: '🧊', stl: '🧊',
  env: '🔒', gitignore: '⚙',
  sh: '💻', bat: '💻', ps1: '💻',
  zip: '📦', tar: '📦', gz: '📦',
};

function getFileIcon(name: string, isDir: boolean): string {
  if (isDir) return '📁';
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || '📄';
}

function getFileType(name: string): 'code' | 'image' | 'video' | 'model' {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return 'video';
  if (['glb', 'gltf', 'obj', 'stl', 'fbx'].includes(ext)) return 'model';
  return 'code';
}

async function loadDirectory(dirPath: string): Promise<FileEntry[]> {
  const { ipcRenderer } = window.require('electron');
  const result = await ipcRenderer.invoke('fs:readDir', dirPath);
  if (!result.success) return [];

  const entries: FileEntry[] = result.entries
    .filter((e: any) => !e.name.startsWith('.') || e.name === '.env')
    .map((e: any) => ({
      name: e.name,
      path: `${dirPath}\\${e.name}`,
      isDirectory: e.isDirectory,
      isFile: e.isFile,
    }))
    .sort((a: FileEntry, b: FileEntry) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return entries;
}

const FileExplorer: React.FC = () => {
  const state = useStore();
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [dirChildren, setDirChildren] = useState<Record<string, FileEntry[]>>({});

  useEffect(() => {
    if (state.currentDir) {
      loadDirectory(state.currentDir).then(entries => {
        store.setFileTree(entries);
      });
    }
  }, [state.currentDir]);

  const handleToggleDir = useCallback(async (dirPath: string) => {
    if (expandedDirs.has(dirPath)) {
      setExpandedDirs(prev => {
        const next = new Set(prev);
        next.delete(dirPath);
        return next;
      });
    } else {
      const children = await loadDirectory(dirPath);
      setDirChildren(prev => ({ ...prev, [dirPath]: children }));
      setExpandedDirs(prev => new Set(prev).add(dirPath));
    }
  }, [expandedDirs]);

  const handleFileClick = useCallback((entry: FileEntry) => {
    if (entry.isDirectory) {
      handleToggleDir(entry.path);
      return;
    }

    const type = getFileType(entry.name);
    const tabId = `tab-${entry.path}`;

    store.openTab({
      id: tabId,
      path: entry.path,
      name: entry.name,
      type,
      isDirty: false,
    });
  }, [handleToggleDir]);

  const renderTree = (entries: FileEntry[], depth: number = 0) => {
    return entries.map(entry => {
      const isExpanded = expandedDirs.has(entry.path);
      const children = dirChildren[entry.path] || [];

      return (
        <React.Fragment key={entry.path}>
          <div
            className="file-tree-item"
            style={{ '--depth': depth } as React.CSSProperties}
            onClick={() => handleFileClick(entry)}
          >
            <span className="file-tree-icon">
              {getFileIcon(entry.name, entry.isDirectory)}
            </span>
            <span className="file-tree-name">{entry.name}</span>
          </div>
          {entry.isDirectory && isExpanded && children.length > 0 && (
            renderTree(children, depth + 1)
          )}
        </React.Fragment>
      );
    });
  };

  const drives = state.currentDir ? [] : ['C:\\', 'D:\\', 'E:\\', 'F:\\', 'G:\\'];

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <button
          className="file-explorer-btn"
          onClick={async () => {
            const { ipcRenderer } = window.require('electron');
            const result = await ipcRenderer.invoke('dialog:openFolder');
            if (!result.canceled && result.filePaths.length > 0) {
              store.setCurrentDir(result.filePaths[0]);
            }
          }}
          title="打开文件夹"
        >
          📂
        </button>
        <button
          className="file-explorer-btn"
          onClick={async () => {
            const { ipcRenderer } = window.require('electron');
            const home = await ipcRenderer.invoke('fs:getUserHome');
            store.setCurrentDir(home);
          }}
          title="主目录"
        >
          🏠
        </button>
        <span className="file-explorer-path">
          {state.currentDir || '未打开文件夹'}
        </span>
      </div>

      <div className="file-tree">
        {!state.currentDir ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>尚未打开文件夹</div>
            <button
              className="topbar-btn"
              style={{ marginTop: 8 }}
              onClick={async () => {
                const { ipcRenderer } = window.require('electron');
                const result = await ipcRenderer.invoke('dialog:openFolder');
                if (!result.canceled && result.filePaths.length > 0) {
                  store.setCurrentDir(result.filePaths[0]);
                }
              }}
            >
              打开文件夹
            </button>
          </div>
        ) : (
          renderTree(state.fileTree)
        )}
      </div>
    </div>
  );
};

export default FileExplorer;