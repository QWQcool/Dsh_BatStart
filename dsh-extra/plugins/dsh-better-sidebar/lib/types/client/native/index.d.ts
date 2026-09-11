/**
 * The plugin's content, registered into DSH's native right Sidebar.
 *
 * Every tab the plugin can draw becomes a native tab TYPE plus a BODY:
 *
 * - the `editor` type is both a page (the files window) and a resource
 *   viewer — it claims `dsh-resource://file/**` at the default `extension`
 *   band, which outranks the built-in `text` preview (`fallback`) and the
 *   built-in `files` tree (`builtin`), so every file the product opens lands
 *   in the plugin's editor;
 * - the built-in `files` page kind is TAKEN OVER by an `extension`
 *   registration of the same kind, so `openTab('files')` draws the plugin's
 *   explorer instead of the built-in tree; the built-in resumes when this
 *   plugin unregisters;
 * - every other descriptor (changes / subagent / side chat / terminal /
 *   browser / diff) becomes a page type of its own.
 *
 * The registrations follow the plugin's registry lifecycle: a descriptor
 * registered later (an external plugin) gets its native type too, and a type
 * the user disabled in the side-card settings is unregistered — so it is
 * absent from the native guide and `openTab` refuses it.
 */
import type { Context } from '../../context-types.ts';
import type { BetterSidebarService } from '../service.ts';
import type { SidebarStore } from '../state.ts';
import { type NativeTabRecords } from './tab-adapter.tsx';
/** Everything the registrations need. */
export interface NativeSurfaceDeps {
    readonly ctx: Context;
    readonly store: SidebarStore;
    readonly service: BetterSidebarService;
    /** The shared native tab record registry (the surface writes it too). */
    readonly records: NativeTabRecords;
}
/**
 * Register the plugin's tabs into the native right Sidebar and keep them in
 * step with the plugin's own registry and settings.
 * @param deps - client context, the plugin store/service, and the records.
 * @returns a disposer unregistering everything.
 */
export declare function registerNativeSurface(deps: NativeSurfaceDeps): () => void;
export type { NativeTabRecords };
