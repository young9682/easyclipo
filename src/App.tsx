import { useEffect, useState } from "react";
import { Clipboard, MessageCircle, Settings, Sun, Moon } from "lucide-react";
import { CategoryTabs } from "./components/CategoryTabs";
import { ClipList } from "./components/ClipList";
import { FeedbackDialog } from "./components/FeedbackDialog";
import { PlumBranch } from "./components/PlumBranch";
import { SearchBar } from "./components/SearchBar";
import { SettingsDialog } from "./components/SettingsDialog";
import { WindowControls } from "./components/WindowControls";
import { useClipEvents } from "./hooks/useClips";
import { useClips } from "./stores/clips";
import { applyTheme, currentTheme, type ThemeMode } from "./utils/theme";
import { chineseDate } from "./utils/time";
import { inTauri } from "./utils/tauri";

export default function App() {
  useClipEvents();
  const fetchClips = useClips((s) => s.fetchClips);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => currentTheme());

  useEffect(() => {
    void fetchClips(true);
  }, [fetchClips]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  const railBtn =
    "flex h-[34px] w-[34px] items-center justify-center rounded-[9px] transition-colors";
  const railIdle =
    "text-petal/55 hover:text-petal focus-visible:text-petal focus-visible:bg-white/10";

  return (
    <div className="flex h-screen text-ink">
      {/* 墨竹立轴侧栏 */}
      <aside className="flex w-[54px] shrink-0 flex-col items-center bg-rail py-4">
        <span className="font-serif text-xl tracking-[0.4em] text-petal [writing-mode:vertical-rl]">
          梅笺
        </span>
        <nav className="mt-auto flex flex-col gap-2" aria-label="主导航">
          <button
            type="button"
            title="剪贴板"
            aria-label="剪贴板"
            aria-current="page"
            className={`${railBtn} bg-bamboo-mist/80 text-bamboo-light`}
          >
            <Clipboard size={16} />
          </button>
          <button
            type="button"
            title="反馈"
            aria-label="反馈"
            onClick={() => setFeedbackOpen(true)}
            className={`${railBtn} ${railIdle}`}
          >
            <MessageCircle size={16} />
          </button>
          <button
            type="button"
            title="设置"
            aria-label="设置"
            onClick={() => setSettingsOpen(true)}
            className={`${railBtn} ${railIdle}`}
          >
            <Settings size={16} />
          </button>
          <button
            type="button"
            title={theme === "dark" ? "切换昼色" : "切换夜色"}
            aria-label="切换昼夜主题"
            onClick={toggleTheme}
            className={`${railBtn} mt-2 ${railIdle}`}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </nav>
      </aside>

      {/* 主列 */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <PlumBranch className="absolute right-2 top-[54px] w-[118px] opacity-50" />
        {/* 拖拽条 + 自绘窗口钮 */}
        <div
          data-tauri-drag-region
          onDoubleClick={() => {
            if (!inTauri) return;
            void import("@tauri-apps/api/window").then(
              ({ getCurrentWindow }) => {
                void getCurrentWindow().toggleMaximize();
              }
            );
          }}
          className="flex shrink-0 items-center justify-end px-3 pt-2.5"
        >
          <WindowControls />
        </div>

        <div className="shrink-0 px-3.5">
          <SearchBar />
          <div className="mb-2 mt-2.5 px-0.5 font-serif text-[11px] tracking-[0.32em] text-ink-faint">
            {chineseDate()} · 宜存录
          </div>
        </div>
        <CategoryTabs />

        <main className="min-h-0 flex-1 overflow-y-auto">
          <ClipList />
        </main>
      </div>

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
