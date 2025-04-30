"""Main entry point for the Oxypogon Streamlit application."""

# from components.sidebar import SidebarComponent
# from services.navigation_service import NavigationService
from pages.home_page import HomePage

# from pages.data_page import DataPage
# from pages.analysis_page import AnalysisPage
# from pages.workout_page import WorkoutPage


class OxypogonApp:
    """Main application controller following SOLID principles."""

    def __init__(self):
        """Initialize the application with required services."""
        # self.navigation = NavigationService()
        self.pages = {
            "Home": HomePage(),
            # "Data": DataPage(),
            # "Analysis": AnalysisPage(),
            # "Workout": WorkoutPage(),
        }

        # Configure the app
        self._configure_page()

    def _configure_page(self):
        """Configure the Streamlit page settings."""
        # st.set_page_config(
        #     page_title=APP_TITLE,
        #     page_icon=APP_ICON,
        #     layout="wide",
        #     initial_sidebar_state="expanded"
        # )

    def run(self):
        """Run the application."""
        # Render sidebar for navigation
        # sidebar = SidebarComponent(self.navigation, list(self.pages.keys()))
        # selected_page = sidebar.render()

        # # # Display the selected page
        # if selected_page in self.pages:
        #     self.pages[selected_page].render()
        # else:
        self.pages["Home"].render()


if __name__ == "__main__":
    app = OxypogonApp()
    app.run()
