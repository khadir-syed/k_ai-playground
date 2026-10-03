"""Same numbers as the site: run the exact model files your phone runs, and compare with the site's data.

The chapter scripts use normal PyTorch weights. The site runs smaller "q8" ONNX copies of the same
models (each number squeezed into 8 bits, so phones can download them). This script loads those
exact files with onnxruntime, re-does every recorded step in replays/story.json, and checks the
answers match.

Run:  python same_numbers.py     (downloads about 160 MB the first time)
"""
import sys

import kai

# Different maths libraries (browser vs. your computer) round slightly differently.
EMBED_TOLERANCE = 0.002  # the site stores meaning-numbers to 4 decimal places
LOGIT_TOLERANCE = 0.05


def session(model, tokenizer_class):
    try:
        import numpy  # noqa: F401
        import onnxruntime as ort
        from huggingface_hub import hf_hub_download
    except ImportError:
        sys.exit("Missing packages. Run: pip install -r requirements.txt")
    kai._transformers()  # quiet logs
    path = hf_hub_download(model["id"], "onnx/model_quantized.onnx", revision=model["revision"])
    tokenizer = tokenizer_class.from_pretrained(model["id"], revision=model["revision"])
    return tokenizer, ort.InferenceSession(path, providers=["CPUExecutionProvider"])


def embed_q8(tokenizer, onnx, texts):
    """Same batches as the recording: q8 rounding looks at the whole batch, so batching changes the numbers."""
    import numpy as np

    batch = tokenizer(texts, padding=True, return_tensors="np")
    feed = {k: batch[k].astype(np.int64) for k in ("input_ids", "attention_mask", "token_type_ids")}
    tokens = onnx.run(None, feed)[0]
    mask = feed["attention_mask"][..., None]
    vectors = (tokens * mask).sum(1) / mask.sum(1)
    return vectors / np.linalg.norm(vectors, axis=1, keepdims=True)


def logits_q8(onnx, ids):
    import numpy as np

    n = len(ids)
    feed = {
        "input_ids": np.array([ids], dtype=np.int64),
        "attention_mask": np.ones((1, n), dtype=np.int64),
        "position_ids": np.arange(n, dtype=np.int64)[None],
    }
    for i in onnx.get_inputs():
        if i.name.startswith("past_key_values"):  # no cache: same as the site
            feed[i.name] = np.zeros((1, i.shape[1], 0, i.shape[3]), dtype=np.float32)
    return onnx.run(["logits"], feed)[0][0, -1]


def main():
    from transformers import AutoTokenizer

    story = kai.load_story()
    worst = {"embed": 0.0, "logit": 0.0}
    problems = []

    tokenizer, onnx = session(kai.SITE_MODELS["embed"], AutoTokenizer)
    # The batches tools/record-replays.mjs used: each preset alone, all stars, train cards, test cards.
    batches = [[p] for p in story["presets"]] + [story["stars"], story["teach"]["train"], story["teach"]["test"]]
    for batch in batches:
        for item, vector in zip(batch, embed_q8(tokenizer, onnx, [b["text"] for b in batch])):
            diff = float(abs(vector - item["embedding"]).max())
            worst["embed"] = max(worst["embed"], diff)
            if diff > EMBED_TOLERANCE:
                problems.append(f"meaning of “{item['text']}” differs by {diff:.4f}")
    print(f"Meaning model: {sum(map(len, batches))} sentences, biggest difference {worst['embed']:.4f}")

    tokenizer, onnx = session(kai.SITE_MODELS["lm"], AutoTokenizer)
    steps = 0
    for preset in story["presets"]:
        text, theater = preset["text"], preset["theater"]
        if [t["id"] for t in preset["tokens"]] != tokenizer.encode(text, add_special_tokens=False):
            problems.append(f"tokens of “{text}” differ")
        ids = kai.chat_prompt_ids(tokenizer, text)
        if len(ids) != theater["promptTokens"]:
            problems.append(f"prompt of “{text}” has {len(ids)} tokens, site has {theater['promptTokens']}")
        for n, step in enumerate(theater["steps"], 1):
            logits = logits_q8(onnx, ids).tolist()
            mine = kai.top_k(logits, len(step["options"]))
            if mine != [o["id"] for o in step["options"]]:
                problems.append(f"“{text}” step {n}: top guesses differ")
            worst["logit"] = max(worst["logit"], *(abs(logits[o["id"]] - o["logit"]) for o in step["options"]))
            ids.append(step["picked"])  # follow the site's recorded path
            steps += 1
    print(f"Chat model: {len(story['presets'])} sentences, {steps} steps, biggest score difference {worst['logit']:.3f}")
    if worst["logit"] > LOGIT_TOLERANCE:
        problems.append(f"scores differ by up to {worst['logit']:.3f}")

    if problems:
        sys.exit("❌ Not the same as the site:\n  " + "\n  ".join(problems))
    print("✅ Same numbers as the site. Your computer and your phone ran the same AI.")


if __name__ == "__main__":
    main()
