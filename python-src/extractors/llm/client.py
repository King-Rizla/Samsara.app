"""
Ollama client wrapper for LLM-based CV extraction.

Provides health checks, structured output via Pydantic schemas,
and graceful fallback when Ollama is unavailable.
"""
from typing import Optional, Type, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class OllamaClient:
    """
    Wrapper for Ollama with health checks and structured output.

    Features:
    - Lazy initialization: only connects when first needed
    - Availability detection: checks if Ollama is running and model is pulled
    - Structured output: uses Pydantic schemas for type-safe extraction
    - Graceful degradation: returns None on any failure (for fallback)

    Example:
        client = OllamaClient()
        if client.is_available():
            result = client.extract(text, WORK_HISTORY_PROMPT, LLMWorkHistory)
            if result:
                for entry in result.entries:
                    print(entry.company, entry.position)
    """

    def __init__(
        self,
        model: str = "qwen2.5:7b",
        timeout: float = 60.0,
        keep_alive: str = "5m",
    ):
        """
        Initialize OllamaClient.

        Args:
            model: Ollama model name (default: qwen2.5:7b for structured output)
            timeout: Request timeout in seconds (60s recommended for 7B models)
            keep_alive: How long to keep model loaded (default: 5 minutes)
        """
        self.model = model
        self.timeout = timeout
        self.keep_alive = keep_alive
        self._client = None
        self._available: Optional[bool] = None

    def is_available(self) -> bool:
        """
        Check if Ollama is running and the configured model is available.

        Caches the result to avoid repeated checks within the same session.
        Uses a short timeout (5s) for the health check.

        Returns:
            True if Ollama is running and model is available, False otherwise.
            Never raises exceptions - returns False on any error.
        """
        if self._available is not None:
            return self._available

        try:
            # Import here to allow graceful failure if ollama not installed
            from ollama import Client

            # Use short timeout for health check
            health_client = Client(timeout=5.0)
            models_response = health_client.list()

            # Check if our model is available
            # Models can have tags like "qwen2.5:7b-instruct-q4_K_M"
            # so we match on base model name
            base_model = self.model.split(":")[0]
            model_names = [m.model for m in models_response.models]

            self._available = any(m.startswith(base_model) for m in model_names)

            if self._available:
                # Create the actual client with full timeout
                self._client = Client(timeout=self.timeout)

        except Exception:
            # Ollama not installed, not running, or other error
            self._available = False

        return self._available

    def extract(
        self,
        text: str,
        prompt: str,
        schema: Type[T],
        temperature: float = 0.0,
    ) -> Optional[T]:
        """
        Extract structured data from text using LLM.

        Args:
            text: The CV/resume text to extract from
            prompt: System prompt guiding the extraction
            schema: Pydantic model class defining expected output structure
            temperature: LLM temperature (0.0 for deterministic extraction)

        Returns:
            Parsed Pydantic model instance, or None on any failure.
            Never raises exceptions - returns None for fallback handling.
        """
        if not self.is_available():
            return None

        try:
            response = self._client.chat(
                model=self.model,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": text},
                ],
                format=schema.model_json_schema(),
                options={
                    "temperature": temperature,
                    "keep_alive": self.keep_alive,
                },
            )

            # Parse and validate the response
            return schema.model_validate_json(response.message.content)

        except Exception:
            # LLM error, validation error, timeout, etc.
            # Return None to trigger fallback to regex extraction
            return None

    def reset_availability(self) -> None:
        """
        Reset the cached availability status.

        Call this if Ollama status may have changed (e.g., user just installed it).
        """
        self._available = None
        self._client = None
