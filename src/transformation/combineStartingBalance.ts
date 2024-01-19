import { StandardEntry } from "../entries/StandardEntry";
import { IEntry, IConfiguration, SplitGroup } from "../types";
import { partition, groupBy, splitName } from "../utils";

export function combineStartingBalance(
  config: IConfiguration,
  entries: IEntry[],
) {
  const [startingBalances, remainder] = partition(
    entries,
    (t) => (t as StandardEntry).payee === "Starting Balance",
  );
  const combined = startingBalances.reduce((combined, t) => {
    combined.splits.push(t.splits.find((s) => s.group !== SplitGroup.Expenses));
    return combined;
  });
  combined.splits = [
    ...combined.splits
      .filter((s) => s.group !== SplitGroup.Expenses)
      .sort((a, b) => splitName(a).localeCompare(splitName(b))),
    {
      group: SplitGroup.Equity,
      amount: null,
      account: "Starting Balances",
      memo: null,
    },
  ];

  return [combined, ...remainder];
}

export function combinePayroll(config: IConfiguration, entries: IEntry[]) {
  const { __remainder__: remainder, ...payrolls } = groupBy(
    entries,
    (e) =>
      ((e as StandardEntry).payee !== "Starting Balance" &&
        e.splits.find((s) => s.account.includes("Payroll"))?.account) ||
      "__remainder__",
  );
  let grouped = Object.entries(payrolls)
    .map(([payroll, entries]) =>
      Object.values(groupBy(entries, (e) => e.recordDate)).map(
        (dateEntries) => {
          const firstEntry = dateEntries[0] as StandardEntry;
          return dateEntries.reduce(
            (combined, entry) => {
              combined.splits = combined.splits.concat(
                entry.splits.map((s) => ({ ...s, memo: s.memo || entry.memo })),
              );
              return combined;
            },
            new StandardEntry({
              ...firstEntry,
              memo: "Combined payroll",
              payee: payroll.split(":").slice(-2).reverse().join(" "),
              splits: [],
            }),
          );
        },
      ),
    )
    .flat();

  if (true) {
    grouped = grouped.map((e) => {
      const splits = groupBy(e.splits, (s) => splitName(s));
      e.splits = Object.entries(splits)
        .map(([account, splits]) => {
          if (account.includes("Payroll")) {
            return [];
          }
          if (account.startsWith("Income:")) {
            return [
              splits.reduce((acc, entry) => ({
                ...acc,
                amount: acc.amount + entry.amount,
              })),
            ];
          }
          return splits;
        })
        .flat();
      return e;
    });
  }

  return [...grouped, ...remainder];
}
