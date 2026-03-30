FROM python:3.11-slim

WORKDIR /app

COPY backend/*.py ./backend/
COPY backend/requirements.txt ./backend/
COPY frontend/*.html ./frontend/
COPY frontend/static ./frontend/static

RUN pip install -r ./backend/requirements.txt

CMD sh -c "python ./backend/generate_certs.py; python ./backend/main.py"
