import matplotlib.pyplot as plt
import numpy as np
from utils import *

def run_simulation():
    """
    Runs and logs the results of a single simulation
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
    Runs multiple simulations and logs the results
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
    Plots the information of multilple runs
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
    Prints the average value of multiple runs
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