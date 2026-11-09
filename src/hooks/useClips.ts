import { useEffect } from "react";
import { listen } from "../utils/tauri";
import { useClips } from "../stores/clips";
import type { ClipRow } from "../types";

/** 订阅后端剪贴板事件，驱动 store 更新 */
export function useClipEvents() {
  useEffect(() => {
    let cancelled = false;
    const offs: Array<() => void> = [];

    listen<ClipRow>("clip:new", (clip) => {
      const { query, typeFilter, category } = useClips.getState();
      const matchQuery =
        !query ||
        (clip.textContent ?? "").toLowerCase().includes(query.toLowerCase());
      const matchType = !typeFilter || clip.contentType === typeFilter;
      const matchCategory = category === "全部" || clip.category === category;
      if (matchQuery && matchType && matchCategory) {
        useClips.getState().prependClip(clip);
      }
    }).then((off) => {
      if (cancelled) off();
      else offs.push(off);
    });

    listen<number>("clip:purged", () => {
      void useClips.getState().refresh();
    }).then((off) => {
      if (cancelled) off();
      else offs.push(off);
    });

    return () => {
      cancelled = true;
      offs.forEach((off) => off());
    };
  }, []);
}
