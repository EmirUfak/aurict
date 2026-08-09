import React, { useEffect, useRef, useState } from 'react';
import type { ExperienceLayout, SidecarStatus, UserType } from '../../shared/ipc-types.js';
import { navigationFor, type Screen } from '../experience/navigation.js';

export type { Screen } from '../experience/navigation.js';

interface Props {
  screen: Screen;
  onNavigate: (screen: Screen) => void;
  workdir: string;
  onChooseWorkdir: () => Promise<unknown>;
  userType: UserType;
  layout: ExperienceLayout;
}

export function Titlebar({ screen, onNavigate, workdir, onChooseWorkdir, userType, layout }: Props) {
  const [status, setStatus] = useState<SidecarStatus>({ connected: false, message: 'connecting' });
  const [compactNav, setCompactNav] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close the More menu when clicking anywhere outside it (the menu button
  // itself already toggles it via onClick, so we only need to handle
  // "elsewhere" clicks here).
  useEffect(() => {
    if (!moreOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moreOpen]);

  useEffect(() => {
    void window.aurict.runtime.getStatus().then(setStatus).catch((error) => setStatus({ connected: false, message: String(error) }));
    return window.aurict.runtime.onStatus(setStatus);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1040px)');
    const update = () => { setCompactNav(media.matches); if (!media.matches) setMoreOpen(false); };
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const navigation = navigationFor(userType);
  const primaryNavigation = compactNav ? navigation.slice(0, 3) : navigation;
  const overflowNavigation = compactNav ? navigation.slice(3) : [];

  return (
    <div
      className="aur-titlebar"
      data-layout={layout}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="aur-titlebar-left" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        {/* Only the traffic dots need no-drag — the container itself and the
          logo area are draggable, so the empty space after the logo (before
          hitting the nav column) is usable for dragging too. */}
        <div style={{ display: 'flex', gap: 7, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <TrafficDot label="Close window" color="var(--titlebar-control)" hoverColor="var(--danger)" onClick={() => window.aurict.window.close()} />
          <TrafficDot label="Minimize window" color="var(--titlebar-control)" hoverColor="var(--warning)" onClick={() => window.aurict.window.minimize()} />
          <TrafficDot label="Maximize or restore window" color="var(--titlebar-control)" hoverColor="var(--accent)" onClick={() => window.aurict.window.maximize()} />
        </div>
        <div style={{ width: 1, height: 16, background: 'var(--border-strong)', margin: '0 4px' }} />
        <div className="aur-hoprel-lockup" style={{ display: 'flex', alignItems: 'center', gap: 7, WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <img alt="" src="/hoprel-icon.svg" style={{ width: 25, height: 25, borderRadius: 7 }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 600, color: 'var(--titlebar-text)', letterSpacing: '-.025em' }}>hoprel</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--titlebar-muted)', letterSpacing: '.02em' }}>by aurict</span>
          </div>
        </div>
      </div>

      {/* overflow toggles to 'visible' while the More menu is open — the base
        overflow:hidden (in theme.css) clips nav buttons that exceed
        max-width, but it was also clipping the absolutely-positioned
        dropdown. Toggling it only while open avoids any other regression. */}
      <div
        className="aur-titlebar-nav"
        style={{ WebkitAppRegion: 'no-drag', overflow: moreOpen ? 'visible' : 'hidden' } as React.CSSProperties}>
        {primaryNavigation.map((item) => (
          <button
            key={item.id}
            aria-current={screen === item.id ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11.5,
              fontWeight: 600,
              padding: '6px 14px',
              border: 'none',
              borderRadius: 5,
              cursor: 'pointer',
              background: screen === item.id ? 'var(--bg-card)' : 'transparent',
              color: screen === item.id ? 'var(--text)' : 'var(--titlebar-muted)',
            }}
          >
            {item.label}
          </button>
        ))}
        {overflowNavigation.length > 0 && <div className="aur-titlebar-more" ref={moreMenuRef}>
          <button type="button" aria-expanded={moreOpen} aria-haspopup="menu" onClick={() => setMoreOpen((open) => !open)} style={navButtonStyle(false)}>More</button>
          {moreOpen && <div role="menu" className="aur-titlebar-more-menu">{overflowNavigation.map((item) => <button key={item.id} type="button" role="menuitem" aria-current={screen === item.id ? 'page' : undefined} onClick={() => { onNavigate(item.id); setMoreOpen(false); }}>{item.label}</button>)}</div>}
        </div>}
      </div>

      {/* Container is draggable; only the workdir button and retry button
        (the actual interactive elements) opt out with no-drag. The
        connection status text/dot has no onClick, so it's fine for it to
        inherit drag from this container. */}
      <div className="aur-titlebar-status" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <button
          className="aur-titlebar-workdir"
          onClick={() => { void onChooseWorkdir().catch((reason) => console.error('Workspace selection failed', reason)); }}
          title="Choose workspace"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11.5,
            color: 'var(--titlebar-muted)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            maxWidth: 280,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            // direction:rtl + textAlign:left flips which end gets the ellipsis:
            // truncates from the START of the path instead of the end, so the
            // most useful part (the project folder name) stays visible instead
            // of being cut off in favor of the less useful drive/user prefix.
            direction: 'rtl',
            textAlign: 'left',
            WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {workdir}
        </button>
        <div className="aur-titlebar-connection" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={status.connected ? 'aur-pulse' : undefined} style={{ width: 6, height: 6, borderRadius: '50%', background: status.connected ? 'var(--safe)' : 'var(--danger)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--titlebar-muted)' }}>
            {status.connected ? 'connected' : status.message ?? 'disconnected'}
          </span>
          {/* Don't setStatus from retry()'s own return value — it's a
            synchronous snapshot taken before the sidecar actually finishes
            restarting, and can race with (and overwrite) the correct
            'connected' state pushed later via onStatus. Fire-and-forget and
            let the existing onStatus subscription handle the UI update. */}
          {!status.connected && <button className="aur-titlebar-retry" type="button" onClick={() => { void window.aurict.runtime.retry(); }} style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>retry</button>}
        </div>
      </div>
    </div>
  );
}

function navButtonStyle(active: boolean): React.CSSProperties { return { fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600, padding: '6px 14px', border: 'none', borderRadius: 5, cursor: 'pointer', background: active ? 'var(--bg-card)' : 'transparent', color: active ? 'var(--text)' : 'var(--titlebar-muted)' }; }

/* Exported so WindowChrome.tsx can reuse the same close/minimize/maximize
  buttons on screens that render before this Titlebar mounts (onboarding,
  loading, and error states — see WindowChrome.tsx). */
export function TrafficDot({ label, color, hoverColor, onClick }: { label: string; color: string; hoverColor: string; onClick: () => void }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 12, minWidth: 12,
        height: 12, minHeight: 12, flexShrink: 0,
        appearance: 'none', display: 'block', lineHeight: 0,
        border: 'none', borderRadius: '50%', padding: 0,
        background: hover ? hoverColor : color,
        cursor: 'pointer',
        transition: 'background .15s',
      }}
    />
  );
}
