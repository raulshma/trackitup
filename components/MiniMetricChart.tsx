import { ScrollView, StyleSheet, View } from "react-native";

import { Text } from "@/components/Themed";
import type { MetricChartPoint } from "@/services/insights/workspaceInsights";

export type ChartMode = "line" | "bar" | "scatter";

type MetricLegendItem = {
  id: string;
  label: string;
  color: string;
  unitLabel?: string;
};

type MiniMetricChartProps = {
  points: MetricChartPoint[];
  metrics: MetricLegendItem[];
  mode: ChartMode;
  mutedColor: string;
  borderColor: string;
};

const chartHeight = 132;
const chartLeftPadding = 24;
const pointSpacing = 60;

function getValueRange(points: MetricChartPoint[], metrics: MetricLegendItem[]) {
  const values = points.flatMap((point) =>
    metrics.flatMap((metric) =>
      point.values[metric.id] !== undefined ? [point.values[metric.id]] : [],
    ),
  );

  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max: min === max ? max + 1 : max };
}

export function MiniMetricChart({
  points,
  metrics,
  mode,
  mutedColor,
  borderColor,
}: MiniMetricChartProps) {
  if (points.length === 0 || metrics.length === 0) {
    return <Text style={[styles.emptyCopy, { color: mutedColor }]}>Add more metric readings to render this widget.</Text>;
  }

  const chartWidth = Math.max(240, chartLeftPadding * 2 + (points.length - 1) * pointSpacing);
  const range = getValueRange(points, metrics);
  const scaleY = (value: number) => {
    const ratio = (value - range.min) / (range.max - range.min);
    return chartHeight - ratio * (chartHeight - 20) - 10;
  };

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={[styles.chartFrame, { width: chartWidth, borderColor }]}> 
          {[0.25, 0.5, 0.75].map((ratio) => (
            <View key={ratio} style={[styles.gridLine, { top: chartHeight * ratio, borderColor }]} />
          ))}

          {mode === "line"
            ? metrics.flatMap((metric) =>
                points.slice(1).flatMap((point, index) => {
                  const previousPoint = points[index];
                  const startValue = previousPoint.values[metric.id];
                  const endValue = point.values[metric.id];
                  if (startValue === undefined || endValue === undefined) return [];

                  const startX = chartLeftPadding + index * pointSpacing;
                  const endX = chartLeftPadding + (index + 1) * pointSpacing;
                  const startY = scaleY(startValue);
                  const endY = scaleY(endValue);
                  const distance = Math.hypot(endX - startX, endY - startY);
                  const angle = Math.atan2(endY - startY, endX - startX);

                  return [
                    <View
                      key={`${metric.id}-${previousPoint.id}-${point.id}`}
                      style={[
                        styles.lineSegment,
                        {
                          backgroundColor: metric.color,
                          left: startX,
                          top: startY,
                          width: distance,
                          transform: [{ rotateZ: `${angle}rad` }],
                        },
                      ]}
                    />,
                  ];
                }),
              )
            : null}

          {points.map((point, pointIndex) => {
            const x = chartLeftPadding + pointIndex * pointSpacing;

            return (
              <View key={point.id}>
                {metrics.map((metric, metricIndex) => {
                  const value = point.values[metric.id];
                  if (value === undefined) return null;

                  const y = scaleY(value);
                  if (mode === "bar") {
                    const barWidth = 12;
                    const barOffset = (metricIndex - (metrics.length - 1) / 2) * 16;
                    return (
                      <View
                        key={`${point.id}-${metric.id}`}
                        style={[
                          styles.bar,
                          {
                            backgroundColor: metric.color,
                            left: x + barOffset - barWidth / 2,
                            top: y,
                            height: chartHeight - y,
                            width: barWidth,
                          },
                        ]}
                      />
                    );
                  }

                  return (
                    <View
                      key={`${point.id}-${metric.id}`}
                      style={[
                        styles.dot,
                        {
                          backgroundColor: metric.color,
                          left: x - 5 + metricIndex * 2,
                          top: y - 5,
                        },
                      ]}
                    />
                  );
                })}

                <Text style={[styles.axisLabel, { color: mutedColor, left: x - 20 }]}>
                  {point.label}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.legendRow}>
        {metrics.map((metric) => (
          <View key={metric.id} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: metric.color }]} />
            <Text style={[styles.legendLabel, { color: mutedColor }]}>
              {metric.label}
              {metric.unitLabel ? ` (${metric.unitLabel})` : ""}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartFrame: {
    height: chartHeight + 26,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    marginTop: 12,
    marginBottom: 12,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    opacity: 0.5,
  },
  lineSegment: {
    position: "absolute",
    height: 2,
    transformOrigin: "left center",
  },
  bar: {
    position: "absolute",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  dot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  axisLabel: {
    position: "absolute",
    top: chartHeight + 6,
    width: 40,
    fontSize: 11,
    textAlign: "center",
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyCopy: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
});