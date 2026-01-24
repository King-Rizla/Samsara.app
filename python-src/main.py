"""
Samsara Python Sidecar
Communicates via JSON lines on stdin/stdout.
spaCy model is preloaded at startup for fast inference.
Document parsing available via parse_document action.
"""
import sys
import json
import os
import spacy

from parsers.base import parse_document


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

    if action == 'parse_document':
        file_path = request.get('file_path')
        if not file_path:
            return {
                'id': request_id,
                'success': False,
                'error': 'Missing required parameter: file_path'
            }

        try:
            result = parse_document(file_path)
            # Ensure all data is JSON-serializable
            # Convert tuple bboxes to lists
            serializable_blocks = []
            for block in result.get('blocks', []):
                block_copy = dict(block)
                if 'bbox' in block_copy and isinstance(block_copy['bbox'], tuple):
                    block_copy['bbox'] = list(block_copy['bbox'])
                serializable_blocks.append(block_copy)

            return {
                'id': request_id,
                'success': True,
                'data': {
                    'raw_text': result['raw_text'],
                    'blocks': serializable_blocks,
                    'tables': result['tables'],
                    'warnings': result['warnings'],
                    'parse_time_ms': result['parse_time_ms'],
                    'document_type': result['document_type'],
                    'page_count': result['page_count']
                }
            }
        except FileNotFoundError as e:
            return {
                'id': request_id,
                'success': False,
                'error': str(e)
            }
        except ValueError as e:
            # Unsupported file type or DOC format
            return {
                'id': request_id,
                'success': False,
                'error': str(e)
            }
        except RuntimeError as e:
            # Parsing errors (encrypted PDF, etc.)
            return {
                'id': request_id,
                'success': False,
                'error': str(e)
            }
        except Exception as e:
            return {
                'id': request_id,
                'success': False,
                'error': f'Unexpected error parsing document: {str(e)}'
            }

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
