# Manufacturing Facility Simulation

This script simulates operations at a manufacturing facility using event-driven simulation. It leverages **simpy** for process simulation and **numpy** for generating random values based on specified parameters. The simulation data is output to `Simulator/data/simulator.json` for later visualization in a dashboard by opening `index.html`.

---

## Features

- **Parameterization:** Customize various simulation aspects such as:
  - **Bin Capacity:** Maximum items per bin.
  - **Restock Devices:** Number of devices to restock bins.
  - **Restock & Maintenance Timing:** Mean time values for operations.
  - **Processing Time:** Average time taken to process an item.
  - **Quality Checks:** Includes probabilities for product rejection and accidents.
  - **Simulation Duration and Iterations:** Total simulation time and number of runs.
  - **Logging Verbosity and Plotting:** Control output details and enable graphic plots if desired.

- **Output:** Generates a JSON file (`data/simulator.json`) containing a detailed **data dictionary** which describes the simulation results. This output is used to feed data into a dashboard interface (`index.html`) for easy visualization and analysis.

---

## Requirements

- **Python 3.6 or later**
- **simpy**
- **numpy**

You can install these packages using pip:

```bash
pip install simpy numpy
