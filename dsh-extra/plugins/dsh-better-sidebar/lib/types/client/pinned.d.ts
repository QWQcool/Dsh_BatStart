/**
 * Cross-session pinned-terminal resolution (v0.17.0+).
 *
 * A pinned terminal tab lives in its HOME session's state (the only
 * authoritative copy) — switching sessions never copies or projects it.
 * The viewer session's TabBar renders the tabs OTHER sessions have pinned
 * as VIRTUAL tabs appended to the first leaf's tab list, so the user sees
 * them inline with their own tabs. Clicking a virtual tab activates it
 * in-place: TerminalView connects to the home session's PTY via WebSocket
 * (sessionId + tab query params resolve to the home PTY on the host side),
 * so the terminal renders in the current workbench without jumping sessions.
 *
 * Visibility rule:
 *
 * | pin.scope | visible when |
 * |-----------|--------------|
 * | `global`  | any session (cwd-independent) |
 * | `workspace` | `viewer.cwd === tab.pin.homeCwd` (both undefined match; viewer.cwd unknown → conservative visible) |
 *
 * The "viewer.cwd unknown → visible" branch is intentional: during
 * hydration the session summary may carry no cwd yet, and hiding pinned
 * workspace tabs on first paint would flash them away. Once the cwd
 * resolves, the next store notify re-runs the resolver with the real cwd.
 *
 * The viewer's OWN session is excluded: its pinned tabs are already on its
 * own tab strip, so rendering them again as virtual tabs would double-show.
 * Tabs whose `pin` field is missing or whose `type` is not `'terminal'` are
 * ignored — only terminal tabs can be pinned.
 */
import type { SidebarState, SidebarTab, SplitNode } from './state.ts';
/** A pinned terminal surfaced to the viewer, paired with its home session. */
export interface PinnedTabEntry {
    tab: SidebarTab;
    homeSessionId: string;
}
/** A viewer's session identity for visibility resolution. */
export interface PinnedViewer {
    sessionId: string;
    cwd: string | undefined;
}
/** The home-session scope stored on a pinned virtual tab's meta, so
 *  TerminalView connects to the home session's PTY (not the viewer's). */
export interface PinnedHomeScope {
    sessionId: string;
    cwd: string | undefined;
    /** The original tab id in the home session (TerminalView's `tab` param). */
    tabId: string;
}
/** Whether a tab id is a pinned virtual id (prefixed). */
export declare function isPinnedVirtualId(tabId: string): boolean;
/** Parse a pinned virtual id into its home session id and original tab id.
 *  Format: `pinned:<homeSessionId>:<originalTabId>` — session ids are UUIDs
 *  (no colons), so the first colon after the prefix delimits the session. */
export declare function parsePinnedVirtualId(tabId: string): {
    homeSessionId: string;
    tabId: string;
};
/** Extract the home scope from a pinned virtual tab's meta (undefined for
 *  regular tabs). */
export declare function getPinnedHomeScope(tab: SidebarTab): PinnedHomeScope | undefined;
/** Whether a tab is a pinned virtual tab (injected from another session). */
export declare function isPinnedVirtualTab(tab: SidebarTab): boolean;
/** Create a virtual SidebarTab for a pinned entry. The virtual id is unique
 *  (prefixed with home session) to avoid collision with the viewer's own
 *  tab ids; the original id is stored in meta for TerminalView. */
export declare function createPinnedVirtualTab(entry: PinnedTabEntry): SidebarTab;
/** Inject pinned virtual tabs into the first leaf of a split tree, and
 *  override that leaf's `active` when a pinned tab is activated. Returns
 *  the original tree when there are no pinned tabs and no active override. */
export declare function injectPinnedIntoTree(tree: SplitNode, pinned: readonly SidebarTab[], activePinnedId: string | null): SplitNode;
/**
 * Whether a pinned tab is visible to the viewer session. Conservative on
 * unknown cwd: a `workspace` pin with no `homeCwd` is visible everywhere
 * (the pin was set before the home session's cwd resolved), and a viewer
 * whose cwd is unknown sees every workspace pin (avoids hydration flash).
 */
export declare function pinnedVisibleTo(tab: SidebarTab, viewer: PinnedViewer): boolean;
/**
 * Collect every pinned terminal visible to the viewer across ALL cached
 * session states. Excludes the viewer's own session (those tabs are on its
 * own strip). Order is stable: sessions in the cache's insertion order,
 * tabs in tree order (splits → bottomSplits → floats) within each session
 * — the order tabs were opened/pinned, so the rail never reorders between
 * renders.
 */
export declare function collectPinnedTabs(bySession: ReadonlyMap<string, SidebarState>, viewer: PinnedViewer): PinnedTabEntry[];
