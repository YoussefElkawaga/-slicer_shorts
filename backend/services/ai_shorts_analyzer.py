"""
AI Shorts Analyzer Service
Sends video transcript to Claude (via BlazeAI) to identify the best clips
for viral short-form content.
"""

import os
import re
import json
import logging
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class AIAnalysisError(Exception):
    """AI analysis error"""
    pass


def parse_srt_to_text(srt_path: Path) -> str:
    """Parse SRT file into timestamped transcript text for LLM analysis."""
    if not srt_path.exists():
        raise AIAnalysisError(f"SRT file not found: {srt_path}")

    with open(srt_path, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.strip().split('\n')
    transcript_parts = []
    current_time = ""

    for line in lines:
        line = line.strip()
        if '-->' in line:
            # Extract start time
            start = line.split('-->')[0].strip()
            # Convert HH:MM:SS,mmm to simpler format
            current_time = start.replace(',', '.')
        elif line and not line.isdigit() and current_time:
            transcript_parts.append(f"[{current_time}] {line}")

    return '\n'.join(transcript_parts)


def parse_srt_entries(srt_path: Path) -> list:
    """Parse SRT file into structured entries with start/end times."""
    with open(srt_path, 'r', encoding='utf-8') as f:
        content = f.read()

    entries = []
    blocks = re.split(r'\n\s*\n', content.strip())

    for block in blocks:
        lines = block.strip().split('\n')
        if len(lines) >= 3:
            time_line = lines[1]
            if '-->' in time_line:
                parts = time_line.split('-->')
                start = parts[0].strip()
                end = parts[1].strip()
                text = ' '.join(lines[2:])
                entries.append({
                    'start': start,
                    'end': end,
                    'text': text
                })

    return entries


def time_to_seconds(time_str: str) -> float:
    """Convert HH:MM:SS,mmm or HH:MM:SS.mmm to seconds."""
    time_str = time_str.replace(',', '.')
    parts = time_str.split(':')
    if len(parts) == 3:
        h, m, s = parts
        return int(h) * 3600 + int(m) * 60 + float(s)
    elif len(parts) == 2:
        m, s = parts
        return int(m) * 60 + float(s)
    return float(time_str)


def analyze_transcript_for_shorts(
    srt_path: Path,
    video_duration_seconds: float = 0,
    max_clips: int = 10,
    language_hint: str = "auto"
) -> list:
    """
    Send transcript to Claude via BlazeAI API to identify best clips for shorts.

    Returns list of clip suggestions with timestamps, titles, hooks, etc.
    """
    api_key = os.getenv("BLAZEAI_API_KEY", "")
    base_url = os.getenv("BLAZEAI_BASE_URL", "")
    model = os.getenv("BLAZEAI_MODEL", "anthropic/claude-sonnet-4-6")

    if not api_key or not base_url:
        raise AIAnalysisError(
            "BlazeAI API not configured. Set BLAZEAI_API_KEY and BLAZEAI_BASE_URL in .env"
        )

    # Parse transcript
    transcript_text = parse_srt_to_text(srt_path)

    if not transcript_text.strip():
        raise AIAnalysisError("Transcript is empty, cannot analyze")

    # Truncate if too long (keep under ~15k chars for API limits)
    if len(transcript_text) > 15000:
        transcript_text = transcript_text[:15000] + "\n[... transcript truncated ...]"

    logger.info(f"Analyzing transcript ({len(transcript_text)} chars) with {model}...")

    # Build the analysis prompt
    prompt = f"""You are an expert viral content creator and video editor.

Analyze this transcript and identify the BEST segments for short-form vertical video clips (YouTube Shorts, TikTok, Instagram Reels).

TRANSCRIPT:
{transcript_text}

RULES:
- Each clip should be 15-60 seconds long
- Must have a strong hook in the first 1-3 seconds
- Must stand alone without needing full video context
- Focus on: emotional moments, key insights, surprising statements, storytelling peaks
- Avoid: filler content, weak intros, repetitive segments
- Select up to {max_clips} best clips
- Use the EXACT timestamps from the transcript

Return a JSON array of clips. Each clip must have this exact structure:
{{
  "clips": [
    {{
      "clip_number": 1,
      "start_time": "HH:MM:SS.mmm",
      "end_time": "HH:MM:SS.mmm",
      "duration_seconds": 30,
      "title": "Clickbait-worthy title for the short",
      "hook": "The attention-grabbing first sentence",
      "caption": "Engaging caption optimized for social media",
      "transcript_excerpt": "Key quote from this segment",
      "viral_score": 8,
      "editing_suggestions": {{
        "zoom_cuts": "Description of zoom cut moments",
        "text_overlays": "Suggested on-screen text",
        "music_style": "Type of background music",
        "emoji_suggestions": "Relevant emojis to overlay"
      }},
      "why_viral": "Brief explanation of why this segment will perform well"
    }}
  ]
}}

Return ONLY valid JSON, no markdown formatting or code blocks."""

    # Call BlazeAI API (OpenAI-compatible)
    try:
        from openai import OpenAI

        client = OpenAI(
            base_url=base_url,
            api_key=api_key
        )

        logger.info("Sending transcript to AI for analysis...")

        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert viral content strategist. Always respond with valid JSON only."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=4096
        )

        result_text = response.choices[0].message.content.strip()
        logger.info(f"AI response received ({len(result_text)} chars)")

        # Clean up response - remove markdown code blocks if present
        if result_text.startswith('```'):
            result_text = re.sub(r'^```(?:json)?\s*\n?', '', result_text)
            result_text = re.sub(r'\n?```\s*$', '', result_text)

        # Parse JSON
        try:
            parsed = json.loads(result_text)
            clips = parsed.get("clips", parsed if isinstance(parsed, list) else [])
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {e}")
            logger.error(f"Raw response: {result_text[:500]}")
            raise AIAnalysisError(f"AI returned invalid JSON: {e}")

        # Validate and clean up clips
        validated_clips = []
        for clip in clips:
            if not isinstance(clip, dict):
                continue
            if 'start_time' not in clip or 'end_time' not in clip:
                continue

            # Ensure required fields exist
            clip.setdefault('clip_number', len(validated_clips) + 1)
            clip.setdefault('title', f'Clip {clip["clip_number"]}')
            clip.setdefault('hook', '')
            clip.setdefault('caption', '')
            clip.setdefault('viral_score', 5)
            clip.setdefault('duration_seconds', 30)
            clip.setdefault('editing_suggestions', {})
            clip.setdefault('why_viral', '')

            validated_clips.append(clip)

        logger.info(f"AI identified {len(validated_clips)} potential clips")
        return validated_clips

    except ImportError:
        raise AIAnalysisError(
            "OpenAI package not installed. Run: pip install openai"
        )
    except Exception as e:
        if "AIAnalysisError" in type(e).__name__:
            raise
        logger.error(f"AI analysis failed: {e}")
        raise AIAnalysisError(f"AI analysis failed: {str(e)}")
