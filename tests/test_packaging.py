"""
Tests for portable application packaging support.
"""

from __future__ import annotations

import re
import socket
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

from sapro import launcher, resources

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SPEC_PATH = PROJECT_ROOT / 'packaging' / 'SimplexSolver.spec'
WORKFLOW_PATH = PROJECT_ROOT / '.github' / 'workflows' / 'build-windows.yml'
START_HERE_PATH = PROJECT_ROOT / 'START_HERE.txt'
BUILD_SCRIPT_PATH = PROJECT_ROOT / 'packaging' / 'build-windows.ps1'


def _read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def _repo_python_files() -> list[Path]:
    paths = []
    for directory in (PROJECT_ROOT / 'src', PROJECT_ROOT / 'tests', PROJECT_ROOT / 'packaging'):
        if not directory.exists():
            continue
        for path in directory.rglob('*'):
            if path.suffix in {'.py', '.ps1', '.spec', '.yml', '.yaml', '.toml'}:
                paths.append(path)
    paths.extend([
        PROJECT_ROOT / 'README.md',
        START_HERE_PATH,
    ])
    return paths


# ---------------------------------------------------------------------------
# Launcher
# ---------------------------------------------------------------------------


def test_launcher_uses_localhost():
    assert launcher.DEFAULT_HOST == '127.0.0.1'


def test_launcher_prefers_port_5678():
    assert launcher.DEFAULT_PORT == 5678


def test_launcher_browser_opens_selected_url():
    with patch('sapro.launcher.select_port', return_value=5679), patch(
        'sapro.launcher.run_app'
    ), patch('sapro.launcher.webbrowser.open') as browser_open, patch(
        'sapro.launcher.time.sleep',
        side_effect=KeyboardInterrupt,
    ):
        code = launcher.run_launcher(open_browser=True)
    assert code == 0
    browser_open.assert_called_once_with('http://127.0.0.1:5679', new=2)


def test_launcher_port_fallback_selects_next_available_port():
    occupied = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    occupied.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    occupied.bind(('127.0.0.1', 0))
    occupied_port = occupied.getsockname()[1]
    try:
        with patch('sapro.launcher.DEFAULT_PORT', occupied_port):
            selected = launcher.select_port('127.0.0.1', occupied_port, 5)
        assert selected == occupied_port + 1
    finally:
        occupied.close()


def test_launcher_reports_controlled_error_when_port_range_is_exhausted():
    sockets = []
    base_port = 59000
    try:
        for offset in range(launcher.PORT_RANGE):
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind(('127.0.0.1', base_port + offset))
            sockets.append(sock)
        with pytest.raises(launcher.LauncherError, match='Could not bind to a local port'):
            launcher.select_port('127.0.0.1', base_port, launcher.PORT_RANGE)
    finally:
        for sock in sockets:
            sock.close()


def test_launcher_returns_nonzero_on_startup_failure(capsys):
    with patch('sapro.launcher.select_port', side_effect=launcher.LauncherError('blocked')):
        code = launcher.run_launcher(open_browser=False)
    assert code == 1
    captured = capsys.readouterr()
    assert 'Startup error:' in captured.err


# ---------------------------------------------------------------------------
# Resource loading
# ---------------------------------------------------------------------------


def test_resource_loader_finds_index_html():
    assert resources.index_html_path().is_file()


def test_resource_loader_finds_style_css():
    assert resources.static_asset_path('style.css').is_file()


def test_resource_loader_finds_app_js():
    assert resources.static_asset_path('app.js').is_file()


def test_no_hardcoded_developer_machine_paths():
    pattern = re.compile(r'/Users/[^"\s\'\\]+')
    offenders = []
    for directory in (PROJECT_ROOT / 'src', PROJECT_ROOT / 'packaging'):
        for path in directory.rglob('*'):
            if path.suffix not in {'.py', '.ps1', '.spec', '.toml'}:
                continue
            text = path.read_text(encoding='utf-8')
            if pattern.search(text):
                offenders.append(str(path.relative_to(PROJECT_ROOT)))
    assert offenders == []


def test_resources_support_pyinstaller_bundle_root(tmp_path):
    bundle = tmp_path / 'bundle'
    sapro_dir = bundle / 'sapro'
    static_dir = sapro_dir / 'static'
    static_dir.mkdir(parents=True)
    (sapro_dir / 'index.html').write_text('<html></html>', encoding='utf-8')
    (static_dir / 'style.css').write_text('body {}', encoding='utf-8')
    (static_dir / 'app.js').write_text('console.log(1);', encoding='utf-8')

    with patch.object(sys, 'frozen', True, create=True), patch.object(
        sys, '_MEIPASS', str(bundle), create=True
    ):
        assert resources.index_html_path().is_file()
        assert resources.static_asset_path('style.css').is_file()
        assert resources.static_asset_path('app.js').is_file()


# ---------------------------------------------------------------------------
# Spec, workflow, and distribution files
# ---------------------------------------------------------------------------


def test_spec_includes_required_package_data():
    spec = _read(SPEC_PATH)
    assert 'index.html' in spec
    assert 'style.css' in spec
    assert 'app.js' in spec
    assert "'sapro'" in spec


def test_spec_uses_console_mode():
    assert 'console=True' in _read(SPEC_PATH)


def test_spec_uses_onedir_mode():
    spec = _read(SPEC_PATH)
    assert 'exclude_binaries=True' in spec
    assert 'COLLECT(' in spec
    assert 'onefile' not in spec.lower()


def test_start_here_exists_and_contains_launch_instructions():
    text = _read(START_HERE_PATH)
    assert 'Double-click SimplexSolver.exe' in text
    assert 'No internet connection is required.' in text
    assert 'No Python installation is required.' in text


def test_workflow_uses_windows_latest():
    assert 'windows-latest' in _read(WORKFLOW_PATH)


def test_workflow_is_manually_runnable():
    assert 'workflow_dispatch' in _read(WORKFLOW_PATH)


def test_workflow_runs_tests_before_packaging():
    script = _read(BUILD_SCRIPT_PATH)
    assert 'pytest' in script
    assert script.index('pytest') < script.lower().index('pyinstaller')


def test_workflow_uploads_windows_zip():
    workflow = _read(WORKFLOW_PATH)
    assert 'Simplex-Solver-Windows.zip' in workflow
    assert 'Simplex-Solver-Windows' in workflow


def test_workflow_does_not_require_repository_secrets():
    workflow = _read(WORKFLOW_PATH)
    assert 'secrets.' not in workflow


def test_build_script_creates_zip_from_distribution_folder():
    script = _read(BUILD_SCRIPT_PATH)
    assert 'Simplex-Solver-Windows.zip' in script
    assert 'dist/SimplexSolver' in script.replace('\\', '/')
