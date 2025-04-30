"""Interface for all pages in the application.Following the Interface Segregation Principle from SOLID."""

from abc import ABC, abstractmethod


class Page(ABC):
    """Abstract base class for all pages."""

    @abstractmethod
    def render(self) -> None:
        """Render the page content.All page implementations must override this method."""
        pass
