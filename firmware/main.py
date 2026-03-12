# Rui Santos & Sara Santos - Random Nerd Tutorials
# Complete project details: https://RandomNerdTutorials.com/raspberry-pi-pico-bme680-micropython/

from machine import Pin, I2C
from time import sleep
from bme680 import BME680_I2C
import json

# RPi Pico - Pin assignment
with open('pins.json') as f:
    pins = json.load(f)

i2c = I2C(id=1, scl=Pin(pins['scl']), sda=Pin(pins['sda']), freq=100000)

bme = BME680_I2C(i2c=i2c)

def read_sensor():
    try:
        temp = bme.temperature
        tempC = round(temp, 2)                             # Celsius
        tempF = round((temp * (9 / 5) + 32), 2)            # Fahrenheit
        hum = round(bme.humidity, 2)                       # Percent
        pres = round(bme.pressure, 2)                      # hPa
        gas = round(bme.gas / 1000, 2)                     # kOhms

        out = {
            'temperature_C': tempC,
            'temperature_F': tempF,
            'humidity': hum,
            'pressure': pres,
            'gas': gas
        }

        return out
    except OSError as e:
        print('Failed to read sensor.')
        return {'error': e}


def main():
    while True:
        data = read_sensor()
        print(data)
        sleep(1)
     
     
main()

