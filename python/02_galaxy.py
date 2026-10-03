"""Chapter 2: Meaning is a place. A sentence becomes 384 numbers, an address in a "galaxy".

Run:  python 02_galaxy.py "Will it rain tomorrow?"
Site: https://khadir-syed.github.io/k_ai-playground/  (chapter 2)
"""
import kai

story = kai.load_story()
sentence = kai.sentence_arg(story["presets"][0]["text"])
stars = [s["text"] for s in story["stars"]]

embedder = kai.load_embedder()
mine, *star_vectors = kai.embed(embedder, [sentence, *stars])

print(f'\n“{sentence}” as 384 numbers. The first 8:\n{mine[:8]} …\n')
ranked = sorted(zip(stars, star_vectors), key=lambda s: kai.cosine(mine, s[1]), reverse=True)
print("Closest neighbours in the galaxy (1 = same meaning, 0 = unrelated):\n")
for text, vector in ranked[:3]:
    sim = kai.cosine(mine, vector)
    print(f"  {sim:5.2f}  {kai.bar(sim, 20):<20}  {text}")
