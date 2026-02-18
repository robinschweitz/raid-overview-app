import React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  getExpandedRowModel,
} from "@tanstack/react-table";

import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
} from "@tanstack/react-table";

import icc_items from "./data/items.json";

type IccItem = { name_dede: string; quality: number; icon: string };
const items = icc_items as Record<string, IccItem>;

type ItemInfo = {
  id: number;
  icon: string;
};

// const items = (icc_items as any).default ?? icc_items;

const norm = (s: string) =>
  s.toLowerCase().replaceAll("’", "'").trim();

const nameToItem: Record<string, ItemInfo> = {};

for (const [id, item] of Object.entries(items)) {
  if (!item?.name_dede) continue;

  nameToItem[norm(item.name_dede)] = {
    id: Number(id),
    icon: item.icon,
  };
}

type LootRow = {
  raidId?: string;
  date?: string;
  boss?: string;
  item: string;
  character: string;
  priority: string;
};

function uniqSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

export function RaidLootTable({
    data,
    hiddenColumns = [],
  }: {
    data: LootRow[];
    hiddenColumns?: string[];
  }) {
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState({});
  const [expanded, setExpanded] = React.useState({});

  const bosses = React.useMemo(
    () =>
      uniqSorted(
        data
          .map((d) => d.boss)
          .filter((b): b is string => Boolean(b))
      ),
    [data]
  );
  const priorities = React.useMemo(
    () => uniqSorted(data.map((d) => d.priority)),
    [data]
  );

  React.useEffect(() => {
    const visibility: Record<string, boolean> = {};

    hiddenColumns.forEach((col) => {
      visibility[col] = false;
    });

    setColumnVisibility(visibility);
  }, [hiddenColumns]);

  const columns = React.useMemo<ColumnDef<LootRow>[]>(() => {
    const base: ColumnDef<LootRow>[] = [];

    if (data.some(d => d.raidId)) {
        base.push({
        accessorKey: "raidId",
        header: "Raid",
        });
    }

    if (data.some(d => d.date)) {
        base.push({
        accessorKey: "date",
        header: "Datum",
        });
    }

    if (data.some(d => d.boss)) {
        base.push({
        accessorKey: "boss",
        header: "Boss",
        enableColumnFilter: true,
        });
    }

    base.push(
        {
        accessorKey: "item",
        header: "Item",
        },
        {
        accessorKey: "character",
        header: "Charakter",
        },
        {
        accessorKey: "priority",
        header: "Zuweisung",
        enableColumnFilter: true,
        }
    );

    return base;
  }, [data]);

  const table = useReactTable({
    data,
    columns,
    state: {
      globalFilter,
      sorting,
      columnFilters,
      columnVisibility,
      expanded,
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: "includesString",
    onExpandedChange: setExpanded,
    getExpandedRowModel: getExpandedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Helpers for dropdown filters
  const bossCol = table.getColumn("boss");
  const prioCol = table.getColumn("priority");

  const isBossVisible = bossCol?.getIsVisible();
  // const isPriorityVisible = prioCol?.getIsVisible();

  return (
    <div className="loot-table-container">
      {/* Filters Row */}
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <input
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Search (item, charakter, ...)"
          style={{ padding: 8, minWidth: 260 }}
        />

        {isBossVisible && (
          <select
            value={(bossCol?.getFilterValue() as string) ?? ""}
            onChange={(e) =>
              bossCol?.setFilterValue(e.target.value || undefined)
            }
            style={{ padding: 8 }}
          >
            <option value="">All Bosses</option>
            {bosses.map((b: string) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        )}

        <select
          value={(prioCol?.getFilterValue() as string) ?? ""}
          onChange={(e) => prioCol?.setFilterValue(e.target.value || undefined)}
          style={{ padding: 8 }}
        >
          <option value="">Alle Zuweisungsarten</option>
          {priorities.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            setGlobalFilter("");
            setColumnFilters([]);
            table.resetSorting();
          }}
          style={{ padding: "8px 10px" }}
        >
          Reset
        </button>
      </div>

      {/* Table */}
      <table className="loot-table">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  style={{
                    cursor: header.column.getCanSort() ? "pointer" : "default",
                  }}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                  {header.column.getIsSorted() === "asc" && " ▲"}
                  {header.column.getIsSorted() === "desc" && " ▼"}
                </th>
              ))}
            </tr>
          ))}
        </thead>

        <tbody>
          {table.getRowModel().rows.map((row) => (
            <React.Fragment key={row.id}>
            <tr
              onClick={() => row.toggleExpanded()}
              style={{ cursor: "pointer" }}
            >
            {/* <tr key={row.id}> */}
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={cell.column.id === "item" ? "loot-item-cell" : ""}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
            {row.getIsExpanded() && (
            <tr>
              <td colSpan={row.getVisibleCells().length}>
                <div style={{ padding: 12, background: "#1e1e1e" }}>
                    {(() => {
                              const info = nameToItem[norm(row.original.item)];

                              if (!info) {
                                return (
                                  <>
                                    <div><strong>Item:</strong> {row.original.item}</div>
                                    <div><strong>Item ID:</strong> <em>nicht gefunden</em></div>
                                  </>
                                );
                              }

                              const wowheadUrl = `https://www.wowhead.com/wotlk/de/item=${info.id}`;
                              const iconUrl = `https://wow.zamimg.com/images/wow/icons/large/${info.icon}.jpg`;

                              return (
                                <>
                                  <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", textAlign: "left"}}>
                                    <img
                                      src={iconUrl}
                                      alt=""
                                      width={32}
                                      height={32}
                                      style={{ borderRadius: 4 }}
                                    />
                                    <div>
                                      <div>
                                        <strong>Item:</strong>{" "}
                                        <a href={wowheadUrl} target="_blank" rel="noreferrer">
                                          {row.original.item}
                                        </a>
                                      </div>

                                      <div>
                                        <strong>Item ID:</strong> {info.id}
                                      </div>
                                    </div>
                                  </div>
                                </>
                              );
                            })()}
                </div>
              </td>
            </tr>
          )}
        </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          ← Prev
        </button>

        <button
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next →
        </button>

        <span style={{ opacity: 0.8 }}>
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </span>

        <span style={{ opacity: 0.8 }}>
          ({table.getFilteredRowModel().rows.length} items)
        </span>

        <select
          value={table.getState().pagination.pageSize}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
          style={{ padding: 6 }}
        >
          {[10, 15, 25, 50].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
