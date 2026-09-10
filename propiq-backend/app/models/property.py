"""ORM model for a King County property sale record."""

from __future__ import annotations

from sqlalchemy import Float, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Property(Base):
    """One historical home sale.

    Columns mirror the King County House Sales dataset, plus a few fields
    derived at seed time (`year_sold`, `month_sold`, `house_age`,
    `was_renovated`) so the stats endpoints can aggregate without reparsing
    the original sale date on every request.
    """

    __tablename__ = "properties"
    __table_args__ = (
        # The dashboard's default view sorts by price and filters on
        # bedrooms/grade/zipcode; these cover the common query shapes.
        Index("ix_properties_price", "price"),
        Index("ix_properties_bedrooms_grade", "bedrooms", "grade"),
        Index("ix_properties_zipcode", "zipcode"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # --- Core sale data --------------------------------------------------
    price: Mapped[float] = mapped_column(Float, nullable=False)
    bedrooms: Mapped[int] = mapped_column(Integer, nullable=False)
    bathrooms: Mapped[float] = mapped_column(Float, nullable=False)
    sqft_living: Mapped[float] = mapped_column(Float, nullable=False)
    sqft_lot: Mapped[float] = mapped_column(Float, nullable=False)
    floors: Mapped[float] = mapped_column(Float, nullable=False)
    waterfront: Mapped[int] = mapped_column(Integer, default=0)  # 0 or 1
    view: Mapped[int] = mapped_column(Integer, default=0)        # 0-4
    condition: Mapped[int] = mapped_column(Integer, default=3)   # 1-5
    grade: Mapped[int] = mapped_column(Integer, default=7)       # 1-13
    sqft_above: Mapped[float] = mapped_column(Float, default=0.0)
    sqft_basement: Mapped[float] = mapped_column(Float, default=0.0)
    yr_built: Mapped[int] = mapped_column(Integer, nullable=False)
    yr_renovated: Mapped[int] = mapped_column(Integer, default=0)

    # --- Location --------------------------------------------------------
    # Stored as text: US ZIP codes are identifiers, not quantities, and
    # leading zeros must survive a round trip.
    zipcode: Mapped[str | None] = mapped_column(String(10), nullable=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    long: Mapped[float] = mapped_column(Float, nullable=False)

    # --- Neighbourhood context ------------------------------------------
    sqft_living15: Mapped[float] = mapped_column(Float, default=0.0)
    sqft_lot15: Mapped[float] = mapped_column(Float, default=0.0)

    # --- Derived at seed time -------------------------------------------
    year_sold: Mapped[int | None] = mapped_column(Integer, nullable=True)
    month_sold: Mapped[int | None] = mapped_column(Integer, nullable=True)
    house_age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    was_renovated: Mapped[int | None] = mapped_column(Integer, nullable=True)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Property id={self.id} price={self.price:,.0f} zip={self.zipcode}>"
