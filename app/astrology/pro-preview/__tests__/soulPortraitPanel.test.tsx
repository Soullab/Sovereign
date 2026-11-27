/** @jest-environment jsdom */
/**
 * Founder request 2026-11-07: a Soul Portrait from Pro is written inside Pro,
 * from the chart Pro already holds — the separate form asked again for it.
 */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import ProSoulPortraitPanel, { ageOn } from '../ProSoulPortraitPanel';

jest.mock('../pro-saved-charts.module.css', () => ({}), { virtual: true });

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
const fetchMock = jest.fn();
const openDraft = jest.fn();

function render(props: Partial<React.ComponentProps<typeof ProSoulPortraitPanel>> = {}) {
  act(() => root.render(React.createElement(ProSoulPortraitPanel, {
    source: 'chart-1', label: 'Example Client', chartLine: 'Example Client · 1990-06-15 · 23:30',
    birthDate: '1990-06-15', onClose: () => {}, openDraft, ...props,
  })));
}
const button = (text: string) =>
  Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.startsWith(text)) as HTMLButtonElement;
const minorBox = () => container.querySelector('input[type="checkbox"]') as HTMLInputElement;

beforeEach(() => {
  fetchMock.mockReset();
  openDraft.mockReset();
  (globalThis as any).fetch = fetchMock;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('Soul Portrait inside Pro', () => {
  it('works out age from the birth date', () => {
    expect(ageOn('1990-06-15', new Date(2026, 10, 7))).toBe(36);
    expect(ageOn('2010-11-08', new Date(2026, 10, 7))).toBe(15);
    expect(ageOn('not a date')).toBeNull();
  });

  it('shows the chart Pro holds and prefills the name and age, asking for no birth details', () => {
    render();
    expect(container.textContent).toContain('Example Client · 1990-06-15 · 23:30');
    const inputs = Array.from(container.querySelectorAll('input:not([type="checkbox"])')) as HTMLInputElement[];
    expect(inputs[0].value).toBe('Example Client');
    expect(inputs[1].value).toBe(String(ageOn('1990-06-15')));
    expect(container.querySelector('input[type="date"], input[type="time"]')).toBeNull();
    expect(minorBox().checked).toBe(false);
  });

  it('always writes an under-18 subject as a minor', () => {
    render({ birthDate: `${new Date().getFullYear() - 10}-01-01` });
    expect(minorBox().checked).toBe(true);
    expect(minorBox().disabled).toBe(true);
  });

  it('sends the chart by id only, then opens the draft in this tab', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ previewUrl: '/soul-portrait/preview/abc' }) });
    render();
    await act(async () => { button('Write draft').click(); });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.proChartSource).toBe('chart-1');
    expect(body.birthData).toBeUndefined();
    expect(body).toMatchObject({ name: 'Example Client', mode: 'gift', isMinor: false });
    // Founder ruling 2026-11-24: straight to the draft, where the client link is made.
    expect(openDraft).toHaveBeenCalledTimes(1);
    expect(openDraft).toHaveBeenCalledWith('/soul-portrait/preview/abc');
    // A fallback link, in this tab, in case it does not open.
    const draft = container.querySelector('a') as HTMLAnchorElement;
    expect(draft.textContent).toBe('Open draft');
    expect(draft.getAttribute('href')).toBe('/soul-portrait/preview/abc');
    expect(draft.target).toBe('');
  });

  it('does not open anything when the draft fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ error: 'The draft came back incomplete — please try again.' }) });
    render();
    await act(async () => { button('Write draft').click(); });
    expect(openDraft).not.toHaveBeenCalled();
    expect(container.textContent).toContain('The draft came back incomplete');
  });

  it('says where the client link is made, and sends nothing itself', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ previewUrl: '/soul-portrait/preview/abc' }) });
    render();
    await act(async () => { button('Write draft').click(); });
    expect(container.textContent).toContain('To give Example Client a link: at the end of the draft');
    // These name the real controls at the end of the draft (SendPortraitPanel).
    expect(container.textContent).toContain('under Send this portrait');
    expect(container.textContent).toContain('choose Create private link');
    // Nothing is sent from here: the only request was the draft.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('for a minor, says no client link can be made', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ previewUrl: '/soul-portrait/preview/abc' }) });
    render({ birthDate: `${new Date().getFullYear() - 10}-01-01` });
    await act(async () => { button('Write draft').click(); });
    expect(container.textContent).toContain('cannot be sent and no client link can be made yet');
    expect(container.textContent).not.toContain('Create private link');
  });

  it('sends nothing without a name', () => {
    render({ label: '' });
    expect(button('Write draft').disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Year Ahead source', () => {
  const radio = (text: string) =>
    Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.includes(text))!
      .querySelector('input[type="radio"]') as HTMLInputElement;
  const sent = async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ previewUrl: '/p' }) });
    await act(async () => { button('Write draft').click(); });
    return JSON.parse(fetchMock.mock.calls[0][1].body);
  };

  it('calculates transits from the chart by default — no report to paste', async () => {
    render();
    expect(radio('Calculate from this chart').checked).toBe(true);
    expect(container.querySelector('textarea')).toBeNull();
    const body = await sent();
    expect(body.transitSource).toBe('calculated');
    expect(body.transitReport).toBeUndefined();
  });

  it('still accepts a pasted report, and sends only that', async () => {
    render();
    act(() => radio('Paste a transit report').click());
    expect(button('Write draft').disabled).toBe(true); // nothing pasted yet
    const area = container.querySelector('textarea') as HTMLTextAreaElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(area, 'Transiting Pluto in opposition with natal Jupiter\nMarch 4, 2026 until January 10, 2027');
      area.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const body = await sent();
    expect(body.transitSource).toBeUndefined();
    expect(body.transitReport).toContain('Transiting Pluto');
  });

  it('sends no transits when the Year Ahead is left out', async () => {
    render();
    act(() => radio('No Year Ahead').click());
    const body = await sent();
    expect(body.transitSource).toBeUndefined();
    expect(body.transitReport).toBeUndefined();
  });
});
