type Props = {
  children: React.ReactNode;
  onAnimationEnd?: () => void;
  isReady: boolean;
};

export function AnimatedSplashScreen({
  children,
  onAnimationEnd: _onAnimationEnd,
  isReady: _isReady,
}: Props) {
  return <>{children}</>;
}
