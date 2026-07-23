from __future__ import annotations

from pathlib import Path
import sys


def package_dir() -> Path:
    '''
    Return the directory containing packaged Web UI assets.

    Works in source trees, editable installs, wheels, and PyInstaller bundles.
    '''
    if getattr(sys, 'frozen', False):
        base = Path(getattr(sys, '_MEIPASS', Path(sys.executable).resolve().parent))
        bundled = base / 'sapro'
        if bundled.is_dir():
            return bundled
        return base
    return Path(__file__).resolve().parent


def index_html_path() -> Path:
    return package_dir() / 'index.html'


def static_dir() -> Path:
    return package_dir() / 'static'


def static_asset_path(filename: str) -> Path:
    return static_dir() / filename
