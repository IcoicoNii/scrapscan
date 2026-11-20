"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { formatPoints } from "@/lib/format";
import { RewardForm } from "./reward-forms";

type CatalogueReward = {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  stock: number | null;
  imageUrl: string | null;
  active: boolean;
};

/** Admin reward list with a dropdown that opens and scrolls to one reward. Type-to-find works inside the select. */
export function RewardCatalogue({ rewards }: { rewards: CatalogueReward[] }) {
  const cards = useRef<Record<string, HTMLDetailsElement | null>>({});
  const [chosen, setChosen] = useState("");

  function jumpTo(id: string) {
    setChosen(id);
    const card = cards.current[id];
    if (!card) return;
    card.open = true;
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="reward-jump" className="mb-1 block text-sm font-semibold">
          Find a reward
        </label>
        <select id="reward-jump" value={chosen} onChange={(e) => jumpTo(e.target.value)} className="field-box">
          <option value="">Choose a reward…</option>
          {rewards.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
              {r.active ? "" : " (hidden)"}
            </option>
          ))}
        </select>
      </div>

      <ul className="space-y-4">
        {rewards.map((r) => (
          <li key={r.id} className="card">
            <details id={`reward-${r.id}`} ref={(el) => { cards.current[r.id] = el; }} className="scroll-mt-4">
              <summary className="flex cursor-pointer list-none flex-col gap-4 sm:flex-row sm:items-stretch [&::-webkit-details-marker]:hidden">
                <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-line-soft sm:aspect-auto sm:h-36 sm:w-56">
                  {r.imageUrl ? (
                    <Image src={r.imageUrl} alt={r.name} fill sizes="(min-width: 640px) 224px, 100vw" className="object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-slate-green">
                      <Icon name="gift" className="h-12 w-12" />
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                  <p className="text-lg font-bold">
                    {r.name}
                    {!r.active && <span className="ml-2 text-xs font-bold text-danger">Hidden</span>}
                  </p>
                  <p className="text-sm text-slate-green">
                    {formatPoints(r.pointsCost)} pts · {r.stock === null ? "no stock limit" : `${r.stock} left`}
                  </p>
                </div>
              </summary>
              <div className="mt-4 border-t border-line-soft pt-4">
                <RewardForm reward={r} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
