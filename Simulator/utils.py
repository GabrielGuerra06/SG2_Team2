"""
The utils module contains the definitions for the simulator and configuration classes.
"""

import simpy
import random
import logging
import argparse

class SimulationConfig:
    """
    Handles the argument passing around the code using a singleton pattern
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SimulationConfig, cls).__new__(cls)
            cls._instance._init_params()
        return cls._instance

    def _init_params(self):
        parser = argparse.ArgumentParser(description="Manufacturing Facility Simulation")
        parser.add_argument("--bin_capacity", type=int, default=25, help="Capacity of bins")
        parser.add_argument("--restock_devices_count", type=int, default=3, help="Number of restock devices")
        parser.add_argument("--restock_time_mean", type=float, default=2, help="Mean restock time")
        parser.add_argument("--maintenance_check_interval", type=int, default=5, help="Interval for maintenance checks")
        parser.add_argument("--maintenance_time_mean", type=float, default=3, help="Mean maintenance time")
        parser.add_argument("--processing_time_mean", type=float, default=4, help="Mean processing time")
        parser.add_argument("--rejection_prob", type=float, default=0.05, help="Probability of product rejection")
        parser.add_argument("--accident_prob", type=float, default=0.0001, help="Probability of an accident occurring")
        parser.add_argument("--simulation_time", type=int, default=5000, help="Total simulation time")
        parser.add_argument("--verbosity", type=int, default=100, help="Logging level")
        parser.add_argument("--iterations", type=int, default=1, help="Number of iterations")
        parser.add_argument("--plot", type=bool, default=False, help="Graphic plots")
        args = parser.parse_args()
        self.NUM_STATIONS = 6
        self.BIN_CAPACITY = args.bin_capacity
        self.RESTOCK_DEVICES = args.restock_devices_count
        self.RESTOCK_TIME = args.restock_time_mean
        self.MAINTENANCE_INTERVAL = args.maintenance_check_interval
        self.MAINTENANCE_TIME = args.maintenance_time_mean
        self.PROCESSING_TIME = args.processing_time_mean
        self.REJECTION_PROB = args.rejection_prob
        self.ACCIDENT_PROB = args.accident_prob
        self.SIMULATION_TIME = args.simulation_time
        self.STATION_FAILURE_PROBS = [0.02, 0.01, 0.05, 0.15, 0.07, 0.06]
        self.PLOTTING = args.plot
        self.ITERATIONS = args.iterations
        logging.basicConfig(level=args.verbosity, format='%(asctime)s - %(levelname)s - %(message)s')


class ManufacturingFacility:
    """
    Defines the model of a facility, and holds the informetion of the key performance metrics
    """
    def __init__(self, env):
        self.env = env
        self.stations = [simpy.Resource(env) for _ in range(SimulationConfig().NUM_STATIONS)]
        self.bins = [simpy.Container(env, SimulationConfig().BIN_CAPACITY, init=SimulationConfig().BIN_CAPACITY)
                     for _ in range(SimulationConfig().NUM_STATIONS)]
        self.restock_devices = simpy.Resource(env, SimulationConfig().RESTOCK_DEVICES)
        self.station_counts = [0] * SimulationConfig().NUM_STATIONS
        self.accepted_products = 0
        self.rejected_products = 0
        self.station_busy_time = [0.0] * SimulationConfig().NUM_STATIONS
        self.maintenance_downtime = [0.0] * SimulationConfig().NUM_STATIONS
        self.restock_device_busy_time = 0.0
        self.total_maintenance_time = 0.0
        self.total_maintenance_events = 0
        self.station_waiting_time = [0.0] * SimulationConfig().NUM_STATIONS
        self.bin_waiting_time = [0.0] * SimulationConfig().NUM_STATIONS

    def restock_bin(self, station_id):
        with self.restock_devices.request() as req:
            yield req
            start_time = self.env.now
            restock_time = max(0, random.normalvariate(SimulationConfig().RESTOCK_TIME, 0.5))
            yield self.env.timeout(restock_time)
            yield self.bins[station_id].put(SimulationConfig().BIN_CAPACITY)
            end_time = self.env.now
            self.restock_device_busy_time += (end_time - start_time)
            logging.debug(f"station {station_id + 1} restocked {self.env.now:.2f}")

    def perform_maintenance(self, station_id):
        with self.stations[station_id].request() as req:
            logging.debug(f"maintenance started at station {station_id + 1}  {self.env.now:.2f}")
            start_time = self.env.now
            maintenance_time = random.expovariate(1 / SimulationConfig().MAINTENANCE_TIME)
            yield self.env.timeout(maintenance_time)
            end_time = self.env.now
            duration = end_time - start_time
            self.maintenance_downtime[station_id] += duration
            self.total_maintenance_time += duration
            self.total_maintenance_events += 1
            logging.debug(f"maintenance completed at station {station_id + 1} {self.env.now:.2f}")


def process_station(env, facility, product_id, station_id):
    """
    Process a product through a station, using the facility, product_id, and the station id
    """
    bin = facility.bins[station_id]
    station = facility.stations[station_id]
    logging.debug(f"product {product_id} requests Station {station_id + 1} {env.now:.2f}")
    with station.request() as req:
        station_request_start = env.now
        yield req
        station_request_end = env.now
        facility.station_waiting_time[station_id] += (station_request_end - station_request_start)

        start_time = env.now
        try:
            bin_get_start = env.now
            yield bin.get(1)
            bin_get_end = env.now
            facility.bin_waiting_time[station_id] += (bin_get_end - bin_get_start)

            logging.debug(f"product {product_id} got material from station {station_id + 1}  {env.now:.2f}")
            if bin.level == 0:
                env.process(facility.restock_bin(station_id))
                logging.debug(f"restock for station {station_id + 1}  {env.now:.2f}")

            processing_time = max(0, random.normalvariate(SimulationConfig().PROCESSING_TIME, 0.5))
            yield env.timeout(processing_time)
            logging.debug(
                f"product {product_id} processed at station {station_id + 1} in {processing_time:.2f}")

            facility.station_counts[station_id] += 1
            if facility.station_counts[station_id] % SimulationConfig().MAINTENANCE_INTERVAL == 0:
                if random.random() < SimulationConfig().STATION_FAILURE_PROBS[station_id]:
                    logging.debug(f"station {station_id + 1} requires maintenance {env.now:.2f}")
                    yield env.process(facility.perform_maintenance(station_id))
        finally:
            end_time = env.now
            facility.station_busy_time[station_id] += (end_time - start_time)



def process_product(env, facility, product_id):
    """
    Defines the workflow of a station inside of the facility
    """
    for i in range(3):
        yield env.process(process_station(env, facility, product_id, i))
        logging.debug(f"product {product_id} completes phase {i + 1} {env.now:.2f}")

    # Optional order through station 4 or 5
    if random.choice([True, False]):
        logging.debug(f"product {product_id} goes to phase 4 {env.now:.2f}")
        yield env.process(process_station(env, facility, product_id, 3))
        logging.debug(f"product {product_id} completes phase 4 {env.now:.2f}")
        yield env.process(process_station(env, facility, product_id, 4))
        logging.debug(f"product {product_id} completes phase 5 {env.now:.2f}")
    else:
        logging.debug(f"product {product_id} goes to phase 5 {env.now:.2f}")
        yield env.process(process_station(env, facility, product_id, 4))
        logging.debug(f"product {product_id} completes phase 5 {env.now:.2f}")
        yield env.process(process_station(env, facility, product_id, 3))
        logging.debug(f"product {product_id} completes phase 4 {env.now:.2f}")

    logging.debug(f"product {product_id} starts phase 6 {env.now:.2f}")
    yield env.process(process_station(env, facility, product_id, 5))
    logging.debug(f"product {product_id} completes phase 6 {env.now:.2f}")

    if random.random() < SimulationConfig().REJECTION_PROB:
        logging.debug(f"product {product_id} rejected {env.now:.2f}")
        facility.rejected_products += 1
    else:
        logging.debug(f"product {product_id} accepted {env.now:.2f}")
        facility.accepted_products += 1

def product_generator(env, facility):
    """
    Passes a product through the pipeline
    """
    product_id = 0
    while True:
        env.process(process_product(env, facility, product_id))
        product_id += 1
        yield env.timeout(1)

def accident_monitor(env):
    """
    Monitors accidents throughout the simulation
    """
    while True:
        yield env.timeout(1)
        if random.random() < SimulationConfig().ACCIDENT_PROB:
            logging.error(f"Accident happened at {env.now:.2f}")
            env.process(stop_simulation(env))

def stop_simulation(env):
    """Stops the simulation by raising an exception."""
    raise RuntimeError("Simulation halted due to an accident.")