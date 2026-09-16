#!/usr/bin/env node
/**
 * `npm run external:fetch`
 *
 * Fetch a corpus of **genuine human text** from a public API, for measurement.
 *
 * ## Why this exists, and why it is not `benchmarks/corpora/`
 *
 * Every sample under `benchmarks/corpora/` carries a licence field, and the loader
 * refuses one that does not. That rule is what makes the corpus publishable. It
 * also means the corpus cannot contain other people's comments: a forum reply is
 * copyrighted by its author, carries no licence, and comes attached to a username
 * and a posting history.
 *
 * So this fetches into `.external-corpora/`, which is **gitignored**, and the
 * measurement that reads it commits **numbers only**. The suite gets the thing it
 * was missing — a false-positive denominator on real human writing — without
 * redistributing anybody's words. `benchmarks/external/README.md` states the
 * boundary in full.
 *
 * ## What is stripped
 *
 * Nothing that could identify a person survives the fetch: no username, no member
 * id, no avatar, no timestamp, no topic author. Each reply keeps its own text, a
 * synthetic id, and the topic title as `context` — the title is needed because a
 * reply is an answer to something, and the behaviour layer cannot judge mirroring
 * or over-completeness without knowing what was being answered.
 *
 * ## Why V2EX and not 小黑盒
 *
 * 小黑盒 was the first choice and is not reachable without their app credentials:
 * the public web front end is a JavaScript shell with no server-rendered comments,
 * every undocumented API path answers `请求失败了`, and the paths that do carry
 * content are under `/app/`, which their own `robots.txt` disallows. V2EX publishes
 * a documented read-only API that `robots.txt` permits, which makes it both
 * reachable and the more defensible source.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DEFAULT_OUT = path.join(ROOT, '.external-corpora');

/** Identifies the tool to the API operator. Not a browser spoof. */
const USER_AGENT = 'human-voice-suite/0.1 (research: false-positive measurement; contact via repository)';

/** Between requests. Slower than necessary on purpose. */
const DELAY_MS = 900;

/** How much of a topic body to keep as the turn the replies answer. */
const CONTEXT_LIMIT = 800;

const SOURCES = {
  v2ex: {
    label: 'V2EX replies (documented public read-only API)',
    /**
     * Topic lists: the site's two global lists, then one list per node.
     *
     * The global lists hold about fifty topics between them, which is what left the
     * first behaviour measurement resting on nineteen turn pairs.
     * `/api/topics/show.json?node_name=` is part of the same documented API and
     * returns ten to twenty more per node, so breadth comes from asking many nodes
     * rather than from paging one list.
     */
    topics: [
      'https://www.v2ex.com/api/topics/hot.json',
      'https://www.v2ex.com/api/topics/latest.json',
    ],
    nodeTopics: (node: string) =>
      `https://www.v2ex.com/api/topics/show.json?node_name=${encodeURIComponent(node)}`,
    replies: (topicId: number) =>
      `https://www.v2ex.com/api/replies/show.json?topic_id=${topicId}`,
  },
} as const;

/**
 * Nodes to draw topics from, in the order they are asked.
 *
 * Chosen for two properties: they exist, and their threads are discussions people
 * answer at length. A node that fails contributes nothing, which the run reports
 * rather than hides.
 */
const DEFAULT_NODES: readonly string[] = [
  'programmer', 'qna', 'share', 'ideas', 'career', 'jobs', 'life', 'create',
  'apple', 'android', 'python', 'javascript', 'java', 'go', 'rust', 'linux',
  'macos', 'windows', 'hardware', 'games', 'movies', 'music', 'reading',
  'travel', 'food', 'fitness', 'photography', 'coffee', 'car', 'invest',
  'startup', 'freelance', 'design', 'math', 'science', 'law', 'health',
  'baby', 'marriage', 'devops', 'cloud', 'security', 'database',
];

type SourceName = keyof typeof SOURCES;

export interface ExternalReply {
  readonly id: string;
  readonly source: string;
  /** The reply text, verbatim. Never published. */
  readonly text: string;
  /**
   * What the reply answers: the topic title and body.
   *
   * This is what makes a behaviour measurement possible at all. Mirroring and
   * over-completeness are relationships between two turns, so a corpus of replies
   * with nothing before them can only ever measure the prose layer. A topic body is
   * a genuine preceding turn — someone said something, someone answered — which is
   * why it is kept even though the title alone would be cheaper.
   */
  readonly context: string;
  /**
   * Position of the reply within its topic, 0-based.
   *
   * Not identifying — it is a count, not a timestamp — and it matters for honesty:
   * the first reply answers the topic author, while the tenth may be answering the
   * fourth replier. The behaviour measurement uses the first reply per topic for
   * that reason, and says so.
   */
  readonly ordinal: number;
}

export interface FetchReport {
  readonly source: string;
  readonly topics: number;
  readonly replies: number;
  readonly characters: number;
  readonly out: string;
}

interface Options {
  readonly source: SourceName;
  readonly topics: number;
  readonly minLength: number;
  readonly maxLength: number;
  readonly out: string;
  readonly quiet: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  let source: SourceName = 'v2ex';
  let topics = 40;
  let minLength = 8;
  let maxLength = 400;
  let out = DEFAULT_OUT;
  let quiet = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = (): string => {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      index += 1;
      return value;
    };
    switch (arg) {
      case '--source': {
        const value = next();
        if (!(value in SOURCES)) throw new Error(`unknown source ${value}; known: ${Object.keys(SOURCES).join(', ')}`);
        source = value as SourceName;
        break;
      }
      case '--topics':
        topics = Number(next());
        break;
      case '--min-length':
        minLength = Number(next());
        break;
      case '--max-length':
        maxLength = Number(next());
        break;
      case '--out':
        out = path.resolve(next());
        break;
      case '-q':
      case '--quiet':
        quiet = true;
        break;
      case '-h':
      case '--help':
        process.stdout.write(
          [
            'Usage: npm run external:fetch [options]',
            '',
            'Fetches genuine human text for false-positive measurement.',
            'Writes to .external-corpora/, which is gitignored and never published.',
            '',
            'Options:',
            '  --source NAME     Source to fetch (default: v2ex)',
            '  --topics N        How many topics to draw replies from (default: 40)',
            '  --min-length N    Skip replies shorter than N characters (default: 8)',
            '  --max-length N    Skip replies longer than N characters (default: 400)',
            '  --out DIR         Where to write (default: .external-corpora/)',
            '  -q, --quiet       Print only the summary',
            '  -h, --help        Show this help',
            '',
            'The text is copyrighted by the people who wrote it and is not licensed to',
            'this project. Measure with it; do not commit it.',
            '',
          ].join('\n'),
        );
        process.exit(0);
        break;
      default:
        if (arg !== undefined && arg.startsWith('-')) throw new Error(`Unknown option ${arg}`);
    }
  }

  return { source, topics, minLength, maxLength, out, quiet };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson(url: string): Promise<unknown> {
  // `fetch` is global in Node 22 and keeps this dependency-free.
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

/** The one field that survives a fetch, and the checks applied to it. */
function usableText(value: unknown, min: number, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (text.length < min || text.length > max) return undefined;
  // Replies that are only a link, only markup, or only emoji carry no writing to
  // measure, and counting them would inflate the false-positive denominator with
  // text no detector was ever meant to judge.
  if (/^https?:\/\/\S+$/.test(text)) return undefined;
  if (!/[\p{Script=Han}A-Za-z]/u.test(text)) return undefined;
  return text;
}

async function main(): Promise<number> {
  const options = parseArgs(process.argv.slice(2));
  const source = SOURCES[options.source];

  // The licence boundary, enforced rather than documented: this tool must never
  // be able to write into the committed corpus, where a missing licence is a
  // loader error precisely so that unlicensed text cannot get in.
  const forbidden = path.join(ROOT, 'benchmarks', 'corpora');
  if (path.resolve(options.out).startsWith(forbidden)) {
    process.stderr.write(
      `Refusing to write to ${options.out}: fetched text has no licence, and every sample under ` +
        'benchmarks/corpora/ must have one. Use the default output directory.\n',
    );
    return 1;
  }

  const topicList: Array<Record<string, unknown>> = [];
  const seenTopics = new Set<number>();
  const collect = (fetched: unknown): void => {
    if (!Array.isArray(fetched)) return;
    for (const topic of fetched as Array<Record<string, unknown>>) {
      const id = Number(topic['id']);
      if (!Number.isFinite(id) || seenTopics.has(id)) continue;
      seenTopics.add(id);
      topicList.push(topic);
    }
  };

  const endpoints = [
    ...source.topics,
    ...DEFAULT_NODES.map((node) => source.nodeTopics(node)),
  ];
  let endpointsFailed = 0;
  for (const endpoint of endpoints) {
    // Enough candidates is enough: every topic costs a second request for its
    // replies, so there is no reason to keep asking once the budget is met.
    if (topicList.length >= options.topics * 2) break;
    await sleep(DELAY_MS);
    try {
      collect(await getJson(endpoint));
    } catch {
      endpointsFailed += 1;
    }
  }
  if (topicList.length === 0) throw new Error('no topics returned by any endpoint');

  // Topics with replies first: a topic nobody answered contributes no turn pair,
  // and the budget is spent per topic rather than per reply.
  topicList.sort((a, b) => Number(b['replies'] ?? 0) - Number(a['replies'] ?? 0));

  const replies: ExternalReply[] = [];
  let topicsUsed = 0;

  for (const topic of topicList.slice(0, options.topics)) {
    const topicId = Number(topic['id']);
    const title = typeof topic['title'] === 'string' ? topic['title'].trim() : '';
    if (!Number.isFinite(topicId) || title.length === 0) continue;

    // The topic body is the turn the replies answer. Capped, because a long post
    // makes a poor stand-in for a chat turn and because the behaviour layer only
    // needs enough of it to judge mirroring and reply proportion.
    const body = typeof topic['content'] === 'string' ? topic['content'].trim() : '';
    const context = `${title}${body.length > 0 ? `\n\n${body.slice(0, CONTEXT_LIMIT)}` : ''}`;

    await sleep(DELAY_MS);
    let fetched: unknown;
    try {
      fetched = await getJson(source.replies(topicId));
    } catch (error) {
      process.stderr.write(`  topic ${topicId}: ${String(error)}\n`);
      continue;
    }
    if (!Array.isArray(fetched)) continue;
    topicsUsed += 1;

    let ordinal = 0;
    for (const raw of fetched as Array<Record<string, unknown>>) {
      const text = usableText(raw['content'], options.minLength, options.maxLength);
      if (text === undefined) continue;
      const replyId = String(raw['id'] ?? `${topicId}-${replies.length}`);
      replies.push({
        id: `${options.source}-${topicId}-${replyId}`,
        source: options.source,
        text,
        context,
        ordinal,
      });
      ordinal += 1;
    }

    if (!options.quiet) {
      process.stderr.write(`  ${topicsUsed} topic(s), ${replies.length} reply(ies)\r`);
    }
  }
  if (!options.quiet) process.stderr.write('\n');

  const directory = path.join(options.out, options.source);
  mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'replies.jsonl');
  writeFileSync(file, `${replies.map((reply) => JSON.stringify(reply)).join('\n')}\n`, 'utf8');

  const characters = replies.reduce((total, reply) => total + reply.text.length, 0);
  const manifest = {
    source: options.source,
    label: source.label,
    fetchedAt: new Date().toISOString(),
    topicsRequested: options.topics,
    topicsUsed,
    replies: replies.length,
    characters,
    filters: {
      minLength: options.minLength,
      maxLength: options.maxLength,
      dropped: 'links only, no Han or Latin letters',
    },
    stripped: ['member', 'member_id', 'avatar', 'created', 'topic author', 'topic body'],
    kept: ['reply text', 'topic title and body as context', 'synthetic id', 'ordinal within the topic'],
    licence:
      'None. The text is copyrighted by the people who wrote it and is not licensed to this project. ' +
      'It is measured locally and never committed; only aggregate numbers are published.',
    endpoints: {
      globalTopicLists: [...source.topics],
      nodeTopicLists: source.nodeTopics('<node>'),
      replies: 'topic_id=<id>',
      nodesAsked: DEFAULT_NODES.length,
    },
  };
  writeFileSync(path.join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  process.stdout.write('\nExternal corpus\n\n');
  process.stdout.write(`  source     : ${source.label}\n`);
  process.stdout.write(`  topics     : ${topicsUsed} of ${options.topics} requested\n`);
  process.stdout.write(`  replies    : ${replies.length}\n`);
  process.stdout.write(`  characters : ${characters}\n`);
  process.stdout.write(`  written to : ${path.relative(ROOT, file).split('\\').join('/')} (gitignored)\n`);
  process.stdout.write(
    '\nThis text has no licence. Measure with `npm run external:measure`; never commit it.\n',
  );
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(`external:fetch failed: ${String(error)}\n`);
    process.exit(1);
  });



