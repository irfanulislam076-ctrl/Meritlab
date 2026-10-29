type LogoProps = { size?: "sm" | "md"; className?: string };

export function Logo({ size = "md", className = "" }: LogoProps) {
  const tile = size === "md" ? "h-11 w-11 text-xl" : "h-9 w-9 text-lg";
  const name = size === "md" ? "text-[22px]" : "text-lg";
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className={`grid place-items-center rounded-btn bg-navy font-bold text-peach ${tile}`}>M</span>
      <span className={`font-bold tracking-tight text-navy ${name}`}>Meritlab</span>
    </div>
  );
}
