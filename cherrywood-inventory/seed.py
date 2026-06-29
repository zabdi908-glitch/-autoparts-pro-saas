import sqlite3
import json
import os

# Use the same database path as your app
if os.getenv('RENDER'):
    DATABASE = os.path.join('/tmp', 'inventory.db')
else:
    DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'inventory.db')

def seed_vehicles():
    """Add sample vehicles to the database and create backup"""
    vehicles = [
        {
            'title': '2015 Audi A3 2.0 TDI Breaker',
            'make': 'Audi',
            'model': 'A3',
            'year': '2015',
            'reg': 'AB15 XYZ',
            'engine': '2.0 TDI',
            'fuel': 'Diesel',
            'transmission': 'Manual',
            'mileage': '82,000',
            'status': 'Breaking',
            'image_url': 'https://via.placeholder.com/400x300/1a1a2e/ffffff?text=Audi+A3',
            'parts_available': 'Engine, Gearbox, Headlights, Doors, Seats',
            'description': 'Complete breakage of Audi A3 2.0 TDI. All parts tested.'
        },
        {
            'title': '2017 Volkswagen Golf GTI Parts Donor',
            'make': 'Volkswagen',
            'model': 'Golf GTI',
            'year': '2017',
            'reg': 'CD17 EFG',
            'engine': '2.0 TSI',
            'fuel': 'Petrol',
            'transmission': 'DSG',
            'mileage': '45,000',
            'status': 'Breaking',
            'image_url': 'https://via.placeholder.com/400x300/1a1a2e/ffffff?text=Golf+GTI',
            'parts_available': 'Turbo, ECU, Alloy Wheels, Bumper, Tailgate',
            'description': 'Low mileage Golf GTI being broken for parts.'
        }
    ]
    
    try:
        conn = sqlite3.connect(DATABASE)
        
        # Clear existing data
        conn.execute('DELETE FROM vehicle')
        
        # Add vehicles
        for v in vehicles:
            conn.execute('''INSERT INTO vehicle 
                (title, make, model, year, reg, engine, fuel, transmission, 
                 mileage, status, image_url, parts_available, description) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (v['title'], v['make'], v['model'], v['year'], v['reg'],
                 v['engine'], v['fuel'], v['transmission'], v['mileage'],
                 v['status'], v['image_url'], v['parts_available'], v['description']))
        
        conn.commit()
        conn.close()
        
        # Create backup
        with open('vehicles_backup.json', 'w') as f:
            json.dump(vehicles, f, indent=2)
        
        print(f"✅ Added {len(vehicles)} sample vehicles and created backup!")
        print("📁 vehicles_backup.json created")
        print("🚀 Now push to GitHub and deploy to Render")
    except Exception as e:
        print(f"❌ Error seeding database: {e}")

if __name__ == '__main__':
    seed_vehicles()