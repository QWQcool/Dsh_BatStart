import { type SidebarSnapshot, type SidebarStore, type SplitNode } from '../state.ts';
import type { WorkbenchActions } from '../split-pane.tsx';
export declare function usePinnedTabs(input: {
    store: SidebarStore;
    sessionId: string | undefined;
    cwd: string | undefined;
    snapshot: SidebarSnapshot;
    actions: WorkbenchActions;
}): {
    augmentedTree: SplitNode | undefined;
    wrappedActions: WorkbenchActions;
};
