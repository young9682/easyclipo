import { useEffect, useState } from "react";
import { invoke } from "../utils/tauri";
import { useClips } from "../stores/clips";
import { savedTheme, applyTheme, type ThemeMode } from "../utils/theme";
import type { SettingsDto } from "../types";

export function SettingsDialog({
  onClose,
  onOpenFeedback,
}: {
  onClose: () => void;
  onOpenFeedback: () => void;
}) {
  const refresh = useClips((s) => s.refresh);
  const [retention, setRetention] = useState("14");
  const [deviceId, setDeviceId] = useState("");
  const [hotkey, setHotkey] = useState("Ctrl+Shift+V");
  const [theme, setTheme] = useState<ThemeMode>(() => savedTheme());
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    invoke<SettingsDto>("get_settings")
      .then((s) => {
        setRetention(String(s.retentionDays));
        setDeviceId(s.deviceId);
        setHotkey(s.hotkey);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  const switchTheme = (mode: ThemeMode) => {
    setTheme(mode);
    applyTheme(mode);
  };

  const save = async () => {
    setErr(null);
    setMsg(null);
    try {
      await invoke("set_setting", {
        key: "retention_days",
        value: retention,
      });
      setMsg("已保存");
      void refresh();
    } catch (e) {
      setErr(String(e));
    }
  };

  const clearAll = async () => {
    if (!window.confirm("确定清空全部剪贴板记录？此操作不可恢复。")) return;
    try {
      await invoke("clear_all");
      void refresh();
      onClose();
    } catch (e) {
      setErr(String(e));
    }
  };

  const seg = (active: boolean) =>
    `rounded-[3px] border px-3 py-[3px] text-xs transition-colors ${
      active
        ? "border-bamboo-deep bg-bamboo-deep text-petal"
        : "border-paper-deep text-ink-faint hover:border-bamboo hover:text-bamboo"
    }`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-md border border-paper-deep bg-paper p-5 shadow-[0_8px_32px_var(--color-shadow-deep)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 font-serif text-base font-bold text-ink">设置</h2>

        <label className="mb-1 block text-xs text-ink-faint">外观</label>
        <div className="mb-4 flex gap-1.5">
          {(
            [
              { value: "light", label: "昼色 · 纸白" },
              { value: "dark", label: "夜色 · 墨卷" },
            ] as Array<{ value: ThemeMode; label: string }>
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => switchTheme(o.value)}
              className={seg(theme === o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-xs text-ink-faint">
          保存时长（天）
        </label>
        <input
          type="number"
          min={1}
          max={3650}
          value={retention}
          onChange={(e) => setRetention(e.target.value)}
          className="mb-2 w-full rounded-[4px] border border-paper-deep bg-cloud px-3 py-1.5 text-sm text-ink outline-none transition-colors focus:border-bamboo"
        />
        <p className="mb-4 text-xs leading-5 text-ink-faint">
          超过保存时长的未置顶条目将自动清理（默认 14 天）。
        </p>

        <div className="mb-1 text-xs text-ink-faint">全局快捷键</div>
        <div className="mb-4 rounded-[4px] border border-paper-deep bg-cloud px-3 py-1.5 font-mono text-xs text-ink-soft">
          {hotkey} 唤起窗口
        </div>

        <div className="mb-1 text-xs text-ink-faint">本机设备 ID</div>
        <div className="mb-4 truncate rounded-[4px] border border-paper-deep bg-cloud px-3 py-1.5 font-mono text-xs text-ink-faint">
          {deviceId || "…"}
        </div>

        <div className="mb-4 flex items-center justify-between rounded-[4px] border border-bamboo-glow bg-bamboo-mist px-3 py-2.5">
          <span className="text-xs text-ink-soft">遇到问题或有想法？</span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenFeedback();
            }}
            className="rounded-[3px] bg-bamboo-deep px-3 py-1.5 text-xs font-medium text-petal transition-[filter] hover:brightness-110"
          >
            反馈问题
          </button>
        </div>

        {msg && <p className="mb-2 text-xs text-bamboo">{msg}</p>}
        {err && <p className="mb-2 text-xs text-cinnabar">{err}</p>}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => void clearAll()}
            className="rounded-[4px] border border-cinnabar/40 px-3 py-1.5 text-xs text-cinnabar transition-colors hover:bg-cinnabar-bg"
          >
            清空记录
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[4px] px-3 py-1.5 text-xs text-ink-faint transition-colors hover:bg-paper-warm hover:text-ink-soft"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={() => void save()}
              className="rounded-[4px] bg-bamboo-deep px-3.5 py-1.5 text-xs font-medium text-petal transition-[filter] hover:brightness-110"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
