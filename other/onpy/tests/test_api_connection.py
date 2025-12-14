import os
import pytest
from onpy import Client  # This is the correct import

def test_api_connection():
    """Test that API connection works with loaded credentials"""
    # Load credentials directly in the test
    import json
    with open("config.json", "r") as f:
        config = json.load(f)
    
    os.environ["ONSHAPE_API_KEY"] = config["dev_access"]
    os.environ["ONSHAPE_API_SECRET"] = config["dev_secret"]
    
    # Create client directly as shown in test_documents.py
    client = Client()
    
    # Test a simple API call
    docs = client.list_documents()
    assert docs is not None, "Failed to connect to API"
    print(f"Successfully connected to API")