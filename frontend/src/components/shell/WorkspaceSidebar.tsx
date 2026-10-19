"use client";
/**
 * Plan 11 Task 3 — the shared desktop sidebar primitive (brief §4.1,
 * frozen navigation contract). One component serves Student, Teacher,
 * and Admin: role shells pass their own items; geometry is shared.
 *
 * Contract rules implemented here:
 * - the sidebar is visually quieter than the content (surface step
 *   down, muted links);
 * - exactly ONE item per nav landmark carries `aria-current="page"`
 *   ("/" matches exactly so the dashboard is never active elsewhere);
 * - items are real links in standard tab order (no JS activation).
 *
 * Hidden below 64rem by CSS (medium band keeps the horizontal top
 * nav; narrow band uses the student bottom nav or staff menu sheet).
 *
 * Defect #3 (QA 2026-09-30) adds two GEOMETRY-only affordances on top
 * of that contract — the nav items themselves stay real links:
 * - a collapse toggle (brand row) that swaps the rail to an icon rail;
 * - a right-edge resizer: pointer drag, or the keyboard equivalent
 *   (role="separator" with Arrow/Home/End stepping, the WAI-ARIA
 *   window-splitter pattern) for the same pixel range.
 * The preference (collapsed flag + expanded width) is non-secret UI
 * state in localStorage (lib/sidebarPreference.ts), applied AFTER
 * mount so SSR markup never depends on it; there is no width
 * transition either way (motion contract: transform/opacity only).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { BrandMark } from "./BrandMark";
import { navItemActive } from "./navigationMatch";
export { navItemActive } from "./navigationMatch";
import { PanelCollapseIcon, PanelExpandIcon } from "./navIcons";
import {
  clampRailWidth,
  RAIL_WIDTH_ADMIN_DEFAULT_PX,
  RAIL_WIDTH_DEFAULT_PX,
  RAIL_WIDTH_MAX_PX,
  RAIL_WIDTH_MIN_PX,
  readSidebarPreference,
  safeLocalStorage,
  writeSidebarPreference,
  type SidebarPreference,
} from "@/lib/sidebarPreference";

export interface SideNavItem {
  href: string;
  label: string;
  icon?: ReactNode;
  /** A separate workspace may live below this item's URL prefix. */
  exclude?: readonly string[];
}

export interface SideNavGroup {
  /** Landmark name for assistive tech; also groups the links visually. */
  label: string;
  items: readonly SideNavItem[];
}

/** Keyboard step for the resizer (a deliberate nudge, not a pixel). */
const RESIZE_KEY_STEP_PX = 16;

export function WorkspaceSidebar({
  brand,
  groups,
  footer,
  workspaceCaption,
  density = workspaceCaption ? "compact" : "normal",
  defaultWidthPx = RAIL_WIDTH_DEFAULT_PX,
}: {
  brand: { href: string; label: string };
  groups: readonly SideNavGroup[];
  footer?: ReactNode;
  workspaceCaption?: string;
  density?: "normal" | "compact";
  defaultWidthPx?: typeof RAIL_WIDTH_DEFAULT_PX | typeof RAIL_WIDTH_ADMIN_DEFAULT_PX;
}) {
  const pathname = usePathname();
  // SSR and the first client render agree on the defaults; the stored
  // preference is applied in the mount effect (post-hydration), and
  // hydration itself never reads localStorage.
  const [pref, setPref] = useState<SidebarPreference>(() => ({ collapsed: false, widthPx: defaultWidthPx }));
  const dragStart = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);

  // Load once after mount; a missing/corrupt entry keeps the defaults.
  // Deferred a microtask so the effect body stays free of synchronous
  // setState (react-hooks/set-state-in-effect) — the session.ts
  // precedent; the cancelled flag fences an unmount inside the gap.
  useEffect(() => {
    const storage = safeLocalStorage();
    const stored = storage === null ? null : readSidebarPreference(storage);
    if (stored === null) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (!cancelled) {
        setPref(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Mirror the geometry into the --rail-width token the shell grid
  // consumes. Collapsed resolves THROUGH the collapsed token so the
  // icon-rail width stays rem-based (it scales with the user's font
  // size even though the drag itself works in screen pixels). At the
  // Contextual default uses its rem token instead of a fixed pixel
  // override. A saved former-default232 remains an explicit preference.
  // The rem-based CSS default keeps serving users
  // whose root font differs from 16px (reviewer P3, PR #19).
  useEffect(() => {
    const rootStyle = document.documentElement.style;
    if (pref.collapsed) {
      rootStyle.setProperty("--rail-width", "var(--rail-width-collapsed)");
    } else if (pref.widthPx === defaultWidthPx) {
      if (defaultWidthPx === RAIL_WIDTH_ADMIN_DEFAULT_PX) rootStyle.setProperty("--rail-width", "var(--rail-width-admin)");
      else rootStyle.removeProperty("--rail-width");
    } else {
      rootStyle.setProperty("--rail-width", `${pref.widthPx}px`);
    }
    return () => { rootStyle.removeProperty("--rail-width"); };
  }, [pref, defaultWidthPx]);

  /** Every user-initiated change: state + explicit persist (no write
   * effect — mount/default reloads must not create a preference). */
  const updatePref = useCallback((next: SidebarPreference) => {
    setPref(next);
    const storage = safeLocalStorage();
    if (storage !== null) {
      writeSidebarPreference(storage, next);
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    updatePref({ ...pref, collapsed: !pref.collapsed });
  }, [pref, updatePref]);

  // --- resizer: pointer drag (capture keeps events on the handle) ---
  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      // Mouse only: suppress the native text-selection drag that would
      // otherwise highlight the rail while resizing (S3, PR #19 r4).
      // Keyboard users reach the handle through Tab, not pointer clicks.
      if (event.pointerType === "mouse") {
        event.preventDefault();
      }
      dragStart.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: pref.widthPx,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [pref.widthPx],
  );

  const onResizePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragStart.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      const next = clampRailWidth(drag.startWidth + event.clientX - drag.startX);
      // Compare INSIDE the updater (reviewer B, PR #19): a closure
      // comparison against a possibly-stale render misses the final
      // move when the pointer returns to the batch's starting width;
      // returning the same reference lets React bail out of the
      // no-op re-render instead.
      setPref((current) =>
        current.widthPx === next ? current : { ...current, widthPx: next },
      );
    },
    [],
  );

  const endResizeDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragStart.current;
      if (drag === null || drag.pointerId !== event.pointerId) return;
      dragStart.current = null;
      // Persist the settled width once, at drag end (not per move).
      const storage = safeLocalStorage();
      if (storage !== null) {
        writeSidebarPreference(storage, pref);
      }
    },
    [pref],
  );

  // --- resizer: keyboard equivalent (WAI-ARIA window splitter) ---
  const onResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      // APG splitter pattern: chorded keys stay with the BROWSER —
      // swallowing Alt+Left (history back) or Ctrl+Home (page top)
      // into width steps would break standard shortcuts (M1, r4).
      if (event.altKey || event.metaKey || event.ctrlKey) {
        return;
      }
      let next: number;
      switch (event.key) {
        // A vertical splitter owns Left/Right ONLY (APG): Up/Down keep
        // their native scroll meaning, matching the tooltip copy.
        case "ArrowLeft":
          next = pref.widthPx - RESIZE_KEY_STEP_PX;
          break;
        case "ArrowRight":
          next = pref.widthPx + RESIZE_KEY_STEP_PX;
          break;
        case "Home":
          next = RAIL_WIDTH_MIN_PX;
          break;
        case "End":
          next = RAIL_WIDTH_MAX_PX;
          break;
        default:
          return;
      }
      event.preventDefault();
      updatePref({ ...pref, widthPx: clampRailWidth(next) });
    },
    [pref, updatePref],
  );

  return (
    <aside
      className="app-sidebar"
      id="app-sidebar-rail"
      data-collapsed={pref.collapsed ? "true" : "false"}
      data-density={density}
      data-captioned={workspaceCaption ? "true" : "false"}
      data-workspace={defaultWidthPx === RAIL_WIDTH_ADMIN_DEFAULT_PX ? "admin" : "ordinary"}
    >
      <div className="app-sidebar-identity">
      <div className="app-sidebar-brandbar">
        <Link
          className="app-sidebar-brand"
          href={brand.href}
          title={pref.collapsed ? brand.label : undefined}
        >
          <BrandMark />
          <span className="app-sidebar-brand-name">{brand.label}</span>
        </Link>
        <button
          type="button"
          className="rail-toggle"
          onClick={toggleCollapsed}
          aria-expanded={!pref.collapsed}
          aria-controls="app-sidebar-rail"
          aria-label={pref.collapsed ? "展开侧边栏" : "收起侧边栏"}
          title={pref.collapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          {pref.collapsed ? <PanelExpandIcon /> : <PanelCollapseIcon />}
        </button>
      </div>
      {workspaceCaption ? <p className="app-sidebar-workspace">{workspaceCaption}</p> : null}
      </div>
      {groups.map((group) => (
        <nav key={group.label} className="side-nav" aria-label={group.label}>
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={navItemActive(pathname, item.href, item.exclude) ? "page" : undefined}
              title={pref.collapsed ? item.label : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      ))}
      {footer !== undefined && <div className="app-sidebar-footer">{footer}</div>}
      <div
        className="rail-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label="调整侧边栏宽度"
        title="拖动或用左右方向键调整宽度"
        tabIndex={0}
        aria-valuemin={RAIL_WIDTH_MIN_PX}
        aria-valuemax={RAIL_WIDTH_MAX_PX}
        aria-valuenow={pref.widthPx}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={endResizeDrag}
        onPointerCancel={endResizeDrag}
        onKeyDown={onResizeKeyDown}
      />
    </aside>
  );
}

const APPROVED_NAV_SHAPES = {
  home: <><path d="m3 10 9-7 9 7v10H5V10m4 10v-7h6v7" /></>,
  tasks: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3h6v4H9zM9 12h6m-6 4h6" /></>,
  innovation: <><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5" /></>,
  rankings: <><path d="M5 20v-7h4v7m2 0V4h4v16m2 0v-10h4v10" /></>,
  rewards: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v9h14v-9M12 8v13M12 8C5 8 5 2 8 3s4 5 4 5Zm0 0c7 0 7-6 4-5s-4 5-4 5Z" /></>,
  notifications: <><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3Zm5 3h4" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-8 16-8 16 0" /></>,
  teacherReviews: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="m8 12 3 3 5-6" /></>,
  teacherTasks: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3h6v4H9zM9 12h6m-6 4h6" /></>,
  adminUsers: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-8 16-8 16 0" /></>,
  adminOperations: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
  adminQualification: <><path d="M12 3 3 7v6c0 4 9 8 9 8s9-4 9-8V7L12 3Z" /><path d="m8 12 3 3 5-6" /></>,
  adminWhitelist: <><path d="M7 4h12v17H5V6m4 3h6m-6 4h6m-6 4h4" /></>,
  adminRewards: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v9h14v-9M12 8v13M12 8C5 8 5 2 8 3s4 5 4 5Zm0 0c7 0 7-6 4-5s-4 5-4 5Z" /></>,
  adminRedemptions: <><path d="M3 7h16m-4-4 4 4-4 4M21 17H5m4-4-4 4 4 4" /></>,
  adminAudit: <><path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M9 12h6m-6 4h6" /></>,
  adminSystem: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="2" /><circle cx="16" cy="12" r="2" /><circle cx="10" cy="18" r="2" /></>,
  mentorProfile: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-8 16-8 16 0" /></>,
  mentorProjects: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3h6v4H9zM9 12h6m-6 4h6" /></>,
  mentorDirectory: <><circle cx="8" cy="7" r="3" /><circle cx="17" cy="8" r="3" /><path d="M2 20c0-8 12-8 12 0m0-7c4-2 8 1 8 7" /></>,
} as const;

/** Navigation geometry copied from the approved R5-inclusive source. */
export function ApprovedNavIcon({ name }: { name: keyof typeof APPROVED_NAV_SHAPES }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{APPROVED_NAV_SHAPES[name]}</svg>;
}
