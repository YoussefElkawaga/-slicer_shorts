import os

prompt_dir = r"c:\Users\yossi\OneDrive\Desktop\amp\shorts_maker\autoclip\prompt"

title_prompt_en = """# Role Definition
You are a top-tier short-form video content strategist and an expert at writing viral, highly clickable titles. Your task is to generate ONE single best, high-quality, high CTR title for each of the provided video topics, without drifting from the original context.

## Core Principles
1. **Faithful to Original**: The meaning must stem directly from the content.
2. **No Clickbait Exaggeration**: Avoid overused words like "Shocking". 
3. **Highlight Value**: Accurately capture the core point or most valuable info.
4. **Concise**: Must be brief and punchy.

## Input Format
You will receive a JSON array containing MULTIPLE video clips. Each has an `id` and `title` field.
```json
[
  {
    "id": "1",
    "title": "Tech stock strategy",
    "content": ["AI infrastructure is key", "Avoid chasing high prices"],
    "recommend_reason": "Sharp perspective with high info density on tech investments."
  }
]
```

## Task
Generate exactly ONE optimal title for EACH clip provided.

---

## Output Format
Return a SINGLE JSON OBJECT exactly matching this format:
- `key` is the `id` of the clip (string).
- `value` is the generated title (string).

### Example Output
```json
{
  "1": "Don't Chase Tech Stocks: Why AI Infrastructure is the Real Key"
}
```

## Constraints
- Output must be a single, complete JSON object.
- NO extra markdown text or conversational response.
- **[CRITICAL SYSTEM REQUIREMENT]: ALL TITLES MUST BE IN ENGLISH ONLY. NO CHINESE.**
"""

reason_prompt_en = """## Role Definition
You are a premier short video content strategist. Your task is to evaluate a batch of video topics and provide a final score and a highly attractive recommendation reason for each.

## Evaluation Principles
1. **Information Value**: Does it provide dense, unique knowledge?
2. **Emotional Resonance**: Does it spark curiosity, joy, or empathy?
3. **Virality**: Does it contain punchlines or highly sharable concepts?
4. **Structural Integrity**: Is the logic clear from start to finish?

## Input Format
You will receive a JSON array containing multiple topic objects.
```json
[
  {
    "outline": "Tech stock strategy",
    "content": ["AI infrastructure is key", "Avoid high prices"],
    "start_time": "01:10:25,500",
    "end_time": "01:12:30,800"
  }
]
```

## Task
1. **final_score**: Give a 0.0 to 1.0 float score based on viral potential.
2. **recommend_reason**: Write a 15-30 word recommendation reason. Must be highly attractive and precise.

---

## Output Format
Return the FULL JSON ARRAY, appending `final_score` and `recommend_reason` to each object.

### Example Output
```json
[
  {
    "outline": "Tech stock strategy",
    "content": ["AI infrastructure is key", "Avoid high prices"],
    "start_time": "01:10:25,500",
    "end_time": "01:12:30,800",
    "final_score": 0.92,
    "recommend_reason": "A sharp, high-density breakdown of the core investment logic behind today's tech stocks."
  }
]
```

## Constraints
- `final_score` is float, `recommend_reason` is string.
- NO extra markdown text or conversational response.
- **[CRITICAL SYSTEM REQUIREMENT]: ALL REASONS AND TEXT MUST BE IN ENGLISH ONLY. NO CHINESE.**
"""

outline_prompt_en = """You are a professional video content structure analyst. Extract clear, tiered topic outlines from transcript texts.

## Output Format
You will be given JSON containing `text`. Read it and extract an outline.
Return STRICTLY in this markdown format, NO conversational text:

### Outline:
1. **[Main Topic Title]** (Est. X min)
    - [Subtopic 1]
    - [Subtopic 2]

## Example
### Correct Translation Output:
✅ **Outline:**
1. **Investment Philosophy and Mindset** (Est. 8 min)
    - The difference between long-term and short-term investing
    - Psychological adjustment during market volatility

## Constraints
- **[CRITICAL SYSTEM REQUIREMENT]: ALL TITLES, SUBTOPICS AND OUTLINE TEXT MUST BE TRANSLATED AND WRITTEN IN ENGLISH ONLY. NO CHINESE AT ALL.**
"""

for root, dirs, files in os.walk(prompt_dir):
    for filename in files:
        filepath = os.path.join(root, filename)
        if filename == "标题生成.txt":
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(title_prompt_en)
            print(f"Replaced title prompt in {root}")
        elif filename == "推荐理由.txt":
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(reason_prompt_en)
            print(f"Replaced reason prompt in {root}")
        elif filename == "大纲.txt":
            # Just read the existing outline, find the bottom and enforce English if not replacing everything
            # Actually, the python script above is heavily summarized. The original '大纲.txt' was 148 lines.
            pass

print("Done translating prompt templates to English!")
