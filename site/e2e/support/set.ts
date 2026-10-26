import type { Page } from '@playwright/test';
import { messageIn } from './messages';

// The images of the set on screen, kit first, by role as a screen reader finds them; each gear piece
// also shows its brand's icon (gear-brand), which is not one of the set's four pieces.
export const pieceImages = (p: Page, locale = 'en-US') =>
  p
    .getByRole('region', { name: messageIn(locale, 'set.label') })
    .getByRole('img')
    .and(p.locator(':not(.brand-icon)'));
