import sqlite3
import json

def main():
    conn = sqlite3.connect('data/autoclip.db')
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute('SELECT id, name, status, project_type, created_at FROM projects ORDER BY created_at DESC LIMIT 5')
    rows = cur.fetchall()
    
    projects = [dict(r) for r in rows]
    print(json.dumps(projects, indent=2))
    
if __name__ == '__main__':
    main()
