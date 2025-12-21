import logging
from contextlib import asynccontextmanager

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.store.postgres import AsyncPostgresStore
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from core.profiling import log_timing, start_timer
from core.settings import settings

logger = logging.getLogger(__name__)


def validate_postgres_config() -> None:
    """
    Validate that all required PostgreSQL configuration is present.
    Raises ValueError if any required configuration is missing.
    """
    required_vars = [
        "POSTGRES_USER",
        "POSTGRES_PASSWORD",
        "POSTGRES_HOST",
        "POSTGRES_PORT",
        "POSTGRES_DB",
    ]

    missing = [var for var in required_vars if not getattr(settings, var, None)]
    if missing:
        raise ValueError(
            f"Missing required PostgreSQL configuration: {', '.join(missing)}. "
            "These environment variables must be set to use PostgreSQL persistence."
        )

    if settings.POSTGRES_MIN_CONNECTIONS_PER_POOL > settings.POSTGRES_MAX_CONNECTIONS_PER_POOL:
        raise ValueError(
            f"POSTGRES_MIN_CONNECTIONS_PER_POOL ({settings.POSTGRES_MIN_CONNECTIONS_PER_POOL}) must be less than or equal to POSTGRES_MAX_CONNECTIONS_PER_POOL ({settings.POSTGRES_MAX_CONNECTIONS_PER_POOL})"
        )


def get_postgres_connection_string() -> str:
    """Build and return the PostgreSQL connection string from settings."""
    if settings.POSTGRES_PASSWORD is None:
        raise ValueError("POSTGRES_PASSWORD is not set")

    # sslmode configurable via POSTGRES_SSLMODE env var (default: require for Neon)
    # Note: pgbouncer parameter is NOT supported by psycopg
    return (
        f"postgresql://{settings.POSTGRES_USER}:"
        f"{settings.POSTGRES_PASSWORD.get_secret_value()}@"
        f"{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/"
        f"{settings.POSTGRES_DB}?sslmode={settings.POSTGRES_SSLMODE}"
    )


@asynccontextmanager
async def get_postgres_saver():
    """Initialize and return a PostgreSQL saver instance based on a connection pool for more resilent connections."""
    validate_postgres_config()
    application_name = settings.POSTGRES_APPLICATION_NAME + "-" + "saver"

    logger.warning(f"⏱️ [saver_pool_config] min={settings.POSTGRES_MIN_CONNECTIONS_PER_POOL}, max={settings.POSTGRES_MAX_CONNECTIONS_PER_POOL}")
    start = start_timer()
    async with AsyncConnectionPool(
        get_postgres_connection_string(),
        min_size=settings.POSTGRES_MIN_CONNECTIONS_PER_POOL,
        max_size=settings.POSTGRES_MAX_CONNECTIONS_PER_POOL,
        # Langgraph requires autocommmit=true and row_factory to be set to dict_row.
        # Application_name is passed so you can identify the connection in your Postgres database connection manager.
        kwargs={"autocommit": True, "row_factory": dict_row, "application_name": application_name},
        # makes sure that the connection is still valid before using it
        check=AsyncConnectionPool.check_connection,
    ) as pool:
        log_timing("saver_pool_entered", start)

        # POOL WARMUP - Force real connections to Neon
        logger.warning(f"⏱️ [saver_warmup_start] Warming up {settings.POSTGRES_MIN_CONNECTIONS_PER_POOL} connections...")
        start = start_timer()
        try:
            await pool.wait(timeout=60.0)  # 60s timeout for Neon cold start
            log_timing("saver_warmup_complete", start)
        except Exception as e:
            logger.error(f"❌ [saver_warmup_failed] {e}")
            raise

        try:
            logger.warning("⏱️ [saver_before_setup] AsyncPostgresSaver instance creating...")
            start = start_timer()
            checkpointer = AsyncPostgresSaver(pool)
            await checkpointer.setup()
            log_timing("saver_setup_complete", start)
            yield checkpointer
        finally:
            await pool.close()


@asynccontextmanager
async def get_postgres_store():
    """
    Get a PostgreSQL store instance based on a connection pool for more resilent connections.

    Returns an AsyncPostgresStore instance that can be used with async context manager pattern.

    """
    validate_postgres_config()
    application_name = settings.POSTGRES_APPLICATION_NAME + "-" + "store"

    logger.warning(f"⏱️ [store_pool_config] min={settings.POSTGRES_MIN_CONNECTIONS_PER_POOL}, max={settings.POSTGRES_MAX_CONNECTIONS_PER_POOL}")
    start = start_timer()
    async with AsyncConnectionPool(
        get_postgres_connection_string(),
        min_size=settings.POSTGRES_MIN_CONNECTIONS_PER_POOL,
        max_size=settings.POSTGRES_MAX_CONNECTIONS_PER_POOL,
        # Langgraph requires autocommmit=true and row_factory to be set to dict_row
        # Application_name is passed so you can identify the connection in your Postgres database connection manager.
        kwargs={"autocommit": True, "row_factory": dict_row, "application_name": application_name},
        # makes sure that the connection is still valid before using it
        check=AsyncConnectionPool.check_connection,
    ) as pool:
        log_timing("store_pool_entered", start)

        # POOL WARMUP - Force real connections to Neon
        logger.warning(f"⏱️ [store_warmup_start] Warming up {settings.POSTGRES_MIN_CONNECTIONS_PER_POOL} connections...")
        start = start_timer()
        try:
            await pool.wait(timeout=60.0)  # 60s timeout for Neon cold start
            log_timing("store_warmup_complete", start)
        except Exception as e:
            logger.error(f"❌ [store_warmup_failed] {e}")
            raise

        try:
            logger.warning("⏱️ [store_before_setup] AsyncPostgresStore instance creating...")
            start = start_timer()
            store = AsyncPostgresStore(pool)
            await store.setup()
            log_timing("store_setup_complete", start)
            yield store
        finally:
            await pool.close()
