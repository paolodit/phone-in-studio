import type { BroadcastSnapshot } from "@/lib/public-show";
import { broadcastPresentation, silentBands } from "@/lib/broadcast-presentation";

export type BroadcastLayout = "web" | "tiktok" | "twitch";

/** Pure presentation shared by live output and the isolated layout preview.
 * Sizing is relative to the pane, never to the surrounding app or webcam. */
export function BroadcastStage({ snapshot, mode, layout, audioBands = silentBands, hasSignal = false }: {
  snapshot: BroadcastSnapshot; mode: "full" | "overlay"; layout: BroadcastLayout; audioBands?: number[]; hasSignal?: boolean;
}) {
  const state = broadcastPresentation(snapshot.broadcastState);
  const caller = state.showCaller ? snapshot.caller : null;
  const visual = mode === "full" ? caller?.visual : null;
  return <section className="broadcast-stage" data-layout={layout} data-mode={mode} data-visual={!!visual} aria-label="Broadcast presentation">
    <div className="broadcast-surface">
      {visual && <figure className="broadcast-visual" key={visual.url}>
        <img src={visual.url} alt="" className="broadcast-visual-image" />
        <div className="broadcast-visual-shade" />
        {visual.creditText && <figcaption className="broadcast-credit">{visual.creditUrl ? <a href={visual.creditUrl} target="_blank" rel="noreferrer">{visual.creditText}</a> : visual.creditText}</figcaption>}
      </figure>}
      <header className="broadcast-header"><div className="broadcast-show-title"><p className="broadcast-eyebrow">LIVE PHONE-IN</p><h1>{snapshot.title}</h1></div><span className="broadcast-state" data-live={state.live}><i aria-hidden="true" />{state.stateLabel}</span></header>
      <div className="broadcast-body">
        {caller ? <article className="broadcast-caller" key={`${caller.name}:${caller.issueHeadline}`}>
          <div className="broadcast-portrait">{caller.portraitUrl ? <img src={caller.portraitUrl} alt="" /> : <span>{caller.name.slice(0, 1)}</span>}
            {state.live && <div className="broadcast-equalizer" data-active={hasSignal} aria-label="Live caller audio equalizer">{audioBands.map((band, index) => <i key={index} style={{ transform: `scaleY(${Math.max(.08, Math.min(1, Math.pow(band, .65) * 1.4))})` }} />)}</div>}
          </div>
          <div className="broadcast-card"><p className="broadcast-eyebrow">{state.kicker}</p><h2>{caller.name}</h2><p className="broadcast-identity">{caller.location}{caller.occupation ? ` · ${caller.occupation}` : ""}</p><p className="broadcast-headline">{caller.issueHeadline}</p><p className="broadcast-summary">{caller.openingSummary}</p></div>
        </article> : <div className="broadcast-idle"><p className="broadcast-eyebrow">{state.stateLabel}</p><h2>{state.idleHeadline}</h2><p>{snapshot.broadcastState === "SHOW_BREAK" ? "The phone-in continues shortly." : snapshot.title}</p></div>}
      </div>
    </div>
  </section>;
}
