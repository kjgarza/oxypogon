# Oxypogon - Multipage Streamlit Application

A well-structured multipage Streamlit application built using SOLID principles.

## Features

- Multipage Streamlit application
- SOLID design principles implementation
- Clean architecture with separation of concerns
- Containerized deployment with Docker
- Modern Python development tools

## Technical Requirements

- Python 3.12
- Poetry for dependency management
- Docker & docker-compose for containerization
- Pre-commit hooks with ruff for code quality
- Pyright for type checking

## Project Structure

```
oxypogon/
├── oxypogon/
│   ├── app/
│   │   ├── components/     # Reusable UI components
│   │   ├── models/         # Data models
│   │   ├── pages/          # Streamlit pages
│   │   ├── services/       # Business logic services
│   │   └── utils/          # Utility functions and constants
│   └── tests/              # Unit and integration tests
├── .pre-commit-config.yaml # Pre-commit hooks configuration
├── docker-compose.yml      # Docker Compose configuration
├── Dockerfile              # Docker build configuration
├── poetry.lock             # Poetry lock file
├── pyproject.toml          # Python project configuration
└── README.md               # Project documentation
```

## Getting Started

### Installation with Poetry

```bash
# Install dependencies
poetry install

# Run the application
poetry run streamlit run oxypogon/app/main.py
```

### Running with Docker

```bash
# Build and start the application
docker-compose up -d

# Access the application at http://localhost:8501
```

## SOLID Principles Implementation

This project demonstrates the following SOLID principles:

1. **Single Responsibility Principle (SRP)** - Each class has a single responsibility:
   - Pages handle UI rendering
   - Services handle business logic
   - Models represent data structures

2. **Open/Closed Principle (OCP)** - The architecture allows for extension without modification:
   - Adding new pages does not require changing existing code
   - Services can be extended through inheritance or composition

3. **Liskov Substitution Principle (LSP)** - Derived classes can be substituted for base classes:
   - All pages implement the Page interface
   - Services use abstractions rather than concrete implementations

4. **Interface Segregation Principle (ISP)** - Clients only depend on methods they use:
   - Minimal interfaces with focused methods
   - Component interfaces that expose only necessary functionality

5. **Dependency Inversion Principle (DIP)** - High-level modules depend on abstractions:
   - Dependency injection for services
   - Abstract interfaces for implementation details

## Development

```bash
# Install dev dependencies
poetry install

# Install pre-commit hooks
pre-commit install

# Run pre-commit hooks manually
pre-commit run --all-files

# Run tests
poetry run pytest
```
