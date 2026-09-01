/**
 * Terminal URL hyperlinks: xterm's `registerLinkProvider` is fed per-line
 * link descriptors built from the pty stream, so URLs printed by any tool
 * become hoverable / clickable spans.
 *
 * To stay out of the user's way (a terminal's primary interaction is text
 * selection, not browsing), a click only activates when the user holds
 * Ctrl (Win/Linux) or Cmd (mac) — a plain click is left for xterm's
 * normal selection handling. Only http(s) URLs are dispatched to the
 * browser; other schemes (`file://`, `mailto:`, `javascript:`, …) are
 * underlined for visibility but rejected at activation, so a `file://`
 * URL printed by a tool stays inert instead of being handed to
 * `window.open`.
 *
 * Kept as a pure module (no xterm import) so the regex, the line
 * scanner, the modifier gate and the scheme guard are unit-testable
 * without mounting a terminal. `buildTerminalLinks` returns plain-object
 * descriptors whose shape matches xterm's `ILink` minus the `activate`
 * callback — the caller attaches `activate` (which closes over the
 * event modifier check + `openTerminalUrl`) so this module never
 * imports xterm types.
 */
/**
 * The URL pattern used to scan each terminal line.
 *
 * A word boundary (`\b`) guards the leading scheme so `notttps://…` does
 * not match. The character class excludes ASCII whitespace and the
 * wrapping punctuation that shells commonly emit around URLs (quotes,
 * angle brackets, brackets/braces, pipes, backslashes, backticks) so a
 * URL printed as `"https://example.com"` or `<https://example.com>` does
 * not drag the wrapping character into the link target.
 *
 * Carries the `g` flag so `findTerminalUrlsInLine` can iterate every
 * match on a line; callers must reset `lastIndex` before reuse (the
 * helper does this defensively).
 */
export declare const TERMINAL_URL_REGEX: RegExp;
/** A URL match in a terminal line: the text and its 0-based start offset. */
export interface TerminalUrlMatch {
    /** 0-based start index of the URL within the line string. */
    start: number;
    /** The matched URL text. */
    text: string;
}
/**
 * Find every http(s) URL in a line of terminal text, in source order
 * with 0-based start offsets. A link provider maps these to buffer
 * ranges for xterm's `registerLinkProvider`.
 *
 * Trailing unmatched closing parens are trimmed from each match (see
 * {@link trimUnbalancedTrailingParens}), so a URL wrapped in parens by
 * a shell opens without the trailing `)`, while Wikipedia-style URLs
 * with balanced parens stay intact.
 *
 * Resets the regex's `lastIndex` before and after the scan so a
 * previous partial iteration can't desynchronize a later one (the
 * regex carries the `g` flag and is module-shared).
 */
export declare function findTerminalUrlsInLine(line: string): TerminalUrlMatch[];
/**
 * A buffer range in xterm's coordinate system. xterm's cell `x` is
 * 1-based (1..cols) and `y` is the buffer line number; the `end` is
 * inclusive (the last cell covered by the link). Structurally
 * compatible with xterm's `IBufferRange` so the caller can pass it
 * straight through without importing xterm types here.
 */
export interface TerminalLinkRange {
    start: {
        x: number;
        y: number;
    };
    end: {
        x: number;
        y: number;
    };
}
/**
 * A link descriptor: a buffer range plus the URL text. The caller
 * (the link provider in `TerminalView`) attaches the `activate`
 * callback, which closes over the modifier gate and `openTerminalUrl`.
 */
export interface TerminalLinkDescriptor {
    range: TerminalLinkRange;
    text: string;
}
/**
 * Build link descriptors for every URL found in a terminal line.
 *
 * @param lineText - the line's text (e.g. from
 *   `IBufferLine.translateToString(true)`).
 * @param lineNumber - the buffer line number xterm passed to
 *   `ILinkProvider.provideLinks` (used as the `y` of every range; URLs
 *   never span wrapped lines because each wrapped row is its own
 *   buffer line).
 * @returns descriptors in source order; empty when the line has no URL.
 */
export declare function buildTerminalLinks(lineText: string, lineNumber: number): TerminalLinkDescriptor[];
/**
 * Decide whether a click on a terminal link should activate (open the URL).
 *
 * Mirrors what every modern terminal does (Windows Terminal, iTerm2, the
 * VSCode integrated terminal): a plain click stays a text-selection
 * gesture, and only Ctrl (Win/Linux) or Cmd (mac) hands the URL to the
 * browser. The modifier is read off the activating `MouseEvent`, not
 * tracked separately, so a key-up between hover and click never
 * desynchronizes the gate.
 */
export declare function shouldActivateTerminalLink(event: MouseEvent): boolean;
/**
 * Open a URL matched in the terminal, with a scheme guard so a printed
 * `file://` or anything that slipped past the regex cannot reach
 * `window.open`. The URL is constructed via `new URL(...)` which throws
 * on malformed input; the catch makes the function total so the xterm
 * handler never throws into the terminal's event loop.
 *
 * @returns `true` when the URL was dispatched to `window.open`, `false`
 *   when it was rejected (bad URL, disallowed scheme, no `window`).
 */
export declare function openTerminalUrl(uri: string): boolean;
