"""
Local transcriber using faster-whisper.
Runs on CPU with INT8 quantization for efficiency.
"""
from faster_whisper import WhisperModel
from typing import Optional, Dict, Any
import os


class LocalTranscriber:
    """Local speech-to-text using faster-whisper. Runs on CPU."""

    def __init__(self, model_size: str = "small"):
        """
        Initialize transcription model.

        model_size options:
        - "tiny" - Fastest, lowest accuracy
        - "base" - Good balance for short calls
        - "small" - Recommended for call transcription
        - "medium" - Higher accuracy, slower
        - "large-v3" - Best accuracy, requires more RAM
        """
        self.model_size = model_size
        self.model: Optional[WhisperModel] = None
        self._loaded = False

    def _ensure_loaded(self):
        """Lazy-load model on first use."""
        if self._loaded:
            return

        print(f"[Transcriber] Loading faster-whisper {self.model_size}...")

        # CPU with INT8 quantization for efficiency
        # compute_type options: int8, int8_float16, float16, float32
        self.model = WhisperModel(
            self.model_size,
            device="cpu",
            compute_type="int8",
            download_root=self._get_model_dir()
        )

        self._loaded = True
        print(f"[Transcriber] Model loaded")

    def _get_model_dir(self) -> str:
        """Get model cache directory."""
        # Use app data directory for model storage
        cache_dir = os.environ.get('SAMSARA_MODEL_DIR')
        if cache_dir:
            return cache_dir

        # Fallback to user's home directory
        return os.path.join(os.path.expanduser('~'), '.samsara', 'models')

    def transcribe(self, audio_path: str, language: str = "en") -> Dict[str, Any]:
        """
        Transcribe audio file.

        Returns:
            {
                "text": str,  # Full transcript
                "segments": [{"start": float, "end": float, "text": str}],
                "language": str,
                "duration": float
            }
        """
        self._ensure_loaded()

        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Transcribe with VAD filtering to skip silence
        segments, info = self.model.transcribe(
            audio_path,
            beam_size=5,
            language=language,
            vad_filter=True,
            vad_parameters={
                "min_silence_duration_ms": 500,
                "speech_pad_ms": 200
            },
            word_timestamps=False,  # Segment-level is enough
            condition_on_previous_text=True
        )

        # Collect segments (generator)
        segment_list = []
        full_text_parts = []

        for segment in segments:
            segment_list.append({
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip()
            })
            full_text_parts.append(segment.text.strip())

        return {
            "text": " ".join(full_text_parts),
            "segments": segment_list,
            "language": info.language,
            "duration": round(info.duration, 2)
        }

    def is_available(self) -> bool:
        """Check if transcription is available (model can be loaded)."""
        try:
            self._ensure_loaded()
            return True
        except Exception as e:
            print(f"[Transcriber] Model not available: {e}")
            return False
