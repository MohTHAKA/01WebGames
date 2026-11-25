// Exports every mission as JSON that follows the shared contract in
// webgameIF/Shared/missions/mission.schema.json. Usage:
//   node scripts/export-missions.mjs [outDir]
// Default outDir is ../webgameIF/Shared/missions/data (next to this repo).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { missions } from '../src/learn-play/missions.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.argv[2] ?? resolve(here, '../../webgameIF/Shared/missions/data'));

mkdirSync(outDir, { recursive: true });

for (const mission of missions) {
    const name = `task-${String(mission.taskId).padStart(2, '0')}.json`;
    writeFileSync(resolve(outDir, name), `${JSON.stringify(mission, null, 2)}\n`);
}

console.log(`Exported ${missions.length} missions to ${outDir}`);
