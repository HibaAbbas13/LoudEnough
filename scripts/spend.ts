import { totalSpend } from "../lib/spend.ts";

const { usd, calls } = await totalSpend();
const budget = Number(process.env.BUDGET_USD ?? 5);
const pct = budget ? (usd / budget) * 100 : 0;
const bar = "█".repeat(Math.round(pct / 4)).padEnd(25, "·");

console.log(`\n  ${bar}  ${pct.toFixed(1)}%`);
console.log(`  $${usd.toFixed(4)} of $${budget.toFixed(2)} across ${calls} call${calls === 1 ? "" : "s"}`);
console.log(`  $${(budget - usd).toFixed(4)} left\n`);
