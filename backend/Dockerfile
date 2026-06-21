FROM python:3.11-slim

# System dependency for python-magic (libmagic). All Python packages install
# from prebuilt wheels, so no compiler (gcc) or libpq-dev are required.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create upload directory
RUN mkdir -p /app/uploads

# Entrypoint applies migrations (and optional seed) before the main process
RUN chmod +x /app/docker-entrypoint.sh

# Non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app /app/uploads
USER appuser

EXPOSE 8000

# Entrypoint runs migrations/seed (gated by env), then execs the command below.
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Default command: run uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
