import { describe, expect, it } from 'vitest';

import { motorHz, noteHz } from './sfx.ts';

describe('sfx pitch helpers', () => {
    it('noteHz is equal-tempered around A4', () => {
        expect(noteHz(0)).toBeCloseTo(440, 6);
        expect(noteHz(12)).toBeCloseTo(880, 6);
        expect(noteHz(-12)).toBeCloseTo(220, 6);
    });

    it('motorHz rises with speed and is clamped', () => {
        expect(motorHz(0)).toBe(28);
        expect(motorHz(1)).toBe(50);
        expect(motorHz(0.5)).toBeGreaterThan(motorHz(0.1));
        expect(motorHz(5)).toBe(50);
        expect(motorHz(-1)).toBe(28);
    });
});
