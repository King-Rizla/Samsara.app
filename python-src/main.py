"""
Samsara Python Sidecar
Communicates via JSON lines on stdin/stdout.
spaCy model is preloaded at startup for fast inference.
Document parsing available via parse_document action.
CV extraction available via extract_cv action.
"""
import sys
import json
import os
import time
import spacy

from parsers.base import parse_document
from schema.cv_schema import ParsedCV, WorkEntry, EducationEntry, SkillGroup, ContactInfo
from extractors.llm import OllamaClient
from extractors.llm.schemas import LLMFullExtraction
from extractors.llm.prompts import FULL_EXTRACTION_PROMPT
from extractors.contact import extract_contacts
from extractors.sections import detect_sections, get_section_text, get_section_order
from extractors.work_history import extract_work_history
from extractors.education import extract_education
from extractors.skills import extract_skills
from normalizers.dates import normalize_date


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

# Initialize LLM client for hybrid extraction
print(json.dumps({"status": "initializing_llm"}), flush=True)
llm_client = OllamaClient(model="qwen2.5:7b", timeout=120.0, keep_alive="5m")
llm_available = llm_client.is_available()
print(json.dumps({
    "status": "llm_initialized",
    "llm_available": llm_available,
    "model": "qwen2.5:7b" if llm_available else None
}), flush=True)


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
                'model_loaded': nlp is not None,
                'llm_available': llm_available,
                'llm_model': 'qwen2.5:7b' if llm_available else None
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

    if action == 'extract_cv':
        file_path = request.get('file_path')
        if not file_path:
            return {
                'id': request_id,
                'success': False,
                'error': 'Missing required parameter: file_path'
            }

        try:
            start_time = time.perf_counter()

            # First parse the document
            parse_result = parse_document(file_path)
            raw_text = parse_result['raw_text']
            warnings = list(parse_result.get('warnings', []))

            # Detect sections (for section_order and other_sections)
            sections = detect_sections(raw_text)
            section_order = get_section_order(sections)

            # Extraction method tracking
            extraction_method = 'regex'  # Default to regex

            # Try SINGLE unified LLM extraction (1 call instead of 4)
            contact = {}
            work_history = []
            education = []
            skills = []

            if llm_client and llm_client.is_available():
                llm_result = llm_client.extract(
                    text=raw_text,
                    prompt=FULL_EXTRACTION_PROMPT,
                    schema=LLMFullExtraction,
                    temperature=0.0
                )

                if llm_result:
                    extraction_method = 'llm'

                    # Convert LLM contact to ContactInfo
                    if llm_result.contact:
                        contact = ContactInfo(
                            name=llm_result.contact.name,
                            email=llm_result.contact.email,
                            phone=llm_result.contact.phone,
                            address=llm_result.contact.address,
                            linkedin=llm_result.contact.linkedin,
                            github=llm_result.contact.github,
                            portfolio=llm_result.contact.portfolio
                        )

                    # Convert LLM work history to WorkEntry list
                    for entry in llm_result.work_history:
                        work_history.append(WorkEntry(
                            company=entry.company or '',
                            position=entry.position or '',
                            start_date=normalize_date(entry.start_date) if entry.start_date else None,
                            end_date=normalize_date(entry.end_date) if entry.end_date else None,
                            description=entry.description or '',
                            highlights=entry.highlights or [],
                            confidence=0.85
                        ))

                    # Convert LLM education to EducationEntry list
                    for entry in llm_result.education:
                        education.append(EducationEntry(
                            institution=entry.institution or '',
                            degree=entry.degree or '',
                            field_of_study=entry.field_of_study,
                            start_date=normalize_date(entry.start_date) if entry.start_date else None,
                            end_date=normalize_date(entry.end_date) if entry.end_date else None,
                            grade=entry.grade,
                            confidence=0.85
                        ))

                    # Convert LLM skills to SkillGroup list
                    for group in llm_result.skills:
                        if group.skills:  # Only add groups with actual skills
                            skills.append(SkillGroup(
                                category=group.category or 'Skills',
                                skills=group.skills
                            ))

            # Fallback to regex if LLM failed or unavailable
            if extraction_method == 'regex':
                contact, _ = extract_contacts(raw_text, nlp)
                work_history = extract_work_history(raw_text, nlp)
                education = extract_education(raw_text, nlp)
                skills = extract_skills(raw_text)

            # Extract certifications (simple regex - not worth LLM call)
            cert_text = get_section_text(raw_text, sections, 'certifications')
            certifications = []
            if cert_text:
                for line in cert_text.split('\n'):
                    line = line.strip()
                    if line and len(line) > 3:
                        certifications.append(line)

            # Extract languages (simple regex - not worth LLM call)
            lang_text = get_section_text(raw_text, sections, 'languages')
            languages = []
            if lang_text:
                for part in lang_text.replace('\n', ',').split(','):
                    part = part.strip()
                    if part and len(part) > 1:
                        languages.append(part)

            # Calculate overall confidence
            confidences = [0.85 if extraction_method == 'llm' else 0.5]
            if work_history:
                confidences.extend(e.get('confidence', 0.5) for e in work_history)
            if education:
                confidences.extend(e.get('confidence', 0.5) for e in education)

            parse_confidence = round(sum(confidences) / len(confidences), 2) if confidences else 0.0

            # Build other_sections dict
            other_sections = {}
            for section_name in ['summary', 'projects', 'volunteer', 'publications', 'interests', 'references', 'awards']:
                text = get_section_text(raw_text, sections, section_name)
                if text:
                    other_sections[section_name] = text

            elapsed_ms = int((time.perf_counter() - start_time) * 1000)

            # Build ParsedCV response
            parsed_cv: ParsedCV = {
                'contact': contact,
                'work_history': work_history,
                'education': education,
                'skills': skills,
                'certifications': certifications,
                'languages': languages,
                'other_sections': other_sections,
                'raw_text': raw_text,
                'section_order': section_order,
                'parse_confidence': parse_confidence,
                'warnings': warnings,
                'extraction_methods': {
                    'contact': extraction_method,
                    'work_history': extraction_method,
                    'education': extraction_method,
                    'skills': extraction_method,
                    'llm_available': llm_available
                }
            }

            return {
                'id': request_id,
                'success': True,
                'data': {
                    **parsed_cv,
                    'extract_time_ms': elapsed_ms,
                    'document_type': parse_result['document_type'],
                    'page_count': parse_result['page_count']
                }
            }

        except FileNotFoundError as e:
            return {
                'id': request_id,
                'success': False,
                'error': str(e)
            }
        except ValueError as e:
            return {
                'id': request_id,
                'success': False,
                'error': str(e)
            }
        except Exception as e:
            return {
                'id': request_id,
                'success': False,
                'error': f'Unexpected error extracting CV: {str(e)}'
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
