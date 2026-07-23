"""
Tests for portable application packaging support.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from sapro import launcher, resources

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SPEC_PATH = PROJECT_ROOT / 'packaging' / 'SimplexSolver.spec'
WORKFLOW_PATH = PROJECT_ROOT / '.github' / 'workflows' / 'build-windows.yml'
START_HERE_PATH = PROJECT_ROOT / 'START_HERE.txt'
BUILD_SCRIPT_PATH = PROJECT_ROOT / 'packaging' / 'build-windows.ps1'


def _read(path: Path) -> str:
    return path.read_text(encoding='utf-8')


def _parse_spec_paths() -> dict[str, Path]:
    spec_globals = {'Path': Path, 'SPECPATH': str(SPEC_PATH.parent)}
    setup_lines = []
    for line in _read(SPEC_PATH).splitlines():
        if line.startswith('a = Analysis'):
            break
        setup_lines.append(line)
    exec('\n'.join(setup_lines), spec_globals)  # noqa: S102 - controlled packaging spec under test
    return {
        'spec_dir': spec_globals['SPEC_DIR'],
        'project_root': spec_globals['PROJECT_ROOT'],
        'src_dir': spec_globals['SRC_DIR'],
        'launcher': spec_globals['LAUNCHER'],
    }


# ---------------------------------------------------------------------------
# Launcher
# ---------------------------------------------------------------------------


def test_launcher_uses_localhost():
    assert launcher.DEFAULT_HOST == '127.0.0.1'


def test_launcher_prefers_port_5678():
    assert launcher.DEFAULT_PORT == 5678


def test_create_server_with_fallback_selects_next_port():
    fake_server = object()
    app = object()

    with patch('sapro.launcher.make_server', side_effect=[OSError('busy'), fake_server]) as make_server:
        server, port = launcher.create_server_with_fallback(
            app=app,
            host='127.0.0.1',
            preferred_port=5678,
            max_port=5687,
        )

    assert port == 5679
    assert server is fake_server
    assert make_server.call_count == 2
    assert make_server.call_args_list[0].args == ('127.0.0.1', 5678, app)
    assert make_server.call_args_list[1].args == ('127.0.0.1', 5679, app)


def test_create_server_with_fallback_raises_when_range_is_exhausted():
    with patch('sapro.launcher.make_server', side_effect=OSError('address already in use')):
        with pytest.raises(launcher.LauncherError, match='5678-5687'):
            launcher.create_server_with_fallback(
                app=object(),
                host='127.0.0.1',
                preferred_port=5678,
                max_port=5687,
            )


def test_launcher_browser_opens_selected_url_after_successful_bind():
    fake_server = MagicMock()
    fake_server.serve_forever.side_effect = KeyboardInterrupt

    with patch('sapro.launcher.create_server_with_fallback', return_value=(fake_server, 5679)), patch(
        'sapro.launcher.webbrowser.open'
    ) as browser_open:
        code = launcher.run_launcher(open_browser=True)

    assert code == 0
    browser_open.assert_called_once_with('http://127.0.0.1:5679', new=2)
    fake_server.serve_forever.assert_called_once()


def test_launcher_does_not_open_browser_before_successful_bind():
    with patch(
        'sapro.launcher.create_server_with_fallback',
        side_effect=launcher.LauncherError('blocked'),
    ), patch('sapro.launcher.webbrowser.open') as browser_open:
        code = launcher.run_launcher(open_browser=True)

    assert code == 1
    browser_open.assert_not_called()


def test_launcher_serves_the_created_server_instance():
    fake_server = MagicMock()
    fake_server.serve_forever.side_effect = KeyboardInterrupt

    with patch('sapro.launcher.create_server_with_fallback', return_value=(fake_server, 5678)), patch(
        'sapro.launcher.webbrowser.open'
    ):
        launcher.run_launcher(open_browser=False)

    fake_server.serve_forever.assert_called_once()


def test_launcher_returns_nonzero_on_startup_failure(capsys):
    with patch(
        'sapro.launcher.create_server_with_fallback',
        side_effect=launcher.LauncherError('blocked'),
    ):
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


def test_spec_root_is_one_level_above_spec_directory():
    paths = _parse_spec_paths()
    assert paths['spec_dir'] == SPEC_PATH.resolve().parent
    assert paths['project_root'] == SPEC_PATH.resolve().parent.parent


def test_spec_launcher_path_points_to_project_src_sapro_launcher():
    paths = _parse_spec_paths()
    assert paths['launcher'] == PROJECT_ROOT / 'src' / 'sapro' / 'launcher.py'
    assert paths['launcher'].is_file()


def test_spec_does_not_use_path_cwd_parent():
    spec = _read(SPEC_PATH)
    assert 'Path.cwd()' not in spec


def test_spec_does_not_move_two_levels_above_packaging():
    spec = _read(SPEC_PATH)
    assert '.parent.parent' not in spec


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
    pytest_index = script.index('pytest')
    pyinstaller_index = script.lower().index('pyinstaller')
    assert pytest_index < pyinstaller_index


def test_workflow_uploads_windows_zip():
    workflow = _read(WORKFLOW_PATH)
    assert 'Simplex-Solver-Windows.zip' in workflow
    assert 'Simplex-Solver-Windows' in workflow


def test_workflow_does_not_require_repository_secrets():
    workflow = _read(WORKFLOW_PATH)
    assert 'secrets.' not in workflow


def test_build_script_checks_native_exit_codes():
    script = _read(BUILD_SCRIPT_PATH)
    assert 'Invoke-CheckedCommand' in script
    assert '$LASTEXITCODE' in script


def test_build_script_stops_after_failed_pytest():
    script = _read(BUILD_SCRIPT_PATH)
    pytest_block = script.split('Invoke-CheckedCommand { python -m pytest -v --tb=short }', 1)[1]
    assert 'PyInstaller' not in pytest_block.split('Invoke-CheckedCommand', 1)[0]


def test_build_script_derives_root_from_psscriptroot():
    script = _read(BUILD_SCRIPT_PATH)
    assert 'Join-Path $PSScriptRoot ".."' in script
    assert 'Resolve-Path' in script


def test_build_script_creates_zip_from_distribution_folder():
    script = _read(BUILD_SCRIPT_PATH)
    assert 'Simplex-Solver-Windows.zip' in script
    assert 'dist/SimplexSolver/SimplexSolver.exe' in script.replace('\\', '/')


def test_build_script_uses_push_and_pop_location():
    script = _read(BUILD_SCRIPT_PATH)
    assert 'Push-Location $ProjectRoot' in script
    assert 'Pop-Location' in script
