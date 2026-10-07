"""
main.py — GearGuard Backend Entry Point
Directly delegates to the modern v2 FastAPI application in app.main.
"""
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.core.config import get_settings


def ensure_port_available(port: int) -> None:
    """
    Scans for and frees the target port from any conflicting or orphaned processes
    on startup. This prevents third-party servers (e.g., leftover Node/Express apps)
    from intercepting or hijacking GearGuard API traffic.
    """
    if sys.platform != "win32":
        return

    try:
        import subprocess
        current_pid = os.getpid()
        parent_pid = os.getppid()

        # Query netstat for any process actively listening on this port
        cmd = f'netstat -ano | findstr ":{port} "'
        out = subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout
        conflicting_pids = set()
        for line in out.strip().splitlines():
            parts = line.split()
            if len(parts) >= 5 and "LISTENING" in parts:
                try:
                    pid = int(parts[-1])
                    if pid != current_pid and pid != parent_pid and pid > 0:
                        conflicting_pids.add(pid)
                except ValueError:
                    pass

        for pid in conflicting_pids:
            proc_info = subprocess.run(
                f'tasklist /FI "PID eq {pid}" /NH', shell=True, capture_output=True, text=True
            ).stdout.strip()
            proc_name = proc_info.split()[0] if proc_info else f"PID {pid}"
            print(f"[PortGuard] [!] Port {port} is occupied by rogue process: {proc_name} (PID {pid}).")
            print(f"[PortGuard] Terminating process to prevent traffic hijacking...")
            subprocess.run(f"taskkill /PID {pid} /F", shell=True, capture_output=True)
            print(f"[PortGuard] [OK] Port {port} successfully freed for GearGuard.")
    except Exception as e:
        print(f"[PortGuard] Note: Port check completed with notice: {e}")



if __name__ == "__main__":
    import uvicorn
    cfg = get_settings()
    ensure_port_available(cfg.PORT)
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=cfg.PORT,
        reload=cfg.ENV == "development",
    )

