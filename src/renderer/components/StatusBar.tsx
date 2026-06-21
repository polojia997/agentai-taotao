import React from 'react';
import { useStore } from '../store';

const StatusBar: React.FC = () => {
  const state = useStore();
  const activeModel = state.models.find(m => m.id === state.activeModelId);

  return (
    <div className="statusbar">
      <div className="statusbar-item">
        <span style={{ color: state.currentDir ? 'var(--accent-success)' : 'var(--text-muted)' }}>
          {state.currentDir ? '📁' : '📂'}
        </span>
        <span>{state.currentDir ? state.currentDir.split('\\').pop() : '未打开文件夹'}</span>
      </div>

      <div className="statusbar-item">
        <span>🤖</span>
        <span style={{ color: activeModel ? 'var(--accent-success)' : 'var(--text-muted)' }}>
          {activeModel ? activeModel.name : '未激活模型'}
        </span>
      </div>

      <div className="statusbar-spacer" />

      <div className="statusbar-item">
        <span>{state.openTabs.length} 个标签</span>
      </div>

      <div className="statusbar-item">
        <span>TAOTAO v1.0.0</span>
      </div>
    </div>
  );
};

export default StatusBar;