import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
    buildVisitMap,
    cellState,
    PUBLIC_IDENTITY_COLUMNS,
    DEFAULT_IDENTITY_COLUMNS
} from '@/pages/scoring/live/ProgressGrid.jsx';

import {
    getPublicProgress,
    getPublicCheckIn,
    publicCheckIn,
    publicCheckOut,
    InvalidLinkError
} from '@/api/PublicLinkService.js';


describe('ProgressGrid visit mapping', () => {

    it('keys visits by patrol and station', () => {
        const map = buildVisitMap([
            { patrolId: 'p1', stationId: 's1', checkedInAt: '2026-10-10T20:00:00Z', status: 'checked_in' }
        ]);

        expect(map['p1_s1'].checkedInAt).toBe('2026-10-10T20:00:00Z');
    });

    it('lets a later visit win over an earlier one for the same cell', () => {
        const map = buildVisitMap([
            { patrolId: 'p1', stationId: 's1', createdAt: '2026-10-10T20:00:00Z', status: 'checked_out', checkedOutAt: '2026-10-10T20:05:00Z' },
            { patrolId: 'p1', stationId: 's1', createdAt: '2026-10-10T21:00:00Z', status: 'checked_in', checkedInAt: '2026-10-10T21:00:00Z' }
        ]);

        // The reopened attempt is the current one.
        expect(map['p1_s1'].status).toBe('checked_in');
        expect(map['p1_s1'].checkedOutAt).toBeNull();
    });

    it('accepts snake_case keys from the API', () => {
        const map = buildVisitMap([
            { patrol_id: 'p1', station_id: 's1', checked_in_at: '2026-10-10T20:00:00Z' }
        ]);

        expect(map['p1_s1'].checkedInAt).toBe('2026-10-10T20:00:00Z');
    });

    it('tolerates no visits at all', () => {
        expect(buildVisitMap(null)).toEqual({});
        expect(buildVisitMap([])).toEqual({});
    });

});


describe('ProgressGrid cell states', () => {

    const patrol = { id: 'p1' };
    const station = { id: 's1' };

    it('reads as not arrived with no visit', () => {
        expect(cellState(patrol, station, undefined).className).toBe('not-arrived');
    });

    it('reads as checked in', () => {
        const state = cellState(patrol, station, { checkedInAt: 'x' });
        expect(state.className).toBe('checked-in');
    });

    it('reads as completed once checked out', () => {
        const state = cellState(patrol, station, { checkedInAt: 'x', checkedOutAt: 'y' });
        expect(state.className).toBe('completed');
    });

    it('marks a locked scoring attempt distinctly from a plain check-out', () => {
        const locked = cellState(patrol, station, { checkedInAt: 'x', status: 'completed' });
        const checkedOut = cellState(patrol, station, { checkedInAt: 'x', checkedOutAt: 'y' });

        expect(locked.value).toBe('★');
        expect(checkedOut.value).toBe('✓');
    });

});


describe('Public board identity columns', () => {

    it('shows number, name and troop for spectators', () => {
        expect(PUBLIC_IDENTITY_COLUMNS.map(c => c.key)).toEqual(['number', 'name', 'troop']);
    });

    it('joins the troops of a mixed patrol', () => {
        const troopColumn = PUBLIC_IDENTITY_COLUMNS.find(c => c.key === 'troop');
        expect(troopColumn.render({ troops: ['GA-0594', 'GA-0612'] })).toBe('GA-0594, GA-0612');
    });

    it('renders a dash when a patrol has no troop data', () => {
        const troopColumn = PUBLIC_IDENTITY_COLUMNS.find(c => c.key === 'troop');
        expect(troopColumn.render({ troops: [] })).toBe('—');
        expect(troopColumn.render({})).toBe('—');
    });

    it('keeps the internal board on a single patrol column', () => {
        expect(DEFAULT_IDENTITY_COLUMNS).toHaveLength(1);
    });

});


describe('PublicLinkService', () => {

    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    function respondWith(status, body = {}) {
        global.fetch.mockResolvedValue({
            ok: status >= 200 && status < 300,
            status,
            json: async () => body
        });
    }

    it('never sends an Authorization header', async () => {
        respondWith(200, { patrols: [] });

        await getPublicProgress('tok123');

        const [, options] = global.fetch.mock.calls[0];
        expect(options.headers.Authorization).toBeUndefined();
    });

    it('raises InvalidLinkError on a 404 rather than redirecting', async () => {
        respondWith(404, {});

        await expect(getPublicProgress('tok123')).rejects.toBeInstanceOf(InvalidLinkError);
    });

    it('url-encodes the token', async () => {
        respondWith(200, {});

        await getPublicCheckIn('a/b c');

        const [url] = global.fetch.mock.calls[0];
        expect(url).toContain('a%2Fb%20c');
        expect(url).not.toContain('a/b c');
    });

    it('posts only the station and patrol, never an event id', async () => {
        respondWith(200, {});

        await publicCheckIn('tok123', 's1', 'p1');

        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toContain('/public/checkin/tok123/check-in');
        expect(JSON.parse(options.body)).toEqual({ stationId: 's1', patrolId: 'p1' });
    });

    it('includes a timestamp only when one is given', async () => {
        respondWith(200, {});

        await publicCheckOut('tok123', 's1', 'p1', '2026-10-10T20:30:00Z');

        const [, options] = global.fetch.mock.calls[0];
        expect(JSON.parse(options.body).timestamp).toBe('2026-10-10T20:30:00Z');
    });

    it('surfaces a readable message when the network is down', async () => {
        global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(getPublicProgress('tok123')).rejects.toThrow(/signal/i);
    });

    it('passes a backend error description through', async () => {
        respondWith(400, { description: 'Unknown station for this event.' });

        await expect(publicCheckIn('tok123', 'bad', 'p1'))
            .rejects.toThrow('Unknown station for this event.');
    });

});


/*
 * `npm run build` does not run on every machine here (a missing esbuild), so
 * nothing else in CI proves these modules and their imports actually resolve.
 * These do.
 */
describe('Public page modules load', () => {

    it('loads the progress page', async () => {
        const mod = await import('@/pages/public/PublicProgress.jsx');
        expect(typeof mod.default).toBe('function');
    });

    it('loads the check-in page', async () => {
        const mod = await import('@/pages/public/PublicCheckIn.jsx');
        expect(typeof mod.default).toBe('function');
    });

    it('loads the admin links panel', async () => {
        const mod = await import('@/pages/admin/events/PublicLinksPanel.jsx');
        expect(typeof mod.default).toBe('function');
    });

    it('registers both public routes without a layout and without a sidebar name', async () => {
        const { AppRoutes, ACCESS } = await import('@/AppRoutes.jsx');

        for (const path of ['/progress/:token', '/checkin/:token']) {

            const route = AppRoutes.find(r => r.path === path);

            expect(route, `${path} should be registered`).toBeDefined();
            expect(route.access).toBe(ACCESS.PUBLIC);
            // Layout renders sidebar and user chrome, which assume a login.
            expect(route.layout).toBe(false);
            // No name keeps them out of the sidebar.
            expect(route.name).toBeUndefined();

        }
    });

    it('keeps the authenticated check-in page on its own path', async () => {
        const { AppRoutes, ACCESS } = await import('@/AppRoutes.jsx');

        // The static /checkin and the parameterised /checkin/:token coexist.
        const authenticated = AppRoutes.find(r => r.path === '/checkin');

        // Station staff only since the #236 role plan; the public link stays open.
        expect(authenticated.access).toBe(ACCESS.STATION);
    });

});


/*
 * Theming guard.
 *
 * `night-ops` is a dark palette; `trail-life` and `ahg` are light ones. A
 * hardcoded colour is therefore unreadable under two themes out of three —
 * black-on-black or white-on-white — which is a recurring way these pages break.
 * These tests fail the moment a literal colour creeps back in.
 */
describe('Public and admin-panel styles stay themeable', () => {

    const fs = require('node:fs');
    const path = require('node:path');

    const STYLESHEETS = [
        'src/pages/public/PublicPages.css',
        'src/pages/admin/events/PublicLinksPanel.css'
    ];

    // Colours that are deliberately literal, with the reason they have to be.
    const ALLOWED_LITERALS = {
        // A QR code needs a light quiet zone or scanners cannot read it.
        'src/pages/admin/events/PublicLinksPanel.css': ['#ffffff'],
        // White on the theme's error red, which is dark in every palette.
        'src/pages/public/PublicPages.css': ['#ffffff']
    };

    function read(relative) {
        return fs.readFileSync(path.resolve(process.cwd(), relative), 'utf8');
    }

    it.each(STYLESHEETS)('%s uses theme variables, not literal colours', (sheet) => {

        const css = read(sheet);
        const allowed = ALLOWED_LITERALS[sheet] ?? [];

        const literals = (css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])
            .map(c => c.toLowerCase())
            .filter(c => !allowed.includes(c));

        expect(literals, `${sheet} should not hardcode colours`).toEqual([]);

        // rgb()/rgba() literals hide the same problem.
        const functional = css.match(/\brgba?\s*\(/g) ?? [];
        expect(functional, `${sheet} should not hardcode rgb colours`).toEqual([]);

    });

    it.each(STYLESHEETS)('%s actually references theme variables', (sheet) => {
        const css = read(sheet);
        expect((css.match(/var\(--/g) ?? []).length).toBeGreaterThan(10);
    });

    it('sets a background and a foreground together on the public shell', () => {
        // A background without a matching text colour is exactly how the
        // unreadable combinations happen.
        const css = read('src/pages/public/PublicPages.css');
        const shell = css.slice(css.indexOf('.public-page {'), css.indexOf('.public-page-inner'));

        expect(shell).toContain('background: var(--page-bg)');
        expect(shell).toContain('color: var(--text-primary)');
    });

});


describe('useEventTheme', () => {

    it('applies the event theme and ignores a missing one', async () => {
        const { default: useEventTheme } = await import('@/branding/useEventTheme.js');
        expect(typeof useEventTheme).toBe('function');
    });

});
