"""Self-check for the Python twins. Runs instantly with plain Python: no packages, no model download.
Run with: python test_kai.py
"""
import re

import kai

close = lambda a, b, eps=1e-6: abs(a - b) < eps  # noqa: E731

# Maths: same behaviour as engine/math.js (see tests/engine.test.mjs).
logits = [3, 1, 0.5]
assert close(sum(kai.softmax(logits)), 1)
assert kai.softmax(logits, 0.2)[0] > kai.softmax(logits)[0] > kai.softmax(logits, 2)[0]
assert close(kai.softmax([1000, 1000])[0], 0.5)  # no overflow
assert kai.top_k([0.1, 0.9, 0.5, 0.7], 2) == [1, 3]
assert close(kai.cosine([1, 0], [1, 0]), 1) and close(kai.cosine([1, 0], [0, 1]), 0)
assert kai.mean([[1, 2], [3, 4]]) == [2, 3]

g = kai.nearest_group([1, 0.1], {"food": [1, 0], "tech": [0, 1]})
assert [name for name, _ in g["ranked"]] == ["food", "tech"]
assert not g["close_call"] and not g["far"]
assert kai.nearest_group([1, 1.01], {"food": [1, 0], "tech": [0, 1]})["close_call"]
assert kai.nearest_group([0.05, -1], {"food": [1, 0], "tech": [0, 1]})["far"]
assert kai.show_token(" rain") == "␣rain"

# Python and the site use the same models at the same commits.
ai_js = (kai.ROOT / "engine" / "ai.js").read_text(encoding="utf-8")
for key, model in kai.SITE_MODELS.items():
    assert re.search(rf"{key}: \{{ id: '{re.escape(model['id'])}', revision: '{model['revision']}' \}}", ai_js), key
assert kai.MODELS["lm"] == kai.SITE_MODELS["lm"]

# Teach a Model, on the site's recorded meaning-numbers: 5 right, "cookies" wrong on purpose.
teach = kai.load_story()["teach"]
centroids = {g: kai.mean([c["embedding"] for c in teach["train"] if c["group"] == g]) for g in teach["groups"]}
right = [kai.nearest_group(c["embedding"], centroids)["ranked"][0][0] == c["group"] for c in teach["test"]]
assert right == [True] * 5 + [False], right

# Every chapter on the site links to a Python twin that exists.
for chapter in sorted((kai.ROOT / "chapters").glob("*/chapter.js")):
    twin = re.search(r"python: '([\w.]+\.py)'", chapter.read_text(encoding="utf-8"))
    assert twin and (kai.ROOT / "python" / twin[1]).exists(), chapter

print("All checks passed.")
