import React, { useState } from 'react';
import { t } from '../i18n';

interface DonateModalProps {
  onClose: () => void;
}

const DonateModal: React.FC<DonateModalProps> = ({ onClose }) => {
  const [tab, setTab] = useState<'wechat' | 'alipay'>('wechat');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-donate" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('donate.title')}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p className="donate-intro">{t('donate.intro')}</p>

          <div className="donate-tabs">
            <button
              className={`donate-tab ${tab === 'wechat' ? 'active' : ''}`}
              onClick={() => setTab('wechat')}
            >
              💚 {t('donate.wechat')}
            </button>
            <button
              className={`donate-tab ${tab === 'alipay' ? 'active' : ''}`}
              onClick={() => setTab('alipay')}
            >
              💙 {t('donate.alipay')}
            </button>
          </div>

          <div className="donate-qr">
            {tab === 'wechat' ? (
              <div className="donate-qr-placeholder">
                <div className="donate-qr-icon">💚</div>
                <div className="donate-qr-text">{t('donate.wechat')}</div>
                <img
                  src="./assets/donate/wechat.png"
                  alt="WeChat Pay"
                  className="donate-qr-image"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="donate-qr-fallback">
                  请将微信收款码放到<br/>
                  <code>assets/donate/wechat.png</code>
                </div>
              </div>
            ) : (
              <div className="donate-qr-placeholder">
                <div className="donate-qr-icon">💙</div>
                <div className="donate-qr-text">{t('donate.alipay')}</div>
                <img
                  src="./assets/donate/alipay.png"
                  alt="Alipay"
                  className="donate-qr-image"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="donate-qr-fallback">
                  请将支付宝收款码放到<br/>
                  <code>assets/donate/alipay.png</code>
                </div>
              </div>
            )}
          </div>

          <p className="donate-thanks">{t('donate.thanks')}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
};

export default DonateModal;
