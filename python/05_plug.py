"""Bonus 2: Pull the plug. Once the model is on your computer, it works with the internet off.

Run it once online (to download the model). Then turn Wi-Fi off and run it again:
      python 05_plug.py
Site: https://khadir-syed.github.io/k_ai-playground/  (bonus 2)
"""
import os
import time

os.environ["HF_HUB_OFFLINE"] = "1"  # never touch the internet, even to check for updates

import kai  # noqa: E402

teach = kai.load_story()["teach"]
try:
    embedder = kai.load_embedder()
except SystemExit:
    raise SystemExit("The model isn't on this computer yet. Turn the internet on, run 04_teach.py once, then try again.")

train_vectors = kai.embed(embedder, [c["text"] for c in teach["train"]])
centroids = {
    g: kai.mean([v for c, v in zip(teach["train"], train_vectors) if c["group"] == g]) for g in teach["groups"]
}
print("\n🔌 This script never uses the internet. Turn your Wi-Fi off now, if you like.")
print("Type something, and the AI guesses: food or tech? Empty line to stop.")
for text in iter(lambda: input("\n> ").strip()[: kai.MAX_TEXT], ""):
    start = time.perf_counter()
    (best, _), _ = kai.nearest_group(kai.embed(embedder, [text])[0], centroids)["ranked"]
    print(f"{best}  (answered in {(time.perf_counter() - start) * 1000:.0f} ms, on this computer)")
