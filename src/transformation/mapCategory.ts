import {
  IEntry,
  ISplit,
  IConfiguration,
  SplitGroup,
  CategoryMapping,
} from "../types";
import { StandardEntry } from "../entries/StandardEntry";
import { matchesMapping } from "../utils";

function mapUncategorized(mappings: CategoryMapping[], entry: StandardEntry) {
  for (const split of entry.splits) {
    if (split.account === "Uncategorized") {
      const match = mappings.find(([spec]) =>
        matchesMapping(spec, {
          payee: entry.payee,
          memo: split.memo || entry.memo,
        }),
      );
      if (match) {
        const [group, ...categories] = match[1].split(":");
        split.group = group as SplitGroup;
        split.account = categories.join(":").replace(/\{payee\}/g, entry.payee);
      }
    }
  }
  entry.splits.map((split) => {
    return split;
  });
}

export function mapCategory(
  config: IConfiguration,
  entries: IEntry[],
): IEntry[] {
  for (const e of entries) {
    mapUncategorized(config.mappings, e as StandardEntry);
  }
  return entries;
}
