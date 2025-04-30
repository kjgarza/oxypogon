"""_summary_."""

import streamlit as st

from pages.page_interface import Page


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

        st.markdown(
            """
        ## A Simple Multipage Streamlit Application

        This is a demonstration of a well-structured Streamlit application following SOLID principles:

        * **S**ingle Responsibility Principle
        * **O**pen/Closed Principle
        * **L**iskov Substitution Principle
        * **I**nterface Segregation Principle
        * **D**ependency Inversion Principle

        Navigate using the sidebar to explore different pages of the application.
        """
        )

        with st.container():
            st.subheader("Features")

            col1, col2 = st.columns(2)

            with col1:
                st.info("📱 Multipage Structure")
                st.info("🧩 Component-Based Design")

            with col2:
                st.info("🏗️ Clean Architecture")
                st.info("🔍 Separation of Concerns")


HomePage().render()
