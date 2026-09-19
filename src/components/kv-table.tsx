import { cn } from "@/lib/utils";

export function KvTable({
  entries,
  emptyLabel = "None",
  className,
  mono = true,
}: {
  entries: [string, string][];
  emptyLabel?: string;
  className?: string;
  mono?: boolean;
}) {
  if (!entries.length) {
    return <p className={cn("px-4 py-6 text-center text-xs text-muted-foreground", className)}>{emptyLabel}</p>;
  }
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left text-[12.5px]">
        <tbody className="divide-y divide-border/60">
          {entries.map(([k, v], i) => (
            <tr key={`${k}-${i}`} className="align-top hover:bg-muted/40">
              <th scope="row" className="w-[34%] max-w-72 py-2 pr-4 pl-4 font-mono font-medium text-muted-foreground break-all">
                {k}
              </th>
              <td className={cn("py-2 pr-4 break-all whitespace-pre-wrap", mono && "font-mono")}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
