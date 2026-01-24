"""
Samsara Python Sidecar
Communicates via JSON lines on stdin/stdout.
spaCy model is preloaded at startup for fast inference.
"""
import sys
import json
import os
import spacy


def get_model_path():
    """Get the path to the spaCy model, handling PyInstaller frozen executables."""
    if getattr(sys, 'frozen', False):
        # Running as PyInstaller bundle
        bundle_dir = sys._MEIPASS
        model_path = os.path.join(bundle_dir, 'en_core_web_sm')
        if os.path.exists(model_path):
            return model_path
    # Running as normal Python script - use installed package
    return "en_core_web_sm"


# Preload model at startup (before accepting requests)
# This avoids 2-5 second load time per request
print(json.dumps({"status": "loading_model"}), flush=True)
model_path = get_model_path()
nlp = spacy.load(model_path, disable=["parser", "lemmatizer"])
print(json.dumps({"status": "model_loaded", "model": "en_core_web_sm"}), flush=True)


def handle_request(request: dict) -> dict:
    """Handle a single JSON request and return response."""
    action = request.get('action')
    request_id = request.get('id', 'unknown')

    if action == 'health_check':
        return {
            'id': request_id,
            'success': True,
            'data': {
                'status': 'healthy',
                'model': 'en_core_web_sm',
                'model_loaded': nlp is not None
            }
        }

    if action == 'shutdown':
        sys.exit(0)

    return {
        'id': request_id,
        'success': False,
        'error': f'Unknown action: {action}'
    }


def main():
    """Main loop: read JSON lines from stdin, write responses to stdout."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
            response = handle_request(request)
            print(json.dumps(response), flush=True)
        except json.JSONDecodeError as e:
            error_response = {
                'success': False,
                'error': f'Invalid JSON: {str(e)}'
            }
            print(json.dumps(error_response), flush=True)
        except Exception as e:
            error_response = {
                'success': False,
                'error': str(e)
            }
            print(json.dumps(error_response), flush=True)


if __name__ == '__main__':
    main()
