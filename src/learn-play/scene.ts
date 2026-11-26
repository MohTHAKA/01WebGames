import {
    Asset,
    AppBase,
    AppOptions,
    BLEND_NONE,
    BLEND_NORMAL,
    CameraComponentSystem,
    Color,
    Entity,
    FILLMODE_NONE,
    PIXELFORMAT_RGBA8,
    Texture,
    RESOLUTION_AUTO,
    RenderComponentSystem,
    StandardMaterial,
    TextureHandler,
    createGraphicsDevice
} from 'playcanvas';

import { DEFAULT_CALIBRATION } from './sim/calibration.ts';
import type { MissionDefinition, RobotPose } from './sim/types.ts';

export type FxKind = 'dust' | 'spark' | 'hit' | 'confetti' | 'ring' | 'drop';

export interface ArenaScene {
    /** Called every rendered frame with the wall-clock delta in seconds. */
    onFrame(cb: (dt: number) => void): void;
    setPose(pose: RobotPose): void;
    /** Moves the cargo crates (positions by cargo id, in meters). */
    setCargo(positions: ReadonlyMap<string, { x: number; y: number }>): void;
    /** One-shot visual effect at a sim position (meters). */
    burst(kind: FxKind, x: number, y: number): void;
    /** Tints the robot red for a moment (a collision). */
    flashRobot(): void;
    /** Shakes the camera briefly. */
    shake(): void;
    /**
     * Resize the WebGL canvas and return the on-screen size of one grid cell (meters → CSS px)
     * so the arena CSS grid can stay locked to the world.
     */
    resize(width: number, height: number): { cellCssPx: number };
    destroy(): void;
}

const flat = (hex: string, alpha = 1): StandardMaterial => {
    const m = new StandardMaterial();
    const c = new Color().fromString(hex);
    m.diffuse = new Color(0, 0, 0);
    m.emissive = c;
    m.useLighting = false;
    if (alpha < 1) {
        m.opacity = alpha;
        m.blendType = BLEND_NORMAL;
    }
    m.update();
    return m;
};

/** Sprite plane size in meters: the robot's footprint plus the margin the sprite render leaves. */
/** Seconds for the robot sprite to cross-fade when its facing direction changes. */
/** Cargo cube edge length in meters. */
const CARGO_SIZE = 0.28;
const CARGO_LIFT = CARGO_SIZE / 2 + 0.03;
/** Height of wall slabs in the 2.5D view, in meters. */
const PROP_HEIGHT = 0.3;
/** Square obstacle crates stay short so their volume does not cover the robot sprite. */
const CRATE_HEIGHT = 0.08;
/** Flag billboard size; kept modest so it does not lean into nearby crates. */
const FLAG_SIZE = 0.32;
/** Transparent draw order: flags under the robot, robot on top. */
const DRAW_FLAG = 100;
const DRAW_ROBOT = 200;
const FADE_SECONDS = 0.15;
const PARTICLE_POOL = 64;
const RING_POOL = 6;
/** Perspective camera pitch below the horizon; it looks at the arena centre from +z. */
const TILT_DEG = 32;
const TILT_RAD = (TILT_DEG * Math.PI) / 180;
const FOV = 36;
/** Extra world margin (meters) around the arena when fitting the camera. */
const FIT_MARGIN = 0.02;
/** Perimeter wall height and thickness (meters). */
const EDGE_WALL_HEIGHT = 0.14;
const EDGE_WALL_THICKNESS = 0.06;
/**
 * Robot views: 16 frames in public/robot16-NN.png, 22.5 degrees apart. Frame 3 and 4 show the front
 * (robot facing the camera) and frames 11 and 12 the back, so the frame centred on a heading is
 * `180 + (NN - 3.5) * 22.5` degrees (heading 0 drives away from the camera and shows the back).
 */
const SHEET_FRAMES = 16;
const frameHeading = (frame: number): number => (((180 + (frame - 3.5) * (360 / SHEET_FRAMES)) % 360) + 360) % 360;
/** Billboard height keeps the robot the size it always was; the width follows the 241x274 frame aspect. */
const SPRITE_HEIGHT = (DEFAULT_CALIBRATION.robotRadiusMeters * 2 * 1.9 * 316) / 297;
const SPRITE_WIDTH = (SPRITE_HEIGHT * 241) / 274;
/**
 * Scene backdrop per game, chosen by the task id block (see game-levels.ts): 1000s Code Quest,
 * 1100s Logic Maze, 1200s Sensor Rush, 1300s Pattern Builder, 1400s Robot Arena, 1500s Robo
 * Logistics. Learning-path tasks (below 1000) use the generic lab.
 */
const backgroundUrl = (taskId: number): string => {
    const byHundred: Record<number, string> = {
        10: 'quest',
        11: 'maze',
        12: 'sensor',
        13: 'pattern',
        14: 'arena',
        15: 'logistics'
    };
    return `./bg-${byHundred[Math.floor(taskId / 100)] ?? 'lab'}.jpg`;
};
/** Grid cell size in meters (~1 wheel rotation) so distance is readable from above. */
const GRID_CELL = 0.35;

/**
 * Tilted perspective arena with edge walls. PlayCanvas only renders; the pose comes from the
 * headless simulation. The canvas is the only WebGL context this view owns and `destroy()` releases it.
 */
export const createArenaScene = async (canvas: HTMLCanvasElement, mission: MissionDefinition): Promise<ArenaScene> => {
    const device = await createGraphicsDevice(canvas, { alpha: true });
    device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

    const options = new AppOptions();
    options.graphicsDevice = device;
    options.componentSystems = [RenderComponentSystem, CameraComponentSystem];
    options.resourceHandlers = [TextureHandler];

    const app = new AppBase(canvas);
    app.init(options);
    app.setCanvasFillMode(FILLMODE_NONE);
    app.setCanvasResolution(RESOLUTION_AUTO);
    app.start();

    const add = (name: string, type: 'box' | 'cylinder' | 'plane', mat: StandardMaterial): Entity => {
        const e = new Entity(name);
        e.addComponent('render', { type, material: mat, castShadows: false, receiveShadows: false });
        app.root.addChild(e);
        return e;
    };
    const place = (e: Entity, x: number, y: number, z: number, sx: number, sy: number, sz: number): void => {
        e.setLocalPosition(x, y, z);
        e.setLocalScale(sx, sy, sz);
    };

    /**
     * Stands a plane on the floor at (x, z), tilted to face the camera exactly so a sprite is not
     * foreshortened by the 2.5D view. Its bottom edge touches the floor at that point.
     */
    const standUp = (e: Entity, x: number, z: number, width: number, height: number): void => {
        e.setLocalEulerAngles(90 - TILT_DEG, 0, 0);
        e.setLocalScale(width, 1, height);
        e.setLocalPosition(x, (Math.cos(TILT_RAD) * height) / 2, z - (Math.sin(TILT_RAD) * height) / 2);
    };

    /** Loads a transparent PNG into a flat material (texture arrives asynchronously). */
    const spriteTexture = (mat: StandardMaterial, url: string): void => {
        const asset = new Asset(`sprite-${url}`, 'texture', { url });
        asset.ready((a) => {
            const tex = a.resource as Texture;
            mat.emissive = new Color(1, 1, 1);
            mat.emissiveMap = tex;
            mat.opacityMap = tex;
            mat.opacityMapChannel = 'a';
            mat.blendType = BLEND_NORMAL;
            mat.depthWrite = false;
            mat.update();
        });
        app.assets.add(asset);
        app.assets.load(asset);
    };

    /**
     * Opaque textured material (emissive map only). crate.png is a solid wood illustration with no
     * useful alpha — opacityMap/'a' or alphaTest would discard the whole mesh.
     */
    const opaqueTexture = (mat: StandardMaterial, url: string, depthWrite = true): void => {
        const asset = new Asset(`opaque-${url}-${depthWrite ? 'd' : 'n'}`, 'texture', { url });
        asset.ready((a) => {
            const tex = a.resource as Texture;
            mat.emissive = new Color(1, 1, 1);
            mat.emissiveMap = tex;
            mat.opacity = 1;
            mat.blendType = BLEND_NONE;
            mat.depthWrite = depthWrite;
            mat.update();
        });
        app.assets.add(asset);
        app.assets.load(asset);
    };

    // Ground: a grid texture drawn once, one cell per GRID_CELL meters, centred on the arena.
    const ground = (() => {
        const ppm = 256;
        const el = document.createElement('canvas');
        el.width = Math.round(mission.halfWidth * 2 * ppm);
        el.height = Math.round(mission.halfHeight * 2 * ppm);
        const g = el.getContext('2d');
        if (g) {
            g.fillStyle = '#112126';
            g.fillRect(0, 0, el.width, el.height);
            g.strokeStyle = 'rgba(74, 110, 120, 0.55)';
            g.lineWidth = 2;
            const cell = GRID_CELL * ppm;
            g.beginPath();
            for (let x = (el.width / 2) % cell; x <= el.width; x += cell) {
                g.moveTo(x, 0);
                g.lineTo(x, el.height);
            }
            for (let y = (el.height / 2) % cell; y <= el.height; y += cell) {
                g.moveTo(0, y);
                g.lineTo(el.width, y);
            }
            g.stroke();
            g.strokeStyle = 'rgba(237, 155, 252, 0.8)';
            g.lineWidth = 8;
            g.strokeRect(4, 4, el.width - 8, el.height - 8);
        }
        const tex = new Texture(device, {
            width: el.width,
            height: el.height,
            format: PIXELFORMAT_RGBA8,
            mipmaps: true
        });
        tex.anisotropy = 8;
        tex.setSource(el);
        const mat = flat('#ffffff');
        mat.emissive = new Color(1, 1, 1);
        mat.emissiveMap = tex;
        mat.update();
        return add('ground', 'plane', mat);
    })();
    place(ground, 0, 0, 0, mission.halfWidth * 2, 1, mission.halfHeight * 2);

    const start = mission.startPose;
    const startRing = add('start', 'cylinder', flat('#224248'));
    place(startRing, start.x, 0.01, -start.y, 0.4, 0.02, 0.4);

    /** Raise transparent mesh draw order so later layers (robot) paint over earlier ones (flags). */
    const drawOrder = (e: Entity, order: number): void => {
        for (const mi of e.render?.meshInstances ?? []) mi.drawOrder = order;
    };

    /** Wooden crate seen from above (used for box-shaped obstacles and the box pads). */
    const crateMat = flat('#c4a574');
    opaqueTexture(crateMat, './crate.png');
    const crate = (name: string, x: number, y: number, width: number, depth: number): void => {
        const e = add(name, 'box', crateMat);
        place(e, x, CRATE_HEIGHT / 2, -y, width, CRATE_HEIGHT, depth);
    };

    const zoneColor = { flag: '#62fbff', exit: '#ed9bfc', box: '#ba46ff', gate: '#ffd166' } as const;
    for (const z of mission.zones) {
        if (z.kind === 'box') {
            crate(`zone-${z.id}`, z.x, z.y, 0.3, 0.3);
        } else {
            // Flag goals keep only the upright flag sprite: the cyan pad reads as a glow on
            // top of the robot in the 2.5D view when they share a spot.
            if (z.kind === 'flag') {
                const flagMat = flat('#ffffff');
                const flagPlane = add(`flag-${z.id}`, 'plane', flagMat);
                // Plant the pole a touch toward the camera so the cloth does not sit on a crate behind it.
                standUp(flagPlane, z.x, -z.y + 0.06, FLAG_SIZE, FLAG_SIZE);
                spriteTexture(flagMat, './flag.png');
                drawOrder(flagPlane, DRAW_FLAG);
            } else {
                const disc = add(`zone-${z.id}`, 'cylinder', flat(zoneColor[z.kind], 0.55));
                place(disc, z.x, 0.02, -z.y, z.radius * 2, 0.02, z.radius * 2);
                const marker = add(`marker-${z.id}`, 'cylinder', flat(zoneColor[z.kind]));
                place(marker, z.x, 0.05, -z.y, 0.06, 0.1, 0.06);
            }
        }
    }

    // Movable cargo cubes. Texture is applied without opacity/alphaTest — crate.png has no alpha
    // and cutout materials were discarding every texel. Carry offset keeps them off the robot.
    const cargoEntities = new Map<string, Entity>();
    const cargoList = mission.cargo ?? [];
    for (const c of cargoList) {
        const cargoMat = flat('#d4a017');
        // Depth write stays on so the ground cannot paint over the crate; the robot ignores depth instead.
        opaqueTexture(cargoMat, './crate.png', true);
        const e = add(`cargo-${c.id}`, 'box', cargoMat);
        place(e, c.x, CARGO_LIFT, -c.y, CARGO_SIZE, CARGO_SIZE, CARGO_SIZE);
        cargoEntities.set(c.id, e);
    }

    const wall = flat('#ed9bfc');
    const wallSide = flat('#a35fb3');
    for (const o of mission.obstacles) {
        const w = o.halfWidth * 2;
        const h = o.halfHeight * 2;
        if (Math.max(w, h) / Math.min(w, h) <= 1.6) {
            crate('obstacle', o.cx, o.cy, w, h);
        } else {
            // A darker body with a lighter top face, so the height reads under flat (unlit) shading.
            const b = add('obstacle', 'box', wallSide);
            place(b, o.cx, PROP_HEIGHT / 2, -o.cy, w, PROP_HEIGHT, h);
            const top = add('obstacle-top', 'plane', wall);
            place(top, o.cx, PROP_HEIGHT + 0.002, -o.cy, w, 1, h);
        }
    }

    // Low walls around the arena edge give the perspective camera something to read depth against.
    // They sit just outside the floor so the playable area is unchanged.
    {
        const t = EDGE_WALL_THICKNESS;
        const hw = mission.halfWidth;
        const hh = mission.halfHeight;
        const strips: [number, number, number, number][] = [
            [0, -hh - t / 2, hw * 2 + t * 2, t],
            [0, hh + t / 2, hw * 2 + t * 2, t],
            [-hw - t / 2, 0, t, hh * 2],
            [hw + t / 2, 0, t, hh * 2]
        ];
        for (const [cx, cz, w, d] of strips) {
            const body = add('edge', 'box', wallSide);
            place(body, cx, EDGE_WALL_HEIGHT / 2, cz, w, EDGE_WALL_HEIGHT, d);
            const top = add('edge-top', 'plane', wall);
            place(top, cx, EDGE_WALL_HEIGHT + 0.002, cz, w, 1, d);
        }
    }

    // Robot: 16 camera-facing billboards, one per sheet frame, cross-faded by heading.
    const sprites = Array.from({ length: SHEET_FRAMES }, (_, frame) => {
        const mat = flat('#ffffff');
        const entity = add(`robot-${frame}`, 'plane', mat);
        entity.enabled = false;
        spriteTexture(mat, `./robot16-${String(frame).padStart(2, '0')}.png`);
        // Robot layer is always above the crate: transparent pass, no depth test.
        mat.depthTest = false;
        drawOrder(entity, DRAW_ROBOT);
        return { entity, mat, alpha: 0, axis: frameHeading(frame) };
    });
    sprites[11].alpha = 1;
    let lastFade = performance.now();

    const camera = new Entity('camera');
    camera.addComponent('camera', {
        projection: 0,
        fov: FOV,
        clearColor: new Color(0, 0, 0, 0),
        nearClip: 0.1,
        farClip: 40
    });
    const camBase = { x: 0, y: 14 * Math.sin(TILT_RAD), z: 14 * Math.cos(TILT_RAD) };
    camera.setPosition(camBase.x, camBase.y, camBase.z);
    camera.setEulerAngles(-TILT_DEG, 0, 0);
    app.root.addChild(camera);

    /**
     * Perspective fit: smallest camera distance (looking at the arena centre along the tilt) so the
     * floor corners and the robot sprite at the far edge stay inside the frame.
     */
    const fitPerspective = (aspect: number): void => {
        const s = Math.sin(TILT_RAD);
        const c = Math.cos(TILT_RAD);
        const tanHalf = Math.tan((FOV * Math.PI) / 360);
        const hw = mission.halfWidth + EDGE_WALL_THICKNESS + FIT_MARGIN;
        const hh = mission.halfHeight + EDGE_WALL_THICKNESS + FIT_MARGIN;
        // Floor corners at height 0 and the sprite top at the far edge.
        const points: [number, number, number][] = [
            [hw, 0, hh],
            [-hw, 0, hh],
            [hw, 0, -hh],
            [-hw, 0, -hh],
            [hw, SPRITE_HEIGHT * c, -hh],
            [-hw, SPRITE_HEIGHT * c, -hh]
        ];
        let dist = 1;
        for (const [x, h, z] of points) {
            const yc = c * h - s * z;
            const common = s * h + c * z;
            dist = Math.max(dist, Math.abs(x) / (tanHalf * aspect) + common, Math.abs(yc) / tanHalf + common);
        }
        dist *= 1.01;
        camBase.y = dist * s;
        camBase.z = dist * c;
        camera.setPosition(camBase.x, camBase.y, camBase.z);
    };

    const background = (() => {
        const mat = flat('#ffffff');
        // Using an opaque texture because it's a solid JPEG
        opaqueTexture(mat, backgroundUrl(mission.taskId), false);
        return add('background', 'plane', mat);
    })();
    // Place it far back and scale it up to fill the view
    const bgDist = 35; // Near the farClip plane
    const bgScale = bgDist * Math.tan((FOV * Math.PI) / 360) * 2;
    place(
        background,
        0,
        14 * Math.sin(TILT_RAD) - bgDist * Math.sin(TILT_RAD),
        14 * Math.cos(TILT_RAD) - bgDist * Math.cos(TILT_RAD),
        bgScale * 1.5,
        1,
        bgScale
    );
    // Face the camera directly
    background.setLocalEulerAngles(90 - TILT_DEG, 0, 0);
    // Draw it before everything else
    drawOrder(background, 10);

    const resize = (width: number, height: number): { cellCssPx: number } => {
        if (width < 1 || height < 1) return { cellCssPx: 24 };
        app.resizeCanvas(width, height);
        fitPerspective(width / height);
        return { cellCssPx: 24 };
    };

    // ---- visual effects: small pools of flat shapes, all generated here (no outside art) ----
    const fxMat = {
        dust: flat('#9fb3b8'),
        spark: flat('#ffd166'),
        hit: flat('#ff5a4f'),
        confetti: [flat('#62fbff'), flat('#ed9bfc'), flat('#ffd166'), flat('#7dff9b'), flat('#ffffff')],
        ringCyan: flat('#62fbff', 0.55),
        ringPink: flat('#ed9bfc', 0.55)
    };
    interface Particle {
        e: Entity;
        vx: number;
        vy: number;
        vz: number;
        gravity: number;
        life: number;
        max: number;
        size: number;
    }
    const particles: Particle[] = [];
    for (let i = 0; i < PARTICLE_POOL; i++) {
        const e = add('fx', 'plane', fxMat.dust);
        e.enabled = false;
        particles.push({ e, vx: 0, vy: 0, vz: 0, gravity: 0, life: 0, max: 1, size: 0.05 });
    }
    interface Ring {
        e: Entity;
        life: number;
        reach: number;
    }
    const rings: Ring[] = [];
    for (let i = 0; i < RING_POOL; i++) {
        const e = add('fx-ring', 'cylinder', fxMat.ringCyan);
        e.enabled = false;
        rings.push({ e, life: 0, reach: 0.5 });
    }
    const rand = (a: number, b: number): number => a + Math.random() * (b - a);
    const spawn = (
        mat: StandardMaterial,
        x: number,
        y: number,
        h: number,
        speed: number,
        up: number,
        gravity: number,
        life: number,
        size: number
    ): void => {
        const p = particles.find((q) => q.life <= 0);
        if (!p) return;
        const a = rand(0, Math.PI * 2);
        const s = rand(0.4, 1) * speed;
        p.vx = Math.cos(a) * s;
        p.vz = Math.sin(a) * s;
        p.vy = up * rand(0.6, 1);
        p.gravity = gravity;
        p.life = p.max = life * rand(0.7, 1);
        p.size = size;
        p.e.render!.material = mat;
        p.e.setLocalPosition(x, h, -y);
        p.e.setLocalEulerAngles(90 - TILT_DEG, 0, 0);
        p.e.enabled = true;
    };
    const ring = (mat: StandardMaterial, x: number, y: number, reach: number): void => {
        const r = rings.find((q) => q.life <= 0);
        if (!r) return;
        r.life = 0.5;
        r.reach = reach;
        r.e.render!.material = mat;
        r.e.setLocalPosition(x, 0.03, -y);
        r.e.enabled = true;
    };
    let flash = 0;
    let shake = 0;
    const runFx = (dt: number): void => {
        for (const p of particles) {
            if (p.life <= 0) continue;
            p.life -= dt;
            if (p.life <= 0) {
                p.e.enabled = false;
                continue;
            }
            p.vy -= p.gravity * dt;
            const pos = p.e.getLocalPosition();
            const y = Math.max(0.02, pos.y + p.vy * dt);
            p.e.setLocalPosition(pos.x + p.vx * dt, y, pos.z + p.vz * dt);
            const k = p.life / p.max;
            p.e.setLocalScale(p.size * k, 1, p.size * k);
        }
        for (const r of rings) {
            if (r.life <= 0) continue;
            r.life -= dt;
            if (r.life <= 0) {
                r.e.enabled = false;
                continue;
            }
            const t = 1 - r.life / 0.5;
            // Grows quickly, then shrinks away in the last quarter so it never pops out.
            const d = r.reach * 2 * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5) * (t > 0.75 ? (1 - t) * 4 : 1);
            r.e.setLocalScale(d, 0.01, d);
        }
        flash = Math.max(0, flash - dt);
        if (shake > 0) {
            shake = Math.max(0, shake - dt);
            const amp = shake * 0.25;
            camera.setPosition(camBase.x + rand(-amp, amp), camBase.y + rand(-amp, amp), camBase.z);
            if (shake === 0) camera.setPosition(camBase.x, camBase.y, camBase.z);
        }
    };
    app.on('update', runFx);

    return {
        onFrame: (cb) => {
            app.on('update', cb);
        },
        setCargo: (positions) => {
            for (const [id, e] of cargoEntities) {
                const p = positions.get(id);
                if (p) e.setLocalPosition(p.x, CARGO_LIFT, -p.y);
            }
        },
        setPose: (pose) => {
            const deg = ((((pose.headingRadians * 180) / Math.PI) % 360) + 360) % 360;
            // Signed shortest angle from an axis to the heading, in degrees (-180..180).
            // Used only to pick the nearest view; the billboards themselves never yaw.
            const offset = (axis: number): number => ((deg - axis + 540) % 360) - 180;
            const nearest = sprites.reduce(
                (best, s, i) => (Math.abs(offset(s.axis)) < Math.abs(offset(sprites[best].axis)) ? i : best),
                0
            );
            // Cross-fade at a constant rate; the faded-in sprite is the one nearest the heading.
            const now = performance.now();
            const step = Math.min(0.1, (now - lastFade) / 1000) / FADE_SECONDS;
            lastFade = now;
            sprites.forEach((s, i) => {
                const target = i === nearest ? 1 : 0;
                s.alpha += Math.max(-step, Math.min(step, target - s.alpha));
                s.entity.enabled = s.alpha > 0;
                s.mat.opacity = s.alpha;
                // Red tint while `flash` runs down after a hit.
                const tint = 1 - Math.min(1, flash / 0.35) * 0.65;
                s.mat.emissive.set(1, tint, tint);
                s.mat.update();
                standUp(s.entity, pose.x, -pose.y, SPRITE_WIDTH, SPRITE_HEIGHT);
            });
        },
        burst: (kind, x, y) => {
            switch (kind) {
                case 'dust':
                    for (let i = 0; i < 3; i++) spawn(fxMat.dust, x, y, 0.03, 0.12, 0.08, 0, 0.5, 0.12);
                    break;
                case 'spark':
                    for (let i = 0; i < 10; i++) spawn(fxMat.spark, x, y, 0.2, 0.7, 0.9, 3, 0.45, 0.07);
                    break;
                case 'hit':
                    for (let i = 0; i < 12; i++) spawn(fxMat.hit, x, y, 0.2, 0.9, 1, 3.5, 0.5, 0.08);
                    break;
                case 'confetti':
                    for (let i = 0; i < 36; i++) {
                        const m = fxMat.confetti[i % fxMat.confetti.length];
                        spawn(m, x, y, 0.3, 0.8, 2.2, 3, 1.2, 0.09);
                    }
                    break;
                case 'ring':
                    ring(fxMat.ringCyan, x, y, 0.35);
                    break;
                case 'drop':
                    ring(fxMat.ringPink, x, y, 0.3);
                    for (let i = 0; i < 4; i++) spawn(fxMat.dust, x, y, 0.05, 0.3, 0.2, 0, 0.5, 0.1);
                    break;
            }
        },
        flashRobot: () => {
            flash = 0.35;
        },
        shake: () => {
            shake = 0.25;
        },
        resize,
        destroy: () => {
            app.destroy();
        }
    };
};
