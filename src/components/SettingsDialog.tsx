import { useEffect, useState } from "react";
import { invoke } from "../utils/tauri";
import { useClips } from "../stores/clips";
import type { SettingsDto } from "../types";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const refresh = useClips((s) => s.refresh);
  const [retention, setRetention] = useState("14");
  const [deviceId, setDeviceId] = useState("");
  const [hotkey, setHotkey] = useState("Ctrl+Shift+V");
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold text-zinc-100">设置</h2>

        <label className="mb-1 block text-xs text-zinc-400">
          保存时长（天）
        </label>
        <input
          type="number"
          min={1}
          max={3650}
          value={retention}
          onChange={(e) => setRetention(e.target.value)}
          className="mb-2 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-sky-500"
        />
        <p className="mb-4 text-xs text-zinc-500">
          超过保存时长的未置顶条目将自动清理（默认 14 天）。
        </p>

        <div className="mb-1 text-xs text-zinc-400">全局快捷键</div>
        <div className="mb-4 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300">
          {hotkey} 唤起窗口
        </div>

        <div className="mb-1 text-xs text-zinc-400">本机设备 ID</div>
        <div className="mb-4 truncate rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-xs text-zinc-400">
          {deviceId || "…"}
        </div>

        {msg && <p className="mb-2 text-xs text-emerald-400">{msg}</p>}
        {err && <p className="mb-2 text-xs text-rose-400">{err}</p>}

        <div className="flex items-center justify-between">
          <button
            onClick={() => void clearAll()}
            className="rounded-md border border-rose-500/40 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10"
          >
            清空记录
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800"
            >
              关闭
            </button>
            <button
              onClick={() => void save()}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
