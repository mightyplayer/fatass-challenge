"use client";

import { useEffect, useRef, useState } from "react";

export function FileField({ name, label, multiple, accept = "image/*" }: { name: string; label: string; multiple?: boolean; accept?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const form = ref.current?.form;
    const reset = () => setCount(0);
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);
  return (
    <label className="btn btn-ghost !py-1.5 !px-3 !text-sm cursor-pointer w-fit">
      <input
        ref={ref}
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => setCount(e.currentTarget.files?.length ?? 0)}
      />
      📷 {label}
      {count > 0 && <span className="chip !py-0 !px-1.5">{count}</span>}
    </label>
  );
}
