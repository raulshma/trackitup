import type { DashboardWidget } from "@/types/trackitup";

const widgetSizes: DashboardWidget["size"][] = ["small", "medium", "large"];

export function moveDashboardWidgets(
  widgets: DashboardWidget[],
  widgetId: string,
  direction: "up" | "down",
) {
  const currentIndex = widgets.findIndex((widget) => widget.id === widgetId);
  if (currentIndex < 0) return widgets;

  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= widgets.length) return widgets;

  const nextWidgets = [...widgets];
  const [widget] = nextWidgets.splice(currentIndex, 1);
  nextWidgets.splice(targetIndex, 0, widget);
  return nextWidgets;
}

export function cycleDashboardWidgetSize(
  widgets: DashboardWidget[],
  widgetId: string,
) {
  return widgets.map((widget) => {
    if (widget.id !== widgetId) return widget;
    const currentIndex = widgetSizes.indexOf(widget.size);
    return {
      ...widget,
      size: widgetSizes[(currentIndex + 1) % widgetSizes.length] ?? "medium",
    };
  });
}

export function toggleDashboardWidgetVisibility(
  widgets: DashboardWidget[],
  widgetId: string,
) {
  return widgets.map((widget) =>
    widget.id === widgetId ? { ...widget, hidden: !widget.hidden } : widget,
  );
}