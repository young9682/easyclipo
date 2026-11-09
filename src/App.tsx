import { useEffect, useState } from "react";
import { CategoryTabs } from "./components/CategoryTabs";
import { ClipList } from "./components/ClipList";
import { SearchBar } from "./components/SearchBar";
import { SettingsDialog } from "./components/SettingsDialog";
import { useClipEvents } from "./hooks/useClips";
import { useClips } from "./stores/clips";

export default function App() {
  useClipEvents();
  const fetchClips = useClips((s) => s.fetchClips);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    void fetchClips(true);
  }, [fetchClips]);

  return (
    <div className="flex h-screen flex-col bg-zinc-900 text-zinc-100">
      <header className="px-3 pb-2 pt-3">
        <SearchBar onOpenSettings={() => setSettingsOpen(true)} />
      </header>
      <CategoryTabs />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <ClipList />
      </main>
      {settingsOpen && (
        <SettingsDialog onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}
