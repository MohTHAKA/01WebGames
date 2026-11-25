import { isGameOnWeb, isUnitOnWeb, isUnlocked } from './access.ts';
import { UNITY_HOST, UNITY_PROJECT_URL } from './config.ts';
import { getTask, getUnit, taskTitle, tasksOfUnit, unitObjective, unitTitle, units } from './curriculum.ts';
import type { Lang, Task, Unit } from './curriculum.ts';
import { el } from './dom.ts';
import { gameLevelInfo } from './game-levels.ts';
import { gameConcepts } from './games.ts';
import { applyLang, loadLang, saveLang, t } from './i18n.ts';
import type { StringKey } from './i18n.ts';
import { getMission } from './missions.ts';
import { LocalProgressStore, unitStatus } from './progress.ts';
import { syncFromUnity } from './unity-sync.ts';

type Route =
    | { name: 'home' }
    | { name: 'unit'; id: number }
    | { name: 'task'; id: number }
    | { name: 'game'; gameId: string }
    | { name: 'play'; id: number }
    | { name: 'unity' }
    | { name: 'notfound' };

export const parseRoute = (hash: string): Route => {
    const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts.length === 0) return { name: 'home' };
    if (parts.length === 1 && parts[0] === 'unity') return { name: 'unity' };
    // Anything outside the web build lives in the Unity project, so its routes lead there.
    if (parts.length === 2 && parts[0] === 'game') {
        const gameId = parts[1];
        if (!gameConcepts.some((g) => g.id === gameId && g.playable)) return { name: 'notfound' };
        return isGameOnWeb(gameId) ? { name: 'game', gameId } : { name: 'unity' };
    }
    const id = Number(parts[1]);
    if (parts.length === 2 && parts[0] === 'play') {
        const level = gameLevelInfo.find((l) => l.id === id);
        if (level) return isGameOnWeb(level.gameId) ? { name: 'play', id } : { name: 'unity' };
    }
    if (parts.length === 2 && Number.isInteger(id)) {
        const unit = parts[0] === 'unit' ? getUnit(id) : undefined;
        if (unit) return isUnitOnWeb(unit.id) ? { name: 'unit', id } : { name: 'unity' };
        const task = parts[0] === 'task' ? getTask(id) : undefined;
        if (task) return isUnitOnWeb(task.unitId) ? { name: 'task', id } : { name: 'unity' };
    }
    return { name: 'notfound' };
};

export class LearnPlayApp {
    private lang: Lang = loadLang();
    private readonly progress = new LocalProgressStore();

    private readonly root: HTMLElement;
    private disposeMission: (() => void) | null = null;
    private renderToken = 0;

    constructor(root: HTMLElement) {
        this.root = root;
        window.addEventListener('hashchange', () => this.render());
        this.render();
        this.startUnitySync();
    }

    /** Shows lessons finished in the Unity app. Only the home and unit lists refresh, never a running mission. */
    private startUnitySync(): void {
        let first = true;
        const sync = async (): Promise<void> => {
            const changed = !document.hidden && (await syncFromUnity(this.progress));
            const initial = first;
            first = false;
            if (!changed) return;
            // The first sync can unlock the very page the player opened from Unity, so it refreshes any screen.
            const route = parseRoute(location.hash).name;
            if (initial || route === 'home' || route === 'unit') this.render();
        };
        window.addEventListener('focus', () => void sync());
        window.setInterval(() => void sync(), 5000);
        void sync();
    }

    private tr(key: StringKey): string {
        return t(this.lang, key);
    }

    private toggleLang(): void {
        this.lang = this.lang === 'en' ? 'ar' : 'en';
        saveLang(this.lang);
        this.render();
    }

    private render(): void {
        this.disposeMission?.();
        this.disposeMission = null;
        const token = ++this.renderToken;
        applyLang(this.lang);
        const route = parseRoute(location.hash);
        const main = el('main', { id: 'main', class: 'lp-main' });
        if (route.name === 'home') main.append(this.homeView());
        else if (route.name === 'unit') main.append(this.unitView(getUnit(route.id) as Unit));
        else if (route.name === 'task') main.append(this.taskView(getTask(route.id) as Task));
        else if (route.name === 'game') main.append(this.gameView(route.gameId));
        else if (route.name === 'play') main.append(this.playView(route.id));
        else if (route.name === 'unity') {
            if (UNITY_PROJECT_URL) {
                location.replace(UNITY_PROJECT_URL);
                return;
            }
            main.append(this.unityView());
        } else main.append(this.notFoundView());
        const playableId =
            (route.name === 'play' || (route.name === 'task' && getMission(route.id))) &&
            isUnlocked(this.progress, (route as { id: number }).id)
                ? (route as { id: number }).id
                : undefined;
        document.body.classList.toggle('lp-fit', playableId !== undefined);
        // Inside the Unity app the lesson fills the window: no site menu (Unity has its own back button).
        document.body.classList.toggle('lp-unity', UNITY_HOST);
        if (UNITY_HOST) this.root.replaceChildren(main);
        else this.root.replaceChildren(this.header(), main);
        window.scrollTo(0, 0);
        if (playableId !== undefined) void this.mountMission(playableId, token);
    }

    private header(): HTMLElement {
        /** Plain text labels only — no hrefs until this SPA is embedded on 01skills.com. */
        const navLabel = (key: StringKey, current = false): HTMLElement =>
            el(
                'span',
                {
                    class: current ? 'lp-nav-item lp-nav-disabled lp-nav-current' : 'lp-nav-item lp-nav-disabled',
                    'aria-disabled': 'true',
                    ...(current ? { 'aria-current': 'page' } : {})
                },
                this.tr(key)
            );

        const langBtn = el(
            'button',
            { class: 'lp-lang', type: 'button', 'aria-label': this.tr('languageLabel') },
            this.tr('language')
        );
        langBtn.addEventListener('click', () => this.toggleLang());

        const logo = el(
            'span',
            { class: 'lp-logo-link lp-logo-disabled', 'aria-disabled': 'true' },
            el('img', {
                class: 'lp-logo',
                src: './zero1-logo.png',
                alt: this.tr('logoAlt'),
                width: '160',
                height: '44'
            })
        );

        return el(
            'header',
            { class: 'lp-header' },
            logo,
            el(
                'nav',
                { class: 'lp-nav', 'aria-label': this.tr('mainNav') },
                navLabel('home'),
                navLabel('events'),
                navLabel('challenges'),
                navLabel('pageTitle', true),
                navLabel('support')
            ),
            langBtn
        );
    }

    private breadcrumb(...items: { label: string; href?: string }[]): HTMLElement {
        const list = el('ol', { class: 'lp-crumbs' });
        items.forEach((item, i) => {
            const last = i === items.length - 1;
            const li = el('li');
            if (item.href && !last) li.append(el('a', { href: item.href }, item.label));
            else li.append(el('span', last ? { 'aria-current': 'page' } : {}, item.label));
            list.append(li);
        });
        return el('nav', { class: 'lp-breadcrumb', 'aria-label': this.tr('breadcrumb') }, list);
    }

    private statusLabel(unit: Unit): string {
        const ids = tasksOfUnit(unit.id).map((x) => x.id);
        const s = unitStatus(this.progress, ids);
        return this.tr(s === 'not-started' ? 'notStarted' : s === 'in-progress' ? 'inProgress' : 'completed');
    }

    private doneCount(unit: Unit): number {
        return tasksOfUnit(unit.id).filter((x) => this.progress.isTaskCompleted(x.id)).length;
    }

    /** Locked content leads straight to the Unity project (the info page only while no link is set). */
    private unityHref(): string {
        return UNITY_PROJECT_URL || '#/unity';
    }

    private lockedLink(label: string): HTMLElement {
        return el(
            'a',
            { class: 'lp-btn', href: this.unityHref(), ...(UNITY_PROJECT_URL ? { rel: 'noopener' } : {}) },
            label
        );
    }

    private homeView(): HTMLElement {
        const unitCards = units
            .filter((u) => isUnitOnWeb(u.id))
            .map((u) => {
                const count = tasksOfUnit(u.id).length;
                const title = `${this.tr('unit')} ${u.id}: ${unitTitle(u, this.lang)}`;
                const onWeb = isUnitOnWeb(u.id);
                return el(
                    'article',
                    { class: onWeb ? 'lp-card' : 'lp-card lp-card-locked', 'data-unit': String(u.id) },
                    el(
                        'div',
                        { class: 'lp-card-head' },
                        el('img', {
                            class: 'lp-robot',
                            src: './robot-180.png',
                            alt: '',
                            width: '40',
                            height: '40',
                            loading: 'lazy'
                        }),
                        el('h3', {}, title)
                    ),
                    el('p', { class: 'lp-muted' }, unitObjective(u, this.lang)),
                    onWeb
                        ? el(
                              'p',
                              { class: 'lp-meta' },
                              el('span', {}, `${count} ${this.tr('tasks')}`),
                              el(
                                  'span',
                                  { class: 'lp-status' },
                                  `${this.statusLabel(u)} · ${this.doneCount(u)}/${count} ${this.tr('doneCount')}`
                              )
                          )
                        : el(
                              'p',
                              { class: 'lp-meta' },
                              el('span', {}, `${count} ${this.tr('tasks')}`),
                              el('span', { class: 'lp-badge lp-badge-alt' }, `🔒 ${this.tr('lockedInUnity')}`)
                          ),
                    onWeb
                        ? el('a', { class: 'lp-btn', href: `#/unit/${u.id}` }, this.tr('exploreUnit'))
                        : this.lockedLink(this.tr('openInUnity'))
                );
            });

        const gameCards = gameConcepts
            .filter((g) => isGameOnWeb(g.id))
            .map((g) => {
                const levelCount = gameLevelInfo.filter((l) => l.gameId === g.id).length;
                const onWeb = isGameOnWeb(g.id);
                return el(
                    'article',
                    {
                        class: onWeb ? 'lp-card lp-card-game' : 'lp-card lp-card-game lp-card-locked',
                        'data-game': g.id
                    },
                    el('h3', {}, this.lang === 'ar' ? g.nameAr : g.nameEn),
                    el('p', { class: 'lp-muted' }, this.lang === 'ar' ? g.descAr : g.descEn),
                    !onWeb
                        ? el(
                              'p',
                              { class: 'lp-meta' },
                              el('span', {}, `${levelCount} ${this.tr('levels')}`),
                              el('span', { class: 'lp-badge lp-badge-alt' }, `🔒 ${this.tr('lockedInUnity')}`)
                          )
                        : g.playable
                          ? el(
                                'p',
                                { class: 'lp-meta' },
                                el('span', { class: 'lp-badge' }, this.tr('playable')),
                                el(
                                    'span',
                                    {},
                                    `${levelCount} ${this.tr('levels')} · ${this.gameDone(g.id)}/${levelCount}`
                                )
                            )
                          : el(
                                'p',
                                { class: 'lp-meta' },
                                el('span', { class: 'lp-badge' }, this.tr('comingSoon')),
                                el('span', { class: 'lp-badge lp-badge-alt' }, this.tr('concept'))
                            ),
                    !onWeb
                        ? this.lockedLink(this.tr('openInUnity'))
                        : g.playable
                          ? el('a', { class: 'lp-btn', href: `#/game/${g.id}` }, this.tr('play'))
                          : null
                );
            });

        return el(
            'div',
            {},
            el(
                'div',
                { class: 'lp-home-hero' },
                el(
                    'div',
                    { class: 'lp-home-hero-text' },
                    el('h1', { class: 'lp-title' }, this.tr('pageTitle')),
                    el('p', { class: 'lp-intro' }, this.tr('intro'))
                )
            ),
            el(
                'div',
                { class: 'lp-columns' },
                el(
                    'section',
                    { class: 'lp-column', 'aria-labelledby': 'lp-learning' },
                    el('h2', { id: 'lp-learning' }, this.tr('learningPath')),
                    ...unitCards
                ),
                el(
                    'section',
                    { class: 'lp-column', 'aria-labelledby': 'lp-games' },
                    el('h2', { id: 'lp-games' }, this.tr('codingGames')),
                    el('p', { class: 'lp-muted' }, this.tr('gamesNote')),
                    ...gameCards
                )
            ),
            // The rest of the course and games live in the Unity build; one button opens it.
            UNITY_HOST
                ? null
                : el(
                      'section',
                      { class: 'lp-code-panel lp-code-panel-highlight' },
                      el('p', {}, this.tr('unityRest')),
                      this.lockedLink(this.tr('openInUnity'))
                  )
        );
    }

    private unitView(unit: Unit): HTMLElement {
        const list = el('ol', { class: 'lp-tasks' });
        for (const task of tasksOfUnit(unit.id)) list.append(this.taskRow(task));
        return el(
            'div',
            {},
            this.breadcrumb({ label: this.tr('pageTitle'), href: '#/' }, { label: `${this.tr('unit')} ${unit.id}` }),
            el('h1', { class: 'lp-title' }, unitTitle(unit, this.lang)),
            el('p', { class: 'lp-intro' }, unitObjective(unit, this.lang)),
            list
        );
    }

    private taskRow(task: Task): HTMLElement {
        const title = taskTitle(task, this.lang);
        const label = `${this.tr('task')} ${task.id}`;
        const li = el('li', { class: 'lp-task', value: String(task.id), 'data-task': String(task.id) });
        const done = this.progress.isTaskCompleted(task.id);
        const locked = !isUnlocked(this.progress, task.id);
        if (done) li.classList.add('lp-task-done');
        if (locked) li.classList.add('lp-task-locked');
        li.append(
            el('span', { class: 'lp-task-num' }, `${done ? '✓ ' : locked ? '🔒 ' : ''}${label}`),
            el(
                'span',
                { class: title ? '' : 'lp-muted' },
                title ?? this.tr('sourcePending'),
                task.draft
                    ? el(
                          'span',
                          { class: 'lp-badge lp-badge-alt lp-draft', title: this.tr('draftNote') },
                          this.tr('draft')
                      )
                    : null
            ),
            locked
                ? el(
                      'span',
                      {
                          class: 'lp-btn lp-btn-small lp-btn-locked',
                          'aria-disabled': 'true',
                          title: this.tr('lockedTask')
                      },
                      this.tr('lockedLabel')
                  )
                : el('a', { class: 'lp-btn lp-btn-small', href: `#/task/${task.id}` }, this.tr('openTask'))
        );
        return li;
    }

    private taskView(task: Task): HTMLElement {
        const unit = getUnit(task.unitId) as Unit;
        const title = taskTitle(task, this.lang);
        const crumbs = this.breadcrumb(
            { label: this.tr('pageTitle'), href: '#/' },
            { label: `${this.tr('unit')} ${unit.id}`, href: `#/unit/${unit.id}` },
            { label: `${this.tr('task')} ${task.id}` }
        );
        const heading = el(
            'h1',
            { class: 'lp-title' },
            `${this.tr('task')} ${task.id}${title ? `: ${title}` : ''} `,
            task.draft
                ? el('span', { class: 'lp-badge lp-badge-alt lp-draft', title: this.tr('draftNote') }, this.tr('draft'))
                : null
        );
        const back = el('a', { class: 'lp-btn lp-btn-small', href: `#/unit/${unit.id}` }, this.tr('backToUnit'));
        if (!isUnlocked(this.progress, task.id)) {
            return el(
                'div',
                {},
                crumbs,
                heading,
                el('p', { class: 'lp-intro' }, this.tr('lockedTask')),
                el('a', { class: 'lp-btn', href: `#/unit/${unit.id}` }, this.tr('backToUnit'))
            );
        }
        if (getMission(task.id)) {
            return el(
                'div',
                { class: 'lp-fit-page' },
                el('div', { class: 'lp-topbar' }, crumbs, heading, back),
                el('div', { id: 'lp-mission-host', class: 'lp-mission' }, this.tr('loadingMission'))
            );
        }
        return el(
            'div',
            {},
            crumbs,
            heading,
            title ? null : el('p', { class: 'lp-muted' }, this.tr('sourcePending')),
            el('p', { class: 'lp-intro' }, this.tr('missionSoon')),
            el('a', { class: 'lp-btn', href: `#/unit/${unit.id}` }, this.tr('backToUnit'))
        );
    }
    /** Lazy-loads PlayCanvas and Blockly only when a playable mission page is opened. */
    private async mountMission(taskId: number, token: number): Promise<void> {
        const host = document.getElementById('lp-mission-host');
        if (!host) return;
        try {
            const { mountMission } = await import('./mission-view.ts');
            if (token !== this.renderToken) return;
            const dispose = await mountMission(host, { lang: this.lang, taskId, store: this.progress });
            if (token !== this.renderToken) dispose();
            else this.disposeMission = dispose;
        } catch (err) {
            console.error(err);
            if (token === this.renderToken) host.textContent = this.tr('missionError');
        }
    }

    private gameDone(gameId: string): number {
        return gameLevelInfo.filter((l) => l.gameId === gameId && this.progress.isTaskCompleted(l.id)).length;
    }

    private gameView(gameId: string): HTMLElement {
        const game = gameConcepts.find((g) => g.id === gameId);
        if (!game) return this.notFoundView();
        const list = el('ol', { class: 'lp-tasks' });
        gameLevelInfo
            .filter((l) => l.gameId === gameId)
            .forEach((l, i) => {
                const done = this.progress.isTaskCompleted(l.id);
                const locked = !isUnlocked(this.progress, l.id);
                const li = el('li', { class: 'lp-task', 'data-level': String(l.id) });
                if (done) li.classList.add('lp-task-done');
                if (locked) li.classList.add('lp-task-locked');
                li.append(
                    el(
                        'span',
                        { class: 'lp-task-num' },
                        `${done ? '✓ ' : locked ? '🔒 ' : ''}${this.tr('level')} ${i + 1}`
                    ),
                    el('span', {}, this.lang === 'ar' ? l.titleAr : l.titleEn),
                    locked
                        ? el(
                              'span',
                              {
                                  class: 'lp-btn lp-btn-small lp-btn-locked',
                                  'aria-disabled': 'true',
                                  title: this.tr('lockedLevel')
                              },
                              this.tr('lockedLabel')
                          )
                        : el('a', { class: 'lp-btn lp-btn-small', href: `#/play/${l.id}` }, this.tr('play'))
                );
                list.append(li);
            });
        return el(
            'div',
            {},
            this.breadcrumb(
                { label: this.tr('pageTitle'), href: '#/' },
                { label: this.lang === 'ar' ? game.nameAr : game.nameEn }
            ),
            el('h1', { class: 'lp-title' }, this.lang === 'ar' ? game.nameAr : game.nameEn),
            el('p', { class: 'lp-intro' }, this.lang === 'ar' ? game.descAr : game.descEn),
            list
        );
    }

    private playView(levelId: number): HTMLElement {
        const info = gameLevelInfo.find((l) => l.id === levelId);
        const game = gameConcepts.find((g) => g.id === info?.gameId);
        if (!info || !game) return this.notFoundView();
        const index = gameLevelInfo.filter((l) => l.gameId === info.gameId).findIndex((l) => l.id === levelId) + 1;
        const gameName = this.lang === 'ar' ? game.nameAr : game.nameEn;
        const crumbs = this.breadcrumb(
            { label: this.tr('pageTitle'), href: '#/' },
            { label: gameName, href: `#/game/${game.id}` },
            { label: `${this.tr('level')} ${index}` }
        );
        const title = `${this.tr('level')} ${index}: ${this.lang === 'ar' ? info.titleAr : info.titleEn}`;
        if (!isUnlocked(this.progress, levelId)) {
            return el(
                'div',
                {},
                crumbs,
                el('h1', { class: 'lp-title' }, title),
                el('p', { class: 'lp-intro' }, this.tr('lockedLevel')),
                el('a', { class: 'lp-btn', href: `#/game/${game.id}` }, this.tr('backToGame'))
            );
        }
        return el(
            'div',
            { class: 'lp-fit-page' },
            el(
                'div',
                { class: 'lp-topbar' },
                crumbs,
                el('h1', { class: 'lp-title' }, title),
                el('a', { class: 'lp-btn lp-btn-small', href: `#/game/${game.id}` }, this.tr('backToGame'))
            ),
            el('div', { id: 'lp-mission-host', class: 'lp-mission' }, this.tr('loadingMission'))
        );
    }

    /** Hand-off page: the rest of the course and games live in the webgameIF Unity project. */
    private unityView(): HTMLElement {
        return el(
            'div',
            {},
            this.breadcrumb({ label: this.tr('pageTitle'), href: '#/' }, { label: this.tr('openInUnity') }),
            el('h1', { class: 'lp-title' }, this.tr('unityTitle')),
            el('p', { class: 'lp-intro' }, this.tr('unityBody')),
            el('p', { class: 'lp-muted' }, this.tr('unityLinkSoon')),
            el('a', { class: 'lp-btn lp-btn-small', href: '#/' }, this.tr('backHome'))
        );
    }

    private notFoundView(): HTMLElement {
        return el(
            'div',
            {},
            el('h1', { class: 'lp-title' }, this.tr('notFound')),
            el('a', { class: 'lp-btn', href: '#/' }, this.tr('backHome'))
        );
    }
}
