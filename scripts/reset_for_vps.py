import os
import shutil
import time

base_dir = r"c:\Users\yossi\OneDrive\Desktop\amp\shorts_maker\autoclip"
data_dir = os.path.join(base_dir, "data")
db_path = os.path.join(data_dir, "autoclip.db")

folders_to_clear = [
    "projects",
    "uploads",
    "temp",
    "output"
]

print("\n" + "="*50)
print("🚀 PREPARING AUTOCLIP FOR VPS DEPLOYMENT")
print("="*50 + "\n")

# Attempt to delete the DB
try:
    if os.path.exists(db_path):
        os.remove(db_path)
        print("✅ Deleted database (autoclip.db)")
except PermissionError:
    print("❌ ERROR: Could not delete autoclip.db because the FastAPI server is still running!")
    print("   -> Action Required: Go to your terminal where Python is running, press CTRL+C to stop it, and run this script again.\n")
    exit(1)

# Delete the folders
for folder in folders_to_clear:
    folder_path = os.path.join(data_dir, folder)
    if os.path.exists(folder_path):
        try:
            shutil.rmtree(folder_path)
            print(f"✅ Deleted folder: {folder}")
            os.makedirs(folder_path, exist_ok=True)
        except Exception as e:
            print(f"⚠️ Could not fully delete {folder}: {e}")
    else:
        os.makedirs(folder_path, exist_ok=True)

print("\n" + "="*50)
print("🎉 SUCCESS! Your local setup is now completely empty.")
print("   All old test projects, videos, and database logs are wiped.")
print("   You are now perfectly ready to ZIP this folder and deploy to your VPS.")
print("="*50 + "\n")
