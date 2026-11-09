import { useEffect, useState } from "react";
import { useClips } from "../stores/clips";
import type { ContentType } from "../types";

const TYPE_OPTIONS: Array<{ value: ContentType | null; label: string }> = [
  { value: null, label: "全部类型" },
  { value: "text", label: "文本" },
  { value: "image", label: "图片" },
  { value: "code", label: "代码" },
  { value: "link", label: "链接" },
  { value: "file", label: "文件" },
];

export function SearchBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const setQuery = useClips((s) => s.setQuery);
  const setTypeFilter = useClips((s) => s.setTypeFilter);
  const [text, setText] = useState("");

  // 300ms 防抖后应用搜索词
  useEffect(() => {
    const t = setTimeout(() => setQuery(text), 300);
    return () => clearTimeout(t);
  }, [text, setQuery]);

  return (
    <div className="flex items-center gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="搜索剪贴板内容…"
        className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 outline-none placeholder-zinc-500 focus:border-sky-500"
      />
      <select
        onChange={(e) =>
          setTypeFilter((e.target.value || null) as ContentType | null)
        }
        className="cursor-pointer rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-300 outline-none"
      >
        {TYPE_OPTIONS.map((o) => (
          <option key={o.label} value={o.value ?? ""}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        title="设置"
        onClick={onOpenSettings}
        className="rounded-md px-2 py-1.5 text-lg leading-none hover:bg-zinc-800"
      >
        ⚙️
      </button>
    </div>
  );
}
