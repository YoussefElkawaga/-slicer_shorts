"""
Shorts Video Creator Service
Cuts the original video into vertical short-form clips using FFmpeg.
Applies cropping, timing, and basic visual enhancements.
"""

import subprocess
import logging
import json
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class ShortsCreatorError(Exception):
    """Shorts creation error"""
    pass


def get_video_info(video_path: Path) -> dict:
    """Get video metadata using ffprobe."""
    cmd = [
        'ffprobe',
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        str(video_path)
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise ShortsCreatorError(f"ffprobe failed: {result.stderr}")

    return json.loads(result.stdout)


def time_str_to_seconds(time_str: str) -> float:
    """Convert HH:MM:SS.mmm or HH:MM:SS,mmm to seconds."""
    time_str = time_str.replace(',', '.')
    parts = time_str.split(':')
    if len(parts) == 3:
        h, m, s = parts
        return int(h) * 3600 + int(m) * 60 + float(s)
    elif len(parts) == 2:
        m, s = parts
        return int(m) * 60 + float(s)
    return float(time_str)


def seconds_to_time_str(seconds: float) -> str:
    """Convert seconds to HH:MM:SS.mmm format."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}"


def create_short_clip(
    input_video: Path,
    output_path: Path,
    start_time: str,
    end_time: str,
    clip_number: int,
    vertical_crop: bool = True,
    add_padding: bool = True
) -> Path:
    """
    Create a single short clip from the source video.

    Args:
        input_video: Path to source video
        output_path: Path for output clip
        start_time: Start timestamp (HH:MM:SS.mmm)
        end_time: End timestamp (HH:MM:SS.mmm)
        clip_number: Clip index number
        vertical_crop: Whether to crop to 9:16 vertical
        add_padding: Whether to add letterbox padding if needed
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    start_sec = time_str_to_seconds(start_time)
    end_sec = time_str_to_seconds(end_time)
    duration = end_sec - start_sec

    if duration <= 0:
        raise ShortsCreatorError(
            f"Invalid clip duration: {start_time} to {end_time}"
        )

    if duration > 90:
        logger.warning(
            f"Clip {clip_number} is {duration:.1f}s (>90s), trimming to 60s"
        )
        end_sec = start_sec + 60
        duration = 60

    logger.info(
        f"Creating clip {clip_number}: {start_time} -> {end_time} ({duration:.1f}s)"
    )

    # Build FFmpeg filter for vertical format
    if vertical_crop:
        # Get source video dimensions
        try:
            info = get_video_info(input_video)
            video_stream = next(
                (s for s in info.get('streams', []) if s['codec_type'] == 'video'),
                None
            )
            if video_stream:
                src_w = int(video_stream.get('width', 1920))
                src_h = int(video_stream.get('height', 1080))
            else:
                src_w, src_h = 1920, 1080
        except Exception:
            src_w, src_h = 1920, 1080

        # Target: 1080x1920 (9:16)
        target_w, target_h = 1080, 1920
        src_ratio = src_w / src_h
        target_ratio = target_w / target_h  # 0.5625

        if src_ratio > target_ratio:
            # Source is wider - crop sides, or scale+pad
            # Scale to fill height, then crop width
            scale_h = target_h
            scale_w = int(scale_h * src_ratio)
            crop_x = (scale_w - target_w) // 2

            vf = (
                f"scale={scale_w}:{scale_h},"
                f"crop={target_w}:{target_h}:{crop_x}:0,"
                f"setsar=1"
            )
        else:
            # Source is taller or square - scale to fit width, pad top/bottom
            scale_w = target_w
            scale_h = int(scale_w / src_ratio)
            pad_y = (target_h - scale_h) // 2

            vf = (
                f"scale={scale_w}:{scale_h},"
                f"pad={target_w}:{target_h}:0:{pad_y}:black,"
                f"setsar=1"
            )
    else:
        vf = "scale=1080:-2"

    cmd = [
        'ffmpeg',
        '-ss', str(start_sec),
        '-i', str(input_video),
        '-t', str(duration),
        '-vf', vf,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-movflags', '+faststart',
        '-y',
        str(output_path)
    ]

    logger.info(f"Running FFmpeg for clip {clip_number}...")

    result = subprocess.run(
        cmd, capture_output=True, text=True, timeout=300
    )

    if result.returncode != 0:
        logger.error(f"FFmpeg error for clip {clip_number}: {result.stderr[-500:]}")
        raise ShortsCreatorError(
            f"FFmpeg failed for clip {clip_number}: {result.stderr[-200:]}"
        )

    if not output_path.exists():
        raise ShortsCreatorError(
            f"Output file not created for clip {clip_number}"
        )

    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    logger.info(
        f"Clip {clip_number} created: {output_path.name} ({file_size_mb:.1f}MB)"
    )

    return output_path


def create_all_shorts(
    input_video: Path,
    clips: list,
    output_dir: Path
) -> list:
    """
    Create all short clips from AI-suggested clip list.

    Args:
        input_video: Path to source video
        clips: List of clip dicts from AI analyzer (with start_time, end_time, title, etc.)
        output_dir: Directory to save clips

    Returns:
        List of created clip info dicts
    """
    if not input_video.exists():
        raise ShortsCreatorError(f"Source video not found: {input_video}")

    output_dir.mkdir(parents=True, exist_ok=True)
    created_clips = []

    logger.info(f"Creating {len(clips)} short clips from {input_video.name}")

    for i, clip in enumerate(clips):
        clip_num = clip.get('clip_number', i + 1)
        start_time = clip.get('start_time', '00:00:00.000')
        end_time = clip.get('end_time', '00:00:30.000')
        title = clip.get('title', f'Short_{clip_num}')

        # Clean title for filename
        safe_title = "".join(
            c if c.isalnum() or c in (' ', '-', '_') else '_'
            for c in title
        )[:50].strip()

        output_filename = f"short_{clip_num:02d}_{safe_title}.mp4"
        output_path = output_dir / output_filename

        try:
            create_short_clip(
                input_video=input_video,
                output_path=output_path,
                start_time=start_time,
                end_time=end_time,
                clip_number=clip_num
            )

            created_clips.append({
                "clip_number": clip_num,
                "filename": output_filename,
                "path": str(output_path),
                "start_time": start_time,
                "end_time": end_time,
                "title": clip.get('title', ''),
                "hook": clip.get('hook', ''),
                "caption": clip.get('caption', ''),
                "viral_score": clip.get('viral_score', 0),
                "editing_suggestions": clip.get('editing_suggestions', {}),
                "file_size_mb": round(
                    output_path.stat().st_size / (1024 * 1024), 2
                ),
                "status": "success"
            })

        except Exception as e:
            logger.error(f"Failed to create clip {clip_num}: {e}")
            created_clips.append({
                "clip_number": clip_num,
                "title": clip.get('title', ''),
                "start_time": start_time,
                "end_time": end_time,
                "status": "failed",
                "error": str(e)
            })

    success_count = sum(1 for c in created_clips if c['status'] == 'success')
    logger.info(
        f"Shorts creation complete: {success_count}/{len(clips)} clips created"
    )

    return created_clips
