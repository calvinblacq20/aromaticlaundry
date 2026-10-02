import { Navigation } from "lucide-react";
import { useState } from "react";
import { SHOP } from "../data/business";
import { mapsLinks } from "../lib/contact";
import { Photo } from "./Bits";
import { AppIcon } from "./Brand";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

/**
 * Where the shop is: a photo of West Hills Mall with the shop's pin on it, rather than map tiles,
 * so it stays light on slow connections and shows people the building they're looking for.
 */
export function MapCard() {
  const [open, setOpen] = useState(false);
  const links = mapsLinks(SHOP.mapsQuery);
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div className="map">
        <Photo tone="sky" src="/photos/west-hills-mall.webp" alt="The entrance to West Hills Mall on the Kasoa road at Weija" position="center 55%" sizes="(min-width: 1024px) 400px, 100vw" height={168} radius={0} markSize={60} />
        <div className="map-pin" aria-hidden="true">
          <AppIcon size={40} />
          <span className="map-pin-stem" />
        </div>
        <span className="map-credit">Photo: Fquasie, CC BY-SA 4.0</span>
      </div>
      <div className="card-pad stack gap-8">
        <p className="t-title">{SHOP.area}</p>
        <p className="muted">{SHOP.directions}</p>
        <div>
          <Button size="sm" icon={<Navigation size={16} />} onClick={() => setOpen(true)}>
            Get directions
          </Button>
        </div>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Get directions">
        <div className="stack gap-12">
          <a className="btn btn-outline btn-block" href={links.google} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
            Open in Google Maps
          </a>
          <a className="btn btn-outline btn-block" href={links.apple} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
            Open in Apple Maps
          </a>
        </div>
      </Sheet>
    </div>
  );
}
