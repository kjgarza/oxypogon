# Oxypogon - CrossFit WOD Viewer

https://kjgarza.github.io/oxypogon/

A CrossFit Workout of the Day (WOD) viewer that uses Flat Data and OpenAI to scrape workout data and make it more accessible for beginners. The application provides detailed explanations, scaling options, and beginner-friendly modifications for CrossFit workouts.

## Features

- **Automated WOD Scraping**: Uses Flat Data to automatically fetch daily workouts from CrossFit gyms
- **AI-Powered Explanations**: Leverages OpenAI to generate detailed, beginner-friendly exercise explanations
- **Scaling Options**: Provides multiple difficulty levels (Sweat, Train, Compete) for different fitness levels
- **Exercise Breakdowns**: Step-by-step instructions with form tips and modifications
- **Web Viewer**: Clean HTML interface for viewing formatted workout data
- **Streamlit Application**: Interactive multipage application for workout analysis

## How It Works

1. **Data Collection**: Flat Data automatically scrapes workout information from CrossFit websites
2. **AI Enhancement**: OpenAI processes the raw workout data to generate comprehensive explanations
3. **Format Processing**: The application structures the data for easy consumption
4. **Display**: Multiple viewing options including web interface and Streamlit app

## Quick Start

### Running with Deno

To run the application locally using Deno:

```bash
# Run the main application with all permissions
deno run -A process_workout.ts workout_ajax_response.txt

# Or run with specific permissions (recommended for production)
deno run --allow-net --allow-read --allow-write process_workout.ts workout_ajax_response.txt
```

The `-A` flag grants all permissions to the Deno runtime, which is convenient for development but should be used with caution in production environments.

### Running the Web Viewer

To view the formatted workout data in your browser:

1. Open `index.html` in your web browser
2. Ensure `workout_with_explanation.json` is in the same directory
3. The page will automatically load and display the workout data
