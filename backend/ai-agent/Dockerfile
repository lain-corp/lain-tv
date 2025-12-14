FROM python:3.11-slim

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install pre-built llama-cpp-python wheel (much smaller than building from source)
RUN pip install --no-cache-dir llama-cpp-python --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cpu

# Copy application code
COPY agent.py .
COPY download-model.sh .
RUN chmod +x download-model.sh

# Create models directory
RUN mkdir -p /models

# Expose port
EXPOSE 8001

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

# Download model on startup and run the service
CMD ["sh", "-c", "./download-model.sh && python agent.py"]
