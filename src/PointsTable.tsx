import React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type {
  ColumnDef,
  SortingState,
} from "@tanstack/react-table";

type PointsRow = { player: string; points: number };

export function PointsTable({
  data,
  onPlayerClick,
}: {
  data: PointsRow[];
  onPlayerClick: (player: string) => void;
}) {
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "points", desc: true },
  ]);

  const columns = React.useMemo<ColumnDef<PointsRow>[]>(
    () => [
      {
        accessorKey: "player",
        header: "Spieler",
        cell: ({ row }) => (
          <button className="player-link" onClick={() => onPlayerClick(row.original.player)}>
            {row.original.player}
          </button>
        ),
      },
      {
        accessorKey: "points",
        header: "Punkte",
      },
    ],
    [onPlayerClick]
  );

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="points-table-container">
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <input
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          placeholder="Filter (Spieler oder Punkte)..."
          style={{ padding: 8, width: "80%" , margin: "20px auto 10px", textAlign:"center"}}
        />
      </div>

      <table className="points-table">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  style={{ cursor: header.column.getCanSort() ? "pointer" : "default" }}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === "asc" ? " ▲" : ""}
                  {header.column.getIsSorted() === "desc" ? " ▼" : ""}
                </th>
              ))}
            </tr>
          ))}
        </thead>

        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 10, opacity: 0.8 }}>
        {table.getFilteredRowModel().rows.length} rows
      </div>
    </div>
  );
}
