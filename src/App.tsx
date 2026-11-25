import { useState } from 'react';
import { DownloaderWorkspace } from './components/DownloaderWorkspace';
import { Header } from './components/Header';
import { LandingSections } from './components/LandingSections';

export default function App() {
  const [pasteTrigger, setPasteTrigger] = useState(0);

  function handleHeaderPasteClick() {
    const el = document.getElementById('downloader');
    el?.scrollIntoView({ behavior: 'smooth' });
    setPasteTrigger((prev) => prev + 1);
  }

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-[#111318] flex flex-col">
      <Header onPasteAction={handleHeaderPasteClick} />
      <main className="flex-1">
        <DownloaderWorkspace externalPasteTrigger={pasteTrigger} />
        <LandingSections />
      </main>
    </div>
  );
}
