"""Polars startup compatibility helpers."""

from __future__ import annotations

import os
import platform


def should_skip_polars_cpu_check(
    *,
    os_name: str | None = None,
    machine: str | None = None,
    processor_architecture: str | None = None,
) -> bool:
    current_os = os.name if os_name is None else os_name
    current_machine = platform.machine() if machine is None else machine
    current_arch = (
        os.environ.get("PROCESSOR_ARCHITECTURE")
        if processor_architecture is None
        else processor_architecture
    )

    return (
        current_os == "nt"
        and current_machine.lower() == "arm64"
        and (current_arch or "").upper() == "AMD64"
    )


def configure_polars_startup() -> None:
    if should_skip_polars_cpu_check():
        # Windows ARM64 can run x64 Python under emulation. In that case Polars
        # sees ARM64 from platform.machine(), cannot run the x86 CPUID probe,
        # and raises "unknown feature flag: 'sse3'" before callers can proceed.
        os.environ.setdefault("POLARS_SKIP_CPU_CHECK", "1")
