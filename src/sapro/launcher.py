from __future__ import annotations

from .webui import run_app
import socket
import sys
import threading
import time
import webbrowser

DEFAULT_HOST = '127.0.0.1'
DEFAULT_PORT = 5678
PORT_RANGE = 10


class LauncherError(Exception):
    'Raised when the packaged application cannot start.'


def select_port(host: str = DEFAULT_HOST, preferred: int = DEFAULT_PORT, count: int = PORT_RANGE) -> int:
    '''
    Return the first available TCP port in a small local range.
    '''
    last_error: OSError | None = None
    for port in range(preferred, preferred + count):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind((host, port))
            except OSError as error:
                last_error = error
                continue
            return port
    message = (
        f'Could not bind to a local port in the range '
        f'{preferred}-{preferred + count - 1}. '
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
    open_browser: bool = True,
) -> int:
    try:
        port = select_port(host, preferred_port, PORT_RANGE)
    except LauncherError as error:
        print(f'Startup error: {error}', file=sys.stderr)
        return 1

    url = application_url(host, port)
    print_startup_message(url)

    server_error: LauncherError | None = None

    def serve() -> None:
        nonlocal server_error
        try:
            run_app(host, port)
        except OSError as error:
            server_error = LauncherError(f'Could not start the local server ({error}).')
        except Exception as error:  # pragma: no cover - defensive startup guard
            server_error = LauncherError(f'Unexpected startup failure ({error}).')

    thread = threading.Thread(target=serve, daemon=True)
    thread.start()

    deadline = time.time() + 5.0
    while time.time() < deadline:
        if server_error is not None:
            print(f'Startup error: {server_error}', file=sys.stderr)
            return 1
        if not thread.is_alive():
            break
        time.sleep(0.05)

    if server_error is not None:
        print(f'Startup error: {server_error}', file=sys.stderr)
        return 1

    if open_browser:
        webbrowser.open(url, new=2)

    try:
        while thread.is_alive():
            time.sleep(0.25)
    except KeyboardInterrupt:
        pass

    return 0


def main() -> None:
    raise SystemExit(run_launcher())


if __name__ == '__main__':
    main()
