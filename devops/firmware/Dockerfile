FROM python:3.11-slim

WORKDIR /app

RUN pip install requests

COPY devops/firmware/firmware-main.py .
COPY devops/firmware/host.json .

CMD ["python", "-u", "firmware-main.py"]
