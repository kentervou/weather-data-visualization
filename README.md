# Weather Data Visualization

An interactive data visualization built with p5.js that explores how chart design and axis scaling influence the way viewers interpret weather data.

## Project Overview

This project compares two visual representations of weather measurements to investigate how axis choices can change the perceived magnitude of differences in data. Users can explore different weather metrics and adjust the axis baseline to see how visualization choices affect interpretation.

## Features

- Interactive weather metric selection
- Adjustable axis baseline, from truncated to zero-based
- Animated decorative elements
- CSV upload support for compatible datasets
- Custom typography, colors, and layout

## Built With

- JavaScript
- p5.js
- HTML and CSS

## How to Use

1. Open the live demo: https://editor.p5js.org/kentervou/full/K1hk9wAb-
2. Upload the included `sample-weather.csv` file using the CSV upload control.
3. Select a weather metric.
4. Adjust the axis-baseline slider and compare the charts.
5. Try another compatible CSV to explore how different datasets are represented.

## Dataset

The included sample dataset contains weather measurements with the following fields:

- `date`
- `city`
- `temp_c` — temperature in Celsius
- `humidity` — relative humidity percentage
- `precipitation_mm` — precipitation in millimeters
- `wind_kmh` — wind speed in kilometers per hour
- `condition` — weather condition

I sourced this data from howtocsv.com.

## Design Goals

The project explores how data visualization is not simply a matter of displaying numbers. Decisions about scales, proportions, and visual emphasis can influence the conclusions viewers draw. By allowing users to manipulate the axis baseline, the visualization encourages critical examination of how data is presented.

## Development Notes

I used AI assistance for selected coding, debugging, and animation tasks. I reviewed and adapted the code as part of the development process.

