import { useEffect, useState } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { inTauri } from "../utils/tauri";

/**
 * 自绘标题栏窗口钮（梅影风格）：
 * 最小化 / 最大化-还原 / 关闭，关闭悬停转朱砂。
 * 仅在 Tauri 环境调用窗口 API，浏览器开发预览为 no-op。
 */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!inTauri) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const sync = () =>
        win
          .isMaximized()
          .then((v) => {
            if (!disposed) setMaximized(v);
          })
          .catch(() => {});
      void sync();
      try {
        unlisten = await win.onResized(sync);
      } catch {
        // 事件不可用时仅以初始状态展示
      }
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const act = (fn: (win: import("@tauri-apps/api/window").Window) => void) => {
    if (!inTauri) return;
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
      fn(getCurrentWindow());
    });
  };

  const btn =
    "flex h-[26px] w-[28px] items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-bamboo-mist hover:text-bamboo";
  const close =
    "flex h-[26px] w-[28px] items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-cinnabar hover:text-paper";

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        title="最小化"
        aria-label="最小化"
        onClick={() => act((w) => void w.minimize())}
        className={btn}
      >
        <Minus size={14} />
      </button>
      <button
        type="button"
        title={maximized ? "还原" : "最大化"}
        aria-label={maximized ? "还原" : "最大化"}
        onClick={() => act((w) => void w.toggleMaximize())}
        className={btn}
      >
        {maximized ? <Copy size={12} /> : <Square size={11} />}
      </button>
      <button
        type="button"
        title="关闭"
        aria-label="关闭"
        onClick={() => act((w) => void w.close())}
        className={close}
      >
        <X size={14} />
      </button>
    </div>
  );
}
