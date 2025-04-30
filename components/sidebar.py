"""_summary_."""

from typing import List

import streamlit as st

from services.navigation_service import NavigationService


class SidebarComponent:
    """Sidebar component responsible for navigation rendering. Follows the SRP (Single Responsibility Principle)."""

    def __init__(self, navigation_service: NavigationService, pages: List[str]):
        """
        Initialize the sidebar component.

        Args:
        ----
            navigation_service: Service to handle navigation actions
            pages: List of available pages

        """
        self.navigation = navigation_service
        self.pages = pages

    def render(self) -> str:
        """
        Render the sidebar with navigation options.

        Returns
        -------
            The currently selected page

        """
        with st.sidebar:
            st.title("Navigation")

            current_page = self.navigation.get_current_page()

            for page in self.pages:
                if st.button(
                    page,
                    key=f"nav_{page}",
                    use_container_width=True,
                    type="primary" if page == current_page else "secondary",
                ):
                    self.navigation.navigate_to(page)
                    current_page = page

            st.divider()
            st.caption("© 2025 Oxypogon")

        return current_page
