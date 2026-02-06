"""
Recording session state machine for audio capture.
Manages recording lifecycle: idle -> recording -> stopped.
"""
import uuid
import time
from typing import Optional, Callable
from .capture import DualStreamCapture


class RecordingSession:
    """
    Manages a recording session with state machine:
      idle -> recording -> stopped -> idle

    Coordinates DualStreamCapture and tracks session metadata.
    """

    def __init__(self):
        self.capture: Optional[DualStreamCapture] = None
        self.state = "idle"  # idle | recording | stopped
        self.session_id: Optional[str] = None
        self.output_path: Optional[str] = None
        self.started_at: Optional[float] = None
        self.stopped_at: Optional[float] = None
        self.duration_ms: int = 0
        self.level_callback: Optional[Callable[[str, float], None]] = None

    def start(self, output_path: str, level_callback: Optional[Callable[[str, float], None]] = None) -> dict:
        """
        Start a new recording session.

        Args:
            output_path: Path where WAV file will be saved
            level_callback: Optional callback for audio level updates

        Returns:
            { success: bool, session_id?: str, error?: str }
        """
        if self.state == "recording":
            return {"success": False, "error": "Recording already in progress"}

        # Initialize capture if needed
        if not self.capture:
            try:
                self.capture = DualStreamCapture()
            except Exception as e:
                return {"success": False, "error": f"Failed to initialize audio: {str(e)}"}

        # Store callback for level updates
        self.level_callback = level_callback

        # Generate session ID
        self.session_id = str(uuid.uuid4())
        self.output_path = output_path
        self.started_at = time.time()
        self.stopped_at = None
        self.duration_ms = 0

        # Start capture
        success = self.capture.start_recording(level_callback)
        if not success:
            self.session_id = None
            self.output_path = None
            self.started_at = None
            return {"success": False, "error": "Failed to start audio capture (no audio devices available)"}

        self.state = "recording"
        return {"success": True, "session_id": self.session_id}

    def stop(self) -> dict:
        """
        Stop the current recording session.

        Returns:
            { success: bool, audio_path?: str, duration_ms?: int, error?: str }
        """
        if self.state != "recording":
            return {"success": False, "error": "No recording in progress"}

        if not self.capture or not self.output_path:
            return {"success": False, "error": "Invalid recording state"}

        # Stop capture and save
        success, duration_ms = self.capture.stop_recording(self.output_path)

        self.stopped_at = time.time()
        self.duration_ms = duration_ms
        self.state = "stopped"

        if not success:
            return {"success": False, "error": "Failed to save recording"}

        return {
            "success": True,
            "audio_path": self.output_path,
            "duration_ms": self.duration_ms,
            "session_id": self.session_id,
        }

    def get_state(self) -> dict:
        """
        Get current recording state.

        Returns:
            { state: str, session_id?: str, duration_ms?: int }
        """
        result = {"state": self.state}

        if self.session_id:
            result["session_id"] = self.session_id

        # Calculate current duration if recording
        if self.state == "recording" and self.started_at:
            result["duration_ms"] = int((time.time() - self.started_at) * 1000)
        elif self.state == "stopped":
            result["duration_ms"] = self.duration_ms

        return result

    def reset(self):
        """Reset session to idle state (discard any stopped recording)."""
        self.state = "idle"
        self.session_id = None
        self.output_path = None
        self.started_at = None
        self.stopped_at = None
        self.duration_ms = 0

    def cleanup(self):
        """Release all audio resources."""
        if self.capture:
            self.capture.cleanup()
            self.capture = None
        self.reset()

    def check_devices(self) -> dict:
        """
        Check audio device availability.

        Returns:
            { loopback_available: bool, mic_available: bool,
              loopback_device: str?, mic_device: str? }
        """
        # Create temporary capture to check devices
        if not self.capture:
            try:
                temp_capture = DualStreamCapture()
                result = temp_capture.get_devices()
                temp_capture.cleanup()
                return result
            except Exception as e:
                return {
                    "loopback_available": False,
                    "mic_available": False,
                    "loopback_device": None,
                    "mic_device": None,
                    "error": str(e),
                }
        return self.capture.get_devices()
