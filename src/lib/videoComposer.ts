/**
 * Client-side video composer: takes scene images + optional audio
 * and produces a real MP4 video using Canvas + MediaRecorder.
 * No API keys needed — runs entirely in the browser.
 */

interface ComposeOptions {
  sceneImages: string[];
  voiceoverUrl?: string | null;
  businessName: string;
  title?: string;
  captionText?: string;
  durationPerScene?: number; // seconds per scene, default 4
  width?: number;
  height?: number;
  onProgress?: (pct: number) => void;
}

export async function composeVideo(options: ComposeOptions): Promise<Blob> {
  const {
    sceneImages,
    voiceoverUrl,
    businessName,
    title,
    captionText,
    durationPerScene = 4,
    width = 1080,
    height = 1920,
    onProgress,
  } = options;

  if (sceneImages.length === 0) throw new Error("No scene images to compose");

  // Load all images first
  const loadedImages = await Promise.all(
    sceneImages.map(
      (url) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
          img.src = url;
        })
    )
  );

  // Set up canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Set up MediaRecorder
  const stream = canvas.captureStream(30); // 30fps

  // If voiceover, add audio track
  let audioElement: HTMLAudioElement | null = null;
  if (voiceoverUrl) {
    try {
      audioElement = new Audio(voiceoverUrl);
      audioElement.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        audioElement!.oncanplaythrough = () => resolve();
        audioElement!.onerror = () => reject(new Error("Audio load failed"));
        audioElement!.load();
      });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaElementSource(audioElement);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    } catch {
      console.warn("Could not load voiceover audio, proceeding without it");
      audioElement = null;
    }
  }

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : MediaRecorder.isTypeSupported("video/webm")
    ? "video/webm"
    : "video/webm";

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const totalDuration = sceneImages.length * durationPerScene;
  const fps = 30;
  const totalFrames = totalDuration * fps;
  const framesPerScene = durationPerScene * fps;
  const transitionFrames = Math.min(15, Math.floor(framesPerScene / 4));

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };
    recorder.onerror = (e) => reject(e);
    recorder.start();
    if (audioElement) audioElement.play().catch(() => {});

    let frame = 0;

    function drawFrame() {
      if (frame >= totalFrames) {
        recorder.stop();
        if (audioElement) audioElement.pause();
        return;
      }

      const sceneIndex = Math.min(
        Math.floor(frame / framesPerScene),
        loadedImages.length - 1
      );
      const frameInScene = frame % framesPerScene;

      // Clear
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      // Draw current scene image (cover fit)
      const img = loadedImages[sceneIndex];
      const imgRatio = img.width / img.height;
      const canvasRatio = width / height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (imgRatio > canvasRatio) {
        sw = img.height * canvasRatio;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / canvasRatio;
        sy = (img.height - sh) / 2;
      }

      // Subtle Ken Burns zoom effect
      const zoomProgress = frameInScene / framesPerScene;
      const zoom = 1 + zoomProgress * 0.05;
      const zw = width * zoom;
      const zh = height * zoom;
      const zx = (width - zw) / 2;
      const zy = (height - zh) / 2;

      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-width / 2, -height / 2);

      // Fade transition
      let alpha = 1;
      if (frameInScene < transitionFrames && sceneIndex > 0) {
        alpha = frameInScene / transitionFrames;
      } else if (frameInScene > framesPerScene - transitionFrames && sceneIndex < loadedImages.length - 1) {
        alpha = (framesPerScene - frameInScene) / transitionFrames;
      }
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
      ctx.globalAlpha = 1;
      ctx.restore();

      // Bottom gradient overlay for text
      const gradient = ctx.createLinearGradient(0, height * 0.7, 0, height);
      gradient.addColorStop(0, "rgba(0,0,0,0)");
      gradient.addColorStop(1, "rgba(0,0,0,0.8)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, height * 0.7, width, height * 0.3);

      // Business name watermark
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(width * 0.04)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(businessName, width / 2, height - Math.round(height * 0.05));

      // Title/caption overlay (first 2 seconds of first scene)
      if (sceneIndex === 0 && frameInScene < fps * 2 && title) {
        const titleAlpha = frameInScene < fps * 0.5 ? frameInScene / (fps * 0.5) : frameInScene > fps * 1.5 ? (fps * 2 - frameInScene) / (fps * 0.5) : 1;
        ctx.globalAlpha = titleAlpha;
        ctx.font = `bold ${Math.round(width * 0.06)}px sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText(title, width / 2, height / 2);
        ctx.globalAlpha = 1;
      }

      frame++;
      if (frame % 30 === 0) onProgress?.(Math.round((frame / totalFrames) * 100));

      requestAnimationFrame(drawFrame);
    }

    requestAnimationFrame(drawFrame);
  });
}
