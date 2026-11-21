import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Label + input, for plain server-rendered forms. */
export function Field({ label, name, ...props }: { label: string; name: string } & React.ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} className="h-11" {...props} />
    </div>
  );
}

export function SelectField({ label, name, children, ...props }: { label: string; name: string } & React.ComponentProps<"select">) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} className="h-11 rounded-lg border border-input bg-transparent px-2.5" {...props}>
        {children}
      </select>
    </div>
  );
}
