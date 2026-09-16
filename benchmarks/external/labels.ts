/**
 * The two labels every artefact under the isolated evaluation exception must carry.
 *
 * In one module, imported rather than retyped, so a document cannot end up with a
 * slightly different wording from the one the exception was granted under.
 *
 * See `benchmarks/external/README.md` for what the exception permits, what it
 * forbids, and the four properties a corpus must have to qualify.
 */

/** The data's licensing state, stated rather than glossed. */
export const PROVENANCE_LABEL = 'license/provenance status: unclear for dialogue data';

/** What may be done with it, and what may never be. */
export const EXCEPTION_LABEL = 'local evaluation exception; not redistributable by this project';
