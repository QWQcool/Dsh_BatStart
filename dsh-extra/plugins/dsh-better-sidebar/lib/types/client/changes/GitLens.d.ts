import type { SessionScope } from '../api.ts';
import type { SidebarDiffRef, SidebarStore } from '../state.ts';
export interface GitLensProps {
    scope: SessionScope;
    /** The sidebar store: reads the `workspaceFence` pref (see the open guard below). */
    store: SidebarStore;
    onOpenFile: (path: string) => void;
    /** Preview one change in the shared bottom pane (worktree or commit ref). */
    onPreview: (ref: SidebarDiffRef) => void;
    /** The ref currently previewed (row highlight); null when the pane is closed. */
    selectedRef: SidebarDiffRef | null;
    /** Poll only while the tab is actually visible. */
    visible: boolean;
}
export declare function GitLens(props: GitLensProps): import("react").JSX.Element;
