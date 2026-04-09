/**
 * Fixed 4-block promo video template.
 * Format: 9:16 vertical, 30-45 seconds, MP4.
 * Structure: Hook (0-5s) → Value (5-20s) → Proof (20-35s) → CTA (35-45s).
 * Fallback: clean text + gradient slideshow if assets missing/invalid.
 */

// ── Types ──

export interface PromoBlock {
  type: "hook" | "value" | "proof" | "cta";
  duration: number;
  headline: string;
  subtext?: string;
  imageUrl?: string;
}

export interface PromoTemplate {
  blocks: PromoBlock[];
  businessName: string;
  accentColor: string;
  totalDuration: number;
}

// ── Gradient presets for text-only fallback ──

const GRADIENTS = [
  ["#0f172a", "#1e3a5f"],
  ["#1a1a2e", "#16213e"],
  ["#0c1222", "#1b2838"],
  ["#1e1b4b", "#312e81"],
];

// ── Build template from approved script ──

export function buildPromoTemplate(
  script: any,
  businessName: string,
  images: string[],
  accentColor = "#0EA5E9"
): PromoTemplate {
  const scenes: any[] = script?.scenes || [];
  const title = script?.title || businessName;
  const cta = script?.cta || `Visit ${businessName} today!`;
  const description = script?.description || "";

  // Pick content from scenes intelligently
  const hookText = scenes[0]?.voiceover_line || scenes[0]?.text_overlay || title;
  const hookSub = scenes[0]?.text_overlay || "";

  const valueScenes = scenes.slice(1, Math.min(scenes.length - 1, 4));
  const valueText = valueScenes.length > 0
    ? valueScenes.map((s: any) => s.voiceover_line || s.text_overlay).filter(Boolean).join(" • ")
    : "Quality. Service. Results.";

  const proofStart = Math.min(4, scenes.length - 1);
  const proofScenes = scenes.slice(proofStart, scenes.length - 1);
  const proofText = proofScenes.length > 0
    ? proofScenes.map((s: any) => s.voiceover_line || s.text_overlay).filter(Boolean).join(" • ")
    : "Trusted by our community";

  const lastScene = scenes[scenes.length - 1];
  const ctaText = lastScene?.voiceover_line || cta;
  const ctaSub = lastScene?.text_overlay || script?.cta || "Learn more";

  const blocks: PromoBlock[] = [
    { type: "hook", duration: 5, headline: hookText, subtext: hookSub, imageUrl: images[0] },
    { type: "value", duration: 15, headline: valueText, subtext: description, imageUrl: images[1] || images[0] },
    { type: "proof", duration: 15, headline: proofText, imageUrl: images[2] || images[1] || images[0] },
    { type: "cta", duration: 10, headline: ctaText, subtext: ctaSub, imageUrl: images[images.length - 1] || images[0] },
  ];

  return { blocks, businessName, accentColor, totalDuration: blocks.reduce((s, b) => s + b.duration, 0) };
}

// ── Render template to video blob ──

export async function renderPromoVideo(
  template: PromoTemplate,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const WIDTH = 1080;
  const HEIGHT = 1920;
  const FPS = 30;
  const totalFrames = template.totalDuration * FPS;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // Load images
  const imageUrls = template.blocks.map(b => b.imageUrl).filter(Boolean) as string[];
  const uniqueUrls = [...new Set(imageUrls)];
  const imageCache = new Map<string, HTMLImageElement>();

  await Promise.all(
    uniqueUrls.map(url =>
      new Promise<void>(resolve => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => { imageCache.set(url, img); resolve(); };
        img.onerror = () => resolve();
        img.src = url;
      })
    )
  );

  // Pre-compute block frame ranges
  const blockRanges: { start: number; end: number; block: PromoBlock; index: number }[] = [];
  let cursor = 0;
  for (let i = 0; i < template.blocks.length; i++) {
    const block = template.blocks[i];
    const start = cursor;
    const end = cursor + block.duration * FPS;
    blockRanges.push({ start, end, block, index: i });
    cursor = end;
  }

  // Choose best supported codec
  const mimeType = pickBestMime();

  // Use a promise-based frame-by-frame approach
  const stream = canvas.captureStream(0); // 0 = manual frame capture
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8_000_000, // 8 Mbps for high quality
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const finalMime = mimeType.split(";")[0] || "video/webm";
      resolve(new Blob(chunks, { type: finalMime }));
    };
    recorder.onerror = (e: any) => reject(new Error(`MediaRecorder error: ${e?.error?.message || "unknown"}`));
    recorder.start(1000); // collect data every second

    let frame = 0;

    function renderNextFrame() {
      if (frame >= totalFrames) {
        recorder.stop();
        return;
      }

      const entry = blockRanges.find(r => frame >= r.start && frame < r.end) || blockRanges[blockRanges.length - 1];
      const { block } = entry;
      const localFrame = frame - entry.start;
      const blockFrames = entry.end - entry.start;
      const progress = localFrame / blockFrames;

      const img = block.imageUrl ? imageCache.get(block.imageUrl) : undefined;

      if (img) {
        drawImageKenBurns(ctx, img, WIDTH, HEIGHT, progress, block.type);
      } else {
        const [c1, c2] = GRADIENTS[entry.index % GRADIENTS.length];
        const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
        grad.addColorStop(0, c1);
        grad.addColorStop(1, c2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }

      // Bottom gradient overlay
      const overlay = ctx.createLinearGradient(0, HEIGHT * 0.55, 0, HEIGHT);
      overlay.addColorStop(0, "rgba(0,0,0,0)");
      overlay.addColorStop(0.4, "rgba(0,0,0,0.5)");
      overlay.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = overlay;
      ctx.fillRect(0, HEIGHT * 0.55, WIDTH, HEIGHT * 0.45);

      // Text overlays with fade
      const textAlpha = easeInOut(localFrame, blockFrames);
      ctx.globalAlpha = textAlpha;
      drawWrappedText(ctx, block.headline, WIDTH, HEIGHT, template.accentColor, block.type);

      if (block.subtext) {
        const subSize = Math.round(WIDTH * 0.028);
        ctx.font = `${subSize}px sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.textAlign = "center";
        ctx.fillText(block.subtext, WIDTH / 2, HEIGHT - Math.round(HEIGHT * 0.08), WIDTH * 0.85);
      }
      ctx.globalAlpha = 1;

      // Business name watermark
      const wmSize = Math.round(WIDTH * 0.024);
      ctx.font = `bold ${wmSize}px sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.textAlign = "center";
      ctx.fillText(template.businessName, WIDTH / 2, Math.round(HEIGHT * 0.05));

      // CTA pill
      if (block.type === "cta") {
        drawCtaPill(ctx, WIDTH, HEIGHT, template.accentColor, localFrame, FPS);
      }

      // Request frame capture for manual captureStream(0)
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && "requestFrame" in videoTrack) {
        (videoTrack as any).requestFrame();
      }

      frame++;
      if (frame % FPS === 0) onProgress?.(Math.round((frame / totalFrames) * 100));

      // Use requestAnimationFrame for smoother rendering, fall back to setTimeout
      if (typeof requestAnimationFrame !== "undefined" && document.visibilityState === "visible") {
        requestAnimationFrame(renderNextFrame);
      } else {
        setTimeout(renderNextFrame, 1000 / FPS);
      }
    }

    renderNextFrame();
  });
}

// ── Pick best MIME type ──

function pickBestMime(): string {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4;codecs=avc1",
    "video/mp4",
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "video/webm";
}

// ── Helpers ──

function easeInOut(localFrame: number, totalFrames: number): number {
  const fadeIn = 12;
  const fadeOut = 12;
  if (localFrame < fadeIn) return localFrame / fadeIn;
  if (localFrame > totalFrames - fadeOut) return (totalFrames - localFrame) / fadeOut;
  return 1;
}

function drawImageKenBurns(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  w: number, h: number, progress: number, blockType: string
) {
  const imgRatio = img.width / img.height;
  const canvasRatio = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (imgRatio > canvasRatio) { sw = img.height * canvasRatio; sx = (img.width - sw) / 2; }
  else { sh = img.width / canvasRatio; sy = (img.height - sh) / 2; }

  const zoom = 1 + progress * 0.06;
  const panX = blockType === "hook" ? progress * 15 : blockType === "cta" ? -progress * 15 : 0;
  const panY = blockType === "value" ? progress * 10 : blockType === "proof" ? -progress * 10 : 0;

  ctx.save();
  ctx.translate(w / 2 + panX, h / 2 + panY);
  ctx.scale(zoom, zoom);
  ctx.translate(-w / 2, -h / 2);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  ctx.restore();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D, text: string,
  w: number, h: number, accentColor: string, blockType: string
) {
  const fontSize = blockType === "hook" || blockType === "cta"
    ? Math.round(w * 0.048)
    : Math.round(w * 0.038);
  const maxWidth = w * 0.85;
  ctx.font = `bold ${fontSize}px sans-serif`;

  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);

  const displayLines = lines.slice(0, 4);
  const lineHeight = fontSize * 1.35;
  const blockHeight = displayLines.length * lineHeight;
  const startY = h - Math.round(h * 0.14) - blockHeight;

  const pad = Math.round(w * 0.03);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  const bgX = w / 2 - maxWidth / 2 - pad;
  const bgW = maxWidth + pad * 2;
  const bgY = startY - fontSize * 0.3 - pad;
  const bgH = blockHeight + pad * 2;
  roundRect(ctx, bgX, bgY, bgW, bgH, 16);

  ctx.fillStyle = accentColor;
  ctx.fillRect(bgX, bgY, 4, bgH);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 4;
  for (let i = 0; i < displayLines.length; i++) {
    ctx.fillText(displayLines[i], w / 2, startY + i * lineHeight + fontSize * 0.8);
  }
  ctx.shadowBlur = 0;
}

function drawCtaPill(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  accent: string, localFrame: number, fps: number
) {
  const pulse = 1 + Math.sin(localFrame / (fps * 0.3)) * 0.04;
  const pillW = Math.round(w * 0.5);
  const pillH = Math.round(w * 0.1);
  const x = (w - pillW * pulse) / 2;
  const y = h - Math.round(h * 0.22);

  ctx.save();
  ctx.translate(w / 2, y + pillH / 2);
  ctx.scale(pulse, pulse);
  ctx.translate(-w / 2, -(y + pillH / 2));

  ctx.fillStyle = accent;
  roundRect(ctx, x, y, pillW, pillH, pillH / 2);

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(w * 0.032)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("TAP TO LEARN MORE", w / 2, y + pillH * 0.65);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}
