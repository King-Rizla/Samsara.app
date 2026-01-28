"""
Theme configuration module for Blind Profile branding.

Provides theme loading and validation for PDF generation.
Theme colors, fonts, and company details are loaded from theme.json.
"""

import json
import os
import sys
from dataclasses import dataclass
from typing import Optional


@dataclass
class Theme:
    """Theme configuration for Blind Profile PDF generation."""
    primary_color: str
    secondary_color: str
    header_font: str
    body_font: str
    logo_path: Optional[str]
    company_name: str


def get_theme_path() -> str:
    """
    Get path to theme.json, handling PyInstaller frozen context.

    In frozen (packaged) mode, theme.json is in extraResources.
    In development mode, theme.json is in the resources folder.
    """
    if getattr(sys, 'frozen', False):
        # PyInstaller bundle - theme in extraResources
        # Go up from sidecar directory to resources
        base = os.path.dirname(sys.executable)
        return os.path.join(base, '..', 'resources', 'theme.json')
    else:
        # Development - theme in resources folder at project root
        # python-src/export/theme.py -> python-src -> project root
        base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        return os.path.join(base, 'resources', 'theme.json')


def load_theme() -> Theme:
    """
    Load theme from theme.json file.

    Returns default theme values if file is not found or invalid.
    This ensures the app works even without a theme.json file.
    """
    theme_path = get_theme_path()

    # Default theme values (purple terminal aesthetic)
    defaults = {
        'primary_color': '#6B21A8',
        'secondary_color': '#374151',
        'header_font': 'Helvetica-Bold',
        'body_font': 'Helvetica',
        'logo_path': None,
        'company_name': 'Samsara Recruitment'
    }

    try:
        with open(theme_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return Theme(
                primary_color=data.get('primary_color', defaults['primary_color']),
                secondary_color=data.get('secondary_color', defaults['secondary_color']),
                header_font=data.get('header_font', defaults['header_font']),
                body_font=data.get('body_font', defaults['body_font']),
                logo_path=data.get('logo_path'),
                company_name=data.get('company_name', defaults['company_name'])
            )
    except (FileNotFoundError, json.JSONDecodeError, IOError):
        # Return default theme if file not found or invalid
        return Theme(**defaults)
