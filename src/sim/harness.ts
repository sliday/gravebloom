import { GameSim } from './sim';
import { BotAI, AIDifficulty } from './ai';

export interface MatchResult {
  winner: 'player' | 'enemy' | 'draw';
  durationSeconds: number;
  playerKingHp: number;
  enemyKingHp: number;
  reason: string;
}

export function runSimulationMatch(
  seed: number,
  difficulty: AIDifficulty = 'tactical',
  maxSeconds = 180
): MatchResult {
  const sim = new GameSim(seed);
  const botPlayer = new BotAI('player', difficulty);
  const botEnemy = new BotAI('enemy', difficulty);

  const maxTicks = maxSeconds * 10;
  for (let t = 0; t < maxTicks; t++) {
    if (sim.isGameOver) break;

    const playerIntent = botPlayer.update(sim);
    if (playerIntent) sim.addIntent(playerIntent);

    const enemyIntent = botEnemy.update(sim);
    if (enemyIntent) sim.addIntent(enemyIntent);

    sim.step();
  }

  return {
    winner: sim.winner ?? 'draw',
    durationSeconds: Math.round(sim.matchTime * 10) / 10,
    playerKingHp: sim.playerKing.hp,
    enemyKingHp: sim.enemyKing.hp,
    reason: sim.isGameOver ? 'Match resolved' : 'Max time reached'
  };
}

export function runBatchSimulations(count = 20, difficulty: AIDifficulty = 'tactical', baseSeed = 1000) {
  let playerWins = 0;
  let enemyWins = 0;
  let draws = 0;
  let totalDuration = 0;

  for (let i = 0; i < count; i++) {
    const res = runSimulationMatch(baseSeed + i, difficulty);
    if (res.winner === 'player') playerWins++;
    else if (res.winner === 'enemy') enemyWins++;
    else draws++;
    totalDuration += res.durationSeconds;
  }

  return {
    totalMatches: count,
    playerWins,
    enemyWins,
    draws,
    playerWinRate: Math.round((playerWins / count) * 100),
    enemyWinRate: Math.round((enemyWins / count) * 100),
    avgDuration: Math.round((totalDuration / count) * 10) / 10
  };
}
