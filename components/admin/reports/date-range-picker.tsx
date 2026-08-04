import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: string
  to: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
}) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="report-from" className="text-xs">
          From
        </Label>
        <Input id="report-from" type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className="h-9" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="report-to" className="text-xs">
          To
        </Label>
        <Input id="report-to" type="date" value={to} onChange={(e) => onToChange(e.target.value)} className="h-9" />
      </div>
    </div>
  )
}
