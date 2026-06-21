import React from 'react';
import { t } from '../i18n';

interface AboutModalProps {
  onClose: () => void;
}

const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-about" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('about.title')}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="about-logo">T</div>
          <h3>TAOTAO</h3>
          <p className="about-tagline">{t('app.tagline')}</p>
          <p className="about-desc">{t('about.desc')}</p>

          <table className="about-table">
            <tbody>
              <tr>
                <td className="about-key">{t('about.version')}</td>
                <td className="about-val">1.0.0</td>
              </tr>
              <tr>
                <td className="about-key">{t('about.author')}</td>
                <td className="about-val">polojia997</td>
              </tr>
              <tr>
                <td className="about-key">{t('about.license')}</td>
                <td className="about-val">MIT</td>
              </tr>
              <tr>
                <td className="about-key">{t('about.github')}</td>
                <td className="about-val">
                  <a
                    href="https://github.com/polojia997/agentai-taotao"
                    target="_blank"
                    rel="noreferrer"
                    className="about-link"
                  >
                    github.com/polojia997/agentai-taotao
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
};

export default AboutModal;
