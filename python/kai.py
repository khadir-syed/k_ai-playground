"""Shared pieces for the Python twins: the models, the maths, and the replay data.

The maths mirrors engine/math.js line for line, in plain Python, so you can read both side by side.
Model loading uses Hugging Face transformers (PyTorch). Heavy imports happen inside the loaders,
so test_kai.py runs with no packages installed.
"""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# The exact models the site runs (engine/ai.js), pinned to the same commits.
# same_numbers.py loads these ONNX files to prove Python and the site agree.
SITE_MODELS = {
    "embed": {"id": "Xenova/all-MiniLM-L6-v2", "revision": "751bff37182d3f1213fa05d7196b954e230abad9"},
    "lm": {"id": "HuggingFaceTB/SmolLM2-135M-Instruct", "revision": "12fd25f77366fa6b3b4b768ec3050bf629380bac"},
}
# The same models as normal PyTorch weights. Xenova's repo is an ONNX-only copy of this one.
MODELS = {
    "embed": {"id": "sentence-transformers/all-MiniLM-L6-v2", "revision": "1110a243fdf4706b3f48f1d95db1a4f5529b4d41"},
    "lm": SITE_MODELS["lm"],
}

MAX_TEXT = 120  # same limit as the site's text boxes


def load_story():
    """The site's recorded data: preset sentences, galaxy stars, Teach cards."""
    return json.loads((ROOT / "replays" / "story.json").read_text(encoding="utf-8"))


# ---------- Maths (same as engine/math.js) ----------

def softmax(logits, temperature=1.0):
    """Raw scores -> probabilities that add up to 1. Low temperature = calm, high = wild."""
    t = max(temperature, 0.01)
    top = max(logits)
    exps = [math.exp((l - top) / t) for l in logits]
    total = sum(exps)
    return [e / total for e in exps]


def top_k(values, k):
    """Indices of the k largest values, biggest first."""
    return sorted(range(len(values)), key=lambda i: values[i], reverse=True)[:k]


def cosine(a, b):
    """How similar two meaning-vectors are: 1 = same direction, 0 = unrelated."""
    dot = sum(x * y for x, y in zip(a, b))
    norms = math.sqrt(sum(x * x for x in a) * sum(y * y for y in b))
    return dot / (norms or 1)


def mean(vectors):
    """The average of several vectors: the "middle" of a group of examples."""
    return [sum(column) / len(vectors) for column in zip(*vectors)]


CLOSE_CALL = 0.05
FAR = 0.1


def nearest_group(vector, centroids):
    """Which group's middle is this vector closest to? Ranked best first."""
    ranked = sorted(((name, cosine(vector, c)) for name, c in centroids.items()), key=lambda r: r[1], reverse=True)
    return {
        "ranked": ranked,
        "close_call": ranked[0][1] - ranked[1][1] < CLOSE_CALL,
        "far": ranked[0][1] < FAR,
    }


# ---------- Printing ----------

def show_token(text):
    """Make a token's leading space visible, like the site does."""
    return text.replace(" ", "␣").replace("\n", "\\n")


def bar(fraction, width=30):
    return "█" * round(max(0.0, min(1.0, fraction)) * width)


def sentence_arg(default):
    """The sentence from the command line, or the site's first ready-made one."""
    text = " ".join(sys.argv[1:]).strip() or default
    return text[:MAX_TEXT]


# ---------- Models (Hugging Face transformers) ----------

def _transformers():
    try:
        import torch  # noqa: F401
        import transformers
        from huggingface_hub.utils import logging as hub_logging
    except ImportError:
        sys.exit("Missing packages. Run: pip install -r requirements.txt")
    hub_logging.set_verbosity_error()
    transformers.logging.set_verbosity_error()
    transformers.logging.disable_progress_bar()
    return transformers


def _load(what, loader, model):
    try:
        return loader.from_pretrained(model["id"], revision=model["revision"])
    except OSError as exc:
        sys.exit(
            f"Could not load the {what}. The first run needs the internet to download it "
            f"(it is saved on your computer after that).\n\nDetails: {exc}"
        )


def load_tokenizer():
    """SmolLM2's word-chopper (chapters 1 and 3)."""
    return _load("tokenizer", _transformers().AutoTokenizer, MODELS["lm"])


def load_lm():
    """SmolLM2-135M, the small chat model (chapter 3). About 270 MB the first time."""
    model = _load("chat model", _transformers().AutoModelForCausalLM, MODELS["lm"])
    model.eval()
    return model


def load_embedder():
    """MiniLM, the meaning model (chapters 2, 4 and 5). About 90 MB the first time."""
    t = _transformers()
    return _load("meaning model's tokenizer", t.AutoTokenizer, MODELS["embed"]), _load("meaning model", t.AutoModel, MODELS["embed"])


def embed(embedder, texts):
    """Each sentence's meaning as 384 numbers: average the token vectors, then scale to length 1."""
    import torch

    tokenizer, model = embedder
    batch = tokenizer(texts, padding=True, truncation=True, return_tensors="pt")
    with torch.no_grad():
        tokens = model(**batch).last_hidden_state
    mask = batch["attention_mask"].unsqueeze(-1).float()
    vectors = (tokens * mask).sum(1) / mask.sum(1)
    vectors = torch.nn.functional.normalize(vectors, dim=-1)
    return [[round(x, 4) for x in row] for row in vectors.tolist()]


def chat_prompt_ids(tokenizer, sentence):
    """The prompt the chat model sees, as token ids (same template as the site)."""
    return tokenizer.apply_chat_template(
        [{"role": "user", "content": sentence}], add_generation_prompt=True, tokenize=True, return_dict=False
    )


def next_token_odds(tokenizer, model, ids, k=10):
    """The model's top-k guesses for the very next token, with raw scores (logits).
    No cache: each step re-reads the whole text, exactly as the chapter explains."""
    import torch

    with torch.no_grad():
        logits = model(torch.tensor([ids])).logits[0, -1].tolist()
    return [{"id": i, "text": tokenizer.decode([i]), "logit": logits[i]} for i in top_k(logits, k)]
