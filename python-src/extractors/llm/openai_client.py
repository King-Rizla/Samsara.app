"""
OpenAI client wrapper for cloud-based CV extraction.

Provides fast, high-quality extraction using GPT-4o-mini.
Requires OPENAI_API_KEY environment variable to be set.
"""
import os
from typing import Optional, Type, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class OpenAIClient:
    """
    Wrapper for OpenAI API with structured output.

    Features:
    - Fast cloud-based inference (2-3 seconds)
    - High accuracy with GPT-4o-mini
    - Structured JSON output via response_format
    - Graceful degradation: returns None on any failure

    Example:
        client = OpenAIClient()
        if client.is_available():
            result = client.extract(text, WORK_HISTORY_PROMPT, LLMWorkHistory)
            if result:
                for entry in result.entries:
                    print(entry.company, entry.position)
    """

    def __init__(
        self,
        model: str = "gpt-4o-mini",
        timeout: float = 30.0,
    ):
        """
        Initialize OpenAIClient.

        Args:
            model: OpenAI model name (default: gpt-4o-mini for cost efficiency)
            timeout: Request timeout in seconds
        """
        self.model = model
        self.timeout = timeout
        self._client = None
        self._available: Optional[bool] = None

    def is_available(self) -> bool:
        """
        Check if OpenAI API is available (API key is set).

        Returns:
            True if OPENAI_API_KEY is set, False otherwise.
        """
        if self._available is not None:
            return self._available

        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            print(f"OpenAI: No API key found in environment", flush=True)
            self._available = False
            return False

        try:
            from openai import OpenAI
            print(f"OpenAI: API key found (length: {len(api_key)}), initializing client...", flush=True)
            self._client = OpenAI(api_key=api_key, timeout=self.timeout)
            self._available = True
            print(f"OpenAI: Client initialized successfully", flush=True)
        except Exception as e:
            print(f"OpenAI: Failed to initialize client: {e}", flush=True)
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
        Extract structured data from text using OpenAI.

        Args:
            text: The CV/resume text to extract from
            prompt: System prompt guiding the extraction
            schema: Pydantic model class defining expected output structure
            temperature: LLM temperature (0.0 for deterministic extraction)

        Returns:
            Parsed Pydantic model instance, or None on any failure.
        """
        if not self.is_available():
            return None

        try:
            # Use OpenAI's structured outputs with the Pydantic schema
            response = self._client.beta.chat.completions.parse(
                model=self.model,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": text},
                ],
                temperature=temperature,
                response_format=schema,
            )

            # The parsed response is already validated
            return response.choices[0].message.parsed

        except Exception as e:
            # Log error for debugging but return None for fallback
            import traceback
            print(f"OpenAI extraction error: {e}", flush=True)
            print(traceback.format_exc(), flush=True)
            return None

    def reset_availability(self) -> None:
        """Reset the cached availability status."""
        self._available = None
        self._client = None
