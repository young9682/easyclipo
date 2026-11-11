import type { ClipRow } from "../types";

/**
 * Tauri API 封装：在 Tauri 环境走 invoke / event，
 * 纯浏览器开发环境回退到内存 mock 数据，便于用浏览器直接核验 UI。
 */
export const inTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (inTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>(cmd, args);
  }
  return mockInvoke<T>(cmd, args ?? {});
}

export async function listen<T>(
  event: string,
  handler: (payload: T) => void
): Promise<() => void> {
  if (inTauri) {
    const { listen } = await import("@tauri-apps/api/event");
    const unlisten = await listen<T>(event, (e) => handler(e.payload));
    return unlisten;
  }
  return () => {};
}

/* ---------------- mock（仅浏览器开发预览用） ---------------- */

const MIN = 60_000;
const DAY = 86_400_000;

let mockSeq = 0;
const mockNow = Date.now();

function mk(
  clip: Partial<ClipRow> &
    Pick<ClipRow, "contentType" | "textContent" | "category">,
  minutesAgo: number
): ClipRow {
  return {
    id: `mock-${++mockSeq}`,
    hasImage: false,
    sourceDevice: "mock-device-01",
    createdAt: mockNow - minutesAgo * MIN,
    expiresAt: mockNow + 14 * DAY,
    isSynced: false,
    isSensitive: false,
    pinned: false,
    ...clip,
  };
}

const MOCK_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='180'>` +
      `<rect width='100%' height='100%' fill='#0ea5e9'/>` +
      `<circle cx='84' cy='90' r='44' fill='#fbbf24'/>` +
      `<rect x='170' y='42' width='116' height='96' rx='10' fill='#f43f5e'/>` +
      `</svg>`
  );

const mockClips: ClipRow[] = [
  mk(
    {
      contentType: "text",
      textContent: "项目评审会议纪要：\n1. 一期核心功能本周交付\n2. 同步协议下周一设计评审",
      category: "文本",
      pinned: true,
    },
    12
  ),
  mk(
    {
      contentType: "code",
      textContent:
        "function add(a, b) {\n  const sum = a + b;\n  return sum;\n}\nconst result = add(1, 2);",
      category: "代码",
    },
    26
  ),
  mk(
    {
      contentType: "link",
      textContent: "https://github.com/tauri-apps/tauri",
      category: "链接",
    },
    48
  ),
  mk(
    {
      contentType: "file",
      textContent:
        "E:\\young86\\工作\\季度报告.xlsx\nE:\\young86\\工作\\汇报总结.docx",
      category: "文件",
    },
    92
  ),
  mk(
    {
      contentType: "image",
      textContent: null,
      hasImage: true,
      category: "图片",
    },
    180
  ),
  mk(
    {
      contentType: "text",
      textContent:
        "EasyClip 是一款轻量级剪切板管理器，支持实时监听系统剪贴板、本地持久化存储、自动分类与过期清理，跨端同步与敏感信息检测将在后续版本提供。",
      category: "文本",
    },
    260
  ),
  mk(
    {
      contentType: "text",
      textContent: "我的手机号是 13800138000，有事电话联系。",
      category: "文本",
      isSensitive: true,
    },
    340
  ),
  mk(
    {
      contentType: "text",
      textContent: "周报已发送，请查收。",
      category: "文本",
    },
    520
  ),
];

function mockMatches(
  clip: ClipRow,
  args: { query?: string | null; contentType?: string | null; category?: string | null }
): boolean {
  if (
    args.query &&
    !(clip.textContent ?? "").toLowerCase().includes(args.query.toLowerCase())
  ) {
    return false;
  }
  if (args.contentType && clip.contentType !== args.contentType) return false;
  if (args.category && clip.category !== args.category) return false;
  return true;
}

async function mockInvoke<T>(
  cmd: string,
  args: Record<string, unknown>
): Promise<T> {
  await new Promise((r) => setTimeout(r, 120)); // 模拟 IPC 延迟
  switch (cmd) {
    case "get_clips": {
      const offset = Number(args.offset ?? 0);
      const limit = Number(args.limit ?? 100);
      const rows = mockClips
        .filter((c) => mockMatches(c, args))
        .sort(
          (a, b) =>
            Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt
        )
        .slice(offset, offset + limit);
      return rows as T;
    }
    case "get_image_base64":
      return MOCK_IMAGE as T;
    case "copy_clip": {
      const clip = mockClips.find((c) => c.id === args.id);
      if (!clip) throw new Error("条目不存在");
      clip.createdAt = Date.now();
      return { ...clip } as T;
    }
    case "delete_clip": {
      const idx = mockClips.findIndex((c) => c.id === args.id);
      if (idx >= 0) mockClips.splice(idx, 1);
      return undefined as T;
    }
    case "toggle_pin": {
      const clip = mockClips.find((c) => c.id === args.id);
      if (!clip) throw new Error("条目不存在");
      clip.pinned = !clip.pinned;
      return { ...clip } as T;
    }
    case "set_category": {
      const clip = mockClips.find((c) => c.id === args.id);
      if (!clip) throw new Error("条目不存在");
      clip.category = String(args.category);
      return { ...clip } as T;
    }
    case "get_settings":
      return {
        retentionDays: 14,
        deviceId: "mock-device-01",
        hotkey: "Ctrl+Shift+V",
      } as T;
    case "get_system_info":
      return {
        appVersion: "0.3.0",
        os: "windows",
        arch: "x86_64",
        tauriVersion: "2.x",
      } as T;
    case "open_issue_page": {
      const url = `https://github.com/young9682/easyclipo/issues/new?title=${encodeURIComponent(
        String(args.title ?? "")
      )}&body=${encodeURIComponent(String(args.body ?? ""))}`;
      if (typeof window !== "undefined") window.open(url, "_blank");
      return url as T;
    }
    case "set_setting":
      return undefined as T;
    case "clear_all": {
      const n = mockClips.length;
      mockClips.length = 0;
      return n as T;
    }
    default:
      throw new Error(`mock 未实现命令：${cmd}`);
  }
}
