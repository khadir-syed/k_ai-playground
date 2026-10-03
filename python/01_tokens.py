"""Chapter 1: AI doesn't read words. It reads numbered pieces called tokens.

Run:  python 01_tokens.py "Will it rain tomorrow?"
Site: https://khadir-syed.github.io/k_ai-playground/  (chapter 1)
"""
import kai

sentence = kai.sentence_arg(kai.load_story()["presets"][0]["text"])
tokenizer = kai.load_tokenizer()

ids = tokenizer.encode(sentence, add_special_tokens=False)

print(f'\n“{sentence}”\n')
print(f"{'#':>3}  {'TOKEN':<16} {'NUMBER':>8}")
print("-" * 30)
for i, token_id in enumerate(ids):
    print(f"{i:>3}  {kai.show_token(tokenizer.decode([token_id])):<16} {token_id:>8}")
print(f"\n{len(ids)} tokens · {len(sentence)} letters")
print("\nThe AI only ever sees the numbers:", ids)
