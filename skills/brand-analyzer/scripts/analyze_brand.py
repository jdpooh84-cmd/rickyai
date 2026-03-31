#!/usr/bin/env python3
"""
Brand Asset Analyzer — Extract color palettes, font identification, layout patterns,
and Tailwind CSS config from uploaded brand images.

Usage:
  python analyze_brand.py /tmp/logo.png /tmp/screenshot.png --output /mnt/documents/brand-tokens.json
"""

import argparse
import base64
import json
import os
import sys

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print(json.dumps({"error": "Pillow and numpy required. Install: pip install Pillow numpy"}))
    sys.exit(1)

try:
    from sklearn.cluster import KMeans
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

try:
    import requests
except ImportError:
    print(json.dumps({"error": "requests library required"}))
    sys.exit(1)


def extract_dominant_colors(image_path, n_colors=6):
    """Extract dominant colors from an image using k-means clustering."""
    img = Image.open(image_path).convert("RGB")
    img = img.resize((150, 150))
    pixels = np.array(img).reshape(-1, 3)

    if HAS_SKLEARN:
        kmeans = KMeans(n_clusters=n_colors, random_state=42, n_init=10)
        kmeans.fit(pixels)
        colors = kmeans.cluster_centers_.astype(int)
        labels = kmeans.labels_
        counts = np.bincount(labels)
        sorted_indices = np.argsort(-counts)
        colors = colors[sorted_indices]
    else:
        # Fallback: simple histogram-based extraction
        from collections import Counter
        quantized = [(int(r // 32) * 32, int(g // 32) * 32, int(b // 32) * 32) for r, g, b in pixels]
        counter = Counter(quantized)
        colors = np.array([list(c) for c, _ in counter.most_common(n_colors)])

    hex_colors = [f"#{r:02x}{g:02x}{b:02x}" for r, g, b in colors]
    return hex_colors


def rgb_to_hsl(hex_color):
    """Convert hex to HSL string for Tailwind."""
    hex_color = hex_color.lstrip("#")
    r, g, b = int(hex_color[:2], 16) / 255, int(hex_color[2:4], 16) / 255, int(hex_color[4:], 16) / 255
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2

    if mx == mn:
        h = s = 0
    else:
        d = mx - mn
        s = d / (2 - mx - mn) if l > 0.5 else d / (mx + mn)
        if mx == r:
            h = (g - b) / d + (6 if g < b else 0)
        elif mx == g:
            h = (b - r) / d + 2
        else:
            h = (r - g) / d + 4
        h /= 6

    return f"{round(h * 360)} {round(s * 100)}% {round(l * 100)}%"


def image_to_base64(image_path):
    """Convert image to base64 for vision API."""
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def analyze_with_vision(image_paths):
    """Use Lovable AI vision model to identify fonts and style patterns."""
    api_key = os.environ.get("LOVABLE_API_KEY")
    if not api_key:
        return {"fonts": {}, "style_notes": "LOVABLE_API_KEY not available for vision analysis"}

    content = [{"type": "text", "text": """Analyze these brand images and identify:
1. Font families used (display/heading font and body font) with confidence levels
2. Overall design style (minimalist, bold, playful, corporate, etc.)
3. Layout patterns (spacing density, alignment preferences)
4. Recommended Tailwind CSS configuration snippets

Return JSON with: fonts (display, body, accent), style_notes, layout_patterns, tailwind_suggestions"""}]

    for path in image_paths:
        ext = os.path.splitext(path)[1].lower().lstrip(".")
        mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"}.get(ext, "image/png")
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:{mime};base64,{image_to_base64(path)}"}
        })

    try:
        resp = requests.post(
            "https://ai.gateway.lovable.dev/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "google/gemini-2.5-flash",
                "messages": [{"role": "user", "content": content}],
                "response_format": {"type": "json_object"},
            },
            timeout=60,
        )
        if resp.ok:
            return json.loads(resp.json()["choices"][0]["message"]["content"])
    except Exception as e:
        return {"error": f"Vision analysis failed: {str(e)}"}

    return {}


def main():
    parser = argparse.ArgumentParser(description="Brand Asset Analyzer")
    parser.add_argument("images", nargs="+", help="Image file paths to analyze")
    parser.add_argument("--output", "-o", default="/mnt/documents/brand-tokens.json", help="Output path")
    parser.add_argument("--colors", type=int, default=6, help="Number of colors to extract")

    args = parser.parse_args()

    print(f"Analyzing {len(args.images)} brand images...")

    all_colors = []
    for img_path in args.images:
        if not os.path.exists(img_path):
            print(f"  ⚠️ Skipping missing file: {img_path}")
            continue
        print(f"  Extracting colors from: {img_path}")
        colors = extract_dominant_colors(img_path, args.colors)
        all_colors.extend(colors)

    # Deduplicate and pick top colors
    seen = []
    for c in all_colors:
        if c not in seen:
            seen.append(c)
    top_colors = seen[:args.colors]

    # Assign semantic roles
    color_roles = {}
    role_names = ["primary", "secondary", "accent", "background", "foreground", "muted"]
    for i, color in enumerate(top_colors):
        if i < len(role_names):
            color_roles[role_names[i]] = {"hex": color, "hsl": rgb_to_hsl(color)}

    # Vision analysis for fonts and style
    print("  Running vision analysis for fonts and style...")
    vision_data = analyze_with_vision(args.images)

    result = {
        "colors": color_roles,
        "fonts": vision_data.get("fonts", {}),
        "style_notes": vision_data.get("style_notes", ""),
        "layout_patterns": vision_data.get("layout_patterns", ""),
        "tailwind_config_snippet": {
            "theme": {
                "extend": {
                    "colors": {name: data["hsl"] for name, data in color_roles.items()},
                }
            }
        },
    }

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w") as f:
        json.dump(result, f, indent=2)

    print(f"\n✅ Brand tokens written to {args.output}")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
