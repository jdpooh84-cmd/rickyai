/**
 * Fixed 4-block promo video template.
 * Format: 9:16 vertical, 30-45 seconds, MP4.
 * Structure: Hook (0-5s) → Value (5-20s) → Proof (20-35s) → CTA (35-45s).
 * Fallback: clean text + gradient slideshow if assets missing/invalid.
 */

// ── Types ──

export interface PromoBlock {
  /** Block type */
  type: "hook" | "value" | "proof" | "cta";
  /** Duration in seconds */
  duration: number;
  /** Main overlay text */
  headline: string;
  /** Optional sub-line */
  subtext?: string;
  /** Image URL (if available) */
  imageUrl?: string;
}

export interface PromoTemplate {
  blocks: PromoBlock[];
  businessName: string;
  /** Brand accent color hex, default #0EA5E9 */
  accentColor: string;
  /** Total duration in seconds (sum of blocks) */
  totalDuration: number;
}

// ── Gradient presets for text-only fallback ──

const GRADIENTS = [
  ["#0f172a", "#1e3a5f"],   // deep navy
  ["#1a1a2e", "#16213e"],   // midnight
  ["#0c1222", "#1b2838"],   // slate
  ["#1e1b4b", "#312e81"],   // indigo
];

// ── Build template from approved script ──

export function buildPromoTemplate(
  script: any,
  businessName: string,
  images: string[],
  accentColor = "#0EA5E9"
): PromoTemplate {
  const scenes: any[] = script?.scenes || [];

  // Map scenes into 4 blocks with fixed timing
  const hookScene = scenes[0];
  const valueScenes = scenes.slice(1, Math.max(2, Math.ceil(scenes.length * 0.5)));
  const proofScenes = scenes.slice(Math.ceil(scenes.length * 0.5), -1);
  const ctaScene = scenes[scenes.length - 1] || hookScene;

  const blocks: PromoBlock[] = [
    {
      type: "hook",
      duration: 5,
      headline: hookScene?.voiceover_line || script?.title || `${businessName}`,
      subtext: hookScene?.action || "",
      imageUrl: images[0],
    },
    {
      type: "value",
      duration: 15,
      headline: valueScenes.map((s: any) => s?.voiceover_line).filter(Boolean).join(" • ") ||
        "Quality. Service. Results.",
      subtext: script?.description || "",
      imageUrl: images[1] || images[0],
    },
    {
      type: "proof",
      duration: 15,
      headline: proofScenes.map((s: any) => s?.voiceover_line).filter(Boolean).join(" • ") ||
        "Trusted by our community",
      subtext: "",
      imageUrl: images[2] || images[1] || images[0],
    },
    {
      type: "cta",
      duration: 10,
      headline: ctaScene?.voiceover_line || `Visit ${businessName} today!`,
      subtext: script?.cta || "Learn more",
      imageUrl: images[images.length - 1] || images[0],
    },
  ];

  return {
    blocks,
    businessName,
    accentColor,
    totalDuration: blocks.reduce((s, b) => s + b.duration, 0),
  };
}

// ── Render template to video blob ──

export async function renderPromoVideo(
  template: PromoTemplate,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const WIDTH = 540;   // render at half-res for speed
  const HEIGHT = 960;
  const FPS = 15;
  const totalFrames = template.totalDuration * FPS;

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // Load images (silently skip failures)
  const imageUrls = template.blocks.map(b => b.imageUrl).filter(Boolean) as string[];
  const uniqueUrls = [...new Set(imageUrls)];
  const imageCache = new Map<string, HTMLImageElement>();

  await Promise.all(
    uniqueUrls.map(url =>
      new Promise<void>(resolve => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => { imageCache.set(url, img); resolve(); };
        img.onerror = () => resolve(); // skip broken images
        img.src = url;
      })
    )
  );

  // Set up recorder
  const stream = canvas.captureStream(FPS);
  const mimeType = MediaRecorder.isTypeSupported("video/mp4;codecs=avc1")
    ? "video/mp4;codecs=avc1"
    : MediaRecorder.isTypeSupported("video/mp4")
    ? "video/mp4"
    : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  // Pre-compute block frame ranges
  const blockRanges: { start: number; end: number; block: PromoBlock }[] = [];
  let cursor = 0;
  for (const block of template.blocks) {
    const start = cursor;
    const end = cursor + block.duration * FPS;
    blockRanges.push({ start, end, block });
    cursor = end;
  }

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = e => reject(e);
    recorder.start();

    let frame = 0;
    const frameInterval = 1000 / FPS;

    function drawFrame() {
      if (frame >= totalFrames) {
        recorder.stop();
        return;
      }

      // Find current block
      const entry = blockRanges.find(r => frame >= r.start && frame < r.end) || blockRanges[blockRanges.length - 1];
      const { block } = entry;
      const localFrame = frame - entry.start;
      const blockFrames = entry.end - entry.start;
      const progress = localFrame / blockFrames; // 0..1

      const img = block.imageUrl ? imageCache.get(block.imageUrl) : undefined;

      if (img) {
        // ── Draw image with Ken Burns ──
        drawImageKenBurns(ctx, img, WIDTH, HEIGHT, progress, entry.block.type);
      } else {
        // ── Gradient fallback ──
        const gradIdx = blockRanges.indexOf(entry) % GRADIENTS.length;
        const [c1, c2] = GRADIENTS[gradIdx];
        const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
        grad.addColorStop(0, c1);
        grad.addColorStop(1, c2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }

      // ── Bottom safe-zone gradient overlay ──
      const overlay = ctx.createLinearGradient(0, HEIGHT * 0.55, 0, HEIGHT);
      overlay.addColorStop(0, "rgba(0,0,0,0)");
      overlay.addColorStop(0.4, "rgba(0,0,0,0.5)");
      overlay.addColorStop(1, "rgba(0,0,0,0.85)");
      ctx.fillStyle = overlay;
      ctx.fillRect(0, HEIGHT * 0.55, WIDTH, HEIGHT * 0.45);

      // ── Text overlays ──
      const textAlpha = easeInOut(localFrame, blockFrames);
      ctx.globalAlpha = textAlpha;

      // Headline in bottom safe zone
      drawWrappedText(ctx, block.headline, WIDTH, HEIGHT, template.accentColor, block.type);

      // Subtext
      if (block.subtext) {
        const subSize = Math.round(WIDTH * 0.032);
        ctx.font = `${subSize}px sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.textAlign = "center";
        ctx.fillText(block.subtext, WIDTH / 2, HEIGHT - Math.round(HEIGHT * 0.08), WIDTH * 0.85);
      }

      ctx.globalAlpha = 1;

      // ── Business name watermark (top) ──
      const wmSize = Math.round(WIDTH * 0.028);
      ctx.font = `bold ${wmSize}px sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.textAlign = "center";
      ctx.fillText(template.businessName, WIDTH / 2, Math.round(HEIGHT * 0.05));

      // ── Block-type indicator (tiny pill) ──
      if (block.type === "cta") {
        drawCtaPill(ctx, WIDTH, HEIGHT, template.accentColor, localFrame, FPS);
      }

      frame++;
      if (frame % FPS === 0) onProgress?.(Math.round((frame / totalFrames) * 100));
      setTimeout(drawFrame, frameInterval);
    }

    setTimeout(drawFrame, 0);
  });
}

// ── Helpers ──

function easeInOut(localFrame: number, totalFrames: number): number {
  const fadeIn = 8;  // frames
  const fadeOut = 8;
  if (localFrame < fadeIn) return localFrame / fadeIn;
  if (localFrame > totalFrames - fadeOut) return (totalFrames - localFrame) / fadeOut;
  return 1;
}

function drawImageKenBurns(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
  progress: number,
  blockType: string
) {
  const imgRatio = img.width / img.height;
  const canvasRatio = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (imgRatio > canvasRatio) { sw = img.height * canvasRatio; sx = (img.width - sw) / 2; }
  else { sh = img.width / canvasRatio; sy = (img.height - sh) / 2; }

  // Ken Burns: slow zoom + slight pan based on block type
  const zoom = 1 + progress * 0.06;
  const panX = blockType === "hook" ? progress * 10 : blockType === "cta" ? -progress * 10 : 0;
  const panY = blockType === "value" ? progress * 8 : blockType === "proof" ? -progress * 8 : 0;

  ctx.save();
  ctx.translate(w / 2 + panX, h / 2 + panY);
  ctx.scale(zoom, zoom);
  ctx.translate(-w / 2, -h / 2);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  ctx.restore();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  w: number,
  h: number,
  accentColor: string,
  blockType: string
) {
  const fontSize = blockType === "hook" || blockType === "cta"
    ? Math.round(w * 0.055)
    : Math.round(w * 0.042);
  const maxWidth = w * 0.85;
  ctx.font = `bold ${fontSize}px sans-serif`;

  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  // Limit to 4 lines
  const displayLines = lines.slice(0, 4);
  const lineHeight = fontSize * 1.35;
  const blockHeight = displayLines.length * lineHeight;
  const startY = h - Math.round(h * 0.14) - blockHeight;

  // Background pill
  const pad = Math.round(w * 0.03);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  const bgX = w / 2 - maxWidth / 2 - pad;
  const bgW = maxWidth + pad * 2;
  const bgY = startY - fontSize * 0.3 - pad;
  const bgH = blockHeight + pad * 2;
  roundRect(ctx, bgX, bgY, bgW, bgH, 16);

  // Accent bar on left
  ctx.fillStyle = accentColor;
  ctx.fillRect(bgX, bgY, 4, bgH);

  // Text
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
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  accent: string,
  localFrame: number,
  fps: number
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
  ctx.font = `bold ${Math.round(w * 0.035)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("TAP TO LEARN MORE", w / 2, y + pillH * 0.65);
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
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
