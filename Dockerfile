FROM python:3.12-slim

WORKDIR /app

# Install Poetry
RUN pip install poetry==1.7.1

# Copy Poetry configuration files
COPY pyproject.toml poetry.lock* ./

# Configure Poetry to not create a virtual environment
RUN poetry config virtualenvs.create false

# Install dependencies
RUN poetry install --no-interaction --no-ansi --no-dev

# Copy application code
COPY . .

# Expose the Streamlit port
EXPOSE 8501

# Command to run the application
CMD ["streamlit", "run", "oxypogon/app/main.py", "--server.address=0.0.0.0"]
