import json
import os

def load_credentials():
    """Load API credentials from config.json and set as environment variables"""
    with open("config.json", "r") as f:
        config = json.load(f)
    
    # Set environment variables
    os.environ["ONSHAPE_API_KEY"] = config["dev_access"]
    os.environ["ONSHAPE_API_SECRET"] = config["dev_secret"]
    
    print("Credentials loaded from config.json")

if __name__ == "__main__":
    load_credentials()