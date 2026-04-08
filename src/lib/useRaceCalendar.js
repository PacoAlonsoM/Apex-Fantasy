import { useEffect, useState } from "react";
import { ACTIVE_CAL } from "@/src/constants/calendar";
import { mergeRaceCalendarRows } from "@/src/lib/raceCalendar";
import { supabase } from "@/src/lib/supabase";

const IGNORABLE_TABLE_ERRORS = [
  "relation \"public.race_calendar\" does not exist",
  "Could not find the table",
];

function isIgnorableCalendarError(error) {
  const message = String(error?.message || "");
  return IGNORABLE_TABLE_ERRORS.some((fragment) => message.includes(fragment));
}

export default function useRaceCalendar(season = 2026) {
  const [calendar, setCalendar] = useState(() => ACTIVE_CAL);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState("fallback");

  useEffect(() => {
    let ignore = false;

    async function loadCalendar() {
      setLoading(true);

      const { data, error } = await supabase
        .from("race_calendar")
        .select("*")
        .eq("season", season)
        .order("source_round_number", { ascending: true })
        .order("race_date", { ascending: true });

      if (ignore) return;

      if (error) {
        if (!isIgnorableCalendarError(error)) {
          console.warn("race_calendar fallback:", error);
        }
        setCalendar(ACTIVE_CAL);
        setSource("fallback");
        setLoading(false);
        return;
      }

      if (Array.isArray(data) && data.length) {
        const merged = mergeRaceCalendarRows(data);
        if (merged.length) {
          setCalendar(merged);
          setSource("supabase");
        } else {
          setCalendar(ACTIVE_CAL);
          setSource("fallback");
        }
      } else {
        setCalendar(ACTIVE_CAL);
        setSource("fallback");
      }

      setLoading(false);
    }

    loadCalendar();
    return () => {
      ignore = true;
    };
  }, [season]);

  return { calendar, loading, source };
}
