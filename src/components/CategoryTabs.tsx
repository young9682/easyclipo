import { useClips } from "../stores/clips";

const CATEGORIES = ["全部", "文本", "图片", "代码", "链接", "文件"];

/** 印章式分类页签：直角小签 + 竹青选中（梅影风格） */
export function CategoryTabs() {
  const category = useClips((s) => s.category);
  const setCategory = useClips((s) => s.setCategory);

  return (
    <nav
      aria-label="分类筛选"
      className="flex shrink-0 flex-wrap gap-1.5 px-3.5 pb-2.5 pt-0.5"
    >
      {CATEGORIES.map((c) => {
        const active = category === c;
        return (
          <button
            key={c}
            type="button"
            aria-pressed={active}
            onClick={() => setCategory(c)}
            className={`rounded-[3px] border px-2.5 py-[3px] text-xs tracking-wide transition-colors ${
              active
                ? "border-bamboo-deep bg-bamboo-deep text-petal"
                : "border-paper-deep text-ink-faint hover:border-bamboo hover:text-bamboo"
            }`}
          >
            {c}
          </button>
        );
      })}
    </nav>
  );
}
