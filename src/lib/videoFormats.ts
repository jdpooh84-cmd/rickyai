// Optimal social media video format presets
// Default: 9:16 vertical (social-first)
// Future iteration: 16:9 horizontal support

export type VideoFormat = "9:16" | "16:9";

export interface VideoFormatSpec {
  aspectRatio: VideoFormat;
  width: number;
  height: number;
  orientation: "vertical" | "horizontal";
  label: string;
  platforms: string[];
  description: string;
}

export const VIDEO_FORMATS: Record<VideoFormat, VideoFormatSpec> = {
  "9:16": {
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    orientation: "vertical",
    label: "Vertical (9:16)",
    platforms: ["TikTok", "Instagram Reels", "YouTube Shorts", "Snapchat", "Stories"],
    description: "1080×1920px — Optimized for mobile-first social platforms",
  },
  "16:9": {
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    orientation: "horizontal",
    label: "Horizontal (16:9)",
    platforms: ["YouTube", "Facebook", "LinkedIn", "Webinars", "Desktop"],
    description: "1920×1080px — Traditional widescreen for desktop & long-form",
  },
};

// Default format for all new video production
export const DEFAULT_VIDEO_FORMAT: VideoFormat = "9:16";

// Developer note: To enable 16:9 as default, change DEFAULT_VIDEO_FORMAT above.
// This is planned for iteration 2 once revenue supports horizontal content pipelines.

export const getFormatSpec = (format: VideoFormat): VideoFormatSpec => VIDEO_FORMATS[format];
