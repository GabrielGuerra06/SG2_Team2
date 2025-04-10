import webbrowser
import shutil
import glob
import os

def launch_dashboard():
    # Find the latest JSON file
    json_files = sorted(glob.glob("data/results_*.json"), reverse=True)
    if not json_files:
        print("No JSON result files found.")
        return

    latest_file = json_files[0]
    target_file = "data/results_latest.json"

    # Copy to results_latest.json for dashboard
    shutil.copy(latest_file, target_file)
    print(f"Copied {latest_file} to {target_file}")

    # Open dashboard in default browser
    url = os.path.abspath("dashboard.html")
    webbrowser.open(f"file://{url}")

if __name__ == "__main__":
    launch_dashboard()
