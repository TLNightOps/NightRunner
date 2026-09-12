import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Firebase is the only thing stubbed here — AuthService and BackendTransport
// run for real so the token path is exercised end to end.
const mocks = vi.hoisted(() => ({
    getIdToken: vi.fn()
}));

vi.mock('@/api/auth/firebaseAuth.js', () => ({
    isFirebaseMode: true,
    auth: {
        currentUser: {
            getIdToken: mocks.getIdToken
        }
    },
    subscribeToFirebaseToken: () => () => {},
    firebaseLogout: vi.fn()
}));

const TOKEN_KEY = 'firebase_id_token';

let AuthService;
let BackendTransport;
let replaceSpy;

beforeEach(async () => {
    vi.resetModules();
    mocks.getIdToken.mockReset();
    localStorage.clear();

    AuthService = (await import('@/api/auth/AuthService.js')).default;
    BackendTransport = (await import('@/api/BackendTransport.js')).default;

    // jsdom refuses real navigation, so stand in for window.location.
    replaceSpy = vi.fn();
    Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: { pathname: '/dashboard', replace: replaceSpy, href: '' }
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

const jsonResponse = (body) => ({
    status: 200,
    ok: true,
    json: async () => body
});

const unauthorized = () => ({
    status: 401,
    ok: false,
    json: async () => ({})
});

describe('AuthService.getToken', () => {

    it('returns a live token from Firebase rather than the stale stored copy', async () => {
        localStorage.setItem(TOKEN_KEY, 'stale-token');
        mocks.getIdToken.mockResolvedValue('fresh-token');

        const token = await AuthService.getToken();

        expect(token).toBe('fresh-token');
        expect(mocks.getIdToken).toHaveBeenCalledWith(false);
    });

    it('writes the refreshed token back to storage', async () => {
        localStorage.setItem(TOKEN_KEY, 'stale-token');
        mocks.getIdToken.mockResolvedValue('fresh-token');

        await AuthService.getToken();

        expect(localStorage.getItem(TOKEN_KEY)).toBe('fresh-token');
    });

    it('falls back to the stored token when Firebase is unreachable', async () => {
        localStorage.setItem(TOKEN_KEY, 'stale-token');
        mocks.getIdToken.mockRejectedValue(new Error('network unavailable'));

        await expect(AuthService.getToken()).resolves.toBe('stale-token');
    });

    it('forces a brand new token when refreshToken is called', async () => {
        mocks.getIdToken.mockResolvedValue('forced-token');

        await AuthService.refreshToken();

        expect(mocks.getIdToken).toHaveBeenCalledWith(true);
    });

    it('keeps getCachedToken synchronous for render-path callers', () => {
        localStorage.setItem(TOKEN_KEY, 'stored-token');

        const token = AuthService.getCachedToken();

        expect(token).toBe('stored-token');
        expect(token).not.toBeInstanceOf(Promise);
    });

});

describe('BackendTransport 401 handling', () => {

    it('refreshes the token and replays the request once', async () => {
        mocks.getIdToken
            .mockResolvedValueOnce('expired-token')
            .mockResolvedValue('renewed-token');

        const fetchMock = vi.fn()
            .mockResolvedValueOnce(unauthorized())
            .mockResolvedValueOnce(jsonResponse({ id: 'patrol-1' }));
        vi.stubGlobal('fetch', fetchMock);

        const result = await BackendTransport.get('/patrols');

        expect(result).toEqual({ id: 'patrol-1' });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(replaceSpy).not.toHaveBeenCalled();

        const retryHeaders = fetchMock.mock.calls[1][1].headers;
        expect(retryHeaders.Authorization).toBe('Bearer renewed-token');
    });

    it('preserves method and body on the replayed request', async () => {
        mocks.getIdToken
            .mockResolvedValueOnce('expired-token')
            .mockResolvedValue('renewed-token');

        const fetchMock = vi.fn()
            .mockResolvedValueOnce(unauthorized())
            .mockResolvedValueOnce(jsonResponse({ saved: true }));
        vi.stubGlobal('fetch', fetchMock);

        await BackendTransport.post('/scores', { points: 5 });

        const retry = fetchMock.mock.calls[1][1];
        expect(retry.method).toBe('POST');
        expect(JSON.parse(retry.body)).toEqual({ points: 5 });
    });

    it('does not retry when the refreshed token is unchanged', async () => {
        mocks.getIdToken.mockResolvedValue('same-token');

        const fetchMock = vi.fn().mockResolvedValue(unauthorized());
        vi.stubGlobal('fetch', fetchMock);

        await expect(BackendTransport.get('/patrols'))
            .rejects.toThrow('Authentication expired.');

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('gives up and clears the session after a fresh token is also refused', async () => {
        localStorage.setItem(TOKEN_KEY, 'expired-token');
        mocks.getIdToken
            .mockResolvedValueOnce('expired-token')
            .mockResolvedValue('renewed-token');

        const fetchMock = vi.fn().mockResolvedValue(unauthorized());
        vi.stubGlobal('fetch', fetchMock);

        await expect(BackendTransport.get('/patrols'))
            .rejects.toThrow('Authentication expired.');

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
        expect(replaceSpy).toHaveBeenCalledWith('/login?expired=true');
    });

    it('does not bounce a visitor who is already on the login page', async () => {
        window.location.pathname = '/login';
        mocks.getIdToken.mockResolvedValue('same-token');

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(unauthorized()));

        await expect(BackendTransport.get('/patrols'))
            .rejects.toThrow('Authentication expired.');

        expect(replaceSpy).not.toHaveBeenCalled();
    });

});
