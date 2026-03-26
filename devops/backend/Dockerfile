FROM python:3.11-slim

WORKDIR /app

COPY backend/ ./backend
COPY frontend/ ./frontend

RUN pip install -r backend/requirements.txt

CMD ["python", "backend/main.py"]