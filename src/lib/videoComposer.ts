/**
 * Client-side video composer: takes scene images OR video clips + optional audio
 * and produces a real video using Canvas + MediaRecorder.
 * Supports both image slideshows (Ken Burns) and Runway clip stitching.
 */

/** Draw a styled on-screen caption/subtitle at the bottom of the canvas */
function drawCaption(ctx: CanvasRenderingContext2D, text: string, width: number, height: number) {
  if (!text) return;
  const fontSize = Math.round(width * 0.038);
  const padding = Math.round(width * 0.04);
  const maxWidth = width - padding * 2;
  ctx.font = `bold ${fontSize}px sans-serif`;

  // Word-wrap
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = fontSize * 1.4;
  const blockHeight = lines.length * lineHeight + padding;
  const yStart = height - blockHeight - Math.round(height * 0.12);

  // Semi-transparent background
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  const bgPad = Math.round(padding * 0.6);
  const bgX = padding - bgPad;
  const bgY = yStart - bgPad;
  const bgW = maxWidth + bgPad * 2;
  const bgH = blockHeight + bgPad;
  // Simple rect fallback (roundRect not available everywhere)
  ctx.fillRect(bgX, bgY, bgW, bgH);

  // Text
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 4;
  for (let l = 0; l < lines.length; l++) {
    ctx.fillText(lines[l], width / 2, yStart + l * lineHeight + fontSize);
  }
  ctx.shadowBlur = 0;
}

interface ComposeOptions {
  sceneImages: string[];
  videoClips?: string[];
  voiceoverUrl?: string | null;
  businessName: string;
  title?: string;
  captionText?: string;
  sceneCaptions?: string[];
  durationPerScene?: number;
  width?: number;
  height?: number;
  onProgress?: (pct: number) => void;
}

export async function composeVideo(options: ComposeOptions): Promise<Blob> {
  const {
    sceneImages,
    videoClips,
    voiceoverUrl,
    businessName,
    title,
    sceneCaptions,
    durationPerScene = 4,
    width = 1080,
    height = 1920,
    onProgress,
  } = options;

  // If we have Runway clips, stitch them together
  if (videoClips && videoClips.length > 0) {
    return stitchVideoClips(videoClips, voiceoverUrl, businessName, sceneCaptions, width, height, onProgress);
  }

  // Otherwise fall back to image slideshow
  return composeFromImages(sceneImages, voiceoverUrl, businessName, title, sceneCaptions, durationPerScene, width, height, onProgress);
}

async function stitchVideoClips(
  clipUrls: string[],
  voiceoverUrl: string | null | undefined,
  businessName: string,
  sceneCaptions: string[] | undefined,
  width: number,
  height: number,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const stream = canvas.captureStream(30);

  // Add voiceover audio track if available
  let ttsUtteranceQueue: string[] = [];
  if (voiceoverUrl) {
    try {
      const audioEl = new Audio(voiceoverUrl);
      audioEl.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        audioEl.oncanplaythrough = () => resolve();
        audioEl.onerror = () => reject();
        audioEl.load();
      });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaElementSource(audioEl);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      audioEl.play().catch(() => {});
    } catch {
      console.warn("Could not add voiceover audio");
    }
  } else if (sceneCaptions && sceneCaptions.length > 0 && typeof window !== "undefined" && "speechSynthesis" in window) {
    // Browser TTS fallback — queue captions for speech during playback
    ttsUtteranceQueue = [...sceneCaptions];
    try {
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      // Create an oscillator at zero volume just to get an audio track on the stream
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    } catch {
      // silent fallback
    }
  }

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise<Blob>(async (resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = e => reject(e);
    recorder.start();

    for (let i = 0; i < clipUrls.length; i++) {
      onProgress?.(Math.round((i / clipUrls.length) * 100));

      // Speak the caption for this clip using browser TTS
      if (ttsUtteranceQueue[i] && "speechSynthesis" in window) {
        try {
          const utterance = new SpeechSynthesisUtterance(ttsUtteranceQueue[i]);
          utterance.rate = 0.9;
          utterance.pitch = 1;
          window.speechSynthesis.speak(utterance);
        } catch { /* ignore TTS errors */ }
      }

      try {
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.muted = true; // we use our own audio track
        video.playsInline = true;

        await new Promise<void>((res, rej) => {
          video.oncanplay = () => res();
          video.onerror = () => rej(new Error(`Failed to load clip ${i + 1}`));
          video.src = clipUrls[i];
          video.load();
        });

        video.currentTime = 0;
        await video.play();

        // Draw frames from this clip until it ends
        await new Promise<void>((res) => {
          function drawClipFrame() {
            if (video.ended || video.paused) {
              res();
              return;
            }

            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, width, height);

            // Cover-fit the video
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const vRatio = vw / vh;
            const cRatio = width / height;
            let dw = width, dh = height, dx = 0, dy = 0;
            if (vRatio > cRatio) {
              dw = height * vRatio;
              dx = (width - dw) / 2;
            } else {
              dh = width / vRatio;
              dy = (height - dh) / 2;
            }
            ctx.drawImage(video, dx, dy, dw, dh);

            // Draw on-screen caption for this clip
            const caption = sceneCaptions?.[i];
            if (caption) {
              drawCaption(ctx, caption, width, height);
            }

            requestAnimationFrame(drawClipFrame);
          }
          video.onended = () => res();
          requestAnimationFrame(drawClipFrame);
        });

        video.pause();
        video.src = "";
      } catch (err) {
        console.error(`Clip ${i + 1} playback failed:`, err);
        // Draw a black frame for this clip duration
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#fff";
        ctx.font = `${Math.round(width * 0.04)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(`Scene ${i + 1}`, width / 2, height / 2);
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    onProgress?.(100);
    recorder.stop();
  });
}

async function composeFromImages(
  sceneImages: string[],
  voiceoverUrl: string | null | undefined,
  businessName: string,
  title: string | undefined,
  sceneCaptions: string[] | undefined,
  durationPerScene: number,
  width: number,
  height: number,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  if (sceneImages.length === 0) throw new Error("No scene images to compose");

  const loadedImages = await Promise.all(
    sceneImages.map(
      url => new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
      })
    )
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const stream = canvas.captureStream(30);

  let audioElement: HTMLAudioElement | null = null;
  if (voiceoverUrl) {
    try {
      audioElement = new Audio(voiceoverUrl);
      audioElement.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        audioElement!.oncanplaythrough = () => resolve();
        audioElement!.onerror = () => reject();
        audioElement!.load();
      });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaElementSource(audioElement);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    } catch {
      audioElement = null;
    }
  }

  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

  const totalDuration = sceneImages.length * durationPerScene;
  const fps = 30;
  const totalFrames = totalDuration * fps;
  const framesPerScene = durationPerScene * fps;
  const transitionFrames = Math.min(15, Math.floor(framesPerScene / 4));

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = e => reject(e);
    recorder.start();
    if (audioElement) audioElement.play().catch(() => {});

    let frame = 0;

    function drawFrame() {
      if (frame >= totalFrames) {
        recorder.stop();
        if (audioElement) audioElement.pause();
        return;
      }

      const sceneIndex = Math.min(Math.floor(frame / framesPerScene), loadedImages.length - 1);
      const frameInScene = frame % framesPerScene;

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

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

      const zoomProgress = frameInScene / framesPerScene;
      const zoom = 1 + zoomProgress * 0.05;

      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-width / 2, -height / 2);

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

      // Bottom gradient
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

      // On-screen caption/subtitle for this scene
      const caption = sceneCaptions?.[sceneIndex];
      if (caption) {
        drawCaption(ctx, caption, width, height);
      }

      // Title overlay
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
