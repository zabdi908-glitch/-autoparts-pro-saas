import sqlite3
import os
from datetime import datetime


class EnquiriesStore:
    """Handles storage and retrieval of customer enquiries captured by the AI chat assistant."""

    def __init__(self):
        if os.getenv('RENDER'):
            self.database = os.path.join('/data', 'inventory.db')
        else:
            self.database = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'inventory.db')
        self.init_table()

    def init_table(self):
        try:
            conn = sqlite3.connect(self.database)
            conn.execute('''CREATE TABLE IF NOT EXISTS enquiries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                phone TEXT,
                email TEXT,
                vehicle TEXT,
                part TEXT,
                status TEXT DEFAULT 'New',
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )''')
            conn.commit()
            conn.close()
            print("Enquiries table ready")
        except Exception as e:
            print(f"Enquiries table error: {e}")

    def get_db(self):
        conn = sqlite3.connect(self.database, timeout=20)
        conn.row_factory = sqlite3.Row
        return conn

    def add_enquiry(self, data):
        """Save a new enquiry. Returns the new enquiry's id, or None on failure."""
        try:
            conn = self.get_db()
            cursor = conn.execute(
                '''INSERT INTO enquiries (name, phone, email, vehicle, part, status)
                   VALUES (?, ?, ?, ?, ?, 'New')''',
                (data.get('name', ''), data.get('phone', ''), data.get('email', ''),
                 data.get('vehicle', ''), data.get('part', ''))
            )
            conn.commit()
            enquiry_id = cursor.lastrowid
            conn.close()
            return enquiry_id
        except Exception as e:
            print(f"❌ Failed to save enquiry: {e}", flush=True)
            return None

    def get_all_enquiries(self, status_filter=None):
        try:
            conn = self.get_db()
            if status_filter and status_filter != 'All':
                rows = conn.execute(
                    'SELECT * FROM enquiries WHERE status = ? ORDER BY created_at DESC',
                    (status_filter,)
                ).fetchall()
            else:
                rows = conn.execute('SELECT * FROM enquiries ORDER BY created_at DESC').fetchall()
            conn.close()
            return [dict(r) for r in rows]
        except Exception as e:
            print(f"❌ Failed to fetch enquiries: {e}", flush=True)
            return []

    def get_enquiry(self, enquiry_id):
        try:
            conn = self.get_db()
            row = conn.execute('SELECT * FROM enquiries WHERE id = ?', (enquiry_id,)).fetchone()
            conn.close()
            return dict(row) if row else None
        except Exception as e:
            return None

    def update_status(self, enquiry_id, status, notes=None):
        try:
            conn = self.get_db()
            if notes is not None:
                conn.execute(
                    'UPDATE enquiries SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    (status, notes, enquiry_id)
                )
            else:
                conn.execute(
                    'UPDATE enquiries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    (status, enquiry_id)
                )
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"❌ Failed to update enquiry: {e}", flush=True)
            return False

    def get_counts(self):
        """Returns a dict of counts per status, for dashboard badges."""
        try:
            conn = self.get_db()
            rows = conn.execute('SELECT status, COUNT(*) as count FROM enquiries GROUP BY status').fetchall()
            conn.close()
            counts = {r['status']: r['count'] for r in rows}
            counts['Total'] = sum(counts.values())
            return counts
        except Exception as e:
            return {'Total': 0}


enquiries_store = EnquiriesStore()
