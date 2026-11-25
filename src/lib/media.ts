export interface ResponsiveImageAttrs {
  src: string;
  srcSet?: string;
  sizes?: string;
  width: number;
  height: number;
}

const KNOWN_ASSETS: Record<
  string,
  { width: number; height: number; srcSet?: string }
> = {
  '/assets/img/seeme/space-1.jpg': { width: 2048, height: 1536 },
  '/assets/img/seeme/space-2.jpg': { width: 2048, height: 1536 },
  '/assets/img/seeme/space-3.jpg': { width: 2048, height: 1365 },
  '/assets/img/seeme/space-4.jpg': { width: 1365, height: 2048 },
  '/assets/img/seeme/space-5.jpg': { width: 2048, height: 1365 },
  '/assets/img/seeme/cover-3.jpg': { width: 1365, height: 2047 },
  '/assets/img/seeme/living-1.jpg': { width: 2048, height: 1638 },
  '/assets/img/seeme/living-3.jpg': { width: 2048, height: 1638 },
  '/assets/img/seeme/living-4.jpg': { width: 1365, height: 2048 },
  '/assets/img/seeme/living-5.jpg': { width: 1638, height: 2048 },
  '/assets/img/seeme/hoa-le-bed-1.jpg': { width: 1538, height: 2048 },
  '/assets/img/seeme/hoa-le-bed-2.jpg': { width: 1538, height: 2048 },
  '/assets/img/seeme/hoa-le-1.jpg': { width: 1638, height: 2048 },
  '/assets/img/seeme/hoa-le-2.jpg': { width: 1638, height: 2048 },
  '/assets/img/seeme/hoa-le-3.jpg': { width: 2048, height: 1638 },
  '/assets/img/seeme/hoa-le-4.jpg': { width: 1365, height: 2048 },
  '/assets/img/seeme/hoa-le-5.jpg': { width: 1638, height: 2048 },
  '/assets/img/seeme/anh-dao-1.jpg': { width: 2048, height: 1365 },
  '/assets/img/seeme/anh-dao-2.jpg': { width: 1638, height: 2048 },
  '/assets/img/seeme/anh-dao-3.jpg': { width: 1638, height: 2048 },
  '/assets/img/seeme/anh-dao-4.jpg': { width: 2048, height: 1638 },
  '/assets/img/seeme/anh-dao-5.jpg': { width: 1638, height: 2048 },
  '/assets/img/seeme/lo-lo-hoa-1.jpg': { width: 2048, height: 1365 },
  '/assets/img/seeme/lo-lo-hoa-2.jpg': { width: 2048, height: 1365 },
  '/assets/img/seeme/lo-lo-hoa-3.jpg': { width: 2048, height: 1365 },
  '/assets/img/seeme/lo-lo-hoa-4.jpg': { width: 2048, height: 1365 },
  '/assets/img/seeme/lo-lo-hoa-5.jpg': { width: 1365, height: 2048 },
  '/assets/img/seeme/moc-mien-1.jpg': { width: 2048, height: 1365 },
  '/assets/img/seeme/moc-mien-2.jpg': { width: 2048, height: 1365 },
  '/assets/img/seeme/moc-mien-3.jpg': { width: 1538, height: 2048 },
  '/assets/img/seeme/moc-mien-4.jpg': { width: 1538, height: 2048 },
  '/assets/img/seeme/moc-mien-5.jpg': { width: 1638, height: 2048 },
};

export function getResponsiveImageAttrs(
  url: string,
  defaultSizes = '(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 45vw'
): ResponsiveImageAttrs {
  const known = KNOWN_ASSETS[url];
  if (!known) {
    return { src: url, width: 1200, height: 800, sizes: defaultSizes };
  }
  return {
    src: url,
    srcSet: known.srcSet,
    sizes: known.srcSet ? defaultSizes : undefined,
    width: known.width,
    height: known.height,
  };
}
