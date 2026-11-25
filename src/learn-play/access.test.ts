import { describe, expect, it } from 'vitest';

import { isOnWeb, isUnlocked, isWebPathComplete, prerequisiteOf, webItemIds } from './access.ts';
import type { ProgressStore, TaskProgress } from './progress.ts';

const storeWith = (done: number[]): ProgressStore => ({
    isTaskCompleted: (id) => done.includes(id),
    load: (): TaskProgress => ({ completed: false, trialUnits: [], workspace: null }),
    save: () => undefined
});

describe('web scope', () => {
    it('keeps only unit 1 and Code Quest on the web', () => {
        expect(isOnWeb(1)).toBe(true);
        expect(isOnWeb(7)).toBe(true);
        expect(isOnWeb(8)).toBe(false);
        expect(isOnWeb(1001)).toBe(true);
        expect(isOnWeb(1006)).toBe(true);
        expect(isOnWeb(1101)).toBe(false);
        expect(webItemIds()).toEqual([1, 2, 3, 4, 5, 6, 7, 1001, 1002, 1003, 1004, 1005, 1006]);
    });
});

describe('sequential locking', () => {
    it('opens the first task and level, and the rest only after the previous one is done', () => {
        expect(isUnlocked(storeWith([]), 1)).toBe(true);
        expect(isUnlocked(storeWith([]), 2)).toBe(false);
        expect(isUnlocked(storeWith([1]), 2)).toBe(true);
        expect(isUnlocked(storeWith([1]), 3)).toBe(false);
        expect(isUnlocked(storeWith([]), 1001)).toBe(true);
        expect(isUnlocked(storeWith([]), 1002)).toBe(false);
        expect(isUnlocked(storeWith([1001]), 1002)).toBe(true);
    });

    it('never opens content that lives in Unity', () => {
        expect(isUnlocked(storeWith([1, 2, 3, 4, 5, 6, 7]), 8)).toBe(false);
        expect(isUnlocked(storeWith([1101]), 1102)).toBe(false);
    });

    it('chains tasks across the learning path and levels within a game', () => {
        expect(prerequisiteOf(1)).toBeNull();
        expect(prerequisiteOf(8)).toBe(7);
        expect(prerequisiteOf(1001)).toBeNull();
        expect(prerequisiteOf(1102)).toBe(1101);
    });
});

describe('web path completion', () => {
    it('is complete once tasks 1-7 are done', () => {
        expect(isWebPathComplete(storeWith([1, 2, 3, 4, 5, 6]))).toBe(false);
        expect(isWebPathComplete(storeWith([1, 2, 3, 4, 5, 6, 7]))).toBe(true);
    });
});
