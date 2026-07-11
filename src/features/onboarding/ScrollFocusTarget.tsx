import { PropsWithChildren, useEffect, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import { useScrollToScreenY } from '@/components/Screen';

export function ScrollFocusTarget({ active, children }: PropsWithChildren<{ active: boolean }>) {
  const scrollToY = useScrollToScreenY();
  const [y, setY] = useState<number>();

  useEffect(() => {
    if (active && typeof y === 'number') scrollToY(y);
  }, [active, scrollToY, y]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setY(event.nativeEvent.layout.y);
  };

  return <View onLayout={handleLayout}>{children}</View>;
}
