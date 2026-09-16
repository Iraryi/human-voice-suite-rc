/**
 * The three machine conditions of the paired experiment.
 *
 * Separate from the tools that use them so that importing the list does not run a
 * command-line tool — a mistake this file exists because of, twice.
 *
 * | Condition | What the generator was told |
 * | --- | --- |
 * | `plain` | Answer the conversation. Nothing else. |
 * | `default` | Answer under this suite's own chat contract. |
 * | `post` | Rewrite the `plain` answer under the same contract. |
 */

export const CONDITIONS = ['plain', 'default', 'post'] as const;
export type Condition = (typeof CONDITIONS)[number];

/** The human control, which is not a condition but is measured beside them. */
export const HUMAN_ARM = 'human' as const;
