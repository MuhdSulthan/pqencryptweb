import React from 'react';

export function SecurityModal({ quantumSecurity, onClose }) {
  if (!quantumSecurity) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="security-modal" onClick={e => e.stopPropagation()}>
        <div className="security-header">
          <h2>🛡️ Quantum Cryptography Security</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        <div className="security-content">
          <div className="security-info-grid">
            <div className="security-item">
              <h3>🔐 Current Algorithm</h3>
              <p>{quantumSecurity.currentAlgorithm}</p>
            </div>
            <div className="security-item">
              <h3>🔄 Previous Algorithm</h3>
              <p>{quantumSecurity.previousAlgorithm}</p>
            </div>
            <div className="security-item">
              <h3>⚛️ Quantum Resistance</h3>
              <p>{quantumSecurity.quantumResistance}</p>
            </div>
            <div className="security-item">
              <h3>📊 NIST Security Level</h3>
              <p>Level {quantumSecurity.nistSecurityLevel} (Highest)</p>
            </div>
            <div className="security-item">
              <h3>🔑 Key Size</h3>
              <p>{quantumSecurity.keySize.total}</p>
            </div>
            <div className="security-item">
              <h3>🛡️ Protection</h3>
              <p>{quantumSecurity.protection}</p>
            </div>
          </div>
          <div className="security-comparison">
            <h3>🔒 Security Comparison</h3>
            <div className="comparison-table">
              <div className="comparison-row">
                <span>Classical Computer Attack:</span>
                <span>❌ RSA-2048: Breakable</span>
                <span>✅ ML-KEM/DSA: Unbreakable</span>
              </div>
              <div className="comparison-row">
                <span>Quantum Computer Attack:</span>
                <span>❌ RSA-2048: Broken (Shor's)</span>
                <span>✅ ML-KEM/DSA: Protected</span>
              </div>
              <div className="comparison-row">
                <span>Future-Proof:</span>
                <span>❌ RSA-2048: Not future-proof</span>
                <span>✅ ML-KEM/DSA: Future-proof</span>
              </div>
            </div>
          </div>
          <div className="security-note">
            <p>📝 <strong>Note:</strong> Your messages are now protected by NIST-approved post-quantum cryptography algorithms
              that are resistant to attacks from both classical and quantum computers.</p>
          </div>
        </div>
        <div className="security-actions">
          <button className="primary-button" onClick={onClose}>I Feel Secure!</button>
        </div>
      </div>
    </div>
  );
}
