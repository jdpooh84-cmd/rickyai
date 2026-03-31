#!/usr/bin/env python3
"""
Video Rendering Skill — Render Remotion compositions directly in the sandbox.
Accepts a JSON scene description and outputs an MP4.

Usage:
  python render_video.py /tmp/video-spec.json
"""

import json
import os
import subprocess
import sys
import tempfile


def generate_remotion_component(spec):
    """Generate a React component from the video spec."""
    scenes = spec.get("scenes", [])
    fps = spec.get("fps", 30)
    width = spec.get("width", 1080)
    height = spec.get("height", 1920)

    scene_components = []
    total_frames = 0

    for i, scene in enumerate(scenes):
        duration_s = scene.get("duration_seconds", 5)
        frames = duration_s * fps
        bg = scene.get("background", "#1a1a2e")
        text = scene.get("text", "")
        text_style = scene.get("text_style", {})
        font = text_style.get("font", "Montserrat")
        size = text_style.get("size", 64)
        color = text_style.get("color", "#ffffff")
        animation = scene.get("animation", "fade")
        image = scene.get("image")

        scene_code = f"""
    {{/* Scene {i + 1} */}}
    <Sequence from={{{total_frames}}} durationInFrames={{{frames}}}>
      <AbsoluteFill style={{{{backgroundColor: '{bg}', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}}}>
        {f'<Img src={{{json.dumps(image)}}} style={{{{maxWidth: "80%", maxHeight: "60%", objectFit: "contain"}}}} />' if image else ''}
        <div style={{{{
          fontFamily: '{font}',
          fontSize: {size},
          color: '{color}',
          textAlign: 'center',
          padding: '0 40px',
          opacity: interpolate(frame - {total_frames}, [0, {min(fps, frames)}], [0, 1], {{extrapolateRight: 'clamp'}}),
          {f"transform: `translateY(${{interpolate(frame - {total_frames}, [0, {min(fps, frames)}], [50, 0], {{extrapolateRight: 'clamp'}})}}px)`" if animation == 'slide-up' else ''}
        }}}}>
          {text}
        </div>
      </AbsoluteFill>
    </Sequence>"""
        scene_components.append(scene_code)
        total_frames += frames

    return f"""
import {{AbsoluteFill, Sequence, Img, interpolate, useCurrentFrame}} from 'remotion';

export const DynamicVideo = () => {{
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {''.join(scene_components)}
    </AbsoluteFill>
  );
}};
""", total_frames


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python render_video.py <spec.json>"}))
        sys.exit(1)

    spec_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "/mnt/documents/rendered-video.mp4"

    try:
        with open(spec_path, "r") as f:
            spec = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(json.dumps({"error": f"Failed to load spec: {str(e)}"}))
        sys.exit(1)

    fps = spec.get("fps", 30)
    width = spec.get("width", 1080)
    height = spec.get("height", 1920)

    print(f"🎬 Generating video component from spec...")
    component_code, total_frames = generate_remotion_component(spec)

    # Write the dynamic component
    component_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "remotion", "src", "DynamicVideo.tsx")
    component_path = os.path.normpath(component_path)

    os.makedirs(os.path.dirname(component_path), exist_ok=True)
    with open(component_path, "w") as f:
        f.write(component_code)

    print(f"  Component written to: {component_path}")
    print(f"  Total frames: {total_frames} ({total_frames / fps:.1f}s at {fps}fps)")
    print(f"  Resolution: {width}x{height}")

    # Update Root.tsx to use DynamicVideo
    root_path = os.path.join(os.path.dirname(component_path), "Root.tsx")
    root_code = f"""
import {{Composition}} from 'remotion';
import {{DynamicVideo}} from './DynamicVideo';

export const RemotionRoot = () => {{
  return (
    <Composition
      id="dynamic"
      component={{DynamicVideo}}
      durationInFrames={{{total_frames}}}
      fps={{{fps}}}
      width={{{width}}}
      height={{{height}}}
    />
  );
}};
"""
    with open(root_path, "w") as f:
        f.write(root_code)

    # Run the Remotion render
    remotion_dir = os.path.normpath(os.path.join(os.path.dirname(component_path), ".."))
    print(f"\n🎥 Rendering video via Remotion...")

    render_cmd = [
        "npx", "remotion", "render",
        "dynamic",
        output_path,
        "--codec", "h264",
        "--concurrency", "1",
    ]

    try:
        result = subprocess.run(
            render_cmd, cwd=remotion_dir,
            capture_output=True, text=True, timeout=300
        )
        if result.returncode == 0:
            print(f"\n✅ Video rendered to: {output_path}")
            print(output_path)
        else:
            print(f"\n❌ Render failed: {result.stderr}")
            sys.exit(1)
    except subprocess.TimeoutExpired:
        print(json.dumps({"error": "Render timed out after 5 minutes"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
