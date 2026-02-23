import { useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { InputPanel } from './components/InputPanel';
import { ItemList } from './components/ItemList';
import { SettingsDrawer } from './components/SettingsDrawer';
import { SummaryModal } from './components/SummaryModal';
import { recoverStuckItems } from './lib/db';
import './index.css';

function App() {
  useEffect(() => {
    recoverStuckItems();
  }, []);

  return (
    <div className="app-container">
      <TopBar />
      <main className="main-content">
        <InputPanel />
        <ItemList />
      </main>
      <SettingsDrawer />
      <SummaryModal />
    </div>
  );
}

export default App;
