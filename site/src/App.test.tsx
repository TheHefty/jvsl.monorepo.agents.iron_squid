// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import messages from './i18n/messages/en-US.json';
import { App } from './App';

afterEach(cleanup);

describe('App', () => {
  it('names the site on the home page, from the catalogue', () => {
    render(<App locale="en-US" page="home" basePath="/" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(messages['site.name']);
  });

  it('says a page does not exist, and links home', () => {
    render(<App locale="en-US" page="not-found" basePath="/repo/" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(messages['notFound.title']);
    const link = screen.getByRole('link', { name: messages['notFound.home'] });
    expect(link.getAttribute('href')).toBe('/repo/en-US/');
  });

  it('carries the mark of the site in a header on every page', () => {
    for (const page of ['home', 'not-found'] as const) {
      render(<App locale="en-US" page={page} basePath="/repo/" catalogueVersion="1.2.3" />);
      const banners = screen.getAllByRole('banner');
      expect(banners).toHaveLength(1);
      const mark = screen.getByRole('link', { name: messages['site.name'] });
      expect(mark.getAttribute('href')).toBe('/repo/en-US/');
      cleanup();
    }
  });

  it('says on every page which game version the catalogue matches, from the catalogue', () => {
    for (const page of ['home', 'not-found'] as const) {
      render(<App locale="en-US" page={page} basePath="/" catalogueVersion="1.2.3" />);
      const footers = screen.getAllByRole('contentinfo');
      expect(footers).toHaveLength(1);
      expect(footers[0]?.textContent).toContain('Weapons and gear from Splatoon 3 1.2.3');
      cleanup();
    }
  });
});
