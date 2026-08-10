import {MATCH_MODES, type MatchMode, type MatchResult} from '@/domain/types';
import {
  ChallengeCompleteError,
  NoSuchChallengeError,
  type ChallengeService,
  type MatchReport
} from './challenges';

/**
 * The HTTP surface, as plain Request → Response.
 *
 * Nothing here imports Next. A `route.ts` supplies the service and forwards the
 * request, which keeps these testable by calling them with a `Request` rather
 * than by standing up a server.
 *
 * Everything arriving from a client is untrusted and is parsed before use, per
 * RULES.md#security. A reported result may be a lie — the honour system
 * accepts that — but it has to be a well-formed lie that can only alter its own
 * challenge.
 */

const MAX_HANDLE = 40;
const MAX_KEY = 100;

/** A validation failure, carrying the field so the message can name it. */
type Invalid = {field: string; problem: string};

function bad(field: string, problem: string): Invalid {
  return {field, problem};
}

function json(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    // None of these responses may be stored: the create response carries the
    // edit secret, and RULES.md forbids that reaching a cache on a device.
    headers: {'cache-control': 'no-store'}
  });
}

function rejected(problems: Invalid[]): Response {
  return json({error: 'invalid', problems}, 400);
}

async function body(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function text(
  value: unknown,
  field: string,
  max: number,
  problems: Invalid[]
): string {
  if (typeof value !== 'string') {
    problems.push(bad(field, 'must be a string'));
    return '';
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) problems.push(bad(field, 'must not be empty'));
  if (trimmed.length > max) {
    problems.push(bad(field, `must be at most ${max} characters`));
  }
  return trimmed;
}

/** POST — opens a challenge and returns both of its identifiers, once. */
export function createChallenge(service: ChallengeService) {
  return async (request: Request): Promise<Response> => {
    const input = await body(request);
    if (!input) return rejected([bad('body', 'must be a JSON object')]);

    const problems: Invalid[] = [];
    const handle = text(input.handle, 'handle', MAX_HANDLE, problems);
    if (problems.length > 0) return rejected(problems);

    const created = await service.create(handle);

    // 201, and the only time the secret is ever transmitted.
    return json(created, 201);
  };
}

/**
 * POST — records a reported result.
 *
 * The secret arrives in the body rather than the path. It is a credential, and
 * RULES.md forbids it reaching a log line — a URL path reaches the access log
 * of every hop between here and the client.
 */
export function reportMatch(service: ChallengeService) {
  return async (request: Request): Promise<Response> => {
    const input = await body(request);
    if (!input) return rejected([bad('body', 'must be a JSON object')]);

    const problems: Invalid[] = [];
    const editSecret = text(input.editSecret, 'editSecret', 200, problems);
    const idempotencyKey = text(
      input.idempotencyKey,
      'idempotencyKey',
      MAX_KEY,
      problems
    );

    if (input.result !== 'win' && input.result !== 'loss') {
      problems.push(bad('result', 'must be "win" or "loss"'));
    }

    if (!MATCH_MODES.includes(input.mode as MatchMode)) {
      // Turf War is absent on purpose: rule 3 counts a win only in Anarchy or
      // X Battle, so there is no mode value that could report one.
      problems.push(bad('mode', `must be one of ${MATCH_MODES.join(', ')}`));
    }

    if (problems.length > 0) return rejected(problems);

    const report: MatchReport = {
      result: input.result as MatchResult,
      mode: input.mode as MatchMode,
      idempotencyKey
    };

    try {
      const outcome = await service.report(editSecret, report);

      // A replayed key is a success. The queue that sent it twice did nothing
      // wrong, and telling it otherwise would make it retry forever.
      return json(
        {
          applied: outcome.applied,
          publicId: outcome.challenge.publicId,
          state: outcome.challenge.state
        },
        200
      );
    } catch (error) {
      if (error instanceof NoSuchChallengeError) {
        // Deliberately the same shape a wrong secret gets: nothing here says
        // whether the challenge exists.
        return json({error: 'not-found'}, 404);
      }
      if (error instanceof ChallengeCompleteError) {
        return json({error: 'complete'}, 409);
      }
      throw error;
    }
  };
}
