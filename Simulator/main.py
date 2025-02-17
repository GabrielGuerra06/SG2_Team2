"""
Authors:
    - Carlos Esteban Lopez Sanchez
    - Miguel Herrera Padilla
    - Eduardo Daniel Ramirez Prado
    - Gabriel Guerra Rosales

Disclaimer:
    Documentation and plotting functions were generated with the assistance of AI tools.
"""

import matplotlib.pyplot as plt
import numpy as np
from utils import *

def run_simulation():
    """
    Runs and logs the results of a single simulation of a manufacturing facility.

    This function initializes a simulation environment, sets up the manufacturing facility,
    and runs the simulation for a predefined duration. It monitors for accidents and
    collects various performance metrics during the simulation.

    Returns:
        dict: A dictionary containing the following metrics:
            - "accepted_products" (int): Number of products accepted by the facility.
            - "rejected_products" (int): Number of products rejected by the facility.
            - "total_products" (int): Total number of products processed (accepted + rejected).
            - "occupancy_rates" (list[float]): List of occupancy rates for each station in the facility.
            - "downtime" (list[float]): List of downtime durations for each station due to maintenance.
            - "supplier_occupancy" (float): Occupancy rate of the restocking devices.
            - "avg_fix_time" (float): Average time taken to fix maintenance issues.
            - "avg_bottleneck_delay" (float): Average delay caused by bottlenecks in the system.
            - "faulty_product_rate" (float): Rate of faulty products (rejected products / total products).
            - "accident" (int): Binary indicator (0 or 1) of whether an accident occurred during the simulation.
    """
    env = simpy.Environment()
    facility = ManufacturingFacility(env)
    env.process(product_generator(env, facility))
    env.process(accident_monitor(env))
    accident = False
    try:
        env.run(until=SimulationConfig().SIMULATION_TIME)
    except RuntimeError:
        print("Accident happened")
        accident = True

    actual_time = env.now

    metrics = {
        "accepted_products": facility.accepted_products,
        "rejected_products": facility.rejected_products,
        "total_products": facility.accepted_products + facility.rejected_products,
        "occupancy_rates": [facility.station_busy_time[i] / actual_time for i in range(SimulationConfig().NUM_STATIONS)],
        "downtime": [facility.maintenance_downtime[i] for i in range(SimulationConfig().NUM_STATIONS)],
        "supplier_occupancy": facility.restock_device_busy_time / (actual_time * SimulationConfig().RESTOCK_DEVICES),
        "avg_fix_time": facility.total_maintenance_time / facility.total_maintenance_events if facility.total_maintenance_events > 0 else 0,
        "avg_bottleneck_delay": (sum(facility.station_waiting_time) + sum(facility.bin_waiting_time)) / (facility.accepted_products + facility.rejected_products) if facility.accepted_products + facility.rejected_products > 0 else 0,
        "faulty_product_rate": facility.rejected_products / (facility.accepted_products + facility.rejected_products) if facility.accepted_products + facility.rejected_products > 0 else 0,
        "accident": int(accident)
    }

    return metrics

def run_multiple_simulations(num_iterations):
    """
       Runs multiple simulations of the manufacturing facility and aggregates the results.

       This function executes the `run_simulation` function multiple times (as specified by `num_iterations`)
       and collects the results from each simulation. The results are aggregated into a dictionary,
       where each key corresponds to a specific metric, and the value is a list of results from all iterations.

       Args:
           num_iterations (int): The number of simulations to run.

       Returns:
           dict: A dictionary containing aggregated results from all simulations. The keys and their corresponding
                 value types are as follows:
                   - "accepted_products" (list[int]): List of accepted products counts from each simulation.
                   - "rejected_products" (list[int]): List of rejected products counts from each simulation.
                   - "total_products" (list[int]): List of total products processed (accepted + rejected) from each simulation.
                   - "occupancy_rates" (list[list[float]]): List of lists, where each inner list contains occupancy rates
                     for a specific station across all simulations.
                   - "downtime" (list[list[float]]): List of lists, where each inner list contains downtime durations
                     for a specific station across all simulations.
                   - "supplier_occupancy" (list[float]): List of supplier occupancy rates from each simulation.
                   - "avg_fix_time" (list[float]): List of average fix times for maintenance issues from each simulation.
                   - "avg_bottleneck_delay" (list[float]): List of average bottleneck delays from each simulation.
                   - "faulty_product_rate" (list[float]): List of faulty product rates from each simulation.
                   - "accidents" (list[int]): List of binary indicators (0 or 1) representing whether an accident
                     occurred in each simulation.
       """
    results = {
        "accepted_products": [],
        "rejected_products": [],
        "total_products": [],
        "occupancy_rates": [[] for _ in range(SimulationConfig().NUM_STATIONS)],
        "downtime": [[] for _ in range(SimulationConfig().NUM_STATIONS)],
        "supplier_occupancy": [],
        "avg_fix_time": [],
        "avg_bottleneck_delay": [],
        "faulty_product_rate": [],
        "accidents": []
    }

    for i in range(num_iterations):
        print(f"Simulation {i+1}/{num_iterations}")
        metrics = run_simulation()

        results["accepted_products"].append(metrics["accepted_products"])
        results["rejected_products"].append(metrics["rejected_products"])
        results["total_products"].append(metrics["total_products"])
        results["supplier_occupancy"].append(metrics["supplier_occupancy"])
        results["avg_fix_time"].append(metrics["avg_fix_time"])
        results["avg_bottleneck_delay"].append(metrics["avg_bottleneck_delay"])
        results["faulty_product_rate"].append(metrics["faulty_product_rate"])
        results["accidents"].append(metrics["accident"])

        for j in range(SimulationConfig().NUM_STATIONS):
            results["occupancy_rates"][j].append(metrics["occupancy_rates"][j])
            results["downtime"][j].append(metrics["downtime"][j])

    return results

def plot_results(results, num_iterations):
    """
        Visualizes the results of multiple simulation runs using various plots.

        This function generates a series of plots to visualize the performance metrics collected
        from multiple simulation runs. The plots include:
        - Accepted vs Rejected Products
        - Faulty Product Rate
        - Supplier Occupancy Rate
        - Average Bottleneck Delay
        - Station Occupancy Rates
        - Station Downtime (Maintenance)
        - Accidents per Iteration

        Args:
            results (dict): A dictionary containing aggregated results from multiple simulations.
                            The dictionary should have the following keys:
                            - "accepted_products" (list[int]): List of accepted products counts.
                            - "rejected_products" (list[int]): List of rejected products counts.
                            - "faulty_product_rate" (list[float]): List of faulty product rates.
                            - "supplier_occupancy" (list[float]): List of supplier occupancy rates.
                            - "avg_bottleneck_delay" (list[float]): List of average bottleneck delays.
                            - "occupancy_rates" (list[list[float]]): List of lists containing occupancy rates for each station.
                            - "downtime" (list[list[float]]): List of lists containing downtime durations for each station.
                            - "accidents" (list[int]): List of binary indicators (0 or 1) for accidents.
            num_iterations (int): The number of simulation iterations, used to generate the x-axis values.

        Returns:
            None: This function only generates plots and does not return any value.
        """
    x_values = np.arange(1, num_iterations + 1)

    plt.figure(figsize=(12, 8))

    # Accepted & Rejected Products
    plt.subplot(2, 2, 1)
    plt.plot(x_values, results["accepted_products"], label="Accepted Products", marker='o')
    plt.plot(x_values, results["rejected_products"], label="Rejected Products", marker='x')
    plt.xlabel("Iteration")
    plt.ylabel("Count")
    plt.title("Accepted vs Rejected Products")
    plt.legend()

    # Faulty Product Rate
    plt.subplot(2, 2, 2)
    plt.plot(x_values, results["faulty_product_rate"], label="Faulty Product Rate", marker='s', color='r')
    plt.xlabel("Iteration")
    plt.ylabel("Rate")
    plt.title("Faulty Product Rate")
    plt.legend()

    # Supplier Occupancy
    plt.subplot(2, 2, 3)
    plt.plot(x_values, results["supplier_occupancy"], label="Supplier Occupancy", marker='d', color='g')
    plt.xlabel("Iteration")
    plt.ylabel("Occupancy Rate")
    plt.title("Supplier Occupancy Rate")
    plt.legend()

    # Bottleneck Delay
    plt.subplot(2, 2, 4)
    plt.plot(x_values, results["avg_bottleneck_delay"], label="Avg Bottleneck Delay", marker='p', color='m')
    plt.xlabel("Iteration")
    plt.ylabel("Delay Time")
    plt.title("Average Bottleneck Delay")
    plt.legend()
    plt.tight_layout()
    plt.show()

    # Occupancy Rates per Station
    plt.figure(figsize=(12, 6))
    for i in range(SimulationConfig().NUM_STATIONS):
        plt.plot(x_values, results["occupancy_rates"][i], label=f"Station {i + 1}", marker='v')
    plt.xlabel("Iteration")
    plt.ylabel("Occupancy Rate")
    plt.title("Station Occupancy Rates")
    plt.legend()
    plt.show()

    # Downtime per Station
    plt.figure(figsize=(12, 6))
    for i in range(SimulationConfig().NUM_STATIONS):
        plt.plot(x_values, results["downtime"][i], label=f"Station {i + 1}", marker='x')
    plt.xlabel("Iteration")
    plt.ylabel("Downtime")
    plt.title("Station Downtime (Maintenance)")
    plt.legend()
    plt.show()

    # Accidents per Iteration
    plt.figure(figsize=(10, 4))
    plt.scatter(x_values, results["accidents"], label="Accidents", color='r', marker='x', s=100)
    plt.xlabel("Iteration")
    plt.ylabel("Occurred (1 = Yes, 0 = No)")
    plt.title("Accidents per Iteration")
    plt.yticks([0, 1], ["No", "Yes"])
    plt.grid(axis="y", linestyle="--", alpha=0.7)
    plt.legend()
    plt.show()


def print_average_stats(results):
    """
    Calculates and prints the average values of key metrics from multiple simulation runs.

    This function computes the mean values of the metrics stored in the `results` dictionary
    and prints them in a human-readable format. The metrics include:
    - Accepted and Rejected Products
    - Total Products
    - Supplier Occupancy Rate
    - Average Fix Time
    - Average Bottleneck Delay
    - Faulty Product Rate
    - Accident Occurrence Rate
    - Occupancy Rates for each station
    - Downtime for each station

    Args:
        results (dict): A dictionary containing aggregated results from multiple simulations.
                        The dictionary should have the following keys:
                        - "accepted_products" (list[int]): List of accepted products counts.
                        - "rejected_products" (list[int]): List of rejected products counts.
                        - "total_products" (list[int]): List of total products processed (accepted + rejected).
                        - "supplier_occupancy" (list[float]): List of supplier occupancy rates.
                        - "avg_fix_time" (list[float]): List of average fix times for maintenance issues.
                        - "avg_bottleneck_delay" (list[float]): List of average bottleneck delays.
                        - "faulty_product_rate" (list[float]): List of faulty product rates.
                        - "accidents" (list[int]): List of binary indicators (0 or 1) for accidents.
                        - "occupancy_rates" (list[list[float]]): List of lists containing occupancy rates for each station.
                        - "downtime" (list[list[float]]): List of lists containing downtime durations for each station.

    Returns:
        None: This function only prints the results and does not return any value.
    """
    print("\nAverage values")
    print(f"Accepted Products: {np.mean(results['accepted_products']):.2f}")
    print(f"Rejected Products: {np.mean(results['rejected_products']):.2f}")
    print(f"Total Products: {np.mean(results['total_products']):.2f}")
    print(f"Supplier Occupancy: {np.mean(results['supplier_occupancy']):.2f}")
    print(f"Fix Time: {np.mean(results['avg_fix_time']):.2f}")
    print(f"Bottleneck Delay: {np.mean(results['avg_bottleneck_delay']):.2f}")
    print(f"Faulty Product Rate: {np.mean(results['faulty_product_rate']):.2%}")
    print(f"Accident Occurrence Rate: {np.mean(results['accidents']) * 100:.2f}%")

    for i in range(len(results["occupancy_rates"])):
        print(f"Occupancy Rate (Station {i + 1}): {np.mean(results['occupancy_rates'][i]):.2f}")

    for i in range(len(results["downtime"])):
        print(f"Downtime (Station {i + 1}): {np.mean(results['downtime'][i]):.2f}")


def main():
    results = run_multiple_simulations(SimulationConfig().ITERATIONS)

    if SimulationConfig().PLOTTING:
        plot_results(results, SimulationConfig().ITERATIONS)

    print_average_stats(results)


if __name__ == "__main__":
    main()