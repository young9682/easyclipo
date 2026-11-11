import { useState } from "react";
import { invoke } from "../utils/tauri";
import type { SystemInfoDto } from "../types";

type FeedbackKind = "bug" | "idea" | "other";

const KINDS: Array<{ value: FeedbackKind; label: string; prefix: string }> = [
  { value: "bug", label: "🐛 Bug 反馈", prefix: "[Bug]" },
  { value: "idea", label: "💡 功能建议", prefix: "[建议]" },
  { value: "other", label: "💬 其他", prefix: "[反馈]" },
];

const ISSUE_NEW_URL = "https://github.com/young9682/easyclipo/issues/new";
const MAX_DETAIL = 4000;

/** 用户反馈：应用内填表 → 打开 GitHub 预填 Issue 页，用户登录后一键提交 */
export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [withInfo, setWithInfo] = useState(true);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && title.trim().length <= 100;

  const submit = async () => {
    setErr(null);
    const k = KINDS.find((x) => x.value === kind)!;
    let body = `## 描述\n\n${detail.trim() || "（未填写）"}\n`;
    if (withInfo) {
      try {
        const info = await invoke<SystemInfoDto>("get_system_info");
        body += `\n## 系统信息\n- EasyClip: v${info.appVersion}\n- 系统: ${info.os} (${info.arch})\n- Tauri: ${info.tauriVersion}\n`;
      } catch {
        // 系统信息获取失败不阻塞反馈
      }
    }
    body += "\n---\n*由 EasyClip 用户反馈功能生成*";

    const fullTitle = `${k.prefix} ${title.trim()}`;
    const fallback = `${ISSUE_NEW_URL}?title=${encodeURIComponent(
      fullTitle
    )}&body=${encodeURIComponent(body)}`;
    try {
      const url = await invoke<string>("open_issue_page", {
        title: fullTitle,
        body,
      });
      setDone(url || fallback);
    } catch (e) {
      setErr(String(e));
      setDone(fallback); // 打不开浏览器时给兜底链接
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-paper-deep bg-paper p-5 shadow-[0_8px_32px_var(--color-shadow-deep)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 font-serif text-base font-bold text-ink">
          用户反馈
        </h2>

        {done ? (
          <div className="mb-4">
            <p className="mb-3 text-sm text-bamboo">
              ✓ 已在浏览器打开 GitHub 提交页，登录后点击「Submit new issue」即完成反馈。
            </p>
            {err && <p className="mb-2 text-xs text-cinnabar">{err}</p>}
            <a
              href={done}
              target="_blank"
              rel="noreferrer"
              className="mb-4 block truncate rounded-lg border border-paper-deep bg-cloud px-3 py-2 text-xs text-bamboo hover:underline"
            >
              未自动打开？点此前往 →
            </a>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-bamboo px-3 py-1.5 text-xs font-medium text-cloud hover:bg-bamboo-light"
            >
              完成
            </button>
          </div>
        ) : (
          <>
            <label className="mb-1 block text-xs text-ink-faint">类型</label>
            <div className="mb-3 inline-flex rounded-lg bg-paper-warm p-0.5">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  onClick={() => setKind(k.value)}
                  className={`rounded-md px-2.5 py-1 text-xs transition-all ${
                    kind === k.value
                      ? "bg-cloud font-medium text-bamboo shadow-[0_1px_2px_var(--color-shadow)]"
                      : "text-ink-faint hover:text-ink-soft"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>

            <label className="mb-1 block text-xs text-ink-faint">
              标题（必填，100 字内）
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="一句话概括问题或建议"
              maxLength={100}
              className="mb-3 w-full rounded-lg border border-paper-deep bg-cloud px-3 py-1.5 text-sm text-ink outline-none transition-colors placeholder-ink-ghost focus:border-bamboo focus:ring-2 focus:ring-bamboo-glow"
            />

            <label className="mb-1 block text-xs text-ink-faint">
              详细描述
              <span className="ml-1 text-ink-ghost">
                （{detail.length}/{MAX_DETAIL}）
              </span>
            </label>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value.slice(0, MAX_DETAIL))}
              rows={4}
              placeholder="复现步骤 / 期望行为 / 实际行为…"
              className="mb-3 w-full resize-none rounded-lg border border-paper-deep bg-cloud px-3 py-1.5 text-sm leading-relaxed text-ink outline-none transition-colors placeholder-ink-ghost focus:border-bamboo focus:ring-2 focus:ring-bamboo-glow"
            />

            <label className="mb-4 flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
              <input
                type="checkbox"
                checked={withInfo}
                onChange={(e) => setWithInfo(e.target.checked)}
                className="accent-bamboo"
              />
              附上系统信息（应用版本 / 操作系统，不含任何剪贴板内容）
            </label>

            {err && <p className="mb-2 text-xs text-cinnabar">{err}</p>}

            <div className="flex justify-end gap-2">
              <button
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-xs text-ink-faint hover:bg-paper-warm hover:text-ink-soft"
              >
                取消
              </button>
              <button
                onClick={() => void submit()}
                disabled={!canSubmit}
                className="rounded-lg bg-bamboo px-3.5 py-1.5 text-xs font-medium text-cloud transition-opacity hover:bg-bamboo-light disabled:cursor-not-allowed disabled:opacity-40"
              >
                前往提交
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
