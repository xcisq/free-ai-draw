export const scaleTextMetricBag = (
  value: unknown,
  scaleStyleMetric: (value: unknown) => unknown
) => {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const next = {
    ...(value as Record<string, unknown>),
  };
  next.fontSize = scaleStyleMetric(next.fontSize);
  next['font-size'] = scaleStyleMetric(next['font-size']);
  next.lineHeight = scaleStyleMetric(next.lineHeight);
  next['line-height'] = scaleStyleMetric(next['line-height']);
  next.letterSpacing = scaleStyleMetric(next.letterSpacing);
  next['letter-spacing'] = scaleStyleMetric(next['letter-spacing']);
  return next;
};
