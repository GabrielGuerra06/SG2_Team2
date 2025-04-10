# data_exporter.py

import json
import os
from datetime import datetime

DATA_DIR = "simulation_data"
os.makedirs(DATA_DIR, exist_ok=True)


def export_simulation_data(results, metadata=None):
    """
    Saves the simulation results to a timestamped JSON file for later dashboard use.

    Args:
        results (dict): Dictionary of results from the simulation.
        metadata (dict): Optional metadata such as number of iterations, config, etc.
    """
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    file_path = os.path.join(DATA_DIR, f"simulation_{timestamp}.json")

    output = {
        "timestamp": timestamp,
        "metadata": metadata or {},
        "results": results
    }

    with open(file_path, "w") as f:
        json.dump(output, f, indent=4)

    print(f" Data exported to {file_path}")
