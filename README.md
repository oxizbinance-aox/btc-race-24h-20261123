# btc-race-24h-20261123

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/oxizbinance-aox/btc-race-24h-20261123/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/oxizbinance-aox/btc-race-24h-20261123/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

A slow-trend trading bot for Coinbase Wrapped BTC (cbBTC) against USDC, built for make.fun's ["Race a BTC trading bot live for 24 hours"](https://make.fun/bounty/btc-race-24h-20261123-0511) bounty ($50 in USDC). It trades minute by minute on a replay of cbBTC prices from its Orca Whirlpool on Solana, starting with $1,000 of paper money. Simulation only — no real money is traded.

## Strategy

One-minute cbBTC bars are mostly noise (about 8 bps of jitter per minute against a 0.25 bps mean drift), so any fast signal whipsaws itself to death: every full-size round trip pays roughly 35–45 bps in fee, slippage and pool impact. This bot therefore trades rarely and only on a slow trend:

- **Long** whenever the latest close sits above its trailing 8-hour simple moving average (480 one-minute bars). It buys once, with all of its cash, when the close crosses above that average.
- **Flat** when the close falls 1% below the average, or 2% below the best close seen since it bought (a trailing stop against a sharp fall).

On the published dev window that is a single trade for about +$32 of net PnL after every fee. On a falling window the exit rules keep it out of most of the drop instead of riding it down like a buy-and-hold bot would. All arithmetic is exact bigint math on the raw price-scale integers, so two runs on the same bars produce identical orders.

## Run it

```sh
node main.ts
```

The bot speaks `agent-fun/bars-replay/v1` (newline-delimited JSON on stdin/stdout) via the kit's SDK shim in `vendor/makefun-bars.ts`. Grade it locally with the official kit:

```sh
node <kit>/cli/makefun.mjs grade-local --kit <kit> --bot . --driver process
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=oxizbinance-aox&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards</sub>
