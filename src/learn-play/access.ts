import { WEB_GAME_IDS, WEB_UNIT_IDS } from './config.ts';
import { getTask, tasks } from './curriculum.ts';
import { gameLevelInfo } from './game-levels.ts';
import type { ProgressStore } from './progress.ts';

/** Learning-path unit ids are below this; game level ids start here. */
const GAME_ID_START = 1000;

export const isUnitOnWeb = (unitId: number): boolean => WEB_UNIT_IDS.includes(unitId);
export const isGameOnWeb = (gameId: string): boolean => WEB_GAME_IDS.includes(gameId);

/** True when the task or game level is playable on the web (otherwise it lives in the Unity project). */
export const isOnWeb = (id: number): boolean => {
    if (id < GAME_ID_START) {
        const task = getTask(id);
        return task !== undefined && isUnitOnWeb(task.unitId);
    }
    const level = gameLevelInfo.find((l) => l.id === id);
    return level !== undefined && isGameOnWeb(level.gameId);
};

/** The id that must be completed before `id` opens; null for the first task or level of a sequence. */
export const prerequisiteOf = (id: number): number | null => {
    if (id < GAME_ID_START) {
        const index = tasks.findIndex((t) => t.id === id);
        return index > 0 ? tasks[index - 1].id : null;
    }
    const level = gameLevelInfo.find((l) => l.id === id);
    if (!level) return null;
    const levels = gameLevelInfo.filter((l) => l.gameId === level.gameId);
    const index = levels.findIndex((l) => l.id === id);
    return index > 0 ? levels[index - 1].id : null;
};

/** A task or level is open once the one before it is completed (the first one is always open). */
export const isUnlocked = (store: ProgressStore, id: number): boolean => {
    if (!isOnWeb(id)) return false;
    const prerequisite = prerequisiteOf(id);
    return prerequisite === null || store.isTaskCompleted(prerequisite);
};

/** Ids that count toward the web build's completion: web tasks plus web game levels. */
export const webItemIds = (): number[] => [
    ...tasks.filter((t) => isUnitOnWeb(t.unitId)).map((t) => t.id),
    ...gameLevelInfo.filter((l) => isGameOnWeb(l.gameId)).map((l) => l.id)
];

/** True once every task of every web unit is completed, so the user continues in Unity. */
export const isWebPathComplete = (store: ProgressStore): boolean =>
    tasks.filter((t) => isUnitOnWeb(t.unitId)).every((t) => store.isTaskCompleted(t.id));
