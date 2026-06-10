import type { PartialOptions } from "overlayscrollbars";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import { type ComponentProps, type ReactNode, useEffect } from "react";

export type OverlayScrollbarVariant = "panel" | "card" | "inline";

const VARIANT_THEMES: Record<OverlayScrollbarVariant, string> = {
  panel: "os-theme-panel",
  card: "os-theme-card",
  inline: "os-theme-inline",
};

function getScrollbarOptions(variant: OverlayScrollbarVariant): PartialOptions {
  const overflow =
    variant === "inline"
      ? {
          x: "scroll" as const,
          y: "hidden" as const,
        }
      : {
          x: "scroll" as const,
          y: "scroll" as const,
        };
  return {
    overflow,
    scrollbars: {
      theme: VARIANT_THEMES[variant],
      visibility: "auto",
      autoHide: "leave",
      autoHideDelay: 700,
      dragScroll: true,
      pointers: ["mouse", "pen"],
    },
  };
}

export function OverlayScrollbar({
  children,
  variant = "panel",
  className,
  viewportRef,
  onViewportScroll,
  ...props
}: {
  children: ReactNode;
  variant?: OverlayScrollbarVariant;
  className?: string;
  viewportRef?: { current: HTMLElement | null };
  onViewportScroll?: (_event: Event) => void;
} & Omit<ComponentProps<"div">, "children" | "className" | "ref">) {
  const rootClassName = [
    variant === "inline" ? "w-full max-w-full min-w-0" : "h-full w-full min-h-0 flex-1",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    return () => {
      if (viewportRef) {
        viewportRef.current = null;
      }
    };
  }, [viewportRef]);

  return (
    <OverlayScrollbarsComponent
      defer
      options={getScrollbarOptions(variant)}
      events={{
        initialized(instance) {
          if (viewportRef) {
            viewportRef.current = instance.elements().viewport;
          }
        },
        scroll(instance, event) {
          if (viewportRef) {
            viewportRef.current = instance.elements().viewport;
          }
          onViewportScroll?.(event);
        },
      }}
      className={rootClassName}
      data-overlayscrollbars-initialize
      {...props}
    >
      {children}
    </OverlayScrollbarsComponent>
  );
}
