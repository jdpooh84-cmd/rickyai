Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get("CREATOMATE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "CREATOMATE_API_KEY not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Reusable animation sets ────────────────────────────────────────────
  const textFade = [
    { time: 0, type: "fade", duration: 0.3 },
    { time: "end", type: "fade", duration: 0.3, reversed: true },
  ];

  const slowFade = [
    { time: 0, type: "fade", duration: 0.5 },
    { time: "end", type: "fade", duration: 0.5, reversed: true },
  ];

  // ── Dark overlay (applied on every image scene) ───────────────────────
  const darkOverlay = {
    type: "shape",
    track: 2,
    time: 0,
    x: "50%", y: "50%",
    x_anchor: "50%", y_anchor: "50%",
    width: "100%", height: "100%",
    path: "M 0 0 L 100 0 L 100 100 L 0 100 L 0 0 Z",
    fill_color: "rgba(0,0,0,0.35)",
  };

  // ── Caption lower-third bar ────────────────────────────────────────────
  const captionBar = {
    type: "shape",
    track: 4,
    time: 0,
    x: "50%", y: "100%",
    x_anchor: "50%", y_anchor: "100%",
    width: "100%", height: "15%",
    path: "M 0 0 L 100 0 L 100 100 L 0 100 L 0 0 Z",
    fill_color: "rgba(0,0,0,0.65)",
    animations: textFade,
  };

  // ── Dark solid background for Intro / CTA ──────────────────────────────
  const solidBg = {
    type: "shape",
    track: 1,
    time: 0,
    x: "50%", y: "50%",
    x_anchor: "50%", y_anchor: "50%",
    width: "100%", height: "100%",
    path: "M 0 0 L 100 0 L 100 100 L 0 100 L 0 0 Z",
    fill_color: "#1a1a2e",
  };

  // ── Logo (reused name so a single modification updates Intro + CTA) ───
  const logoImage = {
    name: "Logo-Image",
    type: "image",
    track: 2,
    time: 0,
    source: "",
    dynamic: true,
    fit: "contain",
    width: "12%",
    x: "97%", y: "95%",
    x_anchor: "100%", y_anchor: "100%",
  };

  // ── Scene composition builder ─────────────────────────────────────────
  const buildScene = (n: number, startTime: number, duration = 8) => ({
    type: "composition",
    track: 3,
    time: startTime,
    duration,
    animations: [
      { time: 0, type: "fade", duration: 0.5 },
      { time: "end", type: "fade", duration: 0.5, reversed: true },
    ],
    elements: [
      // Background image — Ken Burns zoom-in 100% → 108%
      {
        name: `Scene-${n}-Image`,
        type: "image",
        track: 1,
        time: 0,
        source: "",
        dynamic: true,
        fit: "cover",
        x: "50%", y: "50%",
        x_anchor: "50%", y_anchor: "50%",
        width: [
          { time: 0, value: "100%", easing: "linear" },
          { time: "end", value: "108%", easing: "linear" },
        ],
        height: [
          { time: 0, value: "100%", easing: "linear" },
          { time: "end", value: "108%", easing: "linear" },
        ],
      },
      // Dark overlay
      darkOverlay,
      // Main scene text — Montserrat Bold 72px, centered
      {
        name: `Scene-${n}-Text`,
        type: "text",
        track: 3,
        time: 0,
        text: `Scene ${n}`,
        dynamic: true,
        x: "50%", y: "45%",
        x_anchor: "50%", y_anchor: "50%",
        width: "80%", height: "35%",
        fill_color: "#ffffff",
        font_family: "Montserrat",
        font_weight: "700",
        font_size: 72,
        x_alignment: "50%",
        y_alignment: "50%",
        line_height: "110%",
        animations: textFade,
      },
      // Caption bar
      captionBar,
      // Caption text — Montserrat Regular 36px, lower-third
      {
        name: `Scene-${n}-Caption`,
        type: "text",
        track: 5,
        time: 0,
        text: `Caption for scene ${n}`,
        dynamic: true,
        x: "50%", y: "98%",
        x_anchor: "50%", y_anchor: "100%",
        width: "85%", height: "13%",
        fill_color: "#ffffff",
        font_family: "Montserrat",
        font_weight: "400",
        font_size: 36,
        x_alignment: "50%",
        y_alignment: "50%",
        animations: textFade,
      },
    ],
  });

  // ── Full RenderScript ─────────────────────────────────────────────────
  // Timeline:
  //   Intro      0  – 5s   (5s)
  //   Scene-1    5  – 13s  (8s)
  //   Scene-2    13 – 21s  (8s)
  //   Scene-3    21 – 29s  (8s)
  //   Scene-4    29 – 37s  (8s)
  //   Scene-5    37 – 45s  (8s)
  //   Scene-6    45 – 53s  (8s)
  //   CTA-Outro  53 – 60s  (7s)
  //                         ── total: 60s
  const renderScript = {
    output_format: "mp4",
    width: 1920,
    height: 1080,
    frame_rate: "30 fps",
    duration: 60,
    snapshot_time: 15,
    elements: [
      // ── Global Audio ──────────────────────────────────────────────────
      {
        name: "Background-Music",
        type: "audio",
        track: 1,
        time: 0,
        duration: 60,
        source: "",
        dynamic: true,
        volume: 0.2,
        audio_fade_in: 2,
        audio_fade_out: 3,
      },
      {
        name: "Voiceover-Audio",
        type: "audio",
        track: 2,
        time: 0,
        duration: 60,
        source: "",
        dynamic: true,
        audio_fade_in: 0.3,
        audio_fade_out: 0.3,
      },

      // ── INTRO (0–5s) ──────────────────────────────────────────────────
      {
        type: "composition",
        track: 3,
        time: 0,
        duration: 5,
        animations: [
          { time: "end", type: "fade", duration: 0.5, reversed: true },
        ],
        elements: [
          solidBg,
          logoImage,
          // Hook-Text — ExtraBold 80px
          {
            name: "Hook-Text",
            type: "text",
            track: 3,
            time: 0,
            text: "Your Headline Here",
            dynamic: true,
            x: "50%", y: "38%",
            x_anchor: "50%", y_anchor: "50%",
            width: "80%", height: "35%",
            fill_color: "#ffffff",
            font_family: "Montserrat",
            font_weight: "800",
            font_size: 80,
            x_alignment: "50%",
            y_alignment: "50%",
            line_height: "110%",
            animations: slowFade,
          },
          // Business-Name — Bold 56px
          {
            name: "Business-Name",
            type: "text",
            track: 4,
            time: 0.5,
            text: "Your Business Name",
            dynamic: true,
            x: "50%", y: "64%",
            x_anchor: "50%", y_anchor: "50%",
            width: "80%", height: "18%",
            fill_color: "#ffffff",
            font_family: "Montserrat",
            font_weight: "700",
            font_size: 56,
            x_alignment: "50%",
            y_alignment: "50%",
            animations: slowFade,
          },
        ],
      },

      // ── SCENES 1–6 ────────────────────────────────────────────────────
      buildScene(1, 5),
      buildScene(2, 13),
      buildScene(3, 21),
      buildScene(4, 29),
      buildScene(5, 37),
      buildScene(6, 45),

      // ── CTA-OUTRO (53–60s) ────────────────────────────────────────────
      {
        type: "composition",
        track: 3,
        time: 53,
        duration: 7,
        animations: [
          { time: 0, type: "fade", duration: 0.5 },
          { time: "end", type: "fade", duration: 0.5, reversed: true },
        ],
        elements: [
          solidBg,
          // Logo reuses same name — single "Logo-Image" modification covers Intro + CTA
          logoImage,
          // CTA-Text — Bold 64px
          {
            name: "CTA-Text",
            type: "text",
            track: 3,
            time: 0,
            text: "Contact Us Today",
            dynamic: true,
            x: "50%", y: "36%",
            x_anchor: "50%", y_anchor: "50%",
            width: "80%", height: "28%",
            fill_color: "#ffffff",
            font_family: "Montserrat",
            font_weight: "700",
            font_size: 64,
            x_alignment: "50%",
            y_alignment: "50%",
            line_height: "110%",
            animations: slowFade,
          },
          // CTA-Subtext — Regular 36px, secondary line
          {
            name: "CTA-Subtext",
            type: "text",
            track: 4,
            time: 0.5,
            text: "Call or visit us today",
            dynamic: true,
            x: "50%", y: "60%",
            x_anchor: "50%", y_anchor: "50%",
            width: "80%", height: "16%",
            fill_color: "#cccccc",
            font_family: "Montserrat",
            font_weight: "400",
            font_size: 36,
            x_alignment: "50%",
            y_alignment: "50%",
            animations: slowFade,
          },
          // Business-Name — same name as Intro, single modification covers both
          {
            name: "Business-Name",
            type: "text",
            track: 5,
            time: 1,
            text: "Your Business Name",
            dynamic: true,
            x: "50%", y: "78%",
            x_anchor: "50%", y_anchor: "50%",
            width: "80%", height: "14%",
            fill_color: "#ffffff",
            font_family: "Montserrat",
            font_weight: "700",
            font_size: 48,
            x_alignment: "50%",
            y_alignment: "50%",
            animations: slowFade,
          },
        ],
      },
    ],
  };

  // ── POST to Creatomate ────────────────────────────────────────────────
  const resp = await fetch("https://api.creatomate.com/v1/templates", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "RickyAI-Business-Promo-v1",
      source: renderScript,
    }),
  });

  const body = await resp.json();
  console.log("[create-template] Creatomate response:", JSON.stringify(body));

  return new Response(JSON.stringify(body, null, 2), {
    status: resp.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
