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

export interface SystemInfoDto {
  appVersion: string;
  os: string;
  arch: string;
  tauriVersion: string;
}

export const TYPE_LABELS: Record<ContentType, string> = {
  text: "文本",
  image: "图片",
  code: "代码",
  link: "链接",
  file: "文件",
};

/** 类型印章字（梅影方案的条目小戳） */
export const TYPE_STAMPS: Record<ContentType, string> = {
  text: "文",
  image: "图",
  code: "码",
  link: "链",
  file: "档",
};
