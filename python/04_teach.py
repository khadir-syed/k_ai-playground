"""Bonus 1: You can teach an AI. Sort examples into two groups; it learns each group's "middle"
and labels a new sentence by which middle is closer (nearest centroid).

Run:  python 04_teach.py           (the site's food / tech cards)
      python 04_teach.py --own     (name your own two groups and type examples)
Site: https://khadir-syed.github.io/k_ai-playground/  (bonus 1)
"""
import sys

import kai

MIN_EACH = 2  # same limits as the site's "Teach your own" form
MAX_NAME = 20
MAX_EXAMPLES = 8


def verdict_line(text, verdict):
    (best, sim), (other, other_sim) = verdict["ranked"]
    how = "a wild guess: it isn't close to either group" if verdict["far"] else "a close call" if verdict["close_call"] else "a clear call"
    return f'“{text}” → {best}  ({how}; {best} {sim:.2f} vs {other} {other_sim:.2f})'


def own_groups(embedder):
    groups = {}
    for letter in "AB":
        name = kai.ask(f"\nGroup {letter} name (e.g. Cats): ", MAX_NAME)
        if not name or name.lower() in map(str.lower, groups):
            sys.exit("Give the two groups two different names.")
        print(f"Examples for {name}, one per line (up to {MAX_EXAMPLES}). Empty line to finish:")
        examples = list(iter(lambda: kai.ask("  > "), ""))[:MAX_EXAMPLES]
        if len(examples) < MIN_EACH:
            sys.exit(f"Each group needs at least {MIN_EACH} examples.")
        groups[name] = examples
    centroids = {name: kai.mean(kai.embed(embedder, examples)) for name, examples in groups.items()}
    print("\nLearned! Type sentences to test it. Empty line to stop.")
    for text in iter(lambda: kai.ask("\nTest > "), ""):
        print(verdict_line(text, kai.nearest_group(kai.embed(embedder, [text])[0], centroids)))


embedder = kai.load_embedder()
if "--own" in sys.argv:
    own_groups(embedder)
    sys.exit()

teach = kai.load_story()["teach"]
train_vectors = kai.embed(embedder, [c["text"] for c in teach["train"]])
centroids = {
    g: kai.mean([v for c, v in zip(teach["train"], train_vectors) if c["group"] == g]) for g in teach["groups"]
}
print("\nLearned from:")
for c in teach["train"]:
    print(f"  {c['group']:<5} {c['text']}")
print("\nNow it guesses cards it has never seen:\n")
for card, vector in zip(teach["test"], kai.embed(embedder, [c["text"] for c in teach["test"]])):
    verdict = kai.nearest_group(vector, centroids)
    mark = "✅" if verdict["ranked"][0][0] == card["group"] else "❌"
    print(f"  {mark} {verdict_line(card['text'], verdict)}")
