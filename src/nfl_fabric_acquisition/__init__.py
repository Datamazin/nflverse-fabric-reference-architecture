"""Local nflverse acquisition utilities for Fabric analytics."""

from nfl_fabric_acquisition._polars_startup import configure_polars_startup
from nfl_fabric_acquisition.config import AcquisitionConfig

configure_polars_startup()

__all__ = ["AcquisitionConfig"]
