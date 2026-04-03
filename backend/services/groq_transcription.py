"""
Groq Whisper Transcription Service
Uses Groq's fast Whisper API for speech-to-text transcription.
Supports multilingual audio including Arabic and English.
"""

import os
import logging
import subprocess
import math
from pathlib import Path
from typing import Optional
import requests

logger = logging.getLogger(__name__)

# Groq API limits
MAX_FILE_SIZE_MB = 25  # Free tier limit
CHUNK_DURATION_SECONDS = 600  # 10 minutes per chunk for safety


class GroqTranscriptionError(Exception):
    """Groq transcription error"""
    pass


class GroqTranscriber:
    """Transcribe audio/video files using Groq's Whisper API"""
    
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY", "")
        self.model = os.getenv("GROQ_WHISPER_MODEL", "whisper-large-v3-turbo")
        self.api_url = "https://api.groq.com/openai/v1/audio/transcriptions"
    
    def is_available(self) -> bool:
        """Check if Groq API is configured"""
        return bool(self.api_key and len(self.api_key.strip()) > 0)
    
    def _get_audio_duration(self, file_path: Path) -> float:
        """Get audio duration in seconds using ffprobe"""
        try:
            cmd = [
                'ffprobe', '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                str(file_path)
            ]
            # Use encoding='utf-8' to avoid Windows cp1252 crash on non-ASCII paths
            result = subprocess.run(cmd, capture_output=True, text=True, 
                                   encoding='utf-8', errors='replace', timeout=30)
            if result.returncode == 0:
                import json
                info = json.loads(result.stdout)
                return float(info.get('format', {}).get('duration', 0))
        except Exception as e:
            logger.warning(f"Could not get audio duration: {e}")
        return 0
    
    def _extract_audio(self, video_path: Path, output_dir: Path) -> Path:
        """
        Extract audio from video and convert to FLAC format optimized for Groq API.
        Downsamples to 16kHz mono as recommended.
        Uses ASCII-safe temp filename to avoid Windows encoding issues.
        """
        # Use a safe ASCII filename to avoid Windows cp1252 subprocess crashes
        import hashlib
        safe_name = hashlib.md5(str(video_path).encode('utf-8')).hexdigest()[:12]
        audio_path = output_dir / f"groq_audio_{safe_name}.flac"
        
        if audio_path.exists():
            logger.info(f"Audio file already exists: {audio_path}")
            return audio_path
        
        logger.info(f"Extracting audio from video: {video_path}")
        
        cmd = [
            'ffmpeg',
            '-i', str(video_path),
            '-ar', '16000',      # 16kHz sample rate (Groq recommended)
            '-ac', '1',          # Mono
            '-map', '0:a',       # Only audio
            '-c:a', 'flac',      # FLAC for lossless compression
            '-y',
            str(audio_path)
        ]
        
        # Use encoding='utf-8' to avoid Windows cp1252 crash on non-ASCII paths
        result = subprocess.run(cmd, capture_output=True, text=True,
                               encoding='utf-8', errors='replace', timeout=300)
        
        if result.returncode != 0:
            raise GroqTranscriptionError(f"Audio extraction failed: {result.stderr}")
        
        if not audio_path.exists():
            raise GroqTranscriptionError("Audio extraction failed: output file missing")
        
        file_size_mb = audio_path.stat().st_size / (1024 * 1024)
        logger.info(f"Audio extracted: {audio_path} ({file_size_mb:.1f} MB)")
        
        return audio_path
    
    def _split_audio(self, audio_path: Path, output_dir: Path, chunk_seconds: int = 600) -> list:
        """Split large audio files into chunks"""
        duration = self._get_audio_duration(audio_path)
        
        if duration <= 0:
            logger.warning("Could not determine audio duration, sending as single file")
            return [audio_path]
        
        file_size_mb = audio_path.stat().st_size / (1024 * 1024)
        
        # If file is small enough, no need to split
        if file_size_mb <= MAX_FILE_SIZE_MB:
            return [audio_path]
        
        logger.info(f"Audio file too large ({file_size_mb:.1f}MB), splitting into chunks...")
        
        num_chunks = math.ceil(duration / chunk_seconds)
        chunks = []
        
        for i in range(num_chunks):
            start_time = i * chunk_seconds
            chunk_path = output_dir / f"{audio_path.stem}_chunk{i:03d}.flac"
            
            if chunk_path.exists():
                chunks.append(chunk_path)
                continue
            
            cmd = [
                'ffmpeg',
                '-i', str(audio_path),
                '-ss', str(start_time),
                '-t', str(chunk_seconds),
                '-ar', '16000',
                '-ac', '1',
                '-c:a', 'flac',
                '-y',
                str(chunk_path)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True,
                                   encoding='utf-8', errors='replace', timeout=120)
            
            if result.returncode == 0 and chunk_path.exists():
                chunks.append(chunk_path)
                logger.info(f"Created chunk {i+1}/{num_chunks}: {chunk_path}")
            else:
                logger.error(f"Failed to create chunk {i+1}: {result.stderr}")
        
        return chunks
    
    def _transcribe_file(self, audio_path: Path, language: Optional[str] = None) -> dict:
        """Transcribe a single audio file via Groq API"""
        
        if not self.is_available():
            raise GroqTranscriptionError("Groq API key not configured. Set GROQ_API_KEY in .env")
        
        file_size_mb = audio_path.stat().st_size / (1024 * 1024)
        logger.info(f"Transcribing with Groq Whisper: {audio_path.name} ({file_size_mb:.1f}MB)")
        
        headers = {
            "Authorization": f"Bearer {self.api_key}"
        }
        
        data = {
            "model": self.model,
            "response_format": "verbose_json",
            "timestamp_granularities[]": "segment",
            "temperature": "0"
        }
        
        # Add language hint if specified (improves accuracy and speed)
        if language and language != "auto":
            data["language"] = language
        
        with open(audio_path, "rb") as f:
            files = {
                "file": (audio_path.name, f, "audio/flac")
            }
            
            response = requests.post(
                self.api_url,
                headers=headers,
                data=data,
                files=files,
                timeout=300  # 5 minute timeout for large files
            )
        
        if response.status_code != 200:
            error_detail = response.text
            try:
                error_json = response.json()
                error_detail = error_json.get("error", {}).get("message", response.text)
            except:
                pass
            raise GroqTranscriptionError(
                f"Groq API error ({response.status_code}): {error_detail}"
            )
        
        return response.json()
    
    def _format_timestamp(self, seconds: float) -> str:
        """Format seconds to SRT timestamp format HH:MM:SS,mmm"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"
    
    def _result_to_srt(self, result: dict, time_offset: float = 0) -> list:
        """Convert Groq API result to SRT entries"""
        entries = []
        segments = result.get("segments", [])
        
        for segment in segments:
            start = segment.get("start", 0) + time_offset
            end = segment.get("end", 0) + time_offset
            text = segment.get("text", "").strip()
            
            if text:
                entries.append({
                    "start": start,
                    "end": end,
                    "text": text
                })
        
        return entries
    
    def transcribe_video(
        self,
        video_path: Path,
        output_path: Optional[Path] = None,
        language: Optional[str] = None
    ) -> Path:
        """
        Transcribe a video file and generate SRT subtitle file.
        
        Args:
            video_path: Path to the video file
            output_path: Path for the output SRT file (auto-generated if None)
            language: Language hint (e.g. 'en', 'ar'). None = auto-detect
            
        Returns:
            Path to the generated SRT file
        """
        if not video_path.exists():
            raise GroqTranscriptionError(f"Video file not found: {video_path}")
        
        if not self.is_available():
            raise GroqTranscriptionError(
                "Groq API not configured. Set GROQ_API_KEY in .env file."
            )
        
        # Default output path
        if output_path is None:
            output_path = video_path.parent / f"{video_path.stem}.srt"
        
        output_dir = output_path.parent
        output_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Starting Groq Whisper transcription: {video_path}")
        logger.info(f"Model: {self.model}, Language: {language or 'auto-detect'}")
        
        # Step 1: Extract audio
        audio_path = self._extract_audio(video_path, output_dir)
        
        # Step 2: Split if necessary (Groq has 25MB limit)
        chunks = self._split_audio(audio_path, output_dir)
        
        # Step 3: Transcribe each chunk
        all_entries = []
        chunk_duration = CHUNK_DURATION_SECONDS
        
        for i, chunk_path in enumerate(chunks):
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    time_offset = i * chunk_duration if len(chunks) > 1 else 0
                    
                    # For single file, no offset needed
                    if len(chunks) == 1:
                        time_offset = 0
                    
                    result = self._transcribe_file(chunk_path, language)
                    entries = self._result_to_srt(result, time_offset)
                    all_entries.extend(entries)
                    
                    logger.info(
                        f"Chunk {i+1}/{len(chunks)}: {len(entries)} segments transcribed"
                    )
                    
                    # Detected language
                    detected = result.get("language")
                    if detected:
                        logger.info(f"Detected language: {detected}")
                    
                    break  # Success, move to next chunk
                        
                except Exception as e:
                    error_str = str(e)
                    is_retriable = any(x in error_str for x in ['SSL', 'EOF', 'Connection', 'Timeout', 'timeout'])
                    
                    if is_retriable and attempt < max_retries - 1:
                        wait_time = 10 * (attempt + 1)
                        logger.warning(f"Chunk {i+1} attempt {attempt+1} failed (retriable): {e}. Retrying in {wait_time}s...")
                        import time
                        time.sleep(wait_time)
                        continue
                    
                    logger.error(f"Error transcribing chunk {i+1}: {e}")
                    # Continue with other chunks
                    break
        
        if not all_entries:
            raise GroqTranscriptionError(
                "Transcription produced no results. The audio may be silent or corrupted."
            )
        
        # Step 4: Write SRT file
        srt_content = self._entries_to_srt(all_entries)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(srt_content)
        
        logger.info(
            f"Transcription complete! {len(all_entries)} segments saved to {output_path}"
        )
        
        # Cleanup temporary audio files
        self._cleanup_temp_files(audio_path, chunks)
        
        return output_path
    
    def _entries_to_srt(self, entries: list) -> str:
        """Convert entries list to SRT format string"""
        lines = []
        
        for i, entry in enumerate(entries, 1):
            start_ts = self._format_timestamp(entry["start"])
            end_ts = self._format_timestamp(entry["end"])
            
            lines.append(str(i))
            lines.append(f"{start_ts} --> {end_ts}")
            lines.append(entry["text"])
            lines.append("")  # Blank line separator
        
        return "\n".join(lines)
    
    def _cleanup_temp_files(self, audio_path: Path, chunks: list):
        """Remove temporary audio files"""
        try:
            # Remove extracted audio
            if audio_path.exists() and "_groq_audio" in audio_path.name:
                audio_path.unlink()
                logger.debug(f"Removed temp file: {audio_path}")
            
            # Remove chunk files
            for chunk in chunks:
                if chunk.exists() and "_chunk" in chunk.name:
                    chunk.unlink()
                    logger.debug(f"Removed temp chunk: {chunk}")
        except Exception as e:
            logger.warning(f"Cleanup warning (non-critical): {e}")


# Convenience function
def transcribe_with_groq(
    video_path: Path,
    output_path: Optional[Path] = None,
    language: Optional[str] = None
) -> Path:
    """
    Convenience function to transcribe a video using Groq Whisper API.
    
    Args:
        video_path: Path to video file
        output_path: Output SRT path (auto if None)
        language: Language hint ('en', 'ar', etc.) or None for auto-detect
        
    Returns:
        Path to generated SRT file
    """
    transcriber = GroqTranscriber()
    return transcriber.transcribe_video(video_path, output_path, language)


def is_groq_available() -> bool:
    """Check if Groq API is configured and available"""
    return GroqTranscriber().is_available()
