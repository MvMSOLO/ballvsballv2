import { enabledBalls } from "../src/packs/registry";
import { runBatch } from "../src/sim/batch";

const balls = enabledBalls().slice(0, 4);
if (balls.length < 2) {
  console.error("Not enough balls to simulate");
  process.exit(1);
}
const report = runBatch(balls, balls, 4, 7);
console.log(JSON.stringify({ games: report.games, avgTime: Number(report.avgTime.toFixed(2)), errors: report.errors }));
if (report.games !== 4 || report.errors > 0) process.exit(1);
