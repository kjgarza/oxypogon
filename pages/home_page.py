"""_summary_."""

import streamlit as st

from services.page_interface import Page


class HomePage(Page):
    """Home page implementation."""

    def __init__(self):
        """
        Initialize the home page.

        Args:
        ----
            data_service: Service to track page views

        """
        # self.data_service = data_service

    def render(self) -> None:
        """Render the home page content."""
        # Track page view if data service is available
        # if self.data_service:
        #     self.data_service.track_page_view("Home")

        st.title("Welcome to Oxypogon")

        st.write("This is the home page of the Oxypogon application.")
