# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path

SPEC_DIR = Path(SPECPATH).resolve()
PROJECT_ROOT = SPEC_DIR.parent
SRC_DIR = PROJECT_ROOT / 'src'
LAUNCHER = SRC_DIR / 'sapro' / 'launcher.py'

if not LAUNCHER.is_file():
    raise FileNotFoundError(f'Launcher script not found: {LAUNCHER}')

sapro_root = SRC_DIR / 'sapro'

datas = [
    (str(sapro_root / 'index.html'), 'sapro'),
    (str(sapro_root / 'static' / 'style.css'), 'sapro/static'),
    (str(sapro_root / 'static' / 'app.js'), 'sapro/static'),
]

a = Analysis(
    [str(LAUNCHER)],
    pathex=[str(SRC_DIR)],
    binaries=[],
    datas=datas,
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='SimplexSolver',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name='SimplexSolver',
)
