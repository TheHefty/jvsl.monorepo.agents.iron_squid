// The acceptance files CI runs. A story's .feature is added here by the task that starts the story,
// once its scenarios have been seen failing — a file listed here is one somebody watched go red.
//
// A story with several tasks registers its file with the first of them. Scenarios that a later task
// turns green are listed as pending, each with that task's name: CI leaves them out, the count check
// does not expect them, and `npm run bdd:manual` lists them, so a pending scenario never reads as
// automated. The task that turns one green removes it from here.
export type Registration = { feature: string; pending?: Record<string, string> };

export const registrations: Registration[] = [
  { feature: 'run-in-the-browser/site-online.feature' },
  { feature: 'run-in-the-browser/catalogue.feature' },
  { feature: 'run-in-the-browser/draw-a-set.feature' },
  { feature: 'run-in-the-browser/report-a-match.feature' },
  { feature: 'run-in-the-browser/reset-and-replay.feature' },
  { feature: 'run-in-the-browser/run-log.feature' },
  { feature: 'run-in-the-browser/finish-a-run.feature' },
  { feature: 'run-in-the-browser/notices.feature' },
];

export const registeredFeatures = registrations.map((r) => r.feature);
export const pendingScenarios = registrations.flatMap((r) => Object.keys(r.pending ?? {}));

// Playwright matches --grep-invert against the project, file, describe titles, test title and tags
// joined by spaces, so a pending name is matched as a whole run of words in that string. An outline
// is a describe titled with the scenario's name, so its examples are matched too.
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const pendingPattern = pendingScenarios.length
  ? new RegExp(`(^| )(${pendingScenarios.map(escape).join('|')})( |$)`)
  : undefined;
