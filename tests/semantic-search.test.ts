import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSearchIndex,
  searchMessages,
  searchWithIndex,
} from '../lib/semantic-search';
import { analyzeMessages } from '../lib/ai-parser';
import { createSeedMessages } from '../lib/seed-data';
import type { Message, Insight } from '../lib/types';

function fixtureMessages(): Message[] {
  return createSeedMessages();
}

describe('searchMessages ranking', () => {
  it('ranks real GitHub first for query "github"', () => {
    const messages = fixtureMessages();
    const insights = analyzeMessages(
      messages.map((m) => ({
        id: m.id,
        body: m.body,
        from: m.from,
        subject: m.subject,
      }))
    );

    const ranked = searchMessages('github', messages, insights);
    assert.ok(ranked.length >= 1, 'expected at least one hit');
    const top = ranked[0];
    assert.match(top.message.body, /GitHub/i);
    assert.match(top.message.from, /GitHub/i);

    // Uber "night" must not outrank or equal as a github hit
    const uber = ranked.find((r) => /airport last night/i.test(r.message.body));
    if (uber) {
      assert.ok(uber.score < top.score, 'uber night should score below real GitHub');
      assert.notEqual(uber.insight?.vendor, 'GitHub');
    }

    // Clear score gap vs non-github money messages
    const nonGithub = ranked.filter((r) => !/github/i.test(
      `${r.message.from} ${r.message.body} ${r.insight?.vendor || ''}`
    ));
    for (const r of nonGithub) {
      assert.ok(r.score < top.score, `unexpected high score for ${r.message.from}`);
    }
  });

  it('ranks Netflix from subject/from for query "netflix"', () => {
    const messages = fixtureMessages();
    const insights = analyzeMessages(
      messages.map((m) => ({
        id: m.id,
        body: m.body,
        from: m.from,
        subject: m.subject,
      }))
    );
    const ranked = searchMessages('netflix', messages, insights);
    assert.ok(ranked.length >= 1);
    assert.match(ranked[0].message.from, /Netflix/i);
  });

  it('recalls body-only GitHub mention', () => {
    const messages: Message[] = [
      {
        id: 'a',
        platformId: 'email',
        timestamp: '2026-07-01T00:00:00.000Z',
        from: 'Friend',
        body: 'Thanks for using GitHub on the side project.',
      },
      {
        id: 'b',
        platformId: 'sms',
        timestamp: '2026-07-02T00:00:00.000Z',
        from: 'Mom',
        body: 'Dinner at 6?',
      },
    ];
    const insights: Record<string, Insight> = {};
    const ranked = searchMessages('github', messages, insights);
    assert.equal(ranked.length, 1);
    assert.equal(ranked[0].message.id, 'a');
  });

  it('empty query returns all docs', () => {
    const messages = fixtureMessages();
    const ranked = searchMessages('', messages, {});
    assert.equal(ranked.length, messages.length);
  });
});

describe('search index recall scale', () => {
  it('candidate set is much smaller than N for selective terms', () => {
    const base = fixtureMessages();
    const messages: Message[] = [];
    for (let i = 0; i < 2500; i++) {
      const b = base[i % base.length];
      messages.push({
        ...b,
        id: `m-${i}`,
        body: i === 42 ? 'Your GitHub Pro subscription ($4.00/mo)' : `noise message ${i} about lunch and weather`,
        from: i === 42 ? 'GitHub Bot' : `User ${i}`,
        subject: i === 42 ? 'GitHub receipt' : undefined,
        timestamp: new Date(Date.UTC(2026, 6, 1 + (i % 28))).toISOString(),
      });
    }
    const insights = analyzeMessages(
      messages.map((m) => ({ id: m.id, body: m.body, from: m.from, subject: m.subject }))
    );
    const index = buildSearchIndex(messages, insights);
    const debug = { candidateCount: 0 };
    const ranked = searchWithIndex('github', index, { debug });

    assert.ok(ranked.length >= 1);
    assert.match(ranked[0].message.body, /GitHub/i);
    assert.ok(
      debug.candidateCount < messages.length * 0.1,
      `expected sparse candidates, got ${debug.candidateCount} of ${messages.length}`
    );
  });
});
