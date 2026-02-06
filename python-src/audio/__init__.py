"""
Audio capture and transcription module for Samsara.
Provides WASAPI loopback (system audio), microphone capture, and local transcription.
"""
from .capture import DualStreamCapture
from .recorder import RecordingSession
from .transcriber import LocalTranscriber

__all__ = ["DualStreamCapture", "RecordingSession", "LocalTranscriber"]
