# DEVOPS

## Database

Uses SQLite because it's simple and easy, and has enough capabilities for the project. The database file is `/weather.db`, and the python wrapper is `/backend/database.py`.

### Tests

For simple tests, use `python -c` to run wrapper functions.


Initialize the database and print all stored weather data:
```bash
python -c "import backend.database as db; db.init(); data = db.get_all_weather(); print(data)"
# Output: []
```

Insert a new weather data point and print the latest weather data:
```bash
python -c "import backend.database as db; db.insert_weather(37.7, 13.5, 700.6, 265.2); data = db.get_latest_weather(); print(data)"
# Output: {'id': 1, 'timestamp': '2026-03-21 19:13:03', 'temperature': 37.7, 'humidity': 13.5, 'pressure': 700.6, 'gas_resistance': 265.2}```