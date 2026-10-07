/** A4 width at 96 dpi; the paper is rendered at this size and scaled. */
export const pageWidth = 794
const pageHeight = 1122.52
const pxPerMm = 7.559

export function fitScale(zoom: number, availableWidth: number) {
  return Math.min(zoom, Math.max(0.2, (availableWidth - 48) / pageWidth))
}
export function estimatePages(paperHeight: number, margin: number) {
  const marginPx = margin * pxPerMm
  return Math.max(1, Math.ceil((paperHeight - marginPx) / (pageHeight - marginPx)))
}
