"""
Profiling utilities for timing critical operations.

Usage:
    from core.profiling import log_timing
    import time

    start = time.perf_counter()
    # ... operation ...
    log_timing("operation_name", start)
"""

import logging
import time

logger = logging.getLogger("profiling")


def log_timing(name: str, start: float) -> float:
    """
    Log elapsed time since start.

    Args:
        name: Operation name for identification
        start: Start time from time.perf_counter()

    Returns:
        Current time for chaining multiple measurements
    """
    elapsed = time.perf_counter() - start
    logger.warning(f"⏱️ [{name}] {elapsed:.3f}s")
    return time.perf_counter()


def start_timer() -> float:
    """Start a timer. Returns current perf_counter value."""
    return time.perf_counter()
