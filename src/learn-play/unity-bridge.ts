import { UNITY_HOST } from './config.ts';
import { gameLevelInfo } from './game-levels.ts';
import type { ProgressStore } from './progress.ts';

/** Learning-path task ids are below this; game level ids start here (see access.ts). */
const GAME_ID_START = 1000;

/**
 * The id the Unity menu uses for what was just finished: `task-NN` for a lesson, and `game-<id>` once the
 * last level of a game is completed. Null while a game still has levels left.
 */
export const unityIdFor = (store: ProgressStore, id: number): string | null => {
    if (id < GAME_ID_START) return `task-${String(id).padStart(2, '0')}`;
    const level = gameLevelInfo.find((l) => l.id === id);
    if (!level) return null;
    const levels = gameLevelInfo.filter((l) => l.gameId === level.gameId);
    return levels.every((l) => store.isTaskCompleted(l.id)) ? `game-${level.gameId}` : null;
};

/** In the Unity-hosted build, tells the Unity menu that a lesson or game was finished. Quiet everywhere else. */
export const reportToUnity = (store: ProgressStore, id: number): void => {
    if (!UNITY_HOST) return;
    const unityId = unityIdFor(store, id);
    if (unityId === null) return;
    fetch(`/complete?id=${encodeURIComponent(unityId)}`).catch(() => {
        // the Unity menu is not reachable: progress stays saved here
    });
};
