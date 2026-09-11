import type { SidebarStore } from './state.ts';
import type { OpenWithTarget } from './open-with.ts';
export declare function TreePanel(props: {
    sessionId: string;
    cwd: string | undefined;
    /** The sidebar store (passed through to the tree's fence-refusal notice). */
    store: SidebarStore;
    expanded: string[];
    revealed: string[];
    onToggle: (path: string) => void;
    onOpenFile: (path: string) => void;
    /** File context-menu "open in a new tab" (passed through to FileTree). */
    onOpenFileNewTab?: (path: string) => void;
    /** File context-menu "open to the side" (passed through to FileTree). */
    onOpenFileSide?: (path: string) => void;
    /** The "open with" menu surface (passed through to FileTree; absent →
     *  the whole section is hidden). */
    openWithTargets?: OpenWithTarget[];
    openWithPinned?: string[];
    openWithSsh?: boolean;
    onOpenWith?: (targetId: string, path: string) => void;
    onToggleOpenWithPin?: (targetId: string) => void;
    onReferenceFile: (path: string, isDir: boolean) => void;
    /** A tree rename landed (passed through to FileTree for tab retargeting). */
    onPathRenamed?: (oldPath: string, newPath: string) => void;
    /** A tree delete landed (passed through to FileTree for tab closing). */
    onPathDeleted?: (path: string, isDir: boolean) => void;
    /** Full-window presentation: the panel fills its host instead of docking
     *  at a fixed width. */
    full?: boolean;
}): import("react").JSX.Element;
