
FROM python:3.11-slim

# Install system dependencies and Node.js 18
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        pipx \
        ca-certificates \
        openssh-client \
        nano \
        fuse \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Borg and Borgmatic
RUN curl -L -o /usr/local/bin/borg https://github.com/borgbackup/borg/releases/download/1.4.2/borg-linux-glibc231-x86_64 \
    && chmod +x /usr/local/bin/borg \
    && pipx ensurepath && pipx install borgmatic

ENV PATH="/root/.local/bin:$PATH"

# Build frontend
WORKDIR /app/webui
COPY webui/package.json webui/package-lock.json* ./
RUN npm install
COPY webui ./
RUN npm run build

# Setup backend
WORKDIR /app/webapi
COPY webapi/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY webapi ./

# Create data directory for SQLite database
RUN mkdir -p /data

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]