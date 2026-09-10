# Stage 1: Build virtual environment with glibc compatibility (Debian 12 Bookworm / Python 3.11)
FROM python:3.11-slim-bookworm AS builder

WORKDIR /app

# Install build dependencies for psycopg and C extension packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libc-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install python dependencies and package
COPY pyproject.toml .
COPY nightrunner_backend/ nightrunner_backend/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# Stage 2: Hardened Runtime (Google Distroless Debian 12)
FROM gcr.io/distroless/python3-debian12:nonroot AS runtime

WORKDIR /app

# Copy python virtual environment and site-packages from builder stage
COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /usr/lib/*-linux-gnu*/libpq.s* /usr/lib/
COPY --from=builder /usr/lib/*-linux-gnu*/libgssapi_krb5.s* /usr/lib/
COPY --from=builder /usr/lib/*-linux-gnu*/libkrb5.s* /usr/lib/
COPY --from=builder /usr/lib/*-linux-gnu*/libk5crypto.s* /usr/lib/
COPY --from=builder /usr/lib/*-linux-gnu*/libcom_err.s* /usr/lib/
COPY --from=builder /usr/lib/*-linux-gnu*/libkrb5support.s* /usr/lib/

# Copy application source
COPY nightrunner_backend/ nightrunner_backend/

# Configure Python environment to use virtualenv site-packages
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONPATH="/opt/venv/lib/python3.11/site-packages"
ENV PORT=8000

# Run container with distroless python binary as non-root user (UID 65532)
USER nonroot

ENTRYPOINT ["/usr/bin/python3", "-m", "uvicorn", "nightrunner_backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
