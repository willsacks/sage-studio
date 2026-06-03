import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProcessGameView } from "@/components/process-game/ProcessGameView";

export const metadata: Metadata = { title: "Process Game" };

export type GameCell = {
  position: number;
  label: string | null;
  color: string | null;
};

export type Program = {
  id: string;
  name: string;
  total_spots: number;
  color: string;
  position: number;
};

export type Spot = {
  program_id: string;
  position: number;
  label: string | null;
  color: string | null;
};

export default async function ProcessGamePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const [{ data: cellsRaw }, { data: programsRaw }, { data: spotsRaw }] = await Promise.all([
    db.from("process_game_cells").select("position, label, color").eq("user_id", user.id),
    db.from("process_game_programs").select("id, name, total_spots, color, position").eq("user_id", user.id).order("position", { ascending: true }),
    db.from("process_game_spots").select("program_id, position, label, color").eq("user_id", user.id),
  ]);

  const cellMap: Record<number, GameCell> = {};
  for (const c of (cellsRaw ?? []) as GameCell[]) {
    cellMap[c.position] = c;
  }

  const programs = (programsRaw ?? []) as Program[];

  const spotMap: Record<string, Record<number, Spot>> = {};
  for (const s of (spotsRaw ?? []) as Spot[]) {
    (spotMap[s.program_id] ??= {})[s.position] = s;
  }

  return <ProcessGameView cells={cellMap} programs={programs} spotMap={spotMap} />;
}
