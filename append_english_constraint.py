import os

prompt_dir = r"c:\Users\yossi\OneDrive\Desktop\amp\shorts_maker\autoclip\prompt"

append_text = "\n\n[CRITICAL]: ALL GENERATED TEXT, TITLES, OUTLINES, REASONS, AND CONTENT MUST BE EXCLUSIVELY IN ENGLISH. DO NOT OUTPUT CHINESE. EVEN IF THE INPUT IS IN CHINESE, TRANSLATE AND GENERATE THE OUTPUT ENTIRELY IN ENGLISH.\n"

for root, dirs, files in os.walk(prompt_dir):
    for filename in files:
        if filename.endswith(".txt"):
            filepath = os.path.join(root, filename)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            if "[CRITICAL]" not in content:
                with open(filepath, "a", encoding="utf-8") as f:
                    f.write(append_text)
                print(f"Appended English constraint to: {filepath}")
            else:
                print(f"Already contains constraint: {filepath}")

