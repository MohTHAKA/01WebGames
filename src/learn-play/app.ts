import { getTask, getUnit, taskTitle, tasks, tasksOfUnit, unitObjective, unitTitle, units } from './curriculum.ts';
import type { Lang, Task, Unit } from './curriculum.ts';
import { el } from './dom.ts';
import { gameLevelInfo } from './game-levels.ts';
import { gameConcepts } from './games.ts';
import { applyLang, loadLang, saveLang, t } from './i18n.ts';
import type { StringKey } from './i18n.ts';
import { getMission } from './missions.ts';
import { LocalProgressStore, unitStatus } from './progress.ts';

type Route =
    | { name: 'home' }
    | { name: 'unit'; id: number }
    | { name: 'task'; id: number }
    | { name: 'game'; gameId: string }
    | { name: 'play'; id: number }
    | { name: 'notfound' };

export const parseRoute = (hash: string): Route => {
    const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    if (parts.length === 0) return { name: 'home' };
    if (parts.length === 2 && parts[0] === 'game') {
        const gameId = parts[1];
        return gameConcepts.some((g) => g.id === gameId && g.playable)
            ? { name: 'game', gameId }
            : { name: 'notfound' };
    }
    const id = Number(parts[1]);
    if (parts.length === 2 && parts[0] === 'play' && gameLevelInfo.some((l) => l.id === id))
        return { name: 'play', id };
    if (parts.length === 2 && Number.isInteger(id)) {
        if (parts[0] === 'unit' && getUnit(id)) return { name: 'unit', id };
        if (parts[0] === 'task' && getTask(id)) return { name: 'task', id };
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
        else main.append(this.notFoundView());
        const playableId =
            route.name === 'play' || (route.name === 'task' && getMission(route.id)) ? route.id : undefined;
        document.body.classList.toggle('lp-fit', playableId !== undefined);
        this.root.replaceChildren(this.header(), main);
        window.scrollTo(0, 0);
        if (playableId !== undefined) void this.mountMission(playableId, token);
    }

    private header(): HTMLElement {
        /** Absolute links into the main 01skills.com site; Learn & Play stays on this SPA. */
        const site = (key: StringKey, href: string): HTMLElement =>
            el('a', { class: 'lp-nav-item', href, target: '_self', rel: 'noopener' }, this.tr(key));

        const home = site('home', 'https://01skills.com/');
        const current = el(
            'a',
            { class: 'lp-nav-item lp-nav-current', href: '#/', 'aria-current': 'page' },
            this.tr('pageTitle')
        );
        const langBtn = el(
            'button',
            { class: 'lp-lang', type: 'button', 'aria-label': this.tr('languageLabel') },
            this.tr('language')
        );
        langBtn.addEventListener('click', () => this.toggleLang());

        const logo = el(
            'a',
            { href: 'https://01skills.com/', class: 'lp-logo-link' },
            el('img', {
                class: 'lp-logo',
                src: './zero1-logo-placeholder.svg',
                alt: this.tr('logoAlt'),
                width: '120',
                height: '32'
            })
        );

        return el(
            'header',
            { class: 'lp-header' },
            logo,
            el(
                'nav',
                { class: 'lp-nav', 'aria-label': this.tr('mainNav') },
                home,
                site('events', 'https://01skills.com/events/'),
                site('challenges', 'https://01skills.com/challenges/'),
                current,
                site('support', 'https://01skills.com/support/')
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

    /** Overall home completion: learning-path tasks plus coding-game levels. */
    private overallCompletion(): { done: number; total: number; percent: number } {
        const ids = [...tasks.map((t) => t.id), ...gameLevelInfo.map((l) => l.id)];
        const total = ids.length;
        const done = ids.filter((id) => this.progress.isTaskCompleted(id)).length;
        const percent = total === 0 ? 0 : Math.round((done / total) * 100);
        return { done, total, percent };
    }

    private homeView(): HTMLElement {
        const unitCards = units.map((u) => {
            const count = tasksOfUnit(u.id).length;
            const title = `${this.tr('unit')} ${u.id}: ${unitTitle(u, this.lang)}`;
            return el(
                'article',
                { class: 'lp-card', 'data-unit': String(u.id) },
                el(
                    'div',
                    { class: 'lp-card-head' },
                    el('img', {
                        class: 'lp-robot',
                        src: './robot-0.png',
                        alt: '',
                        width: '40',
                        height: '40',
                        loading: 'lazy'
                    }),
                    el('h3', {}, title)
                ),
                el('p', { class: 'lp-muted' }, unitObjective(u, this.lang)),
                el(
                    'p',
                    { class: 'lp-meta' },
                    el('span', {}, `${count} ${this.tr('tasks')}`),
                    el(
                        'span',
                        { class: 'lp-status' },
                        `${this.statusLabel(u)} · ${this.doneCount(u)}/${count} ${this.tr('doneCount')}`
                    )
                ),
                el('a', { class: 'lp-btn', href: `#/unit/${u.id}` }, this.tr('exploreUnit'))
            );
        });

        const gameCards = gameConcepts.map((g) => {
            const levelCount = gameLevelInfo.filter((l) => l.gameId === g.id).length;
            return el(
                'article',
                { class: 'lp-card lp-card-game', 'data-game': g.id },
                el('h3', {}, this.lang === 'ar' ? g.nameAr : g.nameEn),
                el('p', { class: 'lp-muted' }, this.lang === 'ar' ? g.descAr : g.descEn),
                g.playable
                    ? el(
                          'p',
                          { class: 'lp-meta' },
                          el('span', { class: 'lp-badge' }, this.tr('playable')),
                          el('span', {}, `${levelCount} ${this.tr('levels')} · ${this.gameDone(g.id)}/${levelCount}`)
                      )
                    : el(
                          'p',
                          { class: 'lp-meta' },
                          el('span', { class: 'lp-badge' }, this.tr('comingSoon')),
                          el('span', { class: 'lp-badge lp-badge-alt' }, this.tr('concept'))
                      ),
                g.playable ? el('a', { class: 'lp-btn', href: `#/game/${g.id}` }, this.tr('play')) : null
            );
        });

        const { done, total, percent } = this.overallCompletion();
        const completion = el(
            'div',
            {
                class: 'lp-completion',
                role: 'status',
                'aria-label': `${this.tr('completionRate')}: ${percent}%`
            },
            el('span', { class: 'lp-completion-label' }, this.tr('completionRate')),
            el('span', { class: 'lp-completion-value' }, `${percent}%`),
            el('span', { class: 'lp-completion-meta' }, `${done}/${total}`)
        );

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
                ),
                completion
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
        if (done) li.classList.add('lp-task-done');
        li.append(
            el('span', { class: 'lp-task-num' }, `${done ? '✓ ' : ''}${label}`),
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
            el('a', { class: 'lp-btn lp-btn-small', href: `#/task/${task.id}` }, this.tr('openTask'))
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
                const li = el('li', { class: 'lp-task', 'data-level': String(l.id) });
                if (done) li.classList.add('lp-task-done');
                li.append(
                    el('span', { class: 'lp-task-num' }, `${done ? '✓ ' : ''}${this.tr('level')} ${i + 1}`),
                    el('span', {}, this.lang === 'ar' ? l.titleAr : l.titleEn),
                    el('a', { class: 'lp-btn lp-btn-small', href: `#/play/${l.id}` }, this.tr('play'))
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

    private notFoundView(): HTMLElement {
        return el(
            'div',
            {},
            el('h1', { class: 'lp-title' }, this.tr('notFound')),
            el('a', { class: 'lp-btn', href: '#/' }, this.tr('backHome'))
        );
    }
}
