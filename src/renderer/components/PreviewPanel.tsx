import React, { useCallback, useEffect, useRef, useState } from 'react';

interface PreviewPanelProps {
  filePath: string;
  type: 'image' | 'video' | 'model';
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({ filePath, type }) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadPreview = async () => {
      setLoading(true);
      setError('');
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('fs:readBinary', filePath);
      if (result.success) {
        const url = `data:${result.mimeType};base64,${result.data}`;
        setDataUrl(url);
        setMimeType(result.mimeType);
      } else {
        setError(result.error);
      }
      setLoading(false);
    };
    loadPreview();
  }, [filePath]);

  const renderContent = () => {
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

    if (error) {
      return (
        <div className="empty-state">
          <div className="empty-state-icon">⚠</div>
          <div className="empty-state-text">预览失败</div>
          <div className="empty-state-hint">{error}</div>
        </div>
      );
    }

    switch (type) {
      case 'image':
        return (
          <img
            src={dataUrl}
            alt={filePath}
            className="preview-image"
            style={{ background: 'checkerboard' }}
          />
        );
      case 'video':
        return (
          <video
            src={dataUrl}
            className="preview-video"
            controls
            autoPlay={false}
          >
            您的浏览器不支持视频播放
          </video>
        );
      case 'model':
        return <ModelViewer src={dataUrl} mimeType={mimeType} />;
      default:
        return null;
    }
  };

  return (
    <div className="preview-panel">
      {renderContent()}
      <div style={{
        position: 'absolute',
        bottom: 8,
        right: 12,
        fontSize: 10,
        color: 'var(--text-muted)',
        background: 'var(--bg-primary)',
        padding: '2px 8px',
        borderRadius: 'var(--radius-sm)',
      }}>
        {filePath}
      </div>
    </div>
  );
};

// 简单的 3D 模型查看器 (使用 Three.js 风格的占位)
const ModelViewer: React.FC<{ src: string; mimeType: string }> = ({ src, mimeType }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="preview-model" style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ fontSize: 48 }}>🧊</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>3D 模型预览</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
          格式: {mimeType}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
          可以使用鼠标旋转/缩放模型（完整3D渲染请安装 Three.js）
        </div>
      </div>
    </div>
  );
};

export default PreviewPanel;