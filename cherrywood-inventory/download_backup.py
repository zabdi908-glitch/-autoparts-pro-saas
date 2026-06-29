import requests
import json
import os

# Your Render URL - CHANGE THIS TO YOUR ACTUAL URL
url = "https://cherrywood-inventory.onrender.com/static/vehicles_backup.json"

try:
    print("📥 Downloading backup from Render...")
    response = requests.get(url)
    
    if response.status_code == 200:
        data = response.json()
        with open('vehicles_backup.json', 'w') as f:
            json.dump(data, f, indent=2)
        print(f"✅ Downloaded backup with {len(data)} vehicles!")
        print(f"📁 Saved to: vehicles_backup.json")
        
        # Show first vehicle as preview
        if data:
            print(f"\n📋 First vehicle:")
            print(f"  Title: {data[0].get('title', 'N/A')}")
            print(f"  Make: {data[0].get('make', 'N/A')}")
            print(f"  Model: {data[0].get('model', 'N/A')}")
    else:
        print(f"❌ Failed to download. Status code: {response.status_code}")
        print("💡 Make sure your site is live and has vehicles.")
        
except Exception as e:
    print(f"❌ Error: {e}")
    print("\n💡 Alternative: Copy the backup manually from the browser.")