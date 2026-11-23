// Slow-trend cbBTC bot for make.fun's "Race a BTC trading bot live for 24 hours".
//
// Idea: one-minute cbBTC bars are mostly noise (about 8 bps of jitter per
// minute against a 0.25 bps mean drift), so any fast signal whipsaws itself
// to death: every full-size round trip pays roughly 35-45 bps in fee,
// slippage and pool impact. This bot therefore trades rarely and only on a
// slow trend: it is long whenever the latest close sits above its trailing
// 8-hour simple moving average, and flat otherwise. It buys once, with all
// of its cash, when the close crosses above that average after at least 2
// hours of history, and sells
// everything when the close falls 1% below it, or 2% below the best close
// seen since it bought (a trailing stop against a sharp fall). On the
// published dev window that is one trade for about +$32 of net PnL; on a
// falling window the exit rules keep it out of most of the drop instead of
// riding it down like a buy-and-hold bot would.
//
// All arithmetic is exact bigint math on the raw price-scale integers, so
// two runs on the same bars produce the same orders byte for byte. No
// clock, no randomness, no network, no files: only the bars the harness
// sends.

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, Batch, OrderInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
// Length of the trailing moving average, in one-minute bars (480 = 8 hours).
const SMA_BARS = 480;
// Bars of history the average needs before the first buy (2 hours). An
// average over a handful of bars is just the last few closes, so without
// this the bot can buy on opening noise; with it, the signal is a formed
// 2-to-8-hour average. It costs about $1 on the dev window and saves about
// $11 on a falling one, where the early noise entry would otherwise lose.
const MIN_HISTORY_BARS = 120;
// Exit when the close drops this far below the moving average (1%).
const EXIT_BAND_NUM = 99n;
const EXIT_BAND_DEN = 100n;
// Trailing stop: exit when the close drops this far below the best close
// seen since the buy (2%).
const TRAIL_NUM = 98n;
const TRAIL_DEN = 100n;
// Slippage allowance on every order, in bps. A full-size fill pays about
// 4 bps fee + 2 bps modelled slippage + roughly 11-17 bps of pool impact,
// so 300 bps leaves ample room while still rejecting a wild gap fill.
const MAX_SLIPPAGE_BPS = 300;

// Running sum of the last SMA_BARS closes, as raw price-scale integers.
let windowSum = 0n;
let windowCount = 0;
const windowCloses: bigint[] = [];
// Best close seen since the current position was opened (0 when flat).
let peakSinceBuy = 0n;

function noteClose(close: bigint): void {
  windowCloses.push(close);
  windowSum += close;
  windowCount += 1;
  if (windowCount > SMA_BARS) {
    windowSum -= windowCloses.shift()!;
    windowCount -= 1;
  }
}

await runBars({
  onBatch(state: BarsState, _batch: Batch): OrderInput[] {
    if (state.warmingUp) return [];
    const bar = state.latest.get(SYMBOL);
    if (bar === undefined) return [];
    const close = BigInt(bar.c);
    noteClose(close);

    const held = state.positions.get(SYMBOL);
    const qty = held === undefined ? 0n : held.qty;
    const smaNum = windowSum;
    const smaDen = BigInt(windowCount);

    if (qty === 0n) {
      peakSinceBuy = 0n;
      // Long only when the close sits above its trailing 8-hour average,
      // once that average has enough history behind it to mean something.
      // close > sum / n  <=>  close * n > sum.
      if (
        windowCount >= MIN_HISTORY_BARS &&
        close * smaDen > smaNum &&
        state.cash > 0n
      ) {
        peakSinceBuy = close;
        return [
          {
            side: 'buy',
            symbol: SYMBOL,
            notional_quote_units: state.cash,
            max_slippage_bps: MAX_SLIPPAGE_BPS,
          },
        ];
      }
      return [];
    }

    if (close > peakSinceBuy) peakSinceBuy = close;
    // Exit on a real downtrend: close < 99% of the average, or 2% under the
    // best close since the buy. close < sum/n * 99/100  <=>
    // close * n * 100 < sum * 99.
    const belowAverage =
      close * smaDen * EXIT_BAND_DEN < smaNum * EXIT_BAND_NUM;
    const belowTrail = close * TRAIL_DEN < peakSinceBuy * TRAIL_NUM;
    if (belowAverage || belowTrail) {
      return [
        {
          side: 'sell',
          symbol: SYMBOL,
          qty,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        },
      ];
    }
    return [];
  },
});
