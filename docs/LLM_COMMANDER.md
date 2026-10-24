# How the game uses an LLM

A plain-language summary of the LLM commander as of 2026-10-24. The code is in
`src/game/ai/` (digest, plan, remote) and `worker/index.js`; the history of
decisions and measurements is in `docs/GAME_PLAN.md`.

## What the model is

A commander, not a player. Each CPU side has one. It never moves a unit, aims a
gun or picks a route; it hands down orders at the level a human commander
would, and the same game code that ran the CPU before carries them out. If the
model is slow, down, or talks nonsense, the side keeps playing on its own
built-in planner. You can't tell from the units whether a model is connected
except by the radio lines in the feed.

## How often it speaks

Every 20 seconds of match time by default. The model can ask to be consulted
sooner or later, 10 to 60 seconds, and the game calls it at once when a
location changes hands or one of its APCs is destroyed.

## What it is told

One page of JSON (`src/game/ai/digest.js`): the score and the clock, the five
locations and who holds or contests them, its own squads with their kits and
current orders, its vehicles, where the enemy is clustered, FOBs and sandbags,
the last few events. Plus three things the game remembers on its behalf,
because the model forgets everything between calls:

- how tickets and losses have moved over the last three minutes;
- its last three plans and what happened after each;
- a short note it wrote to itself last time.

That keeps the prompt the same size all match, about 1,800 tokens.

## What it decides

Nine things, in a fixed JSON schema (`src/game/ai/plan.js`):

1. which location to attack next;
2. which locations to hold;
3. what share of squads to commit to the attack;
4. a posture (cautious, balanced, aggressive), which tunes how close units go
   and how soon they fall back;
5. what the engineers build next (FOB, sandbags, nothing);
6. whether helicopters lift squads;
7. a condition to wait for before attacking, for example three squads
   gathered at the Village, fewer than four enemies at the objective, an APC
   alive, or a number of seconds;
8. how soon to be asked again;
9. jobs for individual squads: assault, hold, reserve, screen, raid, escort.

It also writes one line of radio chatter for the player and a note for
itself.

## What the game does with the answer

It checks every field: the attack has to be the next location in the chain,
holds have to be places the side owns, squad ids have to be real, a wait can't
ask for more squads than exist. Anything illegal is dropped and the built-in
choice used instead. Then the normal CPU machinery runs: approaching to 35 m,
taking cover from armour, the APC standing off, suppression, stances. The
model's plan stays in force for 90 seconds or until the next one arrives.

## Where it runs

The game is served by a Cloudflare Worker, and the same Worker owns a
`/commander` route. Calls go to a Workers AI model, Llama 3.3 70B by default,
through the `pixel-ops` AI Gateway, which logs every question and answer with
cost and timing. No API keys live in the browser. A match costs each side a
few cents.

- `?commander=1` turns the model commander on for the CPU sides.
- `?model=gpt-oss-120b` (or `qwen3-30b`, `mistral-small`) tries another
  catalogue model for that match; gpt-oss-120b reasoned noticeably better in
  the comparison, at the price of slower answers.
- `npm run commander-stub` is a local stand-in with a heuristic plan for
  working on the digest without a model.

## What it is and isn't buying us

With the current model the orders mostly match what the hand-coded planner
would have chosen, with better-sounding reasons attached. The value is in the
architecture: the levers now exist, every decision is logged, and a better
model drops in without touching the game. The open question is whether a
stronger model plays visibly better, and the way to find out is to play
against it.
