import { create } from "zustand";
import { invoke } from "../utils/tauri";
import type { ClipRow, ContentType } from "../types";

const PAGE_SIZE = 100;

interface ClipsState {
  clips: ClipRow[];
  loading: boolean;
  hasMore: boolean;
  query: string;
  typeFilter: ContentType | null;
  category: string;
  setQuery(query: string): void;
  setTypeFilter(filter: ContentType | null): void;
  setCategory(category: string): void;
  fetchClips(reset?: boolean): Promise<void>;
  loadMore(): Promise<void>;
  refresh(): Promise<void>;
  prependClip(clip: ClipRow): void;
  copyClip(id: string): Promise<void>;
  deleteClip(id: string): Promise<void>;
  togglePin(id: string): Promise<void>;
  changeCategory(id: string, category: string): Promise<void>;
}

function dedupeById(clips: ClipRow[]): ClipRow[] {
  const seen = new Set<string>();
  return clips.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

export const useClips = create<ClipsState>((set, get) => ({
  clips: [],
  loading: false,
  hasMore: false,
  query: "",
  typeFilter: null,
  category: "全部",

  setQuery(query) {
    set({ query });
    void get().fetchClips(true);
  },

  setTypeFilter(typeFilter) {
    set({ typeFilter });
    void get().fetchClips(true);
  },

  setCategory(category) {
    set({ category });
    void get().fetchClips(true);
  },

  async fetchClips(reset) {
    set({ loading: true });
    try {
      const offset = reset ? 0 : get().clips.length;
      const rows = await invoke<ClipRow[]>("get_clips", {
        query: get().query || null,
        contentType: get().typeFilter,
        category: get().category === "全部" ? null : get().category,
        offset,
        limit: PAGE_SIZE,
      });
      set((s) => ({
        clips: reset ? rows : dedupeById([...s.clips, ...rows]),
        hasMore: rows.length === PAGE_SIZE,
        loading: false,
      }));
    } catch (e) {
      console.error("加载剪贴板失败:", e);
      set({ loading: false });
    }
  },

  async loadMore() {
    if (!get().loading && get().hasMore) {
      await get().fetchClips(false);
    }
  },

  async refresh() {
    await get().fetchClips(true);
  },

  prependClip(clip) {
    set((s) => ({ clips: dedupeById([clip, ...s.clips]) }));
  },

  async copyClip(id) {
    try {
      const updated = await invoke<ClipRow>("copy_clip", { id });
      set((s) => ({
        clips: dedupeById([updated, ...s.clips.filter((c) => c.id !== id)]),
      }));
    } catch (e) {
      console.error("复制失败:", e);
      window.alert(String(e));
    }
  },

  async deleteClip(id) {
    set((s) => ({ clips: s.clips.filter((c) => c.id !== id) }));
    try {
      await invoke("delete_clip", { id });
    } catch (e) {
      console.error("删除失败:", e);
      void get().fetchClips(true);
    }
  },

  async togglePin(id) {
    try {
      await invoke("toggle_pin", { id });
      // 置顶影响排序，整体刷新
      void get().fetchClips(true);
    } catch (e) {
      console.error("置顶失败:", e);
    }
  },

  async changeCategory(id, category) {
    try {
      const updated = await invoke<ClipRow>("set_category", { id, category });
      set((s) => ({
        clips: s.clips.map((c) => (c.id === id ? updated : c)),
      }));
      const current = get().category;
      if (current !== "全部" && current !== category) {
        void get().fetchClips(true);
      }
    } catch (e) {
      console.error("修改分类失败:", e);
    }
  },
}));
