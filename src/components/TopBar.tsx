import { useAppStore } from '../store/useAppStore';

export function TopBar() {
    const toggleSettings = useAppStore((state) => state.toggleSettings);

    return (
        <header className="header">
            <div className="header-content">
                <h1>DistyVault</h1>
                <button onClick={toggleSettings} className="settings-btn">
                    Settings ⚙️
                </button>
            </div>
        </header>
    );
}
