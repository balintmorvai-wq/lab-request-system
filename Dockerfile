FROM python:3.11-slim

WORKDIR /app

# Copy backend requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy entire backend folder
COPY backend/ .

# Create uploads folders
RUN mkdir -p uploads/logos uploads/attachments

# Expose port
EXPOSE 8080

# Start command
CMD gunicorn app:app --bind 0.0.0.0:$PORT --timeout 60 --workers 1
