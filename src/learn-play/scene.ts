import {
    Asset,
    AppBase,
    AppOptions,
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
/** Cargo crate edge and the height of its centre (it sits just above the floor). */
const CARGO_SIZE = 0.26;
const CARGO_HEIGHT = CARGO_SIZE / 2 + 0.02;
/** Height of walls and crates in the 2.5D view, in meters. */
const PROP_HEIGHT = 0.3;
const FADE_SECONDS = 0.15;
const PARTICLE_POOL = 64;
const RING_POOL = 6;
/** Fixed camera pitch below the horizon; the camera looks at the arena centre from +z. */
const TILT_DEG = 55;
const TILT_RAD = (TILT_DEG * Math.PI) / 180;
const CAMERA_DISTANCE = 14;
/** Robot sheet views (degrees, 0 = front toward the camera) in public/robot-<angle>.png. */
const SHEET_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
/** The robot billboard: wide enough to cover the collision footprint, height from the art's aspect. */
const SPRITE_WIDTH = DEFAULT_CALIBRATION.robotRadiusMeters * 2 * 1.9;
const SPRITE_HEIGHT = (SPRITE_WIDTH * 316) / 297;
/** Grid cell size in meters (~1 wheel rotation) so distance is readable from above. */
const GRID_CELL = 0.35;

/**
 * Top-down orthographic arena. PlayCanvas only renders; the pose comes from the headless simulation.
 * The canvas is the only WebGL context this view owns and `destroy()` releases it.
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

    /** Opaque-looking textured material: transparent texels are cut out, so boxes sort and occlude correctly. */
    const cutoutTexture = (mat: StandardMaterial, url: string): void => {
        const asset = new Asset(`cutout-${url}`, 'texture', { url });
        asset.ready((a) => {
            const tex = a.resource as Texture;
            mat.emissive = new Color(1, 1, 1);
            mat.emissiveMap = tex;
            mat.opacityMap = tex;
            mat.opacityMapChannel = 'a';
            mat.alphaTest = 0.5;
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

    /** Wooden crate seen from above (used for box-shaped obstacles and the box pads). */
    const crateMat = flat('#ffffff');
    cutoutTexture(crateMat, './crate.png');
    const crate = (name: string, x: number, y: number, width: number, depth: number): void => {
        const e = add(name, 'box', crateMat);
        place(e, x, PROP_HEIGHT / 2, -y, width, PROP_HEIGHT, depth);
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
                standUp(flagPlane, z.x, -z.y, 0.42, 0.42);
                spriteTexture(flagMat, './flag.png');
            } else {
                const disc = add(`zone-${z.id}`, 'cylinder', flat(zoneColor[z.kind], 0.55));
                place(disc, z.x, 0.02, -z.y, z.radius * 2, 0.02, z.radius * 2);
                const marker = add(`marker-${z.id}`, 'cylinder', flat(zoneColor[z.kind]));
                place(marker, z.x, 0.05, -z.y, 0.06, 0.1, 0.06);
            }
        }
    }

    // Cargo crates sit above the robot sprite so a carried crate stays visible.
    const cargoEntities = new Map<string, Entity>();
    for (const c of mission.cargo ?? []) {
        const e = add(`cargo-${c.id}`, 'box', crateMat);
        place(e, c.x, CARGO_HEIGHT, -c.y, CARGO_SIZE, CARGO_SIZE, CARGO_SIZE);
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

    // Robot: eight camera-facing billboards, one per sheet view. The sheet's angle is the view of
    // the robot from the camera (0 = front toward the camera), so the heading it shows is
    // `(sheetAngle + 180) % 360`: heading 0 drives away from the camera and shows the back view.
    const sprites = SHEET_ANGLES.map((angle) => {
        const mat = flat('#ffffff');
        const entity = add(`robot-${angle}`, 'plane', mat);
        entity.enabled = false;
        spriteTexture(mat, `./robot-${angle}.png`);
        return { entity, mat, alpha: 0, axis: (angle + 180) % 360 };
    });
    sprites[SHEET_ANGLES.indexOf(180)].alpha = 1;
    let lastFade = performance.now();

    const camera = new Entity('camera');
    camera.addComponent('camera', {
        projection: 1,
        orthoHeight: mission.halfHeight + 0.1,
        clearColor: new Color(0, 0, 0, 0),
        nearClip: 0.1,
        farClip: 40
    });
    const camBase = { x: 0, y: CAMERA_DISTANCE * Math.sin(TILT_RAD), z: CAMERA_DISTANCE * Math.cos(TILT_RAD) };
    camera.setPosition(camBase.x, camBase.y, camBase.z);
    camera.setEulerAngles(-TILT_DEG, 0, 0);
    app.root.addChild(camera);

    const resize = (width: number, height: number): { cellCssPx: number } => {
        if (width < 1 || height < 1) return { cellCssPx: 24 };
        app.resizeCanvas(width, height);
        const aspect = width / height;
        // The floor is foreshortened by sin(tilt); the extra covers the robot standing at the far edge.
        const needH = mission.halfHeight * Math.sin(TILT_RAD) + SPRITE_HEIGHT * Math.cos(TILT_RAD) * 0.5 + 0.1;
        const needW = (mission.halfWidth + 0.1) / aspect;
        const orthoH = Math.max(needH, needW);
        if (camera.camera) camera.camera.orthoHeight = orthoH;
        // Shift the camera along its view plane so the arena sits centred, sprite headroom included.
        const lift = SPRITE_HEIGHT * Math.cos(TILT_RAD) * 0.25;
        camBase.y = CAMERA_DISTANCE * Math.sin(TILT_RAD) + lift * Math.cos(TILT_RAD);
        camBase.z = CAMERA_DISTANCE * Math.cos(TILT_RAD) - lift * Math.sin(TILT_RAD);
        camera.setPosition(camBase.x, camBase.y, camBase.z);
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
                if (p) e.setLocalPosition(p.x, CARGO_HEIGHT, -p.y);
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
