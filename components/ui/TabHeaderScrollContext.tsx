import React from "react";
import { Animated, Platform, type ScrollViewProps } from "react-native";

type TabHeaderScrollContextValue = {
  getScrollValue: (routeName: string) => Animated.Value;
};

const TabHeaderScrollContext = React.createContext<
  TabHeaderScrollContextValue | undefined
>(undefined);

export function TabHeaderScrollProvider({ children }: React.PropsWithChildren) {
  const scrollValuesRef = React.useRef(new Map<string, Animated.Value>());

  const getScrollValue = React.useCallback((routeName: string) => {
    const existingValue = scrollValuesRef.current.get(routeName);

    if (existingValue) {
      return existingValue;
    }

    const nextValue = new Animated.Value(0);
    scrollValuesRef.current.set(routeName, nextValue);
    return nextValue;
  }, []);

  return (
    <TabHeaderScrollContext.Provider value={{ getScrollValue }}>
      {children}
    </TabHeaderScrollContext.Provider>
  );
}

function useTabHeaderScrollContext() {
  const context = React.useContext(TabHeaderScrollContext);

  if (!context) {
    throw new Error(
      "Tab header scroll hooks must be used within the provider.",
    );
  }

  return context;
}

export function useTabHeaderScrollValue(routeName: string) {
  const { getScrollValue } = useTabHeaderScrollContext();

  return React.useMemo(
    () => getScrollValue(routeName),
    [getScrollValue, routeName],
  );
}

export function useTabHeaderScroll(routeName: string): {
  onScroll?: ScrollViewProps["onScroll"];
  scrollEventThrottle: number;
  removeClippedSubviews?: boolean;
} {
  const scrollY = useTabHeaderScrollValue(routeName);
  const isWeb = Platform.OS === "web";
  const isAndroid = Platform.OS === "android";

  const onScroll = React.useMemo(
    () =>
      isWeb
        ? undefined
        : Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: true,
          }),
    [isWeb, scrollY],
  );

  return {
    onScroll,
    scrollEventThrottle: isWeb ? 64 : isAndroid ? 32 : 16,
    removeClippedSubviews: isAndroid ? true : undefined,
  };
}
