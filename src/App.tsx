import { useEffect, useState } from "react";
import { CategoryTabs } from "./components/CategoryTabs";
import { ClipList } from "./components/ClipList";
import { FeedbackDialog } from "./components/FeedbackDialog";
import { SearchBar } from "./components/SearchBar";
import { SettingsDialog } from "./components/SettingsDialog";
import { useClipEvents } from "./hooks/useClips";
import { useClips } from "./stores/clips";

export default function App() {
  useClipEvents();
  const fetchClips = useClips((s) => s.fetchClips);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    void fetchClips(true);
  }, [fetchClips]);

  return (
    <div className="flex h-screen flex-col bg-paper font-body text-ink">
      <header className="px-4 pb-1 pt-3.5">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-xl font-bold tracking-wide text-ink">
              EasyClip
            </span>
            <span className="text-[10px] tracking-[0.3em] text-ink-ghost">
              剪贴板
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              title="反馈"
              onClick={() => setFeedbackOpen(true)}
              className="rounded-lg px-2 py-1.5 text-base leading-none text-ink-faint transition-colors hover:bg-paper-warm hover:text-ink-soft"
            >
              💬
            </button>
            <button
              title="设置"
              onClick={() => setSettingsOpen(true)}
              className="rounded-lg px-2 py-1.5 text-base leading-none text-ink-faint transition-colors hover:bg-paper-warm hover:text-ink-soft"
            >
              ⚙️
            </button>
          </div>
        </div>
        <SearchBar />
      </header>
      <CategoryTabs />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <ClipList />
      </main>
      {settingsOpen && (
        <SettingsDialog
          onClose={() => setSettingsOpen(false)}
          onOpenFeedback={() => setFeedbackOpen(true)}
        />
      )}
      {feedbackOpen && <FeedbackDialog onClose={() => setFeedbackOpen(false)} />}
    </div>
  );
}
