
FROM python:3.11-slim

# Install system dependencies and CLI tools (keep openssh-client and pipx)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        pipx \
        ca-certificates \
        openssh-client \
        nano \
    && rm -rf /var/lib/apt/lists/*

# Download Borg binary
RUN curl -L -o /usr/local/bin/borg https://github.com/borgbackup/borg/releases/download/1.4.1/borg-linux-glibc236 \
    && chmod +x /usr/local/bin/borg

# Install borgmatic using pipx
RUN pipx ensurepath && pipx install borgmatic

# Add pipx binaries to PATH
ENV PATH="/root/.local/bin:$PATH"

# Create folders for mounting
RUN mkdir -p /source /destination /etc/borgmatic

WORKDIR /etc/borgmatic