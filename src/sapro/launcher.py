from __future__ import annotations

from .webui import application
import sys
import webbrowser
from wsgiref.simple_server import make_server

DEFAULT_HOST = '127.0.0.1'
DEFAULT_PORT = 5678
MAX_PORT = 5687


class LauncherError(Exception):
    'Raised when the packaged application cannot start.'


def create_server_with_fallback(
    app,
    host: str = DEFAULT_HOST,
    preferred_port: int = DEFAULT_PORT,
    max_port: int = MAX_PORT,
):
    '''
    Create a WSGI server on the first bindable port in the requested range.

    Each candidate port is attempted with the actual ``make_server`` call so the
    returned server instance is the one that will serve requests.
    '''
    last_error: OSError | None = None
    for port in range(preferred_port, max_port + 1):
        try:
            server = make_server(host, port, app)
        except OSError as error:
            last_error = error
            continue
        return server, port

    message = (
        f'Could not bind to a local port in the range {preferred_port}-{max_port}. '
        'Close other applications using these ports and try again.'
    )
    if last_error is not None:
        raise LauncherError(f'{message} ({last_error})') from last_error
    raise LauncherError(message)


def application_url(host: str, port: int) -> str:
    return f'http://{host}:{port}'


def print_startup_message(url: str) -> None:
    print('Simplex Method Solver')
    print(f'Running locally at {url}')
    print('Keep this window open while using the application.')
    print('Close this window or press Ctrl+C to stop.')


def run_launcher(
    host: str = DEFAULT_HOST,
    preferred_port: int = DEFAULT_PORT,
    max_port: int = MAX_PORT,
    open_browser: bool = True,
) -> int:
    try:
        server, port = create_server_with_fallback(
            application,
            host=host,
            preferred_port=preferred_port,
            max_port=max_port,
        )
    except LauncherError as error:
        print(f'Startup error: {error}', file=sys.stderr)
        return 1

    url = application_url(host, port)
    print_startup_message(url)

    if open_browser:
        webbrowser.open(url, new=2)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass

    return 0


def main() -> None:
    raise SystemExit(run_launcher())


if __name__ == '__main__':
    main()
