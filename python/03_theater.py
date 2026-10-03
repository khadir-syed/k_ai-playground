"""Chapter 3: AI is a guessing machine. It guesses the next token, adds it, and guesses again.

Run:  python 03_theater.py "Will it rain tomorrow?"
      python 03_theater.py --wild "Will it rain tomorrow?"    (temperature 1.5: surprising picks)
Site: https://khadir-syed.github.io/k_ai-playground/  (chapter 3)
"""
import random
import sys

import kai

MAX_REPLY_TOKENS = 40
TOP_K = 10

wild = "--wild" in sys.argv
if wild:
    sys.argv.remove("--wild")
temperature = 1.5 if wild else 0  # 0 = always take the tallest bar, like the site's replays

sentence = kai.sentence_arg(kai.load_story()["presets"][0]["text"])
tokenizer, model = kai.load_tokenizer(), kai.load_lm()

ids = kai.chat_prompt_ids(tokenizer, sentence)
prompt_len = len(ids)
print(f'\n“{sentence}”  (prompt: {prompt_len} tokens, {"🔥 wild" if wild else "🧊 always the top guess"})\n')

for step in range(MAX_REPLY_TOKENS):
    options = kai.next_token_odds(tokenizer, model, ids, TOP_K)
    probs = kai.softmax([o["logit"] for o in options], temperature or 1)
    if step == 0:
        print("The bars for the first token:\n")
        for o, p in zip(options, probs):
            print(f"  {kai.show_token(o['text']):<12} {kai.bar(p):<30} {p:6.1%}")
        print("\nStep by step (picked token, then the runners-up):\n")
    pick = random.choices(range(TOP_K), probs)[0] if wild else 0
    chosen = options[pick]
    # Runners-up under 1% are often half-letters (one byte of a curly quote), so leave them out.
    others = [f"{kai.show_token(o['text'])} {p:.0%}" for o, p in zip(options, probs) if o is not chosen and p >= 0.01]
    also = f" (also: {', '.join(others[:3])})" if others else ""
    print(f"  {step + 1:>2}. {kai.show_token(chosen['text']):<12}{also}".rstrip())
    if chosen["id"] == tokenizer.eos_token_id:
        break
    ids.append(chosen["id"])
else:
    print(f"\n(Stopped at {MAX_REPLY_TOKENS} tokens, the same limit as the site.)")

print("\nThe reply:", tokenizer.decode(ids[prompt_len:]).strip())
