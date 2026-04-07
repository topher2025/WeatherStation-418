FROM python:3.11-slim

WORKDIR /app

COPY backend/*.py ./backend/
COPY backend/requirements.txt ./backend/
COPY frontend/*.html ./frontend/
COPY frontend/static ./frontend/static
COPY .env ./.env

RUN pip install -r ./backend/requirements.txt

CMD sh -c "[ -f ./backend/cert.pem ] && [ -f ./backend/key.pem ] || python ./backend/generate_certs.py; python ./backend/main.py"
