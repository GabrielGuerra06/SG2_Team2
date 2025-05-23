import os
import json
import datetime
import numpy as np
import matplotlib.pyplot as plt
import simpy
from utils import *

def run_simulation():
    """
    Runs and logs the results of a single simulation of a manufacturing facility.

    Returns:
        dict: A dictionary containing simulation metrics (each value is wrapped in a list or a list of lists)
              including the additional metrics:
                - "complete_production" (list[int])
                - "occupancy_per_workstation" (list[list[float]])
                - "avg_production_time" (list[list[float]])
                - "production_rejection_percentage" (list[float])
                - "avg_delay_time" (list[float])
                - "accident_rate" (list[float])
                - "workstation_status" (list[dict])
                - "bottleneck_workstations" (dict)
              Other previously computed metrics are also included.
    """
    env = simpy.Environment()
    facility = ManufacturingFacility(env)

    # Start simulation processes
    env.process(product_generator(env, facility))
    env.process(accident_monitor(env))

    accident = False
    try:
        env.run(until=SimulationConfig().SIMULATION_TIME)
    except RuntimeError:
        print("Accident happened")
        accident = True

    actual_time = env.now

    # Compute basic production metrics
    accepted = facility.accepted_products
    rejected = facility.rejected_products
    total = accepted + rejected

    # Production rejection percentage (by number and percentage)
    rejection_percentage = (rejected / total * 100) if total > 0 else 0

    # Average delay time: computed as the same as bottleneck delay in this example.
    avg_delay = (sum(facility.station_waiting_time) + sum(facility.bin_waiting_time)) / total if total > 0 else 0

    # Workstation status partition per station:
    workstation_status = []
    for i in range(SimulationConfig().NUM_STATIONS):
        # Operational time is the busy time.
        operational = facility.station_busy_time[i]
        # Down time is recorded from maintenance downtime.
        down_time = facility.maintenance_downtime[i]
        # Waiting for restock (or idle) is what remains.
        waiting = actual_time - operational
        workstation_status.append({
            "operational": operational,
            "downtime": down_time,
            "waiting_for_restock": waiting
        })

    # Analysis on bottleneck workstations using waiting times.
    waiting_times = facility.station_waiting_time if hasattr(facility, 'station_waiting_time') else [0] * SimulationConfig().NUM_STATIONS
    bottleneck_index = int(np.argmax(waiting_times)) if waiting_times else None
    max_waiting_time = max(waiting_times) if waiting_times else 0
    bottleneck_analysis = {
        "waiting_times": waiting_times,
        "bottleneck_station": bottleneck_index,
        "max_waiting_time": max_waiting_time
    }

    # Average production time per workstation.
    avg_production_time = []
    for i in range(SimulationConfig().NUM_STATIONS):
        if facility.station_counts[i] > 0:
            prod_time = facility.station_busy_time[i] / facility.station_counts[i]
        else:
            prod_time = 0
        avg_production_time.append(prod_time)

    # Compile all metrics into the dictionary.
    metrics = {
        "accepted_products": accepted,
        "rejected_products": rejected,
        "total_products": total,
        "occupancy_per_workstation": [
            facility.station_busy_time[i] / actual_time for i in range(SimulationConfig().NUM_STATIONS)
        ],
        "avg_production_time": avg_production_time,
        "production_rejection_percentage": rejection_percentage,
        "avg_delay_time": avg_delay,
        "accident_rate": int(accident) * 100,  # Expressed as percentage (0 or 100)
        "workstation_status": workstation_status,
        "bottleneck_workstations": bottleneck_analysis,
        "supplier_occupancy": facility.restock_device_busy_time / (actual_time * SimulationConfig().RESTOCK_DEVICES),
        "avg_fix_time": facility.total_maintenance_time / facility.total_maintenance_events if facility.total_maintenance_events > 0 else 0,
        "avg_bottleneck_delay": avg_delay,
        "faulty_product_rate": rejected / total if total > 0 else 0,
        "accidents": int(accident)
    }
    return metrics

def run_multiple_simulations_dict(num_iterations):
    """
    Runs the simulation multiple times and stores each iteration's result in a dictionary.

    Args:
        num_iterations (int): The number of simulation iterations to run.

    Returns:
        list[dict]: A list where each element is a dictionary representing one simulation
                    with the keys defined in run_simulation().
    """
    all_results = []
    for i in range(num_iterations):
        print(f"Simulation {i + 1}/{num_iterations}")
        simulation_result = run_simulation()
        all_results.append(simulation_result)
    return all_results

def export_results_to_json(results, generated_folder="Data", filename="simulator.json", backup_folder="Data/backup"):
    """
    Exports the simulation results to a JSON file with a common name for dashboard use.
    If a previous JSON file exists, it is moved to a backup folder with a timestamp.

    Args:
        results (list[dict]): List of simulation result dictionaries.
        generated_folder (str): Folder where the JSON file will be saved.
        filename (str): Name of the JSON file for the dashboard.
        backup_folder (str): Folder to store backup files.
    """
    # Ensure the main folder exists.
    os.makedirs(generated_folder, exist_ok=True)
    filepath = os.path.join(generated_folder, filename)

    # If a previous file exists, move it to the backup folder with a timestamp.
    if os.path.exists(filepath):
        os.makedirs(backup_folder, exist_ok=True)
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"{timestamp}.json"
        backup_path = os.path.join(backup_folder, backup_filename)
        os.rename(filepath, backup_path)
        print(f"Previous results backed up to {backup_path}")

    # Export the new simulation results.
    with open(filepath, "w") as file:
        json.dump(results, file, indent=4)
    print(f"Results successfully exported to {filepath}")

def plot_results(results_list, num_iterations):
    """
    Visualizes aggregated results from multiple simulation runs.
    (This function can be updated to generate aggregate plots if needed.)
    """
    pass

def print_individual_results(results_list):
    """
    Prints the simulation results for each iteration in the given format.

    Args:
        results_list (list[dict]): List of dictionaries where each dictionary contains
                                   simulation results for one day.
    """
    for day_index, result in enumerate(results_list, start=1):
        print(f"\nDay {day_index}:")
        for key, value in result.items():
            print(f"{key}: {value}")

def main():
    num_iterations = SimulationConfig().ITERATIONS
    results_list = run_multiple_simulations_dict(num_iterations)

    if SimulationConfig().PLOTTING:
        plot_results(results_list, num_iterations)

    print_individual_results(results_list)
    # Export the results to the common JSON file and back up the previous one if it exists.
    export_results_to_json(results_list)

if __name__ == "__main__":
    main()