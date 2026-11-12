import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useClips } from "../stores/clips";

/** 检索行：整行卷面直角搜索框（梅影风格，类型筛选由页签承担） */
export function SearchBar() {
  const setQuery = useClips((s) => s.setQuery);
  const [text, setText] = useState("");

  // 300ms 防抖后应用搜索词
  useEffect(() => {
    const t = setTimeout(() => setQuery(text), 300);
    return () => clearTimeout(t);
  }, [text, setQuery]);

  return (
    <div className="flex items-center gap-2 rounded-[4px] border border-paper-deep bg-cloud px-2.5 py-[7px] transition-colors focus-within:border-bamboo">
      <Search size={14} className="shrink-0 text-ink-faint" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="检索笺文…"
        className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder-ink-ghost"
      />
    </div>
  );
}
