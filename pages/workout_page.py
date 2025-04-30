"""Improved workout page implementation for retrieving CrossFit MINS workouts."""

import logging
import time
from datetime import datetime, timedelta
from typing import Optional, Tuple

import streamlit as st
from openai import OpenAI
from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC  # noqa: N812
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

from services.page_interface import Page

# from services.data_service_interface import DataServiceInterface

# Fixed URL for CrossFit MINS Workout of the Day
CROSSFIT_WOD_URL = "https://www.crossfitmins.com/workout-of-the-day/#"

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# Initialize ChromeDriver once at module level
# @st.cache_resource
def get_chrome_driver_path():
    """Cache the ChromeDriver path to avoid repeated downloads."""
    return ChromeDriverManager().install()


class WorkoutPage(Page):
    """CrossFit WOD page implementation with improved state management."""

    def __init__(self):
        """Initialize the workout page."""
        # self.data_service = data_service

        # Initialize session state variables if they don't exist
        if "wod_text" not in st.session_state:
            st.session_state.wod_text = None
        if "error_msg" not in st.session_state:
            st.session_state.error_msg = None
        if "explanation" not in st.session_state:
            st.session_state.explanation = None
        if "scrape_complete" not in st.session_state:
            st.session_state.scrape_complete = False
        if "last_scrape_time" not in st.session_state:
            st.session_state.last_scrape_time = None
        if "is_scraping" not in st.session_state:
            st.session_state.is_scraping = False

    @st.cache_data(ttl=3600)  # Cache the explanation for 1 hour
    def _cached_ai_explanation(self, wod_text: str) -> str:
        """
        Cache the AI explanation to avoid redundant API calls.

        Args:
        ----
            wod_text: The workout text to explain

        Returns:
        -------
            str: AI-generated explanation of the workout

        """
        try:
            # Initialize the OpenAI client
            client = OpenAI(api_key=st.secrets["openai_api_key"])

            prompt_core = """
                Explain the Workout of the Day (WOD) to a novice in a friendly, clear, and conversational tone. The explanation should be structured in a few paragraphs and provide detailed instructions on how to score their performance.

                # Steps

                1. **Introduce the WOD**:
                - Describe what a WOD is and its purpose.
                - Break down the components of the WOD, if applicable (e.g., exercises, rounds, duration).

                2. **Explain Each Exercise**:
                - Provide a simple explanation of each exercise included in the WOD.
                - Describe proper form and technique to ensure safety.
                - Mention any necessary equipment.

                3. **Outline the Structure**:
                - Clearly explain the order of exercises, the number of repetitions or rounds, and any time limits.
                - Include details on rest periods, if any.

                4. **Guide on Scoring**:
                - Explain how to track progress and measure performance (e.g., time to complete, number of reps, rounds completed).
                - Offer tips on maintaining consistent and accurate scoring.

                # Output Format

                Responses should be conversational and in paragraph form to ensure clarity and friendliness. Use bullet points for lists when describing exercises or scoring steps for added clarity.

                # Examples

                **Example of Explanation**:
                - *Input WOD*: "3 Rounds for time: 10 Push-Ups, 15 Air Squats, 20 Sit-Ups."

                **Explanation**:
                - “This WOD consists of three rounds of exercises. You'll kick off with 10 push-ups, go straight into 15 air squats, and then wrap up the round with 20 sit-ups. Once you've completed this sequence, you'll have finished one round. Your goal is to fly through all three rounds as quickly as your body allows. Remember, for those push-ups, keep your body in a nice, straight line. For the squats, focus on keeping those knees aligned with your toes, and use your core effectively for the sit-ups."

                **Scoring**:
                - "Just clock the total time you need to blast through all three rounds. That’s your score for the day. On your next go, see if you can shave off a couple of seconds and better your time."

                # Notes

                - Emphasize correct form to prevent injuries.
                - Encourage novices to focus on completing the WOD at their own pace, prioritizing form over speed.
                - Adjust descriptions based on whether the workout is timed, for reps, or rounds completed.
            """

            # Create the prompt with the workout text
            prompt = f"{prompt_core}:\n\n{wod_text}"

            # Make the API call with timeout handling
            response = client.responses.create(
                model="gpt-4o-mini",
                instructions="Act a Crossfit Trainer and explain the WOD to a novice.",
                input=prompt,
                timeout=30,  # 30 second timeout
            )

            return response.output[0].content[0].text.strip()
        except Exception as e:
            logger.error(f"Error generating AI explanation: {str(e)}")
            return f"Sorry, I couldn't generate an explanation: {str(e)}"

    def explain_workout_with_ai(self, wod_text: str) -> str:
        """
        Use OpenAI API to explain the workout in detail, with proper error handling.

        Args:
        ----
            wod_text: The workout text to explain

        Returns:
        -------
            str: AI-generated explanation of the workout

        """
        explanation = self._cached_ai_explanation(wod_text)
        st.session_state.explanation = explanation
        return explanation

    def render(self) -> None:
        """Render the workout page content with improved state management."""
        # # Track page view if data service is available
        # if self.data_service:
        #     self.data_service.track_page_view("Workout")

        self._render_page_header()

        # Handle the scraping process with proper state management
        self._handle_workout_scraping()

        # Display workout results
        self._display_workout_results()

        # Render the AI explanation button after displaying results
        self._render_ai_explanation_button()

        self._render_page_footer()

    def _handle_workout_scraping(self) -> None:
        """
        Handle the workout scraping process with proper state management.

        Only scrape if needed and not already in progress.
        """
        # Check if we need to scrape (no data or data is old)
        needs_scrape = (
            not st.session_state.scrape_complete
            or not st.session_state.wod_text
            or (
                st.session_state.last_scrape_time
                and datetime.now() - st.session_state.last_scrape_time
                > timedelta(hours=1)
            )
        )

        # Add a manual refresh button
        col1, col2 = st.columns([5, 1])
        with col2:
            if st.button("Refresh", key="refresh_wod"):
                needs_scrape = True

        # Handle scraping if needed
        if needs_scrape and not st.session_state.is_scraping:
            st.session_state.is_scraping = True

            with st.spinner("Fetching today's workout... This may take a few moments."):
                # Call the cached version of the scrape function
                wod_text, error_msg = self._cached_scrape_wod_text()

                # Update session state
                st.session_state.wod_text = wod_text
                st.session_state.error_msg = error_msg
                st.session_state.scrape_complete = True
                st.session_state.last_scrape_time = datetime.now()
                st.session_state.is_scraping = False

    def _render_page_header(self) -> None:
        """Render the page title and description."""
        st.title("CrossFit MINS: Workout of the Day")
        st.write("Get today's workout directly from CrossFit MINS.")
        return None

    def _render_ai_explanation_button(self) -> None:
        """Render the button to get AI explanation for the workout."""
        # Only enable the button if workout scraping was successful
        button_disabled = not (
            st.session_state.scrape_complete and st.session_state.wod_text
        )

        # Check if explanation is already generated
        if st.session_state.explanation:
            st.subheader("Expert Explanation:")
            st.markdown(st.session_state.explanation.replace("\n", "  \n"))

            # Add option to regenerate
            if st.button("Regenerate Explanation", key="regenerate_explanation"):
                with st.spinner("Generating new expert explanation..."):
                    if st.session_state.wod_text:
                        # Force bypass cache by adding timestamp
                        explanation = self._cached_ai_explanation(
                            st.session_state.wod_text
                            + f"\n(Regenerated: {datetime.now().isoformat()})"
                        )
                        st.session_state.explanation = explanation
                        st.rerun()  # Refresh the page to show new explanation
        else:
            # Show the button to generate explanation
            if st.button(
                "Get AI Explanation", key="ai_explanation", disabled=button_disabled
            ):
                with st.spinner("Generating expert explanation..."):
                    if st.session_state.wod_text:
                        explanation = self.explain_workout_with_ai(
                            st.session_state.wod_text
                        )
                        st.rerun()  # Refresh to show the explanation
                    else:
                        st.error("No workout data available to explain.")

    def _display_workout_results(self) -> None:
        """Display the workout results or error message based on scrape results."""
        if st.session_state.is_scraping:
            st.info("Fetching workout data...")
        elif st.session_state.error_msg:
            st.error(f"Failed to retrieve workout: {st.session_state.error_msg}")

            # Add retry button
            if st.button("Retry", key="retry_scrape"):
                st.session_state.is_scraping = True
                st.rerun()
        elif st.session_state.wod_text:
            st.success("Workout retrieved successfully!")

            # Show last update time
            if st.session_state.last_scrape_time:
                st.caption(
                    f"Last updated: {st.session_state.last_scrape_time.strftime('%Y-%m-%d %H:%M:%S')}"
                )

            self._display_workout_content()
        else:
            st.warning("No workout found. The website may be under maintenance.")

    def _display_workout_content(self) -> None:
        """Display the workout content and related controls."""
        if not st.session_state.wod_text:
            return

        # Create a container for the workout
        with st.container():
            st.subheader("Today's Workout:")
            st.markdown(
                st.session_state.wod_text.replace("\n", "  \n")
            )  # Proper markdown line breaks
            self._add_download_button()

    def _add_download_button(self) -> None:
        """Add a download button for the workout content."""
        if not st.session_state.wod_text:
            return

        current_date = datetime.now().strftime("%Y-%m-%d")
        st.download_button(
            label="Download Workout",
            data=st.session_state.wod_text,
            file_name=f"crossfit_mins_wod_{current_date}.txt",
            mime="text/plain",
        )

    def _render_page_footer(self) -> None:
        """Render the page footer with disclaimer."""
        st.markdown("---")
        st.markdown(
            """
            <div style="text-align: center">
                <p>This page retrieves the latest Workout of the Day from CrossFit MINS.</p>
                <p>Not affiliated with CrossFit MINS. Please visit their <a href="https://www.crossfitmins.com" target="_blank">official website</a> for more information.</p>
            </div>
            """,
            unsafe_allow_html=True,
        )

    # @st.cache_data(ttl=3600)  # Cache the result for 1 hour
    def _cached_scrape_wod_text(
        self, wait_time: int = 10
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Cache the web scraping function to avoid unnecessary scrapes.

        Args:
        ----
            wait_time (int): Maximum time to wait for elements to load (seconds)

        Returns:
        -------
            tuple: (workout_text, error_message)

        """
        return self._scrape_wod_text(wait_time)

    def _scrape_wod_text(  # noqa: C901
        self, wait_time: int = 10
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Open the CrossFit MINS WOD page, click on the first WOD link, and extract the workout text.

        This function handles web scraping with improved error handling for retrieving workout details.

        Args:
        ----
            wait_time (int): Maximum time to wait for elements to load (seconds)

        Returns:
        -------
            tuple: (workout_text, error_message)

        """
        # Setup Chrome options for headless operation
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--window-size=1920,1080")

        # Setup the WebDriver with cached driver path
        driver_path = get_chrome_driver_path()
        service = Service(driver_path)

        wod_text = None
        error_msg = None
        driver = None

        try:
            # Initialize the driver
            driver = webdriver.Chrome(service=service, options=chrome_options)

            # Set page load timeout
            driver.set_page_load_timeout(wait_time)

            # Open the URL
            driver.get(CROSSFIT_WOD_URL)

            # Handle cookie consent banner before proceeding
            try:
                # Wait for cookie banner to appear and accept it
                cookie_button = WebDriverWait(
                    driver, wait_time / 2
                ).until(  # Use half the wait time for cookie banner
                    EC.element_to_be_clickable(
                        (By.CSS_SELECTOR, "._brlbs-btn-accept-all")
                    )
                )
                cookie_button.click()
                time.sleep(1)  # Small pause to let the banner disappear
            except (TimeoutException, NoSuchElementException):
                # If the cookie button is not found, try removing the overlay directly with JavaScript
                try:
                    driver.execute_script(
                        """
                        var elements = document.getElementsByClassName('_brlbs-block-content');
                        for(var i=0; i<elements.length; i++){
                            elements[i].parentNode.removeChild(elements[i]);
                        }

                        // Also remove any overlay or backdrop
                        var overlays = document.getElementsByClassName('_brlbs-bg-animation');
                        for(var i=0; i<overlays.length; i++){
                            overlays[i].parentNode.removeChild(overlays[i]);
                        }
                    """
                    )
                except Exception as e:
                    logger.warning(f"Cookie banner handling failed: {str(e)}")
                    # Continue anyway, the banner might not be there
                    pass

            # Wait for the page to load and the element to be clickable
            click_element = WebDriverWait(driver, wait_time).until(
                EC.element_to_be_clickable(
                    (By.CSS_SELECTOR, "#wod_overview > a:nth-child(1)")
                )
            )

            # Try direct JavaScript click if regular click might be intercepted
            try:
                click_element.click()
            except Exception:
                # If normal click fails, try JavaScript click
                driver.execute_script("arguments[0].click();", click_element)

            # Try to get the workout date before clicking
            try:
                date_element = driver.find_element(
                    By.CSS_SELECTOR,
                    "#wod_overview > a:nth-child(1) > div.wod-overview-date",
                )
                workout_date = date_element.text if date_element else "Unknown Date"
            except NoSuchElementException:
                workout_date = "Unknown Date"

            # Wait for the text element to be visible
            text_element = WebDriverWait(driver, wait_time).until(
                EC.visibility_of_element_located(
                    (
                        By.CSS_SELECTOR,
                        "#wod-post-container > div.wod-entry-item > div > div.wod-entry-text",
                    )
                )
            )

            # Extract the text
            wod_text = text_element.text

            # Try to get the workout title if available
            try:
                # title_element = driver.find_element(
                #     By.CSS_SELECTOR,
                #     "#wod-post-container > div.wod-entry-item > div > div.wod-entry-title",
                # )
                workout_title = "title_element.text"
                wod_text = f"Date: {workout_date}\nTitle: {workout_title}\n\n{wod_text}"
            except Exception as e:
                logger.warning(f"Failed to get workout title: {str(e)}")
                wod_text = f"Date: {workout_date}\n\n{wod_text}"

        except TimeoutException:
            error_msg = (
                "Timeout: Element not found or not clickable within the specified time."
            )
            logger.error(f"Timeout during scraping: {error_msg}")
        except NoSuchElementException as e:
            error_msg = f"Element not found: The website structure may have changed. Details: {str(e)}"
            logger.error(error_msg)
        except Exception as e:
            error_msg = f"An error occurred: {str(e)}"
            logger.error(f"Unexpected error during scraping: {error_msg}")
        finally:
            # Close the browser
            if driver:
                try:
                    driver.quit()
                except Exception as e:
                    logger.warning(f"Error closing driver: {str(e)}")

        return wod_text, error_msg


# Create an instance of WorkoutPage and call render method
workout_page = WorkoutPage()
workout_page.render()
