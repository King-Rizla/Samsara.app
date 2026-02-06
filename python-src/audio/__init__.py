"""
Audio capture module for Samsara.
Provides WASAPI loopback (system audio) and microphone capture.
"""
from .capture import DualStreamCapture
from .recorder import RecordingSession

__all__ = ["DualStreamCapture", "RecordingSession"]
