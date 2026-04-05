import { Children, Fragment, useEffect, useMemo, useRef, useState } from 'react';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function ResizablePanels({
  children,
  storageKey,
  initialSizes,
  minSizes = [],
  maxSizes = [],
  className = '',
  stackBelow = 1024,
  handleClassName = '',
  onSizesChange,
}) {
  const panels = useMemo(() => Children.toArray(children).filter(Boolean), [children]);
  const panelCount = panels.length;
  const containerRef = useRef(null);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [isDragging, setIsDragging] = useState(false);

  const defaultSizes = useMemo(() => {
    if (Array.isArray(initialSizes) && initialSizes.length === panelCount) {
      return initialSizes;
    }
    return Array.from({ length: panelCount }, () => 100 / Math.max(panelCount, 1));
  }, [initialSizes, panelCount]);

  const [sizes, setSizes] = useState(() => {
    if (storageKey) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length === panelCount) {
            return parsed;
          }
        }
      } catch {
        // ignore stale persisted data
      }
    }
    return defaultSizes;
  });
  const effectiveSizes = sizes.length === panelCount ? sizes : defaultSizes;

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    onSizesChange?.(effectiveSizes);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(effectiveSizes));
    }
  }, [effectiveSizes, onSizesChange, storageKey]);

  useEffect(() => {
    if (!isDragging) {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      return undefined;
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  if (panelCount === 0) {
    return null;
  }

  if (panelCount === 1 || viewportWidth < stackBelow) {
    return (
      <div className={`flex min-h-0 min-w-0 flex-col ${className}`}>
        {panels.map((panel, index) => (
          <div key={index} className="min-h-0 min-w-0">
            {panel}
          </div>
        ))}
      </div>
    );
  }

  const startDrag = (index, event) => {
    if (!containerRef.current) {
      return;
    }

    event.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    const startX = event.clientX;
    const startSizes = [...effectiveSizes];
    const pairTotal = startSizes[index] + startSizes[index + 1];

    const minLeft = ((minSizes[index] ?? 180) / rect.width) * 100;
    const minRight = ((minSizes[index + 1] ?? 180) / rect.width) * 100;
    const maxLeft = maxSizes[index] ? ((maxSizes[index] / rect.width) * 100) : pairTotal - minRight;
    const maxRight = maxSizes[index + 1] ? ((maxSizes[index + 1] / rect.width) * 100) : pairTotal - minLeft;

    const handleMove = (moveEvent) => {
      const deltaPercent = ((moveEvent.clientX - startX) / rect.width) * 100;
      let left = startSizes[index] + deltaPercent;
      let right = pairTotal - left;

      left = clamp(left, minLeft, Math.min(maxLeft, pairTotal - minRight));
      right = pairTotal - left;

      if (right > maxRight) {
        right = maxRight;
        left = pairTotal - right;
      }

      if (right < minRight) {
        right = minRight;
        left = pairTotal - right;
      }

      setSizes((current) => {
        const base = current.length === panelCount ? current : defaultSizes;
        const next = [...base];
        next[index] = left;
        next[index + 1] = right;
        return next;
      });
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      setIsDragging(false);
    };

    setIsDragging(true);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  return (
    <div ref={containerRef} className={`flex min-h-0 min-w-0 ${className}`}>
      {panels.map((panel, index) => (
        <Fragment key={index}>
          <div
            className="min-h-0 min-w-0 overflow-hidden"
            style={{
              flexBasis: 0,
              flexGrow: effectiveSizes[index],
              minWidth: minSizes[index] ?? undefined,
              maxWidth: maxSizes[index] ?? undefined,
            }}
          >
            {panel}
          </div>
          {index < panelCount - 1 && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panels"
              className={`resizable-handle ${handleClassName}`}
              onPointerDown={(event) => startDrag(index, event)}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}
