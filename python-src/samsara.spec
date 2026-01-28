# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for Samsara Python sidecar.

CRITICAL: spaCy requires explicit hidden imports that PyInstaller
cannot detect via static analysis. Missing any of these causes
runtime import errors in the bundled application.

Parsing libraries (PyMuPDF, pdfplumber, python-docx) also require
hidden imports for their dependencies (Pillow, charset_normalizer).
"""
import spacy
import en_core_web_sm
from PyInstaller.utils.hooks import collect_data_files, collect_submodules

block_cipher = None

# Collect all spaCy data and submodules
spacy_datas = collect_data_files('spacy')
thinc_datas = collect_data_files('thinc')

# Collect model data - get the actual model data directory (the versioned folder)
import os
model_pkg_path = en_core_web_sm.__path__[0]
# The actual model files are in a versioned subdirectory like en_core_web_sm-3.8.0
model_data_path = None
for item in os.listdir(model_pkg_path):
    if item.startswith('en_core_web_sm-') and os.path.isdir(os.path.join(model_pkg_path, item)):
        model_data_path = os.path.join(model_pkg_path, item)
        break
if model_data_path is None:
    raise RuntimeError(f"Could not find model data in {model_pkg_path}")

a = Analysis(
    ['main.py'],
    pathex=[],
    binaries=[],
    datas=[
        *spacy_datas,
        *thinc_datas,
        (model_data_path, 'en_core_web_sm'),
    ],
    hiddenimports=[
        # spaCy core hidden imports
        'srsly.msgpack.util',
        'cymem',
        'cymem.cymem',
        'preshed.maps',
        'thinc.backends.linalg',
        'blis',
        'spacy.lang.en',
        'spacy_legacy',
        # Additional thinc imports
        'thinc.api',
        'thinc.config',
        'thinc.layers',
        'thinc.model',
        'thinc.shims',
        'thinc.types',
        'thinc.util',
        # Catalogue for spaCy registry
        'catalogue',
        # Confection for config
        'confection',
        # Wasabi for logging
        'wasabi',
        # PyMuPDF hidden imports (fitz compatibility layer)
        'pymupdf',
        'pymupdf.utils',
        # pdfplumber uses Pillow and pdfminer
        'PIL',
        'PIL._imaging',
        'pdfminer',
        'pdfminer.pdfparser',
        'pdfminer.pdfdocument',
        'pdfminer.pdfpage',
        'pdfminer.pdfinterp',
        'pdfminer.converter',
        'pdfminer.layout',
        # python-docx dependencies
        'docx',
        'docx.oxml',
        'lxml',
        'lxml.etree',
        # charset detection for various encodings
        'charset_normalizer',
        # ReportLab for Blind Profile PDF generation
        'reportlab',
        'reportlab.lib',
        'reportlab.lib.utils',
        'reportlab.lib.colors',
        'reportlab.lib.pagesizes',
        'reportlab.lib.units',
        'reportlab.lib.styles',
        'reportlab.platypus',
        'reportlab.pdfbase',
        'reportlab.pdfbase.pdfmetrics',
        'reportlab.pdfbase._fontdata',
        # OpenAI API client
        'openai',
        'httpx',
        'httpcore',
        'h11',
        'anyio',
        'sniffio',
        'distro',
    ] + collect_submodules('spacy') + collect_submodules('thinc') + collect_submodules('blis') + collect_submodules('pdfminer') + collect_submodules('openai'),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='samsara-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,  # UPX often causes issues with spaCy
    console=True,  # Keep console for stdio IPC
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='samsara-backend',
)
