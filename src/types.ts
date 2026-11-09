export type ContentType = "text" | "image" | "code" | "link" | "file";

/** 与后端 ClipRow DTO 对齐（serde rename camelCase） */
export interface ClipRow {
  id: string;
  contentType: ContentType;
  textContent: string | null;
  hasImage: boolean;
  category: string;
  sourceDevice: string;
  createdAt: number;
  expiresAt: number;
  isSynced: boolean;
  isSensitive: boolean;
  pinned: boolean;
}

export interface SettingsDto {
  retentionDays: number;
  deviceId: string;
  hotkey: string;
}

export const TYPE_LABELS: Record<ContentType, string> = {
  text: "文本",
  image: "图片",
  code: "代码",
  link: "链接",
  file: "文件",
};

export const TYPE_ICONS: Record<ContentType, string> = {
  text: "📝",
  image: "🖼️",
  code: "💻",
  link: "🔗",
  file: "📁",
};
