import { useAppStore } from '../store/useAppStore';
import { VaultControls } from './VaultControls';

export function SettingsDrawer() {
    const { isSettingsOpen, toggleSettings, geminiApiKey, setGeminiApiKey } = useAppStore();

    if (!isSettingsOpen) return null;

    return (
        <div className="settings-overlay" onClick={toggleSettings}>
            <div className="settings-drawer" onClick={(e) => e.stopPropagation()}>
                <div className="settings-header">
                    <h2>Settings</h2>
                    <button onClick={toggleSettings} className="close-btn">✕</button>
                </div>

                <div className="settings-body">
                    <div className="form-group">
                        <label htmlFor="apiKey">Gemini API Key</label>
                        <input
                            id="apiKey"
                            type="password"
                            value={geminiApiKey}
                            onChange={(e) => setGeminiApiKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="api-key-input"
                        />
                        <p className="help-text">
                            Key is stored locally in your browser.
                        </p>
                    </div>

                    <div className="form-group">
                        <label>Model</label>
                        <select disabled title="Model selection is locked for Phase 1">
                            <option>gemini-2.5-pro</option>
                        </select>
                    </div>

                    <hr className="settings-divider" />
                    <VaultControls />
                </div>
            </div>
        </div>
    );
}
