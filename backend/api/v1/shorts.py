"""
Shorts Pipeline API
Complete endpoint for creating viral shorts from video.
Flow: Video → Transcribe (Groq Whisper) → Analyze (Claude AI) → Cut Clips (FFmpeg)
"""

import logging
import uuid
import asyncio
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory job tracking
shorts_jobs: dict = {}


class ShortsJobStatus(BaseModel):
    job_id: str
    status: str  # pending, transcribing, analyzing, cutting, completed, failed
    progress: int  # 0-100
    message: str
    clips: list = []
    error: Optional[str] = None


class ShortsFromURLRequest(BaseModel):
    url: str
    max_clips: int = 8
    language: Optional[str] = None  # 'en', 'ar', or None for auto-detect


async def run_shorts_pipeline(
    job_id: str,
    video_path: Path,
    max_clips: int = 8,
    language: Optional[str] = None
):
    """
    Full shorts pipeline (runs in background):
    1. Transcribe with Groq Whisper
    2. Analyze with Claude AI
    3. Cut clips with FFmpeg
    """
    try:
        job = shorts_jobs[job_id]
        output_dir = video_path.parent / "shorts"
        output_dir.mkdir(parents=True, exist_ok=True)

        # ── STEP 1: TRANSCRIBE ──
        job["status"] = "transcribing"
        job["progress"] = 10
        job["message"] = "Transcribing audio with Groq Whisper..."
        logger.info(f"[{job_id}] Step 1: Transcribing...")

        srt_path = video_path.parent / f"{video_path.stem}.srt"

        # Check if SRT already exists
        if not srt_path.exists():
            # Also check for input.srt
            alt_srt = video_path.parent / "input.srt"
            if alt_srt.exists():
                srt_path = alt_srt
            else:
                from backend.services.groq_transcription import GroqTranscriber

                transcriber = GroqTranscriber()
                if transcriber.is_available():
                    srt_path = await asyncio.to_thread(
                        transcriber.transcribe_video,
                        video_path,
                        srt_path,
                        language
                    )
                else:
                    raise Exception(
                        "Groq API not configured. Set GROQ_API_KEY in .env"
                    )
        else:
            logger.info(f"[{job_id}] Using existing SRT: {srt_path}")

        job["progress"] = 35
        job["message"] = "Transcription complete. Analyzing content with AI..."

        # ── STEP 2: ANALYZE WITH AI ──
        job["status"] = "analyzing"
        job["progress"] = 40
        job["message"] = "AI is analyzing transcript for best viral moments..."
        logger.info(f"[{job_id}] Step 2: AI analysis...")

        from backend.services.ai_shorts_analyzer import (
            analyze_transcript_for_shorts
        )

        clips = await asyncio.to_thread(
            analyze_transcript_for_shorts,
            srt_path,
            0,  # video duration (auto from srt)
            max_clips,
            language or "auto"
        )

        if not clips:
            raise Exception("AI analysis returned no clips")

        job["progress"] = 65
        job["message"] = f"AI found {len(clips)} viral moments. Cutting clips..."

        # ── STEP 3: CUT VIDEO INTO SHORTS ──
        job["status"] = "cutting"
        job["progress"] = 70
        job["message"] = f"Creating {len(clips)} short clips with FFmpeg..."
        logger.info(f"[{job_id}] Step 3: Cutting {len(clips)} clips...")

        from backend.services.shorts_creator import create_all_shorts

        created_clips = await asyncio.to_thread(
            create_all_shorts,
            video_path,
            clips,
            output_dir
        )

        # ── DONE ──
        success_count = sum(
            1 for c in created_clips if c.get('status') == 'success'
        )

        job["status"] = "completed"
        job["progress"] = 100
        job["message"] = (
            f"Done! {success_count}/{len(clips)} shorts created successfully."
        )
        job["clips"] = created_clips

        logger.info(
            f"[{job_id}] Pipeline complete: "
            f"{success_count}/{len(clips)} clips"
        )

    except Exception as e:
        logger.error(f"[{job_id}] Pipeline failed: {e}")
        shorts_jobs[job_id]["status"] = "failed"
        shorts_jobs[job_id]["progress"] = 0
        shorts_jobs[job_id]["message"] = f"Failed: {str(e)}"
        shorts_jobs[job_id]["error"] = str(e)


# ─────────────────────────────────────────────────────────────
# API ENDPOINTS
# ─────────────────────────────────────────────────────────────


@router.post("/from-file")
async def create_shorts_from_file(
    background_tasks: BackgroundTasks,
    video_file: UploadFile = File(...),
    max_clips: int = Form(8),
    language: Optional[str] = Form(None)
):
    """
    Upload a video file and create viral shorts from it.
    Returns a job_id to poll for status.
    """
    if not video_file.filename.lower().endswith(
        ('.mp4', '.avi', '.mov', '.mkv', '.webm')
    ):
        raise HTTPException(status_code=400, detail="Invalid video format")

    job_id = str(uuid.uuid4())[:8]

    # Save uploaded file
    from backend.core.config import get_data_directory
    work_dir = Path(get_data_directory()) / "shorts_jobs" / job_id
    work_dir.mkdir(parents=True, exist_ok=True)

    video_path = work_dir / f"input{Path(video_file.filename).suffix}"
    with open(video_path, "wb") as f:
        content = await video_file.read()
        f.write(content)

    # Initialize job
    shorts_jobs[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "progress": 5,
        "message": "Video uploaded. Starting pipeline...",
        "clips": [],
        "error": None,
        "video_path": str(video_path)
    }

    # Run pipeline in background
    background_tasks.add_task(
        run_shorts_pipeline, job_id, video_path, max_clips, language
    )

    return {
        "job_id": job_id,
        "status": "pending",
        "message": "Shorts creation started! Poll /shorts/status/{job_id} for progress."
    }


@router.post("/from-url")
async def create_shorts_from_url(
    request: ShortsFromURLRequest,
    background_tasks: BackgroundTasks
):
    """
    Download a YouTube video and create viral shorts from it.
    Returns a job_id to poll for status.
    """
    job_id = str(uuid.uuid4())[:8]

    from backend.core.config import get_data_directory
    work_dir = Path(get_data_directory()) / "shorts_jobs" / job_id
    work_dir.mkdir(parents=True, exist_ok=True)

    # Initialize job
    shorts_jobs[job_id] = {
        "job_id": job_id,
        "status": "downloading",
        "progress": 0,
        "message": "Downloading video from YouTube...",
        "clips": [],
        "error": None,
        "source_url": request.url
    }

    async def download_and_process():
        try:
            job = shorts_jobs[job_id]
            video_path = work_dir / "input.mp4"

            # Download with yt-dlp Python API (resilient)
            job["progress"] = 5
            job["message"] = "Downloading video..."
            logger.info(f"[{job_id}] Downloading: {request.url}")

            import yt_dlp

            ydl_opts = {
                'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best',
                'merge_output_format': 'mp4',
                'outtmpl': str(video_path),
                'noplaylist': True,
                'quiet': True,
                'no_warnings': True,
                'writesubtitles': False,
                'writeautomaticsub': False,
                'ignoreerrors': True,
                'socket_timeout': 30,
            }

            def do_download():
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([request.url])

            await asyncio.to_thread(do_download)

            if not video_path.exists():
                # yt-dlp may have used a different extension
                possible = list(work_dir.glob("input.*"))
                if possible:
                    video_path = possible[0]
                else:
                    raise Exception("Download failed: no video file created")

            job["progress"] = 10
            job["message"] = "Download complete. Starting shorts pipeline..."
            logger.info(f"[{job_id}] Download complete: {video_path}")

            # Run the main pipeline
            await run_shorts_pipeline(
                job_id, video_path, request.max_clips, request.language
            )

        except Exception as e:
            logger.error(f"[{job_id}] URL pipeline failed: {e}")
            shorts_jobs[job_id]["status"] = "failed"
            shorts_jobs[job_id]["message"] = f"Failed: {str(e)}"
            shorts_jobs[job_id]["error"] = str(e)

    background_tasks.add_task(download_and_process)

    return {
        "job_id": job_id,
        "status": "downloading",
        "message": "Downloading video and creating shorts. Poll /shorts/status/{job_id} for progress."
    }


@router.get("/status/{job_id}")
async def get_shorts_status(job_id: str):
    """Get the status of a shorts creation job."""
    if job_id not in shorts_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = shorts_jobs[job_id]
    return ShortsJobStatus(
        job_id=job["job_id"],
        status=job["status"],
        progress=job["progress"],
        message=job["message"],
        clips=job.get("clips", []),
        error=job.get("error")
    )


@router.get("/jobs")
async def list_shorts_jobs():
    """List all shorts creation jobs."""
    return {
        "jobs": [
            {
                "job_id": j["job_id"],
                "status": j["status"],
                "progress": j["progress"],
                "message": j["message"],
                "clip_count": len(j.get("clips", []))
            }
            for j in shorts_jobs.values()
        ]
    }


@router.get("/download/{job_id}/{clip_index}")
async def download_short_clip(job_id: str, clip_index: int):
    """Download a specific short clip by index."""
    if job_id not in shorts_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = shorts_jobs[job_id]
    clips = job.get("clips", [])

    if clip_index < 0 or clip_index >= len(clips):
        raise HTTPException(status_code=404, detail="Clip not found")

    clip = clips[clip_index]
    if clip.get("status") != "success":
        raise HTTPException(status_code=400, detail="Clip creation failed")

    clip_path = Path(clip["path"])
    if not clip_path.exists():
        raise HTTPException(status_code=404, detail="Clip file not found")

    from fastapi.responses import FileResponse
    return FileResponse(
        str(clip_path),
        media_type="video/mp4",
        filename=clip.get("filename", f"short_{clip_index}.mp4")
    )
