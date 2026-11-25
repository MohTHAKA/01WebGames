/**
 * What the web build offers. Everything else lives in the "webgameIF" Unity project: it stays visible
 * on the home page but is locked, and opening it leads to the Unity project.
 */

/**
 * True in the build the Unity app hosts (`npm run build:unity`). There every unit and game is playable here,
 * and finished lessons are reported to the Unity menu.
 */
export const UNITY_HOST = import.meta.env.VITE_UNITY_HOST === '1';

/** Link to the webgameIF Unity project. The ZERO1 simulator, where the remaining units and games live. */
export const UNITY_PROJECT_URL = 'https://01skills.com/';

/** Units (learning path) playable on the web. */
export const WEB_UNIT_IDS: readonly number[] = UNITY_HOST ? [1, 2, 3, 4, 5, 6, 7] : [1];

/** Games playable on the web. */
export const WEB_GAME_IDS: readonly string[] = UNITY_HOST
    ? ['code-quest', 'robo-logistics', 'logic-maze', 'sensor-rush', 'pattern-builder', 'robot-arena']
    : ['code-quest'];
