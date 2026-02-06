"""
Dual-stream audio capture for WASAPI loopback + microphone.
Uses pyaudiowpatch for Windows WASAPI loopback support.
"""
import threading
import wave
from typing import Optional, Callable, Tuple, List
import numpy as np

# Try to import pyaudiowpatch, fallback to pyaudio, then mock
HAS_WPATCH = False
HAS_PYAUDIO = False

try:
    import pyaudiowpatch as pyaudio
    HAS_WPATCH = True
    HAS_PYAUDIO = True
except ImportError:
    try:
        import pyaudio
        HAS_PYAUDIO = True
    except ImportError:
        # Create mock for when neither is available (import-time only)
        class MockPyAudio:
            paInt16 = 8
            paContinue = 0

            def PyAudio(self):
                raise RuntimeError("pyaudiowpatch not installed. Run: pip install pyaudiowpatch")

        pyaudio = MockPyAudio()


class DualStreamCapture:
    """
    Captures both WASAPI loopback (system audio) and microphone input.
    Mixes them into a single audio stream for transcription.

    Uses pyaudiowpatch for WASAPI loopback on Windows.
    Falls back gracefully to mic-only if loopback unavailable.
    """

    CHUNK = 1024
    FORMAT = pyaudio.paInt16
    CHANNELS = 1  # Mono output for transcription
    RATE = 16000  # Whisper prefers 16kHz

    def __init__(self):
        self.p = pyaudio.PyAudio()
        self.loopback_stream: Optional[pyaudio.Stream] = None
        self.mic_stream: Optional[pyaudio.Stream] = None
        self.is_recording = False
        self.frames: List[Tuple[str, np.ndarray]] = []
        self.lock = threading.Lock()
        self.level_callback: Optional[Callable[[str, float], None]] = None

        # Device info
        self.loopback_device: Optional[dict] = None
        self.mic_device: Optional[dict] = None
        self._discover_devices()

    def _discover_devices(self):
        """Find WASAPI loopback and default microphone devices."""
        # Try to get WASAPI loopback device (system audio output)
        if HAS_WPATCH:
            try:
                self.loopback_device = self.p.get_default_wasapi_loopback()
                if self.loopback_device:
                    print(f"[Capture] Loopback device: {self.loopback_device['name']}")
            except Exception as e:
                print(f"[Capture] No loopback device found: {e}")
                self.loopback_device = None
        else:
            print("[Capture] pyaudiowpatch not available, loopback disabled")
            self.loopback_device = None

        # Get default microphone
        try:
            self.mic_device = self.p.get_default_input_device_info()
            if self.mic_device:
                print(f"[Capture] Mic device: {self.mic_device['name']}")
        except Exception as e:
            print(f"[Capture] No mic device found: {e}")
            self.mic_device = None

    def get_devices(self) -> dict:
        """Return device availability info."""
        return {
            "loopback_available": self.loopback_device is not None,
            "mic_available": self.mic_device is not None,
            "loopback_device": self.loopback_device["name"] if self.loopback_device else None,
            "mic_device": self.mic_device["name"] if self.mic_device else None,
        }

    def start_recording(self, level_callback: Optional[Callable[[str, float], None]] = None) -> bool:
        """Start recording from both devices."""
        if self.is_recording:
            return False

        self.level_callback = level_callback
        self.frames = []
        self.is_recording = True

        # Start loopback stream if available
        if self.loopback_device:
            try:
                self.loopback_stream = self.p.open(
                    format=self.FORMAT,
                    channels=self.loopback_device["maxInputChannels"],
                    rate=int(self.loopback_device["defaultSampleRate"]),
                    input=True,
                    input_device_index=self.loopback_device["index"],
                    frames_per_buffer=self.CHUNK,
                    stream_callback=self._loopback_callback,
                )
                print("[Capture] Loopback stream started")
            except Exception as e:
                print(f"[Capture] Failed to open loopback stream: {e}")
                self.loopback_stream = None

        # Start microphone stream
        if self.mic_device:
            try:
                self.mic_stream = self.p.open(
                    format=self.FORMAT,
                    channels=1,
                    rate=self.RATE,
                    input=True,
                    input_device_index=self.mic_device["index"],
                    frames_per_buffer=self.CHUNK,
                    stream_callback=self._mic_callback,
                )
                print("[Capture] Mic stream started")
            except Exception as e:
                print(f"[Capture] Failed to open mic stream: {e}")
                self.mic_stream = None

        # Check if at least one stream is active
        if not self.loopback_stream and not self.mic_stream:
            self.is_recording = False
            return False

        return True

    def _loopback_callback(self, in_data, frame_count, time_info, status):
        """Callback for loopback stream - system audio."""
        if not self.is_recording:
            return (None, pyaudio.paContinue)

        try:
            # Convert to numpy array
            audio_data = np.frombuffer(in_data, dtype=np.int16)

            # Convert to mono if stereo
            if self.loopback_device and self.loopback_device["maxInputChannels"] > 1:
                num_channels = self.loopback_device["maxInputChannels"]
                # Reshape and average channels
                audio_data = audio_data.reshape(-1, num_channels).mean(axis=1).astype(np.int16)

            # Resample if needed (loopback often 44.1kHz/48kHz, Whisper wants 16kHz)
            if self.loopback_device:
                src_rate = int(self.loopback_device["defaultSampleRate"])
                if src_rate != self.RATE:
                    audio_data = self._resample(audio_data, src_rate, self.RATE)

            with self.lock:
                self.frames.append(("loopback", audio_data.copy()))

            # Calculate level for UI
            if self.level_callback and len(audio_data) > 0:
                level = float(np.abs(audio_data).mean()) / 32768.0
                self.level_callback("loopback", level)

        except Exception as e:
            print(f"[Capture] Loopback callback error: {e}")

        return (None, pyaudio.paContinue)

    def _mic_callback(self, in_data, frame_count, time_info, status):
        """Callback for microphone stream."""
        if not self.is_recording:
            return (None, pyaudio.paContinue)

        try:
            audio_data = np.frombuffer(in_data, dtype=np.int16)

            with self.lock:
                self.frames.append(("mic", audio_data.copy()))

            if self.level_callback and len(audio_data) > 0:
                level = float(np.abs(audio_data).mean()) / 32768.0
                self.level_callback("mic", level)

        except Exception as e:
            print(f"[Capture] Mic callback error: {e}")

        return (None, pyaudio.paContinue)

    def _resample(self, audio: np.ndarray, src_rate: int, dst_rate: int) -> np.ndarray:
        """Simple linear resampling."""
        if len(audio) == 0:
            return audio
        duration = len(audio) / src_rate
        target_length = int(duration * dst_rate)
        if target_length == 0:
            return np.array([], dtype=np.int16)
        return np.interp(
            np.linspace(0, len(audio) - 1, target_length),
            np.arange(len(audio)),
            audio,
        ).astype(np.int16)

    def stop_recording(self, output_path: str) -> Tuple[bool, int]:
        """
        Stop recording and save mixed audio to file.
        Returns (success, duration_ms).
        """
        if not self.is_recording:
            return False, 0

        self.is_recording = False

        # Stop streams
        if self.loopback_stream:
            try:
                self.loopback_stream.stop_stream()
                self.loopback_stream.close()
            except Exception as e:
                print(f"[Capture] Error closing loopback stream: {e}")
            self.loopback_stream = None

        if self.mic_stream:
            try:
                self.mic_stream.stop_stream()
                self.mic_stream.close()
            except Exception as e:
                print(f"[Capture] Error closing mic stream: {e}")
            self.mic_stream = None

        # Mix audio
        mixed = self._mix_frames()
        if mixed is None or len(mixed) == 0:
            print("[Capture] No audio frames to save")
            return False, 0

        # Calculate duration
        duration_ms = int(len(mixed) / self.RATE * 1000)

        # Save to WAV
        try:
            with wave.open(output_path, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)  # 16-bit
                wf.setframerate(self.RATE)
                wf.writeframes(mixed.tobytes())
            print(f"[Capture] Saved {duration_ms}ms audio to {output_path}")
            return True, duration_ms
        except Exception as e:
            print(f"[Capture] Failed to save: {e}")
            return False, 0

    def _mix_frames(self) -> Optional[np.ndarray]:
        """Mix loopback and mic frames into single audio stream."""
        with self.lock:
            if not self.frames:
                return None

            # Separate by source
            loopback_frames = [f[1] for f in self.frames if f[0] == "loopback"]
            mic_frames = [f[1] for f in self.frames if f[0] == "mic"]

            # Concatenate each source
            loopback_audio = np.concatenate(loopback_frames) if loopback_frames else np.array([], dtype=np.int16)
            mic_audio = np.concatenate(mic_frames) if mic_frames else np.array([], dtype=np.int16)

            # If only one source, return it directly
            if len(loopback_audio) == 0:
                return mic_audio
            if len(mic_audio) == 0:
                return loopback_audio

            # Align lengths by padding the shorter one
            max_len = max(len(loopback_audio), len(mic_audio))
            if len(loopback_audio) < max_len:
                loopback_audio = np.pad(loopback_audio, (0, max_len - len(loopback_audio)))
            if len(mic_audio) < max_len:
                mic_audio = np.pad(mic_audio, (0, max_len - len(mic_audio)))

            # Mix (average with clipping prevention)
            mixed = (loopback_audio.astype(np.float32) + mic_audio.astype(np.float32)) / 2
            mixed = np.clip(mixed, -32768, 32767).astype(np.int16)

            return mixed

    def cleanup(self):
        """Release audio resources."""
        if self.loopback_stream:
            try:
                self.loopback_stream.close()
            except Exception:
                pass
            self.loopback_stream = None

        if self.mic_stream:
            try:
                self.mic_stream.close()
            except Exception:
                pass
            self.mic_stream = None

        if self.p:
            try:
                self.p.terminate()
            except Exception:
                pass
